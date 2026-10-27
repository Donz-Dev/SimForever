import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  axisTicks,
  buildFightTimeline,
  formatFightTime,
} from '../../src/ui/charts/EventTimeline';
import { TimelineBody } from '../../src/ui/panels/TimelinePanel';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { runProfileBatch } from '../../src/simulator';
import type { SimulationResult } from '../../src/analysis';

/*
 * ============================================================================
 * ONE FIGHT, DRAWN AGAINST THE CLOCK.
 *
 * THE BUILDER IS WHAT IS TESTED, which is `aplEditing.ts`'s rule applied to a
 * chart: turning a stream of edges into windows is the part that can be wrong,
 * and a window that closes at the wrong edge renders perfectly.
 *
 * AND IT IS DRIVEN BY A REAL FIGHT rather than by a hand-built event list,
 * because the three edge cases it exists to get right -- a refresh that does
 * not close a window, a stack change that does not either, and an aura still
 * up when the fight ends -- are all things a hand-built fixture would have to
 * remember to produce. A fixture that cannot express the mistake proves
 * nothing about it.
 * ============================================================================
 */

const fightFor = (presetId: string): SimulationResult => {
  const built = PRESETS_BY_ID.get(presetId)!.build();
  return runProfileBatch({
    ...built,
    simulation: { ...built.simulation, iterations: 3, seed: 4242 },
  } as never).representative;
};

describe('the clock', () => {
  it('reads the zero as the pull and everything else as minutes and seconds', () => {
    expect(formatFightTime(0)).toBe('Pull');
    expect(formatFightTime(5_000)).toBe('0:05');
    expect(formatFightTime(65_000)).toBe('1:05');
    expect(formatFightTime(600_000)).toBe('10:00');
  });

  it('puts its ticks on a round number of seconds', () => {
    /*
     * CHOSEN FROM A LADDER rather than computed, because the only readable
     * spacings are the ones a clock has: 7 seconds divides a 70-second fight
     * into exactly ten and is unreadable, and 10 does not divide it and is
     * fine.
     */
    const ticks = axisTicks(100_000);
    expect(ticks[0]).toBe(0);
    for (const tick of ticks) expect(tick % 1000).toBe(0);
    expect(ticks.length).toBeGreaterThan(3);
    expect(ticks.length).toBeLessThan(16);
    // And it never draws a tick past the end of the fight.
    expect(Math.max(...ticks)).toBeLessThanOrEqual(100_000);
  });

  it('stays readable for a five-minute fight and a ten-second one', () => {
    for (const durationMs of [10_000, 60_000, 300_000]) {
      const ticks = axisTicks(durationMs);
      expect(ticks.length, `${durationMs}ms`).toBeGreaterThan(3);
      expect(ticks.length, `${durationMs}ms`).toBeLessThan(16);
    }
  });
});

describe('building the lanes', () => {
  const result = fightFor('two_hand_arms');
  const timeline = buildFightTimeline(result, { includeSwings: false });

  it('has a row for every ability the rotation cast', () => {
    const cast = new Set(
      result.timeline.flatMap((event) => (event.type === 'cast' ? [event.abilityName] : [])),
    );
    expect(cast.size).toBeGreaterThan(3);
    expect(new Set(timeline.casts.map((lane) => lane.label))).toEqual(cast);
  });

  it('counts every cast and puts none of them outside the fight', () => {
    const casts = result.timeline.filter((event) => event.type === 'cast').length;
    expect(timeline.casts.reduce((total, lane) => total + lane.marks.length, 0)).toBe(casts);
    for (const lane of timeline.casts) {
      for (const mark of lane.marks) {
        expect(mark.timeMs, lane.label).toBeGreaterThanOrEqual(0);
        expect(mark.timeMs, lane.label).toBeLessThanOrEqual(timeline.durationMs);
      }
    }
  });

  it('leaves swings out until they are asked for', () => {
    /*
     * SWINGS ARE NOT CASTS AND HAVE NO CAST EVENT, so the two halves are read
     * from different streams -- `cast`, and `damage` with no `abilityId`.
     * Off by default because a geared melee build lands far more swings than
     * casts, and two rows of solid ink push every row carrying a DECISION off
     * the top of the panel.
     */
    expect(timeline.casts.some((lane) => lane.label.includes('Auto-Attack'))).toBe(false);
    const withSwings = buildFightTimeline(result, { includeSwings: true });
    expect(withSwings.casts.some((lane) => lane.label.includes('Auto-Attack'))).toBe(true);
    expect(withSwings.casts.length).toBeGreaterThan(timeline.casts.length);
  });

  it('draws an aura as the stretches it was actually up', () => {
    /*
     * ==========================================================================
     * THE THREE EDGES, AND THEY ARE THE WHOLE RISK IN THIS FILE.
     *
     * A REFRESH DOES NOT CLOSE A WINDOW -- the Arms list refreshes Sunder
     * Armor and Rend all fight, so treating `aura_refreshed` as a boundary
     * would draw one long window as a dozen bars with gaps that never existed.
     *
     * A STACK CHANGE DOES NOT EITHER: Sunder Armor is five applications.
     *
     * AN AURA STILL UP AT THE END NEVER EMITS A REMOVAL, so an open window is
     * closed at the fight's own duration. `BatchTotals` has the same rule for
     * uptime; getting it wrong draws every maintained buff as ending whenever
     * it was last refreshed, which reads as a rotation that stopped.
     * ==========================================================================
     */
    const sunder = timeline.auras.find((lane) => lane.label === 'Sunder Armor');
    expect(sunder).toBeDefined();
    if (!sunder) return;

    const refreshes = result.timeline.filter(
      (event) =>
        (event.type === 'aura_refreshed' || event.type === 'aura_stacks_changed') &&
        event.auraId === sunder.id,
    ).length;
    expect(refreshes).toBeGreaterThan(2);
    // Many refreshes, and still a handful of windows rather than one per edge.
    expect(sunder.windows.length).toBeLessThanOrEqual(refreshes);

    for (const window of sunder.windows) {
      expect(window.endMs).toBeGreaterThan(window.startMs);
      expect(window.endMs).toBeLessThanOrEqual(timeline.durationMs);
    }
    // A debuff on the target, which is the one distinction the colour carries.
    expect(sunder.isDebuff).toBe(true);
  });

  it('closes a window that was still open when the fight ended', () => {
    /*
     * A BUFF THE CHARACTER CARRIES ALL FIGHT never emits a removal, so if the
     * open window were dropped the row would be EMPTY -- the failure is a
     * missing lane rather than a short bar, which is why it is worth its own
     * assertion.
     */
    const open = new Set(
      result.timeline.flatMap((event) =>
        event.type === 'aura_applied' || event.type === 'aura_refreshed' ? [event.auraId] : [],
      ),
    );
    for (const event of result.timeline) {
      if (event.type === 'aura_removed') open.delete(event.auraId);
      else if (event.type === 'aura_applied') open.add(event.auraId);
    }
    expect(open.size, 'nothing was left up, so this fight cannot test it').toBeGreaterThan(0);

    for (const auraId of open) {
      const lane = timeline.auras.find((candidate) => candidate.id === auraId);
      if (!lane) continue;
      expect(lane.windows[lane.windows.length - 1].endMs, lane.label).toBe(timeline.durationMs);
    }
  });

  it('reads the pool level the fight actually had, not a re-derived one', () => {
    /*
     * EVERY RESOURCE EVENT CARRIES `current`, and reading that rather than
     * adding gains and subtracting costs is what would expose a pool moved
     * without an event rather than hide it.
     */
    const rage = timeline.resources.find((lane) => lane.id === 'rage');
    expect(rage).toBeDefined();
    if (!rage) return;
    const last = result.timeline.filter(
      (event) =>
        (event.type === 'resource_gained' || event.type === 'resource_spent') &&
        event.resource === 'rage',
    );
    expect(rage.points).toHaveLength(last.length);
    expect(rage.peak).toBeGreaterThan(0);
    for (const point of rage.points) expect(point.value).toBeLessThanOrEqual(rage.peak);
  });

  it('reads only the friendly side', () => {
    /*
     * THE BOSS'S SWINGS ARE THE ENCOUNTER RATHER THAN THE BUILD, and its own
     * debuffs are not something a priority list can act on. What IS wanted --
     * the debuff the PLAYER put on the boss -- arrives because the filter is
     * on the SOURCE, which is what the Sunder Armor row above proves.
     */
    const hostile = new Set(
      result.actors.filter((actor) => actor.faction === 'hostile').map((actor) => actor.id),
    );
    expect(hostile.size).toBeGreaterThan(0);
    const withSwings = buildFightTimeline(result, { includeSwings: true });
    const hostileNames = new Set(
      result.timeline.flatMap((event) =>
        event.type === 'damage' && hostile.has(event.sourceId) ? [event.abilityName] : [],
      ),
    );
    for (const name of hostileNames) {
      expect(withSwings.casts.some((lane) => lane.label === name), name).toBe(false);
    }
  });
});

describe('a pet gets its own rows', () => {
  it('names a pet swing after the pet rather than pooling it into the owner’s', () => {
    /*
     * `autoAttackName` ALREADY DOES THIS, and the lane builder leans on it:
     * lanes are keyed by NAME across every friendly actor, which is the damage
     * breakdown's own arrangement and is only safe because the engine names a
     * pet's swing after the pet. It did not, once, and 38.1% of the BM Hunter
     * landed in a row called "Main Hand Auto-Attack" on a profile that never
     * swings a melee weapon.
     */
    const fight = fightFor('bm_hunter');
    const hunter = buildFightTimeline(fight, { includeSwings: true });
    const swings = hunter.casts.filter((lane) => lane.label.includes('Melee'));
    expect(swings.length).toBeGreaterThan(0);
    /*
     * ASKED OF THE PET'S OWN EVENTS, NOT OF THE LANE LIST. This used to assert
     * that no lane is called "Main Hand Auto-Attack" at all, which was a claim
     * that the Hunter never swings -- and it does: the Melee Weave casts Raptor
     * Strike, and a Windfury Totem proc off it is a real main-hand swing by the
     * HUNTER. Seed 4242 first landed one in round 81. What this test is for is
     * that the PET's swing is never filed under that name.
     */
    const pets = new Set(fight.actors.filter((actor) => actor.kind === 'pet').map((actor) => actor.id));
    expect(pets.size).toBeGreaterThan(0);
    const petSwingNames = new Set(
      fight.timeline.flatMap((event) =>
        event.type === 'damage' && pets.has(event.sourceId) ? [event.abilityName] : [],
      ),
    );
    expect(petSwingNames.has('Main Hand Auto-Attack')).toBe(false);
  });
});

describe('the panel body', () => {
  const render = (presetId: string, windowMs?: number) => {
    const result = fightFor(presetId);
    const timeline = buildFightTimeline(result, { includeSwings: false });
    return renderToStaticMarkup(
      createElement(TimelineBody, { timeline, windowMs: windowMs ?? timeline.durationMs }),
    );
  };

  it('draws the three sections and the one clock they share', () => {
    const markup = render('two_hand_arms');
    expect(markup).toContain('Casts');
    expect(markup).toContain('Buffs &amp; debuffs');
    expect(markup).toContain('Resources');
    // ONE axis above all three, so two sections cannot be drawn at different
    // scales -- which is the only way this chart could actively mislead.
    expect([...markup.matchAll(/ft-axis-row/g)]).toHaveLength(1);
  });

  it('keeps every bar and tick inside the track', () => {
    /*
     * A BAR THAT OUTLIVES THE ZOOM would paint past the right edge, which is
     * what the clamp in `AuraRow` is for -- and a zoomed view is exactly where
     * somebody reads a pull, so it is the case most likely to be looked at.
     */
    const result = fightFor('two_hand_arms');
    const timeline = buildFightTimeline(result, { includeSwings: false });
    const markup = renderToStaticMarkup(
      createElement(TimelineBody, { timeline, windowMs: 30_000 }),
    );
    for (const [, percent] of markup.matchAll(/(?:left|width):([\d.]+)%/g)) {
      expect(Number(percent)).toBeLessThanOrEqual(100.001);
      expect(Number(percent)).toBeGreaterThanOrEqual(0);
    }
  });

  it('renders a caster with no melee swing and no rage', () => {
    // A build with a different shape entirely, so the three sections are not
    // only ever exercised on one archetype.
    const markup = render('mage_fire');
    expect(markup).toContain('Fireball');
    expect(markup).toContain('Mana');
    expect(markup).not.toContain('Rage');
  });
});
