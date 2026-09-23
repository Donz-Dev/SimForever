import type { AuraDefinition } from '../../engine';
import { RATING_PER_PERCENT, dealDamage, flat, seconds } from '../../engine';

/**
 * Shaman auras, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * Captured in `src/data/abilities/forever-shaman-spellbook.json` at MAX RANK.
 *
 * ----------------------------------------------------------------------------
 * THE FIRST CLASS TO BUFF ITS OWN WEAPON. Windfury Weapon is a SPELL the
 * Shaman casts on itself, not an item enchant and not a raid buff, and it is
 * the same effect the raid already has as Windfury Totem -- at a different
 * rate, with TWO extra attacks rather than one, and with the totem explicitly
 * switched off for whoever carries it.
 *
 * So the imbue is modelled as an aura that a reaction READS. Nothing else in
 * the project needed that: Crusader rides on an item and the totem rides on a
 * raid-buff selection, and neither is something the character spends a global
 * cooldown to put up. `windfuryWeaponReaction` in `reactions/shaman.ts` is the
 * other half, and it fires only while this is up.
 * ----------------------------------------------------------------------------
 */

const FIRE = 'fire' as const;

/**
 * A flat percentage as the engine's own haste rating.
 *
 * Converted with the SAME constant `hasteMultiplierFrom` divides by, so the
 * round trip is exact whatever that constant is set to. Copied in spirit from
 * the Warrior's Flurry, which is where this trick was worked out.
 */
const hasteFromPercent = (percent: number) =>
  flat('hasteRating', percent * RATING_PER_PERCENT.haste);

// ---------------------------------------------------------------------------
// Elemental
// ---------------------------------------------------------------------------

/**
 * Flame Shock's burn half: "166 Fire damage immediately and 176 Fire damage
 * over 12 sec".
 *
 * THE THREE-SECOND CADENCE IS THE READING THAT DIVIDES EVENLY. The source
 * gives a total and a duration and no interval, and of the plausible cadences
 * only three seconds splits 176 over 12 seconds into whole ticks: four of 44.
 * Two seconds would leave six of 29.33 and four seconds three of 58.67. Same
 * argument as Moonfire's, and stated here rather than assumed.
 *
 * FIRE, AND THEREFORE NOT REDUCED BY ARMOR, which is true of every magical
 * school. It still crits, at the crit chance of the event that applied it.
 */
export const FLAME_SHOCK_DOT_TOTAL = 176;
export const FLAME_SHOCK_DOT_DURATION_MS = seconds(12);
export const FLAME_SHOCK_TICK_INTERVAL_MS = seconds(3);

export const FLAME_SHOCK_DOT: AuraDefinition = {
  id: 'flame_shock',
  name: 'Flame Shock',
  durationMs: FLAME_SHOCK_DOT_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: FLAME_SHOCK_TICK_INTERVAL_MS,
    onTick: (context, aura) => {
      const source = context.combatant(aura.sourceId);
      const target = context.combatant(aura.targetId);
      if (!source || !target || !target.isAlive) return;

      dealDamage(context, {
        source,
        target,
        abilityId: aura.id,
        abilityName: aura.name,
        school: FIRE,
        baseAmount:
          FLAME_SHOCK_DOT_TOTAL / (FLAME_SHOCK_DOT_DURATION_MS / FLAME_SHOCK_TICK_INTERVAL_MS),
        // No coefficient is stated, so none is invented -- the decision every
        // periodic effect in this project carries.
        powerCoefficient: 0,
        periodic: true,
        critFrom: 'spell',
        appliesArmor: false,
      });
    },
  },
};

// ---------------------------------------------------------------------------
// Enhancement
// ---------------------------------------------------------------------------

/**
 * Stormstrike's debuff: "increase the damage you deal to the target with your
 * next Lightning Bolt, Chain Lightning, or Earth Shock spell by 20% for 12
 * sec".
 *
 * ----------------------------------------------------------------------------
 * CONSUMED BY THE SPELL, NOT BY THE CLOCK, and that is why it carries no
 * `damageTakenBySchool`. All three named spells are Nature, so a school
 * multiplier would be an exact fit for WHICH spells -- and completely wrong
 * about HOW MANY, because nothing in the engine consumes a debuff when the
 * attacker's damage lands. Twelve seconds of +20% Nature is several spells,
 * and the tooltip says one.
 *
 * So each of the three reads this aura in its own `onCast` and removes it, and
 * the multiplier lives in `abilities/shaman.ts` beside them. That is content
 * doing what content can do, rather than an engine rule named after one
 * talent.
 * ----------------------------------------------------------------------------
 */
export const STORMSTRIKE_DAMAGE_BONUS = 1.2;
export const STORMSTRIKE_DEBUFF_DURATION_MS = seconds(12);

export const STORMSTRIKE_DEBUFF: AuraDefinition = {
  id: 'stormstrike',
  name: 'Stormstrike',
  durationMs: STORMSTRIKE_DEBUFF_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
};

/**
 * Windfury Weapon, the imbue itself.
 *
 * Sixty minutes, so it is up for every fight this project measures once it has
 * been cast -- which costs one global cooldown at the pull and is in the
 * priority list for that reason rather than being assumed.
 *
 * It grants nothing on its own. `windfuryWeaponReaction` reads it.
 */
export const WINDFURY_WEAPON_DURATION_MS = seconds(60 * 60);

export const WINDFURY_WEAPON_IMBUE: AuraDefinition = {
  id: 'windfury_weapon',
  name: 'Windfury Weapon',
  durationMs: WINDFURY_WEAPON_DURATION_MS,
};

/**
 * The attack power window a Windfury Weapon proc opens: "2 extra attacks with
 * 333 extra melee attack power".
 *
 * ONE AND A HALF SECONDS, AND AN INTERNAL COOLDOWN OF THE SAME LENGTH, both
 * borrowed from Windfury Totem -- whose window the ruleset owner stated
 * directly. The weapon imbue's own duration is NOT stated anywhere in the
 * spellbook, which gives only the chance, the count and the attack power.
 *
 * So this is a `PLACEHOLDER_` and says so: it is the totem's figure, applied
 * to the imbue because the two are the same effect at different strengths, and
 * it is unverified. Confirming it means one line from the ruleset owner.
 */
export const PLACEHOLDER_WINDFURY_WEAPON_DURATION_MS = seconds(1.5);

export function windfuryWeaponAura(attackPower: number): AuraDefinition {
  return {
    id: 'windfury_weapon_proc',
    name: 'Windfury Weapon',
    durationMs: PLACEHOLDER_WINDFURY_WEAPON_DURATION_MS,
    refreshBehaviour: 'reset',
    statModifiers: [flat('attackPower', attackPower)],
  };
}

/**
 * Rage of the Farseer: "Increases your melee attack speed and spell casting
 * speed by 30% for 25 sec."
 *
 * ONE STAT COVERS BOTH CLAUSES. `hasteMultiplierFrom` is what scales a swing
 * timer AND what scales a cast time, so a single haste modifier is the whole
 * talent rather than half of it -- which is not true of most two-clause
 * talents in this project and is worth saying out loud.
 */
export const RAGE_OF_THE_FARSEER_HASTE_PERCENT = 30;
export const RAGE_OF_THE_FARSEER_DURATION_MS = seconds(25);

export const RAGE_OF_THE_FARSEER: AuraDefinition = {
  id: 'rage_of_the_farseer',
  name: 'Rage of the Farseer',
  durationMs: RAGE_OF_THE_FARSEER_DURATION_MS,
  refreshBehaviour: 'reset',
  statModifiers: [hasteFromPercent(RAGE_OF_THE_FARSEER_HASTE_PERCENT)],
};

/**
 * Elemental Devastation: "Your offensive spell critical strikes will increase
 * your chance to get a critical strike with melee attacks by {0}% for 10 sec."
 *
 * A SPELL CRIT BUFFING MELEE, which is the whole point of the talent and the
 * reason it sits in a hybrid's Elemental tree. `critChance` is the melee one;
 * `spellCritChance` is separate, so this raises exactly what it says.
 */
export const ELEMENTAL_DEVASTATION_DURATION_MS = seconds(10);

export function elementalDevastationAura(critPercent: number): AuraDefinition {
  return {
    id: 'elemental_devastation',
    name: 'Elemental Devastation',
    durationMs: ELEMENTAL_DEVASTATION_DURATION_MS,
    refreshBehaviour: 'reset',
    statModifiers: [flat('critChance', critPercent)],
  };
}

/**
 * Maelstrom Weapon, TRACKED AND INERT.
 *
 * ----------------------------------------------------------------------------
 * THE ENHANCEMENT CAPSTONE, AND THE THIRD CLASS TO WANT THE SAME MISSING RULE.
 *
 *   "When you deal damage with a melee attack, you have a chance to reduce the
 *    cast time and Mana cost of your next Lightning Bolt spell by 20%. Stacks
 *    up to 5 times. Lasts 30 sec."
 *
 * A ONE-SHOT, STACK-SCALED, PER-ABILITY CAST-TIME MODIFIER. Cast time is
 * resolved by the engine before `onCast` runs, so unlike Stormstrike's debuff
 * this cannot be done from content: `abilityCastTime` is a standing talent
 * reduction fixed when the character is built, and an aura reaches every
 * ability or none.
 *
 * The Druid found the same shape first -- Eclipse, Nature's Grace and Nature's
 * Swiftness -- and the Mage and Priest are waiting on it too. It is one engine
 * feature and it unblocks four classes.
 *
 * Applied anyway, so the stacks are VISIBLE on the results page and the
 * capstone is not silent. `MAELSTROM_WEAPON_UNMODELLED` is what the ability
 * and the talent both print.
 * ----------------------------------------------------------------------------
 */
export const MAELSTROM_WEAPON_MAX_STACKS = 5;
export const MAELSTROM_WEAPON_DURATION_MS = seconds(30);

export const MAELSTROM_WEAPON_UNMODELLED =
  'Maelstrom Weapon stacks are tracked and change nothing. Reducing the cast ' +
  'time of the NEXT Lightning Bolt by 20% a stack needs a one-shot, ' +
  'stack-scaled, per-ability cast-time modifier, which the engine does not ' +
  'have -- the same rule Eclipse and Nature’s Swiftness want.';

export const MAELSTROM_WEAPON: AuraDefinition = {
  id: 'maelstrom_weapon',
  name: 'Maelstrom Weapon',
  durationMs: MAELSTROM_WEAPON_DURATION_MS,
  maxStacks: MAELSTROM_WEAPON_MAX_STACKS,
  refreshBehaviour: 'reset',
};
