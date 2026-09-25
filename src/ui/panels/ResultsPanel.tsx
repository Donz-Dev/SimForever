import type { BatchResult } from '../../simulator';
import type { AttackOutcome } from '../../engine';
import { toSeconds } from '../../engine';
import { Panel } from '../components/Panel';
import { DonutChart } from '../charts/DonutChart';
import { UptimeBars } from '../charts/UptimeBars';

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
  const seconds = toSeconds(batch.meanDurationMs);

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
      <div className="stat-grid">
        <Stat label="DPS" value={fixed(batch.dps.mean)} />
        <Stat label="Damage" value={fixed(batch.meanDamage)} />
        <Stat label="Duration" value={`${seconds.toFixed(2)} sec`} />
        <Stat label="Iterations" value={batch.iterations.toLocaleString()} />
      </div>

      {isBatch ? (
        <>
          <h3>Distribution</h3>
          <div className="stat-grid">
            <Stat label="Mean" value={fixed(batch.dps.mean)} />
            <Stat label="Median" value={fixed(batch.dps.median)} />
            <Stat label="Min" value={fixed(batch.dps.min)} />
            <Stat label="Max" value={fixed(batch.dps.max)} />
            <Stat label="Std Dev" value={fixed(batch.dps.standardDeviation)} />
            <Stat label="Error" value={`${(batch.dps.relativeError * 100).toFixed(2)}%`} />
            <Stat label="5th pct" value={fixed(batch.dps.percentiles.p5)} />
            <Stat label="95th pct" value={fixed(batch.dps.percentiles.p95)} />
          </div>
        </>
      ) : null}

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

      <CastButNotSimulated batch={batch} />
      <PetCaveat batch={batch} />
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
      <RageEconomy batch={batch} />

      <p className="muted end-reason">
        Every figure above is a mean over {batch.iterations.toLocaleString()}{' '}
        {batch.iterations === 1 ? 'iteration' : 'iterations'}. Rates are pooled across the
        batch rather than averaged per fight.
      </p>
    </Panel>
  );
}

/*
 * THE SAME DISCIPLINE THE GEAR PANEL APPLIES TO ITEMS, and it belongs here for
 * the same reason.
 *
 * Demoralizing Shout sits in the tank list at about 80% uptime, costing 10
 * rage and a global cooldown a cast, and reduces no damage at all: it removes
 * attack power and the target's swing damage is stated outright rather than
 * derived from any. Every number on this page is consistent with it working.
 * Nothing on this page said it did not.
 *
 * Above the damage-taken table rather than at the bottom, because it is a
 * caveat about the numbers that follow and a caveat nobody scrolls to is not
 * one. Only abilities the fight actually CAST appear: an inert ability no list
 * reaches says nothing about this result and would bury the one that does.
 */
/*
 * THE PET'S CAVEAT, which is about a NUMBER rather than about an ability.
 *
 * Its base DPS is invented, and this project's rule for an invented number is
 * that a person can see it where the result is. `PET_UNMODELLED` existed and
 * reached nothing for as long as pets have, so the figure beside it looked
 * exactly as sourced as every other figure on the page.
 */
function PetCaveat({ batch }: ResultsPanelProps) {
  if (!batch.petCaveat) return null;

  return (
    <>
      <h3>The pet</h3>
      <p className="muted warn">{batch.petCaveat}</p>
    </>
  );
}

function CastButNotSimulated({ batch }: ResultsPanelProps) {
  if (batch.castButNotSimulated.length === 0) return null;

  return (
    <>
      <h3>Cast but not simulated</h3>
      <p className="muted warn">
        The rotation spends rage and global cooldowns on these and gets less than they
        say. Their uptime and cast counts below are real; their effect is not.
      </p>
      <ul className="issues">
        {batch.castButNotSimulated.map((entry) => (
          <li key={entry.abilityName}>
            <strong>{entry.abilityName}</strong> — {fixed(entry.uses)} casts a fight
            <span className="muted"> {entry.reason}</span>
          </li>
        ))}
      </ul>
    </>
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
            {seen.map((outcome) => (
              <th key={outcome} className="numeric">
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
                <td key={outcome} className="numeric">
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
 * B3's answer. Two donuts and a table, because they answer different questions:
 * the donuts say where rage comes from and goes as a proportion, and the table
 * says how many times and how much each — which is what a cost-reduction talent
 * actually moves. Improved Heroic Strike shows up as the same number of uses at
 * a lower total, and neither donut alone would show that.
 */
function RageEconomy({ batch }: ResultsPanelProps) {
  const { rage } = batch;
  if (rage.totalGained <= 0 && rage.totalSpent <= 0) return null;

  return (
    <>
      <h3>Rage</h3>
      <div className="stat-grid">
        <Stat label="Gained" value={fixed(rage.totalGained)} />
        <Stat label="Spent" value={fixed(rage.totalSpent)} />
        <Stat label="Wasted at cap" value={fixed(rage.totalWasted)} />
        <Stat
          label="Unspent"
          value={fixed(Math.max(0, rage.totalGained - rage.totalWasted - rage.totalSpent))}
        />
      </div>

      <div className="donut-row">
        <DonutChart title="Rage gained, by source" slices={toSlices(rage.gained)} unit="rage" />
        <DonutChart title="Rage spent, by ability" slices={toSlices(rage.spent)} unit="rage" />
      </div>

      <table className="breakdown">
        <thead>
          <tr>
            <th>Ability</th>
            <th className="numeric">Uses</th>
            <th className="numeric">Rage spent</th>
            <th className="numeric">Per use</th>
            <th className="numeric">Share</th>
          </tr>
        </thead>
        <tbody>
          {rage.spent.map((row) => (
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
    </>
  );
}

function toSlices(rows: readonly { sourceName: string; amount: number }[]) {
  return rows.map((row) => ({ label: row.sourceName, value: row.amount }));
}

function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

/** Two decimals, always, so a column of numbers lines up. */
function fixed(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(2)}%`;
}
