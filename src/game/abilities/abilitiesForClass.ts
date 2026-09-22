import type { Ability } from '../../engine';
import { DEFAULT_GCD_MS, MINIMUM_GCD_MS } from '../../engine';
import type { ClassId, CombatStyleId } from '../character';
import type { TalentAllocation } from '../talents/Talent';
import type { TalentEffects } from '../talents/TalentEffect';
import type { TalentBuild } from '../talents/talentBuild';
import { talentBuild } from '../talents/talentBuild';
import { WARRIOR_TALENT_EFFECTS } from '../talents/warriorEffects';
import { WARRIOR_ABILITIES } from './warrior';
import { legalAllocation } from '../talents/talentRules';
import { talentsForClass } from '../talents/talentData';

/**
 * Abilities that exist only because a talent grants them, as
 * `ability id -> the talent id that grants it`.
 *
 * All four Warrior entries are one-rank talents, and their slugified names
 * happen to equal their ability ids. That is a coincidence worth not relying
 * on: the mapping is written out so that renaming either side is a visible
 * change rather than a silent one, and a test asserts every talent id here
 * exists in the class's trees.
 *
 * Three of these are 31-point capstones in three different trees:
 *
 *     arms       row 6   Mortal Strike
 *     fury       row 6   Bloodthirst
 *     protection row 6   Shield Slam
 *
 * 51 points cannot reach two of them, so a warrior has exactly one. Before this
 * mapping existed every warrior was handed all three, which made every measured
 * damage figure too high for a reason nothing in the results could show.
 */
const TALENT_ABILITIES: Partial<Record<ClassId, Readonly<Record<string, string>>>> = {
  warrior: grantsByAbility(WARRIOR_TALENT_EFFECTS),
};

/**
 * Invert a class's effect table into `ability id -> the talent granting it`.
 *
 * Derived rather than written out a second time. The effect table is where a
 * talent says what it does, including `grantAbility`, so a separate hand-kept
 * list would be a second source for the same fact and would eventually
 * disagree with the first.
 */
function grantsByAbility(
  effects: Readonly<Record<string, TalentEffects>>,
): Readonly<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const [talentId, declared] of Object.entries(effects)) {
    for (const effect of declared) {
      if (effect.kind === 'grantAbility') map[effect.abilityId] = talentId;
    }
  }
  return map;
}

/** The talent id that grants an ability, if a talent grants it at all. */
export function talentGranting(
  characterClass: ClassId,
  abilityId: string,
): string | undefined {
  return TALENT_ABILITIES[characterClass]?.[abilityId];
}

/**
 * Abilities a class knows.
 *
 * Only the Warrior has content, from WoWForeverWarriorAbilities.xlsx — see
 * `warrior.ts` and `docs/warrior-abilities.md`. Every other class returns an
 * empty list and fights with auto attacks alone.
 *
 * That gap is deliberate and visible rather than papered over with invented
 * spells. Each class is filled in as its spreadsheet arrives.
 *
 * Two things gate what comes back:
 *
 * - **The combat style**, for abilities that need particular gear in hand.
 * - **The talent allocation**, for abilities a tree grants. An OMITTED
 *   allocation means no talents, and so no talent-granted abilities. That is
 *   the honest reading rather than a lenient one: a caller that has not said
 *   what it spent has not spent anything, and the alternative — treating
 *   "unknown" as "all of them" — is exactly the bug this gating exists to fix.
 */
export function abilitiesForClass(
  characterClass: ClassId,
  style?: CombatStyleId,
  talents?: TalentAllocation,
): readonly Ability[] {
  /*
   * ILLEGAL TALENTS ARE STRIPPED BEFORE ANYTHING IS GRANTED.
   *
   * This is the function that decides what a character knows, so it is the
   * function that has to refuse an unearned capstone. One point in Mortal
   * Strike -- tier 30 of Arms, and a prerequisite of its own -- used to hand
   * the ability over, because the allocation was taken at face value.
   *
   * `createPlayer` strips as well, and that is not redundant: it needs the
   * legal allocation for stats and resource caps too, and the UI calls this one
   * directly to decide what to show. Both entry points now apply the rules, and
   * a test pins each.
   */
  const talentTree = talentsForClass(characterClass);
  const legal =
    talentTree && talents ? legalAllocation(talentTree, talents).allocation : (talents ?? {});

  return abilitiesForBuild(characterClass, style, talentBuild(characterClass, legal));
}

/**
 * The same thing, for a caller that has already resolved the build.
 *
 * `createPlayer` needs the build anyway, for stats and resource caps, so this
 * saves resolving the allocation twice and — more usefully — keeps one code
 * path deciding what a character knows.
 */
export function abilitiesForBuild(
  characterClass: ClassId,
  style: CombatStyleId | undefined,
  build: TalentBuild,
): readonly Ability[] {
  if (characterClass !== 'warrior') return [];
  const granted = TALENT_ABILITIES[characterClass] ?? {};

  return WARRIOR_ABILITIES.filter((ability) => {
    // Shield Slam needs a shield. Gating on the weapon rather than on a stance
    // is how Classic expresses it; the spreadsheet says nothing either way.
    // This is checked before the talent, so a warrior who took Shield Slam and
    // put away their shield still cannot use it.
    if (ability.id === 'shield_slam' && style !== 'one_hand_shield') return false;

    if (granted[ability.id] === undefined) return true;
    return build.grantedAbilities.has(ability.id);
  }).map((ability) => applyTalentChanges(ability, build));
}

/**
 * Apply a build's cost and cooldown reductions to one ability.
 *
 * Returns a COPY. Ability definitions are module-level constants shared by
 * every character in every iteration of a Monte Carlo batch, so editing one in
 * place would leak a talent into characters that never took it — and the bug
 * would compound across iterations rather than showing up on the first.
 *
 * A cost cannot go below zero, and neither can a cooldown; a talent that
 * reduces one further than it goes simply takes it to nothing.
 */
function applyTalentChanges(ability: Ability, build: TalentBuild): Ability {
  /*
   * A per-ability reduction PLUS the one that covers everything rolling a
   * combat table. Both apply: Improved Heroic Strike and Focused Rage are
   * different talents and a warrior with both pays for neither twice.
   *
   * "Offensive" is `attackTable`, on the ruleset owner's definition -- Heroic
   * Strike, Thunder Clap and Sunder Armor have one and Battle Shout does not.
   */
  const costReduction =
    (build.abilityCostReduction.get(ability.id) ?? 0) +
    (ability.attackTable ? build.attackAbilityCostReduction : 0);
  const cooldownReduction = build.abilityCooldownReductionMs.get(ability.id) ?? 0;
  const bonuses = build.abilityBonuses.get(ability.id);
  const castReduction = build.abilityCastTimeReductionMs.get(ability.id) ?? 0;
  const gcdReduction = build.abilityGcdReductionMs.get(ability.id) ?? 0;
  const holdsSwing = build.abilitiesHoldingSwing.has(ability.id);
  if (
    costReduction === 0 &&
    cooldownReduction === 0 &&
    castReduction === 0 &&
    gcdReduction === 0 &&
    !holdsSwing &&
    !bonuses
  ) {
    return ability;
  }

  return {
    ...ability,
    ...(bonuses ? { bonuses } : {}),
    ...(holdsSwing ? { swingTimer: 'hold' as const } : {}),
    ...(ability.castTimeMs && castReduction > 0
      ? { castTimeMs: Math.max(0, ability.castTimeMs - castReduction) }
      : {}),
    ...(gcdReduction > 0
      ? { gcdMs: Math.max(MINIMUM_GCD_MS, (ability.gcdMs ?? DEFAULT_GCD_MS) - gcdReduction) }
      : {}),
    ...(ability.cost && costReduction > 0
      ? { cost: { ...ability.cost, amount: Math.max(0, ability.cost.amount - costReduction) } }
      : {}),
    ...(ability.cooldownMs && cooldownReduction > 0
      ? { cooldownMs: Math.max(0, ability.cooldownMs - cooldownReduction) }
      : {}),
  };
}
