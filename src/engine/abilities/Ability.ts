import type { Combatant, WeaponSlot } from '../actors/Combatant';
import type { TargetSelection } from '../combat/targeting';
import type { AttackTableKind } from '../combat/attackTable';
import type { ResourceType } from '../resources';
import type { SimulationContext } from '../simulation/SimulationContext';
import type { Milliseconds } from '../time';

/**
 * The global cooldown a combatant has unless it says otherwise.
 *
 * A FALLBACK, not the rule. How long a class's global cooldown is belongs to
 * the ruleset, so it arrives on the combatant (`baseGcdMs`) from the game
 * layer -- Forever gives most classes 1.5 seconds and gives a Rogue, or a
 * Druid in Cat Form, 1.0. This value is what an actor built without one gets,
 * which in practice means a training dummy.
 */
export const DEFAULT_GCD_MS = 1500;

/**
 * The floor a SHORTENED global cooldown cannot go below.
 *
 * Haste does not touch the global cooldown in this ruleset, so this is not
 * about haste -- it is the floor for a talent that reduces it, such as the
 * Warrior's Improved Slam. See `abilitiesForClass`.
 */
export const MINIMUM_GCD_MS = 750;

/** What an ability costs to use. */
export interface AbilityCost {
  readonly resource: ResourceType;
  readonly amount: number;
}

/** Everything an ability needs in order to decide and to act. */
export interface AbilityContext {
  readonly simulation: SimulationContext;
  readonly caster: Combatant;
  readonly target: Combatant | undefined;
  /** The ability being cast, so `onCast` can read its own declared values. */
  readonly ability: Ability;
}

/**
 * A spell or ability.
 *
 * The engine owns the parts that are the same for every ability in the game:
 * cooldowns, charges, the global cooldown, cast time, resource costs, and
 * target validity. An ability definition only supplies what is unique to it,
 * in `onCast`.
 *
 * That split is what keeps a spell from turning into a copy-pasted block of
 * cooldown bookkeeping. Definitions are content and live under `src/game`.
 */
export interface Ability {
  readonly id: string;
  readonly name: string;

  /** Time to cast. 0 (the default) means instant. */
  readonly castTimeMs?: Milliseconds;
  /**
   * How many times the effect runs DURING the cast, rather than once at the
   * end of it. This is what makes a cast a CHANNEL.
   *
   * ----------------------------------------------------------------------
   * A CHANNEL IS A CAST THAT TICKS, and almost everything else about it is
   * already a cast: the caster is locked for `castTimeMs`, the cost is paid
   * at the start, the global cooldown runs, and the swing timer resets.
   *
   * So the only new rule is WHEN the effect runs. `onCast` is called once per
   * tick, evenly spaced, with the LAST tick at the moment the channel ends --
   * which is where a non-channelled cast's single effect already lands, so a
   * one-tick channel and an ordinary cast are the same thing. That is the
   * check that the two paths have not drifted.
   *
   * Arcane Missiles is "209 Arcane damage each second for 5 sec": five ticks
   * over five seconds. Modelling it as a 5-second cast dealing 1045 at the
   * end would be the same total and the wrong shape -- every point of it
   * would arrive after the fight ended rather than during, and a haste
   * change would move all of it at once.
   *
   * HASTE SHORTENS THE WHOLE CHANNEL, so the ticks come faster and there are
   * still `channelTicks` of them. That is Classic's behaviour for Arcane
   * Missiles and it is what falls out of scheduling them inside `castTimeMs`.
   * ----------------------------------------------------------------------
   */
  readonly channelTicks?: number;
  /**
   * Whether a priority list may CANCEL this channel part-way through.
   *
   * ----------------------------------------------------------------------
   * THE RULESET OWNER'S RULING, MADE FOR WRACK: a channel can be interrupted
   * mid-cast to do something more urgent. The ticks already delivered stand
   * and the rest are cancelled, which is what cancelling a channel does.
   *
   * OPT-IN, AND THAT IS CONTAINMENT RATHER THAN CAUTION. Every channel in a
   * real client can be cancelled, so the general rule would be the truer one
   * -- but this project has two other channels, Arcane Missiles and (when it
   * is declared) Drain Soul, and turning it on for them would move the Mage
   * profiles on a ruling that was about the Warlock. The owner named Wrack;
   * the flag names Wrack. Widening it is a separate measurement.
   *
   * WHICH ENTRIES MAY DO THE INTERRUPTING IS THE LIST'S BUSINESS, not the
   * channel's -- see `PriorityEntry.interruptsChannel`. The two halves have
   * to agree before anything is cancelled, so an ability declaring this is
   * not thereby at the mercy of every entry above it.
   * ----------------------------------------------------------------------
   */
  readonly interruptibleChannel?: boolean;
  /**
   * Ticks an interrupt may NOT cancel. Defaults to 0 -- anything may be cut.
   *
   * ==========================================================================
   * THE RULESET OWNER'S RULING, about Mind Flay: "make sure it preserves a
   * minimum of the first 2 ticks of Mind Flay and thus only cuts off the last
   * tick when interrupted. **This may no longer be optimal play, but I still
   * want the functionality so the user can choose.**"
   *
   * SO IT IS A FLOOR UNDER THE CHANNEL AND NOT A BAN ON INTERRUPTING. The two
   * halves that already have to agree still do -- the ability declares
   * `interruptibleChannel` and an entry declares `interruptsChannel` -- and
   * this adds a third condition the ENGINE owns: enough of the channel has to
   * have happened.
   *
   * --------------------------------------------------------------------------
   * DECLARED AND NOT DERIVED, WHICH IS THE OPPOSITE OF THIS FILE'S USUAL
   * PREFERENCE AND IS DELIBERATE. "The first 2 ticks, and thus only the last
   * one is cut" reads as a general rule -- `channelTicks - 1` -- and the only
   * other interruptible channel in the project is ARCANE MISSILES at five
   * ticks, which would silently become un-interruptible for its first four on
   * nobody's authority. **A ruling covers what it says and is not extended by
   * analogy**, which has already paid once here: Immolation Trap was ruled in
   * and Explosive Trap was left alone until the owner named it too.
   *
   * SO THERE IS EXACTLY ONE CALLER AND A TEST ASSERTS THAT, for the same
   * reason `breaksActionAuras` carries that guard: an opt-in that grows
   * quietly is an opt-in nobody re-reads.
   * ==========================================================================
   */
  readonly protectedChannelTicks?: number;
  /** Time before it can be used again. 0 (the default) means no cooldown. */
  readonly cooldownMs?: Milliseconds;
  /** Number of independent charges. Defaults to 1. */
  readonly charges?: number;
  /** Whether using it starts the global cooldown. Defaults to true. */
  readonly triggersGcd?: boolean;
  /** Override the global cooldown length. Defaults to the caster's own. */
  readonly gcdMs?: Milliseconds;
  /** Whether haste shortens the cast time and GCD. Defaults to true. */
  readonly affectedByHaste?: boolean;
  readonly cost?: AbilityCost;
  /** Whether a living hostile target is required. Defaults to true. */
  readonly requiresTarget?: boolean;

  /**
   * Which combat table this ability resolves against.
   *
   * Mortal Strike and Rend are `melee-special`; Multi-Shot is
   * `ranged-special`; Fireball and Shadow Word: Pain are `spell`. Even an
   * ability that deals no direct damage declares one, because its table decides
   * whether it lands at all.
   *
   * Read inside `onCast` through `context.ability`, so the table is declared
   * once rather than repeated in every damage call.
   */
  readonly attackTable?: AttackTableKind;

  /**
   * How many enemies this ability strikes.
   *
   * Omitted means one, which is what nearly everything does. Declaring it is
   * how an ability states that it hits more WITHOUT that claim depending on an
   * encounter that can supply more -- see `engine/combat/targeting.ts`, which
   * resolves every selection to the single target an encounter actually has.
   *
   * So this is documentation that the engine will honour later, rather than
   * behaviour today. It is on the ability rather than in `onCast` so that the
   * combat log and any analyzer can ask without running the cast.
   */
  readonly targets?: TargetSelection;

  /**
   * Which stances (or other forms) this ability can be used in.
   *
   * Omitted or empty means ANY, which is a real answer and not an absence of
   * one -- Forever's Mortal Strike genuinely has no stance requirement.
   *
   * The engine treats these as aura ids the caster must have one of. That keeps
   * stances a content concept: the engine knows only "one of these auras must
   * be up", and the Warrior's three stances happen to be auras.
   */
  readonly stances?: readonly string[];
  /**
   * Whether an avoided attack hands most of this ability's cost back.
   *
   * DEFAULTS TO TRUE for any ability costing a refundable resource, so a new
   * one gets the rule without anyone remembering. Set `false` for the ruleset's
   * exceptions -- Ferocious Bite and Execute always deplete the pool.
   */
  readonly refundsCostOnMiss?: boolean;

  /**
   * Using this ENDS the auras a completed cast or attack breaks. Default true.
   *
   * ============================================================================
   * DERIVED, NOT DECLARED, which is the shape `refundsCostOnMiss` above already
   * uses and for the same reason: a new ability gets the rule for free and the
   * one that forgot would be the exception. The ruleset owner stated it that
   * way too -- "**almost** every completed cast or attack breaks stealth/prowl,
   * and for the purposes of this simulation the only thing that doesn't is a
   * rogue's premeditation."
   *
   * SO THERE IS EXACTLY ONE `false` IN THE PROJECT and a test asserts that,
   * because an opt-out list is the thing that grows quietly: a second ability
   * that stopped breaking stealth would hand a Rogue a free extra Ambush and
   * leave no zero anywhere to notice.
   *
   * IT IS NOT "this ability is free" OR "off the global cooldown" -- those are
   * separate fields and Premeditation happens to be both. What this says is
   * narrower: the USE does not count as the action that ends a stealth window.
   * ============================================================================
   */
  readonly breaksActionAuras?: boolean;

  /**
   * The stance aura id this ability PUTS the caster in, if it is a stance
   * change.
   *
   * Lets a rotation find the swap that unblocks a stance-gated ability without
   * knowing what a Warrior stance is: it looks for the ability that grants one
   * of the stances the blocked ability accepts.
   */
  readonly grantsStance?: string;

  /**
   * A cooldown SHARED with every other ability naming the same group.
   *
   * Using one starts the group's cooldown for all of them, on top of the
   * ability's own. The Warrior's three stances share one second: changing to
   * Defensive must stop you changing to Berserker in the same instant, and
   * each stance having its own one-second cooldown did not stop that at all --
   * a warrior could cycle all three without the clock moving.
   *
   * The group's length is `cooldownMs` of whichever ability triggered it, so a
   * group of abilities with the same cooldown needs nothing else said.
   */
  readonly cooldownGroup?: string;
  /**
   * The cooldown this ability imposes on the REST of its group.
   *
   * ============================================================================
   * DEFAULTS TO `cooldownMs`, AND EXISTS FOR A TALENT THAT SHORTENS ONE MEMBER
   * OF A GROUP AND SAYS SO. Improved Arcane Shot reads "Reduces the cooldown of
   * your Arcane Shot by 1.5 sec. DOES NOT AFFECT THE COOLDOWN OF ABILITIES
   * WHICH SHARE A COOLDOWN WITH ARCANE SHOT" -- and Summon Hawk shares one.
   *
   * SO THE TWO NUMBERS GENUINELY DIFFER: Arcane Shot comes back in 4.5 seconds
   * and the hawk it locked out still waits 6. Without this field the reduction
   * leaked into the group and the pair could be cast 5,400ms apart, measured.
   *
   * THE SHAMAN'S SHOCKS ARE THE OPPOSITE CASE AND NEED NOTHING: Reverberation
   * names every member of that group, so shortening one shortens the lockout
   * too -- which is what leaving this undefined already does.
   * ============================================================================
   */
  readonly cooldownGroupMs?: Milliseconds;

  /**
   * Why this ability does LESS than its description says, in one line.
   *
   * The same discipline items follow, and for the same reason: an effect that
   * cannot be modelled keeps its own words and is surfaced where a person can
   * see it, rather than being quietly dropped. The Results panel prints every
   * one that a fight actually cast, under "Cast but not simulated".
   *
   * A plain string rather than the richer shape items carry, because the
   * engine may not reach into the game layer for a type -- and because an
   * ability has one reason, where an item can have several effects with
   * several.
   *
   * It is a claim about the engine ON THE DAY IT IS WRITTEN, and it expires.
   * Clearing a blocker means re-reading every reason that named it; this
   * project has missed that twice. See the note in CLAUDE.md.
   */
  readonly unmodelled?: string;

  /**
   * How many combo points landing this ability awards.
   *
   * DECLARED RATHER THAN INFERRED, because a reaction watching a critical
   * strike can see the ability id and nothing about what the ability does.
   * Seal Fate is the talent that needs it -- "your critical strikes from
   * abilities that add Combo Points have a chance to add an additional one" --
   * and the set of such abilities is a property of the class, not of the
   * engine.
   *
   * The ability still awards its own points inside `onCast`; this only makes
   * the fact visible from outside. They can disagree, which is why the Rogue
   * test asserts every builder declares what it grants.
   */
  readonly comboPointsAwarded?: number;

  /**
   * Queue this ability onto the next auto-attack with the given weapon instead
   * of firing it immediately.
   *
   * The "on next swing" abilities: Heroic Strike and Cleave. Casting one pays
   * its cost and arms it; the next swing of that weapon runs its `onCast` in
   * place of the normal auto-attack, and the swing timer is unaffected.
   *
   * Only one can be armed at a time. Arming a second replaces the first, and
   * the replaced ability's cost is NOT refunded — a detail no source states
   * either way, so it is the simple reading rather than a researched one.
   */
  readonly onNextSwing?: WeaponSlot;

  /**
   * Named numbers a talent or effect has added to THIS ability, read by its own
   * `onCast`.
   *
   * The declared fields above cover what every ability has -- cost, cooldown,
   * cast time. They cannot cover "the rage Charge generates", because that is a
   * number inside one ability's body and means nothing to any other. Rather
   * than give every such number a field, an ability that has one names it here
   * and reads `context.ability.bonuses?.<key>`.
   *
   * Abilities are shared constants, so a bonus arrives on a COPY built for the
   * character that earned it.
   */
  readonly bonuses?: Readonly<Record<string, number>>;

  /**
   * What starting a cast does to an auto attack already in progress.
   *
   * RULESET: casting anything with a cast time interrupts the swing in
   * progress, and the swing timer RESETS -- the swing that was coming is lost.
   * That is the default, and it is why a cast ability is a real cost to a melee
   * character rather than free damage between swings.
   *
   * `hold` is the exception some effects grant: the swing timer keeps running
   * behind the cast, and a swing that comes due DURING it is held until the
   * cast finishes. Both then resolve and the timer restarts.
   *
   * **NOTHING DECLARES IT.** The Warrior's Improved Slam did, and this comment
   * read "Improved Slam is exactly this" beside a MISQUOTE of the clause --
   * "Slam no longer interrupts your melee swing time" against a client that
   * says "no longer interrupts **or delays** your melee swing". `hold` is the
   * first verb and the talent states both, so the quote that justified the
   * mode was the half of the tooltip the mode implements. It is `continue` now,
   * on the owner's ruling. Kept as a mode because it is a coherent thing for a
   * ruleset to say and `castSwingTimer.test.ts` pins its behaviour; a talent
   * granting it would be one line.
   *
   * ----------------------------------------------------------------------------
   * `continue` IS A THIRD MODE AND IT IS NOT A STRONGER `hold`. The auto attack
   * is not paused, not reset and not DELAYED: a swing that comes due during the
   * cast LANDS during the cast, and the weapon keeps its own rhythm straight
   * through. The ruleset owner's ruling for the Hunter's three cast shots --
   * "the ranged auto-attack is not paused or suspended. It will trigger DURING
   * the cast."
   *
   * `hold` COULD NOT SAY IT, which is why this is a new member rather than a
   * reuse. Hold leaves the timer running and then makes the swing WAIT for the
   * cast to end, which is most of the loss on a cast longer than a swing
   * cycle: a four-second Sniper Shot against a 2.8-second hasted bow would
   * still have deferred a shot by 1.2 seconds, and the deferral is exactly the
   * suspension the owner has ruled away. A reader is likely to reach for
   * `hold` here, and it is a smaller number and no error.
   *
   * NOTHING DISTINGUISHES THE SLOT, because no combatant in this project swings
   * a melee weapon and a ranged one at once -- `swingingSlots` returns
   * `['ranged']` for a ranged style and never includes it otherwise. So "the
   * RANGED auto-attack continues" and "the auto-attack continues" are the same
   * set today, and `tests/game/hunterAutoShotDuringCast.test.ts` asserts that
   * rather than building a per-slot gate nothing could reach.
   * ----------------------------------------------------------------------------
   *
   * Ignored by an instant ability, which never interrupts anything.
   */
  readonly swingTimer?: 'reset' | 'hold' | 'continue';

  /**
   * Extra conditions beyond cooldown, cost and target, which the engine
   * already checks. Use for things like "only below 20% health".
   */
  readonly canCast?: (context: AbilityContext) => boolean;

  /**
   * An effect that has to be in place FOR the cast rather than after it.
   *
   * ----------------------------------------------------------------------------
   * EVOCATION IS WHY, AND IT IS THE FIRST THING HERE THAT PAYS OUT DURING ITS
   * OWN CHANNEL. "It immediately starts your out-of-combat mana regeneration
   * rate and multiplies it by 16x" over eight seconds, and the mana arrives
   * through the regeneration timer -- so the aura has to be up while the
   * channel runs. `onCast` could not do it: for a plain cast it runs at the
   * END, and for a channel it runs per tick, so the first tick's worth of the
   * window would be missing and the aura's own duration would have to guess
   * the hasted channel length.
   *
   * RUNS ONCE PER CAST, after the cost is paid and the charges spent, and
   * AFTER `castEndsAt` is set -- so an effect here can read how long the cast
   * it belongs to will actually last, hasted. For an instant it runs
   * immediately before `onCast`, because "start" and "end" are the same moment
   * and an instant that declared both should get both.
   *
   * IT IS NOT A SECOND `onCast`. Anything that happens as a RESULT of the cast
   * belongs in `onCast`, where the cast reactions can see what it spent. This
   * is for the window, and the pairing is the point: Evocation opens it here
   * and closes it in `onCast`, so the window ends exactly when the channel
   * does rather than on a duration that has to be kept in step with it.
   * ----------------------------------------------------------------------------
   */
  readonly onCastStart?: (context: AbilityContext) => void;

  /**
   * What the ability actually does: deal damage, apply an aura, generate a
   * resource. Runs when the cast completes, which is immediately for an
   * instant ability.
   */
  readonly onCast: (context: AbilityContext) => void;
}
