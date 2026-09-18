import type { AuraDefinition } from '../../engine';
import { dealDamage, flat, seconds } from '../../engine';

/**
 * Warrior auras, from WoWForeverWarriorAbilities.xlsx.
 *
 * Read `docs/warrior-abilities.md` before changing anything here: it holds the
 * spreadsheet transcribed verbatim, and the list of what the spreadsheet does
 * not say.
 *
 * ----------------------------------------------------------------------------
 * MOST OF THIS FILE IS PLACEHOLDER DATA.
 *
 * The spreadsheet gives a cost, a cooldown and an attack table for every buff
 * and debuff, and NOTHING ELSE. No magnitudes, no durations, no stack counts.
 * Nine of its twenty-six rows are like this.
 *
 * So every `PLACEHOLDER_*` constant below is INVENTED. They exist so the
 * abilities can be defined, cast and seen in a combat log rather than silently
 * missing, and so that the rotation has something to call. They must not be
 * read as Forever values, and no conclusion about a warrior's damage should be
 * drawn while any of them are still in use.
 *
 * Each is a single named constant so that replacing it with a real number is a
 * one-line change with no arithmetic.
 * ----------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// Rend — the one damage-over-time effect the sheet DOES specify in full.
// ---------------------------------------------------------------------------

/**
 * "147 damage/21 sec, ticks every 3 seconds", with a stated 0% coefficient per
 * tick.
 *
 * 21 seconds at one tick every 3 gives 7 ticks, and 147 / 7 is exactly 21 per
 * tick. The numbers divide evenly, which is the reading reproducing the stated
 * total; a partial final tick would not.
 *
 * These are REAL values, not placeholders.
 */
export const REND_TOTAL_DAMAGE = 147;
export const REND_DURATION_MS = seconds(21);
export const REND_TICK_INTERVAL_MS = seconds(3);
export const REND_TICK_COUNT = REND_DURATION_MS / REND_TICK_INTERVAL_MS;
export const REND_DAMAGE_PER_TICK = REND_TOTAL_DAMAGE / REND_TICK_COUNT;

export const REND: AuraDefinition = {
  id: 'rend',
  name: 'Rend',
  durationMs: REND_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: REND_TICK_INTERVAL_MS,
    onTick: (context, aura) => {
      const source = context.combatant(aura.sourceId);
      const target = context.combatant(aura.targetId);
      if (!source || !target || !target.isAlive) return;

      dealDamage(context, {
        source,
        target,
        abilityId: aura.id,
        abilityName: aura.name,
        school: 'physical',
        baseAmount: REND_DAMAGE_PER_TICK,
        // The sheet states "0% per tick": Rend does not scale with attack
        // power at all.
        powerCoefficient: 0,
        // No attack table. Whether Rend landed was decided when it was
        // applied, so its ticks do not roll the table again.
        periodic: true,
        // RULESET: every damage-over-time effect in Forever can crit, at the
        // crit chance of the kind of event that applied it. Rend is applied by
        // a melee special, so its ticks crit at melee crit chance.
        critFrom: 'melee-special',
        // A bleed is physical but ignores armor. True of every DoT here, not
        // just this one.
        appliesArmor: false,
      });
    },
  },
};

// ---------------------------------------------------------------------------
// Sunder Armor — PLACEHOLDER
// ---------------------------------------------------------------------------

/**
 * PLACEHOLDER. The sheet gives Sunder Armor a 15 rage cost and no cooldown, and
 * states neither how much armor a stack removes, how many stacks it reaches,
 * nor how long it lasts.
 *
 * Armor reduction feeds straight into every physical damage event, so a wrong
 * value here moves every number in the simulation.
 */
export const PLACEHOLDER_SUNDER_ARMOR_PER_STACK = 0;
export const PLACEHOLDER_SUNDER_ARMOR_MAX_STACKS = 5;
export const PLACEHOLDER_SUNDER_ARMOR_DURATION_MS = seconds(30);

export const SUNDER_ARMOR: AuraDefinition = {
  id: 'sunder_armor',
  name: 'Sunder Armor',
  durationMs: PLACEHOLDER_SUNDER_ARMOR_DURATION_MS,
  maxStacks: PLACEHOLDER_SUNDER_ARMOR_MAX_STACKS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  modifiersScaleWithStacks: true,
  // Zero until the real figure arrives: an invented armor reduction would
  // quietly inflate every physical hit in the fight. A visibly inert debuff is
  // the honest failure mode.
  statModifiers: [flat('armor', -PLACEHOLDER_SUNDER_ARMOR_PER_STACK)],
};

// ---------------------------------------------------------------------------
// Shouts — PLACEHOLDER
// ---------------------------------------------------------------------------

/**
 * PLACEHOLDER. Battle Shout costs 10 rage with no cooldown; the sheet gives no
 * attack power figure, no duration and no radius.
 */
export const PLACEHOLDER_BATTLE_SHOUT_ATTACK_POWER = 0;
export const PLACEHOLDER_BATTLE_SHOUT_DURATION_MS = seconds(120);

export const BATTLE_SHOUT: AuraDefinition = {
  id: 'battle_shout',
  name: 'Battle Shout',
  durationMs: PLACEHOLDER_BATTLE_SHOUT_DURATION_MS,
  statModifiers: [flat('attackPower', PLACEHOLDER_BATTLE_SHOUT_ATTACK_POWER)],
};

/**
 * PLACEHOLDER. Demoralizing Shout costs 10 rage with no cooldown; the sheet
 * gives no attack power reduction and no duration.
 */
export const PLACEHOLDER_DEMORALIZING_SHOUT_ATTACK_POWER = 0;
export const PLACEHOLDER_DEMORALIZING_SHOUT_DURATION_MS = seconds(30);

export const DEMORALIZING_SHOUT: AuraDefinition = {
  id: 'demoralizing_shout',
  name: 'Demoralizing Shout',
  durationMs: PLACEHOLDER_DEMORALIZING_SHOUT_DURATION_MS,
  isDebuff: true,
  statModifiers: [flat('attackPower', -PLACEHOLDER_DEMORALIZING_SHOUT_ATTACK_POWER)],
};

// ---------------------------------------------------------------------------
// Cooldowns — PLACEHOLDER
// ---------------------------------------------------------------------------

/**
 * PLACEHOLDER. Recklessness has a 30 minute cooldown and costs nothing. The
 * sheet says nothing about what it does or how long it lasts.
 *
 * A 30 minute cooldown will never come up twice in a raid-length fight, so the
 * duration matters far more than the cooldown does.
 */
export const PLACEHOLDER_RECKLESSNESS_CRIT_BONUS = 0;
export const PLACEHOLDER_RECKLESSNESS_DURATION_MS = seconds(15);

export const RECKLESSNESS: AuraDefinition = {
  id: 'recklessness',
  name: 'Recklessness',
  durationMs: PLACEHOLDER_RECKLESSNESS_DURATION_MS,
  statModifiers: [flat('critChance', PLACEHOLDER_RECKLESSNESS_CRIT_BONUS)],
};

/**
 * PLACEHOLDER. Berserker Rage has a 30 second cooldown and costs nothing. The
 * sheet states no effect and no duration.
 */
export const PLACEHOLDER_BERSERKER_RAGE_DURATION_MS = seconds(10);

export const BERSERKER_RAGE: AuraDefinition = {
  id: 'berserker_rage',
  name: 'Berserker Rage',
  durationMs: PLACEHOLDER_BERSERKER_RAGE_DURATION_MS,
  // No modifiers at all: nothing is stated, so nothing is claimed.
};

/**
 * PLACEHOLDER. Bloodrage has a 60 second cooldown and costs nothing. In every
 * ruleset it grants rage, which is exactly the sort of number that changes a
 * rotation's shape — and the sheet does not give it.
 */
export const PLACEHOLDER_BLOODRAGE_INSTANT_RAGE = 0;
export const PLACEHOLDER_BLOODRAGE_DURATION_MS = seconds(10);

export const BLOODRAGE: AuraDefinition = {
  id: 'bloodrage',
  name: 'Bloodrage',
  durationMs: PLACEHOLDER_BLOODRAGE_DURATION_MS,
};

// ---------------------------------------------------------------------------
// Defensive — PLACEHOLDER
// ---------------------------------------------------------------------------

/**
 * PLACEHOLDER. Shield Wall has a 30 minute cooldown and costs nothing; Shield
 * Block costs 10 rage on a 5 second cooldown. Neither has a stated effect or
 * duration.
 *
 * Both are damage-taken effects, and nothing attacks the player yet, so they
 * are inert for a second reason as well.
 */
export const PLACEHOLDER_SHIELD_WALL_DAMAGE_TAKEN_MULTIPLIER = 1;
export const PLACEHOLDER_SHIELD_WALL_DURATION_MS = seconds(10);

export const SHIELD_WALL: AuraDefinition = {
  id: 'shield_wall',
  name: 'Shield Wall',
  durationMs: PLACEHOLDER_SHIELD_WALL_DURATION_MS,
  damageTakenMultiplier: PLACEHOLDER_SHIELD_WALL_DAMAGE_TAKEN_MULTIPLIER,
};

export const PLACEHOLDER_SHIELD_BLOCK_DURATION_MS = seconds(5);

export const SHIELD_BLOCK: AuraDefinition = {
  id: 'shield_block',
  name: 'Shield Block',
  durationMs: PLACEHOLDER_SHIELD_BLOCK_DURATION_MS,
};

// ---------------------------------------------------------------------------
// Stances — PLACEHOLDER
// ---------------------------------------------------------------------------

/**
 * PLACEHOLDER EFFECTS.
 *
 * The sheet has rows for Berserker Stance and Defensive Stance, both costing
 * nothing on a 1 second cooldown, and NO ROW FOR BATTLE STANCE at all. It says
 * nothing about what any stance does, and nothing about which abilities each
 * one gates.
 *
 * Battle Stance is defined here anyway, because two stances with no third and
 * no way back to it is not a coherent ruleset. That it exists is an assumption.
 *
 * The gating — which abilities require which stance — is deliberately NOT
 * expressed yet, and is an open question with the ruleset owner.
 */
export const PLACEHOLDER_DEFENSIVE_STANCE_DAMAGE_DONE = 1;
export const PLACEHOLDER_DEFENSIVE_STANCE_DAMAGE_TAKEN = 1;
export const PLACEHOLDER_BERSERKER_STANCE_DAMAGE_TAKEN = 1;
export const PLACEHOLDER_BERSERKER_STANCE_CRIT_BONUS = 0;

/** A stance lasts until another replaces it. */
const STANCE_DURATION_MS = 0;

export const BATTLE_STANCE: AuraDefinition = {
  id: 'battle_stance',
  name: 'Battle Stance',
  durationMs: STANCE_DURATION_MS,
};

export const DEFENSIVE_STANCE: AuraDefinition = {
  id: 'defensive_stance',
  name: 'Defensive Stance',
  durationMs: STANCE_DURATION_MS,
  damageDoneMultiplier: PLACEHOLDER_DEFENSIVE_STANCE_DAMAGE_DONE,
  damageTakenMultiplier: PLACEHOLDER_DEFENSIVE_STANCE_DAMAGE_TAKEN,
};

export const BERSERKER_STANCE: AuraDefinition = {
  id: 'berserker_stance',
  name: 'Berserker Stance',
  durationMs: STANCE_DURATION_MS,
  damageTakenMultiplier: PLACEHOLDER_BERSERKER_STANCE_DAMAGE_TAKEN,
  statModifiers: [flat('critChance', PLACEHOLDER_BERSERKER_STANCE_CRIT_BONUS)],
};

/** Every stance, so that applying one can clear the others. */
export const WARRIOR_STANCES: readonly AuraDefinition[] = [
  BATTLE_STANCE,
  DEFENSIVE_STANCE,
  BERSERKER_STANCE,
];

// ---------------------------------------------------------------------------
// Reactive windows
// ---------------------------------------------------------------------------

/**
 * Marks that the target dodged, which is what Overpower keys off.
 *
 * CONFIRMED by the ruleset owner as Classic behaviour; the spreadsheet itself
 * states no trigger, only a 5 second cooldown.
 *
 * Modelled as an aura on the warrior rather than as a telemetry query because
 * an aura already has a duration, a refresh rule and a visible lifetime in the
 * combat log. The window length is NOT stated anywhere and is a placeholder.
 */
export const PLACEHOLDER_OVERPOWER_WINDOW_MS = seconds(5);

export const OVERPOWER_READY: AuraDefinition = {
  id: 'overpower_ready',
  name: 'Overpower Ready',
  durationMs: PLACEHOLDER_OVERPOWER_WINDOW_MS,
  refreshBehaviour: 'reset',
};

/**
 * Marks that the warrior blocked, parried or dodged, which is what Revenge
 * keys off. Same provenance and the same placeholder window as above.
 *
 * Nothing attacks the player yet, so this never fires today.
 */
export const PLACEHOLDER_REVENGE_WINDOW_MS = seconds(5);

export const REVENGE_READY: AuraDefinition = {
  id: 'revenge_ready',
  name: 'Revenge Ready',
  durationMs: PLACEHOLDER_REVENGE_WINDOW_MS,
  refreshBehaviour: 'reset',
};

/** Unused today; kept so the import surface matches the other modules. */
export const WARRIOR_AURAS: readonly AuraDefinition[] = [
  REND,
  SUNDER_ARMOR,
  BATTLE_SHOUT,
  DEMORALIZING_SHOUT,
  RECKLESSNESS,
  BERSERKER_RAGE,
  BLOODRAGE,
  SHIELD_WALL,
  SHIELD_BLOCK,
  BATTLE_STANCE,
  DEFENSIVE_STANCE,
  BERSERKER_STANCE,
  OVERPOWER_READY,
  REVENGE_READY,
];
