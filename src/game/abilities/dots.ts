/**
 * THE ABILITIES THAT APPLY A DAMAGE-OVER-TIME EFFECT (round 67), by class.
 *
 * ============================================================================
 * The APL panel offers Multi-DoT only on these: "if an ability doesn't have a
 * DoT effect then it should not have the multi-dot GUI element", the owner's.
 *
 * WRITTEN OUT, AND CHECKED BY CASTING. Whether an ability applies a DoT is
 * decided inside its `onCast`, so no declaration can answer it -- the argument
 * `isBleed` makes about reading a definition. `tests/game/dotAbilities.test.ts`
 * casts every ability in every class's catalogue and fails naming any ability
 * whose ticks disagree with this list, so a new DoT cannot be forgotten here.
 *
 * A DoT HERE IS AN AURA ON THE TARGET THAT DEALS THE ABILITY'S OWN PERIODIC
 * DAMAGE. That includes a direct spell with a burn (Fireball, Pyroblast,
 * Frostfire Bolt), Bane of Doom's single blow a minute later, a ground effect
 * (Consecration, Flamestrike), the totems and traps that tick, and Summon
 * Hawk, which is modelled as a debuff that ticks. It excludes a proc another
 * effect owns -- Deep Wounds, Ignite, a poison -- and a channel, whose ticks
 * are not periodic.
 * ============================================================================
 */
export const DOT_ABILITY_IDS: readonly string[] = [
  // Warrior
  'rend_cast',
  // Rogue
  'rupture',
  'garrote',
  // Druid
  'moonfire',
  'insect_swarm',
  'rake',
  'rip',
  'lacerate',
  // Shaman
  'flame_shock',
  'searing_totem',
  'magma_totem',
  // Mage
  'fireball',
  'pyroblast',
  'frostfire_bolt',
  'flamestrike',
  // Paladin
  'consecration',
  // Hunter
  'serpent_sting',
  'summon_hawk',
  'immolation_trap',
  'explosive_trap',
  // Warlock
  'corruption',
  'bane_of_agony',
  'bane_of_doom',
  'siphon_life',
  'immolate',
  // Priest
  'shadow_word_pain',
  'devouring_plague',
];

const DOTS = new Set(DOT_ABILITY_IDS);

/** Whether an ability applies a damage-over-time effect of its own. */
export function appliesDot(abilityId: string): boolean {
  return DOTS.has(abilityId);
}
