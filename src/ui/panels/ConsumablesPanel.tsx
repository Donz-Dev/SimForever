import type { ConsumableCategory } from '../../game/buffs/consumables';
import {
  CONSUMABLE_CATEGORIES,
  selectedConsumables,
} from '../../game/buffs/consumables';
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
 * ----------------------------------------------------------------------------
 */
export function ConsumablesPanel({ profile, onChange }: ConsumablesPanelProps) {
  const selection = profile.consumables;
  const chosen = selectedConsumables(selection);

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
            chosenId={selection[category.id] ?? ''}
            onSelect={(id) => select(category.id, id)}
          />
        ))}
      </div>

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
  chosenId,
  onSelect,
}: {
  readonly category: ConsumableCategory;
  readonly chosenId: string;
  readonly onSelect: (id: string) => void;
}) {
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
        {category.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}
