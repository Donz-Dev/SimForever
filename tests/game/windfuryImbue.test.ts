import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../src/engine';
import { Simulation } from '../../src/engine';
import { WINDFURY_WEAPON_IMBUE } from '../../src/game/auras/shaman';
import { PRESETS_BY_ID, PROFILE_PRESETS } from '../../src/profiles/presets';
import { RAID_BUFFS } from '../../src/game/buffs/raidBuffs';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { characterAtCombatStart } from '../../src/simulator';

/*
 * ==============================================================================
 * THE IMBUE DISABLES THE TOTEM FOR ITS OWN CARRIER, AND THE ENGINE ENFORCES IT
 * NOW RATHER THAN A CHECKBOX.
 *
 * Windfury Weapon's own tooltip: "when applied to main hand, disables any
 * benefit you personally receive from Windfury Totem."
 *
 * ------------------------------------------------------------------------------
 * IT USED TO BE AN UNTICKED BOX. The Enhancement Shaman was the ONE preset that
 * dropped Windfury Totem, with the reason written on the preset -- and the owner
 * has since asked for every raid buff ticked on every profile: "For all profiles
 * ensure that all raid buffs are checked on except for Curse of Recklessness."
 *
 * SO THE SELECTION WAS THE WRONG PLACE FOR IT, TWICE OVER. The rule is about a
 * CHARACTER rather than about a raid, and a user can tick the box back -- which
 * is exactly how the Moonkin came to read +6% crit when its exclusivity lived in
 * a chooser and a TALENT reached the same aura without passing through it.
 *
 * AND IT IS ASKED AT PROC TIME. The imbue arrives as a pre-combat CAST, and
 * `onPrecombat` runs after `openingAuras` -- so the aura does not exist when the
 * character is assembled, and a build-time check would have found nothing.
 * ==============================================================================
 */

/** Every aura application of `auraId` on the player, over one fight. */
function applications(presetId: string, auraId: string, seed = 4242): number {
  const profile = PRESETS_BY_ID.get(presetId)!.build();
  const events: TelemetryEvent[] = [];
  const simulation = new Simulation(trainingDummyEncounter(profile, seed), {
    emit: (event) => events.push(event),
  });
  simulation.begin();
  const player = simulation.combatants.find((actor) => actor.kind === 'player')!;
  simulation.run();

  return events.filter(
    (event) =>
      (event.type === 'aura_applied' || event.type === 'aura_refreshed') &&
      (event as { auraId?: string }).auraId === auraId &&
      (event as { targetId?: string }).targetId === player.id,
  ).length;
}

describe('Windfury Weapon against Windfury Totem', () => {
  it('leaves the Enhancement Shaman no totem procs at all', () => {
    /*
     * ========================================================================
     * THE TOTEM IS SELECTED AND PAYS NOTHING, which is the whole point of
     * moving the rule into the engine: the box is ticked, and the carrier
     * receives no benefit.
     *
     * ASSERTED ON THE AURA'S APPLICATIONS rather than on DPS, because the
     * totem's whole effect is a 246 attack power window plus an extra swing --
     * so an application IS the benefit, and zero of them is the clause.
     * ========================================================================
     */
    const profile = PRESETS_BY_ID.get('shaman_enhancement')!.build();
    expect(profile.raidBuffs, 'the box is ticked').toContain('windfury_totem');

    // And the imbue really is up, or the refusal would be for the wrong reason.
    const built = characterAtCombatStart(profile)!;
    expect(built.auras.has(WINDFURY_WEAPON_IMBUE.id), 'the imbue is on').toBe(true);

    expect(applications('shaman_enhancement', 'windfury_totem')).toBe(0);
  });

  it('still procs for somebody who carries no imbue, over several seeds', () => {
    /*
     * THE GUARD THAT MAKES THE ABOVE MEAN ANYTHING. A zero asserted with no
     * positive case beside it passes just as well on a totem that is broken for
     * everybody -- which is this project's own lesson about a predicate that is
     * always false reading exactly like one that is sometimes true.
     *
     * DW FURY, which swings two main-hand-eligible weapons and cannot imbue.
     * Summed over seeds because a 20% proc on an internal cooldown is a RATE.
     */
    const procs = [4242, 99, 1234].reduce(
      (total, seed) => total + applications('dw_fury', 'windfury_totem', seed),
      0,
    );
    expect(procs, 'the totem works for anyone without the imbue').toBeGreaterThan(0);
  });
});

describe('the raid selection after the owner filled it in', () => {
  it('gives every profile the identical list, and it is all but one buff', () => {
    /*
     * ONE LIST, NO EXCEPTIONS. The swap (Grace of Air for Windfury on the two
     * ranged Hunters) and the drop (Windfury on the Enhancement Shaman) are both
     * gone -- the first because both are simply on now, the second because the
     * engine enforces it.
     *
     * A TICKED BOX IS ALLOWED TO BE WORTH NOTHING, which is what both of those
     * exceptions were really about: Windfury reaches no bow, and the imbue
     * disables the totem. Neither is a reason to leave a raid short a buff.
     */
    const lists = PROFILE_PRESETS.map((preset) => preset.build().raidBuffs);
    const first = lists[0];

    expect(first.length).toBeGreaterThan(0);
    for (const [index, list] of lists.entries()) {
      expect(list, PROFILE_PRESETS[index].id).toEqual(first);
    }
  });

  it('leaves out Curse of Recklessness and nothing else', () => {
    /*
     * ========================================================================
     * DERIVED FROM THE CATALOGUE, which is what makes this the assertion the
     * owner's instruction actually asks for: "all raid buffs checked on except
     * for Curse of Recklessness."
     *
     * NOT A HAND-WRITTEN LIST OF TWENTY-TWO. That is what this test used to be
     * -- "the eighteen the ruleset owner ticked" -- and the cost of it was that
     * a buff added to the CATALOGUE would not fail anything: the list and the
     * catalogue could drift apart silently, and the only thing keeping them
     * together was somebody remembering. Reading `RAID_BUFFS` means a new buff
     * either joins every preset or fails here.
     * ========================================================================
     */
    const selected = new Set(PRESETS_BY_ID.get('dw_fury')!.build().raidBuffs);
    const missing = RAID_BUFFS.map((buff) => buff.id).filter((id) => !selected.has(id));

    expect(missing).toEqual(['curse_of_recklessness']);
  });
});
