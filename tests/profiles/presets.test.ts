import { describe, expect, it } from 'vitest';
import {
  PRESETS_BY_ID,
  PROFILE_PRESETS,
  createDefaultProfile,
  validateProfile,
} from '../../src/profiles';
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
  it('offers the three builds, with stable ids', () => {
    expect(PROFILE_PRESETS.map((preset) => preset.id)).toEqual([
      'two_hand_arms',
      'dw_fury',
      'prot_warr',
    ]);
    expect(PROFILE_PRESETS.map((preset) => preset.label)).toEqual([
      '2H Arms',
      'DW Fury',
      'Prot Warr',
    ]);
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

  it('assumes the SAME raid for all three', () => {
    /*
     * One raid, so two presets differ by the character and not by who else
     * turned up -- which is the only way their numbers can be compared at all.
     *
     * A new profile still starts with none. That is what keeps every figure
     * measured without them comparable; a preset is a stated character, and
     * the raid is part of what it states.
     */
    const [first, ...rest] = PROFILE_PRESETS.map((preset) => preset.build().raidBuffs);
    expect(first.length).toBeGreaterThan(0);
    for (const other of rest) expect(other).toEqual(first);
    expect(createDefaultProfile().raidBuffs).toEqual([]);
  });

  it('takes the twelve the ruleset owner ticked, and no others', () => {
    /*
     * Written out by hand from the owner's own screen. What is ABSENT is
     * absent on purpose: no Arcane Intellect, Blessing of Wisdom or Mana
     * Spring Totem, because a warrior has no mana; no Trueshot Aura, whose
     * ranged attack power reaches a bow that never swings; no Grace of Air
     * Totem; no Moonkin Form, which cannot sit beside Leader of the Pack; and
     * neither curse.
     */
    expect(PRESETS_BY_ID.get('dw_fury')!.build().raidBuffs).toEqual([
      'battle_shout',
      'thunder_clap',
      'sunder_armor',
      'power_word_fortitude',
      'divine_spirit',
      'blessing_of_kings',
      'blessing_of_might',
      'faerie_fire',
      'mark_of_the_wild',
      'strength_of_earth_totem',
      'windfury_totem',
      'leader_of_the_pack',
    ]);
  });

  it('starts the target at five Sunders, so the list only refreshes', () => {
    /*
     * THE RULESET OWNER'S REASON for adding the list to the presets: with the
     * raid's five stacks already up, the warrior stops opening every fight by
     * applying five of its own and only renews what is there.
     *
     * A large change to the rage economy rather than a cosmetic one -- Sunder
     * went from 6.56 casts a fight to 2.35 on the Arms build, and Mortal
     * Strike from 1.73 to 6.92 with the rage that freed.
     */
    const p = PRESETS_BY_ID.get('two_hand_arms')!.build();
    const batch = runProfileBatch({ ...p, simulation: { ...p.simulation, iterations: 60 } });
    const sunder = batch.abilities.find((row) => row.abilityName === 'Sunder Armor');
    expect(sunder?.uses ?? 0).toBeLessThan(4);

    const uptime = batch.debuffUptime.find((row) => row.auraId === 'sunder_armor');
    expect(uptime?.uptime ?? 0).toBeGreaterThan(0.95);
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

  it('spends its points LEGALLY, whatever it spends', () => {
    /*
     * An allocation the tree accepts unchanged. `legalAllocation` stripping
     * something would mean the character that gets built is not the one that
     * was written down -- which is exactly what nearly happened to Prot Warr.
     */
    for (const preset of PROFILE_PRESETS) {
      const talents = preset.build().talents;
      const legal = legalAllocation(tree, talents);
      expect(legal.dropped, `${preset.id} dropped`).toEqual([]);
      expect(legal.allocation, preset.id).toEqual(talents);
      expect(pointsRemaining(talents), preset.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('spends all fifty-one, in every preset', () => {
    /*
     * 2H Arms came to forty-eight as first given and was left that way rather
     * than filled in, because choosing where three points went would have been
     * inventing a build. The ruleset owner named Improved Cleave.
     */
    const spent = (id: string) =>
      Object.values(PRESETS_BY_ID.get(id)!.build().talents).reduce((a, b) => a + b, 0);

    expect(TOTAL_TALENT_POINTS).toBe(51);
    for (const preset of PROFILE_PRESETS) {
      expect(spent(preset.id), preset.id).toBe(TOTAL_TALENT_POINTS);
      expect(pointsRemaining(preset.build().talents), preset.id).toBe(0);
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

// ---------------------------------------------------------------------------
// 2H Arms
// ---------------------------------------------------------------------------

describe('2H Arms', () => {
  const profile = () => PRESETS_BY_ID.get('two_hand_arms')!.build();

  it('is an Orc two-hander in Battle Stance, against a standing target', () => {
    const p = profile();
    expect(p.character.name).toBe('2H Arms');
    expect(p.character.race).toBe('orc');
    expect(p.character.combatStyle).toBe('two_hander');
    expect(p.character.stance).toBe('battle');
    expect(p.encounter.targetAttacks).toBe(false);
  });

  it('spends 38 in Arms and 13 in Fury', () => {
    // Hand-counted from the owner's list.
    const talents = profile().talents;
    const inTree = (id: string) =>
      Object.entries(talents)
        .filter(([talentId]) => tree.byId.get(talentId)?.tree === id)
        .reduce((total, rank) => total + rank[1], 0);

    expect(inTree('arms')).toBe(38);
    expect(inTree('fury')).toBe(13);
    expect(inTree('protection')).toBe(0);
    expect(pointsRemaining(talents)).toBe(0);
  });

  it('spends its last three on Improved Cleave, which does nothing here', () => {
    /*
     * The ruleset owner's choice for the three the list was short. Worth a
     * test of its own because it changes no number in a result: Improved
     * Cleave reduces Cleave's rage cost, and CLEAVE IS IN NO PRIORITY LIST --
     * it is an on-next-swing ability for hitting two targets, and every
     * encounter here has one.
     *
     * Its ten-point Fury requirement is met exactly by Cruelty and Unbridled
     * Wrath, so the placement is legal as well as deliberate.
     */
    expect(profile().talents.improved_cleave).toBe(3);
  });

  it('takes the ranks the owner named', () => {
    const t = profile().talents;
    expect(t.improved_heroic_strike).toBe(3);
    expect(t.improved_rend).toBe(3);
    expect(t.improved_charge).toBe(1);
    expect(t.improved_tactical_mastery).toBe(5);
    expect(t.improved_overpower).toBe(2);
    expect(t.anger_management).toBe(1);
    expect(t.deep_wounds).toBe(3);
    expect(t.spearing_strike).toBe(1);
    expect(t.two_handed_weapon_specialization).toBe(3);
    expect(t.impale).toBe(2);
    expect(t.bloodthrill).toBe(5);
    expect(t.sweeping_strikes).toBe(1);
    expect(t.weaponmaster).toBe(5);
    expect(t.improved_slam).toBe(2);
    expect(t.mortal_strike).toBe(1);
    expect(t.cruelty).toBe(5);
    expect(t.unbridled_wrath).toBe(5);
    expect(t.improved_cleave).toBe(3);
  });

  it('holds one enchanted two-hander and no off hand', () => {
    const equipment = profile().equipment;
    expect(equipment.twoHand).toEqual({ itemId: 228229, enchantId: 20034 });
    expect(equipment.mainHand).toBeUndefined();
    expect(equipment.offHand).toBeUndefined();
    expect(equipment.shield).toBeUndefined();
  });

  it('runs the Arms priority list', () => {
    const p = profile();
    expect(
      runProfileBatch({ ...p, simulation: { ...p.simulation, iterations: 1 } }).rotationName,
    ).toBe('Warrior (Two-Hander, Battle)');
  });

  it('casts the whole list, Slam and Mortal Strike included', () => {
    const p = profile();
    const batch = runProfileBatch({ ...p, simulation: { ...p.simulation, iterations: 60 } });
    const uses = (name: string) =>
      batch.abilities.find((row) => row.abilityName === name)?.uses ?? 0;

    for (const name of [
      'Sunder Armor',
      'Rend',
      'Mortal Strike',
      'Execute',
      'Spearing Strike',
      'Slam',
      'Overpower',
    ]) {
      expect(uses(name), name).toBeGreaterThan(0);
    }
    expect(batch.dps.mean).toBeGreaterThan(0);
  });

  it('does NOT cast Battle Shout, because the raid already did', () => {
    /*
     * The reuse paying off. The raid entry and the Warrior's own ability are
     * the SAME aura, so the list's "if not active" condition finds it up from
     * the pull and falls straight through -- saving a global cooldown and ten
     * rage every fight rather than stacking a second copy.
     *
     * This test asserted the opposite until the raid was added to the presets,
     * which is exactly the change that should have flipped it.
     */
    const p = profile();
    const batch = runProfileBatch({ ...p, simulation: { ...p.simulation, iterations: 40 } });
    expect(batch.abilities.find((row) => row.abilityName === 'Battle Shout')).toBeUndefined();

    const shout = batch.buffUptime.find((row) => row.auraId === 'battle_shout');
    expect(shout?.uptime ?? 0).toBeGreaterThan(0.99);
    expect(shout?.applications ?? 0).toBeCloseTo(1, 1);
  });
});
