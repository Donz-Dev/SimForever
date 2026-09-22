import { describe, expect, it } from 'vitest';
import type { PriorityEntry } from '../../src/engine';
import { WARRIOR_ABILITIES } from '../../src/game/abilities/warrior';
import {
  WARRIOR_BATTLE,
  WARRIOR_DUAL_WIELD_BERSERKER,
  WARRIOR_SHIELD,
  WARRIOR_SHIELD_DEFENSIVE,
} from '../../src/game/rotations/warrior';

/*
 * EVERY ABILITY ID IN EVERY PRIORITY LIST MUST NAME A REAL ABILITY.
 *
 * ----------------------------------------------------------------------------
 * THIS EXISTS BECAUSE ONE OF THEM DID NOT, FOR AS LONG AS THE LIST HAD EXISTED.
 *
 * The Protection list asked for `rend` and the ability's id is `rend_cast`.
 * `PriorityRotation.selectAction` does `actor.abilities.get(id)` and skips a
 * miss with `continue`, silently -- so the entry could never fire at any
 * position, at any rage, with any talents.
 *
 * Nothing caught it. The list still ran, still produced a sensible-looking
 * result, and Rend's zero casts read as an ability that never won its slot
 * rather than one the engine had never heard of. It was found by eye, while
 * printing the list out for somebody to edit.
 *
 * A typo in an id is the cheapest possible mistake to make here and one of the
 * most expensive to notice, because the failure mode is a rotation that is
 * quietly one entry shorter than it looks.
 * ----------------------------------------------------------------------------
 */

/*
 * Every ability id the Warrior HAS, read from the definitions rather than from
 * a built character.
 *
 * Deliberately not `abilitiesForClass`, which answers a narrower question: it
 * strips what a style cannot use and what talents have not unlocked, so an
 * entry gated on Shield Slam would look unresolvable on a dual-wielder. What
 * this test is for is the id being SPELLED right; gating is the rotation's own
 * business and is checked elsewhere.
 */
const KNOWN_IDS: ReadonlySet<string> = new Set(WARRIOR_ABILITIES.map((a) => a.id));

const LISTS: ReadonlyArray<readonly [string, readonly PriorityEntry[]]> = [
  ['Warrior (Battle)', WARRIOR_BATTLE],
  ['Warrior (Shield)', WARRIOR_SHIELD],
  ['Warrior (Dual-Wield, Berserker)', WARRIOR_DUAL_WIELD_BERSERKER],
  ['Warrior (Shield, Defensive)', WARRIOR_SHIELD_DEFENSIVE],
];

describe('every priority list names real abilities', () => {
  const known = KNOWN_IDS;

  for (const [name, entries] of LISTS) {
    it(`${name} has no unresolvable id`, () => {
      const unknown = entries.map((e) => e.abilityId).filter((id) => !known.has(id));
      expect(unknown, `unresolvable in ${name}`).toEqual([]);
    });

    it(`${name} lists no ability twice`, () => {
      /*
       * A duplicate is not an error the engine would report either: the
       * second copy is simply unreachable, because the first one either fires
       * or fails for a reason the second shares.
       */
      const ids = entries.map((e) => e.abilityId);
      expect(new Set(ids).size, `duplicates in ${name}`).toBe(ids.length);
    });
  }
});

describe('Rend, specifically', () => {
  it('is spelled the way the ability is', () => {
    /*
     * Named on its own as well as covered by the sweep above, because this is
     * the one that was wrong and a regression here should say so by name.
     */
    const rend = WARRIOR_SHIELD_DEFENSIVE.find((entry) => entry.abilityId.startsWith('rend'));
    expect(rend?.abilityId).toBe('rend_cast');
  });
});
