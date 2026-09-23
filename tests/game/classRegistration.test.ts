import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '../../src/game/character';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import { talentsForClass } from '../../src/game/talents/talentData';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { hasValues } from '../../src/game/talents/talentValues';
import { WARRIOR_TALENT_EFFECTS } from '../../src/game/talents/warriorEffects';
import { ROGUE_TALENT_EFFECTS } from '../../src/game/talents/rogueEffects';
import { DRUID_TALENT_EFFECTS } from '../../src/game/talents/druidEffects';
import { SHAMAN_TALENT_EFFECTS } from '../../src/game/talents/shamanEffects';

/*
 * ------------------------------------------------------------------------------
 * A CLASS HAS TO BE REGISTERED IN FOUR PLACES, AND MISSING ANY ONE IS SILENT.
 *
 * This file exists because that has now happened twice, in two different
 * registries, with the same symptom both times: the class looks finished, the
 * build reports a pile of "unmodelled" talents, and unmodelled is exactly what
 * an unfinished class is supposed to say.
 *
 *   `talentValues.ts`     FILES          the Rogue, PR #68. Twenty Combat
 *                                        talents resolved to no number and
 *                                        every one reported itself unmodelled.
 *   `talentBuild.ts`      EFFECTS        the Shaman. Worse, because it is
 *                                        SILENT IN A DIFFERENT WAY: nothing
 *                                        reported unmodelled at all, the tree
 *                                        simply produced no effects, and three
 *                                        talent-granted abilities -- Lava
 *                                        Burst, Stormstrike and Rage of the
 *                                        Farseer -- were missing from the
 *                                        spellbook with no complaint. It cost
 *                                        an Elemental shaman 37% of its damage
 *                                        and an Enhancement one 44%, and the
 *                                        figures looked perfectly ordinary.
 *   `talentBuild.ts`      REACTIONS      a talent proc that never fires.
 *   `abilitiesForClass`   CLASS_ABILITIES + TALENT_ABILITIES
 *
 * A prose rule in CLAUDE.md caught the first one and did not catch the second,
 * because it named the file rather than the shape. So this is the check
 * instead: a class with abilities is a class that is being worked on, and
 * every registry has to know about it.
 * ------------------------------------------------------------------------------
 */

/** Written out by hand rather than imported from the registry under test. */
const EFFECT_TABLES = {
  warrior: WARRIOR_TALENT_EFFECTS,
  rogue: ROGUE_TALENT_EFFECTS,
  druid: DRUID_TALENT_EFFECTS,
  shaman: SHAMAN_TALENT_EFFECTS,
} as const;

const IMPLEMENTED = Object.keys(EFFECT_TABLES) as (keyof typeof EFFECT_TABLES)[];

describe('every implemented class is registered everywhere', () => {
  it('names the classes that have content, and no others', () => {
    // The one place this list is written down. A class arriving here without
    // arriving in the registries below fails the rest of this file.
    expect(IMPLEMENTED).toEqual(['warrior', 'rogue', 'druid', 'shaman']);
    for (const id of CLASS_IDS) {
      const hasAbilities = abilitiesForClass(id).length > 0;
      expect(hasAbilities, id).toBe(IMPLEMENTED.includes(id as never));
    }
  });

  for (const characterClass of IMPLEMENTED) {
    describe(characterClass, () => {
      it('has a values file, so its talents resolve to numbers', () => {
        expect(hasValues(characterClass)).toBe(true);
      });

      it('declares an effect for every talent in its trees, and no stray ids', () => {
        const trees = talentsForClass(characterClass);
        expect(trees, characterClass).toBeDefined();
        const inTree = new Set(
          trees!.trees.flatMap((tree) =>
            tree.talents.map((talent) => talent.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')),
          ),
        );
        const declared = new Set(Object.keys(EFFECT_TABLES[characterClass]));

        // Both directions. A missing id is a silent talent; a stray one is a
        // rename that left the effect behind pointing at nothing.
        expect([...inTree].filter((id) => !declared.has(id)), 'undeclared').toEqual([]);
        expect([...declared].filter((id) => !inTree.has(id)), 'stray').toEqual([]);
      });

      it('is wired into talentBuild, so its effects actually reach a build', () => {
        /*
         * THE CHECK THE SHAMAN NEEDED. `talentBuild` has its OWN per-class
         * effects table, separate from the one the abilities registry inverts,
         * and a class present in one and absent from the other produces a
         * build with nothing in it rather than an error.
         *
         * Every point in every talent, so any class passes on the strength of
         * something rather than needing a hand-picked talent here.
         */
        const trees = talentsForClass(characterClass)!;
        const everything = Object.fromEntries(
          trees.trees.flatMap((tree) =>
            tree.talents.map((talent) => [
              talent.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
              talent.ranks,
            ]),
          ),
        );
        const build = talentBuild(characterClass, everything);

        // A build that reached the effects table has SOMETHING to show for it:
        // a granted ability, a reaction, or a talent it could not model. All
        // three are empty when the class is missing from the registry.
        const reached =
          build.grantedAbilities.size + build.reactions.length + build.unmodelled.length;
        expect(reached, `${characterClass} reaches talentBuild`).toBeGreaterThan(0);
        expect(build.grantedAbilities.size, `${characterClass} grants abilities`).toBeGreaterThan(
          0,
        );
      });
    });
  }
});
