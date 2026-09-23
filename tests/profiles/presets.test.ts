import { describe, expect, it } from 'vitest';
import { PRESETS_BY_ID, PROFILE_PRESETS, validateProfile } from '../../src/profiles';
import { CURRENT_PROFILE_VERSION } from '../../src/profiles';
import { TOTAL_TALENT_POINTS } from '../../src/game/talents/Talent';
import { talentsForClass } from '../../src/game/talents/talentData';
import { legalAllocation, pointsRemaining } from '../../src/game/talents/talentRules';
import { ITEMS_BY_ID, ENCHANTS } from '../../src/game/items/itemData';
import { isTankBuild } from '../../src/game/character';
import { characterAtCombatStart, runProfileBatch } from '../../src/simulator';

/*
 * The ready-made characters.
 *
 * ----------------------------------------------------------------------------
 * EVERY FIGURE HERE IS TRANSCRIBED BY HAND from the ruleset owner's two lists.
 * A test that read the preset and compared it to itself would pass whatever the
 * preset said, which is the one thing a content test must not do.
 *
 * The talent counts especially. The Protection list as given came to FIFTY-TWO
 * points against a cap of fifty-one, and `legalAllocation` would have quietly
 * dropped one -- landing on the right build by accident, with nobody aware a
 * point had been thrown away. Anger Management is the one the owner chose to
 * give up, and it is asserted absent so that a future edit putting it back has
 * to deal with the arithmetic.
 * ----------------------------------------------------------------------------
 */

const tree = talentsForClass('warrior')!;

describe('the preset catalogue', () => {
  it('offers the two builds, with stable ids', () => {
    expect(PROFILE_PRESETS.map((preset) => preset.id)).toEqual(['dw_fury', 'prot_warr']);
    expect(PROFILE_PRESETS.map((preset) => preset.label)).toEqual(['DW Fury', 'Prot Warr']);
  });

  it('builds a profile that VALIDATES, field for field', () => {
    /*
     * Run through the real validator rather than eyeballed. A preset that set
     * a field the format does not accept would be rejected the moment someone
     * exported and reloaded it, which is the worst time to find out.
     */
    for (const preset of PROFILE_PRESETS) {
      const result = validateProfile(preset.build());
      expect(result.ok, `${preset.id}: ${JSON.stringify(result.ok ? [] : result.issues)}`).toBe(
        true,
      );
    }
  });

  it('is built on the current format, so a version bump reaches it', () => {
    for (const preset of PROFILE_PRESETS) {
      expect(preset.build().version, preset.id).toBe(CURRENT_PROFILE_VERSION);
    }
  });

  it('assumes no raid buffs, like every other starting point', () => {
    // Nothing in the specification mentions them, and inventing a raid would
    // move every number a preset produces.
    for (const preset of PROFILE_PRESETS) {
      expect(preset.build().raidBuffs, preset.id).toEqual([]);
    }
  });

  it('returns a FRESH profile each time', () => {
    // Two presses must not share an object, or editing one character would
    // edit the other -- and the equipment is nested, so a shallow copy is not
    // enough either.
    const first = PRESETS_BY_ID.get('dw_fury')!.build();
    const second = PRESETS_BY_ID.get('dw_fury')!.build();
    expect(first).not.toBe(second);
    expect(first.equipment).not.toBe(second.equipment);
    expect(first.talents).not.toBe(second.talents);
  });

  it('equips only items and enchants that exist', () => {
    const enchantIds = new Set(ENCHANTS.map((enchant) => enchant.id));
    for (const preset of PROFILE_PRESETS) {
      for (const [slot, equipped] of Object.entries(preset.build().equipment)) {
        expect(ITEMS_BY_ID.has(equipped.itemId), `${preset.id} ${slot}`).toBe(true);
        if (equipped.enchantId !== undefined) {
          expect(enchantIds.has(equipped.enchantId), `${preset.id} ${slot}`).toBe(true);
        }
      }
    }
  });

  it('spends every talent point, and spends them legally', () => {
    /*
     * BOTH HALVES MATTER. Fifty-one exactly, and an allocation the tree
     * accepts unchanged -- `legalAllocation` stripping something would mean
     * the character that gets built is not the one that was written down.
     */
    for (const preset of PROFILE_PRESETS) {
      const talents = preset.build().talents;
      const spent = Object.values(talents).reduce((total, rank) => total + rank, 0);
      expect(spent, `${preset.id} spends`).toBe(TOTAL_TALENT_POINTS);
      expect(pointsRemaining(talents), preset.id).toBe(0);

      const legal = legalAllocation(tree, talents);
      expect(legal.dropped, `${preset.id} dropped`).toEqual([]);
      expect(legal.allocation, preset.id).toEqual(talents);
    }
  });
});

// ---------------------------------------------------------------------------
// DW Fury
// ---------------------------------------------------------------------------

describe('DW Fury', () => {
  const profile = () => PRESETS_BY_ID.get('dw_fury')!.build();

  it('is an Orc dual-wielder in Berserker Stance, against a standing target', () => {
    const p = profile();
    expect(p.character.name).toBe('DW Fury');
    expect(p.character.race).toBe('orc');
    expect(p.character.characterClass).toBe('warrior');
    expect(p.character.combatStyle).toBe('dual_wield');
    expect(p.character.stance).toBe('berserker');
    expect(p.encounter.targetAttacks).toBe(false);
    // Horde, which the race decides rather than the profile storing it.
    expect(isTankBuild(p.character.combatStyle, p.character.stance)).toBe(false);
  });

  it('spends 18 in Arms and 33 in Fury', () => {
    // Hand-counted from the owner's list.
    const talents = profile().talents;
    const inTree = (id: string) =>
      Object.entries(talents)
        .filter(([talentId]) => tree.byId.get(talentId)?.tree === id)
        .reduce((total, [, rank]) => total + rank, 0);

    expect(inTree('arms')).toBe(18);
    expect(inTree('fury')).toBe(33);
    expect(inTree('protection')).toBe(0);
  });

  it('takes the ranks the owner named', () => {
    const t = profile().talents;
    expect(t.improved_heroic_strike).toBe(3);
    expect(t.improved_rend).toBe(3);
    expect(t.improved_tactical_mastery).toBe(5);
    expect(t.anger_management).toBe(1);
    expect(t.deep_wounds).toBe(3);
    expect(t.spearing_strike).toBe(1);
    expect(t.impale).toBe(2);
    expect(t.cruelty).toBe(5);
    expect(t.unbridled_wrath).toBe(5);
    expect(t.blood_craze).toBe(3);
    expect(t.boundless_rage).toBe(2);
    expect(t.dual_wield_specialization).toBe(5);
    expect(t.raging_blows).toBe(1);
    expect(t.enrage).toBe(5);
    expect(t.death_wish).toBe(1);
    expect(t.flurry).toBe(5);
    expect(t.bloodthirst).toBe(1);
  });

  it('carries Crusader on BOTH weapons', () => {
    /*
     * The dual-wield starting set enchants neither. Forever stacks the two
     * hands' Holy Strength separately, so the second enchant is worth a second
     * hundred strength rather than refreshing the first -- which is why asking
     * for both is a real choice and not a formality.
     */
    const equipment = profile().equipment;
    expect(equipment.mainHand).toEqual({ itemId: 17075, enchantId: 20034 });
    expect(equipment.offHand).toEqual({ itemId: 228265, enchantId: 20034 });
  });

  it('runs the Berserker priority list', () => {
    expect(runProfileBatch({ ...profile(), simulation: { ...profile().simulation, iterations: 1 } }).rotationName).toBe(
      'Warrior (Dual-Wield, Berserker)',
    );
  });

  it('knows Bloodthirst, and fights', () => {
    const player = characterAtCombatStart(profile())!;
    expect(player.abilities.has('bloodthirst')).toBe(true);
    expect(player.auras.active.map((aura) => aura.id)).toContain('berserker_stance');

    const batch = runProfileBatch({
      ...profile(),
      simulation: { ...profile().simulation, iterations: 40 },
    });
    expect(batch.dps.mean).toBeGreaterThan(0);
    // Nothing is hitting it, so nothing is healing it either.
    expect(batch.survival.deaths).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Prot Warr
// ---------------------------------------------------------------------------

describe('Prot Warr', () => {
  const profile = () => PRESETS_BY_ID.get('prot_warr')!.build();

  it('is a Tauren with a shield in Defensive Stance, and the target swings back', () => {
    const p = profile();
    expect(p.character.name).toBe('Prot Warr');
    expect(p.character.race).toBe('tauren');
    expect(p.character.combatStyle).toBe('one_hand_shield');
    expect(p.character.stance).toBe('defensive');
    expect(p.encounter.targetAttacks).toBe(true);
    expect(isTankBuild(p.character.combatStyle, p.character.stance)).toBe(true);
  });

  it('spends 17 in Arms and 34 in Protection', () => {
    const talents = profile().talents;
    const inTree = (id: string) =>
      Object.entries(talents)
        .filter(([talentId]) => tree.byId.get(talentId)?.tree === id)
        .reduce((total, [, rank]) => total + rank, 0);

    // SEVENTEEN, not eighteen. The list as given came to 52 points.
    expect(inTree('arms')).toBe(17);
    expect(inTree('protection')).toBe(34);
    expect(inTree('fury')).toBe(0);
  });

  it('gives up Anger Management, which is the point the owner chose', () => {
    /*
     * The list as given was one over the cap. Left alone, `legalAllocation`
     * would have dropped whatever it reached last -- landing on the right
     * build by accident with nobody aware a point had gone. Asserted absent so
     * that putting it back has to deal with the arithmetic.
     */
    expect(profile().talents.anger_management).toBeUndefined();
  });

  it('takes the ranks the owner named', () => {
    const t = profile().talents;
    expect(t.improved_heroic_strike).toBe(3);
    expect(t.deflection).toBe(5);
    expect(t.improved_rend).toBe(3);
    expect(t.improved_charge).toBe(1);
    expect(t.deep_wounds).toBe(3);
    expect(t.impale).toBe(2);
    expect(t.shield_specialization).toBe(5);
    expect(t.anticipation).toBe(5);
    expect(t.improved_bloodrage).toBe(2);
    expect(t.last_stand).toBe(1);
    expect(t.master_of_defense).toBe(2);
    expect(t.improved_revenge).toBe(3);
    expect(t.defiance).toBe(3);
    expect(t.vanguard).toBe(1);
    expect(t.improved_shield_wall).toBe(2);
    expect(t.concussion_blow).toBe(1);
    expect(t.bastion).toBe(5);
    expect(t.focused_rage).toBe(3);
    expect(t.shield_slam).toBe(1);
  });

  it('holds Brutality Blade with Crusader, and the Immovable Object', () => {
    const equipment = profile().equipment;
    expect(equipment.mainHand).toEqual({ itemId: 228265, enchantId: 20034 });
    expect(equipment.shield).toEqual({ itemId: 19321 });
    expect(equipment.offHand).toBeUndefined();
  });

  it('runs the Protection priority list', () => {
    const p = profile();
    expect(runProfileBatch({ ...p, simulation: { ...p.simulation, iterations: 1 } }).rotationName).toBe(
      'Warrior (Shield, Defensive)',
    );
  });

  it('actually uses what the tree unlocked', () => {
    /*
     * The point of a preset: the five settings agree, so everything that waits
     * on them fires. Shield Slam needs the talent AND a shield; Last Stand
     * needs the talent and something to survive; Revenge needs to be attacked.
     */
    const p = profile();
    const batch = runProfileBatch({ ...p, simulation: { ...p.simulation, iterations: 60 } });
    const uses = (name: string) =>
      batch.abilities.find((row) => row.abilityName === name)?.uses ?? 0;

    expect(uses('Shield Slam')).toBeGreaterThan(0);
    expect(uses('Revenge')).toBeGreaterThan(0);
    expect(uses('Last Stand')).toBeGreaterThan(0);
    expect(uses('Shield Block')).toBeGreaterThan(0);
    // Taking damage, and being counted for it.
    expect(batch.survival.damageTaken).toBeGreaterThan(0);
    expect(batch.survival.deaths).toBeGreaterThan(0);
  });
});
