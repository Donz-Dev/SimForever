/**
 * Which `other` consumable each preset carries, beside the pools it owns.
 *
 * ----------------------------------------------------------------------------
 * A READING AID FOR ONE OWNER RULING, which is a three-way partition of the 25
 * and therefore the kind of thing that is checked by eye or not at all:
 *
 *   "Demonic rune being used at 10% mana remaining should be the default
 *    behavior for pure mana users. Specifically cat druid should never use it in
 *    favor of Thistle Tea. Non-mana, non-energy users and the three tank
 *    profiles (Prot Warr, Prot Pally, and Bear) should use the Healthstone."
 *
 * `consumable_report.ts` prints all fourteen categories and is too wide to read
 * one column out of; this prints the one column that the ruling is about, with
 * the POOLS beside it so the assignment can be checked against the reason for
 * it rather than against a remembered list.
 *
 * `midFightConsumables.test.ts` asserts the partition. This is for a person.
 * ----------------------------------------------------------------------------
 */
import { PROFILE_PRESETS } from '../src/profiles/presets';
import { createPlayer } from '../src/game/actors/createPlayer';
import { resolveCombatStyle } from '../src/game/character';

console.log('%s %s %s %s', 'profile'.padEnd(16), 'other'.padEnd(14), 'pools'.padEnd(18), 'tank');

for (const preset of PROFILE_PRESETS) {
  const profile = preset.build();
  const style = resolveCombatStyle(
    profile.character.characterClass,
    profile.character.combatStyle,
  );
  const player = createPlayer({
    race: profile.character.race,
    characterClass: profile.character.characterClass,
    combatStyle: style,
    talents: profile.talents,
    equipment: profile.equipment,
  });
  /*
   * THE POOLS THE BUILD ACTUALLY SPENDS, not the ones its class declares. A
   * Druid owns mana, rage and energy in every form -- pools are keyed by CLASS
   * -- so "has a rage pool" says nothing about whether a Cat uses one. The
   * current maximum is what separates a real pool from a declared one.
   */
  const pools = (['mana', 'energy', 'rage'] as const).filter(
    (resource) => (player.resources.get(resource)?.maximum ?? 0) > 0,
  );
  console.log(
    '%s %s %s %s',
    preset.label.padEnd(16),
    (profile.consumables.other ?? '-- none --').padEnd(14),
    pools.join(',').padEnd(18),
    profile.encounter.targetAttacks ? 'TANK' : '',
  );
}
