import type { AuraDefinition } from '../../engine';
import { RATING_PER_PERCENT, dealDamage, flat, seconds } from '../../engine';

/**
 * Hunter auras, from the WoW Forever beta client and the Forever Hunter wiki.
 *
 * ----------------------------------------------------------------------------
 * A SECOND SOURCE OF RECORD ARRIVES HERE. The ruleset owner named
 * `github.com/classic-hunter/forever-hunter/wiki` as the reference for pet
 * scaling, and it turned out to carry a full Forever-versus-Classic diff for
 * the whole class -- every changed ability's new numbers, the pet stat
 * formulas, and which talents are new. Where it and the spellbook overlap they
 * agree; where only the wiki has something -- pet scaling, focus regeneration
 * -- it is the only source there is.
 *
 * DAMAGE-OVER-TIME EFFECTS CRIT AT RANGED CRIT AND DO NOT SNAPSHOT, which the
 * wiki states outright: "DoTs dynamically recalculate damage rather than
 * snapshotting Attack Power when applied". A periodic tick here already reads
 * the source's live stats, so that is the engine's existing behaviour rather
 * than anything new.
 * ----------------------------------------------------------------------------
 */

const FIRE = 'fire' as const;
const NATURE = 'nature' as const;
const PHYSICAL = 'physical' as const;

/** A flat percentage as the engine's own haste rating. */
const hasteFromPercent = (percent: number) =>
  flat('hasteRating', percent * RATING_PER_PERCENT.haste);

/**
 * Hunter’s Mark: "+71 Ranged Attack Power for all attackers against that
 * target", 60 mana, instant, two minutes.
 *
 * ------------------------------------------------------------------------------
 * A FOREVER NUMBER. The spellbook marks it `versusClassic: "changed"`, so 71 is
 * this ruleset’s figure rather than one inherited.
 *
 * MODELLED AS A BUFF ON THE HUNTER, AND IT IS REALLY A DEBUFF ON THE TARGET.
 * With one attacker and one target the two are numerically identical, and the
 * engine has no route from "a debuff the target carries" to "the attacker’s
 * ranged attack power" -- stat modifiers apply to the actor holding them. The
 * difference would show in a raid, where the mark helps every hunter present;
 * this simulates one character, which is the same reason Trueshot Aura is a
 * selectable raid buff rather than an ability.
 *
 * WHY IT WAS MISSING UNTIL NOW, which is worth writing down: it was dismissed
 * once as "a raid-buff-shaped ability no priority list casts". That was the
 * wrong shape -- it is a single instant cast the Hunter makes on the pull, the
 * same shape as the Aspect every list already opens with. And it was worth
 * nothing to check while a bow scaled off MELEE attack power; once the ranged
 * pool started driving auto-shot it became worth roughly ten DPS.
 *
 * TWO MINUTES OUTLASTS EVERY FIGHT HERE, so it is cast once and never
 * refreshed. `canCast` refuses while it is up, so the entry falls through.
 * ------------------------------------------------------------------------------
 */
export const HUNTERS_MARK_RANGED_ATTACK_POWER = 71;
export const HUNTERS_MARK_DURATION_MS = seconds(120);

export const HUNTERS_MARK: AuraDefinition = {
  id: 'hunters_mark',
  name: "Hunter’s Mark",
  durationMs: HUNTERS_MARK_DURATION_MS,
  statModifiers: [flat('rangedAttackPower', HUNTERS_MARK_RANGED_ATTACK_POWER)],
};

// ---------------------------------------------------------------------------
// Aspects -- one at a time, like a stance or a seal
// ---------------------------------------------------------------------------

/** "Only one Aspect can be active at a time." */
export const ASPECT_AURA_IDS = ['aspect_of_the_hawk', 'aspect_of_the_beast'] as const;

export const ASPECT_OF_THE_HAWK_ATTACK_POWER = 120;

export const ASPECT_OF_THE_HAWK: AuraDefinition = {
  id: 'aspect_of_the_hawk',
  name: 'Aspect of the Hawk',
  durationMs: 0,
  statModifiers: [flat('rangedAttackPower', ASPECT_OF_THE_HAWK_ATTACK_POWER)],
};

/**
 * Aspect of the Beast: "increasing Melee Attack Power by 110."
 *
 * EXPANDED FROM ONE RANK TO FOUR IN FOREVER and it now grants melee attack
 * power, which Classic's did not -- the wiki lists it as a change and gives
 * the progression 50/70/90/110. It is what makes a Lone Wolf MELEE hunter a
 * build at all.
 */
export const ASPECT_OF_THE_BEAST_ATTACK_POWER = 110;

export const ASPECT_OF_THE_BEAST: AuraDefinition = {
  id: 'aspect_of_the_beast',
  name: 'Aspect of the Beast',
  durationMs: 0,
  statModifiers: [flat('attackPower', ASPECT_OF_THE_BEAST_ATTACK_POWER)],
};

// ---------------------------------------------------------------------------
// Stings
// ---------------------------------------------------------------------------

/**
 * Serpent Sting: "555 Nature damage over 15 sec", and in Forever it SCALES.
 *
 * ----------------------------------------------------------------------------
 * THE FIRST ATTACK POWER COEFFICIENT ON A DOT IN THIS PROJECT, and the wiki
 * states it twice over: "Now scales with 15% RAP over the full duration" and
 * "Each tick gains 3% RAP". Five ticks of 3% is 15%, so the two agree exactly
 * -- which is the reading that reproduces both statements, and it is why the
 * cadence is three seconds rather than anything else.
 *
 * NOT SNAPSHOT. "Changes to RAP while active affect subsequent ticks", so
 * Rapid Fire landing mid-sting raises the ticks after it. The tick reads the
 * source's live stats, which is what makes that free.
 *
 * TICKS CRIT AT RANGED CRIT. "Hunter DoTs use ranged Crit", which `critFrom`
 * names directly.
 * ----------------------------------------------------------------------------
 */
export const SERPENT_STING_TOTAL = 555;
export const SERPENT_STING_DURATION_MS = seconds(15);
export const SERPENT_STING_TICK_INTERVAL_MS = seconds(3);
export const SERPENT_STING_RAP_PER_TICK = 0.03;

export const SERPENT_STING: AuraDefinition = {
  id: 'serpent_sting',
  name: 'Serpent Sting',
  durationMs: SERPENT_STING_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: SERPENT_STING_TICK_INTERVAL_MS,
    onTick: (context, aura) => {
      const source = context.combatant(aura.sourceId);
      const target = context.combatant(aura.targetId);
      if (!source || !target || !target.isAlive) return;

      const ticks = SERPENT_STING_DURATION_MS / SERPENT_STING_TICK_INTERVAL_MS;
      const rangedAttackPower = source.stats.effective.rangedAttackPower;

      dealDamage(context, {
        source,
        target,
        abilityId: aura.id,
        abilityName: aura.name,
        school: NATURE,
        baseAmount:
          SERPENT_STING_TOTAL / ticks + rangedAttackPower * SERPENT_STING_RAP_PER_TICK,
        // The attack power is already in `baseAmount`, read LIVE off the
        // source every tick -- which is what "does not snapshot" means.
        powerCoefficient: 0,
        periodic: true,
        critFrom: 'ranged-special',
        appliesArmor: false,
      });
    },
  },
};

// ---------------------------------------------------------------------------
// Traps
// ---------------------------------------------------------------------------

/**
 * Immolation Trap: "burn the first enemy to approach for 690 Fire damage over
 * 15 sec."
 *
 * ----------------------------------------------------------------------------
 * THE RULESET OWNER PUT A TRAP IN SCOPE, which no other trap is. Asked whether
 * a trap belongs in this simulator at all -- it is placed on the ground and
 * triggers when something walks onto it, and the engine has no positions --
 * the answer was to build this one and this one only: "Let's add Immolation
 * Trap. Assume it triggers INSTANTLY WHEN CAST. Immolation trap doesn't scale
 * with attack power or spell power currently."
 *
 * So the "first enemy to approach" clause is the part that is ruled away, and
 * the trap is a 245-mana instant that applies a burn. Explosive Trap is NOT
 * covered by that ruling and stays undeclared: the owner named one trap.
 *
 * NO COEFFICIENT, BY THE SAME RULING, and that makes it the only damaging
 * Hunter effect in the class with none -- so it does not grow with gear and its
 * share of a profile falls as the rest of the build scales. Stated here because
 * a reader who knows `everySpellScales.test.ts` will come looking for why this
 * one is exempt, and the answer is the owner's sentence rather than an
 * oversight.
 *
 * FIVE TICKS OF 138. Three seconds is the cadence every Hunter DoT here uses
 * and 15 divides evenly by it, which is the same reading Serpent Sting's two
 * wiki statements forced.
 *
 * IT CRITS AT RANGED CRIT, which is not an interpretation: "Hunter DoTs use
 * ranged Crit" is the wiki's own sentence and Serpent Sting is already built on
 * it. A trap rolls no attack table of its own, so `critFrom` is the whole of
 * how it can crit at all.
 * ----------------------------------------------------------------------------
 */
export const IMMOLATION_TRAP_TOTAL = 690;
export const IMMOLATION_TRAP_DURATION_MS = seconds(15);
export const IMMOLATION_TRAP_TICK_INTERVAL_MS = seconds(3);

export const IMMOLATION_TRAP: AuraDefinition = {
  id: 'immolation_trap',
  name: 'Immolation Trap',
  durationMs: IMMOLATION_TRAP_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: IMMOLATION_TRAP_TICK_INTERVAL_MS,
    onTick: (context, aura) => {
      const source = context.combatant(aura.sourceId);
      const target = context.combatant(aura.targetId);
      if (!source || !target || !target.isAlive) return;

      const ticks = IMMOLATION_TRAP_DURATION_MS / IMMOLATION_TRAP_TICK_INTERVAL_MS;

      dealDamage(context, {
        source,
        target,
        abilityId: aura.id,
        abilityName: aura.name,
        school: FIRE,
        baseAmount: IMMOLATION_TRAP_TOTAL / ticks,
        // The owner's ruling: no attack power and no spell power.
        powerCoefficient: 0,
        periodic: true,
        critFrom: 'ranged-special',
      });
    },
  },
};

/*
 * ============================================================================
 * EXPLOSIVE TRAP's burn. "Place a Fire trap that explodes when an enemy
 * approaches, causing 208 to 264 Fire damage and 330 additional Fire damage over
 * 20 sec to all within 10 yards." 520 mana, instant, 30-second cooldown, rank 3
 * and rank 3 is max.
 *
 * ----------------------------------------------------------------------------
 * THE OWNER NAMED IT SECOND AND SETTLED THE ONE QUESTION IT RAISED: "Explosive
 * trap can be implemented -- there isn't an AP or SP scaler, all the information
 * should be known already." So it takes the same two rulings Immolation Trap
 * does -- it triggers instantly when cast, and it scales with neither pool --
 * and nothing about it was inferred by analogy from the first trap. The earlier
 * refusal to infer was right: a ruling covers what it says.
 *
 * IT IS A HYBRID WHERE IMMOLATION IS NOT. The initial 208-264 lands on the cast
 * and lives on the ABILITY; this aura is only the 330 over 20 seconds. Both
 * halves are Fire and neither takes a coefficient, so the split costs nothing
 * here -- but it is the reason the ability carries damage at all, which no other
 * trap in the project does.
 *
 * TEN TICKS OF 33, AND THE CADENCE IS AN INTERPRETATION. Every other Hunter
 * damage-over-time effect here ticks every THREE seconds, and 20 does not divide
 * by 3 -- so that convention cannot hold and something had to be chosen. Two
 * seconds is the pick: it divides 20 exactly, 330 over 10 ticks is a whole 33 a
 * tick, and it is a cadence the project already uses (the Rogue's Rupture).
 * Four seconds would also divide evenly, at 66 a tick; the figures are
 * identical over the duration and differ only in how the damage is bunched, so
 * nothing measurable rests on it. **What would settle it is a stated tick
 * interval from the owner or a source.**
 *
 * NO COEFFICIENT, by the owner's words, which makes it the second damaging
 * Hunter effect with none. Its `everySpellScales` exemption says so.
 *
 * IT CRITS AT RANGED CRIT, like Immolation Trap and Serpent Sting -- "Hunter
 * DoTs use ranged Crit" is the wiki's own sentence, and a trap rolls no attack
 * table of its own, so `critFrom` is the whole of how it can crit.
 * ============================================================================
 */
export const EXPLOSIVE_TRAP_BURN_TOTAL = 330;
export const EXPLOSIVE_TRAP_BURN_DURATION_MS = seconds(20);
export const EXPLOSIVE_TRAP_TICK_INTERVAL_MS = seconds(2);

export const EXPLOSIVE_TRAP: AuraDefinition = {
  id: 'explosive_trap',
  name: 'Explosive Trap',
  durationMs: EXPLOSIVE_TRAP_BURN_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: EXPLOSIVE_TRAP_TICK_INTERVAL_MS,
    onTick: (context, aura) => {
      const source = context.combatant(aura.sourceId);
      const target = context.combatant(aura.targetId);
      if (!source || !target || !target.isAlive) return;

      const ticks = EXPLOSIVE_TRAP_BURN_DURATION_MS / EXPLOSIVE_TRAP_TICK_INTERVAL_MS;

      dealDamage(context, {
        source,
        target,
        abilityId: aura.id,
        abilityName: aura.name,
        school: FIRE,
        baseAmount: EXPLOSIVE_TRAP_BURN_TOTAL / ticks,
        // The owner's ruling: no attack power and no spell power.
        powerCoefficient: 0,
        periodic: true,
        critFrom: 'ranged-special',
      });
    },
  },
};

// ---------------------------------------------------------------------------
// Talent bleeds
// ---------------------------------------------------------------------------

/**
 * Lacerating Strikes: "Your Mongoose Bite also causes the target to Bleed for
 * damage over 21 sec equal to 40% of the damage done by Mongoose Bite."
 *
 * ----------------------------------------------------------------------------
 * A SHARE OF WHAT THE STRIKE ACTUALLY DEALT, WHICH IS NOT DEEP WOUNDS' SHAPE.
 * Deep Wounds is a percentage of the WEAPON'S AVERAGE damage, recomputed from
 * the weapon held; this is a percentage of one resolved hit, crit included. So
 * the total arrives as a number rather than as a rank, and the aura is built
 * per application from `AttackEvent.amount` -- which is exactly what an attack
 * reaction is handed.
 *
 * FIXED AT APPLICATION, for the same reason Deep Wounds fixes its own: the
 * source keys the bleed to the strike that caused it, so a later Mongoose Bite
 * REPLACES the bleed rather than retuning the ticks already scheduled.
 *
 * SEVEN TICKS OF THREE SECONDS. 21 seconds is stated and three is the cadence
 * every other bleed in this ruleset uses, Serpent Sting and Rend included; 21
 * divides evenly by it.
 *
 * NO SECOND COEFFICIENT. The 40% is taken of damage that has already been
 * through weapon scaling, attack power, the crit multiplier and the target's
 * armor, so scaling it again would count all of that twice.
 *
 * A BLEED IS PHYSICAL AND IGNORES ARMOR -- the Forever rule every bleed here
 * follows -- and it crits at MELEE crit, because a melee special is what
 * applied it. That is `critFrom` doing the one job it has.
 * ----------------------------------------------------------------------------
 */
export const LACERATING_STRIKES_DURATION_MS = seconds(21);
export const LACERATING_STRIKES_TICK_INTERVAL_MS = seconds(3);
export const LACERATING_STRIKES_TICKS =
  LACERATING_STRIKES_DURATION_MS / LACERATING_STRIKES_TICK_INTERVAL_MS;

export function laceratingStrikesAura(totalDamage: number): AuraDefinition {
  return {
    id: 'lacerating_strikes',
    name: 'Lacerating Strikes',
    durationMs: LACERATING_STRIKES_DURATION_MS,
    isDebuff: true,
    refreshBehaviour: 'reset',
    periodic: {
      intervalMs: LACERATING_STRIKES_TICK_INTERVAL_MS,
      onTick: (context, aura) => {
        const source = context.combatant(aura.sourceId);
        const target = context.combatant(aura.targetId);
        if (!source || !target || !target.isAlive) return;

        dealDamage(context, {
          source,
          target,
          abilityId: aura.id,
          abilityName: aura.name,
          school: PHYSICAL,
          baseAmount: totalDamage / LACERATING_STRIKES_TICKS,
          // The share IS the scaling: everything is already inside the hit.
          powerCoefficient: 0,
          periodic: true,
          critFrom: 'melee-special',
          appliesArmor: false,
        });
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Cooldowns and procs
// ---------------------------------------------------------------------------

/** "Increases ranged and melee attack speed by 40% for 15 sec." */
export const RAPID_FIRE_HASTE_PERCENT = 40;
export const RAPID_FIRE_DURATION_MS = seconds(15);

export const RAPID_FIRE: AuraDefinition = {
  id: 'rapid_fire',
  name: 'Rapid Fire',
  durationMs: RAPID_FIRE_DURATION_MS,
  refreshBehaviour: 'reset',
  statModifiers: [hasteFromPercent(RAPID_FIRE_HASTE_PERCENT)],
};

/**
 * Deadly Aspects: "While Aspect of the Hawk is active, Auto Shot has a 10%
 * chance of increasing ranged attack speed by 30% for 12 sec."
 *
 * REPLACED IMPROVED ASPECT OF THE HAWK, and the Beast half is new -- the same
 * proc off melee auto-attacks while Aspect of the Beast is up. One aura serves
 * both, because haste is haste and the engine has one haste rating.
 */
export const DEADLY_ASPECTS_HASTE_PERCENT = 30;
export const DEADLY_ASPECTS_DURATION_MS = seconds(12);

export const DEADLY_ASPECTS: AuraDefinition = {
  id: 'deadly_aspects',
  name: 'Deadly Aspects',
  durationMs: DEADLY_ASPECTS_DURATION_MS,
  refreshBehaviour: 'reset',
  statModifiers: [hasteFromPercent(DEADLY_ASPECTS_HASTE_PERCENT)],
};

/** Frenzy: "a {0}% chance to gain a 30% attack speed increase for 8 sec". */
export const FRENZY_HASTE_PERCENT = 30;
export const FRENZY_DURATION_MS = seconds(8);

export const FRENZY: AuraDefinition = {
  id: 'frenzy',
  name: 'Frenzy',
  durationMs: FRENZY_DURATION_MS,
  refreshBehaviour: 'reset',
  statModifiers: [hasteFromPercent(FRENZY_HASTE_PERCENT)],
};

/** Bestial Wrath: "causing 50% additional damage for 18 sec". */
export const BESTIAL_WRATH_DAMAGE = 1.5;
export const BESTIAL_WRATH_DURATION_MS = seconds(18);

export const BESTIAL_WRATH: AuraDefinition = {
  id: 'bestial_wrath',
  name: 'Bestial Wrath',
  durationMs: BESTIAL_WRATH_DURATION_MS,
  damageDoneMultiplier: BESTIAL_WRATH_DAMAGE,
};

/**
 * Summon Hawk: TWO INDEPENDENT HAWKS, each on its own eighteen-second clock.
 *
 * ----------------------------------------------------------------------------
 * MODELLED WITHOUT A COMBATANT, on the ruleset owner's call -- the engine
 * cannot add one mid-fight. The damage lands on the target and is credited to
 * the Hunter; what is lost is that a hawk is not separately targetable and
 * cannot be killed, neither of which any encounter here does.
 *
 * TWO AURAS, NOT ONE AURA WITH TWO STACKS, AND THAT IS THE WHOLE POINT OF THIS
 * VERSION. A stacked aura has ONE duration and ONE tick chain, so summoning the
 * second hawk reset the first and both expired together -- the caveat the old
 * `HAWK_UNMODELLED` admitted to and called "a fraction of a hawk either way".
 * The owner's instruction is explicit that it should not work that way:
 * "implemented in such a way that there is a hawk_1 and hawk_2, so that casting
 * one doesn't overwrite the other."
 *
 * So `HAWK_AURAS` is two definitions that differ ONLY in their id. Each carries
 * its own expiry and its own three-second chain, and a hawk summoned at t=6
 * lives to t=24 while one summoned at t=0 dies at t=18.
 *
 * THE DAMAGE EVENTS STILL SAY `summon_hawk`, AND THAT IS LOAD-BEARING RATHER
 * THAN COSMETIC. Unleashed Fury declares `abilityDamage` and Ferocity
 * `abilityCrit` against the id `summon_hawk`, and both reached the old aura
 * because the aura's id WAS `summon_hawk` -- a periodic tick carries the aura's
 * id, which is the route Improved Rend takes on the Warrior. Renaming the auras
 * to `hawk_1` and `hawk_2` breaks that silently: two talents a Beast Mastery
 * build takes would stop applying to a quarter of its damage and nothing would
 * error. `abilityId` is therefore passed EXPLICITLY, and
 * `petsAndHunter.test.ts` asserts both talents still reach a tick.
 *
 * ONE NAME IN THE DAMAGE TABLE. Both report as "Hawk" -- the breakdown keys on
 * `abilityName`, so the two merge into the row a reader means by "the hawk"
 * rather than splitting into "Hawk 1" and "Hawk 2".
 * ----------------------------------------------------------------------------
 */
/*
 * 108 PLUS 5% OF RANGED ATTACK POWER, SEVEN TIMES. The ruleset owner's figures,
 * 2026-10-02, and the second revision of this ability in three days:
 *
 *   "Summon Hawk does 108 physical damage + Hunter's Ranged Attack Power * 0.05
 *    instantly. And then the same damage again every 3 seconds for 18 seconds.
 *    Totalling 7 hits."
 *
 * SEVEN IS THE CHECK ON THE OTHER THREE NUMBERS, which is why it is asserted
 * rather than derived: one instant hit plus 18 / 3 ticks is 7, so a cadence or
 * a duration that drifts fails `hawkStrikes()` instead of quietly changing the
 * ability's total. The old reading was 108 flat every TWO seconds, which is ten
 * hits and no scaling.
 *
 * AND 32 WAS RANK 1 OF THE ABILITY, which is worth keeping here because the
 * comment this replaces got it wrong twice over. It claimed "32 is not in
 * either source"; 32 is the TALENT tooltip's figure, and a talent tooltip shows
 * rank 1 of the ability it grants. The spellbook capture says `"rank": 4` and
 * 108 and `foreverchanges.pro` says 110, so the two "disagreeing" sources were
 * one number at two ranks. Same trap as Sniper Shot, one file over.
 *
 * NEITHER SOURCE QUANTIFIES THE "CONTINUING ASSAULT" AT ALL -- both state one
 * figure for a hawk that "continu[es] its assault for 18 sec" -- so the cadence,
 * the hit count and the coefficient are all the owner's and none of them is in
 * the client data.
 */
export const HAWK_DAMAGE_PER_STRIKE = 108;
export const HAWK_RANGED_ATTACK_POWER_COEFFICIENT = 0.05;
export const HAWK_DURATION_MS = seconds(18);
export const HAWK_STRIKE_INTERVAL_MS = seconds(3);
export const HAWK_MAX_ACTIVE = 2;

/** One instant hit plus a tick every three seconds for eighteen. */
export const HAWK_STRIKES = 1 + HAWK_DURATION_MS / HAWK_STRIKE_INTERVAL_MS;

/** What the ability and each tick both deal. One formula, used twice. */
export function hawkStrikeDamage(rangedAttackPower: number): number {
  return (
    HAWK_DAMAGE_PER_STRIKE + rangedAttackPower * HAWK_RANGED_ATTACK_POWER_COEFFICIENT
  );
}

/**
 * The id the hawk's damage is CREDITED to, which is not the aura's.
 *
 * Unleashed Fury and Ferocity both name it. See the header above.
 */
export const HAWK_ABILITY_ID = 'summon_hawk';
export const HAWK_DAMAGE_NAME = 'Hawk';

export const HAWK_UNMODELLED =
  'A hawk is modelled as a repeating strike rather than as a creature, on the ' +
  'ruleset owner’s call -- the engine cannot add a combatant mid-fight. Its ' +
  'damage lands and is credited, both hawks deal damage, and each runs its own ' +
  'eighteen-second clock. What is left is that a hawk is not separately ' +
  'targetable and cannot be killed, neither of which any encounter here does.';

function hawkAura(id: string): AuraDefinition {
  return {
    id,
    name: HAWK_DAMAGE_NAME,
    durationMs: HAWK_DURATION_MS,
    refreshBehaviour: 'reset',
    periodic: {
      intervalMs: HAWK_STRIKE_INTERVAL_MS,
      onTick: (context, aura) => {
        const source = context.combatant(aura.sourceId);
        if (!source) return;
        const target = context.defaultTargetFor(source);
        if (!target || !target.isAlive) return;

        dealDamage(context, {
          source,
          target,
          // NOT `aura.id` -- see the header. Two talents key on this.
          abilityId: HAWK_ABILITY_ID,
          abilityName: aura.name,
          school: PHYSICAL,
          /*
           * READ LIVE, NOT SNAPSHOT AT SUMMON. Every Hunter effect here reads
           * the source's stats at tick time -- the wiki's "DoTs dynamically
           * recalculate damage rather than snapshotting Attack Power when
           * applied" -- so a Rapid Fire or a Hunter's Mark landing mid-flight
           * raises the strikes after it.
           */
          baseAmount: hawkStrikeDamage(source.stats.effective.rangedAttackPower),
          /*
           * The ranged attack power is already inside `baseAmount`, at the
           * owner's 5%. A coefficient here would count it twice.
           */
          powerCoefficient: 0,
          periodic: true,
          critFrom: 'ranged-special',
          appliesArmor: false,
        });
      },
    },
  };
}

/**
 * The two hawks, in the order they are summoned.
 *
 * A THIRD CAST OVERWRITES RATHER THAN BEING REFUSED, which is the owner's
 * instruction -- "casting a third summon hawk while hawk_1 and hawk_2 are
 * active WOULD cause an overwrite / refresh". The ability permits it and the
 * PRIORITY LIST is what declines to, through its `summoned_hawks < 2` clause.
 * Those are two different statements and this project keeps them apart: an
 * ability says what is legal, a list says what is wise.
 */
export const HAWK_AURAS: readonly AuraDefinition[] = [hawkAura('hawk_1'), hawkAura('hawk_2')];

/** How many hawks this Hunter has in the air. */
export function activeHawks(actor: { auras: { has(id: string): boolean } }): number {
  return HAWK_AURAS.filter((aura) => actor.auras.has(aura.id)).length;
}

/**
 * Lone Wolf: "You deal 20% increased damage with all attacks while you do not
 * have an active pet."
 *
 * THE CONDITION IS CHECKED WHERE THE PET IS DECIDED, not here. A build with
 * the talent is given no pet at all, so "while you do not have an active pet"
 * is always true for it -- which is the honest reading of a talent whose whole
 * point is that you chose not to bring one.
 */
export const LONE_WOLF_DAMAGE = 1.2;

export const LONE_WOLF: AuraDefinition = {
  id: 'lone_wolf',
  name: 'Lone Wolf',
  durationMs: 0,
  damageDoneMultiplier: LONE_WOLF_DAMAGE,
};
