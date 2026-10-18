import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../src/engine';
import { Simulation } from '../../src/engine';
import { PROFILE_PRESETS, PRESETS_BY_ID } from '../../src/profiles/presets';
import { characterAtCombatStart } from '../../src/simulator';
import {
  PRECOMBAT_STATES,
  precombatStateFor,
} from '../../src/game/abilities/precombatStates';
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
 * EVERY LINE OF THEIRS IS HERE NOW, INCLUDING THE SEVEN THAT NAME A STATE.
 *
 * Four were omitted at first as "already true" -- the three Druid forms and a
 * Rogue's Stealth, none of which is an ability -- and the owner asked for them
 * back: "Even if lines were already true, like Moonkin Form, just leave it in
 * the pre-combat so users know that." They are declared, `runPrecombat` finds
 * no ability and skips them, and `PRECOMBAT_STATES` is what stops this file and
 * the panel reporting that as a fault.
 *
 * AND ONE OMISSION WAS A MISREADING OF A RULING. The Cat's "0s Ravage" was
 * refused as unimplementable because "must be prowling AND behind the target"
 * looked like `stealth` plus `positioning`; the owner: **"You do NOT need to
 * scope in behind the target positioning. Once again this should be assumed in
 * all cases EXCEPT when 'Target attacks back' is checked."** Prowl and Ravage
 * are declared and the Cat has a three-step opener.
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
  /*
   * "T-10 Bloodrage, T-10 Battle Shout, T-3 Defensive Stance, T-1.5 Death Wish,
   * T-0 Mighty Rage Potion + Heroic Strike Queue + Bloodthirst." No Charge:
   * this tree takes no Vanguard, so Charge cannot be cast from Defensive.
   */
  fury_prot: [
    [10, 'bloodrage_cast'],
    [10, 'battle_shout_cast'],
    [3, 'defensive_stance_cast'],
    [1.5, 'death_wish'],
    [0, 'mighty_rage_potion'],
    [0, 'heroic_strike'],
    [0, 'bloodthirst'],
  ],
  // "Venom: none" -- the one profile of the 29 with no opener.
  rogue_venom: [],
  rogue_combat_mut: [[1, 'blade_flurry']],
  rogue_combat: [[1, 'blade_flurry']],
  rogue_rupture: [
    [2, 'stealth'],
    [0, 'ambush'],
    [0, 'major_frenzy_potion'],
  ],
  rogue_hemo: [
    [2, 'stealth'],
    [0, 'ambush'],
    [0, 'major_frenzy_potion'],
  ],
  // No Ambush: this build's main hand is a SWORD and Ambush asks for a dagger.
  // Round 37: Premeditation off, and the potion with a Garrote at 0s.
  rogue_pure_hemo: [
    [2, 'stealth'],
    [0, 'garrote'],
    [0, 'major_frenzy_potion'],
  ],
  druid_moonkin: [
    [3, 'moonkin_form'],
    [1.5, 'wrath'],
  ],
  // "2s before cat form, 1s before prowl, 0s Ravage" -- the one opener the
  // owner had to restate, and the one that needed new abilities declaring.
  druid_cat: [
    [2, 'cat_form'],
    [1, 'prowl'],
    [0, 'ravage'],
  ],
  druid_bear: [
    [1.5, 'bear_form'],
    [0, 'enrage'],
    [0, 'mighty_rage_potion'],
    [0, 'maul'],
    [0, 'mangle'],
  ],
  // Round 37: the Lightning Bolt is off the opener.
  shaman_elemental: [[0, 'flame_shock']],
  shaman_enhancement: [
    [3, 'flametongue_weapon'],
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
    [2, 'aimed_shot'],
  ],
  /*
   * STRIDER KICK WHERE THE OWNER FIRST WROTE MONGOOSE BITE, AND THIS TEST IS
   * WHY. Their line was "queue Raptor Strike + cast Mongoose Bite"; the bite
   * "can only be performed after you dodge" and its only route here is EXPOSE
   * PREY's 10% proc on a landed attack, so before the pull the window cannot be
   * open and the cast was refused and skipped in silence. This file caught it
   * the first time it ran, and the owner replaced it: "good catch. Replace
   * Mongoose Bite with Strider kick instead for those pre-combat instances."
   * Strider Kick has no gate at all.
   */
  lw_melee: [
    [3, 'hunters_mark'],
    [1.5, 'aspect_of_the_beast'],
    [0, 'raptor_strike'],
    [0, 'strider_kick'],
  ],
  hawk_melee: [
    [3, 'hunters_mark'],
    [1.5, 'aspect_of_the_beast'],
    [0, 'raptor_strike'],
    [0, 'strider_kick'],
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
  it('declares one for all 29 profiles, and only Venom has none', () => {
    expect(Object.keys(OWNER_OPENERS).sort()).toEqual(
      PROFILE_PRESETS.map((preset) => preset.id).sort(),
    );

    /*
     * ABSENT RATHER THAN EMPTY, for the one with nothing to declare. The field
     * is optional and `absent` is what every profile saved before format 16
     * carries, so writing `precombat: []` would make that profile differ from a
     * hand-edited one for no reason -- and `roundTrip.test.ts` compares the
     * whole structure.
     *
     * IT WAS TWO: the Cat was empty while Ravage was thought unimplementable
     * and Cat Form was thought not worth listing. Both readings were wrong.
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

  /*
   * ============================================================================
   * FIVE PROFILES NOW DECLARE MORE THAN THE OWNER GAVE, AND THE ADDITIONS ARE
   * LISTED SEPARATELY RATHER THAN FOLDED INTO `OWNER_OPENERS`.
   *
   * The owner's six-profile optimisation brief names pre-combat explicitly --
   * "evaluate pre-combat, and APL decisions to maximize throughput" -- so these
   * are a measured answer to it. **But `OWNER_OPENERS` is a transcription of
   * what they WROTE**, and a transcription that quietly absorbs somebody else's
   * additions stops being one: the next reader could not tell which lines came
   * from the owner and which from a probe.
   *
   * SO THE TWO ARE KEPT APART AND THE TEST CHECKS THE SUM. Every owner line is
   * still asserted present, at its stated lead, in its stated order -- so a
   * change that DROPPED one still fails -- and the additions are asserted
   * exactly, so one that crept in unmeasured fails too.
   *
   * EACH ONE IS ONE LINE TO REVERT, which is the point of listing them with
   * their figures: if the owner wants their opener back, the number beside it
   * is what it costs.
   * ============================================================================
   */
  const OPTIMISATION_ADDITIONS: Readonly<
    Record<string, readonly (readonly [number, string, string])[]>
  > = {
    shaman_elemental: [
      [1.5, 'searing_totem', '+11.0 -- the Enhancement opener already did this'],
      [0, 'elemental_mastery', '+13.9 -- a new capstone, claimed for no GCD'],
    ],
    /*
     * `mage_frostfire` HAS NO ADDITIONS, AND IT HELD ONE.
     *
     * A Scorch at a 1.5s lead, credited with +25.1, was a SECOND damaging
     * cast finishing before the pull -- which Gate B forbids outright. It is
     * reverted for **-25.90 +/- 9.70**, and the owner's two lines are the
     * whole opener again. Nothing legal replaces it: see the preset.
     */
    /*
     * THE ENHANCEMENT SHAMAN'S ONE ADDITION, AND IT MEASURED AS A LOSS EARLIER
     * IN THE SAME ROUND THAT SHIPPED IT.
     *
     * Rage of the Farseer is +30% attack speed for 25 seconds on a 180 second
     * cooldown, it applies an aura and deals no damage, and it is deliberately
     * ON the global cooldown -- so a 0s lead claims the whole window for free
     * and cannot fail either half of Gate B.
     *
     * At the start of the round it was **-4.79, noise**: the list made about 33
     * casts in a 60 second fight and had global cooldowns to spare, so a saved
     * one bought nothing. Reverberation 5/5 then added two shock charges a
     * fight and the spare GCDs went -- and the same edit is **+12.71 +/- 3.00**
     * over 5000 paired iterations. The figure belongs to the list it was taken
     * in, which here means the list this round ended with.
     */
    shaman_enhancement: [
      [0, 'rage_of_the_farseer', '+12.71 -- a 25s haste window, claimed for no GCD'],
    ],
    /*
     * EMPTY FOR THE SAME REASON `mage_fire` IS, one round later. Round 32
     * reverted this profile's Scorch at a 1.5s lead for **-25.90 +/- 9.70**:
     * it was a SECOND damaging cast finishing before the pull, which Gate B
     * forbids outright. The key stays so the profile reads as AUDITED.
     */
    mage_frostfire: [],
    /*
     * THE ARCANE MAGE'S RAMP IS GONE, AND THIS IS WHAT IS LEFT OF IT.
     *
     * A Pyroblast finishing at t-7.5 and three Arcane Blasts finishing at t-6,
     * t-4.5 and t-3 dealt about 1,200 to 1,400 damage before the clock started.
     * **The owner's ruling: "Once you deal damage or finish casting a damaging
     * ability combat has started."** So a pre-combat list may finish AT MOST
     * ONE damaging ability and it must finish at t=0 -- which the owner's own
     * `arcane_blast` at 1.5 already is. The four extra casts are removed and
     * the +95.9 they measured is void.
     *
     * WHAT SURVIVES IS THE ONE ADDITION THAT DEALS NO DAMAGE. Arcane Power is
     * an instant at a 0s lead, so it cannot fail the gate: pre-combat mode
     * skips the global cooldown it would start, and a 15 second window opened
     * at a 0s lead is the same window the fight would get.
     */
    // Round 37: the owner took Arcane Power off the opener; it is a step of
    // the in-fight cooldown stack now.
    mage_arcane: [],
    /*
     * THE FIRE MAGE HAS NO ADDITION ANY MORE, AND THE EMPTY ARRAY SAYS SO.
     *
     * It was `[1.5, 'scorch', '+15.2 -- the same stack, worth less behind a 3s
     * Fireball']`, and it was the SECOND damaging cast in that opener: the
     * owner's own `fireball` at a 3s lead already finishes at the pull, so the
     * Scorch broke Gate B's at-most-one clause the way the Arcane ramp did.
     * Reverting it measures **-24.23 +/- 4.29** paired, and the round that
     * reverted it recovered **+20.7** of that from the list and the tree, for a
     * net of -3.57 +/- 4.83 against the illegal build -- which is noise.
     *
     * LEFT AS AN EMPTY ENTRY RATHER THAN DELETED, because the key is what says
     * this profile was AUDITED and has nothing added, where an absent key reads
     * the same as a profile nobody has looked at. `mage_frostfire` carried the
     * same addition when this was written and round 32 has since reverted it,
     * so `shaman_elemental` is the one Gate B failure left -- and both of its
     * damaging pre-combat casts are the owner's own lines.
     */
    mage_fire: [],
    shadow_priest: [
      // Shadow Word: Pain is off the opener, by the owner (round 37).
      [0, 'devouring_plague', '+26.7 alone'],
    ],
  };

  it('keeps every owner line, at its stated lead and in its stated order', () => {
    for (const [id, opener] of Object.entries(OWNER_OPENERS)) {
      const declared = (PRESETS_BY_ID.get(id)!.build().precombat ?? []).map(
        (action) => [action.secondsBefore, action.abilityId] as const,
      );
      const added = new Set(
        (OPTIMISATION_ADDITIONS[id] ?? []).map(([seconds, ability]) => `${seconds}:${ability}`),
      );
      /*
       * THE OWNER'S LINES IN ORDER, with the additions filtered out -- so an
       * addition may be inserted anywhere but may not REORDER or REPLACE
       * anything the owner wrote. `Array.prototype.sort` being stable is what
       * makes declaration order load-bearing in `runPrecombat`, and two actions
       * at the same lead run in the order they are written here.
       */
      const ownerLinesOnly = declared.filter(
        ([seconds, ability]) => !added.has(`${seconds}:${ability}`),
      );
      expect(ownerLinesOnly, id).toEqual(opener);
    }
  });

  it('adds exactly what the optimisation pass measured, and nothing else', () => {
    for (const preset of PROFILE_PRESETS) {
      const declared = (PRESETS_BY_ID.get(preset.id)!.build().precombat ?? []).map(
        (action) => `${action.secondsBefore}:${action.abilityId}`,
      );
      const owner = new Set(
        (OWNER_OPENERS[preset.id] ?? []).map(([seconds, ability]) => `${seconds}:${ability}`),
      );
      const extra = declared.filter((line) => !owner.has(line)).sort();
      const expected = (OPTIMISATION_ADDITIONS[preset.id] ?? [])
        .map(([seconds, ability]) => `${seconds}:${ability}`)
        .sort();
      expect(extra, preset.id).toEqual(expected);
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

    it(`${id} does all ${opener.length} of them at the pull`, () => {
      const profile = PRESETS_BY_ID.get(id)!.build();
      const casts = castsIn(id);
      for (const [, abilityId] of opener) {
        /*
         * A STATE LINE IS SATISFIED RATHER THAN CAST, and it is checked against
         * `PRECOMBAT_STATES` rather than waved through by id: `cat_form` is
         * already true for a Druid in Cat Form and NOT for a Moonkin, so a
         * profile naming the wrong one still fails here.
         */
        const state = precombatStateFor(profile, abilityId);
        if (state) continue;

        const found = casts.filter((cast) => cast.id === abilityId);
        expect(found.length, `${id}: ${abilityId} never happened`).toBeGreaterThan(0);
        expect(found[0].at, `${id}: ${abilityId} was not at the pull`).toBe(0);
      }
    });
  }
});

describe('the seven lines that name a STATE rather than a cast', () => {
  /*
   * ============================================================================
   * DECLARED, SKIPPED, AND NOT A FAULT -- on the owner's instruction: "Even if
   * lines were already true, like Moonkin Form, just leave it in the pre-combat
   * so users know that."
   *
   * SO THE CLAIM IS THAT THE STATE IS TRUE AT THE PULL, which is a stronger
   * assertion than the cast would have been: it fails if a profile names the
   * wrong form, and it fails if the mechanism that makes it true -- a combat
   * style, or `openingAuras` -- ever stops running before `onPrecombat`.
   * ============================================================================
   */
  it('is satisfied for every profile that declares one', () => {
    const declared: string[] = [];
    for (const preset of PROFILE_PRESETS) {
      const profile = preset.build();
      for (const action of profile.precombat ?? []) {
        if (!(action.abilityId in PRECOMBAT_STATES)) continue;
        declared.push(`${preset.id}:${action.abilityId}`);
        expect(
          precombatStateFor(profile, action.abilityId),
          `${preset.id} is already in ${action.abilityId}`,
        ).toBeDefined();
      }
    }

    // Exactly the seven the owner named, so a new one has to be deliberate.
    expect(declared.sort()).toEqual(
      [
        'druid_bear:bear_form',
        'druid_cat:cat_form',
        'druid_moonkin:moonkin_form',
        'rogue_hemo:stealth',
        'rogue_pure_hemo:stealth',
        'rogue_rupture:stealth',
      ].sort(),
    );
  });

  it('is not a way to declare something inert: a wrong form still reads wrong', () => {
    /*
     * THE GUARD ON THE GUARD. `PRECOMBAT_STATES` exists so a state line is not
     * reported as a failure, and the danger is that it becomes a list of ids
     * that excuses anything. Each entry reads the PROFILE, so naming a form the
     * character is not in is still false -- which is what keeps the assertion
     * above meaningful.
     */
    const moonkin = PRESETS_BY_ID.get('druid_moonkin')!.build();
    expect(precombatStateFor(moonkin, 'moonkin_form')).toBeDefined();
    expect(precombatStateFor(moonkin, 'cat_form')).toBeUndefined();
    expect(precombatStateFor(moonkin, 'stealth')).toBeUndefined();

    const rogue = PRESETS_BY_ID.get('rogue_rupture')!.build();
    expect(precombatStateFor(rogue, 'stealth')).toBeDefined();
    expect(precombatStateFor(rogue, 'bear_form')).toBeUndefined();
  });
});

describe('the one line of the owner that needed replacing', () => {
  /*
   * ============================================================================
   * BOTH ARE RECORDED HERE RATHER THAN APPROXIMATED, and both would otherwise
   * have been invisible: `runPrecombat` skips what it cannot do in silence, so
   * writing either one would have produced a line that reads correctly and does
   * nothing at all.
   * ============================================================================
   */
  it('gives the Cat its Ravage, which this file first said was impossible', () => {
    /*
     * ========================================================================
     * THIS TEST ASSERTED THE OPPOSITE: "cannot give the Cat its Ravage,
     * because the ability is declared nowhere".
     *
     * That was right about the declaration and wrong about why. The capture
     * reads "Must be prowling and behind the target", which was read as
     * `stealth` PLUS `positioning` -- two `OutOfScope` members, so the opener
     * was left empty and flagged. The owner: **"You do NOT need to scope in
     * behind the target positioning. Once again this should be assumed in all
     * cases EXCEPT when 'Target attacks back' is checked."**
     *
     * AND THE PROWLING HALF WAS NEVER OUT OF SCOPE EITHER, which is the part
     * worth noticing: `stealth` covers "being stealthed and the openers
     * REQUIRING it", and the owner had already ruled Ambush's requirement
     * modellable as an aura a cast reads. Prowl is that shape exactly -- a
     * permanent aura whose only job is to gate one opener.
     * ========================================================================
     */
    const cat = PRESETS_BY_ID.get('druid_cat')!.build();
    const player = characterAtCombatStart(cat)!;
    expect(player.abilities.get('ravage'), 'declared now').toBeDefined();
    expect(player.abilities.get('prowl'), 'and so is Prowl').toBeDefined();
    expect(cat.encounter.targetAttacks, 'so behind the target is assumed').toBe(false);

    // And it lands: the opener prowls and then spends the window.
    const casts = castsIn('druid_cat');
    expect(casts.some((cast) => cast.id === 'prowl')).toBe(true);
    expect(casts.some((cast) => cast.id === 'ravage')).toBe(true);
    expect(player.auras.has('prowl'), 'Ravage spent the window').toBe(false);
  });

  it('replaces Mongoose Bite with Strider Kick, because the window needs a hit', () => {
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

      // So the opener kicks instead, and the bite keeps its list entry.
      const opener = (built.precombat ?? []).map((action) => action.abilityId);
      expect(opener, id + ' kicks').toContain('strider_kick');
      expect(opener, id + ' does not try to bite').not.toContain('mongoose_bite');
      expect(
        built.rotation.entries.some((entry) => entry.abilityId === 'mongoose_bite'),
        id + ' still bites in the fight',
      ).toBe(true);
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
