import type { SimulationResult } from '../../analysis';
import type { TelemetryEvent } from '../../engine';
import type { TimelinePoint } from './ResourceTimeline';

/**
 * ============================================================================
 * ONE FIGHT, DRAWN AGAINST THE CLOCK.
 *
 * The combat log is every event in order as TEXT, which answers "what
 * happened" and cannot answer the questions a rotation is actually tuned
 * against: did this buff fall off before it was refreshed, did that cooldown
 * ever line up with the other one, is the pool flat at zero for the half of
 * the fight when the expensive ability was available. All three are questions
 * about WHEN things sat relative to each other, and a column of lines cannot
 * show relative position at all -- the reader has to hold two timestamps in
 * their head and subtract.
 *
 * IT READS ONE ITERATION AND SAYS SO, which is `ResourceTimeline`'s rule and
 * holds here for the same reason: averaging "was Flurry up at t=12s" across
 * iterations of different lengths that cast different abilities draws a fight
 * nobody ran. So this is the REPRESENTATIVE iteration -- the same one the
 * combat log shows -- and the panel's subtitle says which.
 *
 * THE BUILDER IS SEPARATE FROM THE COMPONENT, which is `aplEditing.ts`'s rule:
 * turning a stream of edges into windows is the part that can be wrong, and a
 * render test cannot see an aura window that closes at the wrong edge.
 * ============================================================================
 */

/** One cast, or one swing that landed. */
export interface TimelineMark {
  readonly timeMs: number;
  readonly critical: boolean;
}

export interface CastLane {
  readonly id: string;
  readonly label: string;
  readonly marks: readonly TimelineMark[];
}

/** One stretch of time an aura was present, and how many stacks it held. */
export interface AuraWindow {
  readonly startMs: number;
  readonly endMs: number;
  readonly stacks: number;
}

export interface AuraLane {
  readonly id: string;
  readonly label: string;
  readonly isDebuff: boolean;
  readonly windows: readonly AuraWindow[];
}

export interface ResourceLane {
  readonly id: string;
  readonly label: string;
  readonly points: readonly TimelinePoint[];
  readonly maximum: number;
  readonly peak: number;
}

export interface FightTimeline {
  readonly durationMs: number;
  readonly casts: readonly CastLane[];
  readonly auras: readonly AuraLane[];
  readonly resources: readonly ResourceLane[];
}

/** Display names, the same ones the Results panel's resource sections use. */
const RESOURCE_NAMES: Readonly<Record<string, string>> = {
  rage: 'Rage',
  energy: 'Energy',
  mana: 'Mana',
  comboPoints: 'Combo points',
  focus: 'Focus',
  soulShards: 'Soul shards',
};

/**
 * Turn one fight's telemetry into lanes.
 *
 * ----------------------------------------------------------------------------
 * EVERY LANE IS KEYED BY NAME AND EVERY ACTOR IS FRIENDLY, which is the
 * damage breakdown's own arrangement -- one table rather than two -- and it is
 * safe here for the reason that one is not: `autoAttackName` already names a
 * pet's swing after the pet, so a Hunter and its pet do not share a row.
 *
 * A HOSTILE ACTOR'S CASTS AND SWINGS ARE EXCLUDED. The boss's attacks are the
 * encounter rather than the build; what IS wanted is what the player did to
 * it, which arrives because the cast filter is on the SOURCE.
 *
 * AND THE AURA FILTER IS DELIBERATELY WIDER THAN THAT. Anything sitting on a
 * HOSTILE actor counts too, however it got there -- because the preset raid
 * DEBUFFS are applied at the pull with the target as their own source, and
 * leaving them out would hide the very thing a reader is looking for. The Arms
 * list's Sunder Armor entry fires zero times, and the reason is a five-stack
 * Sunder Armor that was on the boss before the fight started.
 * ----------------------------------------------------------------------------
 */
export function buildFightTimeline(
  result: SimulationResult,
  options: { readonly includeSwings: boolean },
): FightTimeline {
  const friendly = new Set(
    result.actors.filter((actor) => actor.faction === 'friendly').map((actor) => actor.id),
  );
  const hostile = new Set(
    result.actors.filter((actor) => actor.faction === 'hostile').map((actor) => actor.id),
  );
  const player = result.actors.find((actor) => actor.kind === 'player');
  const durationMs = result.durationMs;

  return {
    durationMs,
    casts: castLanes(result.timeline, friendly, options.includeSwings),
    auras: auraLanes(result.timeline, friendly, hostile, durationMs),
    resources: resourceLanes(result.timeline, player?.id),
  };
}

/**
 * A row per ability cast, and optionally a row per weapon that swung.
 *
 * ----------------------------------------------------------------------------
 * A SWING IS NOT A CAST AND HAS NO CAST EVENT, so the two halves are built from
 * different streams: `cast` for anything the rotation decided to do, and
 * `damage` with NO `abilityId` for an auto attack, which is what the engine
 * emits for one.
 *
 * AND THAT IS WHY THEY ARE SEPARATELY SWITCHABLE. A geared dual-wielder lands
 * about seventy swings a fight against a dozen casts, so leaving them on makes
 * two rows that are solid blocks of ink and pushes every row that carries a
 * decision off the top of the panel. Off by default; the control says so.
 * ----------------------------------------------------------------------------
 */
function castLanes(
  timeline: readonly TelemetryEvent[],
  friendly: ReadonlySet<string>,
  includeSwings: boolean,
): readonly CastLane[] {
  const lanes = new Map<string, TimelineMark[]>();
  const push = (label: string, mark: TimelineMark) => {
    const marks = lanes.get(label);
    if (marks) marks.push(mark);
    else lanes.set(label, [mark]);
  };

  for (const event of timeline) {
    if (event.type === 'cast') {
      if (!friendly.has(event.sourceId)) continue;
      push(event.abilityName, { timeMs: event.timestamp, critical: false });
      continue;
    }
    if (!includeSwings || event.type !== 'damage') continue;
    if (event.abilityId !== undefined || !friendly.has(event.sourceId)) continue;
    push(event.abilityName, { timeMs: event.timestamp, critical: event.critical });
  }

  return [...lanes.entries()].map(([label, marks]) => ({ id: label, label, marks }));
}

/**
 * A row per aura, as the stretches of time it was actually present.
 *
 * ============================================================================
 * THE EDGES ARE THE PART THAT CAN BE WRONG, and there are three of them.
 *
 * A REFRESH DOES NOT CLOSE A WINDOW. `aura_refreshed` means the same aura is
 * still up with its clock reset -- drawing a boundary there would turn one
 * 30-second Sunder Armor into six bars with five gaps that never existed.
 *
 * A STACK CHANGE DOES NOT EITHER, and it is what the stack count is read from.
 *
 * AN AURA STILL UP AT THE END NEVER EMITS A REMOVAL, so an open window is
 * closed at the fight's own duration. This is `BatchTotals`' rule for uptime,
 * and getting it wrong here draws every maintained buff as ending at whatever
 * moment it was last refreshed -- which reads as a rotation that stopped.
 * ============================================================================
 */
function auraLanes(
  timeline: readonly TelemetryEvent[],
  friendly: ReadonlySet<string>,
  hostile: ReadonlySet<string>,
  durationMs: number,
): readonly AuraLane[] {
  interface Open {
    readonly startMs: number;
    stacks: number;
  }
  const lanes = new Map<
    string,
    { label: string; isDebuff: boolean; windows: AuraWindow[]; open: Open | undefined }
  >();

  const laneFor = (auraId: string, label: string, isDebuff: boolean) => {
    const found = lanes.get(auraId);
    if (found) return found;
    const made = { label, isDebuff, windows: [] as AuraWindow[], open: undefined as Open | undefined };
    lanes.set(auraId, made);
    return made;
  };

  for (const event of timeline) {
    if (
      event.type !== 'aura_applied' &&
      event.type !== 'aura_refreshed' &&
      event.type !== 'aura_stacks_changed' &&
      event.type !== 'aura_removed'
    ) {
      continue;
    }
    /*
     * WHAT THE PLAYER APPLIED, OR ANYTHING ON THE ENEMY. The second half is
     * what catches a preset raid debuff: those are applied at the pull with
     * the TARGET as their own source, so a source-only filter drops them --
     * and a five-stack Sunder Armor already on the boss is exactly why the
     * Arms list's own Sunder entry never fires.
     */
    if (!friendly.has(event.sourceId) && !hostile.has(event.targetId)) continue;
    const lane = laneFor(event.auraId, event.auraName, event.isDebuff);

    if (event.type === 'aura_removed') {
      if (lane.open) {
        lane.windows.push({
          startMs: lane.open.startMs,
          endMs: event.timestamp,
          stacks: lane.open.stacks,
        });
        lane.open = undefined;
      }
      continue;
    }
    if (!lane.open) {
      lane.open = { startMs: event.timestamp, stacks: event.stacks };
      continue;
    }
    // Still up. The highest stack count the window reached is what it is
    // labelled with -- a window that peaked at five and ended at one is a
    // five-stack window, which is what the rotation was being paid for.
    lane.open.stacks = Math.max(lane.open.stacks, event.stacks);
  }

  const out: AuraLane[] = [];
  for (const [auraId, lane] of lanes) {
    const windows = [...lane.windows];
    if (lane.open) {
      windows.push({ startMs: lane.open.startMs, endMs: durationMs, stacks: lane.open.stacks });
    }
    if (windows.length > 0) {
      out.push({ id: auraId, label: lane.label, isDebuff: lane.isDebuff, windows });
    }
  }
  return out;
}

/**
 * A row per pool the player used.
 *
 * EVERY RESOURCE EVENT CARRIES `current`, so this reads the level that actually
 * happened rather than adding gains and subtracting costs -- `resourceTimeline`
 * makes the same argument, and re-deriving would hide exactly the bug where
 * something moves a pool without emitting an event.
 *
 * THE CEILING IS THE PEAK THE FIGHT REACHED, not a table of maximums: a talent
 * can raise rage or energy and a character's mana is its own. It is what makes
 * "flat at the top" mean capping rather than meaning nothing.
 */
function resourceLanes(
  timeline: readonly TelemetryEvent[],
  actorId: string | undefined,
): readonly ResourceLane[] {
  if (!actorId) return [];
  const lanes = new Map<string, TimelinePoint[]>();
  for (const event of timeline) {
    if (event.type !== 'resource_gained' && event.type !== 'resource_spent') continue;
    if (event.actorId !== actorId) continue;
    const points = lanes.get(event.resource);
    const point = { timeMs: event.timestamp, value: event.current };
    if (points) points.push(point);
    else lanes.set(event.resource, [point]);
  }

  return [...lanes.entries()].map(([resource, points]) => {
    const peak = points.reduce((highest, point) => Math.max(highest, point.value), 0);
    return {
      id: resource,
      label: RESOURCE_NAMES[resource] ?? resource,
      points,
      maximum: peak,
      peak,
    };
  });
}

/** `0:05`, which is how a fight is read. `Pull` for the zero. */
export function formatFightTime(ms: number): string {
  if (ms <= 0) return 'Pull';
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Where the axis labels go: a round number of seconds, about ten of them.
 *
 * CHOSEN FROM A LADDER rather than computed, because the only readable tick
 * spacings are the ones a clock has. 7 seconds divides a 70-second fight into
 * exactly ten and is unreadable; 10 does not divide it and is fine.
 */
export function axisTicks(durationMs: number): readonly number[] {
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300];
  const wanted = durationMs / 1000 / 10;
  const step = steps.find((candidate) => candidate >= wanted) ?? steps[steps.length - 1];
  const ticks: number[] = [];
  for (let second = 0; second * 1000 <= durationMs; second += step) ticks.push(second * 1000);
  return ticks;
}
