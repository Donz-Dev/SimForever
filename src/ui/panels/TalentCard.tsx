import type { ClassId } from '../../game/character';
import type { ClassTalents, Talent, TalentAllocation } from '../../game/talents/Talent';
import { talentDescription } from '../../game/talents/talentValues';
import { grantsAbility } from '../../game/talents/talentBuild';

/**
 * The card a talent shows on hover, drawn the way the game draws it: icon,
 * gold small-caps name, a row of rank pips with "Rank N of M · Passive", the
 * rank's own text in yellow, and a footer that says what is left to do.
 *
 * ----------------------------------------------------------------------------
 * IT REPLACES A NATIVE `title`, which was the browser's white box with the
 * rank-ONE text in it whatever the rank -- so a talent at 3/3 described itself
 * at 1/3. `talentDescription` fills the text from the values file at the rank
 * actually held, which is also the number the fight runs on (the patch-note
 * override layer arrives through the same root).
 *
 * "NEXT RANK" APPEARS ONLY PART-WAY UP, which is the game's arrangement: at
 * zero the card shows rank 1 as what a point would buy, at full rank there is
 * no next, and in between both are worth reading side by side.
 *
 * THE REQUIREMENT LINES ARE RED ONLY WHILE UNMET. A requirement that is
 * satisfied is noise on a card somebody is reading to decide a point, so it is
 * dropped rather than greyed -- and "Max rank" takes the footer when there is
 * nothing left to buy.
 * ----------------------------------------------------------------------------
 */
export function TalentCard({
  characterClass,
  talents,
  talent,
  allocation,
  iconUrl,
}: {
  readonly characterClass: ClassId;
  readonly talents: ClassTalents;
  readonly talent: Talent;
  readonly allocation: TalentAllocation;
  readonly iconUrl: string;
}) {
  const points = allocation[talent.id] ?? 0;
  const describe = (rank: number) =>
    talentDescription(characterClass, talent.id, rank) ?? talent.description;
  const shownRank = Math.max(1, points);
  const tree = talents.trees.find((candidate) => candidate.id === talent.tree);
  const spentInTree =
    tree?.talents.reduce((sum, member) => sum + (allocation[member.id] ?? 0), 0) ?? 0;
  const prerequisite = talent.requires ? talents.byId.get(talent.requires) : undefined;
  const prerequisiteNeeded = talent.requiresRanks ?? prerequisite?.ranks ?? 0;
  const prerequisiteHeld = talent.requires ? (allocation[talent.requires] ?? 0) : 0;

  const unmet: string[] = [];
  if (points < talent.ranks) {
    if (spentInTree < talent.tier) {
      unmet.push(`Requires ${talent.tier} points in ${tree?.name ?? talent.tree}`);
    }
    if (prerequisite && prerequisiteHeld < prerequisiteNeeded) {
      unmet.push(`Requires ${prerequisiteNeeded} points in ${prerequisite.name}`);
    }
  }

  return (
    <div className="talent-card">
      <div className="talent-card-head">
        <img className="talent-card-icon" src={iconUrl} alt="" draggable={false} />
        <div>
          <div className="talent-card-name">{talent.name}</div>
          <div className="talent-card-rank">
            <span className="talent-card-pips" aria-hidden="true">
              {Array.from({ length: talent.ranks }, (_unused, index) => (
                <span key={index} className={index < points ? 'pip on' : 'pip'} />
              ))}
            </span>
            Rank {points} of {talent.ranks} · {grantsAbility(characterClass, talent.id) ? 'Active' : 'Passive'}
          </div>
        </div>
      </div>

      <p className="talent-card-text">{describe(shownRank)}</p>

      {points > 0 && points < talent.ranks ? (
        <>
          <div className="talent-card-label">Next rank:</div>
          <p className="talent-card-text">{describe(points + 1)}</p>
        </>
      ) : null}

      {points >= talent.ranks ? <div className="talent-card-foot">Max rank</div> : null}
      {unmet.map((line) => (
        <div key={line} className="talent-card-foot is-unmet">
          {line}
        </div>
      ))}
    </div>
  );
}
