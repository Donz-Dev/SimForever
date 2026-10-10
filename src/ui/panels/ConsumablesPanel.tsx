import type { ConsumableCategory } from '../../game/buffs/consumables';
import {
  CONSUMABLE_CATEGORIES,
  consumableOptionsFor,
  selectedConsumables,
} from '../../game/buffs/consumables';
import type { ClassId } from '../../game/character';
import type { CharacterProfile } from '../../profiles';
import { Panel } from '../components/Panel';

interface ConsumablesPanelProps {
  readonly profile: CharacterProfile;
  readonly onChange: (profile: CharacterProfile) => void;
}

/**
 * What the character drank before the pull.
 *
 * ----------------------------------------------------------------------------
 * ONE DROPDOWN PER CATEGORY, which is the feature rather than a layout choice:
 * at most one consumable per category may be chosen, and a dropdown is a
 * control that can only hold one answer. The raid buffs next door are switches
 * because they are independent; these are not.
 *
 * SO THERE IS NO EXCLUSIVITY LOGIC HERE, AND THAT IS THE POINT. `RaidBuff`
 * carries `exclusiveWith` and the raid buff panel turns one switch off when
 * another goes on -- a rule living in a chooser, which is what let a Moonkin
 * reach +6% crit through a TALENT that did not pass through the chooser.
 * A selection keyed by category cannot hold two from one category at all, so
 * this panel enforces nothing and cannot be bypassed.
 *
 * READ THE SAME WAY THE GEAR PANEL IS. Every row shows its category and the
 * chosen effect, with "None" as the empty option, and the owner's own wording
 * is the label -- "+25 Agility & +2% Crit Chance" is what the table says and
 * what the dropdown shows.
 *
 * COLLAPSIBLE, like the gear and the talent trees: twelve rows set once and
 * rarely touched should not push the results off the screen.
 *
 * ----------------------------------------------------------------------------
 * AND THE LAST TWO ROWS ARE NOT SET ONCE, WHICH IS THE ONE THING THAT MAKES
 * THEM DIFFERENT HERE.
 *
 * Potion and Other are USED DURING THE FIGHT, so choosing one does two things
 * rather than one: it adds an ability to the character's book, and it adds an
 * entry to the priority list. The second happens for free -- `editProfile` in
 * `App.tsx` already runs `syncDefaultRotation` on every change a panel makes,
 * and its own comment predicted this: "applied to every change rather than to
 * the four that can matter, because the alternative is a list of edits that
 * change which stock list applies that is correct until somebody adds a fifth".
 * A consumable selection is the fifth, and it needed no edit there at all.
 *
 * SO THE TWO ROWS SAY WHERE THE REST OF THE ANSWER IS. A dropdown that silently
 * also edits the rotation is worse than one that says it does -- the Priority
 * list panel is where the condition on it can be changed, and somebody who does
 * not know that would reasonably conclude the potion is never drunk.
 *
 * CLASS-GATED, WHICH ONLY THESE TWO ROWS NEED. The owner's table names classes
 * on two entries -- "Mighty Rage Potion (Warrior, Druid)" and "Thistle Tea
 * (Rogue, Druid)" -- and `consumableOptionsFor` is the one function that
 * answers it, asked here and by the ability book. A Mage is not offered a
 * potion it cannot drink, rather than offered it and quietly given nothing.
 * ----------------------------------------------------------------------------
 */
export function ConsumablesPanel({ profile, onChange }: ConsumablesPanelProps) {
  const selection = profile.consumables;
  const chosen = selectedConsumables(selection);
  const characterClass = profile.character.characterClass;

  const select = (categoryId: string, consumableId: string) => {
    const consumables: Record<string, string> = { ...selection };
    // An empty choice REMOVES the key rather than storing a blank, so a
    // profile that has had a category cleared is the same file as one that
    // never set it -- the same reason a talent at zero points is dropped.
    if (consumableId) consumables[categoryId] = consumableId;
    else delete consumables[categoryId];
    onChange({ ...profile, consumables });
  };

  /*
   * A chosen consumable that does NOTHING says so where it is chosen.
   *
   * The same discipline items, enchants and raid buffs follow. Only Food's
   * "+44 Healing Power" qualifies today -- healing power is not a stat the
   * engine has -- and a reader who picks it should not have to find that out
   * from a comment.
   */
  const inert = chosen.filter((consumable) => consumable.unmodelled !== undefined);

  return (
    <Panel
      title="Consumables"
      collapsible
      subtitle={
        chosen.length === 0
          ? 'None'
          : `${chosen.length} of ${CONSUMABLE_CATEGORIES.length} categories`
      }
      actions={
        chosen.length > 0 ? (
          <button
            type="button"
            className="ghost"
            onClick={() => onChange({ ...profile, consumables: {} })}
          >
            Clear
          </button>
        ) : undefined
      }
    >
      <div className="gear-grid">
        {CONSUMABLE_CATEGORIES.map((category) => (
          <ConsumableRow
            key={category.id}
            category={category}
            characterClass={characterClass}
            chosenId={selection[category.id] ?? ''}
            onSelect={(id) => select(category.id, id)}
          />
        ))}
      </div>

      {/*
        * WHERE THE OTHER HALF OF A MID-FIGHT CHOICE IS MADE.
        *
        * Said once, under the rows, rather than on each of the two: a potion is
        * only drunk if the priority list has an entry for it, and selecting one
        * puts that entry in a `default` list automatically. Somebody who
        * chooses a Major Mana Potion and never looks at the Priority list panel
        * should still get one -- and somebody who wants it drunk at a different
        * threshold needs to know where to go.
        */}
      <p className="consumable-hint">
        <strong>Potion</strong> and <strong>Other</strong> are used during the fight, so choosing
        one adds it to the <strong>Priority list</strong> — where the condition it is used on can
        be changed. Potions share a two minute cooldown; an Other item has its own.
      </p>

      {inert.length > 0 ? (
        <ul className="consumable-caveats">
          {inert.map((consumable) => (
            <li key={consumable.id}>
              <strong>{consumable.name}</strong> — {consumable.unmodelled}
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}

function ConsumableRow({
  category,
  characterClass,
  chosenId,
  onSelect,
}: {
  readonly category: ConsumableCategory;
  readonly characterClass: ClassId;
  readonly chosenId: string;
  readonly onSelect: (id: string) => void;
}) {
  const options = consumableOptionsFor(category, characterClass);
  /*
   * A CHOSEN ID THIS CLASS MAY NOT HAVE IS STILL SHOWN, which is the same rule
   * the aura dropdown follows for an id its catalog does not know: "an id the
   * catalog does not know is kept as its own option rather than falling back to
   * the first entry, so a hand-edited file is never silently rewritten."
   *
   * It happens on a class change -- a Warrior with a Mighty Rage Potion made
   * into a Mage. The ability is already gone (`consumableAbilities` gates on
   * the class) and the selection is still in the file, so showing an empty
   * dropdown would claim nothing was chosen while the saved profile says
   * otherwise. Reselecting or clearing is then a visible act.
   */
  const stale = chosenId !== '' && !options.some((option) => option.id === chosenId);
  const staleName = stale
    ? category.options.find((option) => option.id === chosenId)?.name
    : undefined;

  return (
    <div className="gear-slot consumable-slot">
      <span className="gear-slot-name">{category.name}</span>
      <select
        className="gear-select"
        value={chosenId}
        aria-label={`${category.name} consumable`}
        onChange={(event) => onSelect(event.target.value)}
      >
        <option value="">None</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
        {staleName !== undefined ? (
          <option value={chosenId}>{staleName} (not for this class)</option>
        ) : null}
      </select>
    </div>
  );
}
