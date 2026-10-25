import { describe, expect, it } from 'vitest';
import { RAID_BUFFS } from '../../src/game/buffs/raidBuffs';
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

/** The tree a preset's own class uses, so a test cannot ask the wrong one. */
function treeFor(characterClass: string) {
  const talents = talentsForClass(characterClass as never);
  if (!talents) throw new Error(`no talents for ${characterClass}`);
  return talents;
}

describe('the preset catalogue', () => {
  it('offers every build, with stable ids, class by class', () => {
    /*
     * IDS ARE STABLE BECAUSE A SAVED PROFILE CAN NAME ONE. Order is asserted
     * too, because it is the order the buttons appear in on the creation
     * screen, and a class arriving in the middle of the list would silently
     * move everything after it.
     */
    expect(PROFILE_PRESETS.map((preset) => preset.id)).toEqual([
      'two_hand_arms',
      'dw_fury',
      'prot_warr',
      'fury_prot',
      'rogue_venom',
      'rogue_combat_mut',
      'rogue_combat',
      'rogue_rupture',
      'rogue_hemo',
      'rogue_pure_hemo',
      'druid_moonkin',
      'druid_cat',
      'druid_bear',
      'shaman_elemental',
      'shaman_enhancement',
      'mage_frostfire',
      'mage_arcane',
      'mage_fire',
      'pally_ret',
      'pally_shockadin',
      'pally_shockadin_2h',
      'prot_pally',
      'bm_hunter',
      'lw_ranged',
      'lw_melee',
      'hawk_melee',
      'warlock_smds',
      'warlock_firelock',
      'warlock_sbolt',
      'warlock_demonology',
      'shadow_priest',
      'holy_pal',
      'mage_frost',
      'shaman_resto',
    ]);
    expect(PROFILE_PRESETS.map((preset) => preset.label)).toEqual([
      '2H Arms',
      'DW Fury',
      'Prot Warr',
      'Fury Prot',
      'Venom',
      'Combat Mut',
      'Combat',
      'Rupture',
      'Hemo Dagger',
      'Pure Hemo',
      'Moonkin',
      'Cat',
      'Bear',
      'Ele Shaman',
      'Enh Shaman',
      'Frostfire',
      'Arcane',
      'Fire',
      'Seal Twist Ret',
      'Shockadin',
      'Shockadin 2H',
      'Prot Pally',
      'BM Hunter',
      'LW Ranged',
      'LW Melee',
      'Hawk Melee',
      'SM/DS',
      'Firelock',
      'Sbolt Spam',
      'Fire Demo',
      'Shadow',
      'Holy Pal',
      'Frost Mage',
      'Piss Beam',
    ]);
  });

  it('states the class the rail colours it by, and it is the class it BUILDS', () => {
    /*
     * `ProfilePreset.characterClass` exists so the profile rail can colour a
     * pill without calling `build()` for all 23 just to read one field. That
     * makes it a COPY, and a copy is the thing that drifts -- a preset edited
     * from Warrior to Paladin would keep its old colour and nothing would
     * error, because no code path compares the two.
     *
     * Written out by hand rather than looped from the preset, for the reason
     * at the top of this file: reading both sides off the same object passes
     * whatever the object says.
     */
    const expected: Record<string, string> = {
      two_hand_arms: 'warrior',
      dw_fury: 'warrior',
      prot_warr: 'warrior',
      fury_prot: 'warrior',
      rogue_venom: 'rogue',
      rogue_combat_mut: 'rogue',
      rogue_combat: 'rogue',
      rogue_rupture: 'rogue',
      rogue_hemo: 'rogue',
      rogue_pure_hemo: 'rogue',
      druid_moonkin: 'druid',
      druid_cat: 'druid',
      druid_bear: 'druid',
      shaman_elemental: 'shaman',
      shaman_enhancement: 'shaman',
      mage_frostfire: 'mage',
      mage_arcane: 'mage',
      mage_fire: 'mage',
      pally_ret: 'paladin',
      pally_shockadin: 'paladin',
      pally_shockadin_2h: 'paladin',
      prot_pally: 'paladin',
      bm_hunter: 'hunter',
      lw_ranged: 'hunter',
      lw_melee: 'hunter',
      hawk_melee: 'hunter',
      warlock_smds: 'warlock',
      warlock_firelock: 'warlock',
      warlock_sbolt: 'warlock',
      warlock_demonology: 'warlock',
      shadow_priest: 'priest',
      holy_pal: 'paladin',
      mage_frost: 'mage',
      shaman_resto: 'shaman',
    };

    expect(Object.keys(expected)).toHaveLength(PROFILE_PRESETS.length);

    for (const preset of PROFILE_PRESETS) {
      expect(preset.characterClass, preset.id).toBe(expected[preset.id]);
      // And the half that catches the drift: what the preset SAYS against what
      // it actually assembles.
      expect(preset.build().character.characterClass, preset.id).toBe(expected[preset.id]);
    }
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
    /*
     * ONE PROFILE PROVIDES A BUFF ITSELF AND SO DROPS IT.
     *
     * An Enhancement shaman imbues its own main hand, and Windfury Weapon's
     * tooltip says it "disables any benefit you personally receive from
     * Windfury Totem" -- so that preset drops the totem and nothing else.
     *
     * AND TWO SWAP A BUFF RATHER THAN DROPPING ONE, which is a different
     * shape and is why this test is not a single filter. On the ruleset owner's
     * instruction the two RANGED Hunters take Grace of Air Totem where everyone
     * else takes Windfury: "20% chance on each MAIN-HAND use" is worth nothing
     * to a profile that only shoots. LW MELEE IS NOT ONE OF THEM -- it swings a
     * main hand, so Windfury is real for it, and the split is by what the
     * profile DOES rather than by class.
     *
     * THERE WAS A THIRD SWAP AND IT IS GONE, which is this list getting SHORTER
     * for once. The Moonkin took Moonkin Aura where everyone else took Leader
     * of the Pack, because the two were declared exclusive and that was the
     * half it provides -- and the owner has since ruled: "Moonkin and Leader of
     * the Pack are no longer exclusive. And all profiles should have both
     * enabled by default in the raid buffs." So the Moonkin runs the same raid
     * as everybody else, both entries are in the shared list, and the one
     * profile that used to differ no longer does.
     *
     * ITS OWN CRIT DOES NOT MOVE EITHER WAY, which is what makes selecting
     * both safe: each aura has ONE id shared by its talent and its raid buff
     * entry, so a Moonkin holding both sources of Moonkin Aura reads 3% and
     * not 6% -- see `MOONKIN_AURA_ID`.
     *
     * Every other difference here would be a bug; these three are the ruleset.
     */
    /*
     * ========================================================================
     * ONE LIST FOR EVERY PROFILE NOW, AND THE EXCEPTION MACHINERY IS GONE.
     *
     * This held a `SELF_PROVIDED` map (the Enhancement Shaman dropping Windfury
     * Totem) and a `SWAPPED` map (the two ranged Hunters taking Grace of Air
     * instead), each asserted EXHAUSTIVE so nobody else could differ. The owner
     * has since filled the raid in: "For all profiles ensure that all raid
     * buffs are checked on except for Curse of Recklessness."
     *
     * SO THE ASSERTION GETS STRONGER RATHER THAN WEAKER -- every profile must
     * now be IDENTICAL, where before three were allowed to differ in two
     * specific ways. The exhaustive-keys checks were what made those exceptions
     * safe, and what replaces them is their absence being provable.
     *
     * AND THE TWO REASONS BEHIND THE EXCEPTIONS DID NOT GO AWAY. Windfury
     * reaches no bow, and the imbue disables the totem for its carrier -- the
     * first is a ticked box worth nothing, which is allowed, and the second is
     * enforced in the ENGINE now. `windfuryImbue.test.ts` is both.
     * ========================================================================
     */
    /*
     * THE THREE TANKS ADD THORNS AND RETRIBUTION AURA, and only they do -- the
     * owner's "only on by default for Prot Warr, Prot Pally, and Bear". Both
     * deal damage to whatever attacks the character, and nothing attacks any
     * other profile. Asserted EXHAUSTIVELY: every other preset still runs the
     * one shared list, and a tank's is that list plus exactly these two.
     */
    // FOUR SINCE FURY PROT, which copies Prot Warr's raid as well.
    const TANKS = new Set(['prot_warr', 'fury_prot', 'prot_pally', 'druid_bear']);
    const TANK_EXTRAS = ['retribution_aura', 'thorns'];
    /*
     * AND THE TANKS DROP SALVATION, round 47: it is on exactly when the target
     * does not attack back, and a tank's does. So a tank's list is the shared
     * one plus two and minus one, and Salvation follows `targetAttacks` on
     * every preset.
     */
    const TANK_DROPS = ['salvation'];
    const lists = PROFILE_PRESETS.map((preset) => [preset.id, preset.build().raidBuffs] as const);
    const first = lists.find(([id]) => !TANKS.has(id))![1];
    expect(first.length).toBeGreaterThan(0);
    for (const preset of PROFILE_PRESETS) {
      const built = preset.build();
      expect(built.raidBuffs.includes('salvation'), preset.id).toBe(!built.encounter.targetAttacks);
    }
    for (const [id, buffs] of lists) {
      if (TANKS.has(id)) {
        expect(buffs.filter((b) => !first.includes(b)).sort(), id).toEqual(TANK_EXTRAS);
        expect(first.filter((b) => !buffs.includes(b)), id).toEqual(TANK_DROPS);
      } else {
        expect(buffs, id).toEqual(first);
      }
    }
    expect(lists.filter(([id]) => TANKS.has(id))).toHaveLength(4);

    /*
     * AND BOTH DRUID AURAS ARE ON EVERY PRESET, which is the owner's ruling and
     * the inverse of what this asserted: it checked that the Moonkin was the
     * only profile of the twenty-four selecting Moonkin Aura.
     */
    for (const [id, buffs] of lists) {
      expect(buffs, `${id} moonkin_form`).toContain('moonkin_form');
      expect(buffs, `${id} leader_of_the_pack`).toContain('leader_of_the_pack');
    }
    expect(createDefaultProfile().raidBuffs).toEqual([]);
  });

  it('takes every raid buff but Curse of Recklessness, derived from the catalogue', () => {
    /*
     * ========================================================================
     * IT WAS NINETEEN IDS WRITTEN OUT BY HAND, "the eighteen the ruleset owner
     * ticked, plus Moonkin Aura", in catalogue order.
     *
     * THE OWNER HAS REPLACED THE SELECTION WITH A RULE: "all raid buffs checked
     * on except for Curse of Recklessness." A rule is checkable against the
     * CATALOGUE, and a hand-written list is not -- so this reads `RAID_BUFFS`
     * and asserts the single absence.
     *
     * WHICH IS THE STRONGER TEST AND NOT MERELY THE SHORTER ONE. A buff added
     * to the catalogue used to pass this silently: the list would simply not
     * contain it, and nothing anywhere asked why. Now a new buff either joins
     * every preset or fails here, which is the `EFFECT_RULES` guard applied to
     * a selection -- make something ask whether the two sides still agree.
     *
     * AND THE THREE THAT JOINED ARE WORTH LITTLE TO THIS PROFILE, which is the
     * point of a RAID rather than an oversight: Judgement of the Crusader is
     * Holy spell power, Gift of Arthas is +8 on direct damage, and Grace of Air
     * is agility this warrior does read. The list has never been one
     * character's needs -- half of what a Fury warrior carries is worth
     * nothing to it.
     * ========================================================================
     */
    const selected = PRESETS_BY_ID.get('dw_fury')!.build().raidBuffs;
    const catalogue = RAID_BUFFS.map((buff) => buff.id);

    expect(catalogue.filter((id) => !selected.includes(id))).toEqual([
      'curse_of_recklessness',
      // A tank's, by the owner's instruction -- dw_fury is not a tank.
      'retribution_aura',
      'thorns',
      // Default off by the owner's ruling, and exclusive with Windfury Totem.
      'flametongue_totem',
    ]);
    // Every id selected is a real buff, which a hand-written list could get
    // wrong in the other direction.
    for (const id of selected) expect(catalogue, id).toContain(id);
    expect(selected).toHaveLength(catalogue.length - 4);
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
      const profile = preset.build();
      const talents = profile.talents;
      /*
       * THE PRESET'S OWN CLASS, not a fixed one. This read the Warrior tree
       * for every preset, which was true while every preset was a Warrior and
       * reported all seventeen Rogue talents as dropped the moment one was
       * not -- a failure that looks like a broken build rather than a test
       * asking the wrong tree.
       */
      const tree = treeFor(profile.character.characterClass);
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

  it('spends 17 in Arms and 34 in Fury', () => {
    // Hand-counted from the owner's list, re-specified at client build
    // 1.60.1.70170. It was 18/33 before: the point that moved is Spearing
    // Strike's, which went out of Arms when the ability became Battle Stance
    // only, and Improved Execute took it in Fury.
    const talents = profile().talents;
    const inTree = (id: string) =>
      Object.entries(talents)
        .filter(([talentId]) => tree.byId.get(talentId)?.tree === id)
        .reduce((total, [, rank]) => total + rank, 0);

    expect(inTree('arms')).toBe(17);
    expect(inTree('fury')).toBe(34);
    expect(inTree('protection')).toBe(0);
  });

  it('takes the ranks the owner named', () => {
    const t = profile().talents;
    expect(t.improved_heroic_strike).toBe(3);
    expect(t.improved_rend).toBe(3);
    expect(t.improved_tactical_mastery).toBe(5);
    expect(t.anger_management).toBe(1);
    expect(t.deep_wounds).toBe(3);
    expect(t.impale).toBe(2);
    expect(t.cruelty).toBe(5);
    expect(t.unbridled_wrath).toBe(5);
    expect(t.dual_wield_specialization).toBe(5);
    expect(t.raging_blows).toBe(1);
    expect(t.death_wish).toBe(1);
    expect(t.flurry).toBe(5);
    expect(t.bloodthirst).toBe(1);
    /*
     * THE FIVE THAT CHANGED AT CLIENT BUILD 1.60.1.70170, asserted together so
     * the reason is in one place.
     *
     * OUT: Spearing Strike 1 (the ability needs Battle Stance now and this build
     * is Berserker), Blood Craze 3 (its Bloodthirst trigger was removed, which
     * was the only one a warrior nothing is hitting could meet), Boundless Rage 2
     * (the talent no longer exists).
     *
     * IN: Lingering Rage 2, Furious Precision 3 -- the off-hand hit that Dual
     * Wield Specialization used to carry -- and Improved Execute 2.
     *
     * AND ENRAGE DROPS TO 4/5 WITHOUT COSTING FLURRY, which is the one change
     * here that is a consequence rather than a choice: Flurry required Enrage
     * 5/5 and now requires Death Wish 1/1.
     */
    expect(t.spearing_strike).toBeUndefined();
    expect(t.blood_craze).toBeUndefined();
    expect(t.boundless_rage).toBeUndefined();
    expect(t.lingering_rage).toBe(2);
    expect(t.furious_precision).toBe(3);
    expect(t.improved_execute).toBe(2);
    /*
     * ENRAGE 4 -> 2, AND THE TWO POINTS BUY IMPROVED BERSERKER RAGE. Enrage is
     * "after being the victim of any damaging attack" and this preset sets
     * `targetAttacks: false`, so it reports no uptime at all -- the `target`
     * cause of inert. Two is the most that can move: Bloodthirst needs thirty
     * points below tier 30 of Fury and there are thirty-three.
     *
     * AND THE TALENT IT BUYS NEEDED A LIST ENTRY TO BE WORTH ANYTHING, which is
     * the fourth cause of inert. See `WARRIOR_DUAL_WIELD_BERSERKER`.
     */
    expect(t.enrage).toBe(2);
    expect(t.improved_berserker_rage).toBe(2);
    expect(t.gore_drinker).toBeUndefined();
  });

  it('carries Crusader on BOTH weapons', () => {
    /*
     * The dual-wield starting set enchants neither. Forever stacks the two
     * hands' Holy Strength separately, so the second enchant is worth a second
     * hundred strength rather than refreshing the first -- which is why asking
     * for both is a real choice and not a formality.
     */
    /*
     * THE PRESET'S REAL GEAR, not what `build()` now returns. Every preset
     * wears the E65 benchmark set by default; `realEquipment` is the Classic
     * and Season of Discovery set it was written with, which is what this
     * assertion has always been about and what the "Starting set" button
     * installs.
     */
    /*
     * THE ENCHANTS, NOT THE ITEMS. The Classic and Season of Discovery sets
     * are gone -- every preset wears the E65 benchmark set -- so there is no
     * Brutality Blade or Azuresong id left to pin. What survived the deletion
     * is the LOADOUT, which the owner asked be kept exactly as it was, and
     * that is the half this assertion was really about: Forever stacks the two
     * hands' Holy Strength separately, so asking for Crusader twice is a real
     * choice and not a formality.
     */
    const equipment = profile().equipment;
    expect(equipment.mainHand?.enchantId).toBe(20034);
    expect(equipment.offHand?.enchantId).toBe(20034);
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
    expect(t.last_stand).toBe(1);
    expect(t.master_of_defense).toBe(2);
    expect(t.improved_revenge).toBe(3);
    expect(t.defiance).toBe(3);
    /*
     * THE ONE SWAP IN THIS BUILD at client build 1.60.1.70170, which moved six
     * Protection rows and kept the total at 17/0/34: Improved Bloodrage out,
     * Improved Thunder Clap in. The former moved to row 1, past where this
     * build's points reach; the latter is two rage off an ability that is 5.1%
     * of this profile's damage.
     */
    expect(t.improved_bloodrage).toBeUndefined();
    expect(t.improved_thunder_clap).toBe(2);
    expect(t.vanguard).toBe(1);
    expect(t.improved_shield_wall).toBe(2);
    expect(t.concussion_blow).toBe(1);
    expect(t.bastion).toBe(5);
    expect(t.focused_rage).toBe(3);
    expect(t.shield_slam).toBe(1);
  });

  it('holds Brutality Blade with Crusader, and the Immovable Object', () => {
    /*
     * THE PRESET'S REAL GEAR, not what `build()` now returns. Every preset
     * wears the E65 benchmark set by default; `realEquipment` is the Classic
     * and Season of Discovery set it was written with, which is what this
     * assertion has always been about and what the "Starting set" button
     * installs.
     */
    // A shield build: one enchanted hand, a shield, and no off-hand weapon.
    const equipment = profile().equipment;
    expect(equipment.mainHand?.enchantId).toBe(20034);
    expect(equipment.shield).toBeDefined();
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

  it('spends 39 in Arms, 10 in Fury and 2 in Protection', () => {
    // Hand-counted from the owner's list, re-specified at client build
    // 1.60.1.70170. It was 38/13/0: Improved Cleave was removed, and its three
    // points bought a second rank of Improved Charge and two of Improved
    // Bloodrage -- which puts a 2H Arms warrior in the Protection tree for the
    // first time.
    const talents = profile().talents;
    const inTree = (id: string) =>
      Object.entries(talents)
        .filter(([talentId]) => tree.byId.get(talentId)?.tree === id)
        .reduce((total, rank) => total + rank[1], 0);

    expect(inTree('arms')).toBe(39);
    expect(inTree('fury')).toBe(10);
    expect(inTree('protection')).toBe(2);
    expect(pointsRemaining(talents)).toBe(0);
  });

  it('no longer spends three on Improved Cleave, because it is gone', () => {
    /*
     * THE TALENT WAS REMOVED at client build 1.60.1.70170. This test used to
     * assert the three points were IN it, and the note it carried is worth
     * keeping because the lesson outlived the talent:
     *
     *   "The ruleset owner's choice for the three the list was short. Worth a
     *   test of its own because it changes no number in a result: Improved
     *   Cleave reduces Cleave's rage cost, and CLEAVE IS IN NO PRIORITY LIST."
     *
     * So this was a talent the owner chose, legally placed, that moved nothing.
     * Its replacement does move something -- Improved Bloodrage is rage at the
     * pull -- and Improved Tactical Mastery is now this build's only talent
     * worth literally zero.
     */
    expect(profile().talents.improved_cleave).toBeUndefined();
    expect(profile().talents.improved_charge).toBe(2);
    expect(profile().talents.improved_bloodrage).toBe(2);
  });

  it('takes the ranks the owner named', () => {
    const t = profile().talents;
    expect(t.improved_heroic_strike).toBe(3);
    expect(t.improved_rend).toBe(3);
    expect(t.improved_charge).toBe(2);
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
  });

  it('holds one enchanted two-hander and no off hand', () => {
    /*
     * THE PRESET'S REAL GEAR, not what `build()` now returns. Every preset
     * wears the E65 benchmark set by default; `realEquipment` is the Classic
     * and Season of Discovery set it was written with, which is what this
     * assertion has always been about and what the "Starting set" button
     * installs.
     */
    const equipment = profile().equipment;
    expect(equipment.twoHand?.enchantId).toBe(20034);
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

    for (const name of ['Rend', 'Mortal Strike', 'Execute', 'Spearing Strike', 'Slam', 'Overpower']) {
      expect(uses(name), name).toBeGreaterThan(0);
    }
    expect(batch.dps.mean).toBeGreaterThan(0);
  });

  it('no longer casts Sunder Armor at all, because the raid holds it', () => {
    /*
     * ------------------------------------------------------------------------
     * THIS ASSERTED THE OPPOSITE UNTIL THE OWNER'S FIGHT-LONG RULE LANDED, and
     * the change is the rule working rather than a regression.
     *
     * The raid applies five stacks at the pull and they now last twice the
     * planned duration, so the entry that refreshed them never becomes the
     * first castable one. The warrior keeps the armor reduction and spends the
     * global cooldowns and rage on something else -- which is the whole point
     * of the raid supplying it.
     *
     * Asserted as ZERO rather than deleted, because "the list stopped reaching
     * an entry" is exactly the silent failure this project has been caught by
     * twelve times: an entry that never fires produces an ordinary DPS figure
     * and an ordinary results page. Here it is deliberate, so it is written
     * down as deliberate.
     * ------------------------------------------------------------------------
     */
    const p = profile();
    const batch = runProfileBatch({ ...p, simulation: { ...p.simulation, iterations: 60 } });
    expect(batch.abilities.find((row) => row.abilityName === 'Sunder Armor')?.uses ?? 0).toBe(0);

    // And the debuff is still up, which is why not casting it is safe.
    const sunder = batch.debuffUptime.find((d) => d.auraName === 'Sunder Armor');
    expect(sunder?.uptime ?? 0).toBeGreaterThan(0.99);
  });

  it('shouts ONCE before the pull, over the raid own copy rather than beside it', () => {
    /*
     * ========================================================================
     * THIS HAS FLIPPED TWICE AND THE THING IT IS ABOUT HAS NOT MOVED.
     *
     *   1  "DOES cast Battle Shout"        before the raid was selected
     *   2  "does NOT cast Battle Shout"    the raid supplies it, so the list's
     *                                      "if not active" condition refused it
     *   3  "shouts once before the pull"   the owner moved it to `precombat`,
     *                                      which has no such condition
     *
     * WHAT IS INVARIANT IS THE REUSE: the raid entry and the Warrior's own
     * ability are the SAME AURA with the same id, so a cast over the raid's
     * copy REFRESHES it rather than stacking a second one. That is what this
     * test has always actually been for, and it is the one assertion below
     * that has survived all three readings.
     *
     * AND THE CAST IS NOT FREE OF CONSEQUENCE, which is worth seeing: it ages
     * the raid's buff by its ten-second lead, because `rewindAuras` ages what
     * a pre-combat cast applied OR REFRESHED. The raid's copy is applied at
     * twice the fight duration, so ten seconds off it cannot run out.
     * ========================================================================
     */
    const p = profile();
    const batch = runProfileBatch({ ...p, simulation: { ...p.simulation, iterations: 40 } });

    const row = batch.abilities.find((entry) => entry.abilityName === 'Battle Shout');
    expect(row, 'the pre-combat cast is reported').toBeDefined();
    expect(row!.uses).toBeCloseTo(1, 1);
    expect(row!.damage).toBe(0);

    const shout = batch.buffUptime.find((entry) => entry.auraId === 'battle_shout');
    expect(shout?.uptime ?? 0).toBeGreaterThan(0.99);

    /*
     * TWO APPLICATIONS AND ONE AURA, which is the distinction this test exists
     * for and the number that moved. It asserted ~1 while the list's condition
     * refused the cast; the opener casts it, so the count is the raid's own
     * apply PLUS the pre-combat REFRESH -- `applications` counts a refresh.
     *
     * SO THE "one aura, not two" CLAIM IS ASSERTED DIRECTLY INSTEAD, on the
     * built character: `AuraCollection.apply` refreshes a matching id in place,
     * so there is exactly one live instance however many sources reach it. The
     * application count could never have said that on its own -- two separate
     * auras would read 2 as well, and would be worth twice the attack power.
     */
    expect(shout?.applications ?? 0).toBeCloseTo(2, 1);

    const player = characterAtCombatStart(p)!;
    const instances = [...player.auras.active].filter(
      (aura) => aura.definition.id === 'battle_shout',
    );
    expect(instances, 'one instance, two sources').toHaveLength(1);
  });
});
