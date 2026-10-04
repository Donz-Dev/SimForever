/*
 * Which hand actually procs Deadly Aspects, and at what rate?
 *
 * "While Aspect of the Beast is active, ALL MELEE AUTO ATTACKS have a {0}%
 * chance of increasing melee attack speed by 30% for 12 sec." At 5/5 that is
 * 10%.
 *
 * ----------------------------------------------------------------------------
 * TWO THINGS TO GET RIGHT, AND THE FIRST MADE THE RATE LOOK BROKEN.
 *
 * AN AVOIDED SWING STILL EMITS A DAMAGE EVENT, with `amount: 0` -- so counting
 * damage events as "swings" folds every miss, dodge and parry into the
 * denominator. A reaction only rolls on the outcomes it lists, so the rate has
 * to be taken over LANDED swings or a dual-wielder (who misses a great deal)
 * reads as under-proccing.
 *
 * AND THE TELEMETRY CARRIES NO WEAPON SLOT, so the hand is read off
 * `abilityName`, which is what `AUTO_ATTACK_NAMES` sets and what the damage
 * breakdown keys on.
 * ----------------------------------------------------------------------------
 */
import { Simulation } from '../src/engine';
import type { TelemetryEvent } from '../src/engine';
import { PRESETS_BY_ID } from '../src/profiles/presets';
import { trainingDummyEncounter } from '../src/simulator/trainingDummyEncounter';

const SEEDS = Number(process.env.SEEDS ?? 40);
/** Any swing-triggered aura, so this is not a single-talent script. */
const AURA = process.env.AURA ?? 'deadly_aspects';
/** Any preset that swings. */
const PRESET = process.env.PROFILE ?? 'lw_melee';

const BY_NAME: Record<string, string> = {
  'Main Hand Auto-Attack': 'mainHand',
  'Off Hand Auto-Attack': 'offHand',
  'Ranged Auto-Attack': 'ranged',
};

/** Outcomes that land. A reaction that lists none of the others cannot roll. */
const LANDED = new Set(['hit', 'crit', 'glance', 'crush']);

const landed: Record<string, number> = { mainHand: 0, offHand: 0, ranged: 0 };
const avoided: Record<string, number> = { mainHand: 0, offHand: 0, ranged: 0 };
const procs: Record<string, number> = { mainHand: 0, offHand: 0, ranged: 0, unknown: 0 };

const profile = PRESETS_BY_ID.get(PRESET)!.build();

for (let seed = 1; seed <= SEEDS; seed += 1) {
  const events: TelemetryEvent[] = [];
  const simulation = new Simulation(
    { ...trainingDummyEncounter(profile), seed },
    { emit: (event: TelemetryEvent) => events.push(event) } as never,
  );
  const run = simulation.run();
  const player = run.actors.find((actor) => actor.faction === 'friendly')!;

  let lastLandedSwing: string | undefined;

  for (const event of events) {
    if (event.type === 'damage' && event.sourceId === player.id) {
      const slot = BY_NAME[event.abilityName];
      if (slot) {
        if (LANDED.has(event.outcome)) {
          landed[slot] += 1;
          lastLandedSwing = slot;
        } else {
          avoided[slot] += 1;
          // An avoided swing never rolls, so it must not be credited with a
          // proc that some later event caused.
          lastLandedSwing = undefined;
        }
      } else if (!event.periodic) {
        // An ABILITY. Deadly Aspects must not fire from one.
        lastLandedSwing = undefined;
      }
    }

    const auraId = (event as { auraId?: string }).auraId;
    if (
      (event.type === 'aura_applied' || event.type === 'aura_refreshed') &&
      auraId === AURA &&
      event.targetId === player.id
    ) {
      procs[lastLandedSwing ?? 'unknown'] += 1;
    }
  }
}

const rate = (slot: string) =>
  landed[slot] ? `${((procs[slot] / landed[slot]) * 100).toFixed(1)}%` : '--';

console.log(`${PRESET}, ${SEEDS} fights, which hand procs \`${AURA}\`\n`);
console.log('  hand        landed   avoided   procs   rate');
for (const slot of ['mainHand', 'offHand', 'ranged']) {
  console.log(
    '  %s %s %s %s %s',
    slot.padEnd(10),
    String(landed[slot]).padStart(6),
    String(avoided[slot]).padStart(9),
    String(procs[slot]).padStart(7),
    rate(slot).padStart(6),
  );
}
console.log('\n  unattributed procs: %d', procs.unknown);
console.log(
  '\n  %s',
  procs.offHand > 0
    ? 'OFF-HAND SWINGS PROC IT.'
    : 'OFF-HAND SWINGS DO NOT PROC IT.',
);
