import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { SimulationResult } from '../../analysis';
import type {
  AuraLane,
  CastLane,
  FightTimeline,
  ResourceLane,
} from '../charts/EventTimeline';
import { axisTicks, buildFightTimeline, formatFightTime } from '../charts/EventTimeline';
import { Panel } from '../components/Panel';

interface TimelinePanelProps {
  readonly result: SimulationResult;
  /** Aura ids that get no lane: the raid buff selection's forced ones. */
  readonly hiddenAuraIds?: readonly string[];
}

/** How much of the fight is on screen. "First 30s" is where a pull is read. */
type Zoom = 'whole' | 'opening';

const OPENING_MS = 30_000;

/**
 * ONE FIGHT, DRAWN AGAINST THE CLOCK: casts, buffs and debuffs, and the pools.
 *
 * ============================================================================
 * THE COMBAT LOG COULD NOT ANSWER A ROTATION QUESTION. It is every event in
 * order as text, which is the right shape for "what exactly happened at 14.2
 * seconds" and the wrong shape for every question a priority list is actually
 * tuned against -- all of which are about where two things sat RELATIVE to each
 * other. Did the buff fall off before it was refreshed. Did the pool sit at
 * zero through the window the expensive ability was up. Is this cooldown ever
 * lined up with that one. Reading those out of a column of lines means holding
 * two timestamps in your head and subtracting.
 *
 * IT IS ONE ITERATION AND THE SUBTITLE SAYS SO -- the representative one, the
 * same fight the combat log shows. See `buildFightTimeline` for why a timeline
 * is the one thing on this page that must not be pooled across a batch.
 *
 * BELOW THE RESULTS AND ABOVE THE LOG, which is the order the three are read
 * in: what the fight produced, how it was shaped, and then the lines.
 * ============================================================================
 */
const NO_HIDDEN_AURAS: readonly string[] = [];

export function TimelinePanel({ result, hiddenAuraIds = NO_HIDDEN_AURAS }: TimelinePanelProps) {
  const [includeSwings, setIncludeSwings] = useState(false);
  const [zoom, setZoom] = useState<Zoom>('whole');

  /*
   * BUILT ONCE PER FIGHT, not per render. The two controls above are state, so
   * every press re-renders -- and walking a 100-second fight's telemetry is
   * thousands of events. `includeSwings` is in the key because it changes which
   * events are read; the zoom is NOT, because it only changes what is drawn.
   */
  const timeline = useMemo(
    () => {
      const built = buildFightTimeline(result, { includeSwings });
      // Raid-forced auras are 100% by selection, so they get no lane (round 49).
      const hidden = new Set(hiddenAuraIds);
      return { ...built, auras: built.auras.filter((lane) => !hidden.has(lane.id)) };
    },
    [result, includeSwings, hiddenAuraIds],
  );

  const windowMs =
    zoom === 'opening' ? Math.min(OPENING_MS, timeline.durationMs) : timeline.durationMs;

  if (timeline.durationMs <= 0) return null;

  return (
    <Panel
      title="Timeline"
      collapsible
      badge={`${Math.round(timeline.durationMs / 1000)}s`}
      actions={
        <>
          {/*
            * SWINGS OFF BY DEFAULT, and that is a readability decision rather
            * than a judgement about whether they matter. A geared dual-wielder
            * lands about seventy swings a fight against a dozen casts, so two
            * rows become solid blocks of ink and push every row carrying a
            * DECISION off the top of the panel. The control says what is
            * hidden, which is the difference between a default and a lie.
            */}
          <button
            type="button"
            aria-pressed={includeSwings}
            title="Show auto-attack swings as their own rows"
            onClick={() => setIncludeSwings(!includeSwings)}
          >
            {includeSwings ? 'Hide swings' : 'Show swings'}
          </button>
          <button
            type="button"
            aria-pressed={zoom === 'opening'}
            title="Show only the first 30 seconds"
            onClick={() => setZoom(zoom === 'opening' ? 'whole' : 'opening')}
          >
            {zoom === 'opening' ? 'Whole fight' : 'First 30s'}
          </button>
        </>
      }
    >
      <TimelineBody timeline={timeline} windowMs={windowMs} />
    </Panel>
  );
}

/** The axis and the three sections, exported so a test can render them. */
export function TimelineBody({
  timeline,
  windowMs,
}: {
  readonly timeline: FightTimeline;
  readonly windowMs: number;
}) {
  const span = Math.max(1, windowMs);
  /** Where a moment sits across the track, as a percentage. */
  const at = (timeMs: number) => `${((timeMs / span) * 100).toFixed(3)}%`;

  return (
    <div className="fight-timeline">
      <TimeAxis windowMs={span} at={at} />
      <TimelineSection title="Casts" count={timeline.casts.length} empty="This build casts nothing">
        {timeline.casts.map((lane) => (
          <CastRow key={lane.id} lane={lane} windowMs={span} at={at} />
        ))}
      </TimelineSection>
      <TimelineSection
        title="Buffs & debuffs"
        count={timeline.auras.length}
        empty="Nothing was applied"
      >
        {timeline.auras.map((lane) => (
          <AuraRow key={lane.id} lane={lane} windowMs={span} at={at} />
        ))}
      </TimelineSection>
      <TimelineSection
        title="Resources"
        count={timeline.resources.length}
        empty="This build spends no pool"
      >
        {timeline.resources.map((lane) => (
          <ResourceRow key={lane.id} lane={lane} windowMs={span} />
        ))}
      </TimelineSection>
    </div>
  );
}

/**
 * The clock the three sections are read against.
 *
 * ONE AXIS ABOVE ALL OF THEM rather than one per section, because the whole
 * point of the panel is comparing a row in one section against a row in
 * another: a per-section axis would let two sections be drawn at different
 * scales, which is the only way this chart could actively mislead.
 */
function TimeAxis({
  windowMs,
  at,
}: {
  readonly windowMs: number;
  readonly at: (timeMs: number) => string;
}) {
  return (
    <div className="ft-row ft-axis-row">
      <span className="ft-label">Time</span>
      <span className="ft-track">
        {axisTicks(windowMs).map((tick) => (
          <span key={tick} className="ft-tick" style={{ left: at(tick) }}>
            <span className="ft-tick-label">{formatFightTime(tick)}</span>
          </span>
        ))}
      </span>
    </div>
  );
}

/** A section that can be shut, because three of them is a long page. */
function TimelineSection({
  title,
  count,
  empty,
  children,
}: {
  readonly title: string;
  readonly count: number;
  readonly empty: string;
  readonly children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="ft-section">
      <button
        type="button"
        className="ft-section-head"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="ft-section-mark">{open ? '−' : '+'}</span>
        {title}
        <span className="muted"> {count}</span>
      </button>
      {open ? (
        count === 0 ? (
          <p className="muted ft-empty">{empty}</p>
        ) : (
          <div className="ft-rows">{children}</div>
        )
      ) : null}
    </section>
  );
}

function CastRow({
  lane,
  windowMs,
  at,
}: {
  readonly lane: CastLane;
  readonly windowMs: number;
  readonly at: (timeMs: number) => string;
}) {
  const marks = lane.marks.filter((mark) => mark.timeMs <= windowMs);
  return (
    <div className="ft-row">
      <span className="ft-label" title={`${lane.label}: ${lane.marks.length} in this fight`}>
        {lane.label}
      </span>
      <span className="ft-track">
        {marks.map((mark, index) => (
          <span
            key={index}
            className={mark.critical ? 'ft-mark ft-mark-crit' : 'ft-mark'}
            style={{ left: at(mark.timeMs) }}
            title={`${lane.label} — ${formatFightTime(mark.timeMs)}`}
          />
        ))}
      </span>
      <span className="ft-count numeric">{lane.marks.length}</span>
    </div>
  );
}

function AuraRow({
  lane,
  windowMs,
  at,
}: {
  readonly lane: AuraLane;
  readonly windowMs: number;
  readonly at: (timeMs: number) => string;
}) {
  const windows = lane.windows.filter((window) => window.startMs <= windowMs);
  /*
   * UPTIME IS THE FIGURE BESIDE THE ROW, and it is of the WHOLE fight rather
   * than of the visible window -- the zoom is a reading aid and must not
   * change what a number means. `UptimeBars` on the results page shows the
   * batch's own figure; this one belongs to this fight, which is why it is
   * worth having both.
   */
  const covered = lane.windows.reduce((total, window) => total + (window.endMs - window.startMs), 0);

  return (
    <div className="ft-row">
      <span className="ft-label" title={lane.isDebuff ? 'On the target' : 'On the character'}>
        {lane.label}
      </span>
      <span className="ft-track">
        {windows.map((window, index) => (
          <span
            key={index}
            className={lane.isDebuff ? 'ft-bar ft-bar-debuff' : 'ft-bar'}
            style={{
              left: at(window.startMs),
              // Clamped to the window, or a bar that outlives the zoom paints
              // past the right edge of the track.
              width: at(Math.min(window.endMs, windowMs) - window.startMs),
            }}
            title={`${lane.label} — ${formatFightTime(window.startMs)} to ${formatFightTime(
              window.endMs,
            )}${window.stacks > 1 ? `, ${window.stacks} stacks` : ''}`}
          />
        ))}
      </span>
      <span className="ft-count numeric">
        {((covered / Math.max(1, windowMs)) * 100).toFixed(0)}%
      </span>
    </div>
  );
}

/**
 * A pool's level across the fight, as a STEP area.
 *
 * A STEP AND NOT A SLOPE, which is `ResourceTimeline`'s rule: a resource does
 * not drift between events, it sits where it is until something spends or
 * grants it. Joining the points diagonally draws a Rogue gliding smoothly to
 * zero over the two seconds it actually spent full and then paid all at once.
 */
function ResourceRow({ lane, windowMs }: { readonly lane: ResourceLane; readonly windowMs: number }) {
  if (lane.maximum <= 0) return null;
  const points = lane.points.filter((point) => point.timeMs <= windowMs);
  if (points.length === 0) return null;

  const height = 100;
  const x = (timeMs: number) => ((timeMs / Math.max(1, windowMs)) * 1000).toFixed(2);
  const y = (value: number) => (height - (value / lane.maximum) * height).toFixed(2);

  let path = `M 0 ${y(points[0].value)}`;
  for (let index = 1; index < points.length; index += 1) {
    path += ` L ${x(points[index].timeMs)} ${y(points[index - 1].value)}`;
    path += ` L ${x(points[index].timeMs)} ${y(points[index].value)}`;
  }
  const last = points[points.length - 1];
  path += ` L 1000 ${y(last.value)}`;
  const area = `${path} L 1000 ${height} L 0 ${height} Z`;

  return (
    <div className="ft-row ft-row-pool">
      <span className="ft-label">
        {lane.label}
        <span className="muted"> peak {Math.round(lane.peak)}</span>
      </span>
      <span className="ft-track">
        <svg
          className="ft-pool"
          viewBox={`0 0 1000 ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${lane.label}, peaking at ${Math.round(lane.peak)}`}
        >
          <path d={area} className="ft-pool-fill" />
          <path d={path} className="ft-pool-line" fill="none" />
        </svg>
      </span>
      <span className="ft-count numeric">{Math.round(last.value)}</span>
    </div>
  );
}
