import { describe, expect, it } from 'vitest';
import { seconds } from '../../src/engine';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { characterAtCombatStart } from '../../src/simulator';
import { legalise } from '../helpers/legalTalents';

/*
 * ============================================================================
 * SURVIVALIST'S DISCIPLINE (round 83): "Reduces the cooldown of your Trap and
 * Deterrence abilities by 20/40%." It was `unmodelled` on a reason that had
 * expired -- that a cooldown cut had no percentage form -- so the one preset
 * taking it, Survival Weave, had run on 30 second traps.
 * ============================================================================
 */

const trapCooldowns = (rank: number) => {
  const hunter = createPlayer({
    race: 'orc',
    characterClass: 'hunter',
    combatStyle: 'ranged',
    talents: legalise({ survivalist_s_discipline: rank }, 'hunter'),
  });
  return [hunter.abilities.get('immolation_trap')?.cooldownMs, hunter.abilities.get('explosive_trap')?.cooldownMs];
};

describe("Survivalist's Discipline", () => {
  it('starts from the traps’ own 30 seconds', () => {
    expect(trapCooldowns(0)).toEqual([seconds(30), seconds(30)]);
  });

  it('takes 20% off both traps at rank 1, and 40% at rank 2', () => {
    // A share of each trap's OWN cooldown, which is what the tooltip states.
    expect(trapCooldowns(1)).toEqual([seconds(24), seconds(24)]);
    expect(trapCooldowns(2)).toEqual([seconds(18), seconds(18)]);
  });

  it('reaches the Survival Weave preset, the one build that takes it', () => {
    const hunter = characterAtCombatStart(PRESETS_BY_ID.get('hunter_survival_weave')!.build())!;
    expect(hunter.abilities.get('immolation_trap')!.cooldownMs).toBe(seconds(18));
    expect(hunter.abilities.get('explosive_trap')!.cooldownMs).toBe(seconds(18));
  });
});
