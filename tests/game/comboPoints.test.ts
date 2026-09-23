import { describe, expect, it } from 'vitest';
import type { Combatant, SimulationContext } from '../../src/engine';
import { createPlayer } from '../../src/game/actors/createPlayer';
import {
  MAX_COMBO_POINTS,
  awardComboPoint,
  comboPointsOn,
  hasComboPoints,
  spendComboPoints,
} from '../../src/game/combat/comboPoints';
import { FIXED_RESOURCE_MAXIMUMS, resourceSpecsFor } from '../../src/game/character/resources';
import { baseManaFor } from '../../src/game/character/baseStatLookup';

/*
 * ----------------------------------------------------------------------------
 * COMBO POINTS: BUILD, CAP, SPEND, SCALE.
 *
 * Four profiles across two classes are waiting on this -- Cat Druid and all
 * three Rogue builds -- and it is deliberately NOT an engine change. The
 * resource type has existed since the resource system was written; what was
 * missing was a maximum, two class resource lists, and one place saying what a
 * builder and a finisher do.
 *
 * Every failure this guards against is a QUIET one, which is why each has its
 * own test rather than being folded into a happy path:
 *
 *   no maximum      every point awarded is wasted the instant it is granted
 *   drain-then-read a finisher scales by zero and looks like a weak ability
 *   no gate         a finisher at zero points spends energy and a GCD for
 *                   nothing
 * ----------------------------------------------------------------------------
 */

const rogue = () => createPlayer({ race: 'orc', characterClass: 'rogue' });
const catDruid = () =>
  createPlayer({ race: 'tauren', characterClass: 'druid', combatStyle: 'cat' });

/** A context that records what was granted, standing in for a simulation. */
function recordingContext() {
  const granted: { resource: string; amount: number; source?: string }[] = [];
  const context = {
    grantResource: (actor: Combatant, resource: string, amount: number, source?: { id: string }) => {
      granted.push({ resource, amount, source: source?.id });
      const pool = actor.resources.get(resource as never);
      pool?.gain(amount);
    },
  } as unknown as SimulationContext;
  return { context, granted };
}

describe('the pool exists and is capped at five', () => {
  it('has a maximum, which is what stops every point being wasted', () => {
    /*
     * A resource with no entry here is built with `maximum: 0`, and then every
     * point granted overflows immediately -- no error, no warning, just a
     * finisher that never has anything to spend.
     */
    expect(FIXED_RESOURCE_MAXIMUMS.comboPoints).toBe(MAX_COMBO_POINTS);
    expect(MAX_COMBO_POINTS).toBe(5);
  });

  it('belongs to the Rogue and to the Druid, and to nobody else', () => {
    expect(rogue().resources.has('comboPoints')).toBe(true);
    expect(catDruid().resources.has('comboPoints')).toBe(true);

    // Races chosen so each combination is a legal one; base stats refuse
    // anything that is not.
    for (const [race, characterClass] of [
      ['orc', 'warrior'],
      ['troll', 'mage'],
      ['orc', 'hunter'],
      ['troll', 'priest'],
    ] as const) {
      const other = createPlayer({ race, characterClass });
      expect(other.resources.has('comboPoints'), characterClass).toBe(false);
    }
  });

  it('starts empty, and does not regenerate on a timer', () => {
    const pool = rogue().resources.require('comboPoints');
    expect(pool.current).toBe(0);
    expect(pool.maximum).toBe(MAX_COMBO_POINTS);

    // Only mana and energy tick back; a combo point is earned by hitting.
    const specs = resourceSpecsFor('druid', baseManaFor('tauren', 'druid'));
    const combo = specs.find((spec) => spec.type === 'comboPoints');
    expect(combo).toMatchObject({ maximum: MAX_COMBO_POINTS, initial: 0 });
  });
});

describe('building them', () => {
  it('awards one at a time, up to five', () => {
    const { context } = recordingContext();
    const player = rogue();

    for (let i = 1; i <= MAX_COMBO_POINTS; i += 1) {
      awardComboPoint(context, player, 'sinister_strike', 'Sinister Strike');
      expect(comboPointsOn(player)).toBe(i);
    }
  });

  it('WASTES the overflow rather than refusing it', () => {
    /*
     * `grantResource` reports the overflow as `wasted`, which is what makes
     * "how much of my builder was thrown away" a number on the results page.
     * Refusing the award instead would hide it, and a rotation cannot be told
     * it is over-building from a number nobody records.
     */
    const { context } = recordingContext();
    const player = rogue();
    for (let i = 0; i < 8; i += 1) {
      awardComboPoint(context, player, 'sinister_strike', 'Sinister Strike');
    }
    expect(comboPointsOn(player)).toBe(MAX_COMBO_POINTS);
  });

  it('attributes the award to the ability that built it', () => {
    const { context, granted } = recordingContext();
    awardComboPoint(context, rogue(), 'mangle_cat', 'Mangle (Cat)');
    expect(granted).toEqual([{ resource: 'comboPoints', amount: 1, source: 'mangle_cat' }]);
  });
});

describe('spending them', () => {
  it('returns how many there were, and leaves none', () => {
    const { context } = recordingContext();
    const player = rogue();
    awardComboPoint(context, player, 'sinister_strike', 'Sinister Strike', 3);

    expect(spendComboPoints(player)).toBe(3);
    expect(comboPointsOn(player)).toBe(0);
  });

  it('READS BEFORE IT DRAINS, which is the whole helper', () => {
    /*
     * Draining first and reading after gives zero, and a finisher that deals
     * its one-point damage at five points is not obviously broken from the
     * outside -- it looks like a weak ability. Asserted as a relationship
     * rather than a value: whatever was held is what comes back.
     */
    const { context } = recordingContext();
    for (const held of [1, 2, 5]) {
      const player = rogue();
      awardComboPoint(context, player, 'builder', 'Builder', held);
      expect(spendComboPoints(player)).toBe(held);
    }
  });

  it('spends nothing and returns zero at an empty bar', () => {
    const player = rogue();
    expect(spendComboPoints(player)).toBe(0);
    expect(comboPointsOn(player)).toBe(0);
  });

  it('gates a finisher, so none is cast for nothing', () => {
    const { context } = recordingContext();
    const player = rogue();

    // A finisher at zero points does nothing and still costs energy and a
    // global cooldown.
    expect(hasComboPoints(player)).toBe(false);
    awardComboPoint(context, player, 'builder', 'Builder');
    expect(hasComboPoints(player)).toBe(true);
    spendComboPoints(player);
    expect(hasComboPoints(player)).toBe(false);
  });

  it('is safe on a character with no such pool', () => {
    // A warrior has no combo points, and asking must not throw.
    const warrior = createPlayer({ race: 'orc', characterClass: 'warrior' });
    expect(comboPointsOn(warrior)).toBe(0);
    expect(hasComboPoints(warrior)).toBe(false);
    expect(spendComboPoints(warrior)).toBe(0);
  });
});

describe('scaling a finisher by what it spent', () => {
  it('is the Execute pattern: fixed cost, then drain and scale', () => {
    /*
     * EXECUTE PROVED THIS SHAPE before combo points needed it: `Ability.cost`
     * takes the fixed part, and `onCast` drains what is left in a second pool
     * and scales by what it drained. A finisher is the same, with energy as
     * the fixed part and combo points as the second pool.
     *
     * Written out here as the arithmetic a finisher does, so the relationship
     * is pinned even before any class has one.
     */
    const { context } = recordingContext();
    const perPoint = 80;

    for (const held of [1, 3, 5]) {
      const player = catDruid();
      awardComboPoint(context, player, 'mangle_cat', 'Mangle (Cat)', held);

      const spent = spendComboPoints(player);
      const damage = perPoint * spent;

      expect(spent).toBe(held);
      expect(damage).toBe(perPoint * held);
    }
  });
});
