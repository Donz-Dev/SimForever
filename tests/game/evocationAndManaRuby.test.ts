import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../src/engine';
import { castAbility, checkCast, seconds } from '../../src/engine';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { EVOCATION_CHANNEL_MS } from '../../src/game/auras/mage';
import {
  EVOCATION,
  MANA_RUBY,
  MANA_RUBY_MAXIMUM,
  MANA_RUBY_MINIMUM,
} from '../../src/game/abilities/mage';
import { MAGE_ARCANE, MAGE_FIRE, MAGE_FROSTFIRE } from '../../src/game/rotations/mage';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeTarget } from '../helpers/actors';

/*
 * ==============================================================================
 * TWO MAGE ASKS FROM ROUND 51.
 *
 *   "if while casting evocation your current mana reaches 100% then stop the
 *   channel and continue with the rotation."
 *
 *   "Mana Ruby needs to be APL rotation. If current mana reaches 25% then use a
 *   Mana Ruby to regain 1000 to 1200 Mana. Can be used once per combat
 *   iteration regardless of duration. Does not trigger a global cooldown."
 *
 * The early end is an ENGINE behaviour driven by the decision loop, so it is
 * asserted on a built Mage that carries its rotation -- a bare combatant has
 * no decisions and would never be asked.
 * ==============================================================================
 */

function fireMage() {
  const built = PRESETS_BY_ID.get('mage_fire')!.build();
  return createPlayer({
    race: 'gnome',
    characterClass: 'mage',
    combatStyle: 'caster',
    talents: built.talents,
    equipment: built.equipment,
  });
}

describe('Evocation stops at a full pool', () => {
  it('ends the channel early, closes the window, and frees the caster', () => {
    /*
     * A list holding Evocation and nothing else, so the channel starts at the
     * pull and the only thing that can end it early is the new rule.
     */
    const built = PRESETS_BY_ID.get('mage_fire')!.build();
    const mage = createPlayer({
      race: 'gnome',
      characterClass: 'mage',
      combatStyle: 'caster',
      talents: built.talents,
      equipment: built.equipment,
      rotation: { name: 'Evocation only', entries: [{ abilityId: 'evocation' }] },
    });
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([mage, makeTarget({ maxHealth: 1e9 })], {
      durationMs: seconds(60),
    }, { emit: (event) => events.push(event) });
    simulation.begin();
    const mana = mage.resources.get('mana')!;
    // A few hundred short of full, so sixteenfold regeneration fills it fast.
    mana.set(mana.maximum - 300);

    simulation.advanceTo(EVOCATION_CHANNEL_MS - 1000);
    const started = events.find((event) => event.type === 'cast' && event.abilityId === 'evocation');
    expect(started, 'the list cast it').toBeDefined();
    const ended = events.find(
      (event): event is Extract<TelemetryEvent, { type: 'channel_interrupted' }> =>
        event.type === 'channel_interrupted' && event.abilityId === 'evocation',
    );
    expect(ended?.interruptedFor).toBe('its own end condition');
    expect(ended!.timestamp - started!.timestamp).toBeLessThan(EVOCATION_CHANNEL_MS - 1000);
    expect(mana.current).toBe(mana.maximum);
    expect(mage.auras.has('evocation'), 'the window closed with the channel').toBe(false);
    expect(mage.isCasting(simulation.clock.now()), 'the caster is free').toBe(false);
  });

  it('runs to its end when the pool does not fill', () => {
    expect(EVOCATION.endsChannelEarly).toBeDefined();
    const mage = fireMage();
    const simulation = buildSimulation([mage, makeTarget({ maxHealth: 1e9 })], {
      durationMs: seconds(60),
    });
    simulation.begin();
    const mana = mage.resources.get('mana')!;
    mana.set(0);
    expect(EVOCATION.endsChannelEarly!(simulation, mage)).toBe(false);
    mana.set(mana.maximum);
    expect(EVOCATION.endsChannelEarly!(simulation, mage)).toBe(true);
  });
});

describe('the Mana Ruby', () => {
  it('restores 1000 to 1200 mana, off the global cooldown, once a fight', () => {
    expect([MANA_RUBY_MINIMUM, MANA_RUBY_MAXIMUM]).toEqual([1000, 1200]);
    expect(MANA_RUBY.triggersGcd).toBe(false);

    const mage = fireMage();
    const simulation = buildSimulation([mage, makeTarget({ maxHealth: 1e9 })], {
      durationMs: seconds(600),
    });
    simulation.begin();
    const mana = mage.resources.get('mana')!;
    mana.set(0);
    expect(castAbility(simulation, mage, MANA_RUBY, undefined).ok).toBe(true);
    expect(mana.current).toBeGreaterThanOrEqual(MANA_RUBY_MINIMUM);
    expect(mana.current).toBeLessThanOrEqual(MANA_RUBY_MAXIMUM);

    // "Once per combat iteration regardless of duration": ten minutes on, no.
    simulation.advanceTo(seconds(590));
    expect(checkCast(simulation, mage, MANA_RUBY, undefined).ok).toBe(false);
  });

  it('is in all three Mage lists at 25% mana, above Evocation', () => {
    for (const list of [MAGE_FIRE, MAGE_FROSTFIRE, MAGE_ARCANE]) {
      const ids = list.entries.map((entry) => entry.abilityId);
      const ruby = list.entries.find((entry) => entry.abilityId === 'mana_ruby');
      expect(ruby?.condition, list.name).toEqual({
        kind: 'resourceFraction',
        resource: 'mana',
        compare: 'atMost',
        fraction: 0.25,
      });
      expect(ids.indexOf('mana_ruby'), list.name).toBeLessThan(ids.indexOf('evocation'));
    }
  });
});
