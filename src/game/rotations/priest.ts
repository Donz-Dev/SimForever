import type { Rotation } from '../../engine';
import type { TalentAllocation } from '../talents/Talent';
import type { AplCondition, AplList } from './apl';
import { RACIAL_COOLDOWNS } from './racialCooldowns';
import { CONSUMABLE_COOLDOWNS, CONSUMABLE_HEALS } from './consumableCooldowns';
import { any, compileRotation, fightRemainingFraction, not, selfMissing, targetExpired } from './apl';

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
const expired = targetExpired;
const withoutAura = selfMissing;

/**
 * Where Shadow Word: Death is HELD, so it comes off cooldown inside the window
 * Early Demise opens.
 *
 * ----------------------------------------------------------------------------
 * THE RULESET OWNER'S INSTRUCTION, and it is a rotation decision rather than a
 * reading of any tooltip: "cast on cooldown, but NOT between 21-35% of the
 * remaining combat duration." So the entry fires freely down to 35% remaining,
 * goes quiet through the band, and fires again from 20% -- which is exactly
 * when Early Demise's +30% critical strike chance starts applying.
 *
 * MEASURED AT -4.9 DPS, PUT TO THE OWNER WITH THAT NUMBER, AND RULED: "leave
 * the hold band". So the -4.9 is the price of a decision and not a finding
 * waiting to be acted on -- the same resolution Hunter's Mark got at -10.1.
 * **DO NOT DELETE THIS CONDITION ON THE STRENGTH OF THE ARITHMETIC BELOW.**
 *
 * What follows is why it costs rather than pays, because the reason is not the
 * obvious one and the obvious one is wrong. It is kept because the day the
 * arithmetic changes -- a longer fight, or a shorter cooldown -- the band starts
 * buying something, and then it wants re-measuring rather than re-deriving.
 *
 * THE HOLD BUYS NOTHING, BECAUSE THE WINDOW IS SHORTER THAN THE COOLDOWN. At
 * this profile's 60-second fight the Early Demise window is 11.6 seconds and
 * Shadow Word: Death's cooldown is 15, so AT MOST ONE CAST can ever land inside
 * it -- and an ungated entry already lands that one cast there on its own:
 *
 *   held     3.53 casts a fight, 1.00 of them in the window
 *   unheld   4.00 casts a fight, 1.00 of them in the window
 *
 * Identical where it matters, half a cast apart everywhere else, and that half
 * cast is the whole -4.9. Early Demise is worth +5.2 held and +4.9 unheld, so
 * the hold does not even move the talent it exists for.
 *
 * SO THE FIRST RATIONALE WRITTEN HERE WAS FALSE, and it is worth leaving the
 * correction visible: it said the band was "one cooldown wide" because 15% of a
 * 100-second fight is 15 seconds. The fight is SIXTY seconds. The band is 8.7
 * seconds, which is shorter than the cooldown, not equal to it -- and the
 * arithmetic was self-consistent, which is exactly why it read as an
 * explanation. **A rationale is a claim and wants measuring like any other.**
 * The 35 is the owner's number and no reading of any tooltip derives it.
 *
 * `EARLY_DEMISE_FRACTION` IS NOT `EXECUTE_PHASE_FRACTION`, and not Quietus's
 * 0.35 either, however much the arithmetic rhymes. Early Demise states its own
 * 20 at index 0 of every rank's row in `values/priest.json`, and
 * `shadowWordDeathHold.test.ts` pins that this constant still matches it -- so a
 * Forever change to the talent fails a test instead of silently leaving the
 * hold in the wrong place.
 * ----------------------------------------------------------------------------
 */
/*
 * ==============================================================================
 * THERE IS NO REFRESH WINDOW ON SHADOW WORD: PAIN, AND THAT IS A MEASURED
 * ANSWER RATHER THAN THE ABSENCE OF ONE.
 *
 * A two-second window WAS shipped here for part of one round and is reverted.
 * `tools/priestVariants.ts`'s `priestSwpWindow` is the whole sweep, against an
 * EXPLICIT on-expiry control at two fight lengths:
 *
 *   window        60s fight      300s fight
 *   on expiry      control         control
 *   0.5s           +2.78           -33.33
 *   1.0s           +2.78           -33.33
 *   1.5s           +2.78           -46.27
 *   2.0s         **+5.47**        -118.00
 *   2.5s           +5.47          -128.84
 *   3.0s          -11.23          -143.86
 *
 * Every cell is a PAIRED delta from the explicit on-expiry row -- 1200
 * iterations at 60s, 400 at 300s -- and not one row subtracted from another,
 * which is a different and much wider interval.
 *
 * **THE OWNER'S PLAIN "IF NOT ACTIVE" WORDING WINS AT EVERY LENGTH BUT THE
 * DEFAULT ONE**, and at 300s it wins monotonically -- the narrower the window,
 * the better, with zero best. The 60-second column is small, non-monotone and
 * the only place any window pays.
 *
 * WHY: a window is paid once per CAST and the uptime it buys is paid once per
 * FIGHT. A 60-second fight casts this three times and a 300-second fight twelve,
 * so the clipping compounds while the closed gap does not.
 *
 * AND THE MECHANISM SAYS THE SAME THING FROM THE OTHER SIDE. At a THREE second
 * window -- exactly this DoT's tick period -- the debuff reaches **100.00%
 * uptime and loses 2.08 ticks a fight**: casts hold at 3.00, ticks fall 18.96
 * to 17.27. **A DoT at perfect uptime can be worth less than one at 97.4%**,
 * so the uptime table is the wrong measure for a periodic effect and a reader
 * optimising that column would ship the worst cell in the sweep.
 *
 * **THIS WAS GOT WRONG TWICE IN ONE ROUND BEFORE IT WAS GOT RIGHT**, both times
 * by reading a 60-second sweep as an answer: once shipping 2.0s (the 300s
 * build's worst live cell), once shipping 1.0s. What found it was an EXPLICIT
 * on-expiry row -- the control had been `(p) => p`, which silently means
 * "whatever is shipped" and stopped meaning "on expiry" the moment anything was.
 * ==============================================================================
 */


export const EARLY_DEMISE_FRACTION = 0.2;
export const SHADOW_WORD_DEATH_HOLD_FRACTION = 0.35;

/*
 * "NOT YET INSIDE THE HOLD BAND, OR ALREADY PAST IT."
 *
 * `inExecutePhase(context, f)` IS `fightRemaining atMost fraction f` exactly --
 * it compares the same two numbers the same way -- so the band converts to data
 * with no helper and no approximation.
 */
const outsideTheHoldBand: AplCondition = any(
  not(fightRemainingFraction('atMost', SHADOW_WORD_DEATH_HOLD_FRACTION)),
  fightRemainingFraction('atMost', EARLY_DEMISE_FRACTION),
);

/**
 * SHADOW — the form first, then the two bleeds, then Mind Flay as the filler.
 *
 * SHADOWFORM OPENS IT AND IS CAST EXACTLY ONCE. It has no duration and its own
 * canCast refuses while it is up, so the entry falls through for the rest of
 * the fight. It is worth a global cooldown and 40% of base mana at the pull
 * for +10% Shadow damage, half-price Shadow spells and double Shadow crit
 * damage — which is most of what the build is.
 *
 * MIND FLAY IS THE FILLER AND IT IS A CHANNEL, three seconds for 390. Mind
 * Blast is 490 in a 1.5 second cast on an eight-second cooldown, so it goes
 * above; what Mind Flay fills is the gaps between everything else.
 *
 * SHADOW WORD: DEATH HURTS, AND IT IS BACK, AND IT IS HELD. The target is never
 * killed, so its backlash always lands — a tenth of the priest's health every
 * fifteen seconds with no healer. The owner's earlier list had it out, measured
 * at a cost of 35.2 DPS; the build now takes Early Demise 2/2, so it is in and
 * gated to come off cooldown inside that talent's window. The entry is worth
 * +37.7 and the gate on it is worth -4.9 -- see `outsideTheHoldBand` above for
 * why the gate costs rather than pays.
 */
export const PRIEST_SHADOW: AplList = {
  name: 'Priest (Shadow)',
  entries: [
    { abilityId: 'shadowform', condition: withoutAura('shadowform') },
  /*
   * THE RACIAL COOLDOWNS, AFTER WHATEVER OPENS THIS LIST.
   *
   * Free, off the global cooldown, and skipped in silence by every build
   * that is not of the race that learns them. BOTH ENDS OF THE LIST WERE
   * MEASURED AND BOTH WERE WRONG -- see `racialCooldowns.ts`.
   */
  ...RACIAL_COOLDOWNS,
  ...CONSUMABLE_COOLDOWNS,
  ...CONSUMABLE_HEALS,
  /*
   * ==========================================================================
   * INNER FOCUS, WITH THE FREE OFF-GLOBAL-COOLDOWN ABILITIES, worth
   * **+6.13 +/- 0.50** at 60s over 1200 paired iterations and **+2.40 +/-
   * 0.26** at 300s -- both measured as the cost of REMOVING it from the
   * shipped build, which needs no trust in a stale baseline.
   *
   * **BOTH HALVES OR NEITHER.** The talent without this entry measures
   * `IDENTICAL FIGHTS` -- an ability in the book that no list casts -- and this
   * entry without the talent is skipped in silence, because
   * `PriorityRotation` passes over an ability the character does not know. The
   * pair is the change; neither half is.
   *
   * UNGATED, AND THAT IS SAFE BECAUSE IT HAS A COOLDOWN. An ungated,
   * always-castable entry is a floor under everything below it -- but Inner
   * Focus is a 180-second cooldown, so after it fires the list falls straight
   * past it for the rest of the fight. It is the same reason Sniper Shot can
   * sit below an ungated Arcane Shot.
   *
   * POSITION IS A CHOICE BETWEEN EQUALS AND THE BOTTOM IS NOT ONE OF THEM.
   * Above `shadow_word_pain`, above `mind_blast`, above `shadow_word_death`,
   * and gated on Shadow Word: Death being ready all measured the identical
   * **+6.67**: the ability is free and off the global cooldown, so wherever it
   * sits above the filler it fires in the same instant and the same spell
   * collects the crit. Two positions are NOT equal:
   *
   *   above `mind_flay`   **+1.65** -- the entries above it get first refusal,
   *                       so the +25% lands on a 568-damage Mind Flay tick
   *                       instead of a 1,456 Mind Blast
   *   the bottom         **IDENTICAL FIGHTS** -- never reached at all, because
   *                       Mind Flay is an ungated filler above it
   *
   * **SO THE BOTTOM IS THE WRONG PLACE FOR THIS ONE ENTRY**, which is the
   * documented exception to "a new entry goes at the bottom": a free off-GCD
   * cooldown goes near the top, and five of seven profiles once never cast
   * their racial for exactly this reason.
   *
   * WHAT IT IS WORTH IS THE CRIT AND NOT THE MANA. The 100% cost reduction is
   * worth nothing on a build that leaves 52.5% of its mana unspent at 60s; the
   * +25% critical strike chance lands on one of
   * `INNER_FOCUS_CRITTABLE` -- Mind Blast, Mind Flay or Shadow Word: Death --
   * because the two DoTs apply an aura and roll no table, so they have no crit
   * to improve.
   * ==========================================================================
   */
  { abilityId: 'inner_focus', note: 'Free and off the GCD. Worth +6.13 with this entry, 0.00 without it.' },
    { abilityId: 'shadow_word_pain', condition: expired('shadow_word_pain') },
    { abilityId: 'devouring_plague', condition: expired('devouring_plague') },
  /*
   * ==========================================================================
   * VAMPIRIC EMBRACE LEAVES THIS LIST, AND IT IS WORTH **+39.5**.
   *
   * It fired twice a fight for **0.0% of the damage**, which is the whole
   * finding: the debuff returns a share of the Priest's Shadow damage to the
   * party as HEALTH, and this profile sets `targetAttacks: false` -- so nothing
   * needs healing, the clause pays out to nobody, and the two global cooldowns
   * are a straight loss.
   *
   * THE TALENT POINT STAYS AND HAS TO. Shadowform requires Vampiric Embrace
   * 1/1, so the point is the capstone's prerequisite whatever the list does
   * with it -- which is the `requiresRanks` rule: a talent whose own effect is
   * worth nothing can still be mandatory. What is removed is the CAST, not the
   * choice.
   *
   * SO THIS IS AN ENTRY THAT WAS ALWAYS GOING TO READ 0.0% AND NEVER READ ZERO
   * USES, which is why no audit found it: `ability_audit.ts` looks for an
   * ability in the book and never cast, and `USES=1` flags an entry that never
   * fires. This one fired, every fight, and dealt nothing. **A healing debuff
   * on a profile nothing attacks is the one shape both those checks are blind
   * to**, and what caught it was asking what each entry was FOR.
   *
   * IT IS THE OWNER'S OWN LIST, so this is a measured answer to the
   * optimisation brief rather than a correction -- their instruction was to
   * "evaluate pre-combat, and APL decisions to maximize throughput", and this
   * is the largest single thing that evaluation found on this profile.
   * ==========================================================================
   */
    { abilityId: 'mind_blast' },
  /*
   * ON COOLDOWN, EXCEPT THROUGH THE HOLD BAND. The condition is the only thing
   * gating it -- there is no combo point, no proc and no debuff to wait for --
   * so between 35% and 20% remaining the list simply falls past it to Mind
   * Flay, which is what "held" costs and is less than the cooldown would.
   */
  {
    abilityId: 'shadow_word_death',
    condition: outsideTheHoldBand,
    note: 'Held out of the band Early Demise wants it in. Worth +37.7; the gate costs -4.9.',
  },
  { abilityId: 'mind_flay' },
  ],
};

export const PRIEST_SHADOW_ROTATION: Rotation = compileRotation(PRIEST_SHADOW);

/**
 * Which list a Priest runs.
 *
 * ONE LIST, because there is one profile. A Discipline or Holy priest is a
 * healer, and nothing in this project measures healing — so the honest answer
 * for any build is the Shadow list, whose abilities are all trainer spells bar
 * the capstone.
 */
export function priestRotation(_talents: TalentAllocation): Rotation | undefined {
  return PRIEST_SHADOW_ROTATION;
}
