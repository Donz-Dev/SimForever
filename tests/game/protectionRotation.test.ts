import { describe, expect, it } from 'vitest';
import { stanceCastsOutsideExecute } from '../helpers/stanceCasts';
import { characterAtCombatStart, runProfileBatch } from '../../src/simulator';
import { startingEquipmentFor } from '../../src/game/items/startingSets';
import { createDefaultProfile } from '../../src/profiles';
import {
  DEFENSIVE_EMERGENCY_HEALTH,
  WARRIOR_SHIELD_DEFENSIVE,
} from '../../src/game/rotations/warrior';
import { Simulation } from '../../src/engine';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import {
  DEMORALIZING_SHOUT,
  DEMORALIZING_SHOUT_ATTACK_POWER,
  LAST_STAND,
} from '../../src/game/auras/warrior';
import { bossMeleeWeapon } from '../../src/game/encounters/raidBoss';
import { legalise } from '../helpers/legalTalents';
import type { AplCondition } from '../../src/game/rotations/apl';
import { compileCondition } from '../../src/game/rotations/apl';
import { MID_FIGHT_CONSUMABLE_ABILITIES } from '../../src/game/abilities/consumables';

/*
 * A condition is DATA now. `compileCondition` turns one back into the closure
 * the engine runs, which is what these assertions have always been calling --
 * the step used to be implicit because a list held closures directly.
 */
const compiled = (condition: AplCondition | undefined) =>
  condition ? compileCondition(condition) : undefined;

/*
 * The Protection priority list, in the ruleset owner's order.
 *
 *   1  Defensive Stance     not already in it
 *   2  Last Stand           health < 30%
 *   3  Shield Wall          health < 30%, Last Stand neither active nor ready
 *   4  Battle Shout         not active
 *   5  Bloodrage            rage < 50
 *   6  Sunder Armor         below 5 stacks, or running out
 *   7  Demoralizing Shout   not on the target
 *   8  Heroic Strike        rage >= 26
 *   9  Shield Block         whenever it is off cooldown
 *  10  Revenge              window-gated
 *  11  Shield Slam          talent-gated
 *  12  Thunder Clap
 *  13  Rend                 not on the target
 *
 * The order is written out here by hand, because the ORDER is the thing being
 * specified. A test that read it from the list would pass whatever the list
 * said.
 *
 * ============================================================================
 * FOUR THINGS MOVED WHEN THE OWNER RESPECIFIED IT, and one of them overturns
 * an argument this file used to make rather than filling a gap:
 *
 *   - DEFENSIVE STANCE to SECOND, above the two survival cooldowns. This file
 *     asserted the opposite and gave a reason -- "above even the stance,
 *     because a dead tank is in no stance at all". The decision was ours and
 *     is the owner's now, and it costs nothing either way: the entry is gated
 *     on the stance having RUN OUT, so it fires once at the pull, where the
 *     tank is at full health and both cooldowns below it are refused anyway.
 *   - BLOODRAGE below Battle Shout, from two entries above it.
 *   - THE MID-FIGHT CONSUMABLES from LAST to tenth, which splits them from the
 *     racials they used to share a position and an argument with.
 *   - REVENGE above Shield Slam, which is the one swap here that both entries
 *     can actually contest.
 * ============================================================================
 */
const EXPECTED_ORDER = [
  // Added on the ruleset owner's instruction: once, at the pull, and only
  /*
   * ==========================================================================
   * THREE IDS LEFT THIS ARRAY AND WENT BEFORE THE PULL: `charge`,
   * `defensive_stance_cast` and `battle_shout_cast`. The owner's instruction
   * with the 28 openers -- "Charge, Defensive Stance, and Battle Shout should
   * be removed from the normal APL."
   *
   * THE FIRST TWO USED TO OPEN THIS LIST and the file carried an argument for
   * why they were above the survival cooldowns: their windows are single
   * instants and they take no global cooldown, so neither could delay Last
   * Stand. That argument is now moot rather than wrong -- `runPrecombat` is
   * not on the fight's clock at all, which is a stronger version of the same
   * claim.
   *
   * **AND THE CHARGE GATE SURVIVES WITH NO CONDITION.** It needed a builtin
   * here, because `PriorityRotation` would otherwise have cast a stance change
   * to unblock the entry and dragged the tank into Battle Stance at the pull.
   * A pre-combat cast has no rotation attached, so `castAbility`'s ordinary
   * stance check is the whole of it -- and VANGUARD is still what makes it
   * work, by adding Defensive to this character's own copy of Charge.
   * ==========================================================================
   */
  'last_stand',
  'shield_wall_cast',
  /*
   * THE TWO CONSUMABLE HEALS, WITH THE SURVIVAL COOLDOWNS RATHER THAN WITH THE
   * OTHER FREE ENTRIES AT THE BOTTOM.
   *
   * This is the one place the tank list's "free entries go last" rule is
   * deliberately NOT followed, and the reason is the rule's own argument read
   * the other way: the bottom of a tank list is a place entries are not
   * REACHED. A Protection warrior caps its rage, so something above is nearly
   * always castable -- which is how five of seven racials came back inert when
   * they were tried at the bottom. A healing potion that is never reached is a
   * healing potion that does nothing.
   *
   * They sit BELOW Last Stand and Shield Wall because those are the bigger
   * answer to the same question, and the cheaper one should not be spent first.
   */
  'major_healing_potion',
  'healthstone',
  'bloodrage_cast',
  // The owner's tank Execute clause: Battle Stance and Execute in the last 20%.
  'execute',
  'sunder_armor_cast',
  'demoralizing_shout_cast',
  /*
   * THE MID-FIGHT CONSUMABLES, TENTH, AND NO LONGER WITH THE RACIALS.
   *
   * --------------------------------------------------------------------------
   * THEY SHARED A POSITION AND AN ARGUMENT -- "100ms is not free to a tank at
   * thirty percent health" -- and the owner has now priced that 100ms against
   * the two entries differently. A racial is FREE; a Mighty Rage Potion is
   * 45-75 rage and 60 strength on a two minute cooldown.
   *
   * It is the same move the two HEALS already got, and for the same stated
   * reason: the bottom of a tank list is a place entries are not REACHED, so
   * an entry that is never reached is worth none of what it grants.
   *
   * Written out rather than spread, like the racials below and for the same
   * reason -- the ORDER is what this constant specifies.
   * --------------------------------------------------------------------------
   */
  'major_mana_potion',
  'demonic_rune',
  'thistle_tea',
  'mighty_rage_potion',
  'major_frenzy_potion',
  'major_spellblasting_potion',
  'heroic_strike',
  'shield_block_cast',
  /*
   * REVENGE ABOVE SHIELD SLAM, where the two were the other way round. The one
   * swap in this list that both entries can contest -- and it is cheap because
   * Revenge is gated on a window that closes by itself, so it yields to Shield
   * Slam whenever the window is shut.
   */
  'revenge',
  'shield_slam',
  'thunder_clap',
  'rend_cast',
  /*
   * AND THE RACIAL COOLDOWNS, WHICH A TANK LIST PUTS LAST.
   *
   * Every other list carries them SECOND, high enough to fire and below
   * whatever opens the list. A tank list is the exception and for the reason
   * this file already states about Charge: an entry above a survival cooldown
   * "would cost a survival cooldown the moment it was needed", and casting a
   * free off-GCD ability still moves the next decision 100ms out.
   *
   * Written out here rather than spread from `RACIAL_COOLDOWNS`, because the
   * ORDER is what this constant specifies and a spread would pass whatever
   * that constant said -- the same reason the thirteen above are written out.
   */
  'blood_fury',
  'berserking',
  'elunes_light',
  'eureka',
  'stoneform',
];

/**
 * An entry by its ability id, never by its index.
 *
 * Three tests reached into this list positionally and all three broke the
 * moment Charge was inserted at the top -- an insertion three entries away
 * from anything they were testing. The id is what each of them actually means.
 */
function entryFor(abilityId: string) {
  const found = WARRIOR_SHIELD_DEFENSIVE.entries.find((e) => e.abilityId === abilityId);
  if (!found) throw new Error(`${abilityId} is not in the Protection list`);
  return found;
}

/*
 * A 31-point Protection build that actually reaches Last Stand.
 *
 * LAST STAND REQUIRES 2/2 IMPROVED BLOODRAGE, which is easy to miss and fails
 * silently: `legalAllocation` strips the talent, `grantAbility` never fires,
 * and the entry is skipped by an id that resolves to nothing the character
 * knows. Measured as zero casts the first time, which reads exactly like an
 * entry that never wins its slot.
 */
const PROTECTION_31 = {
  shield_specialization: 5,
  anticipation: 5,
  improved_bloodrage: 2,
  toughness: 3,
  improved_thunder_clap: 3,
  last_stand: 1,
  improved_revenge: 3,
  defiance: 3,
  improved_sunder_armor: 3,
  concussion_blow: 1,
  bastion: 1,
  shield_slam: 1,
};

function tank(talents: Record<string, number> = {}, iterations = 200) {
  const base = createDefaultProfile();
  return {
    ...base,
    character: {
      ...base.character,
      race: 'tauren',
      combatStyle: 'one_hand_shield',
      stance: 'defensive',
    },
    equipment: startingEquipmentFor('warrior', 'one_hand_shield'),
    talents,
    /*
     * THE PRESET'S OWN OPENER, MINUS WHAT THIS FIXTURE CANNOT DO. The owner
     * moved Charge, Defensive Stance and Battle Shout out of the list and into
     * `precombat`, so a HAND-BUILT tank -- which is what this is, and which has
     * no raid buffs either -- gets none of the three unless it declares them.
     *
     * CHARGE AND THE POTION ARE LEFT OUT DELIBERATELY: this fixture takes a
     * talent map per test and Charge needs VANGUARD, so including it would make
     * the fixture behave differently depending on which test called it. Battle
     * Shout and Bloodrage are what the assertions here are about.
     */
    precombat: [
      { abilityId: 'bloodrage_cast', secondsBefore: 10 },
      { abilityId: 'battle_shout_cast', secondsBefore: 10 },
      { abilityId: 'defensive_stance_cast', secondsBefore: 3 },
    ],
    simulation: { ...base.simulation, iterations, seed: 12345, durationSeconds: 60 },
    encounter: { ...base.encounter, targetAttacks: true },
  } as never;
}

const usesOf = (batch: ReturnType<typeof runProfileBatch>, name: string) =>
  batch.abilities.find((row) => row.abilityName === name)?.uses ?? 0;

// ---------------------------------------------------------------------------
// The order
// ---------------------------------------------------------------------------

describe('the Protection list', () => {
  it('is in the order the ruleset owner gave', () => {
    expect(WARRIOR_SHIELD_DEFENSIVE.entries.map((entry) => entry.abilityId)).toEqual(EXPECTED_ORDER);
  });

  it('puts the two survival cooldowns above everything that can repeat', () => {
    /*
     * ==========================================================================
     * THIS TEST USED TO SAY "above even the stance, because a dead tank is in
     * no stance at all", AND THE OWNER HAS OVERTURNED IT.
     *
     * The old reading was ours; the order is theirs. It is kept as a worked
     * example of the distinction this project draws: a test that pins a
     * ROTATION DECISION gives way when the decision changes owner, and one
     * that pins an INVARIANT does not.
     *
     * WHAT SURVIVES IS THE INVARIANT. Nothing that REPEATS sits above the two
     * cooldowns -- only Charge, castable for one instant at the pull, and the
     * stance, gated on having run out and therefore also a once-a-fight entry
     * at a moment when nothing is in danger. Both are off the global cooldown.
     * An entry that could fire again and again up there would cost a survival
     * cooldown the moment it was needed, and that is still true.
     * ==========================================================================
     */
    const ids = WARRIOR_SHIELD_DEFENSIVE.entries.map((entry) => entry.abilityId);
    /*
     * THE TWO COOLDOWNS OPEN THE LIST NOW, where Charge and the stance sat
     * above them. The INVARIANT is what this test is for and it is unchanged
     * and now trivially true: nothing above the cooldowns can delay them,
     * because there is nothing above them at all.
     */
    expect(ids[0]).toBe('last_stand');
    expect(ids[1]).toBe('shield_wall_cast');
    expect(ids.indexOf('charge'), 'Charge went before the pull').toBe(-1);
    expect(ids.indexOf('defensive_stance_cast'), 'and so did the stance').toBe(-1);
  });

  it('cannot let Charge drag the tank into Battle Stance, because no list names it', () => {
    /*
     * ========================================================================
     * THE TRAP THIS TEST WAS WRITTEN FOR, AND THE ENTRY IT GUARDED IS GONE.
     *
     * `PriorityRotation` treats a wrong stance as "not yet, and here is how"
     * and casts a stance change to unblock an entry -- right for Revenge,
     * catastrophic here. Charge allows Battle Stance, so adding the entry sent
     * the tank out of Defensive at the pull and three separate stance tests
     * caught it. A builtin condition fixed it by refusing unless the character
     * was ALREADY in a stance Charge allows.
     *
     * THE OWNER HAS MOVED CHARGE TO `precombat`, so the trap is now
     * unreachable BY CONSTRUCTION rather than by a condition: a pre-combat
     * cast has no rotation attached to swap anything, and `castAbility`'s
     * ordinary stance check refuses it if the stance does not allow it.
     *
     * SO WHAT IS ASSERTED IS THE STATE RATHER THAN THE GATE -- the tank is in
     * Defensive Stance after its opener and never in Battle. That survives the
     * entry, the condition and the precombat list all changing, which the old
     * assertion did not: it tested a `condition` object that no longer exists.
     * ========================================================================
     */
    expect(
      WARRIOR_SHIELD_DEFENSIVE.entries.some((entry) => entry.abilityId === 'charge'),
      'no list names Charge',
    ).toBe(false);

    const withVanguard = characterAtCombatStart(tank(legalise(PROTECTION_31)))!;
    expect(withVanguard.auras.has('defensive_stance'), 'still Defensive').toBe(true);
    expect(withVanguard.auras.has('battle_stance'), 'and never Battle').toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Survival cooldowns
// ---------------------------------------------------------------------------

describe('Last Stand', () => {
  it('waits for thirty percent health', () => {
    expect(DEFENSIVE_EMERGENCY_HEALTH).toBe(0.3);

    const player = characterAtCombatStart(tank(PROTECTION_31))!;
    const entry = entryFor('last_stand');

    // Full health: no.
    expect(compiled(entry.condition)?.(undefined as never, player, undefined)).toBe(false);

    // Exactly at the line is not below it.
    player.health.set(player.health.maximum * 0.3);
    expect(compiled(entry.condition)?.(undefined as never, player, undefined)).toBe(false);

    player.health.set(player.health.maximum * 0.29);
    expect(compiled(entry.condition)?.(undefined as never, player, undefined)).toBe(true);
  });

  it('is cast in nearly every fight once the talent is taken', () => {
    /*
     * The first list entry in this project that has ever read the character's
     * health. It could not have existed a week ago: health could not drop
     * below one, so 30% was unreachable by construction.
     */
    const batch = runProfileBatch(tank(PROTECTION_31));
    expect(usesOf(batch, 'Last Stand')).toBeGreaterThan(0.5);
  });

  it('is skipped entirely without the talent', () => {
    const batch = runProfileBatch(tank());
    expect(usesOf(batch, 'Last Stand')).toBe(0);
  });
});

describe('Shield Wall', () => {
  const entry = entryFor('shield_wall_cast');

  it('needs low health AND Last Stand out of the picture', () => {
    const player = characterAtCombatStart(tank(PROTECTION_31))!;
    const context = { clock: { now: () => 0 } } as never;

    // Healthy: no, whatever Last Stand is doing.
    expect(compiled(entry.condition)?.(context, player, undefined)).toBe(false);

    /*
     * Hurt, but Last Stand is READY. Shield Wall waits: a thirty minute
     * cooldown should not be spent while a three minute one is sitting there.
     */
    player.health.set(player.health.maximum * 0.1);
    expect(player.abilities.isReady('last_stand', 0)).toBe(true);
    expect(compiled(entry.condition)?.(context, player, undefined)).toBe(false);

    // Last Stand spent. Now Shield Wall is the only thing left.
    player.abilities.consumeCharge('last_stand', 0);
    expect(compiled(entry.condition)?.(context, player, undefined)).toBe(true);
  });

  it('does not stack on top of an active Last Stand', () => {
    /*
     * A REAL simulation here, not a stub context: applying an aura schedules
     * its expiry, so it needs a live event queue to be applied at all.
     */
    const simulation = new Simulation(trainingDummyEncounter(tank(PROTECTION_31)));
    simulation.begin();
    const player = simulation.combatants.find((actor) => actor.isPlayerControlled)!;

    player.health.set(player.health.maximum * 0.1);
    player.abilities.consumeCharge('last_stand', simulation.clock.now());
    expect(compiled(entry.condition)?.(simulation, player, undefined)).toBe(true);

    // With the buff actually up it waits: two cooldowns on one swing is one
    // of them wasted.
    simulation.applyAura(player, LAST_STAND, player.id);
    expect(compiled(entry.condition)?.(simulation, player, undefined)).toBe(false);
  });

  it('fires freely for a warrior who has no Last Stand at all', () => {
    /*
     * `isReady` answers false for an ability the character does not KNOW,
     * which is the behaviour wanted: there is nothing to wait for.
     *
     * Measured both ways, because this is the half of the condition most
     * likely to be written backwards: an untalented tank reaches for Shield
     * Wall in nearly every fight, and a talented one much less often --
     * roughly 0.95 casts against 0.43.
     *
     * It is not zero for the talented build, and the gap narrowed sharply
     * when Last Stand started LOSING its borrowed health on expiry. Last
     * Stand is a three minute cooldown, so a fight gets one; after that the
     * warrior drops under 30% again with nothing but Shield Wall left.
     */
    const untalented = usesOf(runProfileBatch(tank()), 'Shield Wall');
    const talented = usesOf(runProfileBatch(tank(PROTECTION_31)), 'Shield Wall');

    /*
     * THE GAP NARROWED AGAIN AT ROUND 79, when the ramp was capped at twice the
     * base swing: fewer fights take the warrior under 30% a second time, so the
     * talented build reaches for Shield Wall nearly as often (about 0.9 against
     * 1.0). The direction is what the condition decides, so that is what holds.
     */
    expect(untalented).toBeGreaterThan(0.5);
    expect(talented).toBeLessThan(untalented);
  });
});

// ---------------------------------------------------------------------------
// Demoralizing Shout
// ---------------------------------------------------------------------------

describe('Demoralizing Shout', () => {
  it('is kept up on the target', () => {
    const batch = runProfileBatch(tank());
    expect(usesOf(batch, 'Demoralizing Shout')).toBeGreaterThan(1);

    const uptime = batch.debuffUptime.find((row) => row.auraId === 'demoralizing_shout');
    expect(uptime?.uptime ?? 0).toBeGreaterThan(0.7);
  });

  it('CHANGES NOTHING, and the reason is the target rather than the shout', () => {
    /*
     * It removes 196 attack power. The boss melee carries
     * `powerCoefficient: 0` -- its swing damage IS the whole swing, with no
     * attack power term at all -- so there is nothing for the debuff to take
     * away, and the entry costs 10 rage and a global cooldown for nothing.
     *
     * In the list at the ruleset owner's request, who has chosen to skip the
     * attack power reduction for now and keep casting it.
     */
    expect(DEMORALIZING_SHOUT_ATTACK_POWER).toBe(196);
    expect(bossMeleeWeapon().powerCoefficient).toBe(0);
  });

  it('keeps its modifier, so it starts working on its own one day', () => {
    /*
     * The -196 is NOT stripped out. It is not wrong -- the target simply has
     * nothing for it to bite on -- and removing it would mean remembering to
     * put it back the day a target derives its damage from attack power.
     * Forgetting that is the failure mode this project keeps meeting.
     */
    expect(DEMORALIZING_SHOUT.statModifiers).toEqual([
      { stat: 'attackPower', value: -DEMORALIZING_SHOUT_ATTACK_POWER, operation: 'flat' },
    ]);
  });

  it('SAYS SO on the results page, rather than reading as an effect', () => {
    /*
     * Eighty percent uptime on a debuff that reduces nothing is the most
     * misleading thing on that page: every number is consistent with it
     * working. The caveat is earned by the CAST, so it only appears for a
     * fight that actually used it.
     */
    const batch = runProfileBatch(tank());
    const caveat = batch.castButNotSimulated.find(
      (row) => row.abilityName === 'Demoralizing Shout',
    );
    expect(caveat).toBeDefined();
    expect(caveat!.uses).toBeGreaterThan(1);
    expect(caveat!.reason).toMatch(/attack power/i);
  });

  it('does not caveat an inert ability that nothing cast', () => {
    // Berserker Rage is inert too, and no tank list reaches it. Listing it
    // would bury the one caveat that is actually about this result.
    const batch = runProfileBatch(tank());
    expect(batch.castButNotSimulated.map((row) => row.abilityName)).toEqual([
      'Demoralizing Shout',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Rend
// ---------------------------------------------------------------------------

describe('Rend, which had never been cast', () => {
  it('is cast now that the entry names the right ability', () => {
    /*
     * The entry said `rend` and the ability is `rend_cast`.
     * `PriorityRotation` skips an unresolvable id without a word, so the
     * entry was dead at any position and any rage -- and its zero casts read
     * as an ability that never won its slot.
     */
    const batch = runProfileBatch(tank());
    expect(usesOf(batch, 'Rend')).toBeGreaterThan(1);

    const uptime = batch.debuffUptime.find((row) => row.auraId === 'rend');
    expect(uptime?.uptime ?? 0).toBeGreaterThan(0.3);
  });

  it('stays last of the abilities a Warrior has, so it fills a gap', () => {
    /*
     * LAST OF THE WARRIOR'S OWN, not last in the list. The five racial
     * cooldowns sit below it now -- a tank list puts them at the very bottom so
     * that nothing can delay a survival cooldown -- and a Warrior build only
     * knows whichever of them its RACE grants, so they are not entries this
     * assertion is about.
     *
     * NOR ARE THE SEVEN CONSUMABLES BELOW THOSE, which are the same kind of
     * thing one category along: learned by DRINKING one rather than by being a
     * Warrior, placed at the bottom for the identical reason, and dropped
     * entirely for a profile that selected none. The two heals are above Rend
     * rather than below it and are excluded here for the same reason: a
     * Healthstone is not an ability a Warrior has.
     *
     * Asserted as "nothing of the Warrior's below it" rather than by index,
     * which is the lesson this file already learned when Charge was inserted at
     * the top and broke three positional tests -- and the reason this grew by
     * nine ids rather than by a new index.
     */
    const ids = WARRIOR_SHIELD_DEFENSIVE.entries.map((entry) => entry.abilityId);
    const notTheWarriors = new Set([
      ...['blood_fury', 'berserking', 'elunes_light', 'eureka', 'stoneform'],
      ...MID_FIGHT_CONSUMABLE_ABILITIES.map((ability) => ability.id),
    ]);
    const warriorOwn = ids.filter((id) => !notTheWarriors.has(id));
    expect(warriorOwn.at(-1)).toBe('rend_cast');
  });
});

// ---------------------------------------------------------------------------
// The list as a whole
// ---------------------------------------------------------------------------

describe('the list in a fight', () => {
  it('casts every entry it can, and none of the ones it cannot', () => {
    const batch = runProfileBatch(tank(legalise(PROTECTION_31)));

    // Everything the build can reach.
    for (const name of [
      'Last Stand',
      'Bloodrage',
      /*
       * BATTLE SHOUT IS CAST BEFORE THE PULL NOW AND STILL HAS A ROW, which is
       * the half of this change worth asserting: a pre-combat cast goes through
       * `castAbility` like any other, so it emits a cast event and
       * `abilityBreakdown` counts it. `tank()` builds a HAND-MADE profile with
       * no raid buffs, so without the opener below there would be no shout at
       * all -- the entry that used to supply it has gone.
       */
      'Battle Shout',
      'Sunder Armor',
      'Demoralizing Shout',
      'Heroic Strike',
      'Shield Block',
      'Shield Slam',
      'Revenge',
      'Thunder Clap',
      'Rend',
    ]) {
      expect(usesOf(batch, name), name).toBeGreaterThan(0);
    }
  });

  it('leaves Defensive Stance only inside the Execute window', () => {
    // Every entry outside the owner's Execute clause is castable in Defensive,
    // so a stance change before the last 20% of the fight would be a list
    // reaching for something in the wrong stance.
    expect(stanceCastsOutsideExecute(tank(legalise(PROTECTION_31)), [1, 2, 3, 4, 5])).toEqual([]);
  });
});
