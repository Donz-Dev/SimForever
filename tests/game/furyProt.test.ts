import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../src/engine';
import { Simulation } from '../../src/engine';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { rotationFor } from '../../src/game/rotations/rotationFor';
import {
  FURY_PROT_HEROIC_STRIKE_RAGE,
  TANK_EXECUTE_PHASE,
  WARRIOR_FURY_PROT,
  WARRIOR_SHIELD_DEFENSIVE,
} from '../../src/game/rotations/warrior';
import { EXECUTE_PHASE_FRACTION } from '../../src/game/abilities/warrior';
import { stanceCastsOutsideExecute } from '../helpers/stanceCasts';
import { ITEMS_BY_ID } from '../../src/game/items/itemData';

/*
 * ==============================================================================
 * FURY PROT, AND THE TANK EXECUTE CLAUSE BOTH SHIELD TANKS NOW CARRY.
 *
 * The owner: Fury Prot "will copy Prot Warr" in almost every case, with
 * Bloodthirst in place of Shield Slam and Death Wish added; and both tank lists
 * "swap to Battle Stance and spam Execute over and over if the combat duration
 * is <= 20% remaining".
 * ==============================================================================
 */

const build = (id: string) => PRESETS_BY_ID.get(id)!.build();

/** Every cast of `abilityId` in one fight, with the share of fight left. */
function castsOf(profileId: string, abilityId: string, seed: number) {
  const events: TelemetryEvent[] = [];
  const run = new Simulation(trainingDummyEncounter(build(profileId), seed), {
    emit: (event) => events.push(event),
  }).run();
  return events
    .filter(
      (event) => event.type === 'cast' && (event as { abilityId: string }).abilityId === abilityId,
    )
    .map((event) => (run.plannedDurationMs - event.timestamp) / run.plannedDurationMs);
}

describe('Fury Prot is Prot Warr with a Fury tree', () => {
  it('runs its own list, chosen by the Bloodthirst capstone', () => {
    const fury = build('fury_prot');
    const prot = build('prot_warr');
    const listFor = (p: ReturnType<typeof build>) =>
      rotationFor(p.character.characterClass, p.character.combatStyle!, p.character.stance, p.talents)
        ?.name;
    expect(listFor(fury)).toBe(WARRIOR_FURY_PROT.name);
    expect(listFor(prot)).toBe(WARRIOR_SHIELD_DEFENSIVE.name);
  });

  it('copies Prot Warr in everything but its name, tree and opener', () => {
    const fury = build('fury_prot');
    const prot = build('prot_warr');
    expect(fury.character).toEqual({ ...prot.character, name: 'Fury Prot' });
    /*
     * THE SAME GEAR ON ITS OWN IDS: the Fury Prot template row generates Prot
     * Warr's stats under its own numbers, so compare what is WORN, slot by
     * slot -- the stats and the enchant -- rather than the ids.
     */
    for (const [slot, worn] of Object.entries(prot.equipment)) {
      const mine = (fury.equipment as Record<string, typeof worn>)[slot]!;
      expect(mine.enchantId, slot).toBe(worn!.enchantId);
      expect(ITEMS_BY_ID.get(mine.itemId)!.stats, slot).toEqual(ITEMS_BY_ID.get(worn!.itemId)!.stats);
    }
    expect(fury.consumables).toEqual(prot.consumables);
    expect(fury.raidBuffs).toEqual(prot.raidBuffs);
    expect(fury.encounter).toEqual(prot.encounter);
    expect(fury.talents.bloodthirst).toBe(1);
    expect(fury.talents.shield_slam ?? 0).toBe(0);
  });

  it('is the Prot list with Bloodthirst for Shield Slam, Death Wish, and its own Heroic Strike floor', () => {
    const prot = WARRIOR_SHIELD_DEFENSIVE.entries.map((e) => e.abilityId);
    const fury = WARRIOR_FURY_PROT.entries.map((e) => e.abilityId);
    const expected = prot.flatMap((id) =>
      id === 'shield_slam' ? ['bloodthirst'] : id === 'heroic_strike' ? ['death_wish', id] : [id],
    );
    expect(fury).toEqual(expected);

    const heroic = WARRIOR_FURY_PROT.entries.find((e) => e.abilityId === 'heroic_strike')!;
    expect(JSON.stringify(heroic.condition)).toContain(`"amount":${FURY_PROT_HEROIC_STRIKE_RAGE}`);
    expect(FURY_PROT_HEROIC_STRIKE_RAGE).toBe(65);
  });

  it('opens with Bloodthirst at the pull, and casts it during the fight', () => {
    const casts = castsOf('fury_prot', 'bloodthirst', 7);
    expect(casts[0]).toBe(1);
    expect(casts.length).toBeGreaterThan(2);
  });
});

describe('the tank Execute clause', () => {
  it('is in both shield-tank lists, gated on the last 20% of the fight', () => {
    for (const list of [WARRIOR_SHIELD_DEFENSIVE, WARRIOR_FURY_PROT]) {
      const execute = list.entries.find((e) => e.abilityId === 'execute');
      expect(execute?.condition, list.name).toEqual(TANK_EXECUTE_PHASE);
    }
  });

  it('switches off every entry that would pull the tank back into Defensive Stance', () => {
    for (const list of [WARRIOR_SHIELD_DEFENSIVE, WARRIOR_FURY_PROT]) {
      for (const id of ['shield_block_cast', 'revenge']) {
        const entry = list.entries.find((e) => e.abilityId === id)!;
        expect(JSON.stringify(entry.condition), `${list.name} / ${id}`).toContain(
          JSON.stringify({ kind: 'not', of: TANK_EXECUTE_PHASE }),
        );
      }
    }
  });

  it('casts Execute only inside the window, and does cast it', () => {
    for (const id of ['prot_warr', 'fury_prot']) {
      const casts = [1, 2, 3].flatMap((seed) => castsOf(id, 'execute', seed));
      expect(casts.length, id).toBeGreaterThan(6);
      for (const remaining of casts) expect(remaining, id).toBeLessThanOrEqual(EXECUTE_PHASE_FRACTION);
    }
  });

  it('goes to Battle Stance for it, and never before the window', () => {
    for (const id of ['prot_warr', 'fury_prot']) {
      expect(stanceCastsOutsideExecute(build(id), [1, 2, 3]), id).toEqual([]);
      const battle = [1, 2, 3].flatMap((seed) => castsOf(id, 'battle_stance_cast', seed));
      expect(battle.length, id).toBeGreaterThan(0);
    }
  });
});
