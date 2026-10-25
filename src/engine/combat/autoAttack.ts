import type { AutoAttackMode, Combatant, WeaponProfile, WeaponSlot } from '../actors/Combatant';
import { EventPriority, createEvent } from '../events';
import type { SimulationContext } from '../simulation/SimulationContext';
import { dealDamage, grantGeneratedResource } from './damage';
import { applyHaste, hasteMultiplierFrom } from './ratings';

/**
 * Auto attacks: off-GCD swings that repeat on their own timers.
 *
 * Modelled separately from abilities because they never compete for the global
 * cooldown, are never chosen by a rotation, and continue on their own once
 * combat starts.
 *
 * Which weapons swing is decided by the combatant's auto-attack mode, which
 * comes from its combat style. Each slot runs an INDEPENDENT timer: a
 * dual-wielder's off-hand does not wait for the main hand, so the two drift
 * apart over a fight exactly as they do in game.
 */
export function startAutoAttack(context: SimulationContext, attacker: Combatant): void {
  attacker.swingsBegun = true;
  for (const slot of swingingSlots(attacker)) {
    const weapon = attacker.weapons[slot];
    if (!weapon) continue;
    scheduleSwing(context, attacker, slot, 0);
  }
}

/** The slots a mode swings. */
export function slotsForMode(mode: AutoAttackMode): readonly WeaponSlot[] {
  switch (mode) {
    case 'none':
      return [];
    case 'main-hand':
      return ['mainHand'];
    case 'dual-wield':
      return ['mainHand', 'offHand'];
    case 'ranged':
      return ['ranged'];
  }
}

/**
 * START AUTO-ATTACK IN A MODE (round 65), the owner's action. Returns false and
 * changes nothing when that mode is already running -- so a list that asks on
 * every decision never restarts a swing timer and starves the swing it is
 * waiting for.
 *
 * ============================================================================
 * ONE MODE AT A TIME, the owner's ruling: starting melee stops the ranged auto
 * attack and starting ranged stops melee. A slot both modes share -- the main
 * hand, from main hand to dual wield -- keeps swinging untouched.
 *
 * BEFORE THE PULL IT ONLY SETS THE MODE, and the pull starts every slot of it
 * swinging at once, which is "as soon as combat starts at T-0 the weapons are
 * ready to swing" and the moment every character swung before this existed.
 *
 * IN COMBAT A NEW SLOT SWINGS WHEN ITS TIMER IS READY: its last swing plus a
 * full hasted swing, or at once if that has passed or it has never swung. That
 * is the swing timer as a countdown the start begins rather than restarts, and
 * it is what gives the Melee Weave its window -- the first melee swing lands
 * no sooner than the run in and no later than a melee swing interval.
 * `notBeforeMs` holds the first swing back to a moment (the run in);
 * `firstSwingAtMs` names it outright (the return to range).
 * ============================================================================
 */
export function startAutoAttackMode(
  context: SimulationContext,
  attacker: Combatant,
  mode: AutoAttackMode,
  options: { readonly notBeforeMs?: number; readonly firstSwingAtMs?: number } = {},
): boolean {
  const previous = attacker.activeAutoAttack;
  if (previous === mode) return false;
  const keep = slotsForMode(mode);
  for (const slot of slotsForMode(previous)) {
    if (keep.includes(slot)) continue;
    context.events.cancel(attacker.pendingSwing(slot));
    attacker.setPendingSwing(slot, null);
  }
  attacker.activeAutoAttack = mode;
  if (!attacker.swingsBegun) return true;

  const now = context.clock.now();
  const haste = hasteMultiplierFrom(attacker.stats.effective);
  for (const slot of keep) {
    if (slotsForMode(previous).includes(slot)) continue;
    const weapon = attacker.weapons[slot];
    if (!weapon) continue;
    const last = attacker.lastSwingAt(slot);
    const ready = last === undefined ? now : last + applyHaste(weapon.swingTimerMs, haste);
    const at = options.firstSwingAtMs ?? Math.max(now, ready, options.notBeforeMs ?? now);
    scheduleSwing(context, attacker, slot, Math.max(0, at - now));
  }
  return true;
}

/**
 * What an auto attack is CALLED, by the hand that threw it.
 *
 * Not the weapon's name. A dual-wielder's breakdown used to read
 * "Vis'kag the Bloodletter" and "Brutality Blade", which says which item but
 * not which hand -- and the hand is the thing being audited. Off-hand swings
 * carry a damage penalty, a separate miss chance and their own rage rate, so
 * "is the off hand pulling its weight" is a question the table has to be able
 * to answer without the reader remembering which sword is where.
 *
 * Weapon identity has not gone anywhere: the Gear panel says what is equipped.
 */
export const AUTO_ATTACK_NAMES: Readonly<Record<WeaponSlot, string>> = {
  mainHand: 'Main Hand Auto-Attack',
  offHand: 'Off Hand Auto-Attack',
  ranged: 'Ranged Auto-Attack',
};

/**
 * What to call one actor's swing, which is NOT always the hand that threw it.
 *
 * ----------------------------------------------------------------------------
 * A PET'S SWING IS REPORTED AS THE PET'S, and it was not. The damage breakdown
 * pools by ability NAME across every friendly actor -- deliberately, so that a
 * reader sees "the Hunter's damage" and not two tables -- so a pet's main-hand
 * swing landed in the row called "Main Hand Auto-Attack".
 *
 * THAT ROW WAS 38.1% OF THE BEAST MASTERY HUNTER AND NONE OF IT WAS THE
 * HUNTER'S. That profile is `combatStyle: 'ranged'`; it never swings a melee
 * weapon at all. So the largest line in its table named a weapon the character
 * was not using, the shares still summed to 100%, and nothing contradicted it.
 * `docs/handoff/hunter.md` read the row and concluded "BM Hunter is the only
 * profile that swings BOTH melee and ranged", which is how a mislabelled number
 * becomes a documented fact.
 *
 * It is the same failure as `resourceFlow` summing every pool under a heading
 * that said "Rage": internally consistent, and about the wrong thing.
 *
 * WHY THE ENGINE AND NOT THE ANALYSIS LAYER. This is the one place a swing is
 * named, and `kind` is an engine concept -- `isPlayerControlled` already reads
 * it. Naming it twice is how two labels drift apart.
 * ----------------------------------------------------------------------------
 */
export function autoAttackName(attacker: Combatant, slot: WeaponSlot): string {
  if (attacker.kind === 'pet' || attacker.kind === 'summon' || attacker.namesOwnSwings) {
    return `${attacker.name} Melee`;
  }
  return AUTO_ATTACK_NAMES[slot];
}

/**
 * Where the rage from a swing is attributed, by hand.
 *
 * One `auto_attack` bucket could not show the split, and the split is the
 * point: Dual Wield Specialization doubles off-hand rage generation, which is
 * invisible in a total that mixes both hands together.
 */
export const AUTO_ATTACK_RESOURCE_SOURCES: Readonly<
  Record<WeaponSlot, { readonly id: string; readonly name: string }>
> = {
  mainHand: { id: 'auto_attack_main_hand', name: 'Main hand auto attack' },
  offHand: { id: 'auto_attack_off_hand', name: 'Off hand auto attack' },
  ranged: { id: 'auto_attack_ranged', name: 'Ranged auto attack' },
};

/** The weapon slots that auto-attack, given the combatant's mode. */
export function swingingSlots(attacker: Combatant): readonly WeaponSlot[] {
  return slotsForMode(attacker.activeAutoAttack);
}

/**
 * An extra attack: complete this weapon's swing NOW and restart its timer.
 *
 * Hand of Justice and effects like it. The swing is scheduled at the current
 * timestamp rather than run inline, for two reasons. It lets the reaction that
 * triggered it finish first, so the extra swing can itself proc things --
 * an extra attack is a real attack. And it keeps every swing on one code path,
 * so a queued Heroic Strike is consumed by the extra swing exactly as it would
 * be by a normal one.
 *
 * The swing timer resets because `scheduleSwing` keeps at most one pending
 * swing per slot: the one this extra attack schedules replaces whatever was
 * outstanding. That single invariant is also what stops a proc from forking the
 * chain into two independent timers.
 */
export function extraAttack(
  context: SimulationContext,
  attacker: Combatant,
  slot: WeaponSlot,
): void {
  const weapon = attacker.weapons[slot];
  if (!weapon) return;
  // A slot not swinging in the current mode takes no extra attack (round 65):
  // a melee proc while the bow is out must not start the melee hand swinging.
  if (!swingingSlots(attacker).includes(slot)) return;

  context.events.schedule(
    context.clock.now(),
    createEvent(`extra-attack:${attacker.id}:${slot}`, EventPriority.AutoAttack, (ctx) => {
      if (!attacker.isAlive || ctx.hasEnded) return;

      if (ctx.defaultTargetFor(attacker)) {
        attacker.auras.consumeSwingCharges(ctx);
        swing(ctx, attacker, weapon, slot);
      }

      const haste = hasteMultiplierFrom(attacker.stats.effective);
      scheduleSwing(ctx, attacker, slot, applyHaste(weapon.swingTimerMs, haste));
    }),
  );
}

/**
 * Restart every swinging weapon's timer: the swing in progress is lost, and a
 * full swing begins `afterMs` from now.
 *
 * ============================================================================
 * A CAST HOLDS THE TIMER AT ZERO AND IT STARTS AGAIN WHEN THE CAST FINISHES
 * (round 56), the owner's: "Auto-attack .. start casting (auto-attack swing
 * timer reset back to 0) finish casting .. auto-attack swing timer starts
 * again." So casting passes its cast time, and the full swing is counted from
 * the END of the cast.
 *
 * IT USED TO COUNT FROM THE START, with any swing that came due inside the
 * cast held to its end. A Shaman weaving a two-second Lightning Bolt into a
 * 2.88-second swing therefore swung 880ms after the bolt landed rather than a
 * full swing after it -- every cast shorter than the swing timer cost the
 * swing it interrupted and nothing more, which made weaving nearly free.
 *
 * THE TIMER STARTS FROM AN EVENT AT THE CAST'S END, not from a delay worked
 * out now, so the swing is hasted by whatever haste the character has WHEN IT
 * BEGINS -- a buff landing during the cast speeds the swing that follows it.
 * The event is held as the slot's pending swing, so the one-pending-swing rule
 * still holds: anything that schedules a swing meanwhile replaces it.
 * ============================================================================
 */
export function resetSwingTimers(
  context: SimulationContext,
  attacker: Combatant,
  afterMs = 0,
): void {
  for (const slot of swingingSlots(attacker)) {
    const weapon = attacker.weapons[slot];
    if (!weapon) continue;
    if (afterMs <= 0) {
      const haste = hasteMultiplierFrom(attacker.stats.effective);
      scheduleSwing(context, attacker, slot, applyHaste(weapon.swingTimerMs, haste));
      continue;
    }
    context.events.cancel(attacker.pendingSwing(slot));
    const handle = context.events.schedule(
      context.clock.now() + afterMs,
      createEvent(`swing-timer-start:${attacker.id}:${slot}`, EventPriority.AutoAttack, (ctx) => {
        if (!attacker.isAlive || ctx.hasEnded) return;
        const haste = hasteMultiplierFrom(attacker.stats.effective);
        scheduleSwing(ctx, attacker, slot, applyHaste(weapon.swingTimerMs, haste));
      }),
    );
    attacker.setPendingSwing(slot, handle);
  }
}

function scheduleSwing(
  context: SimulationContext,
  attacker: Combatant,
  slot: WeaponSlot,
  delayMs: number,
): void {
  const weapon = attacker.weapons[slot];
  if (!weapon) return;

  // At most ONE pending swing per slot, always.
  //
  // Without this an extra attack forks the chain. It fires from inside a swing,
  // which has not yet scheduled its successor, so the extra attack schedules
  // one and then the original swing schedules another -- two independent
  // timers on one weapon, doubling again with every proc. Four Hand of Justice
  // procs turned 115 main-hand swings into 211.
  //
  // Cancelling here is harmless in the normal case: the handle a firing swing
  // holds is its own, and cancelling an event that has already run does
  // nothing.
  context.events.cancel(attacker.pendingSwing(slot));

  const handle = context.events.schedule(
    context.clock.now() + delayMs,
    createEvent(`auto-attack:${attacker.id}:${slot}`, EventPriority.AutoAttack, (ctx) => {
      if (!attacker.isAlive || ctx.hasEnded) return;
      // Stopped since it was scheduled (round 65): the slot swings no more.
      if (!swingingSlots(attacker).includes(slot)) return;

      /*
       * A swing that comes due mid-cast is HELD, not lost: it waits for the
       * cast to finish and then lands. A cast that resets the swing timer has
       * already pushed this swing back, so in practice only a `hold` cast or a
       * cast longer than a swing timer reaches here.
       *
       * UNLESS THE CAST SAYS OTHERWISE, which is `swingTimer: 'continue'` and
       * is the ruleset owner's ruling for the Hunter's three cast shots: the
       * auto attack is not suspended at all and the swing lands DURING the
       * cast. The hold is the second half of the suspension and this is where
       * it lives -- the first half, the timer reset, is refused in `runCast`.
       * Clearing only that one would still have deferred every shot that came
       * due inside a four-second Sniper Shot, which is a smaller number and no
       * error.
       */
      const remainingCast = attacker.castEndsAt - ctx.clock.now();
      if (remainingCast > 0 && !attacker.castAllowsSwings) {
        scheduleSwing(ctx, attacker, slot, remainingCast);
        return;
      }

      const target = ctx.defaultTargetFor(attacker);
      if (target) {
        // Spent BEFORE the swing resolves, so an effect applied by this swing's
        // own critical strike is not immediately eaten by it.
        attacker.auras.consumeSwingCharges(ctx);
        swing(ctx, attacker, weapon, slot);
        /*
         * RECORDED AFTER THE SWING RESOLVES, so "a shot landed just now" is
         * true of a swing that HAPPENED rather than one that was scheduled.
         *
         * IN THIS HANDLER AND NOT IN `extraAttack`, which carries the same two
         * lines and is where this first landed by mistake: a Hunter entry
         * gated on the shot window is weaving around the BOW'S OWN rhythm, and
         * a Windfury or Hand of Justice proc does not move that rhythm.
         */
        attacker.recordSwing(slot, ctx.clock.now());
      }

      // The timer keeps running even with no valid target, so that switching
      // targets mid-fight does not hand out a free reset.
      const haste = hasteMultiplierFrom(attacker.stats.effective);
      scheduleSwing(ctx, attacker, slot, applyHaste(weapon.swingTimerMs, haste));
    }),
  );

  // Kept so an extra attack can cancel it. A swing that has already fired
  // clears its own handle when it reschedules.
  attacker.setPendingSwing(slot, handle);
}

function swing(
  context: SimulationContext,
  attacker: Combatant,
  weapon: WeaponProfile,
  slot: WeaponSlot,
): void {
  const target = context.defaultTargetFor(attacker);
  if (!target) return;

  /*
   * A SWING BREAKS STEALTH AND PROWL, which is the other half of the owner's
   * rule -- "almost every completed cast or attack". Here rather than beside
   * the `dealDamage` below, so the ON-NEXT-SWING path gets it too: an attack
   * that arrives as a Heroic Strike is still an attack, and that branch returns
   * before the swing's own damage.
   *
   * AND A MISS STILL BREAKS IT. The attack happened; whether it connected is
   * the combat table's business, and a stealth window surviving a missed swing
   * would be a bigger number and no error.
   */
  attacker.auras.breakOnAction(context);

  // An on-next-swing ability replaces this swing entirely. It was paid for and
  // armed when it was cast, so all that is left is to run its effect. The swing
  // timer is untouched either way, which is what makes these abilities free
  // throughput rather than a replacement for a global cooldown.
  const queuedId = attacker.takeQueuedSwing(slot);
  if (queuedId !== undefined) {
    const queued = attacker.abilities.get(queuedId);
    if (queued) {
      queued.onCast({ simulation: context, caster: attacker, target, ability: queued });
      return;
    }
  }

  // An auto attack IS weapon damage and nothing else, so it goes through the
  // same scaling every weapon-damage ability uses. The damage roll, the attack
  // power contribution and the off-hand penalty are all handled there, which is
  // what stops a swing and a Mortal Strike from ever disagreeing about the same
  // weapon.
  const result = dealDamage(context, {
    source: attacker,
    target,
    abilityName: autoAttackName(attacker, slot),
    school: weapon.school ?? 'physical',
    baseAmount: 0,
    weaponScaling: { slot },
    /*
     * Which table resolves a swing depends on WHO IS BEING HIT, not on who is
     * swinging. `melee-received` is the attacks-received table: it is the one
     * with crushing blows and with the defender's own dodge, parry and block,
     * and it is the right one for anything swinging at the player.
     *
     * Ranged weapons use the ranged table either way, which has no dodge,
     * parry or glancing blow.
     */
    attackTable:
      slot === 'ranged'
        ? 'ranged-auto'
        : target.isPlayerControlled
          ? 'melee-received'
          : 'melee-auto',
    weaponSlot: slot,
  });

  /*
   * Resource from damage DEALT, proportional to what actually landed. A missed
   * or dodged swing generates nothing, which is the behaviour that makes a
   * high-miss build rage-starved as well as low-damage.
   *
   * THE OUTCOME IS PASSED SO A CRIT CAN PAY MORE -- Forever's "100% increased
   * Rage when landing a critical strike with a basic attack" for the Warrior and
   * 75% for a Bear Druid. The multiplier is the combatant's, the rule is here,
   * and a crushing blow or a glance is not a crit and gets nothing extra.
   *
   * THIS IS THE ONLY PLACE THAT CAN PAY IT, which is what makes "with a basic
   * attack" need no test of its own: an ability generates no rage in this engine
   * at all. See `Combatant.critResourceMultiplier`.
   */
  grantGeneratedResource(
    context,
    attacker,
    weapon.generates,
    result.amount,
    AUTO_ATTACK_RESOURCE_SOURCES[slot],
    result.outcome === 'crit',
  );

}
