import type { Ability, AutoAttackMode } from '../../engine';
import { slotsForMode, startAutoAttackMode } from '../../engine';
import type { CombatStyleId } from '../character';
import { autoAttackModeForStyle } from '../actors/weapons';

/**
 * START AUTO-ATTACK (round 65), the owner's action for every character, in
 * three kinds: Main Hand, Dual Wield and Ranged.
 *
 * ============================================================================
 * NOTHING A PLAYER WIELDS SWINGS UNTIL ONE OF THESE RUNS. It goes in the
 * pre-combat list -- so the weapons are ready to swing at T-0, which is when
 * every character swung before this existed -- or in the combat list, which
 * is how a caster weaves melee between spells and a Hunter weaves melee
 * between shots.
 *
 * A KIND ALREADY RUNNING IS REFUSED, so a list asking on every decision never
 * restarts a swing timer and starves the swing it was waiting for -- and the
 * refusal is also what bounds a free cast chain to one start per instant. ONE
 * KIND AT A TIME: starting melee stops ranged, and the reverse.
 *
 * OFF THE GLOBAL COOLDOWN AND NOT BLOCKED BY ONE, the owner's: "Swing timers
 * and start auto-attack initiates have no global cooldown nor are they
 * impacted if you're on a global cooldown." It reaches no cast reaction and
 * breaks no stealth -- the swing it starts does both, as any swing does.
 * ============================================================================
 */

export type StartAutoAttackMode = Exclude<AutoAttackMode, 'none'>;

export const START_AUTO_ATTACK_IDS: Readonly<Record<StartAutoAttackMode, string>> = {
  'main-hand': 'start_auto_attack_main_hand',
  'dual-wield': 'start_auto_attack_dual_wield',
  ranged: 'start_auto_attack_ranged',
};

/** The kinds as a person reads them, for the panel. */
export const START_AUTO_ATTACK_LABELS: Readonly<Record<StartAutoAttackMode, string>> = {
  'main-hand': 'Main Hand Melee Weapon',
  'dual-wield': 'Dual Wield',
  ranged: 'Ranged',
};

function startAutoAttack(mode: StartAutoAttackMode): Ability {
  return {
    id: START_AUTO_ATTACK_IDS[mode],
    name: `Start Auto-attack (${START_AUTO_ATTACK_LABELS[mode]})`,
    triggersGcd: false,
    ignoresGcd: true,
    requiresTarget: false,
    firesCastReactions: false,
    breaksActionAuras: false,
    canCast: ({ caster }) =>
      caster.activeAutoAttack !== mode &&
      slotsForMode(mode).every((slot) => caster.weapons[slot] !== undefined),
    onCast: ({ simulation, caster }) => {
      startAutoAttackMode(simulation, caster, mode);
    },
  };
}

export const START_AUTO_ATTACK_ABILITIES: readonly Ability[] = (
  ['main-hand', 'dual-wield', 'ranged'] as const
).map(startAutoAttack);

/** Whether an ability id is one of the three. */
export function isStartAutoAttack(abilityId: string): boolean {
  return Object.values(START_AUTO_ATTACK_IDS).includes(abilityId);
}

/** Which kind an id starts, if it is one. */
export function startAutoAttackModeOf(abilityId: string): StartAutoAttackMode | undefined {
  const entry = Object.entries(START_AUTO_ATTACK_IDS).find(([, id]) => id === abilityId);
  return entry?.[0] as StartAutoAttackMode | undefined;
}

/**
 * The kind a build would pick, pre-populated for the user: its style's own
 * mode, or the main hand for a style that swings nothing -- a caster.
 */
export function defaultStartAutoAttackMode(style: CombatStyleId): StartAutoAttackMode {
  const mode = autoAttackModeForStyle(style);
  return mode === 'none' ? 'main-hand' : mode;
}
