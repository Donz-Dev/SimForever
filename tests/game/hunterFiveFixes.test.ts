import { describe, expect, it } from 'vitest';
import { Simulation, applyHaste, hasteMultiplierFrom, toSeconds } from '../../src/engine';
import type { TelemetryEvent } from '../../src/engine';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { characterAtCombatStart } from '../../src/simulator';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import {
  HUNTER_BEAST_MASTERY,
  HUNTER_LONE_WOLF_MELEE,
  HUNTER_LONE_WOLF_RANGED,
  hunterRotation,
} from '../../src/game/rotations/hunter';
import { DRUID_ABILITIES } from '../../src/game/abilities/druid';
import { HUNTER_ABILITIES } from '../../src/game/abilities/hunter';
import { MAGE_ABILITIES } from '../../src/game/abilities/mage';
import { PALADIN_ABILITIES } from '../../src/game/abilities/paladin';
import { PRIEST_ABILITIES } from '../../src/game/abilities/priest';
import { ROGUE_ABILITIES } from '../../src/game/abilities/rogue';
import { SHAMAN_ABILITIES } from '../../src/game/abilities/shaman';
import { WARLOCK_ABILITIES } from '../../src/game/abilities/warlock';
import { WARRIOR_ABILITIES } from '../../src/game/abilities/warrior';
import { TALENT_AURAS } from '../../src/game/auras/talentAuras';
import { LONE_WOLF, LONE_WOLF_DAMAGE } from '../../src/game/auras/hunter';
import { HUNTER_TALENT_EFFECTS } from '../../src/game/talents/hunterEffects';
import { WARRIOR_TALENT_EFFECTS } from '../../src/game/talents/warriorEffects';
import { ROGUE_TALENT_EFFECTS } from '../../src/game/talents/rogueEffects';
import { DRUID_TALENT_EFFECTS } from '../../src/game/talents/druidEffects';
import { SHAMAN_TALENT_EFFECTS } from '../../src/game/talents/shamanEffects';
import { MAGE_TALENT_EFFECTS } from '../../src/game/talents/mageEffects';
import { PALADIN_TALENT_EFFECTS } from '../../src/game/talents/paladinEffects';
import { WARLOCK_TALENT_EFFECTS } from '../../src/game/talents/warlockEffects';
import { PRIEST_TALENT_EFFECTS } from '../../src/game/talents/priestEffects';
import { deadlyAspects } from '../../src/game/reactions/hunterTalents';
import {
  ASPECT_OF_THE_HAWK,
  DEADLY_ASPECTS,
  DEADLY_ASPECTS_DURATION_MS,
  DEADLY_ASPECTS_HASTE_PERCENT,
} from '../../src/game/auras/hunter';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ------------------------------------------------------------------------------
 * FIVE THINGS THE RULESET OWNER REPORTED ON 2026-10-07, and three of them had
 * never worked at all rather than working wrongly. What they have in common is
 * that every one produced a PLAUSIBLE figure: a Hunter without its 20%, without
 * a haste proc and without a hawk is still a Hunter doing Hunter damage.
 * ------------------------------------------------------------------------------
 */

describe('Lone Wolf grants the 20% it is named for', () => {
  it('resolves through TALENT_AURAS, which is a FIFTH registration site', () => {
    /*
     * ------------------------------------------------------------------------
     * `grantAura` LOOKS ITS ID UP IN `TALENT_AURAS` AND `createPlayer` DROPS
     * WHAT IT CANNOT FIND -- deliberately, so "a typo should show up as a
     * talent that visibly does nothing, not as a character that cannot be
     * built". `lone_wolf` was never registered, so both Lone Wolf profiles went
     * the whole project without the 20% damage the talent they are NAMED AFTER
     * grants, and nothing errored.
     *
     * CLAUDE.md lists FOUR places a class is registered. This is a fifth, and
     * the test below is the structural version of noticing.
     * ------------------------------------------------------------------------
     */
    expect(TALENT_AURAS.lone_wolf).toBe(LONE_WOLF);
    expect(LONE_WOLF_DAMAGE).toBe(1.2);
  });

  it('reaches both Lone Wolf profiles and neither other Hunter', () => {
    const lw = ['lw_ranged', 'lw_melee'] as const;
    for (const id of lw) {
      const profile = PRESETS_BY_ID.get(id)!.build();
      expect(profile.talents.lone_wolf).toBe(1);
      const actor = characterAtCombatStart(profile)!;
      expect(actor.auras.has('lone_wolf')).toBe(true);
    }

    // Beast Mastery takes a pet instead, so it must NOT have it.
    const bm = characterAtCombatStart(PRESETS_BY_ID.get('bm_hunter')!.build())!;
    expect(bm.auras.has('lone_wolf')).toBe(false);
  });

  it('multiplies damage done, which is what the aura carries', () => {
    const before = characterAtCombatStart(PRESETS_BY_ID.get('bm_hunter')!.build())!;
    const after = characterAtCombatStart(PRESETS_BY_ID.get('lw_ranged')!.build())!;
    /*
     * ASSERTED AS A RATIO AGAINST THE PROFILE'S OWN OTHER MULTIPLIERS rather
     * than as 1.2 flat: both builds carry Focused Fire or Improved Tracking on
     * top, so the absolute figure is not the talent's alone.
     */
    expect(after.damageDoneMultiplier).toBeGreaterThan(before.damageDoneMultiplier);
    expect(after.damageDoneMultiplier).toBeCloseTo(1.05 * LONE_WOLF_DAMAGE, 10);
  });

  it('fails if ANY talent grants an aura nothing defines', () => {
    /*
     * ------------------------------------------------------------------------
     * THE STRUCTURAL CHECK, because `lone_wolf` was not a typo -- it was a
     * registration nobody made, and the silent drop is by design. Every
     * `grantAura` id across all nine classes must resolve.
     *
     * ONE EXEMPTION, with its reason, the way `everySpellScales.test.ts` keeps
     * its two.
     * ------------------------------------------------------------------------
     */
    const EXEMPT: Readonly<Record<string, string>> = {
      /*
       * The Warlock's sacrifice buff depends on WHICH DEMON was sacrificed --
       * `demonic_sacrifice_imp` is Shadow and `demonic_sacrifice_succubus` is
       * Fire -- so no single id names it. `trainingDummyEncounter` applies the
       * right one from the profile's `petFamily`, which is why both Warlock
       * profiles have always had their 15% despite this id resolving to
       * nothing. The declaration is a dead no-op rather than a bug, and is left
       * alone here rather than edited from a Hunter change.
       */
      demonic_sacrifice: 'Applied per demon by the encounter, so no one id names it.',
      /*
       * Demonic Pact changes WHEN the sacrifice buff stands -- a different demon
       * out no longer cancels it -- and that rule is `sacrificedDemon`, applied
       * by the encounter beside Demonic Sacrifice itself. Same shape, same reason.
       */
      demonic_pact: 'Applied by the encounter, through sacrificedDemon.',
    };

    /*
     * ALL NINE, LISTED HERE, because `talentBuild`'s own EFFECTS table is
     * private. Enumerating by hand decays -- `rotationIds.test.ts` was checking
     * four of twenty-six lists before anyone noticed -- so the count is
     * asserted too, and a tenth class fails this before it fails anything else.
     */
    const ALL = [
      WARRIOR_TALENT_EFFECTS, ROGUE_TALENT_EFFECTS, DRUID_TALENT_EFFECTS,
      SHAMAN_TALENT_EFFECTS, MAGE_TALENT_EFFECTS, PALADIN_TALENT_EFFECTS,
      HUNTER_TALENT_EFFECTS, WARLOCK_TALENT_EFFECTS, PRIEST_TALENT_EFFECTS,
    ];
    expect(ALL).toHaveLength(9);

    const missing: string[] = [];
    for (const effects of ALL) {
      for (const [talentId, list] of Object.entries(effects)) {
        for (const effect of list) {
          if (effect.kind !== 'grantAura') continue;
          if (effect.auraId in EXEMPT) continue;
          if (!TALENT_AURAS[effect.auraId]) missing.push(`${talentId} -> ${effect.auraId}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('fails if ANY talent grants an ABILITY nothing declares', () => {
    /*
     * ==========================================================================
     * THE SIBLING GUARD, AND IT WAS MISSING UNTIL A TALENT FELL THROUGH IT.
     *
     * The check above covers `grantAura`, which was written the day `lone_wolf`
     * turned out never to have been registered. `grantAbility` has the SAME
     * shape and the same silent drop -- `abilitiesForBuild` adds the granted id
     * if the class declares an ability with it and does nothing otherwise -- and
     * nothing asked.
     *
     * ARCANE WRATH IS WHY IT EXISTS NOW. Client build 1.60.1.70425 added the
     * talent, it was declared here as `grantAbility: 'arcane_wrath'`, and the
     * ABILITY was not written: the full suite went green with a talent that
     * grants a spell no Mage can cast. **The same failure as `lone_wolf`, on
     * the sibling effect kind, caught the same way.**
     *
     * IT READS EACH CLASS'S `*_ABILITIES` TABLE AND NOT `abilitiesForClass`,
     * which is the distinction that makes the check mean anything: that
     * function STRIPS a talent-granted ability unless the allocation it is
     * handed earns it, so asking it with no talents reported 56 perfectly
     * well-declared abilities as missing -- Mortal Strike, Bloodthirst, Shield
     * Slam and every other capstone in the project. The DECLARATION table is
     * the thing this test is about.
     *
     * AND NOT A BUILT CHARACTER EITHER, which would make this a test about
     * which talents the presets happen to take -- the dependency
     * `grantCastModifier`'s own note warns about and five tests have already
     * been bitten by.
     * ==========================================================================
     */
    const CLASSES = [
      ['warrior', WARRIOR_TALENT_EFFECTS, WARRIOR_ABILITIES],
      ['rogue', ROGUE_TALENT_EFFECTS, ROGUE_ABILITIES],
      ['druid', DRUID_TALENT_EFFECTS, DRUID_ABILITIES],
      ['shaman', SHAMAN_TALENT_EFFECTS, SHAMAN_ABILITIES],
      ['mage', MAGE_TALENT_EFFECTS, MAGE_ABILITIES],
      ['paladin', PALADIN_TALENT_EFFECTS, PALADIN_ABILITIES],
      ['hunter', HUNTER_TALENT_EFFECTS, HUNTER_ABILITIES],
      ['warlock', WARLOCK_TALENT_EFFECTS, WARLOCK_ABILITIES],
      ['priest', PRIEST_TALENT_EFFECTS, PRIEST_ABILITIES],
    ] as const;
    expect(CLASSES).toHaveLength(9);

    /*
     * ONE EXEMPTION, WITH ITS REASON, the way the `grantAura` check above keeps
     * Demonic Sacrifice -- and this one is an OWNER RULING rather than a
     * structural quirk, which is the stronger kind.
     *
     * "Concussion Blow is still not to be implemented. No note about this needs
     * to be made on the GUI." So the talent deliberately carries NO
     * `unmodelled` entry and deliberately grants an ability no class declares:
     * the stun is out of scope and there is nothing for a reader to act on.
     * `chargeAndShieldTalents.test.ts` pins that exact shape, so rewriting the
     * talent to satisfy this check would have put a note on the GUI the owner
     * said not to put there -- which is what happened, and that test caught it.
     *
     * PIERCING HOWL IS NOT EXEMPT AND WAS FIXED INSTEAD, which is the
     * distinction worth having both entries for: it carried the same dead
     * `grantAbility` NEXT TO an `unmodelled` entry saying the ability will never
     * exist, so the two effects contradicted each other and one of them had to
     * go. Concussion Blow's silence is the ruling; Piercing Howl's grant was
     * just left behind.
     */
    const EXEMPT_ABILITIES: Readonly<Record<string, string>> = {
      concussion_blow: "The owner's ruling: not to be implemented, and no GUI note.",
    };

    const undeclared: string[] = [];
    for (const [classId, effects, abilities] of CLASSES) {
      const declared = new Set(abilities.map((ability) => ability.id));
      for (const [talentId, list] of Object.entries(effects)) {
        for (const effect of list) {
          if (effect.kind !== 'grantAbility') continue;
          if (effect.abilityId in EXEMPT_ABILITIES) continue;
          if (!declared.has(effect.abilityId)) {
            undeclared.push(`${classId}/${talentId} -> ${effect.abilityId}`);
          }
        }
      }
    }
    expect(undeclared).toEqual([]);
  });
});

describe('Deadly Aspects fires from Auto Shot', () => {
  it('rolls on a RANGED auto-attack, which it never could', () => {
    /*
     * ------------------------------------------------------------------------
     * IT ASKED `isWeaponUseOf(attack, 'ranged')`, WHICH IS ALWAYS FALSE.
     * `isWeaponUse` means "a use of a MELEE weapon" -- Thunder Clap and Charge
     * declare `weaponSlot: 'ranged'` precisely so it excludes them -- so the
     * Hawk half of this talent had never fired once. 403 ranged swings over
     * twenty fights produced ZERO procs of a stated 10%.
     *
     * `isWeaponUseOf` no longer ACCEPTS a ranged slot: the parameter is
     * `MeleeWeaponSlot`, so the question is refused at compile time instead of
     * answered wrongly.
     * ------------------------------------------------------------------------
     */
    const reaction = deadlyAspects(100);
    const simulation = buildSimulation([makeAttacker(), makeTarget()]);
    const [actor, target] = simulation.combatants;
    simulation.begin();
    simulation.applyAura(actor, ASPECT_OF_THE_HAWK, actor.id);

    const swing = (weaponSlot: 'mainHand' | 'offHand' | 'ranged') => ({
      attacker: actor,
      defender: target,
      outcome: 'hit' as const,
      abilityId: undefined,
      abilityName: 'Auto-Attack',
      amount: 100,
      weaponSlot,
      critical: false,
    });

    expect(reaction.canTrigger!(simulation, actor, swing('ranged'))).toBe(true);
    // Aspect of the HAWK is up, so a melee swing is the other clause's business.
    expect(reaction.canTrigger!(simulation, actor, swing('mainHand'))).toBe(false);
  });

  it('makes the bow 30% faster for 12 seconds, which is the point of it', () => {
    /*
     * ------------------------------------------------------------------------
     * FIRING IS NOT THE SAME AS WORKING, and the test above only proves the
     * first. "increasing ranged attack speed by 30% for 12 sec" is the EFFECT,
     * and a proc that fired correctly into an aura carrying the wrong haste --
     * or into one the ranged swing timer never read -- would look identical in
     * a proc count.
     *
     * ASSERTED AS A RATIO ON THE RESOLVED SWING, so it holds whatever the bow
     * and whatever the quiver do to it: the aura has to make the NEXT swing
     * 1.30x faster than the one before it.
     * ------------------------------------------------------------------------
     */
    const hunter = characterAtCombatStart(PRESETS_BY_ID.get('lw_ranged')!.build())!;
    const bow = hunter.weapons.ranged!;

    const simulation = buildSimulation([hunter, makeTarget()]);
    simulation.begin();

    const before = applyHaste(bow.swingTimerMs, hasteMultiplierFrom(hunter.stats.effective));
    simulation.applyAura(hunter, DEADLY_ASPECTS, hunter.id);
    const after = applyHaste(bow.swingTimerMs, hasteMultiplierFrom(hunter.stats.effective));

    expect(hunter.auras.has('deadly_aspects')).toBe(true);
    expect(DEADLY_ASPECTS_HASTE_PERCENT).toBe(30);
    expect(toSeconds(DEADLY_ASPECTS_DURATION_MS)).toBe(12);

    expect(after).toBeLessThan(before);
    expect(before / after).toBeCloseTo(1.3, 2);
  });

  it('procs in a real fight at the rate the talent states', () => {
    const profile = PRESETS_BY_ID.get('lw_ranged')!.build();
    expect(profile.talents.deadly_aspects).toBe(5);

    let swings = 0;
    let procs = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      const events: TelemetryEvent[] = [];
      const simulation = new Simulation({ ...trainingDummyEncounter(profile), seed }, {
        emit: (event: TelemetryEvent) => events.push(event),
      } as never);
      const run = simulation.run();
      const player = run.actors.find((actor) => actor.faction === 'friendly')!;
      for (const event of events) {
        if (
          event.type === 'damage' &&
          event.sourceId === player.id &&
          event.abilityName === 'Ranged Auto-Attack' &&
          event.amount > 0
        ) {
          swings += 1;
        }
        const auraId = (event as { auraId?: string }).auraId;
        if (
          (event.type === 'aura_applied' || event.type === 'aura_refreshed') &&
          auraId === 'deadly_aspects'
        ) {
          procs += 1;
        }
      }
    }

    // It used to be exactly zero, whatever the sample.
    expect(procs).toBeGreaterThan(0);
    // And at the stated 10% of landed shots, with room for twenty fights' noise.
    expect(procs / swings).toBeGreaterThan(0.05);
    expect(procs / swings).toBeLessThan(0.16);
  });
});

describe('Summon Hawk survives dropping Bestial Wrath', () => {
  it('lands in the ranged list, which the owner has since taken the hawk out of', () => {
    /*
     * ------------------------------------------------------------------------
     * `hunterRotation` dispatches on `bestial_wrath`, the 31-point capstone,
     * and `summon_hawk` is a 5-point talent five rows above it. So a build that
     * took Summon Hawk and NOT Bestial Wrath fell through to the ranged list,
     * which had no hawk entry, and silently stopped casting an ability it had
     * paid for.
     * ------------------------------------------------------------------------
     */
    const bm = PRESETS_BY_ID.get('bm_hunter')!.build();
    const without = { ...bm.talents };
    delete (without as Record<string, number>).bestial_wrath;

    expect(hunterRotation(bm.character.combatStyle, bm.talents)?.name).toMatch(/Beast Mastery/);
    expect(hunterRotation(bm.character.combatStyle, without)?.name).toMatch(/Lone Wolf Ranged/);

    /*
     * THE RANGED LIST CARRIED THE HAWK FOR THIS REASON, AND THE OWNER REMOVED IT
     * at round 37: "Remove Summon Hawk from the combat APL" on MM Hunter, which is
     * the profile that list serves. So such a build stops casting it by RULING
     * now, where before it stopped by accident -- and the BM list keeps it.
     */
    expect(HUNTER_BEAST_MASTERY.entries.map((entry) => entry.abilityId)).toContain('summon_hawk');
    expect(HUNTER_LONE_WOLF_RANGED.entries.map((entry) => entry.abilityId)).not.toContain(
      'summon_hawk',
    );
  });

  it('is silent for the profile that does not take it', () => {
    /*
     * "AN ABILITY A LIST ASKS FOR AND THE BUILD DOES NOT HAVE IS SILENT", which
     * is what lets one list serve several builds -- and is why adding the entry
     * is the fix rather than a second dispatch rule. LW Ranged does not take
     * Summon Hawk, so its figure does not move by a decimal.
     */
    const profile = PRESETS_BY_ID.get('lw_ranged')!.build();
    expect(profile.talents.summon_hawk ?? 0).toBe(0);
    const book = characterAtCombatStart(profile)!.abilities.all.map((a) => a.id);
    expect(book).not.toContain('summon_hawk');
  });

  it('leaves the melee list alone, which does not shoot', () => {
    expect(HUNTER_LONE_WOLF_MELEE.entries.map((entry) => entry.abilityId)).not.toContain('summon_hawk');
    expect(HUNTER_TALENT_EFFECTS.summon_hawk).toContainEqual({
      kind: 'grantAbility',
      abilityId: 'summon_hawk',
    });
  });
});
