import { describe, expect, it } from 'vitest';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { runProfile } from '../../src/simulator';
import type { CharacterProfile } from '../../src/profiles';
import { sacrificedDemon } from '../../src/game/rotations/warlock';
import {
  DEMONIC_SACRIFICE_DAMAGE,
  demonicSacrificeAura,
} from '../../src/game/auras/warlock';
import {
  DEMON_FAMILY_IDS,
  PET_FAMILY_IDS,
  isDemonFamilyId,
} from '../../src/game/character/petFamilies';
import { sacrificesADemon } from '../../src/ui/panels/TalentPanel';

/*
 * ============================================================================
 * DOES THE 15% ACTUALLY LAND, AND DOES IT LAND ONLY WHERE IT SHOULD.
 *
 * The ruleset owner's ask, in their own words: "for SM/DS the Imp checkbox
 * would be checked -- ensure that this 15% shadow damage bonus is being
 * applied. For Firelock the Succubus checkbox would be checked -- ensure that
 * this 15% fire damage bonus is being applied."
 *
 * ASSERTED END TO END AND NOT ON THE CONSTANT. `DEMONIC_SACRIFICE_DAMAGE` has
 * read 1.15 since the aura was written, and a constant check cannot see an
 * aura that is applied and read by nothing -- which is the exact shape
 * Adrenaline Rush had for the life of the project while REPORTING 24.9%
 * uptime. The check that finds that one is "what is the buff supposed to
 * MOVE", so these run two real fights and divide.
 *
 * AND THE DENOMINATOR IS THE SAME BUILD WITH NO DEMON CHOSEN, which is the
 * control that makes the ratio mean something: `sacrificedDemon` returns
 * undefined for an absent `petFamily` and no aura is applied at all.
 * ============================================================================
 */

const SEEDS = 12;

/** Damage per ability, summed over several fights of one configuration. */
function perAbility(profile: CharacterProfile): ReadonlyMap<string, number> {
  const sums = new Map<string, number>();
  for (let i = 0; i < SEEDS; i += 1) {
    /*
     * THE SEED IS `runProfile`'S SECOND ARGUMENT AND NOT AN ENCOUNTER FIELD,
     * which is worth saying because the wrong version TYPECHECKS AS A TEST and
     * does not as source: an extra key on an object literal is only rejected
     * where the type is known, so a spread-and-override ran twelve identical
     * fights and the ratio looked perfect. The paired comparison would have
     * survived it; the sample size would not have.
     */
    const result = runProfile(profile, 700 + i);
    for (const actor of result.damage.byActor) {
      for (const ability of actor.abilities) {
        sums.set(ability.abilityName, (sums.get(ability.abilityName) ?? 0) + ability.total);
      }
    }
  }
  return sums;
}

const withoutDemon = (profile: CharacterProfile): CharacterProfile => ({
  ...profile,
  character: { ...profile.character, petFamily: undefined },
});

/**
 * The spells each build casts, split by whether the sacrifice's school names
 * them. WRITTEN OUT BY HAND rather than derived from the ability declarations,
 * which is this project's rule for a spec: a test that reads the source it is
 * checking passes whatever the source says.
 */
const SUBJECTS = [
  {
    preset: 'warlock_smds',
    demon: 'imp',
    school: 'shadow',
    amplified: ['Wrack', 'Corruption', 'Bane of Agony', 'Siphon Life', 'Shadow Bolt'],
    /*
     * TOUCH OF THE GRAVE IS SHADOW AND IS CORRECTLY NOT AMPLIFIED, which is
     * the one row here that looks like a bug and is a ruling. It declares
     * `ignoresAttackerDamageScaling`, because the owner's text is "only scales
     * off your hit points" -- so the CASTER'S Shadow Mastery, Shadow Weaving
     * and this sacrifice all stop at it, while a debuff on the TARGET still
     * raises it. Pinned here because a reader checking "all Shadow damage went
     * up 15%" would otherwise file this as a miss.
     */
    untouched: ['Touch of the Grave'],
  },
  {
    preset: 'warlock_firelock',
    demon: 'succubus',
    school: 'fire',
    amplified: ['Incinerate', 'Immolate', 'Conflagrate'],
    // Shadowburn is a SHADOW spell on a Fire build, which is the half that
    // proves the buff is school-scoped rather than whole-character. That
    // distinction was worth -55.3 DPS when it was got wrong on this profile.
    untouched: ['Shadowburn', 'Touch of the Grave'],
  },
] as const;

describe('Demonic Sacrifice, applied end to end', () => {
  for (const subject of SUBJECTS) {
    it(`gives ${subject.preset} exactly 15% more ${subject.school} damage`, () => {
      const profile = PRESETS_BY_ID.get(subject.preset)!.build();
      expect(profile.character.petFamily, 'the preset must choose a demon').toBe(subject.demon);
      expect(sacrificedDemon(profile.talents ?? {}, profile.character.petFamily)).toBe(
        subject.demon,
      );

      const withIt = perAbility(profile);
      const without = perAbility(withoutDemon(profile));

      for (const name of subject.amplified) {
        const after = withIt.get(name) ?? 0;
        const before = without.get(name) ?? 0;
        // A row that deals nothing would pass any ratio, so it has to be real.
        expect(before, name).toBeGreaterThan(0);
        expect(after / before, name).toBeCloseTo(DEMONIC_SACRIFICE_DAMAGE, 4);
      }

      for (const name of subject.untouched) {
        const after = withIt.get(name) ?? 0;
        const before = without.get(name) ?? 0;
        expect(before, name).toBeGreaterThan(0);
        expect(after / before, name).toBeCloseTo(1, 4);
      }
    });

    it(`names the one school on ${subject.preset}'s aura and no other`, () => {
      const aura = demonicSacrificeAura(subject.demon)!;
      expect(aura.damageDoneBySchool).toEqual({ [subject.school]: DEMONIC_SACRIFICE_DAMAGE });
    });
  }

  it('applies nothing at all when no demon has been chosen', () => {
    /*
     * THE ASYMMETRY `validateProfile` ALREADY RECORDS, pinned where it is
     * reached. A profile with no `petFamily` gets no buff rather than a
     * default one -- which is why the chooser shows nothing selected instead
     * of pre-selecting the Imp, and why losing the field on load cost both
     * Warlock presets 15% of a school in silence.
     */
    const profile = PRESETS_BY_ID.get('warlock_smds')!.build();
    expect(sacrificedDemon(profile.talents ?? {}, undefined)).toBeUndefined();
  });

  it('gives the other two demons nothing, and says why', () => {
    // Mana and health, neither of which moves a damage figure for a profile
    // nothing attacks. An absent aura rather than an empty one, so there is no
    // uptime row claiming a buff that does nothing.
    expect(demonicSacrificeAura('voidwalker')).toBeUndefined();
    expect(demonicSacrificeAura('felhunter')).toBeUndefined();
  });
});

describe('which demon the chooser offers, and when', () => {
  it('shows only for a Warlock that actually took the talent', () => {
    expect(sacrificesADemon('warlock', { demonic_sacrifice: 1 })).toBe(true);
    expect(sacrificesADemon('warlock', {})).toBe(false);
    /*
     * NOT `bringsPet` INVERTED, which is the near miss: a Lone Wolf Hunter
     * also brings no pet and has no demon to choose.
     */
    expect(sacrificesADemon('hunter', { lone_wolf: 1 })).toBe(false);
    expect(sacrificesADemon('mage', { demonic_sacrifice: 1 })).toBe(false);
  });

  it('offers the four demons, derived from the one family list', () => {
    /*
     * THE SET IS COMPARED RATHER THAN WRITTEN OUT TWICE -- the structural
     * argument `rotationIds.test.ts` makes. A fifth demon added to
     * `PET_FAMILY_IDS` has to be classified rather than silently joining the
     * Hunter's list.
     */
    expect([...DEMON_FAMILY_IDS].sort()).toEqual(
      ['felhunter', 'imp', 'succubus', 'voidwalker'],
    );
    for (const demon of DEMON_FAMILY_IDS) {
      expect(PET_FAMILY_IDS as readonly string[], demon).toContain(demon);
    }
    // And no Hunter family answers to the demon test.
    for (const family of ['cat', 'wolf', 'bear', 'raptor', 'boar']) {
      expect(isDemonFamilyId(family), family).toBe(false);
    }
  });

  it('covers every family between the two lists, so none is unreachable', () => {
    /*
     * A FAMILY IN NEITHER CHOOSER CANNOT BE PICKED AT ALL, which is a filter
     * bug -- the kind that leaves nothing behind to notice, because a missing
     * option and an option that was never written look identical.
     */
    const hunterFamilies = PET_FAMILY_IDS.filter((id) => !isDemonFamilyId(id));
    expect(hunterFamilies.length + DEMON_FAMILY_IDS.length).toBe(PET_FAMILY_IDS.length);
  });
});
