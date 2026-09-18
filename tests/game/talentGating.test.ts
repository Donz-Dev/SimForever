import { describe, expect, it } from 'vitest';
import { abilitiesForClass, talentGranting } from '../../src/game/abilities/abilitiesForClass';
import { createPlayer } from '../../src/game/actors/createPlayer';
import type { TalentAllocation } from '../../src/game/talents/Talent';
import { TOTAL_TALENT_POINTS } from '../../src/game/talents/Talent';
import { talentsForClass } from '../../src/game/talents/talentData';
import { WARRIOR_TALENT_EFFECTS } from '../../src/game/talents/warriorEffects';
import { isLegal } from '../../src/game/talents/talentRules';

/*
 * Which Warrior abilities come from a talent, transcribed BY HAND from the
 * Forever talent calculator rather than read out of the gating table. A test
 * that asked the table what the table said would pass whatever the table said.
 *
 * Tree and row are here because they are the whole argument: three of these are
 * row 6, which costs 31 points, in three different trees. 51 points reaches one.
 */
const TALENT_GRANTED = [
  { ability: 'mortal_strike', talent: 'mortal_strike', tree: 'arms', row: 6 },
  { ability: 'bloodthirst', talent: 'bloodthirst', tree: 'fury', row: 6 },
  { ability: 'shield_slam', talent: 'shield_slam', tree: 'protection', row: 6 },
  { ability: 'spearing_strike', talent: 'spearing_strike', tree: 'arms', row: 3 },
] as const;

/*
 * Every Warrior talent that grants an ability, transcribed by hand. NINE, not
 * the four above: the other five grant an ability that is not implemented yet,
 * because it is absent from the ability spreadsheet.
 *
 * They are listed because this is the class of mistake that costs most. An
 * ability handed to a character who never took its talent is free damage that
 * nothing in the results explains -- which is exactly what happened when every
 * warrior had all three 31-point capstones at once.
 */
const ABILITY_GRANTING_TALENTS = [
  { talent: 'mortal_strike', ability: 'mortal_strike', tree: 'arms', implemented: true },
  { talent: 'spearing_strike', ability: 'spearing_strike', tree: 'arms', implemented: true },
  { talent: 'sweeping_strikes', ability: 'sweeping_strikes', tree: 'arms', implemented: false },
  { talent: 'bloodthirst', ability: 'bloodthirst', tree: 'fury', implemented: true },
  { talent: 'death_wish', ability: 'death_wish', tree: 'fury', implemented: false },
  { talent: 'piercing_howl', ability: 'piercing_howl', tree: 'fury', implemented: false },
  { talent: 'shield_slam', ability: 'shield_slam', tree: 'protection', implemented: true },
  { talent: 'last_stand', ability: 'last_stand', tree: 'protection', implemented: false },
  { talent: 'concussion_blow', ability: 'concussion_blow', tree: 'protection', implemented: false },
] as const;

/** Abilities every Warrior has regardless of talents. A sample, by hand. */
const ALWAYS_KNOWN = ['heroic_strike', 'rend_cast', 'overpower', 'execute', 'whirlwind'] as const;

const idsFor = (
  style: 'dual_wield' | 'one_hand_shield' | 'two_hander',
  talents?: TalentAllocation,
) =>
  abilitiesForClass('warrior', style, talents).map((ability) => ability.id);

describe('talent-gated abilities', () => {
  it('grants none of them to a warrior who has spent no points', () => {
    const ids = idsFor('dual_wield');
    for (const { ability } of TALENT_GRANTED) {
      expect(ids).not.toContain(ability);
    }
  });

  it('treats an omitted allocation the same as an empty one', () => {
    expect(idsFor('dual_wield', {})).toEqual(idsFor('dual_wield'));
  });

  it('still grants the abilities no talent gates', () => {
    for (const ability of ALWAYS_KNOWN) {
      expect(idsFor('dual_wield')).toContain(ability);
      expect(idsFor('dual_wield', { mortal_strike: 1 })).toContain(ability);
    }
  });

  for (const { ability, talent } of TALENT_GRANTED) {
    it(`grants ${ability} only when ${talent} has a point in it`, () => {
      // Shield Slam needs a shield as well, so it is the style to test under.
      const style = ability === 'shield_slam' ? 'one_hand_shield' : 'dual_wield';
      expect(idsFor(style, { [talent]: 1 })).toContain(ability);
      expect(idsFor(style, {})).not.toContain(ability);
    });
  }

  it('grants exactly one capstone to a warrior who took one', () => {
    const capstones: readonly string[] = TALENT_GRANTED.filter((t) => t.row === 6).map(
      (t) => t.ability,
    );

    const arms = idsFor('dual_wield', { mortal_strike: 1 });
    expect(arms.filter((id) => capstones.includes(id))).toEqual(['mortal_strike']);

    const fury = idsFor('dual_wield', { bloodthirst: 1 });
    expect(fury.filter((id) => capstones.includes(id))).toEqual(['bloodthirst']);
  });

  it('does not grant an ability because some OTHER talent was taken', () => {
    // Deflection is a real Arms talent that grants no ability.
    expect(idsFor('dual_wield', { deflection: 5 })).not.toContain('mortal_strike');
  });

  it('needs both a shield and the talent for Shield Slam', () => {
    expect(idsFor('one_hand_shield', { shield_slam: 1 })).toContain('shield_slam');
    // Took the talent, put the shield away.
    expect(idsFor('dual_wield', { shield_slam: 1 })).not.toContain('shield_slam');
    // Holding a shield, never took the talent.
    expect(idsFor('one_hand_shield', {})).not.toContain('shield_slam');
  });

  it('reaches the combatant built by createPlayer', () => {
    const without = createPlayer({ race: 'human', characterClass: 'warrior', combatStyle: 'dual_wield' });
    expect(without.abilities.has('mortal_strike')).toBe(false);

    const with_ = createPlayer({
      race: 'human',
      characterClass: 'warrior',
      combatStyle: 'dual_wield',
      talents: { mortal_strike: 1 },
    });
    expect(with_.abilities.has('mortal_strike')).toBe(true);
  });
});

describe('the gating table agrees with the talent trees', () => {
  const warrior = talentsForClass('warrior');

  it('has warrior talent data to check against', () => {
    expect(warrior).toBeDefined();
  });

  for (const { ability, talent, tree, row } of TALENT_GRANTED) {
    it(`${talent} exists in the ${tree} tree at row ${row}`, () => {
      const found = warrior?.byId.get(talent);
      expect(found).toBeDefined();
      expect(found?.tree).toBe(tree);
      expect(found?.row).toBe(row);
    });

    it(`${ability} is registered as granted by ${talent}`, () => {
      expect(talentGranting('warrior', ability)).toBe(talent);
    });
  }

  it('reports no granting talent for an ability nobody gates', () => {
    expect(talentGranting('warrior', 'heroic_strike')).toBeUndefined();
  });
});

describe('the three capstones really are mutually exclusive', () => {
  /*
   * The point of the whole change, proved from the tree data rather than
   * asserted. If a future ruleset change made two of them reachable together,
   * this fails and the gating table is no longer describing a real constraint.
   */
  const warrior = talentsForClass('warrior');

  const capstones = ['mortal_strike', 'bloodthirst', 'shield_slam'] as const;

  for (const a of capstones) {
    for (const b of capstones) {
      if (a >= b) continue;
      it(`cannot legally hold both ${a} and ${b}`, () => {
        expect(warrior).toBeDefined();
        if (!warrior) return;
        // Give each capstone everything its own tree can hold, which is the
        // cheapest way to satisfy its 30-point tier requirement.
        const allocation: Record<string, number> = { [a]: 1, [b]: 1 };
        for (const id of [a, b]) {
          const talent = warrior.byId.get(id);
          if (!talent) continue;
          for (const other of warrior.trees.find((t) => t.id === talent.tree)?.talents ?? []) {
            if (other.id !== id) allocation[other.id] = other.ranks;
          }
        }
        expect(isLegal(warrior, allocation)).toBe(false);
      });
    }
  }

  it('needs more than the point budget to reach two row-6 talents', () => {
    // 30 points in a tree before row 6 opens, plus the capstone itself, twice.
    expect((30 + 1) * 2).toBeGreaterThan(TOTAL_TALENT_POINTS);
  });
});

describe('every ability locked behind a talent is unreachable without it', () => {
  const warrior = talentsForClass('warrior');

  it('finds all nine, and no more', () => {
    const declared = Object.entries(WARRIOR_TALENT_EFFECTS)
      .filter(([, effects]) => effects.some((effect) => effect.kind === 'grantAbility'))
      .map(([id]) => id)
      .sort();
    expect(declared).toEqual([...ABILITY_GRANTING_TALENTS.map((t) => t.talent)].sort());
  });

  for (const { talent, ability, tree, implemented } of ABILITY_GRANTING_TALENTS) {
    it(`${ability} is not castable without ${talent}`, () => {
      /*
       * Two ways for this to hold, and both count: the ability is gated, or it
       * does not exist yet. What must NEVER happen is it being in the book of a
       * character who did not take the talent.
       */
      for (const style of ['dual_wield', 'two_hander', 'one_hand_shield'] as const) {
        expect(idsFor(style)).not.toContain(ability);
      }
    });

    it(`${talent} is a real talent in the ${tree} tree`, () => {
      expect(warrior?.byId.get(talent)?.tree).toBe(tree);
    });

    if (implemented) {
      it(`${ability} becomes castable once ${talent} is taken`, () => {
        const style = ability === 'shield_slam' ? 'one_hand_shield' : 'dual_wield';
        expect(idsFor(style, { [talent]: 1 })).toContain(ability);
      });
    } else {
      it(`${ability} is declared but has no implementation yet`, () => {
        // The grant is declared so that gating is correct the moment the
        // ability exists. Until then taking the talent changes nothing.
        const style = 'dual_wield';
        expect(idsFor(style, { [talent]: 1 })).not.toContain(ability);
      });
    }
  }
});
