import type { AuraDefinition, Combatant, SimulationContext, WeaponSlot } from '../../engine';
import { RATING_PER_PERCENT, applyHealing, dealDamage, seconds } from '../../engine';

/**
 * Auras a Warrior talent applies.
 *
 * Kept apart from `auras/warrior.ts`, which holds the auras the ABILITY
 * spreadsheet describes. These exist only because a talent was taken, and their
 * numbers come from `src/data/talents/values/warrior.json` rather than from the
 * ability sheet — so a definition here is built per character, from the rank
 * that character actually has.
 */

/** Deep Wounds bleeds for this long, in every rank. */
export const DEEP_WOUNDS_DURATION_MS = seconds(12);
/**
 * TWO SECONDS, SIX TICKS, stated by the ruleset owner.
 *
 * It was THREE for a long time, on four ticks, and the comment beside it said
 * exactly what it was: "the tick interval is not stated. Three seconds is the
 * cadence every other bleed in the ruleset uses, including Rend, and 12 divides
 * evenly by it." An honest interpretation, flagged as one, and wrong -- the
 * owner's wording is "a portion (1/6th) of its damage every 2 seconds".
 *
 * The sixth is not a third constant: this derives it, and the engine derives its
 * own per-tick share the same way from the duration and the interval.
 */
export const DEEP_WOUNDS_TICK_INTERVAL_MS = seconds(2);
export const DEEP_WOUNDS_TICKS = DEEP_WOUNDS_DURATION_MS / DEEP_WOUNDS_TICK_INTERVAL_MS;

/**
 * The WEAPON'S OWN average damage, with NO attack power in it.
 *
 * ----------------------------------------------------------------------------
 * `WeaponProfile.baseDamage` IS ALREADY THIS -- the engine documents it as
 * "average damage per swing before attack power" -- so this is a one-line
 * lookup with a name on it. The name is the point: it used to ADD
 * `powerCoefficient x attackPower` and still be called "weapon average
 * damage", which is a SWING'S average rather than a WEAPON'S.
 *
 * THE ATTACK POWER TERM WAS WRONG, by an official source: "Deep Wounds
 * compared to Vanilla now: ... doesn't scale with Attack Power." The old
 * version read the universal weapon formula -- base + (speed / 14) x AP -- and
 * a test asserted the AP term on purpose, with a comment saying it existed so
 * "the test would catch the aura scaling by attack power twice". It caught the
 * wrong thing: scaling it ONCE was already one time too many.
 *
 * KEPT AS A FUNCTION rather than inlined, because "the weapon's average
 * damage" is the phrase the tooltip uses and the next bleed that quotes it
 * should reach for this rather than re-deriving it and picking up AP again.
 * ----------------------------------------------------------------------------
 */
export function weaponAverageDamage(actor: Combatant, slot: WeaponSlot = 'mainHand'): number {
  return actor.weapons[slot]?.baseDamage ?? 0;
}

/**
 * Deep Wounds: a bleed for a percentage of the weapon's average damage,
 * delivered a sixth every two seconds, and POOLING when it is re-applied.
 *
 * ----------------------------------------------------------------------------
 * THE RULESET OWNER'S THREE CLAUSES, and all three were wrong here.
 *
 *   1. IT CANNOT CRIT. It declared `critFrom: 'melee-special'` and so crit at
 *      the warrior's own melee crit chance.
 *   2. A SIXTH EVERY TWO SECONDS. It ticked every three, four times, which the
 *      comment beside it admitted was an interpretation.
 *   3. A RE-APPLICATION ROLLS THE REMAINDER FORWARD. It declared
 *      `refreshBehaviour: 'reset'` alone, which restarts the clock and throws
 *      the undelivered damage away.
 *
 * "IT CANNOT CRIT" IS AN EXCEPTION TO A DOCUMENTED UNIVERSAL RULE, and that is
 * worth saying loudly because CLAUDE.md states the opposite in general terms:
 * "Every DoT can crit, and none is reduced by armor. A Forever rule, not
 * Classic's." That still holds for every other DoT here. Deep Wounds is the
 * owner's named exception, and the reason is legible -- the bleed is the
 * PRODUCT of a critical strike, so critting again would pay the same roll
 * twice. Expressed by having no `critFrom` at all, which also means the tick
 * draws no random number.
 *
 * THE POOL IS THE INTERESTING ONE. "Any remaining damage from the previous
 * application is rolled over into the new total pool from which the next 1/6th
 * damage tick pulls." No `refreshBehaviour` value can say that -- all three
 * discard the remainder -- so it is `periodic.pool`, an engine mechanic whose
 * arithmetic lives in `AuraCollection.addToPool` and whose NUMBER lives here.
 *
 * THE POOL IS EVALUATED PER APPLICATION, NOT PER TICK, which is a behaviour
 * change on its own. The old code recomputed the weapon's average damage inside
 * `onTick`, so a stat buff landing mid-bleed retuned ticks already scheduled --
 * while the comment directly above it claimed the opposite: "the damage is
 * fixed when the aura is created rather than recomputed per tick". The comment
 * described the right rule and the code did not implement it. It does now, for
 * the comment's own stated reason: the source keys the bleed to the strike that
 * caused it.
 *
 * ----------------------------------------------------------------------------
 * AND AN OFFICIAL SOURCE THEN GAVE THREE BULLETS, "Deep Wounds compared to
 * Vanilla now". Two were already right and the third was not:
 *
 *   "Rolls over its damage when refreshed."           ALREADY DONE -- the pool.
 *   "Doesn't reset its tick timer when it is          ALREADY TRUE, and by
 *    refreshed."                                      accident rather than
 *                                                     design: `refresh` cancels
 *                                                     and reschedules the EXPIRY
 *                                                     and never touches
 *                                                     `tickHandle`. Measured, not
 *                                                     assumed -- a refresh at
 *                                                     3000ms leaves the ticks on
 *                                                     2000/4000/6000. There is a
 *                                                     test now, because nothing
 *                                                     held that up before.
 *   "Doesn't scale with Attack Power."                WRONG HERE. See
 *                                                     `weaponAverageDamage`.
 *
 * THE DURATION STILL RESETS, and that is not a contradiction. The ruleset owner
 * said "the duration resets to 12 seconds" and the official note says the TICK
 * TIMER does not reset -- two different clocks. A refresh restarts the twelve
 * seconds while the ticks keep their own cadence, so a refresh one second after
 * a tick still has its next tick one second later.
 * ----------------------------------------------------------------------------
 */
export function deepWoundsAura(percentOfWeaponDamage: number): AuraDefinition {
  return {
    id: 'deep_wounds',
    name: 'Deep Wounds',
    durationMs: DEEP_WOUNDS_DURATION_MS,
    isDebuff: true,
    isBleed: true,
    /*
     * STILL `reset`, because the DURATION really does restart -- the owner says
     * so in the same sentence. What changed is that the damage no longer goes
     * with it: `periodic.pool` carries that, and the two are independent.
     */
    refreshBehaviour: 'reset',
    periodic: {
      intervalMs: DEEP_WOUNDS_TICK_INTERVAL_MS,
      /*
       * What THIS application contributes. Read from the weapon held at the
       * moment the crit landed, which is what "60% of your melee weapon's
       * average damage" means.
       */
      pool: (context, aura) => {
        const source = context.combatant(aura.sourceId);
        if (!source) return 0;
        return weaponAverageDamage(source) * (percentOfWeaponDamage / 100);
      },
      onTick: (context: SimulationContext, aura) => {
        const source = context.combatant(aura.sourceId);
        const target = context.combatant(aura.targetId);
        if (!source || !target || !target.isAlive) return;

        // This tick's share, taken out of the pool by the engine.
        const amount = aura.drawFromPool();
        if (amount <= 0) return;

        dealDamage(context, {
          source,
          target,
          abilityId: aura.id,
          abilityName: aura.name,
          school: 'physical',
          baseAmount: amount,
          // The percentage IS the scaling. Attack power is already inside the
          // weapon's average damage, so scaling again would count it twice.
          powerCoefficient: 0,
          periodic: true,
          /*
           * NO `critFrom`, DELIBERATELY -- the owner's ruling that Deep Wounds
           * cannot crit, against the general Forever rule that every DoT can.
           * Omitting the field is how that is said, and it also means the tick
           * draws no random number, so it cannot shift a seeded run.
           */
          // A bleed is physical and ignores armor.
          appliesArmor: false,
        });
      },
    },
  };
}

/**
 * Flurry: melee haste for the next three swings after ANY non-DoT critical
 * strike.
 *
 * ----------------------------------------------------------------------------
 * THE RULESET OWNER'S WORDING, and all three clauses are theirs:
 *
 *   - ANY non-DoT critical strike restores it to three swings. Not just a
 *     weapon crit -- the reaction gated on `isWeaponUse` and so refused Thunder
 *     Clap, Intercept and Charge, which resolve on the ranged table and carry
 *     no weapon slot. A reaction never sees a periodic tick at all
 *     (`dealDamage` will not dispatch one), so `outcomes: ['crit']` IS "any
 *     non-DoT crit" and no condition is needed.
 *   - BOTH main-hand and off-hand auto-attacks spend a charge. They do:
 *     `consumeSwingCharges` runs in the per-slot swing handler.
 *   - AN EXTRA ATTACK SPENDS ONE TOO, because it finishes the main hand's swing
 *     timer and therefore IS a main-hand swing. Confirmed by the owner rather
 *     than assumed -- `extraAttack` has always consumed, and the question was
 *     whether it should.
 *
 * A CRITTING SWING CONSUMES AND THEN RESTORES, which the swing handler's order
 * already produces: it spends a charge, resolves the swing, and the crit
 * re-applies at full. So an always-critting warrior sits at three and never
 * shows a part-spent window.
 * ----------------------------------------------------------------------------
 *
 * `consumedBySwing` is what makes "three swings" rather than "N seconds" work.
 * The duration is a long backstop so that a warrior who stops swinging does not
 * carry the buff forever; in practice the charges run out first.
 *
 * INTERPRETATION: the swing count (3) is stated by the source, the 12 second
 * backstop is not. Classic's Flurry lasts 15 seconds; 12 is used here only
 * because no fight state should ever reach it, and it is flagged rather than
 * presented as ruleset data.
 */
export const FLURRY_SWINGS = 3;
export const PLACEHOLDER_FLURRY_DURATION_MS = seconds(12);

export function flurryAura(hastePercent: number): AuraDefinition {
  return {
    id: 'flurry',
    name: 'Flurry',
    durationMs: PLACEHOLDER_FLURRY_DURATION_MS,
    maxStacks: FLURRY_SWINGS,
    // Each swing eats one charge, and the aura falls off at zero.
    consumedBySwing: true,
    /*
     * STARTS FULL AND IS RESTORED TO FULL, declared rather than done by hand.
     *
     * The reaction used to write `instance.stacks = FLURRY_SWINGS` straight
     * after `applyAura` returned, which worked and lied: `apply` had already
     * emitted `stacks: 1` and `refresh` `stacks: 2`, so every Flurry event in
     * the log and in any analyzer reported a count the engine did not hold.
     * The same shape as a bare `Resource.drain` -- state moves, telemetry does
     * not follow.
     */
    chargesOnApply: FLURRY_SWINGS,
    refreshRestoresCharges: true,
    /*
     * The talent states a flat percentage; the engine derives its haste
     * multiplier from `hasteRating`. Converting with the SAME constant the
     * engine divides by makes the round trip exact:
     *
     *     rating   = p x RATING_PER_PERCENT.haste
     *     multiplier = 1 + rating / RATING_PER_PERCENT.haste / 100 = 1 + p/100
     *
     * so the result is p% more attack speed whatever that constant is set to.
     */
    statModifiers: [
      {
        stat: 'hasteRating',
        operation: 'flat',
        value: hastePercent * RATING_PER_PERCENT.haste,
      },
    ],
  };
}

/*
 * Blood Craze: "Regenerates {1/2/3}% of your total Health over 6 sec after
 * being the victim of a critical strike, dealing damage with Bloodthirst, or
 * suffering more than 20% of your maximum Health from a single attack."
 *
 * ----------------------------------------------------------------------------
 * A HEAL-OVER-TIME, so it is the mirror of Deep Wounds above and shares its
 * shape. Both the PERCENTAGE and the SIX SECONDS are the source's own.
 *
 * THE TICK CADENCE IS THE RULESET OWNER'S, given directly: once every two
 * seconds, three ticks across the six. It is no longer a placeholder and no
 * longer borrowed from Classic -- which happens to agree, and that agreement
 * is now a coincidence rather than the reason.
 *
 * The figures matched all along, so nothing about a result changed when this
 * was confirmed. What changed is that it can be relied on: the total was never
 * in doubt -- 3% of maximum health arrives within six seconds whatever the
 * cadence -- but WHEN it arrives decides whether a tick lands before the next
 * swing or after it, and against a target ramping ten percent a swing that
 * margin is narrow and real.
 * ----------------------------------------------------------------------------
 */
export const BLOOD_CRAZE_DURATION_MS = seconds(6);

/** The ruleset owner's cadence: every two seconds, so three ticks in six. */
export const BLOOD_CRAZE_TICK_INTERVAL_MS = seconds(2);

export const BLOOD_CRAZE_TICKS = BLOOD_CRAZE_DURATION_MS / BLOOD_CRAZE_TICK_INTERVAL_MS;

/*
 * GORE DRINKER: "your next 3 melee attacks ... restore 0.5/1% of your maximum
 * Health." New at client build 1.60.1.70170.
 *
 * ----------------------------------------------------------------------------
 * A WINDOW OF CHARGES RATHER THAN A DURATION, which is the family Flurry and
 * Shield Block belong to: "your next N attacks" is a count, and an aura that
 * expires on time alone cannot express it.
 *
 * IT DOES NOT DECLARE `consumedBySwing`, THOUGH, and that is the difference.
 * `consumedBySwing` is spent by an AUTO-ATTACK and "melee attacks" is broader --
 * an ability that uses the weapon counts, which for a Fury warrior is most of
 * the attacks it makes. So the reaction that heals also spends the charge, and
 * the ordering is written down where it happens.
 *
 * THE DURATION IS A BACKSTOP AND IS INVENTED, which is why it is named as one.
 * The tooltip states no duration at all -- only the three attacks -- so a
 * warrior who stops attacking would carry the window forever. Thirty seconds is
 * far longer than any gap between melee attacks in any list here, so nothing
 * reaches it; Flurry's twelve-second backstop is flagged the same way and for
 * the same reason.
 *
 * THE PERCENTAGE IS NOT ON THE AURA, which is why the parameter is unused. The
 * heal is `goreDrinkerHeal`'s and reads the pool at the moment it fires, so Last
 * Stand's larger maximum counts while it is up -- the same choice Blood Craze's
 * tick makes, for the same reason. The parameter is kept so the builder reads
 * like `bloodCrazeAura` next door and so a future clause that DOES need a
 * magnitude on the aura has somewhere to put it.
 * ----------------------------------------------------------------------------
 */
export const GORE_DRINKER_ID = 'gore_drinker';
export const GORE_DRINKER_ATTACKS = 3;
export const PLACEHOLDER_GORE_DRINKER_DURATION_MS = seconds(30);

export function goreDrinkerAura(_percentOfMaxHealth: number): AuraDefinition {
  return {
    id: GORE_DRINKER_ID,
    name: 'Gore Drinker',
    durationMs: PLACEHOLDER_GORE_DRINKER_DURATION_MS,
    maxStacks: GORE_DRINKER_ATTACKS,
    /*
     * STARTS FULL AND IS RESTORED TO FULL. A second trigger inside the window
     * refills the three rather than adding a fourth, which is what "your next 3
     * melee attacks" says -- and declaring it is the only honest way to do it:
     * writing `instance.stacks` by hand moves the state and leaves the telemetry
     * reporting a count the engine does not hold.
     */
    chargesOnApply: GORE_DRINKER_ATTACKS,
    refreshRestoresCharges: true,
  };
}

export function bloodCrazeAura(percentOfMaxHealth: number): AuraDefinition {
  return {
    id: 'blood_craze',
    name: 'Blood Craze',
    durationMs: BLOOD_CRAZE_DURATION_MS,
    /*
     * A second proc RESTARTS it rather than stacking. Three separate triggers
     * feed this and a hurt warrior meets them often, so stacking would turn a
     * 3% regeneration into an unbounded one.
     */
    refreshBehaviour: 'reset',
    periodic: {
      intervalMs: BLOOD_CRAZE_TICK_INTERVAL_MS,
      onTick: (context, aura) => {
        const actor = context.combatant(aura.targetId);
        if (!actor || !actor.isAlive) return;

        /*
         * "Your total Health" read at TICK TIME rather than snapshotted when
         * the aura went up. The two only differ while something is moving the
         * maximum, which today means Last Stand -- and a warrior under Last
         * Stand genuinely has a larger pool for the percentage to be of.
         *
         * It also keeps a refresh honest: `applyAura` refreshes the instance
         * and keeps its ORIGINAL definition, so a per-tick amount baked in at
         * application would go stale the moment anything changed.
         */
        applyHealing(context, {
          source: actor,
          target: actor,
          abilityId: aura.id,
          abilityName: aura.name,
          baseAmount: (actor.health.maximum * percentOfMaxHealth) / 100 / BLOOD_CRAZE_TICKS,
          // A regeneration, not a spell: no crit, no spell power, and nothing
          // about the warrior scales it beyond the pool it is a fraction of.
          canCrit: false,
          periodic: true,
        });
      },
    },
  };
}
