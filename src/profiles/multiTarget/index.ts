import type { CharacterProfile } from '../CharacterProfile';
import { setSection } from '../aplSections';
import { racialsForRace } from '../../game/rotations/racialCooldowns';
import { withoutUnselectedConsumables } from '../../game/rotations/consumableCooldowns';
import type { MultiTargetDefault, MultiTargetDefaults } from './types';
import { WARRIOR_MULTI_TARGET } from './warrior';
import { ROGUE_MULTI_TARGET } from './rogue';
import { DRUID_MULTI_TARGET } from './druid';
import { SHAMAN_MULTI_TARGET } from './shaman';
import { MAGE_MULTI_TARGET } from './mage';
import { PALADIN_MULTI_TARGET } from './paladin';
import { HUNTER_MULTI_TARGET } from './hunter';
import { WARLOCK_MULTI_TARGET } from './warlock';
import { PRIEST_MULTI_TARGET } from './priest';

export type { MultiTargetDefault, MultiTargetDefaults } from './types';

/**
 * ==============================================================================
 * EVERY PRESET'S OWN MULTI TARGET LIST (round 78), one file per class so the
 * classes can be optimised side by side without editing one table.
 *
 * STORED AS A CUSTOM LIST, because that is what it is: written for the preset
 * rather than derived from its build. A `default` Multi Target list is
 * re-derived from the Single Target stock list whenever the build changes, and
 * would replace this the first time it was synced.
 * ==============================================================================
 */
export const MULTI_TARGET_DEFAULTS: MultiTargetDefaults = {
  ...WARRIOR_MULTI_TARGET,
  ...ROGUE_MULTI_TARGET,
  ...DRUID_MULTI_TARGET,
  ...SHAMAN_MULTI_TARGET,
  ...MAGE_MULTI_TARGET,
  ...PALADIN_MULTI_TARGET,
  ...HUNTER_MULTI_TARGET,
  ...WARLOCK_MULTI_TARGET,
  ...PRIEST_MULTI_TARGET,
};

/** A built preset with its own Multi Target section, when it has one. */
export function withMultiTargetDefault(presetId: string, profile: CharacterProfile): CharacterProfile {
  const list: MultiTargetDefault | undefined = MULTI_TARGET_DEFAULTS[presetId];
  if (!list) return profile;
  const precombat = list.precombat ?? profile.precombat;
  /*
   * NARROWED THE WAY A STOCK LIST IS: racials this race cannot learn switched
   * off or dropped, and mid-fight consumables it did not select dropped. The
   * engine skips an unknown ability either way, so no figure moves; what it
   * changes is a panel listing another race's Blood Fury.
   */
  return setSection(profile, 'multi', {
    ...profile,
    rotation: {
      source: 'custom',
      name: list.name,
      entries: narrowedEntries(list, profile),
      ...(list.smartHealing ? { smartHealing: true } : {}),
    },
    ...(precombat ? { precombat } : {}),
  });
}

/** A Multi Target default's entries, narrowed to the character's race and consumables. */
export function narrowedEntries(list: MultiTargetDefault, profile: CharacterProfile): MultiTargetDefault['entries'] {
  const characterClass = profile.character.characterClass;
  return withoutUnselectedConsumables(
    racialsForRace({ name: list.name, entries: list.entries }, profile.character.race, characterClass),
    characterClass,
    profile.consumables,
  ).entries;
}
