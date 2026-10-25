import { describe, expect, it } from 'vitest';
import { DOT_ABILITY_IDS } from '../../src/game/abilities/dots';
import { probeDots } from '../helpers/dotProbe';

/*
 * `DOT_ABILITY_IDS` IS WRITTEN OUT, SO THIS IS WHAT KEEPS IT TRUE (round 67):
 * every ability in every class's catalogue is cast, and the ones whose own
 * ticks land must be exactly the list. See `abilities/dots.ts`.
 */
describe('the abilities that apply a DoT', () => {
  const results = probeDots();

  it('are exactly the ones whose own ticks land when cast', () => {
    const found = [...results]
      .filter(([, outcome]) => outcome === 'dot')
      .map(([key]) => key.split('/')[1]!)
      .sort();
    expect(found).toEqual([...DOT_ABILITY_IDS].sort());
  });

  it('names what the probe cannot cast, none of which is a DoT', () => {
    /*
     * A REFUSAL IS NOT A "NO", so these are listed by name: each needs a fight
     * state the probe cannot build (the opening instant, the execute phase,
     * Immolate up, a second target, Shadowform's own rule) or is a buff that
     * is refused while already up. A new entry here is an ability nobody has
     * checked, and it fails until somebody does.
     */
    const refused = [...results]
      .filter(([, outcome]) => outcome.startsWith('refused'))
      .map(([key]) => key)
      .filter((key) => !key.includes('/start_auto_attack_'))
      .sort();
    expect(refused).toEqual([
      'druid/prowl',
      // Needs one of your heals over time on a friendly target (round 71).
      'druid/swiftmend',
      'hunter/hunters_mark',
      'mage/mage_armor',
      'paladin/hammer_of_wrath',
      'paladin/swift_judgement',
      'shaman/fire_nova',
      'warlock/bane_of_havoc',
      'warlock/conflagrate',
      'warlock/life_tap',
      'warrior/charge',
      'warrior/execute',
    ]);
  });
});
