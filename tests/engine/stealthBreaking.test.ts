import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import type { TelemetryEvent } from '../../src/engine';
import { Simulation, castAbility, seconds, startAutoAttack } from '../../src/engine';
import { CLAW, PROWL_ABILITY, RAVAGE } from '../../src/game/abilities/druid';
import { AMBUSH, PREMEDITATION, VANISH } from '../../src/game/abilities/rogue';
import { PROWL } from '../../src/game/auras/druid';
import { STEALTH } from '../../src/game/auras/rogue';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { makeAttacker, makeTarget } from '../helpers/actors';

import { buildSimulation } from '../helpers/buildSimulation';

/** A test that reads all 215 files under `src` needs more than the 5s default. */
const READS_THE_SOURCE_TREE_MS = 30_000;

/*
 * ==============================================================================
 * A COMPLETED CAST OR ATTACK BREAKS STEALTH AND PROWL.
 *
 * THE RULESET OWNER'S RULE, GIVEN AS ONE SENTENCE WITH ITS ONLY EXCEPTION IN
 * IT: "Almost every completed cast or attack breaks stealth/prowl, and for the
 * purposes of this simulation the only thing that doesn't is a rogue's
 * premeditation."
 *
 * ------------------------------------------------------------------------------
 * IT REPLACED TWO ABILITIES DOING IT BY HAND, which is the part worth testing
 * rather than the rule. Ambush removed `STEALTH` in its own `onCast` and Ravage
 * removed `PROWL` in its, under a note calling the second one a READING of an
 * unstated clause. The owner answered wider than the question was asked: it is
 * not Ravage's rule or Ambush's, it is everything's.
 *
 * So the mechanism is `AuraDefinition.brokenByAction` on the two states,
 * `Ability.breaksActionAuras` as the one opt-out, and
 * `AuraCollection.breakOnAction` called from the two places an action happens.
 *
 * ------------------------------------------------------------------------------
 * WHAT CAN GO WRONG IS NOT THE RULE, IT IS THE REACH. Three of the tests below
 * exist because a general field read by only SOME of its callers is this
 * project's commonest silent bug -- `resourceRegenMultiplier` wired into one of
 * three regeneration rules, `modifiersScaleWithStacks` honoured by two of three
 * collections, `ALL_ABILITIES` ignored by `abilityModifierFor`. Each compiled,
 * applied, reported its uptime and did nothing.
 *
 * TWO INSTANCES OF EXACTLY THAT WERE WRITTEN AND CAUGHT HERE:
 *
 *   the break sat BELOW `runCast`'s early return, so it would have applied to
 *   characters with a cast reaction and to nobody else
 *
 *   the break ran AFTER `onCast`, which removed the window Vanish and Prowl had
 *   just opened -- the whole of both abilities
 *
 * **THE FULL SUITE PASSED WITH BOTH IN.** 3,709 tests, green, on a rule that
 * was half-wired and self-defeating, because nothing asked whether it fired.
 * ==============================================================================
 */

/** A Cat that can prowl, claw and ravage, with no rotation and nothing pressed. */
function prowler() {
  const player = makeAttacker({
    abilities: [PROWL_ABILITY, CLAW, RAVAGE],
    resources: [
      { type: 'energy', maximum: 100, initial: 100 },
      // Claw and Ravage both award one, and `awardComboPoint` has nowhere to
      // put it without a pool -- it does not create one.
      { type: 'comboPoints', maximum: 5, initial: 0 },
    ],
    /*
     * `swingTimerMs` AND NOT `speed`, which is the second thing the first draft
     * got wrong and the one that threw: `WeaponProfile` has no `speed` field at
     * all, so the swing landed and then scheduled its successor at NaN. The
     * neighbouring `prowlAndRavage.test.ts` writes `speed` and is unharmed,
     * because nothing in it ever swings.
     */
    weapons: {
      mainHand: {
        name: 'Test Claws',
        swingTimerMs: seconds(2),
        baseDamage: 100,
        damageVariance: 0,
        powerCoefficient: 2 / 14,
      },
    },
    /*
     * A BARE COMBATANT DOES NOT SWING. `autoAttack` defaults to 'none', so
     * `swingingSlots` returns nothing and `startAutoAttack` schedules nothing
     * at all -- which read, in the first draft of the swing test below, as "the
     * rule does not fire on a swing". A fixture that cannot take the action
     * cannot test what the action does, which is this project's own lesson
     * about Preparation's three tests and their two-ability book.
     */
    autoAttack: 'main-hand',
  } as never);
  const target = makeTarget();
  return { player, target, simulation: buildSimulation([player, target]) };
}

describe('the stealth-breaking rule', () => {
  it('ends the window on an ordinary cast that is not the one spending it', () => {
    /*
     * CLAW RATHER THAN RAVAGE, deliberately. Ravage breaking Prowl is what the
     * old hand-written line already did, so asserting it cannot tell the rule
     * from the line it replaced. Claw never mentioned either aura, is in no
     * stealth sequence, and under the old code left Prowl standing.
     */
    const { player, target, simulation } = prowler();
    castAbility(simulation, player, PROWL_ABILITY, undefined);
    expect(player.auras.has(PROWL.id)).toBe(true);

    // Past Prowl's own global cooldown; see `prowlAndRavage.test.ts` on why a
    // hand-driven pair of casts pays one where the opener does not.
    simulation.advanceTo(seconds(2));
    expect(castAbility(simulation, player, CLAW, target).ok).toBe(true);
    expect(player.auras.has(PROWL.id), 'a cast ended it').toBe(false);
  });

  it('ends it on a SWING, which no cast test can show', () => {
    /*
     * ==========================================================================
     * THE OTHER HALF OF "cast or attack", AND THE HALF WITH ITS OWN CALL SITE.
     *
     * `autoAttack.ts` is a separate `breakOnAction` call from `casting.ts`, so a
     * suite that only drives casts would pass with the swing half missing --
     * and a stealth window surviving every auto-attack is exactly the generous,
     * plausible failure this project keeps meeting: an extra Ambush a fight,
     * with no zero anywhere to notice.
     *
     * IT IS ALSO WHY THE CAT'S RAVAGE IS AN OPENER AND NOT A LIST ENTRY. The
     * first swing after the pull takes the window and nothing re-applies it.
     * ==========================================================================
     */
    const { player, simulation } = prowler();
    castAbility(simulation, player, PROWL_ABILITY, undefined);
    expect(player.auras.has(PROWL.id)).toBe(true);

    startAutoAttack(simulation, player);
    simulation.advanceTo(seconds(3));
    expect(player.auras.has(PROWL.id), 'a swing ended it').toBe(false);
  });

  it('applies to a character with no cast reactions at all', () => {
    /*
     * THE EARLY-RETURN HAZARD, PINNED. `runCast` leaves by a different path when
     * `castReactions` is empty -- "nothing is listening, so nothing needs
     * measuring" -- and the first version of this rule sat under that return.
     * A bare combatant has no cast reactions, so the two tests above are both
     * on the unmeasured path; this says so out loud, because what makes them a
     * guard is a property of the fixture rather than of their assertions, and a
     * fixture can gain a reaction.
     */
    const { player } = prowler();
    expect(player.castReactions.length).toBe(0);
  });

  it('leaves a window the action itself OPENED, which is why it runs first', () => {
    /*
     * ==========================================================================
     * VANISH AND PROWL DO NOTHING BUT APPLY ONE, so an order that breaks after
     * `onCast` removes what the cast just granted. That shipped for one
     * typecheck and the whole suite passed on it.
     *
     * NOT FIXED WITH TWO MORE OPT-OUTS, which is the tempting repair and would
     * have grown the exception list from one to three to cover a mistake in an
     * ordering. The rule is about what was up BEFORE the action: breaking first
     * says that exactly, and whatever the action establishes is newer than the
     * action.
     *
     * ASSERTED ON BOTH, because they are two abilities in two classes and the
     * same mistake is available to each.
     * ==========================================================================
     */
    const { player, simulation } = prowler();
    expect(castAbility(simulation, player, PROWL_ABILITY, undefined).ok).toBe(true);
    expect(player.auras.has(PROWL.id), 'Prowl survives its own cast').toBe(true);

    const rogue = makeAttacker({ abilities: [VANISH] });
    const vanishing = buildSimulation([rogue, makeTarget()]);
    expect(castAbility(vanishing, rogue, VANISH, undefined).ok).toBe(true);
    expect(rogue.auras.has(STEALTH.id), 'Vanish survives its own cast').toBe(true);
  });
});

describe('Premeditation, the one exception', () => {
  it('banks its points without ending the window the Ambush needs', () => {
    /*
     * ==========================================================================
     * WHICH IS WHAT MAKES THE OWNER'S OPENER AN OPENER. Every stealth sequence
     * they specified is Stealth, then Premeditation, then Ambush -- so if this
     * broke the window the two points it banks would cost the Ambush they were
     * banked FOR, and the sequence would be impossible rather than worse.
     *
     * DRIVEN AS THE SEQUENCE, so the exception and the rule are one assertion:
     * Premeditation leaves it and the Ambush after it takes it. Asserting only
     * the first half would pass on an engine that never broke anything.
     * ==========================================================================
     */
    const rogue = makeAttacker({
      abilities: [PREMEDITATION, AMBUSH],
      resources: [
        { type: 'energy', maximum: 100, initial: 100 },
        { type: 'comboPoints', maximum: 5, initial: 0 },
      ],
      // A DAGGER, because Ambush's `canCast` reads the weapon type as well as
      // the window -- two reasons to refuse, and only one of them is the rule
      // under test.
      weapons: {
        mainHand: {
          name: 'Test Dagger',
          swingTimerMs: seconds(1.8),
          baseDamage: 100,
          damageVariance: 0,
          powerCoefficient: 1.8 / 14,
          weaponType: 'dagger',
        },
      },
    } as never);
    const target = makeTarget();
    const simulation = buildSimulation([rogue, target]);
    simulation.applyAura(rogue, STEALTH, rogue.id);

    expect(castAbility(simulation, rogue, PREMEDITATION, target).ok).toBe(true);
    expect(rogue.auras.has(STEALTH.id), 'Premeditation does not break it').toBe(true);
    expect(rogue.resources.get('comboPoints')?.current ?? 0).toBe(2);

    expect(castAbility(simulation, rogue, AMBUSH, target).ok).toBe(true);
    expect(rogue.auras.has(STEALTH.id), 'and the Ambush does').toBe(false);
  });

  it('is the ONLY thing in the project that opts out', () => {
    /*
     * ==========================================================================
     * READ OFF THE SOURCE, because an opt-out list is the thing that grows
     * quietly: a second ability that stopped breaking stealth would hand a
     * Rogue a free extra Ambush and leave no zero anywhere to notice. The
     * owner's own word is "almost", with one named exception.
     *
     * BY DECLARATION RATHER THAN BY WALKING THE CATALOGUES, which is the shape
     * `grantCastModifier.test.ts` uses: the declaration is what has to be
     * written, so matching it catches an ability in a class nobody has pointed
     * a profile at yet.
     * ==========================================================================
     */
    expect(filesDeclaring(/breaksActionAuras:\s*false/)).toEqual([
      'src/game/abilities/rogue.ts',
    ]);
    expect(PREMEDITATION.breaksActionAuras).toBe(false);

    // And nothing opts IN, because the default already is in: an explicit
    // `true` is a reader believing the field works the other way round.
    expect(filesDeclaring(/breaksActionAuras:\s*true/)).toEqual([]);
    /*
     * THE LIMIT IS INSURANCE RATHER THAN THE FIX -- `sourceFiles` caching the
     * tree is the fix, and this is here because the thing that went wrong was a
     * DEFAULT being too tight for a test that touches the disk at all. It is
     * the arrangement `bloodCraze.test.ts` and `chargeAndShieldTalents.test.ts`
     * already use, and it is per-test on purpose: widening `testTimeout`
     * globally would hide the next test that genuinely gets slower.
     */
  }, READS_THE_SOURCE_TREE_MS);
});

describe('what carries the rule', () => {
  it('is the two states and deliberately NOT Cutthroat', () => {
    /*
     * ==========================================================================
     * CUTTHROAT GATES THE SAME AMBUSH AND MUST NOT CARRY THIS.
     *
     * The owner ruled that its proc IS Ambush's stealth requirement, so it is a
     * ten-second PROC WINDOW spent by the Ambush rather than a state an action
     * ends. Tagging it would mean any swing landing inside the window destroyed
     * it -- and a Rogue reaches 60 energy in only 30 of 207 windows as it is,
     * so the talent would quietly become worth almost nothing, on three
     * talents' worth of wiring.
     *
     * IT IS ALSO WHY THE `if`/`else` IN AMBUSH'S `onCast` IS GONE rather than
     * kept. One window or the other was a decision made when both were removed
     * by hand; now one is spent by the ability and the other ended by the
     * engine, so with both up both go.
     * ==========================================================================
     */
    expect(STEALTH.brokenByAction).toBe(true);
    expect(PROWL.brokenByAction).toBe(true);

    const tagged = new Set<string>();
    const directory = 'src/game/auras';
    for (const file of readdirSync(directory)) {
      if (!file.endsWith('.ts')) continue;
      const source = readFileSync(`${directory}/${file}`, 'utf8');
      /*
       * THE AURA'S OWN ID, taken from the nearest `id:` after the flag. A COUNT
       * alone would pass on the right number of the wrong auras, which is the
       * whole failure this test is about.
       */
      for (const match of source.matchAll(
        /brokenByAction:\s*true,[\s\S]{0,600}?id:\s*'([a-z0-9_]+)'/g,
      )) {
        tagged.add(match[1]);
      }
    }
    expect([...tagged].sort()).toEqual(['prowl', 'stealth']);

    // Named outright, so the intent survives the regex above being rewritten.
    expect(tagged.has('cutthroat')).toBe(false);
  });
});

describe('the Rogue opener, end to end', () => {
  it('does not let the opening stealth window outlive the first action', () => {
    /*
     * ==========================================================================
     * THROUGH A REAL PRESET, because every claim above is on a bare combatant.
     * A Rogue is handed `STEALTH` by `createPlayer`'s `openingAuras` -- not by
     * a cast -- so this is the one route the engine tests cannot reach: an aura
     * already up when the clock starts, which is what the owner's "2s before
     * Stealth" line means.
     *
     * VENOM, WHICH HAS NO OPENER AT ALL. The owner specified none for it, so
     * nothing at t=0 has spent the window and what takes it is the fight: the
     * first cast or swing of an ordinary rotation. On the Rupture and Hemo
     * lists an Ambush takes it at the pull, which would pass this test for the
     * wrong reason.
     * ==========================================================================
     */
    const profile = PRESETS_BY_ID.get('rogue_venom')!.build();
    expect(profile.precombat ?? [], 'Venom opens on nothing').toEqual([]);

    const events: TelemetryEvent[] = [];
    const simulation = new Simulation(trainingDummyEncounter(profile, 4242), {
      emit: (event) => events.push(event),
    });
    simulation.begin();
    const player = simulation.combatants.find((actor) => actor.kind === 'player')!;

    expect(player.auras.has(STEALTH.id), 'up at the pull').toBe(true);
    simulation.advanceTo(seconds(5));
    expect(player.auras.has(STEALTH.id), 'and gone once it acts').toBe(false);

    /*
     * AND AMBUSH IS NOT WHAT TOOK IT, which is what keeps this test about the
     * rule rather than about one list. Venom's list names no Ambush.
     */
    const ambushes = events.filter(
      (event) =>
        event.type === 'damage' && (event as { abilityId?: string }).abilityId === 'ambush',
    );
    expect(ambushes.length).toBe(0);
  });
});

/** Every `.ts` file under `src` whose text matches, as repository-relative paths. */
/*
 * ==============================================================================
 * THE SOURCE IS READ ONCE AND CACHED, AND THAT IS A TIMEOUT FIX.
 *
 * This walked `src` and read every one of its **215 TypeScript files** on each
 * call, and the three callers in this file each made one -- so the file did
 * about **645 synchronous reads** while vitest was transforming 167 test files
 * in parallel. Standalone the whole file is **265ms of test time**; under the
 * full suite one of its tests **timed out against the 5000ms default on two
 * runs out of three**.
 *
 * SO THE CAUSE IS DISK I/O CONTENTION RATHER THAN CPU, which is worth saying
 * because CLAUDE.md's entry on this pattern reads as "a real flake under load"
 * and had no mechanism attached to it. **A test that reads the source tree is
 * the one kind that gets slower the more tests run beside it**, and this is the
 * first instance where the quantity was counted rather than guessed at.
 *
 * ONE READ, SHARED. The tree cannot change while a test file runs, so caching
 * is safe by construction -- and it is the fix the limit below would otherwise
 * have hidden.
 * ==============================================================================
 */
let sourceCache: readonly { path: string; text: string }[] | undefined;

function sourceFiles(): readonly { path: string; text: string }[] {
  if (sourceCache) return sourceCache;
  const found: { path: string; text: string }[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.ts')) found.push({ path, text: readFileSync(path, 'utf8') });
    }
  };
  walk('src');
  sourceCache = found;
  return sourceCache;
}

function filesDeclaring(pattern: RegExp): string[] {
  return sourceFiles()
    .filter((file) => pattern.test(file.text))
    .map((file) => file.path)
    .sort();
}
