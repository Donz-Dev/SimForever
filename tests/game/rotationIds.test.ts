import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DRUID_ABILITIES } from '../../src/game/abilities/druid';
import { HUNTER_ABILITIES } from '../../src/game/abilities/hunter';
import { MAGE_ABILITIES } from '../../src/game/abilities/mage';
import { PALADIN_ABILITIES } from '../../src/game/abilities/paladin';
import { PET_ABILITIES } from '../../src/game/abilities/pet';
import { PRIEST_ABILITIES } from '../../src/game/abilities/priest';
import { ROGUE_ABILITIES } from '../../src/game/abilities/rogue';
import { SHAMAN_ABILITIES } from '../../src/game/abilities/shaman';
import { WARLOCK_ABILITIES } from '../../src/game/abilities/warlock';
import { WARRIOR_ABILITIES } from '../../src/game/abilities/warrior';
import { ALL_PRIORITY_LISTS } from '../../src/game/rotations/allLists';
import { rotationFor } from '../../src/game/rotations/rotationFor';
import { WARRIOR_SHIELD_DEFENSIVE } from '../../src/game/rotations/warrior';
import { PRESETS_BY_ID, PROFILE_PRESETS } from '../../src/profiles/presets';

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
 * AND THEN IT ONLY CHECKED FOUR LISTS OUT OF TWENTY-SIX. The enumeration was
 * written by hand when the Warrior was the only class, and it never grew: not
 * the Warrior's own two-handed list, and not one entry belonging to any of the
 * other eight classes or to the pet. Twenty-two lists could carry the exact
 * bug this file was written for.
 *
 * So the enumeration is `ALL_PRIORITY_LISTS` now, and the LAST TEST HERE
 * CHECKS THE ENUMERATION ITSELF against the source files -- because a
 * hand-maintained list of lists decays silently, which is the thing this file
 * already knows.
 * ----------------------------------------------------------------------------
 */

/*
 * Every ability id an owner HAS, read from the definitions rather than from a
 * built character.
 *
 * Deliberately not `abilitiesForClass`, which answers a narrower question: it
 * strips what a style cannot use and what talents have not unlocked, so an
 * entry gated on Shield Slam would look unresolvable on a dual-wielder. What
 * this test is for is the id being SPELLED right; gating is the rotation's own
 * business and is checked elsewhere.
 */
const OWNER_ABILITIES: Readonly<Record<string, ReadonlySet<string>>> = {
  warrior: new Set(WARRIOR_ABILITIES.map((a) => a.id)),
  rogue: new Set(ROGUE_ABILITIES.map((a) => a.id)),
  druid: new Set(DRUID_ABILITIES.map((a) => a.id)),
  shaman: new Set(SHAMAN_ABILITIES.map((a) => a.id)),
  mage: new Set(MAGE_ABILITIES.map((a) => a.id)),
  paladin: new Set(PALADIN_ABILITIES.map((a) => a.id)),
  hunter: new Set(HUNTER_ABILITIES.map((a) => a.id)),
  warlock: new Set(WARLOCK_ABILITIES.map((a) => a.id)),
  priest: new Set(PRIEST_ABILITIES.map((a) => a.id)),
  // A pet's three, which belong to no class: a Hunter cannot cast Claw.
  pet: new Set(PET_ABILITIES.map((a) => a.id)),
};

describe('every priority list names real abilities', () => {
  for (const list of ALL_PRIORITY_LISTS) {
    const known = OWNER_ABILITIES[list.owner];

    it(`${list.name} has no unresolvable id`, () => {
      const unknown = list.entries.map((e) => e.abilityId).filter((id) => !known.has(id));
      expect(unknown, `unresolvable in ${list.name}`).toEqual([]);
    });

    it(`${list.name} repeats no ability BELOW an unconditional copy of it`, () => {
      /*
       * A DUPLICATE IS ONLY A BUG WHEN THE EARLIER COPY IS UNCONDITIONAL, and
       * the first version of this test said "no ability twice" -- which was a
       * Warrior-only truth and failed two correct lists the moment it was
       * pointed at the other eight classes.
       *
       * Arcane Missiles appears twice in the Mage's list and Shadow Bolt twice
       * in the Warlock's, and BOTH ARE RIGHT: the upper copy is gated on a proc
       * -- Missile Barrage, Shadow Trance -- and the lower one is the filler
       * that runs when the proc is absent. Two entries, two different
       * decisions, and deleting either changes what the build casts.
       *
       * What IS unreachable is a copy below an UNGATED one, because the ungated
       * entry either fires or fails for a reason the copy shares. That is the
       * shape worth failing on, and it reads as a list one entry longer than it
       * really is.
       */
      const unreachable: string[] = [];
      const unconditional = new Set<string>();
      for (const entry of list.entries) {
        if (unconditional.has(entry.abilityId)) unreachable.push(entry.abilityId);
        if (!entry.condition) unconditional.add(entry.abilityId);
      }
      expect(unreachable, `unreachable duplicates in ${list.name}`).toEqual([]);
    });

    it(`${list.name} is not empty`, () => {
      // A list that lost its entries would read as a build with nothing to do.
      expect(list.entries.length).toBeGreaterThan(0);
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

/*
 * ============================================================================
 * WHICH LIST EACH PROFILE RUNS, pinned.
 *
 * The registry CLAIMS a mapping and `rotationFor` DECIDES one, and nothing
 * made the two agree. The Shockadin profile spent its whole life running a
 * list built around Seal of Command, a 21-point Retribution talent it does not
 * take -- so it cast no seal, could not Judge, and read 276.9 DPS against a
 * true 366.7 without erroring. A claim about which list a build runs is worth
 * exactly as much as a test on it.
 * ============================================================================
 */
describe('the 25 profiles and their lists', () => {
  for (const list of ALL_PRIORITY_LISTS) {
    // The pet's list is not selected by `rotationFor`; `createPet` assigns it.
    if (list.owner === 'pet') continue;

    for (const presetId of list.profiles) {
      it(`${presetId} runs ${list.name}`, () => {
        const preset = PRESETS_BY_ID.get(presetId);
        expect(preset, `no preset ${presetId}`).toBeDefined();
        const profile = preset!.build();
        /*
         * A PRESET SETS EVERY FIELD, which is the whole point of one -- five
         * settings have to agree, and a preset that inherited the style would
         * behave differently depending on what was on screen when it was
         * pressed. So an absent style is a broken preset, not a default.
         */
        expect(profile.character.combatStyle, `${presetId} sets no style`).toBeDefined();
        const rotation = rotationFor(
          profile.character.characterClass,
          profile.character.combatStyle!,
          profile.character.stance,
          profile.talents,
        );
        expect(rotation?.name).toBe(list.rotationName);
      });
    }
  }

  it('leaves no profile without a list', () => {
    /*
     * The other direction. A preset whose five settings reach no list at all
     * stands still for the whole fight -- which for a caster, with no auto
     * attack, is zero damage and no error.
     */
    const claimed = new Set(ALL_PRIORITY_LISTS.flatMap((list) => list.profiles));
    const unclaimed = PROFILE_PRESETS.map((p) => p.id).filter((id) => !claimed.has(id));
    expect(unclaimed).toEqual([]);
  });

  it('has exactly two lists no profile reaches, and they are the Warrior fallbacks', () => {
    /*
     * NOT DEAD CODE. `warriorRotation` falls through to these for a Warrior
     * whose style and stance match none of its three specific cases -- a
     * shield in Battle Stance, or a dual-wielder outside Berserker. The app
     * can build both; no preset offers either.
     *
     * Pinned so a THIRD unreached list has to be justified rather than
     * accumulating, and so deleting a preset shows up here.
     */
    const unreached = ALL_PRIORITY_LISTS.filter((list) => list.profiles.length === 0);
    expect(unreached.map((list) => list.name)).toEqual(['WARRIOR_BATTLE', 'WARRIOR_SHIELD']);
  });
});

/*
 * ============================================================================
 * AND THE ENUMERATION ITSELF, read off the source files.
 *
 * `ALL_PRIORITY_LISTS` is hand-written, and the four-out-of-twenty-six problem
 * above is what a hand-written list of lists does. Structural, so a tenth class
 * is covered by this file on the day its rotation lands rather than on the day
 * somebody remembers -- the same argument `classRegistration.test.ts` makes.
 * ============================================================================
 */
describe('the registry covers every list that exists', () => {
  it('names every exported priority list in src/game/rotations', () => {
    const directory = 'src/game/rotations';
    const exported: string[] = [];
    for (const file of readdirSync(directory)) {
      if (!file.endsWith('.ts')) continue;
      const source = readFileSync(`${directory}/${file}`, 'utf8');
      for (const match of source.matchAll(
        /export const ([A-Z_0-9]+): readonly PriorityEntry\[\]/g,
      )) {
        exported.push(match[1]);
      }
    }

    // Sorted, because the registry's own order is the order a list is WALKED
    // for the Warrior's shared segments and is not alphabetical.
    const registered = ALL_PRIORITY_LISTS.map((list) => list.name).sort();
    expect(exported.length).toBeGreaterThan(20);
    expect(registered).toEqual([...exported].sort());
  });
});
