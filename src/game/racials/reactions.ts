import type {
  AttackOutcome,
  CastReaction,
  Combatant,
  Reaction,
  SimulationContext,
} from '../../engine';
import { applyHealing, dealDamage, seconds } from '../../engine';
import type { ClassId } from '../character';
import { EUREKA } from './auras';

/**
 * Outcomes where an attack LANDED.
 *
 * Written out rather than derived from `AVOIDED_OUTCOMES`, which is the only
 * outcome set the engine exports: a reaction declares the outcomes it wants and
 * the complement of the avoided three happens to be these five today. Deriving
 * it would silently opt every reaction here into any outcome added later --
 * which is how a proc gains a trigger nobody chose.
 *
 * `block`, `glance` and `crush` are all here on purpose. A blocked or glancing
 * blow still dealt damage, and "your spells and attacks with a damage part" does
 * not care how much was taken off it.
 */
const LANDED: readonly AttackOutcome[] = ['hit', 'crit', 'block', 'glance', 'crush'];

// ---------------------------------------------------------------------------
// Undead: Touch of the Grave
// ---------------------------------------------------------------------------

/**
 * Chance per qualifying strike, in percentage points, by class.
 *
 * The owner states the split by class and the client states it by role --
 * "10% for casters, 5% for melee" -- and the two agree on all six classes an
 * Undead can be. The owner's enumeration is used because it names classes
 * rather than a role nothing in this project computes.
 *
 * A CLASS ABSENT HERE GETS NOTHING rather than a default, so a Druid or Shaman
 * -- neither of which an Undead can be -- cannot pick up a plausible 5%.
 */
export const TOUCH_OF_THE_GRAVE_CHANCE: Partial<Record<ClassId, number>> = {
  warrior: 5,
  paladin: 5,
  rogue: 5,
  priest: 10,
  mage: 10,
  warlock: 10,
};

/** The drain, as a fraction of the Undead's MAXIMUM health. */
export const TOUCH_OF_THE_GRAVE_HEALTH_FRACTION = 0.05;

/**
 * And it cannot fire again inside this window.
 *
 * FROM THE CLIENT AND NOT FROM THE OWNER, which is why it is called out. The
 * owner's statement of this racial is long and precise and says nothing about
 * an internal cooldown; `racials.js` ends its tooltip "1 sec internal
 * cooldown." A preferred source being SILENT is not the same as it disagreeing,
 * so both are taken -- the same reading that kept Shadowburn's Soul Shard when
 * `foreverchanges.pro` carried no reagent field to contradict it.
 *
 * IT BINDS HARD ON A ROGUE AND BARELY AT ALL ON A WARLOCK, which is worth
 * knowing before reading the measurement: a Rogue makes several strikes a
 * second across two weapons, so a second is a long time; a Warlock casts about
 * one spell per global cooldown and is almost never refused.
 */
export const TOUCH_OF_THE_GRAVE_INTERNAL_COOLDOWN_MS = seconds(1);

/** The id the drain's own damage and healing are reported under. */
export const TOUCH_OF_THE_GRAVE_ABILITY_ID = 'touch_of_the_grave';
const TOUCH_OF_THE_GRAVE_NAME = 'Touch of the Grave';

/**
 * The channel whose EVERY tick may proc, rather than only its first.
 *
 * The owner names Arcane Missiles as an exception to "channeled abilities can
 * only trigger on the initial cast not each tick". One entry, and widening it
 * is a ruling rather than a judgement: Mind Flay and Drain Soul proc once by
 * the general rule.
 */
export const TOUCH_OF_THE_GRAVE_CHANNEL_EXCEPTIONS: ReadonlySet<string> = new Set([
  'arcane_missiles',
]);

/**
 * The periodic effect whose ticks may proc, rather than none.
 *
 * The owner's second exception, and it needs a different route from the first.
 * Consecration deals NOTHING on its cast -- it applies a ground aura that ticks
 * -- so there is no non-periodic damage event for the general rule to catch and
 * the ability could otherwise never proc at all. That is why `periodicDealt`
 * exists; see `ReactionTrigger`.
 */
export const TOUCH_OF_THE_GRAVE_PERIODIC_EXCEPTIONS: ReadonlySet<string> = new Set([
  'consecration',
]);

/**
 * Poison hits, which the owner excludes by name.
 *
 * WRITTEN OUT RATHER THAN DERIVED FROM A SHAPE, because the shape does not
 * separate them: a poison hit carries no `weaponSlot` -- which is what stops it
 * proccing a second poison or a Crusader -- and neither does a seal, which is
 * NOT excluded. So there is no structural test, and the ids are listed. A test
 * asserts every id here is a real poison ability, so a rename fails loudly
 * rather than quietly re-admitting one.
 */
export const TOUCH_OF_THE_GRAVE_POISON_EXCLUSIONS: ReadonlySet<string> = new Set([
  'instant_poison',
  'deadly_poison',
  'wound_poison',
  'mind_numbing_poison',
  'crippling_poison',
]);

/**
 * Whether a NON-PERIODIC damage event is one the drain may fire from.
 *
 * Exported so a test can drive it directly. A proc that never fires leaves
 * nothing behind to notice, and this predicate is where "never" would live --
 * `isWeaponUseOf(attack, 'ranged')` was always false for every attack, forever,
 * and read exactly like a predicate that was sometimes true.
 */
export function touchOfTheGraveMayProc(
  actor: Combatant,
  abilityId: string | undefined,
  amount: number,
): boolean {
  /*
   * "ABILITIES WHICH DO NOT HAVE A DAMAGE COMPONENT ... CANNOT PROC", read off
   * the DAMAGE rather than off the ability's declaration.
   *
   * The two counter-examples are already in the project: Rupture and Serpent
   * Sting each declare a combat table -- they roll it to decide whether the
   * bleed lands -- and neither deals a point of direct damage. Anything keyed
   * on the declaration would have procced from both.
   */
  if (amount <= 0) return false;
  // Its own drain is damage too, and a drain that drains is a chain nobody
  // asked for. An auto-attack carries no ability id and DOES qualify: "attacks".
  if (abilityId === TOUCH_OF_THE_GRAVE_ABILITY_ID) return false;
  if (abilityId !== undefined && TOUCH_OF_THE_GRAVE_POISON_EXCLUSIONS.has(abilityId)) return false;

  /*
   * A CHANNEL PROCS ONCE, ON ITS FIRST TICK.
   *
   * `runCast` runs once per tick, so each Arcane Missile and each Mind Flay
   * tick is a separate non-periodic damage event on the spell table. Without
   * this a single Mind Flay would roll three times.
   *
   * THE ABILITY IS LOOKED UP RATHER THAN THE COMBATANT ASKED, because
   * `channelTicksDelivered` IS STALE FOR AN INSTANT. `beginChannel` resets it
   * and is only reached by a cast with a cast time -- an instant takes the
   * `castTime <= 0` early return -- so after a five-tick channel the counter
   * reads 5 until the next cast with a timer. Reading it alone would have made
   * every instant after a channel look like a late tick and refuse to proc:
   * a smaller number, no error, and invisible on a Mage.
   *
   * Asking `channelTicks` first means the counter is only read when it is live.
   */
  const ability = abilityId === undefined ? undefined : actor.abilities.get(abilityId);
  const channelTicks = ability?.channelTicks ?? 1;
  if (channelTicks > 1 && actor.channelTicksDelivered > 1) {
    return abilityId !== undefined && TOUCH_OF_THE_GRAVE_CHANNEL_EXCEPTIONS.has(abilityId);
  }
  return true;
}

/**
 * Whether this cast just applied a PERIODIC effect to the target.
 *
 * ============================================================================
 * THIS IS HOW "A DAMAGE PART" IS ANSWERED FOR AN ABILITY THAT DEALS NONE.
 *
 * A pure damage-over-time cast emits no non-periodic damage event at all --
 * Corruption, Bane of Agony and Siphon Life each just apply an aura -- so the
 * damage half of this proc never sees them and they never rolled. That was the
 * bug: the owner's rule is "same rule for DoTs - only on CAST not each tick",
 * and "only on cast" was implemented as "only on the cast's direct damage",
 * which for a pure DoT is nothing.
 *
 * WHAT IT COST: on the SM/DS Warlock those three are 8.95 casts a fight out of
 * 21.4 qualifying actions, so the proc rate was 1.35 a fight against an
 * expected 2.14 -- almost exactly half, which is how the owner found it.
 *
 * ASKED OF THE AURAS RATHER THAN DECLARED ON THE ABILITY, and the alternatives
 * were worse. A flag on `Ability` is the obvious one and is the shape this
 * project keeps paying for -- the DoT that forgot it would be silently inert,
 * and there are ten of them across five classes. An EXCLUSION list is what the
 * owner's wording suggests ("abilities which do not have a damage component
 * LIKE DEMORALIZING SHOUT") and fails the other way, which is worse: an ability
 * missing from it procs when it should not, and a proc that fires too often
 * looks exactly like one that works.
 *
 * THREE CLAUSES, AND EACH ONE EXCLUDES SOMETHING REAL:
 *
 *   on the TARGET      Amplify Curse applies its aura to the CASTER, and is a
 *                      cast with no damage part by anyone's reading
 *   `periodic`         Demoralizing Shout, Expose Armor, Thunder Clap's slow
 *                      and Wrack's amplification all land on the target and
 *                      none of them ticks
 *   applied NOW        an aura that was already there is not this cast's doing.
 *                      It also keeps Wrack out twice over: its amplification
 *                      refuses to refresh, so `appliedAt` stays at the first
 *                      tick of the channel
 *
 * A PERIODIC AURA ON AN ENEMY IS A DoT, which is the one assumption here.
 * `PeriodicEffect.onTick` is a closure, so nothing on the definition says
 * whether it deals damage or heals -- and nothing in this ruleset puts a
 * periodic HEAL on an enemy. Said out loud because that is the sentence that
 * would stop being true first.
 * ============================================================================
 */
function appliedPeriodicNow(target: Combatant, actor: Combatant, now: number): boolean {
  for (const aura of target.auras.activeIterable) {
    if (aura.sourceId !== actor.id) continue;
    if (aura.appliedAt !== now) continue;
    if (aura.definition.periodic !== undefined) return true;
  }
  return false;
}

/**
 * Touch of the Grave: a chance for a strike to drain health from the target.
 *
 * ============================================================================
 * EVERY CLAUSE OF THE OWNER'S RULING IS A LINE SOMEWHERE HERE, because six of
 * them are EXCLUSIONS -- and an exclusion that is missing reads exactly like a
 * working proc, only bigger.
 *
 *   "spells and attacks"        every landed outcome, on any table
 *   "with a damage component"   `amount > 0`, read off the damage
 *   DoTs and channels: on the   a tick never reaches `dealt` at all, which the
 *   initial cast only           engine already guarantees; a channel is held to
 *                               its first tick here
 *   Arcane Missiles excepted    `TOUCH_OF_THE_GRAVE_CHANNEL_EXCEPTIONS`
 *   Consecration excepted       `periodicDealt`, because its cast deals nothing
 *   "Pets can never trigger"    built only for the player -- a pet is a
 *                               separate combatant with its own reaction list
 *   "Poison applications ...    `TOUCH_OF_THE_GRAVE_POISON_EXCLUSIONS`
 *   cannot proc"
 *   "cannot crit"               no `critFrom` and no `critTable`
 *   "uses the Spell Cast        `attackTable: 'spell'`, so it CAN miss, on the
 *   Combat Table"               flat 17% less the caster's spell hit
 *   "only scales off your Hit   no coefficient and no weapon scaling, plus
 *   Points"                     `ignoresAttackerDamageScaling`
 *   "BUT it does scale if the   the target's side, deliberately left alone
 *   target is vulnerable"
 *
 * TWO REACTIONS SHARING ONE INTERNAL COOLDOWN, because the two routes are two
 * triggers and the second is a cooldown on the EFFECT rather than on a route.
 * A Paladin's Consecration tick and its Crusader Strike must not each get their
 * own second.
 *
 * BUILT PER CHARACTER, which is what makes the closure safe -- one shared
 * closure is what silently stopped Windfury proccing after the first iteration
 * of a batch.
 * ============================================================================
 */
export function touchOfTheGrave(characterClass: ClassId): {
  readonly reactions: readonly Reaction[];
  readonly casts: readonly CastReaction[];
} {
  const chance = TOUCH_OF_THE_GRAVE_CHANCE[characterClass] ?? 0;
  if (chance === 0) return { reactions: [], casts: [] };

  /** When a PROC last fired. The client's one second internal cooldown. */
  let readyAt = 0;
  /**
   * When this character last TOOK a roll, won or lost.
   *
   * A DIFFERENT CLOCK FROM `readyAt` AND NOT A SUBSTITUTE FOR IT. This one
   * keeps a single ACTION to a single roll across the damage half and the cast
   * half -- `runCast` runs `onCast` before the cast reactions, so a spell that
   * dealt direct damage has already rolled by the time the cast half is
   * offered it, and comparing the instant is what makes "one roll per action"
   * true rather than aspirational. `judgementOfWisdomReactions` is the same
   * mechanism for the same reason.
   */
  let lastRolledAt: number | null = null;

  const ready = (context: SimulationContext): boolean => context.clock.now() >= readyAt;
  const roll = (context: SimulationContext): boolean => {
    lastRolledAt = context.clock.now();
    return context.rng.rollChance(chance / 100);
  };
  const fire = (context: SimulationContext, actor: Combatant, target: Combatant): void => {
    readyAt = context.clock.now() + TOUCH_OF_THE_GRAVE_INTERNAL_COOLDOWN_MS;
    drainWithTouchOfTheGrave(context, actor, target);
  };

  const reactions: readonly Reaction[] = [
    {
      id: 'touch_of_the_grave',
      on: 'dealt',
      outcomes: LANDED,
      canTrigger: (context, actor, attack) =>
        ready(context) &&
        touchOfTheGraveMayProc(actor, attack.abilityId, attack.amount) &&
        roll(context),
      onTrigger: (context, actor, attack) => fire(context, actor, attack.defender),
    },
    {
      id: 'touch_of_the_grave_periodic',
      on: 'periodicDealt',
      // A tick's outcome is synthesised as `hit` or `crit`; see ReactionTrigger.
      outcomes: LANDED,
      canTrigger: (context, _actor, attack) =>
        ready(context) &&
        attack.amount > 0 &&
        attack.abilityId !== undefined &&
        TOUCH_OF_THE_GRAVE_PERIODIC_EXCEPTIONS.has(attack.abilityId) &&
        roll(context),
      onTrigger: (context, actor, attack) => fire(context, actor, attack.defender),
    },
  ];

  /**
   * And the half that catches a cast which dealt no direct damage.
   *
   * ==========================================================================
   * "SAME RULE FOR DoTs - ONLY ON CAST NOT EACH TICK", and the first half of
   * that sentence had no implementation: a pure DoT emits no non-periodic
   * damage event, so the damage half never saw one and Corruption, Bane of
   * Agony and Siphon Life never procced at all. See `appliedPeriodicNow`.
   *
   * `cast.final` KEEPS A CHANNEL TO ONE, which is the other half of the same
   * owner sentence. It costs nothing here -- no channel in the project applies
   * a periodic aura to its target -- and it is the cheap guard against the one
   * that will.
   *
   * AND THE DEDUPE IS WHAT STOPS AN ABILITY ROLLING TWICE. Immolate deals
   * direct damage AND applies a DoT in the same instant: the damage half rolls
   * and `lastRolledAt` then refuses this one, so it is one action and one
   * roll. Without it Immolate would be at 19% where Corruption is at 10%, and
   * both figures would look perfectly ordinary.
   * ==========================================================================
   */
  const casts: readonly CastReaction[] = [
    {
      id: 'touch_of_the_grave_cast',
      canTrigger: (context, actor, cast) => {
        if (!cast.final || !cast.target) return false;
        if (!ready(context)) return false;
        // The damage half already rolled for this same action.
        if (lastRolledAt === context.clock.now()) return false;
        if (!appliedPeriodicNow(cast.target, actor, context.clock.now())) return false;
        return roll(context);
      },
      onTrigger: (context, actor, cast) => {
        if (cast.target) fire(context, actor, cast.target);
      },
    },
  ];

  return { reactions, casts };
}

/**
 * The drain itself: damage to the target, and the same amount back.
 *
 * DEALT INLINE RATHER THAN SCHEDULED, WHICH IS THE EXCEPTION TO THIS PROJECT'S
 * RULE AND IS SAID OUT LOUD BECAUSE THE RULE POINTS THE OTHER WAY.
 * `runReactions` holds a per-actor lock, so a `dealDamage` called from inside a
 * reaction reaches no `dealt` reaction at all -- which is why Windfury's extra
 * attacks have to be scheduled. That rule exists so something can proc off the
 * new damage, and Touch of the Grave is explicitly not allowed to proc
 * anything: it cannot proc itself, it is not a weapon use, and nothing in the
 * ruleset keys off it. So the lock costs nothing here, and dealing it inline
 * keeps the drain in the same millisecond as the strike that caused it.
 */
function drainWithTouchOfTheGrave(
  context: SimulationContext,
  actor: Combatant,
  target: Combatant,
): void {
  const result = dealDamage(context, {
    source: actor,
    target,
    abilityId: TOUCH_OF_THE_GRAVE_ABILITY_ID,
    abilityName: TOUCH_OF_THE_GRAVE_NAME,
    /*
     * SHADOW, WHICH IS WHAT CARRIES THE OWNER'S ONE EXCEPTION. The drain is
     * fixed by the Undead's own health and is still shadow damage, so Curse of
     * the Elements and Improved Shadow Bolt on the TARGET raise it --
     * and `ignoresAttackerDamageScaling` is what stops the CASTER'S Shadow
     * Mastery and Shadow Weaving doing the same.
     */
    school: 'shadow',
    /*
     * "ONLY SCALES OFF YOUR HIT POINTS." A flat amount with no coefficient and
     * no weapon scaling, so neither attack power nor spell power can reach it.
     * That half of the ruling is structural rather than a flag, which is the
     * better half to rely on.
     */
    baseAmount: actor.health.maximum * TOUCH_OF_THE_GRAVE_HEALTH_FRACTION,
    // "Touch of the Grave uses the Spell Cast Combat Table", so it can miss.
    attackTable: 'spell',
    /*
     * "TOUCH OF THE GRAVE CANNOT CRIT", AND OMITTING `critFrom` DID NOT DO IT.
     *
     * This shipped as a bare absence of `critFrom` -- which is the obvious
     * thing to write and is about the OTHER case: `critFrom` is for an attack
     * with no table, and this one declares the spell table, whose crit slice is
     * the caster's own `spellCritChance`. A test handing the caster a hundred
     * points of crit found 200 crits in 200 drains.
     *
     * `cannotCrit` is the flag that actually says it, and it is zeroed after
     * every modifier for the reason `NO_CHANCES` already records: a talent's
     * `abilityCrit` is ADDED to whatever the table gave.
     */
    cannotCrit: true,
    ignoresAttackerDamageScaling: true,
    /*
     * AND NO `weaponSlot`, the same shape a seal and a poison already have: the
     * drain is triggered BY a weapon use and is not one, so it cannot proc a
     * Crusader or a Hand of Justice off its own back.
     */
  });

  /*
   * "DRAIN HEALTH FROM THE TARGET" -- the owner's ruling is that it heals the
   * Undead for what it dealt.
   *
   * WHAT LANDED, NOT WHAT WAS ASKED FOR. The drain rolls the spell table, so a
   * miss deals nothing and must heal nothing; reading the requested amount here
   * would make a missed drain a free heal.
   *
   * `external: true` FOR ITS SECOND SENTENCE RATHER THAN ITS FIRST. That flag's
   * contract is "NOTHING about the nominal source scales it, `baseAmount` is the
   * whole answer", which is exactly "only scales off your Hit Points"; its name
   * and first line describe the assumed healer, which was its only caller. Left
   * off, the heal would be scaled by the Undead's healing done and versatility
   * -- worth zero today and wrong the day a Priest racial grants either.
   *
   * AND IT IS NOT OVERHEALING ON A WARLOCK, WHICH IS WHY THIS CLAUSE MATTERS TO
   * A DPS PROFILE AT ALL.
   *
   * This comment first said the heal "is worth nothing to all five Undead
   * presets, because what it changes is the DEATH COUNT and none of the five is
   * a tank" -- which is true of the three Rogues and FALSE of both Warlocks.
   * LIFE TAP SPENDS HEALTH FOR MANA, and the Firelock build is health-bound
   * rather than mana-bound: measured over twenty fights it taps down to 2.3% of
   * its pool. So the drain's heal is spent rather than wasted, and the Undead
   * build gets 5.6 Life Taps a fight against a Human's 5.0.
   *
   * NEITHER WARLOCK DIES FROM IT, which was the first thing checked once the
   * constraint was found -- a build tapping to 2.3% is one tap from the floor,
   * and deaths are 0.000 a fight either way.
   */
  if (result.amount > 0) {
    applyHealing(context, {
      source: actor,
      target: actor,
      abilityId: TOUCH_OF_THE_GRAVE_ABILITY_ID,
      abilityName: TOUCH_OF_THE_GRAVE_NAME,
      baseAmount: result.amount,
      external: true,
    });
  }
}

// ---------------------------------------------------------------------------
// Gnome: Eureka!
// ---------------------------------------------------------------------------

/**
 * The pair of reactions that spend one Eureka! charge per damaging cast.
 *
 * ============================================================================
 * TWO REACTIONS AND ONE CLOSURE, because neither half can answer the question
 * alone.
 *
 * A CAST reaction knows when a cast ENDED and can read `cast.final`, which is
 * the only way to treat a channel as one cast rather than five. It cannot know
 * whether the cast dealt any non-periodic damage, and the ability cannot tell
 * it: Rupture and Serpent Sting both declare a combat table and deal no direct
 * damage, so `requiresAttackTable` would spend a charge on either.
 *
 * A DAMAGE reaction knows exactly that, because `amount` is on the event in
 * front of it and a tick never reaches `dealt` at all. It does not know when
 * the cast is over.
 *
 * So the damage half MARKS and the cast half SPENDS. What makes that work is
 * `runCast`'s own order: `onCast` deals the damage, its `dealt` reactions run
 * from inside `dealDamage`, and `runCastReactions` runs after both.
 *
 * AND IT IS A LATCH THAT SOMETHING CLEARS, which this project warns about by
 * name -- "a latch nobody cleared would make Seal Fate fire once a FIGHT". The
 * clearer is the spender, which runs on every final cast whether it spends or
 * not, so no mark can outlive the cast that set it.
 *
 * THE CLOSURE IS ONLY SAFE BECAUSE THIS IS BUILT PER CHARACTER, the same reason
 * Seal Fate's per-use cap and Windfury's internal cooldown can live in one.
 * ============================================================================
 */
export function eurekaReactions(): { readonly marker: Reaction; readonly spender: CastReaction } {
  let dealtNonPeriodicDamage = false;

  const marker: Reaction = {
    id: 'eureka_mark',
    on: 'dealt',
    outcomes: LANDED,
    canTrigger: (_context, actor, attack) =>
      /*
       * ONLY WHILE THE BUFF IS UP, so a Gnome between cooldowns does no
       * bookkeeping at all.
       */
      actor.auras.has(EUREKA.id) &&
      attack.amount > 0 &&
      /*
       * AN ABILITY, NOT A SWING. "Your next 3 ... damaging ABILITIES", and an
       * auto-attack is not one -- it carries no ability id, the same test
       * `abilityModifiers` uses to skip swings. A Gnome Warrior's Heroic Strike
       * spends a charge and its auto-attacks do not.
       */
      attack.abilityId !== undefined,
    onTrigger: () => {
      dealtNonPeriodicDamage = true;
    },
  };

  const spender: CastReaction = {
    id: 'eureka_spend',
    /*
     * `cast.final` IS WHAT MAKES ONE CHANNEL ONE CHARGE, which is the owner's
     * ruling. Without it the first of five Arcane Missiles would spend a charge
     * and the last two would fire unbuffed -- a smaller number, no error, and
     * the opposite of what the Arcane list is built around.
     */
    canTrigger: (_context, actor, cast) => cast.final && actor.auras.has(EUREKA.id),
    onTrigger: (context, actor) => {
      const spend = dealtNonPeriodicDamage;
      // Cleared whether or not it spent, so no mark survives its own cast.
      dealtNonPeriodicDamage = false;
      if (spend) actor.auras.consumeStack(context, EUREKA.id);
    },
  };

  return { marker, spender };
}
