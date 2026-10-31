import type { MultiTargetDefaults } from './types';
import type { AplEntry, AplList } from '../../game/rotations/apl';
import { all, targetCount, targetMissing, targetStacks } from '../../game/rotations/apl';
import { MAGE_ARCANE, MAGE_FIRE, MAGE_FROST, MAGE_FROSTFIRE } from '../../game/rotations/mage';
import { racialsForRace } from '../../game/rotations/racialCooldowns';
import { withoutUnselectedConsumables } from '../../game/rotations/consumableCooldowns';
import { casterConsumables } from '../../game/buffs/consumables';
import type { ConsumableSelection } from '../../game/buffs/consumables';
import type { RaceId } from '../../game/character';

/**
 * The Mage presets' optimised Multi Target lists (round 78), keyed by preset
 * id. A preset with no entry runs its Single Target list on several targets.
 *
 * ==============================================================================
 * EACH IS THE PRESET'S OWN SINGLE TARGET LIST WITH AREA ENTRIES PUT ABOVE ITS
 * FIRST DAMAGING SPELL, every one gated on the Number of Targets -- so below the
 * gate the Single Target list runs as it does on one target, and it is also the
 * fallback once the mana for the area spells is gone. Measured at 5 targets/60s
 * and checked at 3 targets/60s and 8 targets/30s against the Single Target list
 * (paired, 400 fights, `tools/optimise/mageVariants.ts`):
 *
 *   preset          list                                         3        5        8
 *   mage_fire       stack (>=5), FS on dot (>=3), FS (>=5)   +180.9   +757.8  +1718.2
 *   mage_frostfire  FS on dot (>=3), FS (>=5)                +115.0   +552.5  +1672.3
 *   mage_arcane     PoM-FS stack, FS on dot, AE (all >=3)    +185.3  +1061.3  +2625.4
 *   mage_frost      FS on dot (>=3), Blizzard (>=5)          +119.8   +798.8  +1888.3
 *
 * FLAMESTRIKE IS THE MAGE'S AREA SPELL ON EVERY SPEC. 990 mana for a three
 * second cast that hits every target and burns each for eight seconds, and it
 * beats Arcane Explosion and Blizzard per second AND per mana from five targets
 * up -- even for the Arcane build, which has no Fire talents. "On dot" is the
 * boss's Flamestrike burn having run out; at three targets that is what pays,
 * and recasting into a running burn loses to the Single Target filler there, so
 * the unconditional recast is gated at five (Fire, Frostfire). The filler under
 * it is Arcane Explosion for the Arcane build and Blizzard for the Frost one.
 *
 * AND THE SINGLE TARGET COOLDOWN STACK IS GATED ON A SINGLE TARGET STATE --
 * five Fire Vulnerability stacks, four Arcane Blast stacks -- which an area
 * rotation never builds, so beneath an area entry it never fires. It is copied
 * above the area entries gated on the target count instead; the Arcane copy
 * casts FLAMESTRIKE under Presence of Mind where the Single Target one casts
 * Arcane Wrath (+71.8 over the Arcane Wrath stack at 5 targets).
 * ==============================================================================
 */
const MAGE = 'mage' as const;
const atLeast = (count: number) => targetCount('atLeast', count);

const flamestrikeOnDot = (count: number): AplEntry => ({
  abilityId: 'flamestrike',
  condition: all(atLeast(count), targetMissing('flamestrike')),
  note: `At ${count}+ targets, when the boss's Flamestrike burn has run out.`,
});
const flamestrike = (count: number): AplEntry => ({
  abilityId: 'flamestrike',
  condition: atLeast(count),
  note: `At ${count}+ targets, recast whenever it can be: it out-damages everything else per second and per mana.`,
});
const arcaneExplosion = (count: number): AplEntry => ({
  abilityId: 'arcane_explosion',
  condition: atLeast(count),
  note: `At ${count}+ targets, the filler between Flamestrikes.`,
});
const blizzard = (count: number): AplEntry => ({
  abilityId: 'blizzard',
  condition: atLeast(count),
  note: `At ${count}+ targets, the filler between Flamestrikes; with Improved Blizzard its ticks proc Fingers of Frost.`,
});

const DAMAGE = new Set([
  'scorch', 'pyroblast', 'fire_blast', 'frostfire_bolt', 'fireball', 'arcane_missiles', 'arcane_wrath',
  'arcane_blast', 'cone_of_cold', 'ice_lance', 'frostbolt', 'ice_barrier',
]);

/** The stock list narrowed as the preset's own is: its race's racials, its selected consumables. */
const narrowed = (list: AplList, race: RaceId, selection: ConsumableSelection): readonly AplEntry[] =>
  withoutUnselectedConsumables(racialsForRace(list, race, MAGE), MAGE, selection).entries;

const isStack = (entry: AplEntry) =>
  entry.abilityId === 'major_spellblasting_potion' && (entry.sequence ?? []).length > 0;

/** `area` placed above the first damaging entry. */
const withArea = (entries: readonly AplEntry[], area: readonly AplEntry[]): AplEntry[] => {
  const at = entries.findIndex(
    (e) => DAMAGE.has(e.abilityId) || (e.sequence ?? []).some((step) => DAMAGE.has(step)),
  );
  if (at < 0) throw new Error('no damaging entry to put the area entries above');
  return [...entries.slice(0, at), ...area, ...entries.slice(at)];
};

const stackOf = (entries: readonly AplEntry[]): AplEntry => {
  const stack = entries.find(isStack);
  if (!stack) throw new Error('no cooldown stack');
  return stack;
};

// --- Fire --------------------------------------------------------------------
const FIRE_ST = narrowed(MAGE_FIRE, 'troll', {
  ...casterConsumables('school_fire'),
  potion_secondary: 'secondary_major_mana_potion',
});
const FIRE_AREA: readonly AplEntry[] = withArea(FIRE_ST, [
  {
    ...stackOf(FIRE_ST),
    condition: atLeast(5),
    note: 'Cooldown stack at 5+ targets: the potion and Combustion at once, for the Flamestrikes.',
  },
  {
    abilityId: 'blast_wave',
    condition: atLeast(3),
    note: 'At 3+ targets (round 80): an instant that strikes every target, on its 45s cooldown.',
  },
  flamestrikeOnDot(3),
  flamestrike(5),
]);

// --- Frostfire ---------------------------------------------------------------
const FROSTFIRE_ST = narrowed(MAGE_FROSTFIRE, 'troll', {
  ...casterConsumables('school_fire'),
  potion: 'major_mana_potion',
  potion_secondary: 'secondary_major_spellblasting_potion',
});
const FROSTFIRE_AREA: readonly AplEntry[] = withArea(FROSTFIRE_ST, [flamestrikeOnDot(3), flamestrike(5)]);

// --- Arcane ------------------------------------------------------------------
const ARCANE_ST = narrowed(MAGE_ARCANE, 'troll', {
  ...casterConsumables('school_arcane'),
  potion: 'major_mana_potion',
  potion_secondary: 'secondary_major_spellblasting_potion',
});
/*
 * The preset drinks the Major Mana Potion, so its cooldown stack is the one
 * WITHOUT the potion -- Arcane Power, Presence of Mind and Arcane Wrath -- and
 * the area copy spends Presence of Mind on Flamestrike instead.
 */
const isArcaneStack = (entry: AplEntry) =>
  entry.abilityId === 'arcane_power' && (entry.sequence ?? []).includes('presence_of_mind');
const ARCANE_STACK = ARCANE_ST.find(isArcaneStack);
if (!ARCANE_STACK) throw new Error('no Arcane Power stack in the Arcane list');
const ARCANE_AREA: readonly AplEntry[] = withArea(
  ARCANE_ST.filter((e) => !isArcaneStack(e)),
  [
    {
      ...ARCANE_STACK,
      sequence: ['presence_of_mind', 'flamestrike'],
      condition: atLeast(3),
      note: 'Cooldown stack at 3+ targets: Arcane Power and Presence of Mind, spent on an instant Flamestrike.',
    },
    flamestrikeOnDot(3),
    arcaneExplosion(3),
  ],
);

// --- Frost -------------------------------------------------------------------
/** The Frost Mage's own consumables, as `presets.ts` selects them. */
const FROST_SELECTION: ConsumableSelection = {
  flask: 'flask_spell_power',
  weapon_effect_main_hand: 'weapon_spell_crit_main_hand',
  blasted_lands: 'blasted_intellect',
  mana_regen: 'mana_regen_12',
  hit_points: 'hit_points_120',
  armor: 'armor_450',
  spell_power: 'spell_power_35',
  food: 'food_spell_power',
  school_spell_power: 'school_frost',
  potion: 'major_mana_potion',
  other: 'demonic_rune',
};
const FROST_ST = narrowed(MAGE_FROST, 'troll', FROST_SELECTION);
/*
 * ROUND 80: CONE OF COLD AT 3 TO 7 TARGETS, ABOVE BLIZZARD, AND BLIZZARD FROM 3.
 * Cone of Cold strikes one target here, and Blizzard's frost ticks stack Winter's
 * Chill on it to five in a few seconds -- so a 40%-a-stack Cone of Cold between
 * Blizzard channels is +115.5 at 5 targets and +192.6 at 3 (Blizzard at 3
 * targets alone is +16.6). At 8 targets it loses (-17.1 noise, -135.6 ungated),
 * so the entry stops at seven. The Winter's Chill gate swept 3, 4 and 5 stacks:
 * identical, because the stacks are always up by the time the cooldown is.
 */
const coneOfColdOnChill: AplEntry = {
  abilityId: 'cone_of_cold',
  condition: all(atLeast(3), targetCount('atMost', 7), targetStacks('atLeast', 5, 'winters_chill')),
  note: "At 3 to 7 targets, on five Winter's Chill stacks: one target struck, 40% a stack harder.",
};
const FROST_AREA: readonly AplEntry[] = withArea(FROST_ST, [flamestrikeOnDot(3), coneOfColdOnChill, blizzard(3)]);

/*
 * ==============================================================================
 * AND THE AREA LIST OPENS WITH A FLAMESTRIKE. Each opener is the Single Target
 * one with its damaging pull -- Fireball, Frostfire Bolt, Arcane Blast,
 * Frostbolt -- replaced by Flamestrike, which is still ONE damaging action
 * finishing at the pull (Gate B). The lead is 2.5s, under the hasted cast time
 * on every build, so the cast lands exactly at t=0 and leans on no haste gap.
 * The Fire opener keeps the owner's Fire Blast at T-0. Paired, 400 fights, at
 * 3/5/8 targets (a lead of 3s when measured):
 *
 *   Fire       +5.7 noise   +54.8   +212.9
 *   Frostfire  +11.7 noise  +22.8   +201.6
 *   Arcane     -6.5 noise   +6.4 noise   +90.3
 *   Frost      -2.2 noise   +54.1   +110.7
 *
 * THE OWNER'S SINGLE TARGET OPENERS ARE UNTOUCHED; this is the Multi Target
 * section's own copy.
 * ==============================================================================
 */
const pull = { abilityId: 'flamestrike', secondsBefore: 2.5 } as const;

export const MAGE_MULTI_TARGET: MultiTargetDefaults = {
  mage_fire: {
    name: 'Mage (Fire) -- AoE',
    entries: FIRE_AREA,
    precombat: [{ abilityId: 'mage_armor', secondsBefore: 4.5 }, pull, { abilityId: 'fire_blast', secondsBefore: 0 }],
  },
  mage_frostfire: {
    name: 'Mage (Frostfire) -- AoE',
    entries: FROSTFIRE_AREA,
    // No Ice Barrier since 1.60.1.70707: a talent this build does not take.
    precombat: [{ abilityId: 'mage_armor', secondsBefore: 4 }, pull],
  },
  mage_arcane: {
    name: 'Mage (Arcane) -- AoE',
    entries: ARCANE_AREA,
    precombat: [{ abilityId: 'mage_armor', secondsBefore: 3 }, pull],
  },
  mage_frost: {
    name: 'Mage (Frost) -- AoE',
    entries: FROST_AREA,
    precombat: [
      { abilityId: 'mage_armor', secondsBefore: 60 },
      { abilityId: 'ice_barrier', secondsBefore: 3.5 },
      pull,
    ],
  },
};
