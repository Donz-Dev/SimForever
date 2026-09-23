import type { Ability } from '../../engine';
import { dealDamage, seconds } from '../../engine';
import {
  BATTLE_SHOUT,
  BATTLE_STANCE,
  BERSERKER_RAGE,
  BERSERKER_STANCE,
  BLOODRAGE_RAGE_BONUS,
  bloodrageAura,
  DEFENSIVE_STANCE,
  DEMORALIZING_SHOUT,
  OVERPOWER_READY,
  BLOODRAGE_INSTANT_RAGE,
  RECKLESSNESS,
  REND,
  REVENGE_READY,
  SHIELD_BLOCK,
  SHIELD_WALL,
  SUNDER_ARMOR,
  THUNDER_CLAP_SLOW,
  STANCE_RAGE_FLOOR,
  STANCE_RAGE_RETAINED_BONUS,
  WARRIOR_STANCES,
  DEATH_WISH,
  LAST_STAND,
  SWEEPING_STRIKES,
} from '../auras/warrior';

/**
 * Warrior abilities, from WoWForeverWarriorAbilities.xlsx.
 *
 * `docs/warrior-abilities.md` holds that spreadsheet transcribed verbatim
 * alongside everything it does not say. Read it before changing a number here.
 *
 * Every cost, cooldown, cast time, attack table and damage figure below is
 * taken from that sheet. Where a value is NOT in the sheet it is named
 * `PLACEHOLDER_*` and says so; those live in `game/auras/warrior.ts`.
 *
 * Damage scaling comes in three shapes, and the sheet distinguishes them:
 *
 *   - `weaponScaling`                 "Weapon Damage" — a swing, plus the
 *                                     ability's own flat damage
 *   - `weaponScaling` with a fraction "40% Weapon Damage" (Spearing Strike)
 *   - `powerCoefficient`              a stated number (Bloodthirst, 0.35)
 *   - neither                         a stated "0" — flat damage only, which is
 *                                     most of the utility strikes
 *
 * A "0" in the coefficient column means genuinely no scaling, not "unknown".
 * Revenge, Thunder Clap, Hamstring, Intercept and Shield Slam are all flat.
 */

/**
 * Which hand an ability swings with.
 *
 * Every warrior weapon-damage ability uses the main hand. The slot is named
 * rather than assumed because the ruleset's off-hand penalty is applied from
 * the weapon in the slot, and an ability pointed at the wrong hand would be
 * silently wrong rather than broken.
 */
const MAIN_HAND = 'mainHand' as const;
const OFF_HAND = 'offHand' as const;

/** Physical damage, which is all a warrior deals. */
const PHYSICAL = 'physical' as const;

// ---------------------------------------------------------------------------
// Weapon damage strikes
// ---------------------------------------------------------------------------

/**
 * "160" base damage plus full Weapon Damage, 30 rage, 6 second cooldown.
 *
 * The flat 160 is added on top of the weapon's contribution and the off-hand
 * penalty applies to the finished total — which is why the engine takes
 * `weaponScaling` as a declaration rather than the ability computing it.
 */
/**
 * "weapon damage plus 160", spell 21553 rank 4.
 *
 * NAMED rather than inline because the talent that grants Mortal Strike
 * describes RANK 1, which deals 85 -- the ranks are 85 / 110 / 135 / 160 at
 * levels 40 / 48 / 54 / 60. That gap has been mistaken for a source
 * disagreement three times. See `docs/warrior-talent-audit.md`.
 */
export const MORTAL_STRIKE_BASE_DAMAGE = 160;

export const MORTAL_STRIKE: Ability = {
  id: 'mortal_strike',
  name: 'Mortal Strike',
  cooldownMs: seconds(6),
  cost: { resource: 'rage', amount: 30 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: MORTAL_STRIKE_BASE_DAMAGE,
      weaponScaling: { slot: MAIN_HAND },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

/**
 * "48" base damage plus a stated 0.35 attack power coefficient, 30 rage, 6
 * second cooldown.
 *
 * NOT a weapon damage ability. The sheet gives it a number in the coefficient
 * column where the weapon-damage abilities say "Weapon Damage", so Bloodthirst
 * scales with attack power alone and ignores the weapon entirely.
 *
 * ----------------------------------------------------------------------------
 * THE FLAT COMPONENT WAS HIDDEN BY THE SPELL POWER ARTIFACT, not absent.
 *
 * Spell 23894's description reads "35% of your Attack Power plus (100% of
 * Spell Power)" -- the same Forever rendering bug that hid Revenge's and
 * Shield Slam's damage. This was read as "and nothing else", the spreadsheet's
 * 30 was dropped, and Bloodthirst lost its flat half entirely.
 *
 * The number was in the capture the whole time, in the effect rows, which is
 * exactly where Revenge's 153 and Shield Slam's 655 came from:
 *
 *     effect 1   School Damage (Physical)          49   ->  48
 *     effect 2   Dummy                             36   ->  35, the coefficient
 *
 * Base points run one higher than the stated figure throughout this data set,
 * and both rows obey it. The spellbook, which renders the same client data
 * without the artifact, states it outright: "35% of your Attack Power plus 48".
 * ----------------------------------------------------------------------------
 */
/** "plus 48", spell 23894 rank 4, effect row 49. */
export const BLOODTHIRST_BASE_DAMAGE = 48;

/** "35% of your Attack Power", spell 23894 rank 4, effect row 36. */
export const BLOODTHIRST_POWER_COEFFICIENT = 0.35;

export const BLOODTHIRST: Ability = {
  id: 'bloodthirst',
  name: 'Bloodthirst',
  cooldownMs: seconds(6),
  cost: { resource: 'rage', amount: 30 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: BLOODTHIRST_BASE_DAMAGE,
      powerCoefficient: BLOODTHIRST_POWER_COEFFICIENT,
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

/**
 * Weapon damage plus 87, 1.5 second cast, 15 rage, FIFTEEN SECOND COOLDOWN.
 *
 * ----------------------------------------------------------------------------
 * THE COOLDOWN. The spreadsheet's row says 0 and this had none. Forever's
 * captured tooltip says "1.5 sec cast 15 sec cooldown", the ruleset owner
 * confirms fifteen, and the spellbook carries it on ALL FIVE ranks. Three
 * sources against the sheet, which is the same shape as Shield Wall's
 * cooldown and resolved the same way.
 *
 * THE BASE DAMAGE WENT 87 -> 68 -> 87, and the round trip is worth keeping
 * because the trap is reusable.
 *
 * FOREVER ADDED A FIFTH RANK. Classic's Slam stops at rank 4; Forever inserts
 * one at the bottom and every rank moves down a level:
 *
 *     rank 3     Forever level 38, +43     Classic level 46, +68
 *     rank 4     Forever level 46, +68     Classic level 54, +87
 *     rank 5     Forever level 54, +87     Classic does not have it
 *
 * So "+68" and "+87" are BOTH Forever figures, for different ranks, and the
 * spellbook opens Slam on rank 4 -- the rank whose level matches Classic's
 * max. Reading the page as it opens gives 68. The ruleset owner read it that
 * way and ruled 68; the number is real, it is simply not the one a level 60
 * warrior has. `forever-warrior.json` holds spell 11605, which is rank 5 at
 * level 54, and says 87 with an effect row of 88.
 *
 * THE SIMULATOR RUNS AT LEVEL 60, so rank 5 is the only rank that can apply --
 * the same argument that picks Battle Shout rank 7 over rank 1's twelve.
 *
 * WHAT THE COOLDOWN CHANGES. Slam was an on-demand filler, castable whenever
 * rage and the swing timer allowed; four casts a minute is now the ceiling. It
 * was the best damage per rage in the Arms list after Overpower, so a list
 * built around spamming it is a list that no longer exists.
 *
 * UNSTATED: whether the cast pauses the swing timer, as it does in Classic. It
 * does not, unless Improved Slam is taken -- that talent grants
 * `swingTimer: 'hold'`, which is worth far more than the cast time it removes.
 * ----------------------------------------------------------------------------
 */
export const SLAM_BASE_DAMAGE = 87;
export const SLAM_COOLDOWN_MS = seconds(15);

export const SLAM: Ability = {
  id: 'slam',
  name: 'Slam',
  castTimeMs: seconds(1.5),
  cooldownMs: SLAM_COOLDOWN_MS,
  cost: { resource: 'rage', amount: 15 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: SLAM_BASE_DAMAGE,
      weaponScaling: { slot: MAIN_HAND },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

/** How many targets Whirlwind hits, per "can hit up to 4 targets". */
export const WHIRLWIND_MAX_TARGETS = 4;

/**
 * Weapon damage to up to four targets, 25 rage, 10 second cooldown.
 *
 * No base damage in the sheet, so each hit is pure weapon damage. Against the
 * single training dummy this is one hit; the loop is here so it stays correct
 * when an encounter has adds.
 */
/**
 * The bonus key Raging Blows sets on Whirlwind.
 *
 * Present and non-zero means "also strike with the off hand". A bonus rather
 * than a second ability, so the cooldown, the cost and every per-ability
 * modifier keep applying to one Whirlwind.
 */
export const WHIRLWIND_OFF_HAND_BONUS = 'offHandStrike';

/** What the off-hand half of a Whirlwind is called in the breakdown. */
export const WHIRLWIND_OFF_HAND_NAME = 'Whirlwind (Off Hand)';

export const WHIRLWIND: Ability = {
  id: 'whirlwind',
  stances: ['berserker_stance'],
  name: 'Whirlwind',
  cooldownMs: seconds(10),
  cost: { resource: 'rage', amount: 25 },
  attackTable: 'melee-special',
  targets: { maxTargets: WHIRLWIND_MAX_TARGETS },
  onCast: ({ simulation, caster, ability }) => {
    const targets = simulation.enemiesOf(caster).slice(0, WHIRLWIND_MAX_TARGETS);
    for (const target of targets) {
      dealDamage(simulation, {
        source: caster,
        target,
        abilityId: ability.id,
        abilityName: ability.name,
        school: PHYSICAL,
        baseAmount: 0,
        weaponScaling: { slot: MAIN_HAND },
        attackTable: ability.attackTable,
        weaponSlot: MAIN_HAND,
      });
    }

    /*
     * RAGING BLOWS: "Causes your Whirlwind to also strike with your off-hand
     * weapon." Main hand first, off hand immediately after.
     *
     * It carries the off-hand DAMAGE penalty and not the off-hand MISS
     * penalty. Both fall out of the model rather than being special-cased
     * here: the damage penalty is `damageMultiplier` on the off-hand weapon
     * profile, which any scaling off that slot picks up -- Dual Wield
     * Specialization's 0.625 included -- and the miss penalty lives only in
     * the `melee-auto` table, which a special never uses.
     *
     * Named separately in the breakdown so the second strike is visible;
     * the ability id stays `whirlwind`, so talents keyed to it still apply.
     */
    const strikesOffHand = (ability.bonuses?.[WHIRLWIND_OFF_HAND_BONUS] ?? 0) > 0;
    if (!strikesOffHand || !caster.weapons.offHand) return;

    for (const target of targets) {
      dealDamage(simulation, {
        source: caster,
        target,
        abilityId: ability.id,
        abilityName: WHIRLWIND_OFF_HAND_NAME,
        school: PHYSICAL,
        baseAmount: 0,
        weaponScaling: { slot: OFF_HAND },
        attackTable: ability.attackTable,
        weaponSlot: OFF_HAND,
      });
    }
  },
};

/** The fraction of weapon damage Spearing Strike deals, per the sheet. */
export const SPEARING_STRIKE_WEAPON_FRACTION = 0.4;

/**
 * "40% Weapon Damage", 15 rage, 20 second cooldown. No base damage.
 *
 * A Forever original with no Classic counterpart, so there is nothing to check
 * it against beyond the sheet.
 */
export const SPEARING_STRIKE: Ability = {
  id: 'spearing_strike',
  name: 'Spearing Strike',
  cooldownMs: seconds(20),
  cost: { resource: 'rage', amount: 15 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: 0,
      weaponScaling: { slot: MAIN_HAND, fraction: SPEARING_STRIKE_WEAPON_FRACTION },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

/**
 * "35" base damage plus Weapon Damage, 5 rage, 5 second cooldown.
 *
 * Requires that the target recently dodged. The spreadsheet states no trigger
 * at all; the ruleset owner CONFIRMED the Classic behaviour explicitly. The
 * window length is still a placeholder — see `OVERPOWER_READY`.
 */
export const OVERPOWER: Ability = {
  id: 'overpower',
  stances: ['battle_stance'],
  name: 'Overpower',
  cooldownMs: seconds(5),
  cost: { resource: 'rage', amount: 5 },
  attackTable: 'melee-special',
  canCast: ({ caster, simulation }) =>
    caster.auras.remainingMs(OVERPOWER_READY.id, simulation.clock.now()) > 0,
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: 35,
      weaponScaling: { slot: MAIN_HAND },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
    caster.auras.remove(simulation, OVERPOWER_READY.id);
  },
};

// ---------------------------------------------------------------------------
// Flat damage strikes — the sheet states a coefficient of 0 for all of these
// ---------------------------------------------------------------------------

/**
 * Revenge and Shield Slam damage, FROM FOREVER rather than the spreadsheet.
 *
 * The ability spreadsheet gives Revenge as "81 to 99" and Shield Slam as "421
 * to 439". Forever's own spell data gives 153 and 655, both flat. The ruleset
 * owner chose Forever for both -- see docs/warrior-ability-audit.md, which
 * records the disagreement and the decision.
 *
 * THE RANGES ARE GONE, and that is a real change in shape and not only in
 * magnitude. A spread of plus or minus nine around a midpoint contributed a
 * little variance to every cast; a flat number contributes none. Any spread
 * these abilities show now comes from the combat table alone.
 *
 * Both tooltips hide their damage behind Forever's "(100% of Spell Power)"
 * artifact, so these came from the spell page's base points -- 154 and 656 --
 * read the same way as every other ability whose tooltip DOES state its number,
 * where base points are consistently one more than the stated figure.
 */
export const REVENGE_DAMAGE = 153;
export const SHIELD_SLAM_DAMAGE = 655;

/**
 * 153 flat, 5 rage, 5 second cooldown, no scaling of any kind.
 *
 * Requires that the warrior recently blocked, parried or dodged — CONFIRMED by
 * the ruleset owner, not stated in the sheet. `REVENGE_READY` is applied by the
 * `revenge_on_avoid` reaction whenever `encounter.targetAttacks` is on, so
 * Revenge is castable in an attacking encounter and silently skipped in a
 * standing one, where its `canCast` refuses.
 */
export const REVENGE: Ability = {
  id: 'revenge',
  stances: ['defensive_stance'],
  name: 'Revenge',
  cooldownMs: seconds(5),
  cost: { resource: 'rage', amount: 5 },
  attackTable: 'melee-special',
  canCast: ({ caster, simulation }) =>
    caster.auras.remainingMs(REVENGE_READY.id, simulation.clock.now()) > 0,
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: REVENGE_DAMAGE,
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
    caster.auras.remove(simulation, REVENGE_READY.id);
  },
};

/**
 * 655 plus shield block value, 20 rage, 6 second cooldown.
 *
 * 655 is Forever's figure against the spreadsheet's 421 to 439 -- a little over
 * half again as much, and the single largest correction in this class. The
 * rotation has called Shield Slam "undervalued here" since it was written, and
 * 1H & Shield has been by some way the weakest build the simulator reports.
 *
 * Gated on carrying a shield rather than on a stance, which is how Classic
 * expresses it. Forever's Forms row is empty for Shield Slam, so it is usable
 * in ANY stance -- the shield requirement is what restricts it.
 */
export const SHIELD_SLAM: Ability = {
  id: 'shield_slam',
  name: 'Shield Slam',
  cooldownMs: seconds(6),
  cost: { resource: 'rage', amount: 20 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      /*
       * "increased by your Block Value", which is a stat the wielder carries
       * from the shield in their off hand. A warrior with no shield cannot cast
       * this at all, so the term is never zero in practice.
       */
      baseAmount: SHIELD_SLAM_DAMAGE + caster.stats.get('blockValue'),
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

/**
 * "45" flat, 10 rage, no cooldown, no scaling.
 *
 * Its slow is not modelled: a training dummy does not move, and the sheet
 * gives neither a slow percentage nor a duration.
 */
export const HAMSTRING: Ability = {
  id: 'hamstring',
  stances: ['battle_stance', 'berserker_stance'],
  name: 'Hamstring',
  cost: { resource: 'rage', amount: 10 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: 45,
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

/**
 * "103" flat, 20 rage, SIX second cooldown, no scaling.
 *
 * ----------------------------------------------------------------------------
 * THE SPREADSHEET SAYS FOUR, AND FOUR IS THE CLASSIC VALUE.
 *
 *   - `WoWForeverWarriorAbilities.xlsx`        4 seconds
 *   - WoW Classic                              4 seconds
 *   - `forever-warrior.json`, spell 11581      "Instant 6 sec cooldown"
 *   - The spellbook, beta client               6, listed as a deliberate change
 *
 * We had four, and our OWN capture said six. The sheet's row was taken over a
 * tooltip that contradicted it, which is the opposite of how Shield Wall and
 * Slam were settled, and it went unnoticed because four is also what Classic
 * does -- a wrong number that looks right from two directions at once.
 *
 * It matters more now than it did when it was written. Thunder Clap was a
 * damage ability then; it carries the swing slow now, so its cooldown sets how
 * hard a tank can hold that debuff up.
 * ----------------------------------------------------------------------------
 *
 * Listed as a RANGED Special Attack, and implemented literally as the ruleset
 * owner confirmed. A warrior has no ranged weapon in any of its three styles,
 * so `weaponSkill('ranged')` falls back to five times its level.
 *
 * IT ALSO SLOWS, which it did not until the ruleset owner said so. The
 * spreadsheet gives this row a damage figure and nothing else, and the slow
 * arrived from the raid buff list -- where it was applied once at the pull by
 * an assumed raid and fell off after thirty seconds with nothing to renew it.
 * A warrior casting Thunder Clap every four seconds keeps it up all fight,
 * which is what the ability is for. See `THUNDER_CLAP_SLOW`.
 */
export const THUNDER_CLAP: Ability = {
  id: 'thunder_clap',
  stances: ['battle_stance', 'defensive_stance'],
  name: 'Thunder Clap',
  cooldownMs: seconds(6),
  cost: { resource: 'rage', amount: 20 },
  attackTable: 'ranged-special',
  // "all nearby enemies", with no stated cap. One, here.
  targets: { maxTargets: Infinity },
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: 103,
      attackTable: ability.attackTable,
      weaponSlot: 'ranged',
    });

    /*
     * APPLIED WHETHER OR NOT THE DAMAGE LANDED. The slow is a separate effect
     * of the cast rather than a rider on the hit -- the spell applies an aura
     * and deals damage, and nothing in the source ties the first to the
     * second. `dealDamage` above reports its own outcome either way.
     */
    simulation.applyAura(target, THUNDER_CLAP_SLOW, caster.id);
  },
};

/**
 * "65" flat, 10 rage, 30 second cooldown, ranged table.
 *
 * Its charge and stun are not modelled; the sheet states neither.
 */
export const INTERCEPT: Ability = {
  id: 'intercept',
  stances: ['berserker_stance'],
  name: 'Intercept',
  cooldownMs: seconds(30),
  cost: { resource: 'rage', amount: 10 },
  attackTable: 'ranged-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: 65,
      attackTable: ability.attackTable,
      weaponSlot: 'ranged',
    });
  },
};

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

/** Execute's flat damage before any rage is added. */
export const EXECUTE_BASE_DAMAGE = 600;
/** Damage per point of rage left after the 15 rage cost was paid. */
export const EXECUTE_DAMAGE_PER_RAGE = 15;
/** The rage Execute costs before it consumes the rest. */
export const EXECUTE_BASE_COST = 15;

/**
 * The last fraction of the fight in which Execute may be used.
 *
 * TWENTY PERCENT, confirmed by the ruleset owner, and it is a fraction of TIME
 * rather than of the target's health. That is not an approximation of the game
 * rule -- it is the rule for this simulator, because the encounter is a damage
 * sink running for a fixed duration rather than something with a health bar to
 * whittle down.
 *
 * It was a health fraction, and could never fire: a hundred thousand health
 * taking fifteen thousand damage in a hundred seconds never reaches 20%, so
 * Execute was in every Warrior list and had never been cast.
 */
export const EXECUTE_PHASE_FRACTION = 0.2;

/**
 * "600 + 15 * each point of remaining rage after cost was taken out", costing
 * "15 + all remaining rage".
 *
 * The variable cost cannot be expressed as an `AbilityCost`, which is a fixed
 * amount, so the ability declares the 15 and drains the remainder itself in
 * `onCast`. That is the one place in this file where an ability reaches for a
 * resource directly, and it is why: the engine's cost model has no "and then
 * everything else" case.
 */
export const EXECUTE: Ability = {
  id: 'execute',
  stances: ['battle_stance', 'berserker_stance'],
  name: 'Execute',
  cost: { resource: 'rage', amount: EXECUTE_BASE_COST },
  attackTable: 'melee-special',
  /*
   * TIME ONLY. The last 20% of the fight, and nothing about the target's
   * health.
   *
   * The ruleset owner's decision, and it follows from what the encounter is:
   * the target does not need a hit point pool, it needs to take damage for a
   * predetermined duration. A health gate could never fire against it -- a
   * hundred thousand health taking fifteen thousand in a hundred seconds --
   * so Execute sat in every Warrior list and was never once cast.
   *
   * Keeping a health branch "for realism" would mean an execute phase that
   * appears only in fights nobody runs here, and two ways for the same
   * ability to become available that can never both be true. One rule.
   */
  canCast: ({ simulation }) => {
    const remaining = simulation.plannedDurationMs - simulation.clock.now();
    return remaining <= simulation.plannedDurationMs * EXECUTE_PHASE_FRACTION;
  },
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;

    // The engine has already taken the 15. Everything still in the bar is
    // consumed and converted into damage.
    const rage = caster.resources.get('rage');
    const remaining = rage?.current ?? 0;
    rage?.drain(remaining);

    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: EXECUTE_BASE_DAMAGE + EXECUTE_DAMAGE_PER_RAGE * remaining,
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

// ---------------------------------------------------------------------------
// On-next-swing abilities
// ---------------------------------------------------------------------------

/**
 * "157" base damage plus Weapon Damage, 15 rage, no cooldown, and explicitly
 * "on-next Main Hand swing".
 *
 * Queued rather than cast: it replaces the next main-hand auto-attack instead
 * of landing immediately. See `Combatant.queueNextSwing`.
 *
 * UNSTATED: whether it is off the global cooldown, as it is in Classic. It
 * currently triggers the GCD, which costs a warrior real throughput if Forever
 * kept the Classic behaviour.
 */
export const HEROIC_STRIKE: Ability = {
  id: 'heroic_strike',
  name: 'Heroic Strike',
  cost: { resource: 'rage', amount: 15 },
  attackTable: 'melee-special',
  onNextSwing: MAIN_HAND,
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: 157,
      weaponScaling: { slot: MAIN_HAND },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

/** How many targets Cleave hits, per "hits a second target if possible". */
export const CLEAVE_MAX_TARGETS = 2;

/**
 * "50" base damage plus Weapon Damage, 20 rage, no cooldown, on the next swing
 * and hitting a second target if one exists.
 *
 * Same unstated GCD question as Heroic Strike.
 */
export const CLEAVE: Ability = {
  id: 'cleave',
  name: 'Cleave',
  cost: { resource: 'rage', amount: 20 },
  attackTable: 'melee-special',
  targets: { maxTargets: CLEAVE_MAX_TARGETS },
  onNextSwing: MAIN_HAND,
  onCast: ({ simulation, caster, ability }) => {
    const targets = simulation.enemiesOf(caster).slice(0, CLEAVE_MAX_TARGETS);
    for (const target of targets) {
      dealDamage(simulation, {
        source: caster,
        target,
        abilityId: ability.id,
        abilityName: ability.name,
        school: PHYSICAL,
        baseAmount: 50,
        weaponScaling: { slot: MAIN_HAND },
        attackTable: ability.attackTable,
        weaponSlot: MAIN_HAND,
      });
    }
  },
};

// ---------------------------------------------------------------------------
// Damage over time and debuffs
// ---------------------------------------------------------------------------

/** 10 rage, no cooldown. Applies the bleed; see `REND` for its numbers. */
export const REND_ABILITY: Ability = {
  id: 'rend_cast',
  stances: ['battle_stance', 'defensive_stance'],
  name: 'Rend',
  cost: { resource: 'rage', amount: 10 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target || !ability.attackTable) return;

    // Rolled once here rather than per tick: a bleed that lands applies, and
    // then ticks unconditionally for its whole duration.
    const roll = simulation.rollAttack(ability.attackTable, caster, target, {
      slot: MAIN_HAND,
    });
    if (roll.avoided) return;

    simulation.applyAura(target, REND, caster.id);
  },
};

/** 15 rage, no cooldown. Removes 450 armor a stack to 5 stacks; see `SUNDER_ARMOR`. */
export const SUNDER_ARMOR_ABILITY: Ability = {
  id: 'sunder_armor_cast',
  name: 'Sunder Armor',
  cost: { resource: 'rage', amount: 15 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target || !ability.attackTable) return;
    const roll = simulation.rollAttack(ability.attackTable, caster, target, {
      slot: MAIN_HAND,
    });
    if (roll.avoided) return;
    simulation.applyAura(target, SUNDER_ARMOR, caster.id);
  },
};

/**
 * 10 rage, no cooldown. Removes 196 attack power from the target for 45 sec.
 *
 * ----------------------------------------------------------------------------
 * CAST, AND WORTH NOTHING. The ruleset owner's decision, for now.
 *
 * The debuff is real and applies the full -196 attack power. What it has no
 * effect on is the target's damage, because the boss melee in
 * `encounters/raidBoss.ts` carries `powerCoefficient: 0` -- its swing damage
 * IS the whole swing, stated outright rather than derived from attack power,
 * so there is no term for this to reduce.
 *
 * The modifier is deliberately LEFT IN rather than stripped out. It is not
 * wrong; the target simply has nothing for it to bite on, and the day a target
 * derives its damage from attack power this starts working with no change
 * here. Removing it would mean remembering to put it back, which is the
 * failure mode this project keeps running into.
 *
 * So the ability is in the tank list and costs 10 rage and a global cooldown a
 * cast, at about 80% uptime, and changes no incoming damage at all. That is a
 * fact somebody reading a result has to be told, which is what `unmodelled`
 * below is for.
 * ----------------------------------------------------------------------------
 */
export const DEMORALIZING_SHOUT_ABILITY: Ability = {
  id: 'demoralizing_shout_cast',
  name: 'Demoralizing Shout',
  cost: { resource: 'rage', amount: 10 },
  unmodelled:
    'The -196 attack power lands, but the target has no attack power term: ' +
    'its swing damage is stated outright, not derived. Cast at full cost, ' +
    'for no reduction in damage taken.',
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;
    simulation.applyAura(target, DEMORALIZING_SHOUT, caster.id);
  },
};

// ---------------------------------------------------------------------------
// Self buffs
// ---------------------------------------------------------------------------

/** 10 rage, no cooldown. Grants 139 attack power for 3 min. */
export const BATTLE_SHOUT_ABILITY: Ability = {
  id: 'battle_shout_cast',
  name: 'Battle Shout',
  cost: { resource: 'rage', amount: 10 },
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, BATTLE_SHOUT, caster.id);
  },
};

/** Free, 30 minute cooldown. 100 points of crit for 15 sec, at +20% damage taken. */
export const RECKLESSNESS_ABILITY: Ability = {
  id: 'recklessness_cast',
  stances: ['berserker_stance'],
  name: 'Recklessness',
  cooldownMs: seconds(1800),
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, RECKLESSNESS, caster.id);
  },
};

/**
 * Free, 30 second cooldown, and STILL INERT.
 *
 * The one ability Forever's own spell data does not answer: its tooltip says it
 * generates "extra rage when taking damage" and names no number, and its other
 * half is immunity to Fear and Incapacitate, which the engine has no notion of.
 * Not a gap in the capture -- a gap in the source.
 */
export const BERSERKER_RAGE_ABILITY: Ability = {
  id: 'berserker_rage_cast',
  stances: ['berserker_stance'],
  name: 'Berserker Rage',
  cooldownMs: seconds(30),
  requiresTarget: false,
  unmodelled:
    'Forever names no number for the extra rage it generates, and its other ' +
    'half is immunity to Fear and Incapacitate, which the engine has no ' +
    'notion of. A gap in the source, not in the capture.',
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, BERSERKER_RAGE, caster.id);
  },
};

/**
 * Free, 60 second cooldown, any stance.
 *
 * Ten rage on cast and ten more over ten seconds, both from Forever. It was
 * inert not for want of a number but for want of a periodic on the aura --
 * there was nowhere for "over 10 sec" to live.
 *
 * Its 20% of base health cost is NOT modelled, which overstates it: the player
 * cannot drop below one health, so the cost is free here.
 */
export const BLOODRAGE_ABILITY: Ability = {
  id: 'bloodrage_cast',
  name: 'Bloodrage',
  cooldownMs: seconds(60),
  requiresTarget: false,
  // Off the global cooldown, by the ruleset owner's rule. See
  // docs/global-cooldown.md for the three Warrior abilities this covers.
  triggersGcd: false,
  onCast: ({ simulation, caster, ability }) => {
    /*
     * IMPROVED BLOODRAGE SCALES BOTH HALVES. "Increases all the Rage
     * generated by your Bloodrage ability by 25/50%", so at 2/2 the ten on
     * cast becomes fifteen and the ten over ten seconds becomes fifteen too.
     *
     * The aura is built per cast because the multiplier belongs to this
     * character, and an aura definition is shared by every character in the
     * batch.
     */
    const multiplier = 1 + (ability.bonuses?.[BLOODRAGE_RAGE_BONUS] ?? 0) / 100;
    simulation.applyAura(caster, bloodrageAura(multiplier), caster.id);
    simulation.grantResource(caster, 'rage', BLOODRAGE_INSTANT_RAGE * multiplier, {
      id: 'bloodrage',
      name: 'Bloodrage',
    });
  },
};

/**
 * Free, Defensive Stance, 15 minute cooldown. Takes 60% off damage taken for
 * 12 sec.
 *
 * ----------------------------------------------------------------------------
 * THE SPREADSHEET IS WRONG ABOUT THIS ONE, and it is the first row of it that
 * has been overruled.
 *
 *   - `WoWForeverWarriorAbilities.xlsx`      1800 seconds (30 minutes)
 *   - Forever's captured spell tooltip       "Instant 15 min cooldown"
 *   - THE RULESET OWNER, asked directly      15 minutes, 4 with 2/2 Improved
 *                                            Shield Wall
 *
 * The owner's word settles it, and the talent corroborates it independently:
 * Improved Shield Wall's captured value at 2/2 is ELEVEN MINUTES, and
 * 15 - 11 = 4 exactly as stated. Off the spreadsheet's thirty it would leave
 * nineteen, which is not a number anyone would write a talent for.
 *
 * WORTH KNOWING HOW THIS WENT. The cooldown was first changed to 900 on the
 * strength of the capture alone, and `tests/game/warriorAbilities.test.ts`
 * refused it -- correctly, because at that point the only evidence was a
 * second source disagreeing with the owner's own file, and the standing rule
 * says the file wins. The test was right to refuse and the change was right to
 * make; what was missing was the third source, which was one question away.
 *
 * Invisible in a sixty second fight, where any of these figures allows exactly
 * one cast. Not invisible to Improved Shield Wall, nor to a longer encounter.
 * ----------------------------------------------------------------------------
 */
export const SHIELD_WALL_ABILITY: Ability = {
  id: 'shield_wall_cast',
  stances: ['defensive_stance'],
  name: 'Shield Wall',
  cooldownMs: seconds(900),
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, SHIELD_WALL, caster.id);
  },
};

/**
 * 10 rage, 5 second cooldown, Defensive Stance. +75% block for 7 seconds or
 * two blocks, whichever ends first.
 *
 * NO GLOBAL COOLDOWN. One of three Warrior abilities the ruleset owner names
 * as exceptions, with Bloodrage and Charge -- see docs/global-cooldown.md.
 *
 * It is the owner's statement rather than a captured value: Forever's spell
 * page gives the cost, the cooldown, the stance and the effect and says
 * nothing about the global cooldown, and no ability capture carries one
 * because Wowhead does not publish it.
 *
 * It matters here: off the global cooldown, Shield Block sits above Shield
 * Slam in the tank list without costing it a strike.
 */
export const SHIELD_BLOCK_ABILITY: Ability = {
  id: 'shield_block_cast',
  stances: ['defensive_stance'],
  name: 'Shield Block',
  cost: { resource: 'rage', amount: 10 },
  cooldownMs: seconds(5),
  requiresTarget: false,
  triggersGcd: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, SHIELD_BLOCK, caster.id);
  },
};

// ---------------------------------------------------------------------------
// Granted by talents. Not in the ability spreadsheet; from Forever's spell data
// ---------------------------------------------------------------------------

/**
 * 10 rage, 3 minute cooldown, any stance.
 *
 * +20% damage done and +5% damage taken for 30 seconds. A straightforward
 * damage cooldown and, unlike the other four talent grants, fully expressible.
 */
export const DEATH_WISH_ABILITY: Ability = {
  id: 'death_wish',
  name: 'Death Wish',
  cooldownMs: seconds(180),
  cost: { resource: 'rage', amount: 10 },
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, DEATH_WISH, caster.id);
  },
};

/**
 * Free, 3 minute cooldown, any stance.
 *
 * Raises maximum health 30% for 20 seconds and takes it back afterwards. It
 * changes no outcome here, because the player cannot drop below one health --
 * see `LAST_STAND` for the whole of it.
 */
export const LAST_STAND_ABILITY: Ability = {
  id: 'last_stand',
  name: 'Last Stand',
  cooldownMs: seconds(180),
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, LAST_STAND, caster.id);
  },
};

/**
 * 30 rage, 30 second cooldown, Battle Stance.
 *
 * INERT AGAINST ONE TARGET, which is every encounter this simulator has. Its
 * only effect is that the next five melee attacks strike an additional
 * opponent, and there is no additional opponent. Defined so the talent grants
 * something real; kept out of every rotation so it does not burn rage for
 * nothing.
 */
export const SWEEPING_STRIKES_ABILITY: Ability = {
  id: 'sweeping_strikes',
  stances: ['battle_stance'],
  name: 'Sweeping Strikes',
  cooldownMs: seconds(30),
  cost: { resource: 'rage', amount: 30 },
  requiresTarget: false,
  targets: { maxTargets: 2 },
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, SWEEPING_STRIKES, caster.id);
  },
};

// ---------------------------------------------------------------------------
// Charge and stances
// ---------------------------------------------------------------------------

/** The rage Charge generates, per the sheet's "Generates 15". */
export const CHARGE_RAGE_GENERATED = 15;

/** The key Improved Charge uses to add to the rage Charge generates. */
export const CHARGE_RAGE_BONUS = 'rage';

/**
 * Free, 15 second cooldown, and it GENERATES 15 rage rather than costing any.
 *
 * `AbilityCost` has no negative case, so the grant happens in `onCast`.
 *
 * Charge's real constraints — a minimum range, and being out of combat in most
 * rulesets — are not modelled, because the sheet states neither. Against a
 * training dummy that makes it a free 15 rage every 15 seconds, which is very
 * probably too generous. It is left out of the rotation for that reason.
 */
/**
 * "Cannot be used in combat", expressed in a simulator that opens IN combat.
 *
 * ----------------------------------------------------------------------------
 * THE RULESET OWNER'S RULE: if Charge is in a priority list it is used exactly
 * once, as the first player action, because it cannot be used after that.
 *
 * So the only moment it is legal is before anything has happened, and that is
 * a moment the clock can name: timestamp zero. One test, on the ABILITY rather
 * than on each list that includes it -- three lists would otherwise each carry
 * a copy of the same rule and the fourth would forget it.
 *
 * WHY NOT A "HAS CAST IT" FLAG. That would allow a second Charge at fifteen
 * seconds if the first were somehow skipped, which is the failure mode this
 * rule exists to prevent. Zero is not "once"; it is "at the pull", and once
 * falls out of it because the clock only passes zero one time.
 *
 * THE COOLDOWN IS NOW DECORATION and is kept anyway: it is Forever's number,
 * and a rule that happens to make another rule unreachable is not a reason to
 * delete the second one.
 * ----------------------------------------------------------------------------
 */
export const CHARGE_OPENING_TIMESTAMP_MS = 0;

export const CHARGE: Ability = {
  id: 'charge',
  stances: ['battle_stance'],
  name: 'Charge',
  cooldownMs: seconds(15),
  attackTable: 'ranged-special',
  requiresTarget: false,
  canCast: ({ simulation }) => simulation.clock.now() === CHARGE_OPENING_TIMESTAMP_MS,
  // Off the global cooldown, by the ruleset owner's rule. See
  // docs/global-cooldown.md for the three Warrior abilities this covers.
  triggersGcd: false,
  onCast: ({ simulation, caster, ability }) => {
    // Improved Charge adds to the rage generated. That number lives inside this
    // body rather than in a declared field, so it arrives as a named bonus on
    // the copy of this ability built for a character who took the talent.
    const bonus = ability.bonuses?.[CHARGE_RAGE_BONUS] ?? 0;
    simulation.grantResource(caster, 'rage', CHARGE_RAGE_GENERATED + bonus, {
      id: 'charge',
      name: 'Charge',
    });
  },
};

/** Swap to a stance, clearing whichever one is currently up. */
function stanceAbility(id: string, aura: (typeof WARRIOR_STANCES)[number]): Ability {
  return {
    grantsStance: aura.id,
    id,
    name: aura.name,
    cooldownMs: seconds(1),
    /*
     * ONE SECOND SHARED BY ALL THREE, stated by the ruleset owner.
     *
     * Each stance having its own cooldown did not achieve this: a warrior
     * could go Berserker to Defensive to Battle without the clock moving,
     * because no two casts were the same ability. Only the group stops that.
     */
    cooldownGroup: 'warrior_stance',
    requiresTarget: false,
    // A stance swap is not a global cooldown in any ruleset that has stances.
    // UNSTATED in the sheet; this is an assumption.
    triggersGcd: false,
    onCast: ({ simulation, caster, ability: self }) => {
      const already = caster.auras.has(aura.id);
      for (const stance of WARRIOR_STANCES) {
        if (stance.id !== aura.id) caster.auras.remove(simulation, stance.id);
      }
      simulation.applyAura(caster, aura, caster.id);

      /*
       * CHANGING STANCE DROPS RAGE ABOVE THE FLOOR. This is the cost that makes
       * stance dancing a decision rather than a free action, and the simulator
       * charged nothing for it until now -- so the rotation swapped whenever
       * anything in another stance looked marginally better.
       *
       * Only on an actual CHANGE. Re-casting the stance you are already in is
       * not a change and must not burn the bar; without this guard a rotation
       * that re-confirmed its stance would drain itself.
       *
       * Improved Tactical Mastery raises the floor through a named bonus, the
       * same way Improved Charge raises Charge's rage, so the number lives with
       * the talent and the rule lives here.
       */
      if (!already) {
        const rage = caster.resources.get('rage');
        const floor = STANCE_RAGE_FLOOR + (self.bonuses?.[STANCE_RAGE_RETAINED_BONUS] ?? 0);
        if (rage && rage.current > floor) {
          const lost = rage.current - floor;
          rage.drain(lost);
          /*
           * EMITTED, not just drained. Rage that leaves the bar without a
           * telemetry event is rage the ledger cannot account for -- gained
           * minus spent stops equalling what is left, and a test caught
           * exactly that within a minute of the drain being added.
           *
           * It also has to be visible for its own sake: the cost of stance
           * dancing is the thing this talent is about, and it belongs in the
           * rage breakdown beside the abilities that spent the rest.
           */
          simulation.telemetry.emit({
            type: 'resource_spent',
            timestamp: simulation.clock.now(),
            actorId: caster.id,
            resource: 'rage',
            amount: lost,
            wasted: 0,
            current: rage.current,
            source: 'stance_change',
            sourceName: 'Stance change',
          });
        }
      }
    },
  };
}

/**
 * NOT IN THE SPREADSHEET.
 *
 * The sheet has Berserker Stance and Defensive Stance and no Battle Stance
 * row. A warrior with no way back to a neutral stance is not a coherent
 * ruleset, so this is defined with the same cost and cooldown as the other two
 * — an assumption, flagged here and in the docs.
 */
export const BATTLE_STANCE_ABILITY = stanceAbility('battle_stance_cast', BATTLE_STANCE);
export const DEFENSIVE_STANCE_ABILITY = stanceAbility(
  'defensive_stance_cast',
  DEFENSIVE_STANCE,
);
export const BERSERKER_STANCE_ABILITY = stanceAbility(
  'berserker_stance_cast',
  BERSERKER_STANCE,
);

// ---------------------------------------------------------------------------
// The book
// ---------------------------------------------------------------------------

/**
 * Every warrior ability in the spreadsheet.
 *
 * Which of them a given combat style can actually use is a separate question
 * from which exist, and stance gating is still an open question with the
 * ruleset owner, so no filtering happens here yet.
 */
export const WARRIOR_ABILITIES: readonly Ability[] = [
  MORTAL_STRIKE,
  BLOODTHIRST,
  SLAM,
  WHIRLWIND,
  SPEARING_STRIKE,
  OVERPOWER,
  REVENGE,
  SHIELD_SLAM,
  HAMSTRING,
  THUNDER_CLAP,
  INTERCEPT,
  EXECUTE,
  HEROIC_STRIKE,
  CLEAVE,
  REND_ABILITY,
  SUNDER_ARMOR_ABILITY,
  DEMORALIZING_SHOUT_ABILITY,
  BATTLE_SHOUT_ABILITY,
  RECKLESSNESS_ABILITY,
  BERSERKER_RAGE_ABILITY,
  BLOODRAGE_ABILITY,
  SHIELD_WALL_ABILITY,
  SHIELD_BLOCK_ABILITY,
  CHARGE,
  BATTLE_STANCE_ABILITY,
  DEFENSIVE_STANCE_ABILITY,
  BERSERKER_STANCE_ABILITY,
  DEATH_WISH_ABILITY,
  LAST_STAND_ABILITY,
  SWEEPING_STRIKES_ABILITY,
];

/** Look one up by id, for tests and for the rotation. */
export function warriorAbility(id: string): Ability | undefined {
  return WARRIOR_ABILITIES.find((ability) => ability.id === id);
}
