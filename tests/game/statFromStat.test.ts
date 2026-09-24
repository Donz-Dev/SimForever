import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { flat } from '../../src/engine';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeTarget } from '../helpers/actors';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { statDerivationFor, withStatConversions } from '../../src/game/character';
import { WARRIOR_TALENT_EFFECTS } from '../../src/game/talents/warriorEffects';
import { ROGUE_TALENT_EFFECTS } from '../../src/game/talents/rogueEffects';
import { DRUID_TALENT_EFFECTS } from '../../src/game/talents/druidEffects';
import { SHAMAN_TALENT_EFFECTS } from '../../src/game/talents/shamanEffects';
import { MAGE_TALENT_EFFECTS } from '../../src/game/talents/mageEffects';
import { PALADIN_TALENT_EFFECTS } from '../../src/game/talents/paladinEffects';
import { HUNTER_TALENT_EFFECTS } from '../../src/game/talents/hunterEffects';
import { WARLOCK_TALENT_EFFECTS } from '../../src/game/talents/warlockEffects';
import { PRIEST_TALENT_EFFECTS } from '../../src/game/talents/priestEffects';

/*
 * ------------------------------------------------------------------------------
 * RULESET: "increases your Attack Power by 100% of your Intellect" is a stat
 * worth a fraction of ANOTHER stat.
 *
 * Six talents across five classes said this, in four directions, and none of
 * them could be expressed -- `stat` adds a flat amount or a percentage of the
 * SAME stat, and nothing crossed from one to another.
 *
 * A NEW DECLARATION RATHER THAN A NEW RULE, like `grantCastModifier` before
 * it. `StatBlock` already resolves in two passes so a derived stat sees fully
 * buffed primaries, and it already takes the derivation as an injected
 * function because which primary makes which secondary is game content. A
 * conversion is one more term in that function.
 *
 * EVERY EXPECTATION BELOW IS WRITTEN OUT BY HAND from the talent's own text,
 * never read back out of the source it is checking.
 * ------------------------------------------------------------------------------
 */

/** A live character with its talents applied and its opening auras up. */
function characterFor(preset: string, characterClass: string) {
  const built = PRESETS_BY_ID.get(preset)!.build();
  const actor = createPlayer({
    race: built.character.race as never,
    characterClass: characterClass as never,
    combatStyle: built.character.combatStyle as never,
    talents: built.talents,
  });
  buildSimulation([actor, makeTarget()]).advanceTo(0);
  return actor;
}

/**
 * An ungeared Hunter, optionally with Careful Aim at a rank.
 *
 * FIVE POINTS OF FILLER ALWAYS, whatever rank is asked for. Careful Aim sits
 * at tier 5 of Marksmanship, so `{ careful_aim: 1 }` on its own is an ILLEGAL
 * allocation that `createPlayer` strips -- and it strips it silently, which
 * read as "the talent is worth nothing at rank 1" until the tier was checked.
 * Lethal Attacks is tier 0 and opens the gate without touching attack power.
 */
function hunter(rank?: number) {
  return createPlayer({
    race: 'orc',
    characterClass: 'hunter',
    combatStyle: 'ranged',
    talents: { lethal_attacks: 5, ...(rank === undefined ? {} : { careful_aim: rank }) },
  });
}

describe('a stat worth a percentage of another stat', () => {
  it('gives a Hunter BOTH attack power pools, equal to its intellect', () => {
    /*
     * ------------------------------------------------------------------------
     * Careful Aim 5/5 is "+100% of your Intellect", and all three Hunter
     * profiles take it at full rank.
     *
     * BOTH POOLS, ON THE RULESET OWNER'S RULING. The wording alone pointed
     * the other way -- the talent says only "Attack Power", and Forever names
     * the ranged pool explicitly everywhere else it means it -- so this is
     * pinned to the ANSWER rather than to the reading, and it fails if
     * anybody later "corrects" it back to the melee half.
     *
     * Measured as a DIFFERENCE between two otherwise identical characters, so
     * the class table's own attack power never has to be restated here.
     * ------------------------------------------------------------------------
     */
    const withTalent = hunter(5);
    const without = hunter();

    const intellect = withTalent.stats.get('intellect');
    expect(intellect).toBeGreaterThan(0);

    for (const pool of ['attackPower', 'rangedAttackPower'] as const) {
      expect(withTalent.stats.get(pool) - without.stats.get(pool), pool).toBeCloseTo(
        intellect,
        6,
      );
    }
  });

  it('scales with the RANK, at the percentage the talent states', () => {
    // 20 / 40 / 60 / 80 / 100, per src/data/talents/values/hunter.json.
    const base = hunter().stats.get('attackPower');
    const rangedBase = hunter().stats.get('rangedAttackPower');
    const intellect = hunter().stats.get('intellect');

    const RANKS: ReadonlyArray<readonly [number, number]> = [
      [1, 20],
      [3, 60],
      [5, 100],
    ];

    for (const [rank, percent] of RANKS) {
      expect(hunter(rank).stats.get('attackPower') - base, `rank ${rank}`).toBeCloseTo(
        (intellect * percent) / 100,
        6,
      );
      // The ranged pool scales by the same rank, not a rank behind.
      expect(
        hunter(rank).stats.get('rangedAttackPower') - rangedBase,
        `rank ${rank} ranged`,
      ).toBeCloseTo((intellect * percent) / 100, 6);
    }
  });

  it('FOLLOWS the source stat when a buff moves it', () => {
    /*
     * ------------------------------------------------------------------------
     * THE WHOLE REASON THIS IS A DERIVATION AND NOT A NUMBER.
     *
     * Careful Aim has to track a buffed intellect the way the class table's
     * attack power already tracks a buffed strength. Resolving it once when
     * the character is built would freeze it at the unbuffed figure and still
     * produce a perfectly plausible attack power -- which is the mistake the
     * stat block's two-pass design exists to prevent.
     * ------------------------------------------------------------------------
     */
    const actor = hunter(5);
    const before = actor.stats.get('attackPower');

    actor.stats.addModifier({ ...flat('intellect', 100), sourceId: 'arcane_intellect' });
    expect(actor.stats.get('attackPower') - before).toBeCloseTo(100, 6);

    actor.stats.removeModifiersFrom('arcane_intellect');
    expect(actor.stats.get('attackPower')).toBeCloseTo(before, 6);
  });

  it('ADDS to the class table rather than replacing it', () => {
    /*
     * The Shaman's Mental Dexterity is attack power from intellect ON TOP OF
     * the attack power strength and agility already give. A conversion that
     * overwrote would silently delete the larger of the two and read as a nerf
     * nobody made.
     */
    const plain = statDerivationFor('shaman');
    const derivation = withStatConversions(plain, [
      { from: 'intellect', to: 'attackPower', fraction: 1 },
    ]);

    const primary = { strength: 100, agility: 50, stamina: 0, intellect: 80, spirit: 0 };
    const fromTable = plain(primary as never).attackPower ?? 0;

    expect(fromTable).toBeGreaterThan(0);
    expect(derivation(primary as never).attackPower).toBeCloseTo(fromTable + 80, 6);
  });

  it('reads the SECOND number when the talent states two', () => {
    /*
     * ------------------------------------------------------------------------
     * Spiritual Guidance 5/5 is "25% of your total Spirit" as HEALING and
     * "8% of your total Spirit" as spell DAMAGE -- two numbers in one row, and
     * the damage one is second.
     *
     * Taking the first would hand Shadow three times the spell power it earns
     * and would look entirely plausible, which is why this is pinned. Built
     * directly rather than from a preset: Spiritual Guidance is a HOLY talent
     * and the Shadow Priest profile does not take it.
     * ------------------------------------------------------------------------
     */
    expect(talentBuild('priest', { spiritual_guidance: 5 }).statConversions).toEqual([
      { from: 'spirit', to: 'spellPower', fraction: 0.08 },
    ]);
  });

  it('gives a character without the talent no conversion at all', () => {
    expect(talentBuild('hunter', {}).statConversions).toEqual([]);

    /*
     * The class table and nothing else. BASE PLUS DERIVED, because a Hunter
     * starts with 100 attack power of its own before a single point of
     * strength is converted -- comparing against the derivation alone read
     * 280 against 180 and looked like a conversion firing when none was.
     */
    const actor = hunter();
    const plain = statDerivationFor('hunter');
    expect(actor.stats.get('attackPower')).toBeCloseTo(
      actor.stats.baseStats.attackPower + (plain(actor.stats.effective).attackPower ?? 0),
      6,
    );
  });
});

describe('where it lands, and where it correctly does not', () => {
  it('reaches a Paladin seal that HAS a spell power term', () => {
    /*
     * ------------------------------------------------------------------------
     * Champion of the Light is spell power from intellect, and the ruleset
     * owner's seal formula is the one place in the project where spell power
     * reaches a melee build:
     *
     *     base + baseWeaponSpeed x (0.022 x attackPower + 0.044 x spellPower)
     *
     * Shockadin casts Seal of Righteousness, which uses it.
     * ------------------------------------------------------------------------
     */
    const shockadin = characterFor('pally_shockadin', 'paladin');
    expect(shockadin.stats.get('spellPower')).toBeCloseTo(shockadin.stats.get('intellect'), 6);
    expect(shockadin.abilities.has('seal_of_righteousness')).toBe(true);
  });

  it('is worth NOTHING to Seal Twist Ret, whose seals do not read it', () => {
    /*
     * ------------------------------------------------------------------------
     * A CORRECT TALENT CAN BE WORTH ZERO, and the handover named the wrong
     * build for this one: it said Retribution was "the first where it bites".
     * The mechanism was right and the build was not.
     *
     * Seal Twist Ret cycles Seal of the Crusader and Seal of Command, and
     * Seal of Command is 70% of WEAPON DAMAGE with no spell power term
     * anywhere. So the talent applies exactly as declared, the spell power is
     * really there, and the DPS figure does not move by a single decimal.
     *
     * Asserted on the MECHANISM -- that the stat arrives -- because a DPS test
     * here would have passed identically before the feature existed.
     * ------------------------------------------------------------------------
     */
    const ret = characterFor('pally_ret', 'paladin');
    expect(ret.stats.get('spellPower')).toBeCloseTo(ret.stats.get('intellect'), 6);
    expect(ret.abilities.has('seal_of_command')).toBe(true);
  });

  it('is correct and worth nothing to a Mage, who is never attacked', () => {
    /*
     * Arcane Resilience is ARMOR from intellect. It applies; no Mage profile
     * takes a hit, so it reduces nothing. Declared anyway, so a talent that
     * works and does not matter cannot be mistaken for one that cannot be
     * expressed.
     */
    expect(
      talentBuild('mage', PRESETS_BY_ID.get('mage_arcane')!.build().talents).statConversions,
    ).toEqual([{ from: 'intellect', to: 'armor', fraction: 0.5 }]);
  });
});

describe('what it retired', () => {
  const TABLES = {
    warrior: WARRIOR_TALENT_EFFECTS,
    rogue: ROGUE_TALENT_EFFECTS,
    druid: DRUID_TALENT_EFFECTS,
    shaman: SHAMAN_TALENT_EFFECTS,
    mage: MAGE_TALENT_EFFECTS,
    paladin: PALADIN_TALENT_EFFECTS,
    hunter: HUNTER_TALENT_EFFECTS,
    warlock: WARLOCK_TALENT_EFFECTS,
    priest: PRIEST_TALENT_EFFECTS,
  };

  it('leaves no talent claiming a stat cannot be derived from another', () => {
    /*
     * ------------------------------------------------------------------------
     * An `unmodelled` reason is a claim about the engine ON THE DAY IT WAS
     * WRITTEN, and it expires. This project has been caught by a stale one
     * three times, so the claim is matched by its WORDING rather than by a
     * list of ids -- a NEW class writing the same sentence is exactly the
     * thing worth catching.
     * ------------------------------------------------------------------------
     */
    const stale: string[] = [];
    for (const [characterClass, table] of Object.entries(TABLES)) {
      for (const [talentId, effects] of Object.entries(table)) {
        for (const effect of effects) {
          if (effect.kind !== 'unmodelled') continue;
          if (
            /percentage of (another|intellect|spirit)/i.test(effect.reason) ||
            /derived from (a|another)/i.test(effect.reason) ||
            /nothing crosses from one to another/i.test(effect.reason)
          ) {
            stale.push(`${characterClass}/${talentId}`);
          }
        }
      }
    }

    expect(stale).toEqual([]);
  });

  it('is declared by every class that had the gap', () => {
    // Five classes, six talents between them. Asserted so a declaration
    // removed by accident is a failure rather than a quiet loss.
    const expected: Readonly<Record<string, number>> = {
      hunter: 2, // Careful Aim, into BOTH attack power pools
      shaman: 2, // Mental Dexterity, Mental Quickness
      mage: 1, // Arcane Resilience
      paladin: 1, // Champion of the Light
      priest: 1, // Spiritual Guidance
    };

    for (const [characterClass, count] of Object.entries(expected)) {
      const declared = Object.values(TABLES[characterClass as keyof typeof TABLES])
        .flat()
        .filter((effect) => effect.kind === 'statFromStat');
      expect(declared.length, characterClass).toBe(count);
    }
  });

  it('only ever converts FROM a primary stat', () => {
    /*
     * The derivation is handed resolved PRIMARIES. A conversion reading a
     * DERIVED stat would need a third pass, would silently read zero today,
     * and nothing in the source asks for one. The type says so; this says so
     * where a reader is looking at the talents.
     */
    const PRIMARY = ['strength', 'agility', 'stamina', 'intellect', 'spirit'];

    for (const table of Object.values(TABLES)) {
      for (const effect of Object.values(table).flat()) {
        if (effect.kind !== 'statFromStat') continue;
        expect(PRIMARY).toContain(effect.from);
      }
    }
  });
});
