/**
 * Does any profile collect a party crit aura twice?
 *
 * ==============================================================================
 * THE OWNER'S OWN CHECK: "ensure that Cat Druid and Moonkin are not
 * double-dipping from Leader of the Pack and Moonkin Aura."
 *
 * Both are reachable from TWO places at once -- a Druid TALENT and a raid buff
 * entry -- and this project has already paid for getting it wrong: enforcing the
 * exclusivity at the CHOOSER let a Moonkin hold two ids and read **+6% crit**
 * where the ruling is 3%, measured at 24.243% against 21.243%.
 *
 * WHAT MAKES IT SAFE IS THE SHARED AURA ID, not the selection: `AuraCollection
 * .apply` refreshes a matching id rather than stacking, so one id reached four
 * ways is still one aura. **That is a claim about the built character and not
 * about the list**, which is why this reads the character.
 *
 * SO IT PRINTS THE STACK COUNT AND THE CRIT, per profile: an aura present more
 * than once, or a party aura carrying more than its one application, is the bug.
 * ==============================================================================
 */
import { PROFILE_PRESETS } from '../src/profiles/presets';
import { characterAtCombatStart } from '../src/simulator';
import { LEADER_OF_THE_PACK_AURA_ID, MOONKIN_AURA_ID } from '../src/game/auras/druid';

const PARTY_AURAS = [LEADER_OF_THE_PACK_AURA_ID, MOONKIN_AURA_ID];

console.log('\n  profile              melee crit  spell crit   party auras held');
console.log('  ' + '-'.repeat(74));

for (const preset of PROFILE_PRESETS) {
  const profile = preset.build();
  const built = characterAtCombatStart(profile);
  if (!built) continue;

  const held = PARTY_AURAS.map((id) => {
    const aura = built.auras.get(id);
    return aura ? `${id} x${aura.stacks}` : '';
  }).filter((text) => text.length > 0);

  const stats = built.stats.effective;
  console.log(
    `  ${preset.id.padEnd(20)} ${stats.critChance.toFixed(3).padStart(10)} ` +
      `${stats.spellCritChance.toFixed(3).padStart(11)}   ${held.join(', ') || '--'}`,
  );
}
console.log('');
