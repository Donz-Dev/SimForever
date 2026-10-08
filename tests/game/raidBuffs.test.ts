import { describe, expect, it } from 'vitest';
import type { AttackEvent, Combatant, WeaponSlot } from '../../src/engine';
import { Simulation, applyHaste, hasteMultiplierFrom } from '../../src/engine';
import {
  RAID_BUFFS,
  RAID_BUFFS_BY_ID,
  areExclusive,
  selectedRaidBuffs,
  withRaidBuff,
} from '../../src/game/buffs/raidBuffs';
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
    // Demoralizing Shout is deliberately absent -- "make it a comment, keep it
    // inert for now" -- so twenty of the twenty-one originally named, plus
    // Judgement of Wisdom, which the owner added later.
    expect(RAID_BUFFS).toHaveLength(21);
    expect(RAID_BUFFS_BY_ID.has('demoralizing_shout')).toBe(false);
    expect(RAID_BUFFS_BY_ID.has('judgement_of_wisdom')).toBe(true);
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
     * Hand-computed, from the ruleset owner's numbers.
     *
     *   strength  393 base + 53 (Strength of Earth) + 16 (Mark of the Wild)
     *             = 462, x 1.1 (Blessing of Kings) = 508.2
     *   agility   186 + 89 (Grace of Air) + 16 = 291, x 1.1 = 320.1
     *
     * MULTIPLICATIVE is the point: Kings is "+10% (1.1x)" in the owner's own
     * notation, so it multiplies what the flats already produced rather than
     * joining an additive pool with them.
     *
     * THE TWO BASES MOVED WITH THE ARMOUR ENCHANTS AND THE RULE DID NOT, which
     * is why they are written as sums here. The Fury row is 8 + 5 + 9 + 15 + 8
     * strength plus the chest's "+4 Stats", and 5 on the cloak + 4 from the
     * same chest + 7 on the boots of agility.
     */
    const plain = sheet([]);
    expect(plain.stats.get('strength')).toBe(344 + (8 + 5 + 9 + 15 + 8) + 4);
    expect(plain.stats.get('agility')).toBe(170 + 5 + 4 + 7);

    const buffed = sheet([
      'strength_of_earth_totem',
      'grace_of_air_totem',
      'mark_of_the_wild',
      'blessing_of_kings',
    ]);
    expect(buffed.stats.get('strength')).toBeCloseTo(508.2, 6);
    expect(buffed.stats.get('agility')).toBeCloseTo(320.1, 6);
  });

  it('give Blessing of Kings a MULTIPLICATIVE ten percent, not an additive one', () => {
    // 393 + 16 = 409, x 1.1 = 449.9. An additive pool with anything else
    // would land somewhere else, and nothing else here is a percentage -- the
    // armour enchants are flat and are already in the 393.
    const both = sheet(['mark_of_the_wild', 'blessing_of_kings']);
    expect(both.stats.get('strength')).toBeCloseTo(449.9, 6);
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

  it('put crit on melee and spells alike', () => {
    // "+3% crit chance for melee, spells and ranged". Ranged reads the same
    // stat melee does, so three percentage points reaches all three.
    const plain = sheet([]);
    const pack = sheet(['leader_of_the_pack']);
    expect(pack.stats.get('critChance')).toBeCloseTo(plain.stats.get('critChance') + 3, 6);
    expect(pack.stats.get('spellCritChance')).toBeCloseTo(
      plain.stats.get('spellCritChance') + 3,
      6,
    );
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
  });

  it('leave the target alone when nothing is selected', () => {
    const { target } = opened([], true);
    expect(target.stats.get('armor')).toBe(3731);
    expect(hasteMultiplierFrom(target.stats.effective)).toBe(1);
  });

  it('raise magic damage taken by 8% and leave physical alone', () => {
    /*
     * Curse of the Elements. It changes NOTHING a warrior does -- every
     * Warrior ability is physical, Shield Slam included -- so this is the only
     * place it can be seen at all, and the panel says so beside the switch.
     */
    const { target } = opened(['curse_of_the_elements']);
    expect(target.damageTakenMultiplierFor('fire')).toBeCloseTo(1.08, 10);
    expect(target.damageTakenMultiplierFor('shadow')).toBeCloseTo(1.08, 10);
    expect(target.damageTakenMultiplierFor('arcane')).toBeCloseTo(1.08, 10);
    expect(target.damageTakenMultiplierFor('physical')).toBe(1);
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
    // Renewed on every cast, so applications track casts one for one.
    expect(slow?.applications ?? 0).toBeGreaterThan(5);
    // Better than the raid's one-shot 50%, and short of the 100% a list that
    // reached it sooner would give. The band is wide because where it lands
    // inside it is a property of the list's ORDER, which is the owner's.
    expect(slow?.uptime ?? 0).toBeGreaterThan(0.6);
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
// Entries that cannot sit beside each other
// ---------------------------------------------------------------------------

describe('Leader of the Pack and Moonkin Form', () => {
  it('are declared exclusive, in both directions', () => {
    /*
     * The ruleset owner's ruling and their choice of where to enforce it:
     * they do not stack, and the GUI is where to say so. The engine is right
     * to add two different +3% auras to +6%; what is wrong is choosing both.
     */
    const pack = RAID_BUFFS_BY_ID.get('leader_of_the_pack')!;
    const moonkin = RAID_BUFFS_BY_ID.get('moonkin_form')!;
    expect(areExclusive(pack, moonkin)).toBe(true);
    expect(areExclusive(moonkin, pack)).toBe(true);
  });

  it('replace each other when selected', () => {
    const withPack = withRaidBuff(['battle_shout'], 'leader_of_the_pack');
    expect(withPack).toEqual(['battle_shout', 'leader_of_the_pack']);

    const withMoonkin = withRaidBuff(withPack, 'moonkin_form');
    expect(withMoonkin).toContain('moonkin_form');
    expect(withMoonkin).not.toContain('leader_of_the_pack');
    // Everything unrelated is left alone.
    expect(withMoonkin).toContain('battle_shout');
  });

  it('give three percent, never six', () => {
    const plain = sheet([]);
    const one = sheet(withRaidBuff(withRaidBuff([], 'leader_of_the_pack'), 'moonkin_form'));
    expect(one.stats.get('critChance')).toBeCloseTo(plain.stats.get('critChance') + 3, 6);
  });

  it('keeps the selection in catalogue order', () => {
    // So two profiles with the same buffs are the same file, rather than a
    // diff of whichever switch was flipped first.
    const clicked = withRaidBuff(withRaidBuff([], 'faerie_fire'), 'battle_shout');
    expect(clicked).toEqual(['battle_shout', 'faerie_fire']);
  });

  it('is the only exclusive pair, and nothing points at a missing entry', () => {
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
    const spell = { target: enemy } as never;

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
