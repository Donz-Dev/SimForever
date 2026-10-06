import type { BatchResult } from '../../simulator';
import type { AttackOutcome } from '../../engine';
import { Panel } from '../components/Panel';
import { DonutChart } from '../charts/DonutChart';
import { UptimeBars } from '../charts/UptimeBars';
import { ResourceTimeline, resourceTimeline } from '../charts/ResourceTimeline';
import type { BatchResourceFlow, BatchStatAverages } from '../../analysis/BatchTotals';
import type { TelemetryEvent } from '../../engine';

interface ResultsPanelProps {
  readonly batch: BatchResult;
}

/*
 * EVERY NUMBER HERE IS AN AVERAGE OVER THE WHOLE BATCH.
 *
 * It used to read the iteration whose DPS landed nearest the median and print
 * that one fight's breakdown. Fine beside a combat log, useless for auditing a
 * talent: one hundred-second fight lands about forty main-hand swings, so its
 * crit rate was a forty-sample estimate quoted to one decimal, and the effect
 * of a talent is smaller than the gap between two neighbouring iterations.
 * Someone running 2500 iterations was still reading one fight.
 *
 * The combat log is still the representative iteration, because a log has to be
 * a single fight to mean anything. Nothing numeric comes from it.
 */
export function ResultsPanel({ batch }: ResultsPanelProps) {
  const isBatch = batch.iterations > 1;

  return (
    <Panel
      title="Results"
      subtitle={
        /*
         * THE PRIORITY LIST IS NAMED HERE, and it has to be: a Warrior's list
         * depends on combat style AND stance together, so two builds that look
         * identical on the character sheet can run different rotations. Without
         * this the only way to tell which one ran was to read the combat log
         * and infer it from what was missing.
         */
        [
          isBatch
            ? `Average of ${batch.iterations.toLocaleString()} iterations`
            : 'Single iteration',
          batch.rotationName,
          `${(batch.elapsedRealMs / 1000).toFixed(2)}s`,
        ]
          .filter(Boolean)
          .join(' · ')
      }
    >
      {/*
       * ----------------------------------------------------------------------
       * FOUR NUMBERS, AND THREE OF THEM ARE AVERAGES OVER THE FIGHT.
       *
       * This block used to carry DPS, damage, duration and iteration count,
       * with a distribution table of eight more below it. Damage is DPS times
       * duration and duration is an encounter setting, so neither said
       * anything the top line did not; the iteration count is in the subtitle;
       * and of the eight distribution figures the only one that changes a
       * reading is the spread, which is now on the DPS tile itself.
       *
       * WHAT REPLACED THEM CANNOT BE READ ANYWHERE ELSE. The character sheet
       * shows the character AT THE PULL, before one of its own buffs has
       * landed -- so a Rogue's sheet reads its unhasted swing speed for a build
       * whose entire cycle is Slice and Dice, and a Warrior's omits Flurry.
       * These are time-weighted means over the whole fight, which is the
       * figure that actually multiplied the swing timer and scaled the damage.
       * ----------------------------------------------------------------------
       */}
      <div className="stat-grid">
        <Stat
          label="DPS"
          value={fixed(batch.dps.mean)}
          /*
           * ONE STANDARD DEVIATION, which is the spread of SINGLE FIGHTS and
           * not the error on the mean. The two differ by a factor of the square
           * root of the iteration count -- at 3,000 iterations the standard
           * error is about 2% of this -- so they answer different questions:
           * this one is "how much does a pull vary", and `relativeError` was
           * "how sure is this average". A reader comparing two builds wants the
           * second and a reader asking what a pull looks like wants this.
           */
          note={isBatch ? `± ${fixed(batch.dps.standardDeviation)}` : undefined}
        />
        <StatAverages stats={batch.stats} />
      </div>

      <h3>Damage done</h3>
      {batch.abilities.length > 0 ? (
        <table className="breakdown">
          <thead>
            <tr>
              <th>Ability</th>
              {/* Casts, from the cast event rather than from damage, so an
                  ability that deals none still has a row. Battle Shout,
                  Sunder Armor and Bloodrage were invisible here. */}
              <th className="numeric">Uses</th>
              <th className="numeric">Damage</th>
              <th className="numeric">Share</th>
              <th className="numeric">Hits</th>
              <th className="numeric">Average</th>
              <th className="numeric">Crit</th>
              <th className="numeric">Glance</th>
              <th className="numeric">Avoided</th>
            </tr>
          </thead>
          <tbody>
            {batch.abilities.map((ability) => (
              <tr key={ability.abilityName}>
                <td>{ability.abilityName}</td>
                {/* A dash rather than 0.00 for something that is not cast at
                    all -- an auto attack, a proc, a bleed tick. Zero uses
                    would read as an ability nobody used. */}
                <td className="numeric">{ability.uses > 0 ? fixed(ability.uses) : '-'}</td>
                <td className="numeric">{fixed(ability.damage)}</td>
                <td className="numeric">
                  <span className="share">
                    <span
                      className="share-bar"
                      style={{ width: `${Math.round(ability.share * 100)}%` }}
                    />
                    <span className="share-text">{(ability.share * 100).toFixed(2)}%</span>
                  </span>
                </td>
                <td className="numeric">
                  {fixed(ability.hits)}
                  {ability.attempts !== ability.hits ? (
                    <span className="muted"> / {fixed(ability.attempts)}</span>
                  ) : null}
                </td>
                <td className="numeric">{fixed(ability.average)}</td>
                <td className="numeric">{pct(ability.critRate)}</td>
                <td className="numeric">{ability.glanceRate > 0 ? pct(ability.glanceRate) : '-'}</td>
                <td className="numeric">{ability.avoidRate > 0 ? pct(ability.avoidRate) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">No damage was dealt.</p>
      )}

      <DamageTaken batch={batch} />
      <UptimeBars
        title="Buff uptime"
        rows={batch.buffUptime}
        empty="Nothing was buffing the character."
      />
      <UptimeBars
        title="Debuff uptime on the target"
        rows={batch.debuffUptime}
        empty="Nothing was on the target."
      />
      <ResourceEconomy batch={batch} />

    </Panel>
  );
}


/*
 * B2's answer: without this, a parry chance could be allocated and there was
 * nowhere to see whether it did anything. Dodge, parry and block only ever
 * appear on attacks the player RECEIVES, so the damage-done table above cannot
 * show them however long you stare at it.
 *
 * DEATHS LIVE HERE TOO, above the table, because a death is the last thing
 * damage taken does and there is nowhere else it belongs. The character is
 * stood back up at full health and the fight carries on, so a fight can
 * contain several -- which is why it is a mean with two decimals and not a
 * yes or a no.
 */
function DamageTaken({ batch }: ResultsPanelProps) {
  if (batch.damageTaken.length === 0) return null;

  const outcomes: readonly AttackOutcome[] = ['hit', 'crit', 'crush', 'glance', 'block', 'dodge', 'parry', 'miss'];
  const seen = outcomes.filter((outcome) =>
    batch.damageTaken.some((row) => (row.rates[outcome] ?? 0) > 0),
  );

  const { survival } = batch;

  return (
    <>
      <h3>Damage taken</h3>
      {/*
       * DEATHS AND HEALING BEFORE THE SWING TABLE, because the table below
       * cannot be read without them. The target ramps ten percent a swing, so
       * "286,000 damage taken" describes a fight that was comfortable for
       * thirty seconds and unsurvivable after it -- and the only figure that
       * says which half you are looking at is how many times it killed the
       * character.
       *
       * Healing is the other half of the same sentence. It comes from an
       * assumed healer with no caster behind it, so the number is the
       * encounter's setting rather than anything about this character -- but
       * without it, damage taken has nothing to be measured against.
       */}
      <div className="stat-grid">
        <Stat label="Damage taken" value={fixed(survival.damageTaken)} />
        <Stat label="Healing received" value={fixed(survival.healingReceived)} />
        <Stat label="Overhealing" value={fixed(survival.overhealing)} />
        <Stat label="Deaths" value={fixed(survival.deaths)} />
      </div>
      <table className="breakdown">
        <thead>
          <tr>
            <th>Source</th>
            <th className="numeric">Damage</th>
            <th className="numeric">Mitigated</th>
            <th className="numeric">Armor</th>
            <th className="numeric">Avoided</th>
            <th className="numeric">Swings</th>
            <th className="numeric">Average</th>
            {/* The outcome distribution is SEVEN columns of percentage on a
                table that already has seven, and together they did not fit --
                see `.outcome`. They are the half that compresses, because a
                rate reads fine small and a damage total does not. */}
            {seen.map((outcome) => (
              <th key={outcome} className="numeric outcome">
                {outcome}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {batch.damageTaken.map((row) => (
            <tr key={row.sourceName}>
              <td>{row.sourceName}</td>
              <td className="numeric">{fixed(row.damage)}</td>
              {/* What armor stopped, and what fraction of the swing that was.
                  A tank's armor is invisible in every other column: a swing
                  that lands for 2,700 after 40% reduction reports 2,700 and
                  says nothing about the 1,800 it removed. */}
              <td className="numeric">{fixed(row.mitigated)}</td>
              <td className="numeric">{pct(row.mitigationRate)}</td>
              {/* Whole swings removed, which is a different thing from shaving
                  every swing. Two builds can take the same damage very
                  differently. */}
              <td className="numeric">{pct(row.avoidRate)}</td>
              <td className="numeric">{fixed(row.attempts)}</td>
              <td className="numeric">{fixed(row.average)}</td>
              {seen.map((outcome) => (
                <td key={outcome} className="numeric outcome">
                  {(row.rates[outcome] ?? 0) > 0 ? pct(row.rates[outcome]) : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/*
 * ============================================================================
 * ONE SECTION PER POOL THE CHARACTER ACTUALLY USED.
 *
 * Two donuts, a table and a timeline, because they answer four different
 * questions: where it came from, where it went, how many times and how much
 * each, and what was AVAILABLE moment to moment. A cost-reduction talent shows
 * up in the table as the same number of uses at a lower total, and in neither
 * donut; starvation shows up only in the timeline.
 *
 * IT USED TO BE ONE SECTION HEADED "RAGE" and the totals behind it were never
 * keyed by resource -- so a Rogue's energy and combo points were added
 * together and presented as a rage economy. Every share added to 100%.
 * ============================================================================
 */
function ResourceEconomy({ batch }: ResultsPanelProps) {
  const flows = batch.resources.filter(
    (flow) => flow.totalGained > 0 || flow.totalSpent > 0,
  );
  if (flows.length === 0) return null;

  const player = batch.representative.actors.find((actor) => actor.kind === 'player');

  return (
    <>
      {flows.map((flow) => (
        <ResourceSection
          key={flow.resource}
          flow={flow}
          timeline={batch.representative.timeline}
          actorId={player?.id}
          durationMs={batch.representative.durationMs}
        />
      ))}
    </>
  );
}

/** Display names, because `comboPoints` is not what a person calls them. */
const RESOURCE_NAMES: Readonly<Record<string, string>> = {
  rage: 'Rage',
  energy: 'Energy',
  mana: 'Mana',
  comboPoints: 'Combo points',
  focus: 'Focus',
  soulShards: 'Soul shards',
};

function ResourceSection({
  flow,
  timeline,
  actorId,
  durationMs,
}: {
  readonly flow: BatchResourceFlow;
  readonly timeline: readonly TelemetryEvent[];
  readonly actorId: string | undefined;
  readonly durationMs: number;
}) {
  const name = RESOURCE_NAMES[flow.resource] ?? flow.resource;
  const unit = name.toLowerCase();
  const points = actorId ? resourceTimeline(timeline, actorId, flow.resource) : [];

  /*
   * THE CAP COMES FROM THE FIGHT, not from a table of maximums: a talent can
   * raise energy or rage, and a character's mana is its own. The highest level
   * the pool actually reached is the honest ceiling to draw against, and it is
   * what makes "flat at the top" mean capping.
   */
  const peak = points.reduce((highest, point) => Math.max(highest, point.value), 0);

  return (
    <>
      <h3>{name}</h3>
      <div className="stat-grid">
        <Stat label="Gained" value={fixed(flow.totalGained)} />
        <Stat label="Spent" value={fixed(flow.totalSpent)} />
        <Stat label="Wasted at cap" value={fixed(flow.totalWasted)} />
        <Stat
          label="Unspent"
          value={fixed(Math.max(0, flow.totalGained - flow.totalWasted - flow.totalSpent))}
        />
      </div>

      <div className="donut-row">
        <DonutChart title={`${name} gained, by source`} slices={toSlices(flow.gained)} unit={unit} />
        <DonutChart title={`${name} spent, by ability`} slices={toSlices(flow.spent)} unit={unit} />
      </div>

      <ResourceTimeline
        title={`${name} available — one representative fight`}
        points={points}
        maximum={peak}
        durationMs={durationMs}
      />

      {flow.spent.length > 0 ? (
        <table className="breakdown">
          <thead>
            <tr>
              <th>Ability</th>
              <th className="numeric">Uses</th>
              <th className="numeric">{name} spent</th>
              <th className="numeric">Per use</th>
              <th className="numeric">Share</th>
            </tr>
          </thead>
          <tbody>
            {flow.spent.map((row) => (
              <tr key={row.sourceId}>
                <td>{row.sourceName}</td>
                <td className="numeric">{fixed(row.count)}</td>
                <td className="numeric">{fixed(row.amount)}</td>
                <td className="numeric">{row.count > 0 ? fixed(row.amount / row.count) : '-'}</td>
                <td className="numeric">{pct(row.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {/* Where it CAME from, which for a regenerating pool is most of it. */}
      {flow.gained.length > 0 ? (
        <table className="breakdown">
          <thead>
            <tr>
              <th>Source</th>
              <th className="numeric">Times</th>
              <th className="numeric">{name} gained</th>
              <th className="numeric">Wasted</th>
              <th className="numeric">Share</th>
            </tr>
          </thead>
          <tbody>
            {flow.gained.map((row) => (
              <tr key={row.sourceId}>
                <td>{row.sourceName}</td>
                <td className="numeric">{fixed(row.count)}</td>
                <td className="numeric">{fixed(row.amount)}</td>
                <td className="numeric">{fixed(row.wasted)}</td>
                <td className="numeric">{pct(row.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </>
  );
}

function toSlices(rows: readonly { sourceName: string; amount: number }[]) {
  return rows.map((row) => ({ label: row.sourceName, value: row.amount }));
}

function Stat({
  label,
  value,
  note,
}: {
  readonly label: string;
  readonly value: string;
  /** A smaller line under the value: a spread, a unit, a caveat. */
  readonly note?: string;
}) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {note ? <span className="stat-note">{note}</span> : null}
    </div>
  );
}

/*
 * ============================================================================
 * THE THREE AVERAGES, plus ranged attack power for the classes it means
 * something to.
 *
 * SPELL POWER HIDES AT ZERO, which a melee class genuinely has: a Warrior row
 * reading "Spell Power 0.00" is one a reader learns to skip.
 *
 * RANGED ATTACK POWER HIDES ON A DIFFERENT RULE, and it has to. The character
 * sheet uses `!== 0` and its comment says that keeps the row off "nine classes
 * out of ten" -- which is not what it does, because EVERY class has a base 50
 * and the sheet therefore shows the row for all of them. Fifty ranged attack
 * power on a Rogue is noise by the same argument the comment makes.
 *
 * So this shows it only when it EXCEEDS the melee pool, which is exactly when
 * it is the one the character's damage scales with: 1372 against 1292 for both
 * Hunters, 50 against 1521 for an Arms Warrior. A rule about which number
 * matters rather than a threshold nobody supplied.
 *
 * HASTE IS A PERCENTAGE ABOVE BASE, not the multiplier, because every effect
 * feeding it states itself that way -- Slice and Dice is "+30% attack speed",
 * Flurry and Rapid Fire likewise -- and 1.30 would have to be translated back
 * by the reader. It is the one number here that is never zero, so it is always
 * shown: a character with no haste at all reads 0.00%, which is a fact about
 * the build rather than an empty row.
 * ============================================================================
 */
function StatAverages({ stats }: { readonly stats: BatchStatAverages | undefined }) {
  if (!stats) return null;
  return (
    <>
      <Stat label="Attack Power" value={fixed(stats.attackPower)} note="fight average" />
      {stats.rangedAttackPower > stats.attackPower ? (
        <Stat
          label="Ranged Attack Power"
          value={fixed(stats.rangedAttackPower)}
          note="fight average"
        />
      ) : null}
      {stats.spellPower !== 0 ? (
        <Stat label="Spell Power" value={fixed(stats.spellPower)} note="fight average" />
      ) : null}
      <Stat
        label="Haste"
        value={`${((stats.hasteMultiplier - 1) * 100).toFixed(2)}%`}
        note="fight average"
      />
    </>
  );
}

/**
 * Two decimals, always, so a column of numbers lines up.
 *
 * NEGATIVE ZERO IS CLAMPED. Totals are summed from per-source floats, so a
 * figure that is exactly nothing can arrive as -1e-15 and print as "-0.00" --
 * which reads as a real negative quantity of wasted mana.
 */
function fixed(value: number): string {
  const safe = Object.is(value, -0) || (value < 0 && value > -0.005) ? 0 : value;
  return safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(2)}%`;
}
