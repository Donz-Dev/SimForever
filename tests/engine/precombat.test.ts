import { describe, expect, it } from 'vitest';
import { Simulation, seconds, toSeconds } from '../../src/engine';
import type { TelemetryEvent } from '../../src/engine';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { characterAtCombatStart } from '../../src/simulator';
import { loadProfile } from '../../src/profiles';
import { createDefaultProfile } from '../../src/profiles/CharacterProfile';

/**
 * ==============================================================================
 * WHAT THE CHARACTER DID BEFORE THE PULL.
 *
 * The owner's ask: "a way to capture pre-combat events a character can do.
 * Things like swapping into berserker stance, shadow form, cat form, going
 * stealth, pre-casting a spell... 'Use Stealth <= 2 sec before combat
 * initiates', 'Cast Fireball <= 2.5 sec before combat initiates'."
 *
 * AND THEIR RULING ON WHAT THE LEAD TIME MEANS, chosen over the alternative
 * that it is only a feasibility budget: "buffs and cooldowns are already N sec
 * old at the pull". So the whole feature reduces to three claims, and each gets
 * a test that drives a real fight:
 *
 *   the effect happens          -- the spell lands, the buff is up at t=0
 *   its aura is N seconds older -- less time left than a fresh one
 *   its cooldown is N shorter   -- it comes back sooner
 *
 * PLUS THE THREE THINGS IT MUST *NOT* DO: start a global cooldown, throw away
 * a swing, or let a character cast something it could not otherwise cast.
 * ==============================================================================
 */

function fightWith(presetId: string, precombat: readonly { abilityId: string; secondsBefore: number }[]) {
  const profile = PRESETS_BY_ID.get(presetId)!.build();
  const events: TelemetryEvent[] = [];
  const simulation = new Simulation(
    trainingDummyEncounter({ ...profile, precombat } as never, 4242),
    { emit: (event) => events.push(event) },
  );
  simulation.begin();
  return {
    simulation,
    events,
    player: simulation.combatants.find((actor) => actor.kind === 'player')!,
  };
}

describe('a pre-combat action happens before the fight starts', () => {
  it('lands its damage at time zero', () => {
    /*
     * THE OWNER'S OWN EXAMPLE AND THEIR OWN ANSWER: "Fireball 2.5s before ->
     * damage at t=0". There is no negative time for it to land in, and a
     * fight that began before it started would be a different fight.
     */
    const { events } = fightWith('mage_fire', [{ abilityId: 'fireball', secondsBefore: 2.5 }]);
    const fireballs = events.filter(
      (event) => event.type === 'damage' && (event as { abilityId?: string }).abilityId === 'fireball',
    );

    expect(fireballs.length, 'the pre-cast landed').toBeGreaterThan(0);
    expect(fireballs[0].timestamp).toBe(0);
  });

  it('starts no global cooldown, so the fight opens at full speed', () => {
    /*
     * ------------------------------------------------------------------------
     * THE HALF THAT MAKES IT A PRE-COMBAT ACTION RATHER THAN A FIRST ENTRY.
     * A spell cast AT the pull costs the global cooldown that the first real
     * cast then has to wait out; one cast BEFORE it does not, because the
     * fight has not begun.
     * ------------------------------------------------------------------------
     */
    const { simulation, player } = fightWith('mage_fire', [
      { abilityId: 'fireball', secondsBefore: 2.5 },
    ]);
    expect(player.isOnGcd(simulation.clock.now())).toBe(false);
  });

  it('throws away no swing, which an ordinary cast would', () => {
    /*
     * ========================================================================
     * TRUE, AND TRUE FOR A REASON THAT IS NOT THIS FEATURE'S DOING -- which is
     * worth saying rather than letting the assertion imply otherwise.
     *
     * A cast RESETS the swing timer, and that is what makes a cast a real cost
     * to a melee character rather than free damage between swings. Two things
     * were built to stop a pre-pull cast paying it: `onPrecombat` runs BEFORE
     * `startAutoAttack`, and pre-combat mode zeroes the cast time so the reset
     * branch is never reached.
     *
     * NEITHER IS LOAD-BEARING, AND THAT WAS CHECKED RATHER THAN ASSUMED. This
     * test was probed against both -- moving the hook after `startAutoAttack`,
     * and removing the cast-time zeroing -- and PASSED both times. At time
     * zero there is no swing in progress to lose: `resetSwingTimers` cancels
     * a pending swing and reschedules from now, and at t=0 "now plus the
     * weapon's speed" is the swing that was already scheduled.
     *
     * SO IT IS A REGRESSION GUARD ON A PROPERTY, not a demonstration of a
     * mechanism, and it is kept because the property is one somebody would
     * reasonably break later -- a pre-combat hook moved to a non-zero
     * timestamp would start costing swings immediately. CLAUDE.md's rule is
     * that a test whose fixture cannot express the mistake proves nothing
     * about it; this one says which mistake it cannot express.
     *
     * The fixture still has to swing AND have a cast-time spell, which is why
     * it is the Enhancement Shaman: a Fire Mage never swings at all.
     * ========================================================================
     */
    const firstSwing = (run: ReturnType<typeof fightWith>) => {
      run.simulation.advanceTo(seconds(20));
      return run.events.find(
        (event) =>
          event.type === 'damage' &&
          (event as { abilityName?: string }).abilityName === 'Main Hand Auto-Attack',
      )?.timestamp;
    };

    const withPrecombat = firstSwing(
      fightWith('shaman_enhancement', [{ abilityId: 'lightning_bolt', secondsBefore: 2.5 }]),
    );
    const without = firstSwing(fightWith('shaman_enhancement', []));

    expect(without, 'the fixture swings at all').toBeDefined();
    expect(withPrecombat).toBe(without);
  });
});

describe('the lead time is real, which is the owner s ruling', () => {
  it('leaves a buff with less time on it at the pull', () => {
    /*
     * ========================================================================
     * THE RULING, AND THE ALTERNATIVE IT WAS CHOSEN OVER. The owner was
     * offered "the lead time is only a feasibility budget; everything lands
     * fresh at t=0" and picked "buffs and cooldowns are already N sec old".
     *
     * MEASURED AS A DIFFERENCE BETWEEN TWO LEAD TIMES rather than against the
     * buff's own duration, so it is testing the rewind rather than Battle
     * Shout's two minutes.
     * ========================================================================
     */
    const remaining = (secondsBefore: number) => {
      const { simulation, player } = fightWith('rogue_combat', [
        { abilityId: 'adrenaline_rush', secondsBefore },
      ]);
      return player.auras.remainingMs('adrenaline_rush', simulation.clock.now());
    };

    const fresh = remaining(0);
    expect(fresh, 'the buff is up at all').toBeGreaterThan(0);
    expect(remaining(3)).toBe(fresh - seconds(3));
    expect(remaining(10)).toBe(fresh - seconds(10));
  });

  it('brings a cooldown back sooner by the same amount', () => {
    const left = (secondsBefore: number) => {
      const { simulation, player } = fightWith('mage_fire', [
        { abilityId: 'fire_blast', secondsBefore },
      ]);
      return player.abilities.cooldownRemaining('fire_blast', simulation.clock.now());
    };

    const fresh = left(0);
    expect(fresh, 'it went on cooldown at all').toBeGreaterThan(0);
    expect(left(3)).toBe(fresh - seconds(3));
  });

  it('delivers the ticks that happened before the pull, when the aura says they count', () => {
    /*
     * ========================================================================
     * BLOODRAGE AT A TEN SECOND LEAD IS TWENTY RAGE, AND IT USED TO BE TEN.
     *
     * The owner's arithmetic, given with the 28 openers: "you get 10 rage
     * instantly, and then another 1 rage per second for 10 seconds. During this
     * time the warrior's rage does not decay. **You end up with exactly 20 rage
     * generated from Bloodrage after 10 seconds.**"
     *
     * ALL THREE WARRIOR OPENERS PRESS IT AT EXACTLY TEN SECONDS, which is
     * exactly its duration -- so the whole over-time half elapsed before the
     * pull, the aura was aged past its own end, and `rewindAuras` removed it
     * with its ten remaining rage undelivered. The warrior arrived with half
     * of what the ability gives.
     *
     * `PeriodicEffect.accruesBeforeCombat` is the fix and it is DECLARED rather
     * than inferred: nothing on an aura distinguishes "a resource the character
     * spent those seconds generating" from "damage in a fight that had not
     * started", and only the first should survive the pull.
     *
     * MEASURED AS A DIFFERENCE AGAINST THE SAME CAST AT NO LEAD, so neither
     * Bloodrage's own figures nor Improved Bloodrage's multiplier has to be
     * restated here -- what is asserted is that the ten seconds are worth the
     * over-time half, which is the claim.
     * ========================================================================
     */
    const rageWith = (secondsBefore: number) => {
      const { player } = fightWith('prot_warr', [
        { abilityId: 'bloodrage_cast', secondsBefore },
      ]);
      return player.resources.require('rage').current;
    };

    const instantOnly = rageWith(0);
    expect(instantOnly, 'the instant half landed').toBeGreaterThan(0);

    // Ten seconds out: the whole over-time half has accrued, and it is equal to
    // the instant half by the ruleset's own figures -- 10 and 10.
    expect(rageWith(10)).toBeCloseTo(instantOnly * 2, 6);

    // And the aura is gone, because its window really is over.
    const { player } = fightWith('prot_warr', [
      { abilityId: 'bloodrage_cast', secondsBefore: 10 },
    ]);
    expect(player.auras.has('bloodrage')).toBe(false);
  });

  it('does not double-count at a lead shorter than the window', () => {
    /*
     * THE ARITHMETIC THAT MAKES THE ABOVE SAFE, and the thing to check rather
     * than reason about: the ticks the engine already scheduled keep firing
     * after the pull and stop when the AGED window closes. So a four-second
     * lead is four rage here and six in the fight -- never ten plus ten.
     *
     * DRIVEN TO THE END OF THE WINDOW, because the failure this guards against
     * is only visible once both halves have had their chance.
     */
    const { simulation, player } = fightWith('prot_warr', [
      { abilityId: 'bloodrage_cast', secondsBefore: 4 },
    ]);
    const atPull = player.resources.require('rage').current;
    const full = fightWith('prot_warr', [
      { abilityId: 'bloodrage_cast', secondsBefore: 10 },
    ]).player.resources.require('rage').current;

    // Four of the ten accrued, so it sits between the instant half and all of it.
    const instantOnly = full / 2;
    expect(atPull).toBeGreaterThan(instantOnly);
    expect(atPull).toBeLessThan(full);

    /*
     * AND THE AURA IS STILL UP WITH THE REMAINDER ON IT. The total cannot be
     * asserted by running the clock -- a Protection warrior's own rotation
     * spends rage and its target hands more back -- so what is checked is that
     * the window was SHORTENED rather than restarted, which is the half that
     * would double-count.
     */
    expect(player.auras.has('bloodrage')).toBe(true);
    expect(player.auras.remainingMs('bloodrage', simulation.clock.now())).toBe(seconds(6));
  });

  it('drops a buff that would already have run out', () => {
    /*
     * ALREADY OVER MEANS GONE, not present with nothing left. Leaving it would
     * put a row on the buff-uptime table for something that never applied --
     * which is the Adrenaline Rush failure, where an aura reported 24.9%
     * uptime and delivered nothing at all.
     */
    const { player } = fightWith('rogue_combat', [
      // Adrenaline Rush lasts 15 seconds; used a minute before the pull it is
      // not a buff this character has.
      { abilityId: 'adrenaline_rush', secondsBefore: 60 },
    ]);
    expect(player.auras.has('adrenaline_rush')).toBe(false);
  });

  it('leaves a PERMANENT aura alone, so a stance is just a stance', () => {
    /*
     * A stance, a form and Stealth have no duration to shorten -- `expiresAt`
     * is `Infinity` -- so "swapping into berserker stance 2 seconds before the
     * pull" is simply being in berserker stance, which is what it should be.
     */
    const { player } = fightWith('two_hand_arms', [
      { abilityId: 'berserker_stance_cast', secondsBefore: 2 },
    ]);
    expect(player.auras.has('berserker_stance'), 'the stance swap took').toBe(true);
    const stance = [...player.auras.active].find(
      (aura) => aura.definition.id === 'berserker_stance',
    );
    expect(stance!.isPermanent, 'and was not aged out of existence').toBe(true);
  });
});

describe('what a pre-combat action may NOT do', () => {
  it('still pays the cost, so the fight opens with less in the pool', () => {
    /*
     * IT IS NOT A FREE CAST. The mana is spent, which is what a character who
     * opened with a Fireball actually arrives with -- and is the difference
     * between modelling a pre-pull and granting one.
     */
    const withCast = fightWith('mage_fire', [{ abilityId: 'fireball', secondsBefore: 2.5 }]);
    const without = fightWith('mage_fire', []);

    const mana = (run: ReturnType<typeof fightWith>) =>
      run.player.resources.require('mana').current;
    expect(mana(withCast)).toBeLessThan(mana(without));
  });

  it('skips an ability the build does not have, in silence', () => {
    /*
     * `PriorityRotation`'s rule, and it is what lets one saved profile survive
     * a talent change: an entry naming an ability the character never learned
     * is skipped rather than throwing. A pre-combat list is the same kind of
     * stored plan.
     */
    expect(() => fightWith('mage_fire', [{ abilityId: 'bloodthirst', secondsBefore: 2 }])).not.toThrow();
  });

  it('refuses a channel rather than delivering one tick as a whole one', () => {
    /*
     * ------------------------------------------------------------------------
     * THE ONE REFUSAL THAT IS NOT ABOUT CASTABILITY. Pre-combat mode zeroes the
     * cast time, and for a CHANNEL that would run `onCast` once and report it
     * as the whole thing -- a smaller number and no error, which is the
     * failure shape this project keeps meeting from the other side.
     *
     * There is no sensible pre-pull reading of a channel anyway: it is the one
     * kind of cast whose effect is spread across the time it occupies.
     * ------------------------------------------------------------------------
     */
    const { events } = fightWith('mage_arcane', [
      { abilityId: 'arcane_missiles', secondsBefore: 3 },
    ]);
    const atZero = events.filter(
      (event) =>
        event.type === 'damage' &&
        event.timestamp === 0 &&
        (event as { abilityId?: string }).abilityId === 'arcane_missiles',
    );
    expect(atZero).toHaveLength(0);
  });

  it('runs them oldest first, which is the order they happened in', () => {
    /*
     * SORTED RATHER THAN TRUSTED, so the list in the panel can be in whatever
     * order somebody dragged it into -- and the owner's own two examples
     * arrive out of order. The order matters whenever one action gates
     * another, the way a stance gates Overpower.
     */
    const { events } = fightWith('mage_fire', [
      { abilityId: 'fire_blast', secondsBefore: 1 },
      { abilityId: 'fireball', secondsBefore: 2.5 },
    ]);
    const casts = events
      .filter((event) => event.type === 'cast' && event.timestamp === 0)
      .map((event) => (event as { abilityId: string }).abilityId);

    expect(casts.indexOf('fireball')).toBeLessThan(casts.indexOf('fire_blast'));
  });
});

describe('the profile field', () => {
  it('survives a save and a load, and absent stays absent', () => {
    /*
     * `validateProfile` REBUILDS THE PROFILE FIELD BY FIELD, so a field nobody
     * names there is dropped on load in silence -- which has happened to
     * `stance` and then to `petFamily`, the second one directly underneath a
     * comment recording the first.
     */
    const base = { ...createDefaultProfile(), version: 16 };
    const withActions = {
      ...base,
      precombat: [{ abilityId: 'battle_shout_cast', secondsBefore: 2 }],
    };

    const loaded = loadProfile(JSON.parse(JSON.stringify(withActions)));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.profile.precombat).toEqual([{ abilityId: 'battle_shout_cast', secondsBefore: 2 }]);

    const bare = loadProfile(JSON.parse(JSON.stringify(base)));
    expect(bare.ok).toBe(true);
    if (!bare.ok) return;
    // ABSENT, not an empty array: the two are different files.
    expect(bare.profile.precombat).toBeUndefined();
  });

  it('migrates a version 15 profile without inventing one', () => {
    const old = { ...createDefaultProfile(), version: 15 };
    const loaded = loadProfile(JSON.parse(JSON.stringify(old)));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.profile.precombat).toBeUndefined();
  });

  it('changes nothing for a character that declares none', () => {
    /*
     * ========================================================================
     * THE CONTAINMENT CHECK IN MINIATURE: the hook returns immediately when
     * there is nothing to do.
     *
     * ITS REFERENCE USED TO BE THE PRESET AS SHIPPED, on the reasoning that
     * "no preset carries a pre-combat list". **Every one of them does now** --
     * the owner specified an opener for all 28 -- so that reference spends mana
     * on Mage Armor and a Fireball and the two sides stopped being comparable.
     * It read 7182 against 6282.
     *
     * SO BOTH SIDES DECLARE NONE. This project's own rule: a test that reads a
     * profile to pin a MECHANISM must not depend on what that profile happens
     * to carry, and this one was reading the profile for its baseline.
     * ========================================================================
     */
    const { player, simulation } = fightWith('mage_fire', []);
    const base = PRESETS_BY_ID.get('mage_fire')!.build();
    const reference = characterAtCombatStart({ ...base, precombat: [] })!;
    expect(player.resources.require('mana').current).toBe(
      reference.resources.require('mana').current,
    );
    expect(toSeconds(simulation.clock.now())).toBe(0);
  });
});

describe('ageing the window reschedules the expiration, which it did not', () => {
  /*
   * ============================================================================
   * AN AURA MUST NOT OUTLIVE ITS OWN `expiresAt`, AND A PRE-CAST ONE DID -- by
   * exactly the lead.
   *
   * `rewindAuras` wrote `appliedAt` and `expiresAt` directly and left the
   * EXPIRATION EVENT scheduled against the old time, so for `leadMs` after the
   * window closed `remainingMs` read zero while `has` still answered true.
   *
   * WHAT IT COST WAS A TICKING EFFECT, AT AN IDENTICAL UPTIME. A periodic tick
   * chains itself and stops when the next one would fall past `expiresAt`, and
   * `refresh` extends the window without restarting a chain that has already
   * stopped. So a list whose entry is "recast when it has run out" fired inside
   * the stale window, REFRESHED the still-present aura, and got a window that
   * ticked **zero times**: the Enhancement Shaman's Searing Totem delivered
   * 41.15 ticks against 76.36 over a 120 second fight, on the same number of
   * casts and at 98% uptime either way.
   *
   * SO THE DPS SAID -15.1 AT 240s AND NOTHING SAID WHY. It read as an argument
   * for deleting the owner's opener line -- "+14.60 to remove it" -- which was
   * a figure pricing a bug, and the tick COUNT is the only thing that told them
   * apart. **Measure the mechanism's own quantity.**
   * ============================================================================
   */
  it('ages the window by the lead, which is the half that always worked', () => {
    /*
     * KEPT AS A REGRESSION GUARD ON THE PROPERTY AND LABELLED AS ONE, because
     * it does NOT demonstrate the bug: the window has always been aged
     * correctly, and what was wrong was the expiration event left pointing at
     * the old time.
     *
     * ------------------------------------------------------------------------
     * AND THE OBVIOUS SHARPER ASSERTION -- "gone one millisecond past the aged
     * end" -- WAS WRITTEN, PASSED WITHOUT THE FIX, AND IS NOT HERE. Two
     * versions of it were tried and both proved nothing:
     *
     *   "gone at the aged end"      this build's list RECASTS Searing Totem the
     *                               moment it runs out, so the assertion is a
     *                               claim about the rotation
     *   "never present with         `remainingMs` clamps at zero and the list
     *    nothing left on it"        refreshes inside the next poll, so every
     *                               sampled moment looks fine
     *
     * **A TEST THAT PASSES EITHER WAY PROVES NOTHING**, and the one below is
     * the one that fails: 44 ticks against 77 with the fix reverted. The
     * mechanism's own quantity is the only thing that saw this.
     */
    const lead = 1.5;
    const { simulation } = fightWith('shaman_enhancement', [
      { abilityId: 'searing_totem', secondsBefore: lead },
    ]);
    const target = simulation.combatants.find((actor) => actor.kind !== 'player')!;
    const full = toSeconds(target.auras.get('searing_totem')!.definition.durationMs);

    expect(
      toSeconds(target.auras.remainingMs('searing_totem', simulation.clock.now())),
      'the window is aged by the lead',
    ).toBeCloseTo(full - lead, 5);
  });

  it('gives a pre-cast damage-over-time effect as many ticks as an in-fight one', () => {
    /*
     * THE SAME BUG READ OFF THE EVENT STREAM RATHER THAN OFF THE COLLECTION,
     * because that is where it was costing damage. Two fights long enough for
     * the list to refresh the totem twice: one opens with the owner's 1.5s
     * pre-cast and one has no opener at all, so the list casts it at the pull.
     *
     * THE PRE-CAST SHOULD BE AHEAD, NEVER BEHIND -- it arrives at t=0 for no
     * global cooldown. A tolerance rather than an equality, because the two
     * fights are different fights: the comparison that matters is the SIGN.
     */
    const ticksOf = (precombat: readonly { abilityId: string; secondsBefore: number }[]) => {
      const profile = PRESETS_BY_ID.get('shaman_enhancement')!.build();
      let ticks = 0;
      const simulation = new Simulation(
        trainingDummyEncounter(
          {
            ...profile,
            precombat,
            simulation: { ...profile.simulation, durationSeconds: 120 },
          } as never,
          4242,
        ),
        {
          emit: (event: TelemetryEvent) => {
            if (
              event.type === 'damage' &&
              (event as { abilityId?: string }).abilityId === 'searing_totem'
            ) {
              ticks += 1;
            }
          },
        },
      );
      simulation.run();
      return ticks;
    };

    const precast = ticksOf([
      { abilityId: 'windfury_weapon', secondsBefore: 3 },
      { abilityId: 'searing_totem', secondsBefore: 1.5 },
    ]);
    const inFight = ticksOf([{ abilityId: 'windfury_weapon', secondsBefore: 3 }]);

    expect(inFight, 'the control delivered a fight of ticks').toBeGreaterThan(50);
    expect(precast, 'the pre-cast is not a window short').toBeGreaterThanOrEqual(inFight);
  });
});
