import { describe, expect, it } from 'vitest';
import type { Ability } from '../../src/engine';
import {
  DEFAULT_GCD_MS,
  MINIMUM_GCD_MS,
  gcdLength,
  toSeconds,
  triggersGcd,
} from '../../src/engine';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import {
  QUICKENED_GCD_MS,
  STANDARD_GCD_MS,
  globalCooldownFor,
} from '../../src/game/character';
import {
  BLOODRAGE_ABILITY,
  CHARGE,
  CLEAVE,
  HEROIC_STRIKE,
  SHIELD_BLOCK_ABILITY,
  SUNDER_ARMOR_ABILITY,
  WARRIOR_ABILITIES,
} from '../../src/game/abilities/warrior';
import { startingEquipmentFor } from '../../src/game/items/startingSets';
import { buildSimulation } from '../helpers/buildSimulation';

/*
 * THE GLOBAL COOLDOWN RULE, written out by hand from the ruleset owner's own
 * words rather than read back from the table that implements it:
 *
 *   Every action, unless otherwise specified, triggers a 1.5 second global
 *   cooldown before another can be taken. For a Rogue, and for a Druid in Cat
 *   Form, it is 1.0 second instead.
 *
 * Exceptions: auto attacks, on-next-swing abilities, the Warrior's Bloodrage /
 * Shield Block / Charge, and the three stances (which share a 1 second
 * cooldown of their own instead).
 *
 * See docs/global-cooldown.md.
 */

const plain = (over: Partial<Ability> = {}): Ability => ({
  id: 'test',
  name: 'Test',
  onCast: () => undefined,
  ...over,
});

describe('how long a global cooldown is', () => {
  it('is a second and a half for most classes', () => {
    expect(toSeconds(STANDARD_GCD_MS)).toBe(1.5);
    for (const [characterClass, style] of [
      ['warrior', 'dual_wield'],
      ['paladin', 'two_hander'],
      ['mage', 'caster'],
      ['hunter', 'ranged'],
    ] as const) {
      expect(globalCooldownFor(characterClass, style)).toBe(STANDARD_GCD_MS);
    }
  });

  it('is one second for a Rogue, whatever it is holding', () => {
    expect(toSeconds(QUICKENED_GCD_MS)).toBe(1);
    expect(globalCooldownFor('rogue', 'dual_wield')).toBe(QUICKENED_GCD_MS);
    expect(globalCooldownFor('rogue', 'two_hander')).toBe(QUICKENED_GCD_MS);
  });

  it('is one second for a Druid in CAT FORM only', () => {
    /*
     * Per form, not per class. A Bear is on the ordinary 1.5, which is why
     * the lookup takes a combat style as well as a class.
     */
    expect(globalCooldownFor('druid', 'cat')).toBe(QUICKENED_GCD_MS);
    expect(globalCooldownFor('druid', 'bear')).toBe(STANDARD_GCD_MS);
    expect(globalCooldownFor('druid', 'caster')).toBe(STANDARD_GCD_MS);
  });

  it('belongs to the character, not to the ability', () => {
    // The same ability costs a Rogue one second and a Warrior one and a half.
    const warrior = createPlayer({
      race: 'human',
      characterClass: 'warrior',
      combatStyle: 'dual_wield',
    });
    const rogue = createPlayer({
      race: 'orc',
      characterClass: 'rogue',
      combatStyle: 'dual_wield',
    });
    expect(warrior.baseGcdMs).toBe(STANDARD_GCD_MS);
    expect(rogue.baseGcdMs).toBe(QUICKENED_GCD_MS);

    const ability = plain();
    expect(gcdLength(ability, 1, warrior.baseGcdMs)).toBe(1500);
    expect(gcdLength(ability, 1, rogue.baseGcdMs)).toBe(1000);
  });

  it('keeps a 1.5 second fallback for an actor with no class', () => {
    // A training dummy. Not the rule -- the rule is in the game layer.
    expect(DEFAULT_GCD_MS).toBe(1500);
    expect(createTrainingDummy().baseGcdMs).toBe(1500);
  });

  it('never lets the haste floor LENGTHEN a short global cooldown', () => {
    /*
     * A naive `Math.max(MINIMUM_GCD_MS, ...)` would take a Rogue's 1.0 second
     * global cooldown and make it 750ms at worst -- fine -- but a ruleset with
     * a base below the floor would have it raised instead. The floor is a
     * floor on the HASTED value, not a minimum the base must clear.
     */
    expect(MINIMUM_GCD_MS).toBe(750);
    const short = plain({ gcdMs: 500 });
    expect(gcdLength(short, 1, STANDARD_GCD_MS)).toBe(500);
    // And it still floors a hasted one that started above it.
    expect(gcdLength(plain(), 10, STANDARD_GCD_MS)).toBe(MINIMUM_GCD_MS);
  });
});

describe('what triggers a global cooldown', () => {
  it('is everything, by default', () => {
    expect(triggersGcd(plain())).toBe(true);
    expect(triggersGcd(SUNDER_ARMOR_ABILITY)).toBe(true);
  });

  it('is NOT an on-next-swing ability, derived rather than declared', () => {
    /*
     * Heroic Strike and Cleave are ARMED, not cast: they replace the next
     * swing when it lands, so nothing comes out of the action budget.
     *
     * Derived from `onNextSwing` so a new one gets the rule for free. The
     * failure mode of declaring it per ability is silent -- an ability that
     * wrongly took a global cooldown would still cost the right rage and deal
     * the right damage.
     */
    expect(HEROIC_STRIKE.triggersGcd).toBeUndefined();
    expect(triggersGcd(HEROIC_STRIKE)).toBe(false);
    expect(triggersGcd(CLEAVE)).toBe(false);
    expect(triggersGcd(plain({ onNextSwing: 'mainHand' }))).toBe(false);
  });

  it('lets an on-next-swing ability say otherwise if it means to', () => {
    expect(triggersGcd(plain({ onNextSwing: 'mainHand', triggersGcd: true }))).toBe(true);
  });

  it('is NOT Bloodrage, Shield Block or Charge', () => {
    // The three the ruleset owner names.
    for (const ability of [BLOODRAGE_ABILITY, SHIELD_BLOCK_ABILITY, CHARGE]) {
      expect(triggersGcd(ability), ability.name).toBe(false);
    }
  });

  it('is NOT a stance, which has a shared cooldown instead', () => {
    const stances = WARRIOR_ABILITIES.filter((ability) =>
      ability.id.endsWith('_stance_cast'),
    );
    expect(stances).toHaveLength(3);
    for (const stance of stances) {
      expect(triggersGcd(stance), stance.name).toBe(false);
      // The one second they share, which is a cooldown group and not a GCD.
      expect(stance.cooldownGroup).toBe('warrior_stance');
    }
  });
});

describe('being off the global cooldown means two things', () => {
  function warrior() {
    const player = createPlayer({
      race: 'human',
      characterClass: 'warrior',
      combatStyle: 'one_hand_shield',
      stance: 'defensive',
      equipment: startingEquipmentFor('warrior', 'one_hand_shield'),
    });
    const dummy = createTrainingDummy({ name: 'D', health: 100_000, armor: 0, level: 63 });
    const sim = buildSimulation([player, dummy]);
    sim.begin();
    player.resources.get('rage')?.gain(200);
    return { player, sim, dummy };
  }

  it('does not START one', () => {
    const { player, sim, dummy } = warrior();
    sim.cast(player, player.abilities.get('shield_block_cast')!, dummy);
    expect(player.isOnGcd(sim.clock.now())).toBe(false);
  });

  it('is not BLOCKED by one already running', () => {
    /*
     * THE HALF THAT IS EASY TO MISS, and without which a rotation built on
     * off-GCD abilities would still be waiting. Shield Block goes out while a
     * Sunder Armor global cooldown is still ticking.
     */
    const { player, sim, dummy } = warrior();
    sim.cast(player, player.abilities.get('sunder_armor_cast')!, dummy);
    expect(player.isOnGcd(sim.clock.now())).toBe(true);

    expect(
      sim.canCast(player, player.abilities.get('shield_block_cast')!, dummy),
    ).toBe(true);
    // And an ordinary ability is refused at the same moment.
    expect(sim.canCast(player, player.abilities.get('revenge')!, dummy)).toBe(false);
  });

  it('starts a global cooldown of the caster own length for anything else', () => {
    const { player, sim, dummy } = warrior();
    const before = sim.clock.now();
    sim.cast(player, player.abilities.get('sunder_armor_cast')!, dummy);
    expect(player.gcdReadyAt - before).toBe(STANDARD_GCD_MS);
  });
});
