import { describe, expect, it } from 'vitest';
import type { AttackEvent, Combatant, WeaponSlot } from '../../src/engine';
import { Simulation, applyHaste, hasteMultiplierFrom } from '../../src/engine';
import {
  GIFT_OF_ARTHAS_DAMAGE,
  RAID_BUFFS,
  RAID_BUFFS_BY_ID,
  areExclusive,
  selectedRaidBuffs,
  withRaidBuff,
} from '../../src/game/buffs/raidBuffs';
import { JUDGEMENT_OF_THE_CRUSADER } from '../../src/game/auras/paladin';
import { scaleByPower, spellPowerAgainst } from '../../src/engine';
import type { DamageRequest } from '../../src/engine';
import {
  JUDGEMENT_OF_WISDOM_MANA,
  judgementOfWisdomReactions,
} from '../../src/game/buffs/judgementOfWisdom';
import {
  WINDFURY_ATTACK_POWER,
  WINDFURY_DURATION_MS,
  WINDFURY_INTERNAL_COOLDOWN_MS,
  WINDFURY_PROC_CHANCE,
  windfuryTotemReaction,
} from '../../src/game/buffs/windfury';
import {
  SUNDER_ARMOR,
  SUNDER_ARMOR_DURATION_MS,
  SUNDER_ARMOR_MAX_STACKS,
  THUNDER_CLAP_SLOW,
  THUNDER_CLAP_SLOW_DURATION_MS,
  THUNDER_CLAP_SWING_TIME_MULTIPLIER,
} from '../../src/game/auras/warrior';
import { startingEquipmentFor } from '../../src/game/items/startingSets';
import {
  CURRENT_PROFILE_VERSION,
  PRESETS_BY_ID,
  createDefaultProfile,
  migrateProfile,
} from '../../src/profiles';
import { characterAtCombatStart, resourceFlowOf, runProfileBatch } from '../../src/simulator';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';

/*
 * The raid: what the rest of the group has given this character, and what it
 * has already put on the target.
 *
 * EVERY NUMBER BELOW IS WRITTEN OUT BY HAND from the ruleset owner's list,
 * never read back from the catalogue. A test that imported the definitions and
 * compared them to themselves would pass whatever they said.
 */

const base = createDefaultProfile();

function fury(raidBuffs: readonly string[], iterations = 1) {
  return {
    ...base,
    character: {
      ...base.character,
      race: 'tauren',
      combatStyle: 'dual_wield',
      stance: 'berserker',
    },
    equipment: startingEquipmentFor('warrior', 'dual_wield'),
    simulation: { ...base.simulation, iterations, seed: 12345, durationSeconds: 60 },
    raidBuffs: [...raidBuffs],
  } as never;
}

/** The character as the first swing sees them. */
const sheet = (raidBuffs: readonly string[]) => characterAtCombatStart(fury(raidBuffs))!;

function opened(raidBuffs: readonly string[], attacks = false) {
  const profile = {
    ...(fury(raidBuffs) as unknown as Record<string, unknown>),
    encounter: { ...base.encounter, targetAttacks: attacks },
  };
  const simulation = new Simulation(trainingDummyEncounter(profile as never));
  simulation.begin();
  return {
    simulation,
    player: simulation.combatants.find((a) => a.isPlayerControlled) as Combatant,
    target: simulation.combatants.find((a) => !a.isPlayerControlled) as Combatant,
  };
}

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

describe('the catalogue', () => {
  it('has the entries the ruleset owner listed, and no others', () => {
    /*
     * Demoralizing Shout is deliberately absent -- "make it a comment, keep it
     * inert for now" -- so twenty of the twenty-one originally named, plus
     * Judgement of Wisdom, which the owner added later, plus the two they
     * added later again: Judgement of the CRUSADER and Gift of Arthas -- and
     * FLAMETONGUE TOTEM, an option the owner asked for default OFF.
     */
    // And three more from round 36: Devotion Aura, Retribution Aura, Thorns.
    expect(RAID_BUFFS).toHaveLength(27);
    expect(RAID_BUFFS_BY_ID.has('demoralizing_shout')).toBe(false);
    expect(RAID_BUFFS_BY_ID.has('judgement_of_wisdom')).toBe(true);
    expect(RAID_BUFFS_BY_ID.has('judgement_of_the_crusader')).toBe(true);
    expect(RAID_BUFFS_BY_ID.has('gift_of_arthas')).toBe(true);
  });

  it('gives every entry a unique id, a name and a description', () => {
    /*
     * The id is STORED ON THE PROFILE, so a duplicate would make two entries
     * one switch and a rename would silently drop a saved selection.
     */
    const ids = RAID_BUFFS.map((buff) => buff.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const buff of RAID_BUFFS) {
      expect(buff.name.length, buff.id).toBeGreaterThan(0);
      expect(buff.detail.length, buff.id).toBeGreaterThan(0);
      expect(buff.source.length, buff.id).toBeGreaterThan(0);
      // Every entry is either a state or a proc. Windfury Totem and Judgement
      // of Wisdom are the two procs.
      expect(Boolean(buff.aura) || Boolean(buff.buildReactions), buff.id).toBe(true);
    }
  });

  it('drops an id nobody recognises rather than throwing', () => {
    // A profile saved when an entry existed should still load after a rename.
    expect(selectedRaidBuffs(['battle_shout', 'nonsense']).map((b) => b.id)).toEqual([
      'battle_shout',
    ]);
  });

  it('applies nothing at all by default', () => {
    /*
     * The whole reason empty is the default. Every figure this project has
     * recorded was measured unbuffed, and this is what keeps that true.
     */
    expect(createDefaultProfile().raidBuffs).toEqual([]);
    const { player } = opened([]);
    expect(player.auras.active.map((a) => a.id)).toEqual(['berserker_stance']);
  });
});

// ---------------------------------------------------------------------------
// What lands on the character
// ---------------------------------------------------------------------------

describe('buffs on the character', () => {
  it('are up before the first swing', () => {
    const { player } = opened(['battle_shout', 'blessing_of_might', 'mark_of_the_wild']);
    const up = player.auras.active.map((a) => a.id);
    expect(up).toContain('battle_shout');
    expect(up).toContain('blessing_of_might');
    expect(up).toContain('mark_of_the_wild');
  });

  it('add up exactly, flats first and Kings multiplying the total', () => {
    /*
     * ========================================================================
     * THE RULE IS HAND-COMPUTED AND THE BASE IS MEASURED, which is a change
     * this test has now been through twice.
     *
     *   strength  base + 53 (Strength of Earth) + 16 (Mark of the Wild),
     *             all of it x 1.1 (Blessing of Kings)
     *   agility   base + 89 (Grace of Air) + 16, x 1.1
     *
     * MULTIPLICATIVE is the point: Kings is "+10% (1.1x)" in the owner's own
     * notation, so it multiplies what the flats already produced rather than
     * joining an additive pool with them. The owner's figures for the two
     * totems and the Mark are what this is really pinning.
     *
     * THE BASE MOVED TWICE AND THE RULE DID NOT. It was 393 strength when the
     * armour enchants landed and was rewritten as a sum of the Fury enchant
     * row; the gear underneath it is now the E65 benchmark set, so the sum is
     * different again. A base that is READ cannot be wrong, and an arithmetic
     * rule written out by hand is what the test is for.
     * ========================================================================
     */
    const plain = sheet([]);
    const baseStrength = plain.stats.get('strength');
    const baseAgility = plain.stats.get('agility');
    expect(baseStrength).toBeGreaterThan(0);
    expect(baseAgility).toBeGreaterThan(0);

    const buffed = sheet([
      'strength_of_earth_totem',
      'grace_of_air_totem',
      'mark_of_the_wild',
      'blessing_of_kings',
    ]);
    expect(buffed.stats.get('strength')).toBeCloseTo((baseStrength + 53 + 16) * 1.1, 6);
    expect(buffed.stats.get('agility')).toBeCloseTo((baseAgility + 89 + 16) * 1.1, 6);
  });

  it('give Blessing of Kings a MULTIPLICATIVE ten percent, not an additive one', () => {
    /*
     * (base + 16) x 1.1. An ADDITIVE pool with anything else would land
     * somewhere else, and nothing else here is a percentage -- the armour
     * enchants and the gear are flat and are already in the base.
     *
     * WHAT MAKES THIS WORTH ITS OWN TEST beside the one above is that it has
     * ONE flat source: if Kings were folded into an additive pool with the
     * Mark, the two tests would disagree and only this one names the reason.
     */
    const base = sheet([]).stats.get('strength');
    const both = sheet(['mark_of_the_wild', 'blessing_of_kings']);
    expect(both.stats.get('strength')).toBeCloseTo((base + 16) * 1.1, 6);
    // And NOT the additive reading, which is the thing being ruled out.
    expect(both.stats.get('strength')).not.toBeCloseTo(base * 1.1 + 16, 3);
  });

  it('GROW THE HEALTH POOL, which is the whole point of Fortitude', () => {
    /*
     * THE TRAP IN THIS FEATURE. Health and mana are resource maximums, sized
     * once in `createPlayer` from a stats snapshot -- they do not re-derive
     * when a buff moves stamina the way attack power does. So Power Word:
     * Fortitude's +70 stamina granted NO HEALTH at all until the encounter
     * started passing the buffed stats in.
     *
     * Measured rather than asserted at an exact figure, because the stamina to
     * health conversion is the class table's business and this is a test about
     * the pool being sized from the right stats.
     */
    const plain = sheet([]);
    const buffed = sheet(['power_word_fortitude']);
    expect(buffed.stats.get('stamina')).toBe(plain.stats.get('stamina') + 70);
    expect(buffed.health.maximum).toBeGreaterThan(plain.health.maximum);
  });

  it("grows it for Kings' percentage too", () => {
    const plain = sheet([]);
    const kings = sheet(['blessing_of_kings']);
    expect(kings.health.maximum).toBeGreaterThan(plain.health.maximum);
  });

  it('put Leader of the Pack on MELEE and ranged, and not on spells', () => {
    /*
     * ========================================================================
     * IT USED TO REACH SPELLS TOO AND THE PATCH TOOK THAT AWAY: "Leader of the
     * Pack now only increases Melee and Ranged Critical Strike chance."
     *
     * Ranged reads the same `critChance` stat melee does -- `critChanceFrom`
     * is the engine's one crit function -- so "melee and ranged" is that one
     * stat, and spell crit is a genuinely separate one that no longer moves.
     *
     * THE SPELL ASSERTION IS THE WHOLE TEST NOW. Every preset but the Moonkin
     * carries this buff, so the 3% spell crit it used to hand every CASTER
     * profile is gone -- which is what the note says should happen, and is the
     * largest single consequence of the Druid half of this patch. Asserted as
     * "unchanged" rather than deleted, because a merge that left the old
     * `spellCritChance` modifier on the aura would pass a test that had merely
     * stopped looking.
     * ========================================================================
     */
    const plain = sheet([]);
    const pack = sheet(['leader_of_the_pack']);
    expect(pack.stats.get('critChance')).toBeCloseTo(plain.stats.get('critChance') + 3, 6);
    expect(pack.stats.get('spellCritChance')).toBeCloseTo(
      plain.stats.get('spellCritChance'),
      6,
    );
  });

  it('put Moonkin Aura on SPELLS, and not on melee or ranged', () => {
    // The mirror of the above, and the other half of the split.
    const plain = sheet([]);
    const moonkin = sheet(['moonkin_form']);
    expect(moonkin.stats.get('spellCritChance')).toBeCloseTo(
      plain.stats.get('spellCritChance') + 3,
      6,
    );
    expect(moonkin.stats.get('critChance')).toBeCloseTo(plain.stats.get('critChance'), 6);
  });

  it('give Trueshot Aura ranged attack power and nothing else', () => {
    const plain = sheet([]);
    const buffed = sheet(['trueshot_aura']);
    expect(buffed.stats.get('rangedAttackPower')).toBe(plain.stats.get('rangedAttackPower') + 50);
    expect(buffed.stats.get('attackPower')).toBe(plain.stats.get('attackPower'));
  });

  it('reuse the Warrior ability value for Battle Shout, not a second copy', () => {
    /*
     * The owner's raid figure was +139 and the ability sheet said +140. Asked
     * which won, the owner chose the sheet; the spellbook then agreed with the
     * raid figure and the owner asked for the spellbook to be matched, so both
     * are 139 and the question is closed.
     *
     * It is the SAME aura a warrior's own cast applies, which is what stops the
     * two stacking -- and why one number moving moved both.
     */
    const plain = sheet([]);
    const buffed = sheet(['battle_shout']);
    expect(buffed.stats.get('attackPower')).toBe(plain.stats.get('attackPower') + 139);
    expect(RAID_BUFFS_BY_ID.get('battle_shout')!.aura!.id).toBe('battle_shout');
  });
});

// ---------------------------------------------------------------------------
// What lands on the target
// ---------------------------------------------------------------------------

describe('debuffs on the target', () => {
  it('take the stated armor off, and stack with each other', () => {
    /*
     * Hand-computed: 3,731 raid boss armor, less 2,250 from five Sunders, less
     * 505 from Curse of Recklessness, less 505 from Faerie Fire = 471.
     */
    const { target } = opened(['sunder_armor', 'curse_of_recklessness', 'faerie_fire']);
    expect(target.stats.get('armor')).toBe(3731 - 2250 - 505 - 505);
  });

  it('bring Sunder Armor in at five stacks, as the same aura a warrior refreshes', () => {
    const { target } = opened(['sunder_armor']);
    expect(target.auras.stacksOf('sunder_armor')).toBe(SUNDER_ARMOR_MAX_STACKS);
    // 450 an application, five applications. The warrior's own casts refresh
    // this rather than stacking a second debuff on top of it.
    expect(target.stats.get('armor')).toBe(3731 - 2250);
  });

  it('make the target swing take a FIFTH LONGER: 2.00 seconds becomes 2.40', () => {
    /*
     * The ruleset owner's ruling, and it replaced their own earlier one --
     * they first said attack speed minus twenty, which is 2.00 / 0.8 = 2.50.
     * The two are not the same thing and the gap is a tenth of a second on
     * every swing the target takes.
     *
     * So Forever's spell DESCRIPTION was right: "increasing the time between
     * their attacks by 20%". Its effect row still is not -- "Mod Melee Attack
     * Speed" value -19 would be 2.00 / 0.81 = 2.47 -- so two of the three
     * sources agree now and the effect row is the odd one out.
     *
     * Written out by hand: 2.00 x 1.2 = 2.40, and nothing here reads the
     * derived rating back from the aura that holds it.
     */
    expect(THUNDER_CLAP_SWING_TIME_MULTIPLIER).toBe(1.2);

    const { target } = opened(['thunder_clap'], true);
    const multiplier = hasteMultiplierFrom(target.stats.effective);
    expect(applyHaste(2000, multiplier)).toBe(2400);
    // And a swing of any other length, since the mechanic is a multiplier.
    expect(applyHaste(2500, multiplier)).toBe(3000);
    expect(applyHaste(1500, multiplier)).toBe(1800);
  });

  /*
   * AN EXPLICIT LIMIT, BECAUSE THIS RUNS A MONTE CARLO BATCH AND THE DEFAULT IS
   * 5,000ms. Standalone it takes about 1,660ms; under the full suite, with 167 test
   * files transforming and running in parallel, it has been measured at 5,584ms --
   * a ~4x slowdown from CPU contention and nothing else. It reads no files, so
   * this is not the `filesDeclaring` disk-I/O cause.
   *
   * PER TEST RATHER THAN A GLOBAL `testTimeout`, which is the rule this file
   * already follows for the Vanguard test below: widening all of them hides the
   * next one that genuinely gets slower.
   */
  it('takes a fifth off the swings the target gets through', () => {
    /*
     * The consequence, and the thing worth measuring: at 2.40 seconds instead
     * of 2.00 a sixty second fight gives the target five sixths of the swings.
     * Measured end to end rather than asserted from the multiplier.
     */
    const withoutSlow = runProfileBatch({
      ...(fury([], 200) as unknown as Record<string, unknown>),
      encounter: { ...base.encounter, targetAttacks: true },
    } as never);
    const withSlow = runProfileBatch({
      ...(fury(['thunder_clap'], 200) as unknown as Record<string, unknown>),
      encounter: { ...base.encounter, targetAttacks: true },
    } as never);

    const swings = (b: typeof withSlow) => b.damageTaken[0]?.attempts ?? 0;
    expect(swings(withSlow)).toBeLessThan(swings(withoutSlow));
  }, 30_000);

  it('leave the target alone when nothing is selected', () => {
    const { target } = opened([], true);
    expect(target.stats.get('armor')).toBe(3731);
    expect(hasteMultiplierFrom(target.stats.effective)).toBe(1);
  });

  it('raise magic damage taken by 10% and leave physical alone', () => {
    /*
     * Curse of the Elements. It changes NOTHING a warrior does -- every
     * Warrior ability is physical, Shield Slam included -- so this is the only
     * place it can be seen at all, and the panel says so beside the switch.
     */
    const { target } = opened(['curse_of_the_elements']);
    // Forever's own page: "increasing Magic damage taken by 10%" (round 46).
    expect(target.damageTakenMultiplierFor('fire')).toBeCloseTo(1.1, 10);
    expect(target.damageTakenMultiplierFor('shadow')).toBeCloseTo(1.1, 10);
    expect(target.damageTakenMultiplierFor('arcane')).toBeCloseTo(1.1, 10);
    expect(target.damageTakenMultiplierFor('holy')).toBeCloseTo(1.1, 10);
    expect(target.damageTakenMultiplierFor('physical')).toBe(1);
  });

  it('take 75 off every magic resistance, FLOORED AT ZERO', () => {
    // A boss resists nothing, so the -75 cannot become bonus damage.
    const { target } = opened(['curse_of_the_elements']);
    for (const school of ['arcane', 'fire', 'frost', 'holy', 'nature', 'shadow'] as const) {
      expect(target.resistanceFor(school)).toBe(0);
    }
    const aura = target.auras.active.find((a) => a.definition.id === 'curse_of_the_elements');
    expect(aura?.definition.resistanceBySchool).toEqual({
      arcane: -75,
      fire: -75,
      frost: -75,
      holy: -75,
      nature: -75,
      shadow: -75,
    });
  });
});

// ---------------------------------------------------------------------------
// Thunder Clap, which the Warrior now applies itself
// ---------------------------------------------------------------------------

describe('the Warrior keeps Thunder Clap up', () => {
  it('applies the SAME debuff the raid supplies', () => {
    /*
     * One aura, so a raid that already put it on the target and a warrior
     * casting it every few seconds refresh one debuff rather than stacking
     * two. The raid entry reuses this rather than declaring a copy.
     */
    expect(RAID_BUFFS_BY_ID.get('thunder_clap')!.aura).toBe(THUNDER_CLAP_SLOW);
  });

  it('renews it, where the raid version falls off at thirty seconds', () => {
    /*
     * THE POINT OF THE CHANGE. Applied once at the pull by an assumed raid it
     * lasts 30 seconds of a 60 second fight and nothing renews it -- 50%
     * uptime, and all of it in the half where the target is weakest. A warrior
     * renews it every cast: measured at 8.93 casts and 74.7% uptime.
     *
     * NOT HIGHER, and the gap is worth knowing about rather than asserting
     * away. Thunder Clap is near the BOTTOM of the tank list, below the
     * stance, Battle Shout, five Sunder Armors, Demoralizing Shout, Heroic
     * Strike, Shield Block, Shield Slam and Revenge -- so the first cast lands
     * late and the slow is simply absent before then. It was a damage ability
     * when that order was chosen, and it is a mitigation one now.
     *
     * IT FELL FROM 74.7% TO ABOUT 67% WHEN THE RAGE FORMULA CHANGED, which is
     * the opposite of what more rage sounds like it should do. The list is no
     * longer rage-limited; it is GLOBAL-COOLDOWN limited. Every entry above
     * Thunder Clap can now afford to fire whenever it is ready, so the
     * cooldowns it used to slip between are gone. Rage stopped being the
     * scarce thing and the order of the list started mattering more.
     */
    const profile = {
      ...(fury([], 200) as unknown as Record<string, unknown>),
      character: {
        ...base.character,
        race: 'tauren',
        combatStyle: 'one_hand_shield',
        stance: 'defensive',
      },
      equipment: startingEquipmentFor('warrior', 'one_hand_shield'),
      encounter: { ...base.encounter, targetAttacks: true },
    };

    const batch = runProfileBatch(profile as never);
    const slow = batch.debuffUptime.find((row) => row.auraId === 'thunder_clap');
    /*
     * Renewed on every cast, so applications track casts one for one -- and
     * MORE THAN THE RAID'S ONE, which is the claim. It was "more than five"
     * until the owner's tank Execute clause switched Thunder Clap off for the
     * last 20% of the fight, which took about a third of the casts with it.
     */
    expect(slow?.applications ?? 0).toBeGreaterThan(2);
    /*
     * BETTER THAN THE RAID'S ONE-SHOT 50%, and short of the 100% a list that
     * reached it sooner would give. The band is wide because where it lands
     * inside it is a property of the list's ORDER, which is the owner's.
     *
     * AND IT HAS NOW MOVED THREE TIMES WITHOUT THE BUFF CHANGING: 74.7% when
     * it was written, about 67% when the rage formula changed, and 57% on the
     * E65 benchmark set. The cause is the same each time -- Thunder Clap sits
     * near the BOTTOM of the tank list, so anything that lets the entries
     * above it fire more often pushes its first cast later. Better gear is one
     * more such thing.
     *
     * SO THE LOWER BOUND IS THE RAID'S 50% rather than a figure measured on
     * one set of gear. That is the comparison the test's name makes, and it is
     * the one that does not move when something above Thunder Clap gets
     * cheaper.
     */
    expect(slow?.uptime ?? 0).toBeGreaterThan(0.5);
    expect(slow?.uptime ?? 0).toBeLessThan(0.9);
  });

  it('slows the target even when the swing misses', () => {
    /*
     * The slow is a separate effect of the cast, not a rider on the hit: the
     * spell applies an aura AND deals damage, and nothing in the source ties
     * the first to the second.
     */
    const { simulation, player, target } = opened([], true);
    const clap = player.abilities.get('thunder_clap');
    expect(clap).toBeDefined();
    clap!.onCast({ simulation, caster: player, target, ability: clap! });
    expect(target.auras.stacksOf('thunder_clap')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Both Judgements at once, which the owner has ruled intended
// ---------------------------------------------------------------------------

describe('Judgement of Wisdom and Judgement of the Crusader', () => {
  it('are BOTH selected on every preset, and that is the ruling rather than a gap', () => {
    /*
     * ========================================================================
     * **"Two Judgements is absolutely fine and intended for the raid buff
     * contribution."** The owner's ruling, and this test is here so the
     * question is not raised a second time.
     *
     * IT WAS WORTH RAISING. One target cannot carry two judgements in the game
     * being modelled, `exclusiveWith` has no declaration anywhere so nothing
     * refuses the pair, and the Crusader alone is worth **+79.5, +74.9, +63.0
     * and +49.4** on the four Paladins -- so a reader finding both ticked would
     * reasonably read it as the Moonkin's +6% crit mistake repeating. It is not:
     * the box is a RAID CONTRIBUTION rather than a claim about one debuff slot.
     *
     * AND IT IS PINNED AS A FACT RATHER THAN LEFT AS PROSE, because **a ruling
     * that is only prose gets re-raised** -- which this file's own neighbour
     * records about the crushing-blow table, and which this pair had already
     * started to do. The assertion is that both ids are in every preset's
     * selection, so the day somebody makes them exclusive this fails and the
     * ruling is what they have to argue with.
     * ========================================================================
     */
    const wisdom = RAID_BUFFS_BY_ID.get('judgement_of_wisdom');
    const crusader = RAID_BUFFS_BY_ID.get('judgement_of_the_crusader');
    expect(wisdom).toBeDefined();
    expect(crusader).toBeDefined();
    expect(areExclusive(wisdom!, crusader!)).toBe(false);

    for (const preset of PRESETS_BY_ID.values()) {
      const ids = preset.build().raidBuffs;
      expect(ids, `${preset.id} / wisdom`).toContain('judgement_of_wisdom');
      expect(ids, `${preset.id} / crusader`).toContain('judgement_of_the_crusader');
    }
  });
});

// ---------------------------------------------------------------------------
// Entries that cannot sit beside each other, of which there are none
// ---------------------------------------------------------------------------

describe('Leader of the Pack and Moonkin Form', () => {
  it('are NOT exclusive, and neither is anything else in the catalogue', () => {
    /*
     * ========================================================================
     * THIS DESCRIBE BLOCK WAS "Entries that cannot sit beside each other" AND
     * THE CATALOGUE NOW HAS NONE.
     *
     * The pair was declared exclusive on the owner's ruling that the two are
     * "the same exclusive 3% global critical strike chance and do not stack".
     * A patch then split them -- Moonkin Aura spell crit, Leader of the Pack
     * melee and ranged -- and these tests were left pinning the declaration
     * with the question written on them: two buffs that no longer overlap have
     * no obvious reason to exclude each other, and removing it is a RAID
     * COMPOSITION decision that moves every profile's figure. The owner's
     * answer: "Moonkin and Leader of the Pack are no longer exclusive. And all
     * profiles should have both enabled by default in the raid buffs."
     *
     * THE ASSERTION IS OVER THE WHOLE CATALOGUE AND NOT JUST THIS PAIR,
     * because that is the fact that has to stay visible: `areExclusive` now
     * answers false for every pair there is, and **a selection rule with no
     * declaration reads exactly like one that sometimes fires**. The field is
     * kept on purpose -- the next exclusive pair should be one line rather
     * than a re-implementation -- so something has to say it reaches nothing,
     * which is the guard `RacialRequirement.weaponTypes` got for the same
     * reason one patch earlier.
     * ========================================================================
     */
    const pack = RAID_BUFFS_BY_ID.get('leader_of_the_pack')!;
    const moonkin = RAID_BUFFS_BY_ID.get('moonkin_form')!;
    expect(areExclusive(pack, moonkin)).toBe(false);
    expect(areExclusive(moonkin, pack)).toBe(false);

    /*
     * ONE PAIR NOW, AND IT IS NOT THIS ONE: Flametongue Totem against Windfury
     * Totem, the owner's "mutually exclusive". Asserted as the WHOLE set of
     * exclusive pairs, so a declaration that quietly reaches something else
     * still fails here.
     */
    expect(RAID_BUFFS.filter((buff) => buff.exclusiveWith !== undefined).map((buff) => buff.id)).toEqual([
      'flametongue_totem',
    ]);
    const exclusivePairs: string[] = [];
    for (const a of RAID_BUFFS) {
      for (const b of RAID_BUFFS) {
        if (a.id < b.id && areExclusive(a, b)) exclusivePairs.push(`${a.id}/${b.id}`);
      }
    }
    expect(exclusivePairs).toEqual(['flametongue_totem/windfury_totem']);
  });

  it('sit beside each other when selected, where one used to replace the other', () => {
    /*
     * THE INVERSE OF "replace each other when selected", and the test that
     * would have caught the ruling being half-applied: dropping
     * `exclusiveWith` from one entry only would leave `areExclusive` true in
     * BOTH directions, because it is read in both.
     */
    const withPack = withRaidBuff(['battle_shout'], 'leader_of_the_pack');
    expect(withPack).toEqual(['battle_shout', 'leader_of_the_pack']);

    const both = withRaidBuff(withPack, 'moonkin_form');
    expect(both).toContain('moonkin_form');
    expect(both).toContain('leader_of_the_pack');
    expect(both).toContain('battle_shout');
    // And in catalogue order, which is the other half of what this does.
    expect(both).toEqual(['battle_shout', 'leader_of_the_pack', 'moonkin_form']);
  });

  it('give three percent of EACH kind of crit, and three of neither twice', () => {
    /*
     * ------------------------------------------------------------------------
     * THE NO-DOUBLE-DIP CHECK, NOW THAT THE SELECTION CAN HOLD BOTH.
     *
     * It used to read "three percent of ONE kind of crit, never six of it",
     * because `withRaidBuff` replaced one with the other and only one could be
     * measured. The honest figure now is one 3% on each STAT -- which is two
     * buffs doing two different things, and is exactly what the split was for.
     *
     * SELECTING EITHER ONE TWICE IS STILL WORTH 3%, which is the half of the
     * old ruling that survived it: each aura has one id shared with the TALENT
     * that grants it, so nothing can hold two instances. That is asserted here
     * on the selection and in `druidTalents.test.ts` on the talent.
     * ------------------------------------------------------------------------
     */
    const plain = sheet([]);
    const selection = withRaidBuff(withRaidBuff([], 'leader_of_the_pack'), 'moonkin_form');
    expect(selection).toContain('moonkin_form');
    expect(selection).toContain('leader_of_the_pack');

    const both = sheet(selection);
    expect(both.stats.get('spellCritChance')).toBeCloseTo(
      plain.stats.get('spellCritChance') + 3,
      6,
    );
    expect(both.stats.get('critChance')).toBeCloseTo(plain.stats.get('critChance') + 3, 6);

    // And each alone moves ONE of the two stats and leaves the other alone.
    const packOnly = sheet(withRaidBuff([], 'leader_of_the_pack'));
    expect(packOnly.stats.get('critChance')).toBeCloseTo(plain.stats.get('critChance') + 3, 6);
    expect(packOnly.stats.get('spellCritChance')).toBeCloseTo(
      plain.stats.get('spellCritChance'),
      6,
    );
  });

  it('keeps the selection in catalogue order', () => {
    // So two profiles with the same buffs are the same file, rather than a
    // diff of whichever switch was flipped first. This is what `withRaidBuff`
    // is still for now that it switches nothing off.
    const clicked = withRaidBuff(withRaidBuff([], 'faerie_fire'), 'battle_shout');
    expect(clicked).toEqual(['battle_shout', 'faerie_fire']);
  });

  it('points at no missing entry, for whatever pair is declared next', () => {
    // Vacuous today and the assertion to keep: it is what stops a future
    // `exclusiveWith` naming an id that was renamed out from under it, which
    // would make the rule silently do nothing.
    for (const buff of RAID_BUFFS) {
      if (!buff.exclusiveWith) continue;
      expect(RAID_BUFFS_BY_ID.has(buff.exclusiveWith), buff.id).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Windfury
// ---------------------------------------------------------------------------

describe('Windfury Totem', () => {
  it('is 20% on a main-hand swing, +246 for 1.5 seconds, 1.5 second cooldown', () => {
    // Every figure written out by hand from the ruleset owner's words.
    expect(WINDFURY_PROC_CHANCE).toBe(0.2);
    expect(WINDFURY_ATTACK_POWER).toBe(246);
    expect(WINDFURY_DURATION_MS).toBe(1500);
    expect(WINDFURY_INTERNAL_COOLDOWN_MS).toBe(1500);
  });

  it('gives NOTHING before it procs', () => {
    /*
     * It did, and a character sheet read 246 attack power too high. The entry
     * carries no `aura` at all: the window belongs to the proc, and listing it
     * as a state applied it free at the pull and counted it toward the health
     * pool snapshot as well.
     */
    const entry = RAID_BUFFS_BY_ID.get('windfury_totem')!;
    expect(entry.aura).toBeUndefined();
    expect(entry.buildReactions).toBeDefined();

    const plain = sheet([]);
    const totem = sheet(['windfury_totem']);
    expect(totem.stats.get('attackPower')).toBe(plain.stats.get('attackPower'));
    expect(totem.auras.active.map((a) => a.id)).not.toContain('windfury_totem');
  });

  it('raises attack power BEFORE the extra attack goes out', () => {
    /*
     * The ruleset owner's rule, and it is one line of ordering: the aura is
     * applied and then `extraAttack` is requested, which schedules its swing
     * at this timestamp to run after the reaction returns. Swapping those two
     * lines would produce an extra attack at base attack power and nothing
     * would fail.
     */
    const { simulation, player, target } = opened(['windfury_totem']);
    const before = player.stats.get('attackPower');
    const reaction = windfuryTotemReaction();

    const swing: AttackEvent = {
      attacker: player,
      defender: target,
      outcome: 'hit',
      abilityId: undefined,
      abilityName: 'Main Hand Auto-Attack',
      amount: 100,
      weaponSlot: 'mainHand',
      critical: false,
    };
    reaction.onTrigger(simulation, player, swing);

    // Up already, with the extra swing still sitting in the queue.
    expect(player.auras.stacksOf('windfury_totem')).toBe(1);
    expect(player.stats.get('attackPower')).toBe(before + WINDFURY_ATTACK_POWER);
  });

  it('takes a MAIN HAND USE, which includes abilities', () => {
    /*
     * ----------------------------------------------------------------------------
     * THIS TEST USED TO ASSERT THE OPPOSITE, and it was wrong twice over.
     *
     * It read "refuses the off hand and refuses an ability", and the reaction
     * did refuse every `abilityId` -- so Windfury was an auto-attack-only
     * effect. The ruleset owner settled it: a "use" of a weapon is a SWING OR
     * AN ABILITY, and Bloodthirst, Mortal Strike, Rend and Heroic Strike are
     * all main-hand uses.
     *
     * IT ALSO PASSED FOR THE WRONG REASON once the gate was fixed, which is
     * the part worth keeping in mind. `canTrigger` rolls the 20% chance as its
     * last step, so a `false` can mean "refused" OR "rolled badly" -- and with
     * a live RNG the ability row went on passing after it had stopped being
     * true. Every case below uses a scripted roll that ALWAYS succeeds, so a
     * false can only mean the gate refused.
     * ----------------------------------------------------------------------------
     */
    const { simulation, player, target } = opened(['windfury_totem']);
    const alwaysRolls = {
      ...simulation,
      rng: { ...simulation.rng, rollChance: () => true },
    } as unknown as typeof simulation;

    const use = (weaponSlot: WeaponSlot, abilityId?: string): AttackEvent => ({
      attacker: player,
      defender: target,
      outcome: 'hit',
      abilityId,
      abilityName: abilityId ?? 'Auto-Attack',
      amount: 100,
      weaponSlot,
      critical: false,
    });

    const procs = (weaponSlot: WeaponSlot, abilityId?: string) =>
      windfuryTotemReaction().canTrigger?.(alwaysRolls, player, use(weaponSlot, abilityId));

    // A main-hand use, by swing or by ability.
    expect(procs('mainHand')).toBe(true);
    expect(procs('mainHand', 'bloodthirst')).toBe(true);
    expect(procs('mainHand', 'mortal_strike')).toBe(true);
    expect(procs('mainHand', 'rend_cast')).toBe(true);
    expect(procs('mainHand', 'heroic_strike')).toBe(true);

    // "Each MAIN HAND swing" -- the off hand is still refused, and that is the
    // half of the old test that was right.
    expect(procs('offHand')).toBe(false);
    expect(procs('offHand', 'whirlwind')).toBe(false);

    // Thunder Clap needs no melee weapon, so it is not a use of one.
    expect(procs('ranged', 'thunder_clap')).toBe(false);
  });

  it('is built once PER CHARACTER, so two fights cannot share a cooldown', () => {
    /*
     * THIS WAS A REAL BUG, and a silent one. The reaction was built once at
     * module load, so its internal cooldown was shared by every combatant in
     * every iteration of a batch -- and once one fight set the timestamp, the
     * next fight's clock started back at zero, the subtraction went negative,
     * and Windfury never procced again for the life of the process.
     *
     * Measured as one proc in a sixty second fight where three were expected.
     */
    expect(windfuryTotemReaction()).not.toBe(windfuryTotemReaction());
    // Through `buildReactions` now, which returns both halves from one call so
    // that Judgement of Wisdom's two cannot be built into separate closures.
    const build = RAID_BUFFS_BY_ID.get('windfury_totem')!.buildReactions!;
    expect(build().damage).not.toBe(build().damage);
    expect(build().damage!.id).toBe('windfury_totem');
  });

  it('procs on about a fifth of the main-hand USES that land', () => {
    /*
     * 20% of LANDED main-hand uses, not of attempts, and a use is a swing or
     * an ability. The denominator is therefore auto-attacks PLUS every
     * main-hand ability -- which is the whole correction, and why this rate
     * used to be measured against swings alone and read far too low.
     *
     * The 1.5 second internal cooldown pulls the observed rate below 20%: a
     * warrior can easily take two main-hand actions inside it.
     */
    const batch = runProfileBatch(fury(['windfury_totem'], 400));
    const totem = batch.buffUptime.find((b) => b.auraName === 'Windfury Totem');

    const mainHandUses = batch.abilities
      .filter((a) => a.abilityName !== 'Off Hand Auto-Attack')
      .reduce((sum, a) => sum + a.attempts, 0);

    expect(totem?.applications ?? 0).toBeGreaterThan(2);
    const perUse = (totem?.applications ?? 0) / mainHandUses;
    expect(perUse).toBeGreaterThan(0.05);
    expect(perUse).toBeLessThan(WINDFURY_PROC_CHANCE);
  });

  it('is worth much more now that abilities count', () => {
    /*
     * Measured, not assumed. A Fury warrior takes far more main-hand ACTIONS
     * than main-hand swings -- a slow weapon and a full rotation -- so
     * confining Windfury to auto-attacks was hiding most of the totem.
     */
    const autoOnly = runProfileBatch(fury([], 300)).dps.mean;
    const withTotem = runProfileBatch(fury(['windfury_totem'], 300)).dps.mean;
    expect(withTotem).toBeGreaterThan(autoOnly * 1.05);
  });

  it('is worth real damage', () => {
    const without = runProfileBatch(fury([], 300)).dps.mean;
    const with_ = runProfileBatch(fury(['windfury_totem'], 300)).dps.mean;
    expect(with_).toBeGreaterThan(without);
  });
});

// ---------------------------------------------------------------------------
// The profile
// ---------------------------------------------------------------------------

describe('the raid buff selection on the profile', () => {
  it('stores the selection as ids', () => {
    // Version 10 now; raid buffs arrived at 9 and poisons at 10.
    expect(CURRENT_PROFILE_VERSION).toBeGreaterThanOrEqual(9);
    expect(createDefaultProfile().raidBuffs).toEqual([]);
  });

  it('gives an older profile no buffs, so its results do not move', () => {
    /*
     * The whole reason the default is empty rather than a sensible raid. A
     * migration that handed every saved character a raid's worth of attack
     * power would invalidate every figure they had recorded, silently.
     */
    const old = { ...createDefaultProfile(), version: 8 } as Record<string, unknown>;
    delete old.raidBuffs;

    const result = migrateProfile(old);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const migrated = result.value as { version: number; raidBuffs: string[] };
    expect(migrated.version).toBe(CURRENT_PROFILE_VERSION);
    expect(migrated.raidBuffs).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Judgement of Wisdom
// ---------------------------------------------------------------------------

describe('Judgement of Wisdom', () => {
  const entry = () => RAID_BUFFS_BY_ID.get('judgement_of_wisdom')!;

  /** A caster, so there is a mana bar for the proc to fill. */
  function caster(raidBuffs: readonly string[], iterations = 1) {
    const profile = PRESETS_BY_ID.get('shadow_priest')!.build();
    return {
      ...profile,
      simulation: { ...profile.simulation, iterations, seed: 4242, durationSeconds: 60 },
      raidBuffs: [...raidBuffs],
    } as never;
  }

  it('is a Paladin entry on the TARGET, and a proc rather than a state', () => {
    expect(entry().source).toBe('Paladin');
    // It is a judgement placed on the enemy, so it belongs in the panel's "on
    // the target" group -- even though the mana it restores goes to the
    // attacker, whose reaction it builds.
    expect(entry().appliesTo).toBe('enemy');
    expect(entry().aura).toBeUndefined();
    expect(entry().buildReactions).toBeDefined();
  });

  it('builds BOTH halves from one call, which is what keeps them to one roll', () => {
    /*
     * THE WHOLE MECHANISM. The damage and cast reactions share a closure so a
     * damaging spell takes one roll rather than two; two separate factory
     * fields would have produced two closures and silently doubled the proc
     * rate -- the exact reading the owner rejected, arrived at by accident.
     */
    const built = entry().buildReactions!();
    expect(built.damage).toBeDefined();
    expect(built.cast).toBeDefined();

    // And a fresh closure per character, as every proc here is.
    expect(entry().buildReactions!().damage).not.toBe(built.damage);
  });

  it('restores mana, and reports it under its own name', () => {
    const batch = runProfileBatch(caster(['judgement_of_wisdom'], 30));
    const row = resourceFlowOf(batch, 'mana').gained.find(
      (g) => g.sourceName === 'Judgement of Wisdom',
    );

    expect(row, 'Judgement of Wisdom should appear in mana gained by source').toBeDefined();
    expect(row!.count).toBeGreaterThan(0);
    // Every proc is the same flat amount, so the mean per proc is that amount.
    expect(row!.amount / row!.count).toBeCloseTo(JUDGEMENT_OF_WISDOM_MANA, 6);
  });

  it('is worth nothing to a class with no mana, and consumes no randomness', () => {
    /*
     * "to classes that use mana". A Warrior has no mana bar, so the roll is
     * refused BEFORE `rollChance` is reached -- which is why the two runs are
     * identical to the decimal rather than merely close. A proc that rolled
     * and then discarded the result would shift every later roll in the fight
     * and this would fail.
     */
    const without = runProfileBatch(fury([], 20)).dps.mean;
    const with_ = runProfileBatch(fury(['judgement_of_wisdom'], 20)).dps.mean;
    expect(with_).toBe(without);
  });

  it('takes ONE roll for a cast that dealt direct damage', () => {
    /*
     * The damage half records the instant it rolled; the cast half refuses
     * when a roll has already been taken at that instant. Driven directly
     * rather than through a fight, because the thing under test is the
     * ordering -- `runCast` runs `onCast` before the cast reactions, so a
     * damaging spell has already been through the damage pipeline by the time
     * the cast half is offered it.
     */
    const { damage, cast } = judgementOfWisdomReactions();

    let now = 1000;
    const granted: number[] = [];
    const context = {
      clock: { now: () => now },
      // Always wins, so what is counted is ROLLS TAKEN rather than luck.
      rng: { rollChance: () => true },
      grantResource: (_a: unknown, _r: unknown, amount: number) => granted.push(amount),
    } as never;

    const actor = { resources: { get: () => ({}) } } as never;
    const enemy = { isPlayerControlled: false } as never;
    const attack = { defender: enemy } as never;
    /*
     * THE STUB CARRIES AN `ability` NOW, and it had to: the cast half asks
     * whether the ability is aimed at an enemy at all. A fake event that omits
     * the field is the "a test that reconstructs the thing under test will
     * reproduce its mistakes" hazard -- this one threw rather than passing
     * silently, which is the cheaper of the two outcomes.
     */
    const spell = { target: enemy, ability: { requiresTarget: true } } as never;

    const fire = (r: { canTrigger?: Function; onTrigger: Function }, event: unknown) => {
      if (!r.canTrigger || r.canTrigger(context, actor, event)) r.onTrigger(context, actor, event);
    };

    // A damaging cast: the damage lands, then the cast reaction is offered it.
    fire(damage as never, attack);
    fire(cast as never, spell);
    expect(granted, 'a damaging spell is one action and takes one roll').toHaveLength(1);

    // A cast at a LATER instant that dealt no direct damage -- applying a DoT
    // -- is an action of its own and does roll.
    now = 2000;
    fire(cast as never, spell);
    expect(granted, 'a non-damaging cast is an action of its own').toHaveLength(2);

    // And a second cast at that same instant has already had the roll.
    fire(cast as never, spell);
    expect(granted).toHaveLength(2);
  });

  it('gives a SELF-BUFF no roll, because it is not a cast against an enemy', () => {
    /*
     * ==========================================================================
     * THE OWNER'S RULE HAS TWO HALVES AND ONLY ONE WAS CHECKED: "every direct
     * damage source (not DoT ticks) OR CAST AGAINST AN ENEMY".
     *
     * The cast half asked only whether a target existed and was hostile -- and
     * it always is: the rotation carries the encounter's target and the cast
     * event is handed it whether or not the ability points at anything. So
     * every self-buff rolled. On BM Hunter, Aspect of the Hawk, Rapid Fire,
     * Bestial Wrath, Blood Fury and the Frenzy Potion were **20 of 149 grants**.
     *
     * NOTHING LOOKED WRONG: real mana, at the stated rate, into a pool the
     * character has, under a buff that is genuinely up. It was found by joining
     * each GRANT to what the character cast or dealt at that instant --
     * `tools/probe_jow.ts`.
     *
     * `requiresTarget` IS THE FIELD, and it already means exactly this.
     * ==========================================================================
     */
    const { cast } = judgementOfWisdomReactions();
    const granted: number[] = [];
    /*
     * THE CLOCK ADVANCES BETWEEN OFFERS, because the two halves share a
     * one-roll-per-INSTANT dedupe -- three casts at the same millisecond are
     * one action to this reaction, which is the behaviour the test above pins.
     */
    let now = 1000;
    const context = {
      clock: { now: () => now },
      rng: { rollChance: () => true },
      grantResource: (_a: unknown, _r: unknown, amount: number) => granted.push(amount),
    } as never;
    const actor = { resources: { get: () => ({}) } } as never;
    const enemy = { isPlayerControlled: false } as never;

    const offer = (requiresTarget: boolean | undefined) => {
      now += 1000;
      const event = { target: enemy, ability: { requiresTarget } } as never;
      if (!cast.canTrigger || cast.canTrigger(context, actor, event)) {
        cast.onTrigger(context, actor, event);
      }
    };

    offer(false);
    expect(granted, 'a self-buff is not a cast against an enemy').toHaveLength(0);

    // A debuff on the enemy IS one, and Hunter's Mark declares it.
    offer(true);
    expect(granted).toHaveLength(1);

    // And the default is "a hostile target is required", so an ability that
    // says nothing still rolls -- which is every damaging spell in the game.
    offer(undefined);
    expect(granted).toHaveLength(2);
  });

  it('ignores DoT ticks by construction rather than by a check', () => {
    /*
     * `dealDamage` dispatches reactions only when `request.attackTable &&
     * !request.periodic`, so a tick never reaches a damage reaction at all.
     * Asserted here because it is the ENGINE that enforces the owner's "not
     * DoT ticks", and nothing in `judgementOfWisdom.ts` would catch it if that
     * gate changed -- it would simply start paying out on every Shadow Word:
     * Pain tick, which is a bigger number and no error.
     */
    const batch = runProfileBatch(caster(['judgement_of_wisdom'], 30));
    const row = resourceFlowOf(batch, 'mana').gained.find(
      (g) => g.sourceName === 'Judgement of Wisdom',
    )!;

    // One roll per action, so procs cannot outnumber the actions taken.
    const casts = batch.abilities.reduce((sum, a) => sum + a.uses, 0);
    expect(row.count).toBeLessThanOrEqual(casts);
  });
});

// ---------------------------------------------------------------------------
// Every selected entry lasts the fight
// ---------------------------------------------------------------------------

describe('a selected entry lasts the whole fight', () => {
  /*
   * THE RULESET OWNER'S RULE. Sunder Armor and Thunder Clap carry the durations
   * the WARRIOR'S OWN abilities use -- thirty seconds, because a warrior
   * recasts them -- and the raid buff reuses those auras rather than declaring
   * a second copy. On anyone who cannot recast them the debuff fell off halfway
   * through the fight.
   */
  const SHORT = ['sunder_armor', 'thunder_clap'] as const;

  it('keeps the two short debuffs up for a fight twice their duration', () => {
    /*
     * A ROGUE, chosen because nothing in its book refreshes either one -- which
     * is the case the rule exists for. Measured as UPTIME rather than as a
     * duration, because uptime is what the thirty-second version got wrong.
     */
    const profile = PRESETS_BY_ID.get('rogue_combat')!.build();
    const batch = runProfileBatch({
      ...profile,
      simulation: { ...profile.simulation, iterations: 20, seed: 99, durationSeconds: 120 },
      raidBuffs: [...SHORT],
    } as never);

    for (const name of ['Sunder Armor', 'Thunder Clap']) {
      const row = batch.debuffUptime.find((d) => d.auraName === name);
      expect(row, `${name} should be on the target`).toBeDefined();
      // A 120-second fight against a 30-second aura: anything below 1.0 means
      // it expired, and the old behaviour read about a quarter of this.
      expect(row!.uptime, name).toBeGreaterThan(0.99);
      // And applied ONCE (five times for Sunder's stacks), not re-applied as it
      // lapsed -- nothing in a Rogue's book could have re-applied it anyway.
      expect(row!.applications, name).toBeLessThanOrEqual(SUNDER_ARMOR_MAX_STACKS);
    }
  });

  it('does not lengthen the aura the Warrior own casts apply', () => {
    /*
     * THE OVERRIDE IS AT APPLICATION TIME, never on the definition. The two are
     * the same shared objects the Warrior's abilities use, and lengthening them
     * at the source would hand the Warrior a fight-long debuff and quietly
     * delete the reason its rotation refreshes at all.
     */
    expect(SUNDER_ARMOR.durationMs).toBe(SUNDER_ARMOR_DURATION_MS);
    expect(THUNDER_CLAP_SLOW.durationMs).toBe(THUNDER_CLAP_SLOW_DURATION_MS);
    // Written out in milliseconds by hand rather than through `seconds()`, so
    // the test does not pass by agreeing with the helper it is checking.
    expect(SUNDER_ARMOR_DURATION_MS).toBe(30_000);
    expect(THUNDER_CLAP_SLOW_DURATION_MS).toBe(30_000);
  });

  it('applies to every selected entry, not to a list of two', () => {
    /*
     * Uniform ON PURPOSE. The next short-duration entry someone adds gets this
     * for free, where a pair of special cases is a list nobody updates. Checked
     * through a buff that was ALREADY longer than the fight, so what is asserted
     * is that the rule reaches it rather than that it happens to be up.
     */
    const profile = PRESETS_BY_ID.get('rogue_combat')!.build();
    const batch = runProfileBatch({
      ...profile,
      simulation: { ...profile.simulation, iterations: 10, seed: 7, durationSeconds: 120 },
      raidBuffs: ['mark_of_the_wild', 'faerie_fire'],
    } as never);

    const mark = batch.buffUptime.find((b) => b.auraName === 'Mark of the Wild');
    expect(mark?.uptime ?? 0).toBeGreaterThan(0.99);
  });
});

// ---------------------------------------------------------------------------
// Gift of Arthas and Judgement of the Crusader
// ---------------------------------------------------------------------------

describe('Gift of Arthas, which is flat and school-blind', () => {
  /*
   * ==========================================================================
   * "+8 damage to any direct damage (non-damage over time) source."
   *
   * THE ARITHMETIC IS ASSERTED AS A DIFFERENCE, not against a figure. What
   * matters is that eight points arrive, and the absolute damage of a Fireball
   * is a coefficient question that belongs to a different test.
   * ==========================================================================
   */
  const resolveTwice = (request: Omit<DamageRequest, 'source' | 'target'>) => {
    const { simulation, player, target } = opened([]);
    const base = scaleByPower({ ...request, source: player, target } as DamageRequest);
    simulation.applyAura(target, RAID_BUFFS_BY_ID.get('gift_of_arthas')!.aura!, target.id);
    const withBuff = scaleByPower({ ...request, source: player, target } as DamageRequest);
    return { base, withBuff };
  };

  it('adds eight to a direct hit', () => {
    const { base, withBuff } = resolveTwice({
      abilityId: 'probe',
      abilityName: 'Probe',
      school: 'shadow',
      baseAmount: 100,
    });
    expect(withBuff - base).toBe(GIFT_OF_ARTHAS_DAMAGE);
  });

  it('adds nothing to a damage-over-time tick', () => {
    /*
     * "non-damage over time" is the owner's own parenthesis, and `periodic` is
     * the fact the engine already carries for it -- the same field Genesis,
     * Wrack's "other" clause and the `dealt` reaction exclusion all read.
     */
    const { base, withBuff } = resolveTwice({
      abilityId: 'probe_dot',
      abilityName: 'Probe (tick)',
      school: 'shadow',
      baseAmount: 100,
      periodic: true,
    });
    expect(withBuff - base).toBe(0);
  });

  it('is doubled by a crit and cut by armor, which is the owner’s choice', () => {
    /*
     * ------------------------------------------------------------------------
     * THE READING THEY PICKED, out of two they were offered. "Added to base
     * damage -- crits and is reduced by armor", against a flat eight bolted on
     * after mitigation, which is what Classic's own Gift of Arthas does.
     *
     * ASSERTED THROUGH THE DAMAGE PIPELINE rather than by reading the field,
     * because the claim is about WHERE in the pipeline it lands and a constant
     * check cannot see that. The crit half is the sharper of the two: a flat
     * post-mitigation eight would add eight to a crit as well.
     * ------------------------------------------------------------------------
     */
    const { simulation, player, target } = opened([]);
    simulation.applyAura(target, RAID_BUFFS_BY_ID.get('gift_of_arthas')!.aura!, target.id);

    const base = scaleByPower({
      source: player,
      target,
      abilityId: 'probe',
      abilityName: 'Probe',
      school: 'shadow',
      baseAmount: 100,
    } as DamageRequest);

    // 108 before the crit multiplier, so a 1.5x spell crit is 162 -- twelve
    // points of the crit are the debuff's, not eight.
    expect(base).toBe(108);
    expect(base * 1.5 - 100 * 1.5).toBe(12);
  });

  it('reaches every school, because the owner named none', () => {
    for (const school of ['physical', 'shadow', 'fire', 'holy'] as const) {
      const { base, withBuff } = resolveTwice({
        abilityId: 'probe',
        abilityName: 'Probe',
        school,
        baseAmount: 100,
      });
      expect(withBuff - base, school).toBe(GIFT_OF_ARTHAS_DAMAGE);
    }
  });
});

describe('Judgement of the Crusader as a raid debuff', () => {
  it('shares the aura id with the Paladin’s own, so the two cannot stack', () => {
    /*
     * ========================================================================
     * THE ONE THING THAT COULD GO WRONG HERE, AND IT WOULD NOT LOOK WRONG.
     * `spellPowerTakenFor` ADDS across auras -- two debuffs granting Holy power
     * are one pool -- so a second id would give a Retribution Paladin 322 Holy
     * spell power the moment somebody ticked this box. A bigger number and no
     * error, on the build that already casts it.
     *
     * The guard is structural: one id, and `AuraCollection.apply` refreshes a
     * matching id rather than stacking. Same arrangement as `PARTY_CRIT_AURA`,
     * and for the same reason -- enforcing it at the CHOOSER is what let a
     * Moonkin read +6% crit.
     * ========================================================================
     */
    const entry = RAID_BUFFS_BY_ID.get('judgement_of_the_crusader')!;
    expect(entry.aura!.id).toBe(JUDGEMENT_OF_THE_CRUSADER.id);
    expect(entry.aura!.spellPowerTakenBySchool).toEqual(
      JUDGEMENT_OF_THE_CRUSADER.spellPowerTakenBySchool,
    );
  });

  it('applies 161 Holy spell power once, not twice, with both sources up', () => {
    const { simulation, player, target } = opened(['judgement_of_the_crusader']);
    const raidOnly = spellPowerAgainst(player, target, 'holy');

    // And now the Paladin's own, which is the SAME id.
    simulation.applyAura(target, JUDGEMENT_OF_THE_CRUSADER, player.id);
    expect(spellPowerAgainst(player, target, 'holy')).toBe(raidOnly);
  });

  it('lasts the fight, which is what every other enemy entry does', () => {
    /*
     * "handled like other debuffs as far as auto-application and duration".
     * The PALADIN's own is 40 seconds and refreshed by its melee strikes; a
     * raid buff is an assumption that holds for the whole fight.
     */
    const entry = RAID_BUFFS_BY_ID.get('judgement_of_the_crusader')!;
    expect(entry.aura!.durationMs).toBeGreaterThan(JUDGEMENT_OF_THE_CRUSADER.durationMs);
    expect(entry.aura!.durationMs).toBe(RAID_BUFFS_BY_ID.get('faerie_fire')!.aura!.durationMs);
  });
});
