import type { CharacterProfile } from '../../profiles';
import type { AplList, DescribeNames } from '../../game/rotations/apl';
import { resolveCombatStyle, resolveStance } from '../../game/character';
import { abilitiesForClass } from '../../game/abilities/abilitiesForClass';
import { aplFor } from '../../game/rotations/rotationFor';
import { describeCondition } from '../../game/rotations/apl';
import { Panel } from '../components/Panel';

interface AplPanelProps {
  readonly profile: CharacterProfile;
}

/**
 * The Action Priority List the character actually runs.
 *
 * ============================================================================
 * THE LIST WAS THE ONE PART OF A CHARACTER NOBODY COULD SEE. Gear, talents,
 * raid buffs and consumables all have a panel; the rotation decided most of the
 * damage and was invisible -- so "why is this build worse" had no answer on
 * screen, and an entry that never fires looked exactly like an entry that does.
 *
 * BETWEEN GEAR AND RAID BUFFS, which is the owner's placement and reads in the
 * right order: what the character is holding, how it fights, then what the raid
 * gives it.
 *
 * READ-ONLY FOR NOW, deliberately. The list is data and could be edited here;
 * what is missing is the profile field to store an edit in and the migration to
 * go with it, which is the next piece of work. A panel that let somebody
 * reorder entries and then silently lost the order on reload would be worse
 * than one that shows the order.
 * ============================================================================
 */
export function AplPanel({ profile }: AplPanelProps) {
  const style = resolveCombatStyle(profile.character.characterClass, profile.character.combatStyle);
  const stance =
    profile.character.characterClass === 'warrior'
      ? resolveStance(style, profile.character.stance)
      : undefined;
  const list = aplFor(profile.character.characterClass, style, stance, profile.talents);

  /*
   * AURA IDS FALL BACK TO A PRETTIFIED ID, because there is no registry of
   * every aura's display name and inventing one for a panel would be a second
   * place for a name to live. Most aura ids ARE ability ids (`rip`, `moonfire`,
   * `rend`), so the book answers for most of them, and `shadow_trance` reading
   * as "Shadow Trance" is honest rather than wrong.
   */
  const { names, nameOf } = aplNamesFor(profile);

  if (!list) {
    return (
      <Panel title="Priority list" collapsible>
        <p className="muted">
          No priority list is defined for this build, so it fights with auto attacks only.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Priority list"
      /*
       * THE LIST'S OWN NAME AS THE BADGE, which is what the results page prints
       * and what `rotationFor` dispatched to. It is the fastest way to catch
       * the failure this project has already had twice: a build running a list
       * meant for a different spec, which produces a perfectly ordinary number.
       */
      badge={list.name}
      subtitle={`${list.entries.length} entries, highest priority first`}
      collapsible
    >
      <AplEntries list={list} names={names} nameOf={nameOf} />
    </Panel>
  );
}

/**
 * The entries themselves, SEPARATE FROM THE PANEL so a test can render them.
 *
 * `Panel` is `useState(!startOpen)` and this one is collapsible, so it starts
 * SHUT and renders no body at all in a static render -- a test that went
 * through the panel would pass every "contains" check by containing nothing.
 * `gearPanelStone.test.ts` learned that from a failing test and wrote it down;
 * this is the same lesson applied before paying for it twice.
 */
export function AplEntries({
  list,
  names,
  nameOf,
}: {
  readonly list: AplList;
  readonly names: DescribeNames;
  readonly nameOf: (id: string) => string;
}) {
  return (
    <ol className="apl-list">
      {list.entries.map((entry, index) => (
        <li key={`${entry.abilityId}-${index}`} className="apl-entry">
          <span className="apl-rank">{index + 1}</span>
          <div className="apl-body">
            <span className="apl-ability">{nameOf(entry.abilityId)}</span>
            {entry.condition ? (
              <span className="apl-condition">if {describeCondition(entry.condition, names)}</span>
            ) : (
              /*
               * SAID RATHER THAN LEFT BLANK. An unconditional entry is a FLOOR
               * under everything below it -- nothing cheaper and ungated
               * beneath it can ever be reached -- so it is the single most
               * important thing to be able to see in a list, and an empty cell
               * reads as "no information" rather than as "always".
               */
              <span className="apl-condition muted">always</span>
            )}
            {entry.note ? <span className="apl-note">{entry.note}</span> : null}
          </div>
          {entry.interruptsChannel ? (
            <span className="apl-flag" title="May cancel a channel in progress">
              interrupts
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * The name lookup the panel builds, exported so a test renders the SAME one.
 *
 * Names come from the built ability book, so an entry reads "Mortal Strike"
 * rather than `mortal_strike` -- and it is the book for THIS build, style and
 * talents included, so a talent-granted ability is named too.
 */
export function aplNamesFor(profile: CharacterProfile): {
  readonly names: DescribeNames;
  readonly nameOf: (id: string) => string;
} {
  const style = resolveCombatStyle(profile.character.characterClass, profile.character.combatStyle);
  const abilities = abilitiesForClass(profile.character.characterClass, style, profile.talents);
  const abilityNames = new Map(abilities.map((ability) => [ability.id, ability.name]));
  const nameOf = (id: string) => abilityNames.get(id) ?? prettify(id);
  return { names: { ability: nameOf, aura: nameOf }, nameOf };
}

/** `shadow_word_pain` to `Shadow Word Pain`. */
function prettify(id: string): string {
  return id
    .split('_')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}
