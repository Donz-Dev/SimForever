import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../src/engine';
import { Simulation } from '../../src/engine';
import { PROFILE_PRESETS, PRESETS_BY_ID } from '../../src/profiles/presets';
import { characterAtCombatStart } from '../../src/simulator';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';

/*
 * ==============================================================================
 * WHAT EVERY PROFILE DOES BEFORE THE PULL, AND WHETHER IT ACTUALLY HAPPENS.
 *
 * The ruleset owner specified an opener for all 28 profiles in one message, as
 * a sequence of "N seconds before <ability>" per profile. This file is the
 * second copy of that message.
 *
 * ------------------------------------------------------------------------------
 * WHY A SECOND COPY. `runPrecombat` SKIPS WHAT IT CANNOT DO, IN SILENCE -- an
 * ability the build does not have, a cast that is refused for cost, for stance
 * or for a `canCast` gate. That is the right behaviour, and it is
 * `PriorityRotation`'s rule: a pre-combat action is a plan, and a plan can be
 * unaffordable. **But it means a mistyped id, or an opener in the wrong order,
 * is a line that reads correctly and does nothing** -- which is this project's
 * commonest failure shape and the reason the `USES=1` pass exists for lists.
 *
 * IT HAS ALREADY CAUGHT TWO. Battle Shout costs 10 rage and a warrior opens on
 * an empty bar, so a shout BEFORE its Bloodrage is refused -- the owner's own
 * openers write the two in the right order, and three hand-built test fixtures
 * did not. And a stance cast after a rage-banking opener would dump the bar if
 * the character were not already in that stance.
 *
 * ------------------------------------------------------------------------------
 * SO THERE ARE TWO ASSERTIONS AND THEY ARE DIFFERENT CLAIMS.
 *
 *   1. the TRANSCRIPTION is right -- the table below, written out by hand from
 *      the owner's message, matches what `presets.ts` declares
 *   2. every action HAPPENS -- each one emits a cast at timestamp zero in a
 *      real fight, which is the only thing that distinguishes a working opener
 *      from a silently skipped one
 *
 * A test that only read `presets.ts` would pass on a list of ids that do
 * nothing; one that only ran the fight would pass on the wrong opener.
 * ==============================================================================
 */

/**
 * The owner's message, transcribed. `[secondsBefore, abilityId]` in the order
 * they wrote each line.
 *
 * ------------------------------------------------------------------------------
 * FOUR LINES OF THEIRS ARE NOT HERE BECAUSE THEY NAME SOMETHING ALREADY TRUE,
 * and one cannot be implemented at all:
 *
 *   "2s before Stealth"           x3  a Rogue's `openingAuras` carry `stealth`
 *   "3s before Moonkin Form"          a COMBAT STYLE, not an ability
 *   "1s before Cat Form"              the same
 *   "1.5s before Dire Bear Form"      the same
 *   "0s Ravage"                       DECLARED NOWHERE: "must be prowling and
 *                                     behind the target" is `stealth` AND
 *                                     `positioning`, both `OutOfScope` members
 *
 * The first four are satisfied before a pre-combat action could run, because
 * `onPrecombat` is called AFTER the `openingAuras` loop. The fifth is flagged
 * in HANDOVER rather than approximated.
 * ------------------------------------------------------------------------------
 */
const OWNER_OPENERS: Readonly<Record<string, readonly (readonly [number, string])[]>> = {
  two_hand_arms: [
    [10, 'bloodrage_cast'],
    [10, 'battle_shout_cast'],
    [3, 'battle_stance_cast'],
    [0, 'charge'],
    [0, 'mighty_rage_potion'],
  ],
  dw_fury: [
    [10, 'bloodrage_cast'],
    [10, 'battle_shout_cast'],
    [3, 'berserker_stance_cast'],
  ],
  prot_warr: [
    [10, 'bloodrage_cast'],
    [10, 'battle_shout_cast'],
    [3, 'defensive_stance_cast'],
    [0, 'charge'],
    [0, 'mighty_rage_potion'],
    [0, 'heroic_strike'],
  ],
  // "Venom: none" -- the one profile of the 28 with no opener.
  rogue_venom: [],
  rogue_combat_mut: [[1, 'blade_flurry']],
  rogue_combat: [[1, 'blade_flurry']],
  rogue_rupture: [
    [1, 'premeditation'],
    [0, 'ambush'],
  ],
  rogue_hemo: [
    [1, 'premeditation'],
    [0, 'ambush'],
  ],
  // No Ambush: this build's main hand is a SWORD and Ambush asks for a dagger.
  rogue_pure_hemo: [[1, 'premeditation']],
  druid_moonkin: [[1.5, 'wrath']],
  // The form is the style and Ravage is undeclared, so this one is empty.
  druid_cat: [],
  druid_bear: [
    [0, 'enrage'],
    [0, 'mighty_rage_potion'],
    [0, 'maul'],
    [0, 'mangle'],
  ],
  shaman_elemental: [
    [2, 'lightning_bolt'],
    [0, 'flame_shock'],
  ],
  shaman_enhancement: [
    [3, 'windfury_weapon'],
    [1.5, 'searing_totem'],
    [0, 'flame_shock'],
  ],
  mage_frostfire: [
    [4, 'mage_armor'],
    [2.5, 'frostfire_bolt'],
  ],
  mage_arcane: [
    [3, 'mage_armor'],
    [1.5, 'arcane_blast'],
  ],
  mage_fire: [
    [4.5, 'mage_armor'],
    [3, 'fireball'],
  ],
  pally_ret: [
    [3, 'seal_of_righteousness'],
    [1.5, 'seal_of_command'],
    [0, 'judgement'],
  ],
  pally_shockadin: [
    [1.5, 'seal_of_righteousness'],
    [0, 'judgement'],
  ],
  pally_shockadin_2h: [
    [1.5, 'seal_of_righteousness'],
    [0, 'judgement'],
  ],
  prot_pally: [
    [4.5, 'righteous_fury'],
    [3, 'seal_of_righteousness'],
    [1.5, 'holy_shield'],
    [0, 'judgement'],
  ],
  bm_hunter: [
    [5, 'hunters_mark'],
    [3.5, 'aspect_of_the_hawk'],
    [2, 'aimed_shot'],
  ],
  lw_ranged: [
    [7, 'hunters_mark'],
    [5.5, 'aspect_of_the_hawk'],
    [4, 'sniper_shot'],
  ],
  /*
   * "0s queue Raptor Strike + cast Mongoose Bite" -- AND THE BITE IS ABSENT.
   * This test is what found that: the action was declared, it was silently
   * refused, and the assertion below said so. "Can only be performed after you
   * dodge", and its only route here is EXPOSE PREY's 10% proc on an attack
   * against a marked target -- so before the pull no attack has landed and the
   * window cannot be open. It is in the LIST, so the ability still fires in the
   * fight; what is impossible is having it up AT the pull.
   */
  lw_melee: [
    [3, 'hunters_mark'],
    [1.5, 'aspect_of_the_beast'],
    [0, 'raptor_strike'],
  ],
  hawk_melee: [
    [3, 'hunters_mark'],
    [1.5, 'aspect_of_the_beast'],
    [0, 'raptor_strike'],
  ],
  warlock_smds: [[2.5, 'shadow_bolt']],
  warlock_firelock: [[2, 'incinerate']],
  shadow_priest: [
    [3, 'shadowform'],
    [1.5, 'mind_blast'],
  ],
};

/** Every cast a fight recorded, with the moment it happened. */
function castsIn(presetId: string): readonly { id: string; at: number }[] {
  const profile = PRESETS_BY_ID.get(presetId)!.build();
  const events: TelemetryEvent[] = [];
  const simulation = new Simulation(trainingDummyEncounter(profile, 4242), {
    emit: (event) => events.push(event),
  });
  simulation.begin();
  return events
    .filter((event) => event.type === 'cast')
    .map((event) => ({
      id: (event as { abilityId: string }).abilityId,
      at: event.timestamp,
    }));
}

describe("the owner's openers are transcribed exactly", () => {
  it('declares one for all 28 profiles, and the two empty ones are empty', () => {
    expect(Object.keys(OWNER_OPENERS).sort()).toEqual(
      PROFILE_PRESETS.map((preset) => preset.id).sort(),
    );

    /*
     * ABSENT RATHER THAN EMPTY, for the two with nothing to declare. The field
     * is optional and `absent` is what every profile saved before format 16
     * carries, so writing `precombat: []` would make those two profiles differ
     * from a hand-edited one for no reason -- and `roundTrip.test.ts` compares
     * the whole structure.
     */
    for (const [id, opener] of Object.entries(OWNER_OPENERS)) {
      const declared = PRESETS_BY_ID.get(id)!.build().precombat;
      if (opener.length === 0) {
        expect(declared, `${id} declares none`).toBeUndefined();
      } else {
        expect(declared, `${id} declares one`).toBeDefined();
      }
    }
  });

  it('matches what every preset declares, ability for ability and lead for lead', () => {
    for (const [id, opener] of Object.entries(OWNER_OPENERS)) {
      const declared = (PRESETS_BY_ID.get(id)!.build().precombat ?? []).map(
        (action) => [action.secondsBefore, action.abilityId] as const,
      );
      expect(declared, id).toEqual(opener);
    }
  });

  it('puts the longest lead first, because that is the order they happened in', () => {
    /*
     * NOT A RE-STATEMENT OF THE TABLE: `runPrecombat` SORTS by lead time, so a
     * list written out of order still runs correctly. What this pins is that
     * the DECLARATION reads in the order the character acted, because the panel
     * shows it in declaration order and a reader checks it against the owner's
     * message.
     */
    for (const [id, opener] of Object.entries(OWNER_OPENERS)) {
      const leads = opener.map(([seconds]) => seconds);
      expect([...leads].sort((a, b) => b - a), id).toEqual(leads);
    }
  });
});

describe('every declared action actually happens', () => {
  /*
   * ============================================================================
   * THE ASSERTION THIS FILE EXISTS FOR, and the one no amount of reading
   * `presets.ts` can replace.
   *
   * A pre-combat cast goes through `castAbility` and is REFUSED exactly as an
   * ordinary one would be -- cost, cooldown, stance, target, `canCast` -- and
   * `runPrecombat` then skips it without a word. So the only way to know an
   * opener works is to run the fight and look for the cast.
   *
   * AT TIMESTAMP ZERO, every one of them. The lead time is not a clock the
   * fight runs on: `SimulationClock` only moves forward and the pull is zero,
   * so a pre-combat action resolves AT zero and the lead is spent on ageing
   * what it applied and rewinding its own cooldown.
   * ============================================================================
   */
  for (const [id, opener] of Object.entries(OWNER_OPENERS)) {
    if (opener.length === 0) continue;

    it(`${id} casts all ${opener.length} of them at the pull`, () => {
      const casts = castsIn(id);
      for (const [, abilityId] of opener) {
        const found = casts.filter((cast) => cast.id === abilityId);
        expect(found.length, `${id}: ${abilityId} never happened`).toBeGreaterThan(0);
        expect(found[0].at, `${id}: ${abilityId} was not at the pull`).toBe(0);
      }
    });
  }
});

describe('the two lines of the owner that could NOT be implemented', () => {
  /*
   * ============================================================================
   * BOTH ARE RECORDED HERE RATHER THAN APPROXIMATED, and both would otherwise
   * have been invisible: `runPrecombat` skips what it cannot do in silence, so
   * writing either one would have produced a line that reads correctly and does
   * nothing at all.
   * ============================================================================
   */
  it('cannot give the Cat its Ravage, because the ability is declared nowhere', () => {
    /*
     * "1s before Cat Form, 0s Ravage." The form is a COMBAT STYLE and needs no
     * action; Ravage is in the Druid spellbook capture -- "Ravage the target,
     * causing 350% damage plus 343. **Must be prowling and behind the
     * target**" -- and is declared as an ability nowhere, because both of its
     * requirements are `OutOfScope` members: `stealth` and `positioning`.
     *
     * ASSERTED AS AN ABSENCE FROM THE BOOK, so the day somebody declares it
     * this test fails and the opener can be completed.
     */
    const cat = PRESETS_BY_ID.get('druid_cat')!.build();
    expect(cat.precombat, 'so the Cat declares no opener at all').toBeUndefined();

    const player = characterAtCombatStart(cat)!;
    expect(player.abilities.get('ravage'), 'no such ability').toBeUndefined();
    expect(player.auras.has('cat_form') || cat.character.combatStyle === 'cat').toBe(true);
  });

  it('cannot give the melee Hunters their Mongoose Bite, because the window needs a hit', () => {
    /*
     * "0s queue Raptor Strike + cast Mongoose Bite." The queue half works --
     * an on-next-swing ability is armed by `castAbility` -- and the cast half
     * cannot: Mongoose Bite's `canCast` reads the `expose_prey` aura, which
     * EXPOSE PREY applies on a 10% chance when an attack lands on a marked
     * target. Before the pull nothing has attacked.
     *
     * THE ABILITY IS NOT LOST, only the opener: it is in the list and fires
     * when the proc lands. Driven here rather than reasoned about, because the
     * tempting "fix" is to grant the aura before the pull -- which would hand
     * the build a free proc every fight.
     */
    for (const id of ['lw_melee', 'hawk_melee']) {
      const built = PRESETS_BY_ID.get(id)!.build();
      expect(built.talents.expose_prey, id + ' takes the talent').toBe(2);
      const player = characterAtCombatStart(built)!;
      expect(player.auras.has('expose_prey'), id + ' has no window at the pull').toBe(false);
      expect(player.abilities.get('mongoose_bite'), id + ' knows the ability').toBeDefined();
    }
  });
});

describe('what the openers cost, which a plan can get wrong', () => {
  it('banks rage before spending it, on all three Warriors', () => {
    /*
     * ========================================================================
     * THE ORDER IS LOAD-BEARING AND THE OWNER WROTE IT CORRECTLY.
     *
     * Battle Shout costs 10 rage and a warrior opens on an empty bar.
     * Bloodrage's instant grant is 10 -- 15 with Improved Bloodrage -- so a
     * shout placed BEFORE its Bloodrage is refused and skipped in silence,
     * which is a line that reads perfectly and does nothing.
     *
     * `runPrecombat` sorts by lead time and `Array.prototype.sort` is STABLE,
     * so two actions at the same lead happen in declaration order. That is the
     * whole mechanism keeping these two in the right sequence, and it is worth
     * one assertion: all three Warriors declare them at the same 10 seconds.
     * ========================================================================
     */
    for (const id of ['two_hand_arms', 'dw_fury', 'prot_warr']) {
      const opener = OWNER_OPENERS[id];
      const rage = opener.findIndex(([, ability]) => ability === 'bloodrage_cast');
      const shout = opener.findIndex(([, ability]) => ability === 'battle_shout_cast');
      expect(rage, `${id} banks rage`).toBeGreaterThanOrEqual(0);
      expect(shout, `${id} shouts`).toBeGreaterThan(rage);
      expect(opener[rage][0], `${id} at one lead`).toBe(opener[shout][0]);
    }
  });

  it('leaves the two Warriors that Charge in a stance that allows it', () => {
    /*
     * CHARGE IS STANCE-GATED AND THE OPENER CHANGES STANCE THREE SECONDS
     * EARLIER, so the two interact -- and for the tank it only works because
     * VANGUARD adds Defensive to its own copy of Charge. A Protection warrior
     * without that talent has this action refused, which is the behaviour the
     * list's `charge_stance_allowed` condition used to produce and which
     * `castAbility`'s ordinary stance check now produces for free.
     */
    for (const id of ['two_hand_arms', 'prot_warr']) {
      const casts = castsIn(id);
      expect(casts.some((cast) => cast.id === 'charge'), `${id} charges`).toBe(true);
    }

    // And nobody else does, which is what makes it a two-profile claim.
    for (const preset of PROFILE_PRESETS) {
      if (preset.id === 'two_hand_arms' || preset.id === 'prot_warr') continue;
      const opener = PRESETS_BY_ID.get(preset.id)!.build().precombat ?? [];
      expect(opener.some((action) => action.abilityId === 'charge'), preset.id).toBe(false);
    }
  });
});
