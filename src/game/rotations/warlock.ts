import type { PriorityEntry, Rotation, SimulationContext, Combatant } from '../../engine';
import { PriorityRotation } from '../../engine';
import type { TalentAllocation } from '../talents/Talent';
import { WRACK_CHANNEL_MS } from '../abilities/warlock';

/**
 * Warlock priority lists.
 *
 * ----------------------------------------------------------------------------
 * THE RULESET OWNER'S OWN LISTS, specified entry by entry and measured after.
 * This header said the opposite -- "SHELLS, AND SAID TO BE. Not the ruleset
 * owner's own lists" -- for most of the project's life, which is exactly how a
 * shell should read while it is one.
 *
 * CHOSEN BY CAPSTONE, the Rogue's test: Wrack is 31 points into Affliction and
 * Incinerate is 31 into Destruction, and no build reaches both.
 *
 * BOTH LISTS OPEN THEIR DAMAGE-OVER-TIME EFFECTS AND THEN FILL, which is what
 * a Warlock is: the fillers are worth less per global cooldown than keeping a
 * bleed up, so every list is "is anything about to fall off" first.
 * ----------------------------------------------------------------------------
 */

/** Refresh a debuff when it is nearly gone, not on cooldown. */
const REFRESH_WINDOW_MS = 2000;

const missing = (auraId: string) =>
  (context: SimulationContext, _actor: Combatant, target?: Combatant): boolean =>
    target !== undefined &&
    target.auras.remainingMs(auraId, context.clock.now()) < REFRESH_WINDOW_MS;

/**
 * "IF NOT ACTIVE", which is the ruleset owner's wording and is NOT the same as
 * the two-second refresh window beside it.
 *
 * ----------------------------------------------------------------------------
 * A REFRESH RESETS THE AURA, so anything left on the clock when the rotation
 * reaches the entry is thrown away. A two-second window clips up to two
 * seconds off every application -- and the faster the character acts, the
 * sooner it reaches the entry inside that window and the more it loses.
 *
 * MEASURED ON THE MOONKIN, where Nature's Grace cost 14.9 DPS by doing nothing
 * but speeding the character up: casts went 26.3 a fight to 27.4 while Moonfire
 * ticks fell 25.1 to 22.5. The buff was fine; the window was paying for it.
 *
 * `missing` is kept for the lists the owner has not replaced, so the two
 * readings sit side by side rather than one silently becoming the other.
 * ----------------------------------------------------------------------------
 */
const expired = (auraId: string) =>
  (context: SimulationContext, _actor: Combatant, target?: Combatant): boolean =>
    target !== undefined && target.auras.remainingMs(auraId, context.clock.now()) <= 0;

/**
 * "every one of these debuffs has at least this long left".
 *
 * ----------------------------------------------------------------------------
 * WRACK IS WHY, AND THE WINDOW IS THE CHANNEL. A six-second channel is six
 * seconds in which the rotation does nothing else -- the caster is locked for
 * the whole of it -- so committing to one while a bleed is about to fall off
 * trades three ticks of Corruption for six of Wrack and loses.
 *
 * SO THE GATE IS `WRACK_CHANNEL_MS` AND NOT A LITERAL SIX SECONDS. The owner's
 * specification says "six seconds left", and six seconds is the channel: tying
 * the gate to the constant means a channel that changes length takes its own
 * gate with it, where a literal would quietly protect the wrong window.
 *
 * ALL of them, not any: the entry is asking "can I afford to stop acting", and
 * one bleed expiring mid-channel is enough to make the answer no.
 * ----------------------------------------------------------------------------
 */
const allLastingAtLeast = (auraIds: readonly string[], ms: number) =>
  (context: SimulationContext, _actor: Combatant, target?: Combatant): boolean =>
    target !== undefined &&
    auraIds.every((auraId) => target.auras.remainingMs(auraId, context.clock.now()) >= ms);

/** "this aura is on the actor", for a proc the next action should spend. */
const actorHas = (auraId: string) =>
  (_context: SimulationContext, actor: Combatant): boolean => actor.auras.has(auraId);

/** "current mana is below N% of maximum". */
const manaBelowFraction = (fraction: number) =>
  (_context: SimulationContext, actor: Combatant): boolean => {
    const mana = actor.resources.get('mana');
    if (!mana || mana.maximum <= 0) return false;
    return mana.current / mana.maximum < fraction;
  };

// ---------------------------------------------------------------------------

/**
 * SM/DS — Shadow Mastery and Demonic Sacrifice, which is what the name means.
 *
 * 40/11/0. Its damage is three damage-over-time effects and Shadow Bolt, and
 * almost every talent it takes raises one or the other: Shadow Mastery is +5%
 * Shadow, Malediction +5% periodic, Improved Corruption both a faster cast and
 * more damage.
 *
 * SHADOW BOLT LAST AND SHADOW TRANCE FIRST. Nightfall gives the bolt a chance
 * to become instant off a damage-over-time tick, and an instant Shadow Bolt is
 * worth more than a three-second one by exactly the cast time -- so the
 * proc is spent as soon as it arrives.
 *
 * LIFE TAP WHERE THE MANA RUNS OUT. It is free here in a way it is not in a
 * real raid: nothing attacks these profiles, so the health has no other use.
 * Its own `canCast` refuses when the pool is near full, which keeps it from
 * costing a global cooldown for nothing.
 */
export const WARLOCK_AFFLICTION: readonly PriorityEntry[] = [
  /*
   * THE THREE DOTS FIRST, IN THE OWNER'S ORDER, and the Shadow Trance-gated
   * Shadow Bolt that used to head this list is gone. That entry existed to
   * spend a proc the moment it landed; the owner's order holds the bleeds up
   * first and lets the filler at the bottom take the proc when it comes.
   */
  /*
   * AMPLIFY CURSE FIRST, AND IT COSTS THE LIST NOTHING. "A cooldown that needs
   * to be cast before applying the first Bane of Agony of the fight. It does
   * not trigger a global cooldown" -- the owner's words, and both halves are
   * load-bearing: off the global cooldown means the Bane below it lands in the
   * same instant, and a three-minute cooldown in a sixty-second fight means it
   * fires exactly once without needing a condition to say so.
   *
   * UNGATED ON PURPOSE. An entry that is ungated and always castable is a floor
   * under everything below it -- but this one has a COOLDOWN, which is the half
   * of that rule that is easy to forget, so the list falls straight past it for
   * the rest of the fight.
   */
  { abilityId: 'amplify_curse' },
  /*
   * SHADOW TRANCE SPENT THE MOMENT IT LANDS. "Ensure that if a corruption tick
   * or wrack tick triggers Nightfall, the next action is to cast an instant
   * Shadow Bolt and consume the nightfall proc" -- the owner's instruction, and
   * it puts back an entry that an earlier version of this list had and the
   * owner's first ordering removed.
   *
   * ABOVE THE BLEEDS, which is what "the NEXT action" requires. Below them, a
   * proc landing while two bleeds were due would wait two global cooldowns and
   * could expire -- Shadow Trance lasts ten seconds and the bleeds cost 1.5
   * each, so it would usually survive, which is exactly the kind of "usually"
   * that hides a dropped proc.
   *
   * THE DUPLICATE ID IS LEGAL AND IS THE DOCUMENTED SHAPE: gated on a proc
   * above, ungated as the filler below. What is NOT legal is a copy below an
   * unconditional one, which could never be reached.
   */
  { abilityId: 'shadow_bolt', condition: actorHas('shadow_trance') },
  { abilityId: 'bane_of_agony', condition: expired('bane_of_agony') },
  { abilityId: 'corruption', condition: expired('corruption') },
  { abilityId: 'siphon_life', condition: expired('siphon_life') },
  /*
   * LIFE TAP ON A MANA THRESHOLD rather than ungated. It was unconditional and
   * fired five times a fight, each one a global cooldown that dealt nothing --
   * at 15% it fires only when the bar actually needs it.
   */
  { abilityId: 'life_tap', condition: manaBelowFraction(0.15) },
  /*
   * WRACK, BETWEEN LIFE TAP AND SHADOW BOLT, GATED ON ALL THREE BLEEDS HAVING
   * SIX SECONDS LEFT. The ruleset owner's own position and own condition, which
   * this comment carried for the whole time the entry was absent.
   *
   * --------------------------------------------------------------------------
   * IT WAS PAUSED AND IS BACK, and the two reasons it was paused have both
   * expired. The comment here said "a flat 216 over a six-second channel, with
   * no coefficient because the sheet has no Wrack row, and its +10% to other
   * Shadow damage-over-time effects unmodelled" -- and the owner has since
   * supplied the coefficient directly at 14.3% of spell power a tick, and the
   * amplification is applied through `periodicDamageTakenBySchool`. Neither
   * half is missing now.
   *
   * THE SIX-SECOND GATE IS WHAT MAKES IT CASTABLE AT ALL rather than a
   * throughput loss. See `allLastingAtLeast`: the channel locks the caster, so
   * the entry only fires when it can afford to stop acting.
   * --------------------------------------------------------------------------
   */
  {
    abilityId: 'wrack',
    /*
     * ------------------------------------------------------------------------
     * THIS GATE NAMES SIPHON LIFE, SO WRACK DIES IF SIPHON LIFE LEAVES THE
     * LIST. Measured, not predicted: asked whether Siphon Life was worth
     * casting, removing its entry took Wrack from 5.7 casts a fight to ZERO,
     * because `siphon_life` is never applied and so can never have six seconds
     * left. The profile read 452.4 and looked like a clean answer; what it
     * actually measured was the loss of BOTH abilities.
     *
     * IT IS THE SELF-DISABLING SPECIFICATION AGAIN, which this project has now
     * met three times -- the Seal Twist cycle with no entry point, "Scorch if
     * scorch debuff <= 5" being always true, and this. Each time the list ran a
     * whole fight without erroring.
     *
     * LEFT AS THE OWNER WROTE IT, because Siphon Life stays: with the gate
     * repaired to the two remaining bleeds it is worth +13.6 DPS, so the
     * coupling is latent rather than live. **Anyone removing Siphon Life must
     * repair this list too.**
     * ------------------------------------------------------------------------
     */
    condition: allLastingAtLeast(
      ['bane_of_agony', 'corruption', 'siphon_life'],
      WRACK_CHANNEL_MS,
    ),
  },
  { abilityId: 'shadow_bolt' },
];

/**
 * FIRELOCK — Immolate held up, Conflagrate on cooldown, Incinerate as filler.
 *
 * 5/11/35, and Shadow and Flame at 5/5 is what shapes it. That talent does
 * three things and two of them change this list rather than a number:
 * Conflagrate no longer consumes Immolate, so it goes on cooldown rather than
 * being saved; and Shadowburn refunds its soul shard, so it can be cast at all
 * in a fight with no shard income.
 *
 * IMMOLATE ABOVE INCINERATE AND THE ORDER IS LOAD-BEARING. Incinerate is worth
 * 25% more against a burning target and reads that at cast time, so a list
 * that let Immolate lapse would quietly lose a quarter of its filler.
 */
export const WARLOCK_DESTRUCTION: readonly PriorityEntry[] = [
  { abilityId: 'immolate', condition: missing('immolate') },
  { abilityId: 'conflagrate' },
  { abilityId: 'shadowburn' },
  /*
   * NO CORRUPTION, by the ruleset owner's instruction. It was 10.3% of this
   * profile's damage and it is out: a 2-second cast and a global cooldown spent
   * on a Shadow bleed that this build's talents barely touch -- Firelock takes
   * no Malediction, no Improved Corruption and no Shadow Mastery, and since Ruin
   * and Agonizing Flames were correctly scoped to the Destruction tree they do
   * not reach it either. What the global cooldown buys instead is Incinerate,
   * which is 25% larger against a burning target.
   */
  { abilityId: 'life_tap' },
  { abilityId: 'incinerate' },
];

export const WARLOCK_AFFLICTION_ROTATION: Rotation = new PriorityRotation(
  'Warlock (SM/DS)',
  WARLOCK_AFFLICTION,
);
export const WARLOCK_DESTRUCTION_ROTATION: Rotation = new PriorityRotation(
  'Warlock (Firelock)',
  WARLOCK_DESTRUCTION,
);

/**
 * Which list a Warlock runs, by capstone.
 *
 * Wrack is 31 into Affliction and Incinerate 31 into Destruction; 51 points
 * cannot reach both. A Warlock with neither gets the Affliction list, which is
 * written entirely out of trainer abilities.
 */
export function warlockRotation(talents: TalentAllocation): Rotation | undefined {
  if ((talents.incinerate ?? 0) > 0) return WARLOCK_DESTRUCTION_ROTATION;
  return WARLOCK_AFFLICTION_ROTATION;
}

/** Which demon this build sacrificed, if it took the talent. */
export function sacrificedDemon(
  talents: TalentAllocation,
  petFamily: string | undefined,
): string | undefined {
  if ((talents.demonic_sacrifice ?? 0) === 0) return undefined;
  return petFamily;
}
