import type { Milliseconds } from '../../engine';

/**
 * The universal spell coefficient formula.
 *
 * ----------------------------------------------------------------------------
 * WHAT A COEFFICIENT IS, in the ruleset owner's own words: the percentage of
 * "(total spell damage + matching-school spell damage)" that is ADDED to a
 * spell's own base damage. That sum is exactly what `spellPowerFor` returns,
 * and `scaleByPower` already computes `baseAmount + coefficient x power` -- so
 * this file supplies only the coefficient, and the pipeline was ready for it.
 *
 *     damage = castTime / 3.5 x (spellPower + schoolSpellPower) + baseDamage
 *
 * The owner's worked example: a 2.5-second spell dealing 150 to 250 Nature
 * damage, on a character with +100 spell damage and +80 Nature damage, rolls
 * 2.5 / 3.5 x 180 + 200 = 328.57. `spellCoefficientTest` pins that number.
 *
 * ----------------------------------------------------------------------------
 * FOUR RULES, ONE SUPPLIED AND THREE BORROWED FROM CLASSIC.
 *
 * The owner supplied the cast-time rule and the instant floor directly. The
 * other three were RULED ON by the owner, each chosen as Classic's, and each
 * is marked `PLACEHOLDER_` or named as borrowed below because Forever has not
 * stated them itself. This is the standing decision written down in CLAUDE.md:
 * a visibly borrowed Classic number beats an inert system, and beats a
 * silently borrowed one by much more.
 *
 *   direct    castTime / 3.5, with castTime clamped to [1.5, 3.5]
 *   channel   channelDuration / 3.5, split evenly across the ticks, UNCAPPED
 *   periodic  baseDuration / 15, split evenly across the ticks, UNCAPPED
 *   hybrid    both of the above, each scaled by its own share of their sum
 *
 * ONLY THE DIRECT RULE IS CLAMPED, and that is Classic being self-consistent
 * rather than an oversight: a 5-second Arcane Missiles channel is worth 1.429
 * and a 24-second Bane of Agony 1.6, while a 6-second Pyroblast is worth 1.0.
 * A channel and a DoT already pay for their coefficient in TIME, which is what
 * the clamp exists to stop a single cast from doing.
 * ----------------------------------------------------------------------------
 */

/**
 * Seconds of cast time per full point of spell power. The owner's number.
 *
 * A ruleset constant and the reason a slow spell scales harder than a fast
 * one: what a cast buys from gear is proportional to how long it took.
 */
export const SPELL_COEFFICIENT_CAST_DIVISOR = 3.5;

/**
 * Seconds of DURATION per full point of spell power, for a periodic effect.
 *
 * PLACEHOLDER, in the CLAUDE.md sense: it is WoW Classic's number, chosen by
 * the ruleset owner when asked, and Forever has not stated one. It would be
 * confirmed by a Forever source giving any DoT's coefficient outright -- a
 * single stated figure settles the divisor, because the durations are known.
 *
 * It is not 3.5 because a DoT is not a cast: an 18-second Shadow Word: Pain
 * would otherwise be worth five spells' scaling.
 */
export const PLACEHOLDER_SPELL_COEFFICIENT_DOT_DIVISOR = 15;

/**
 * An instant cast is treated as this many seconds. The owner's number,
 * supplied with the rule: "for the purposes of this equation Instant Cast
 * spells use 1.5 / 3.5".
 *
 * It is the global cooldown, which is the real cost of an instant -- so an
 * instant is priced at the time it actually consumes.
 */
export const INSTANT_CAST_SECONDS = 1.5;

/**
 * Cast times at or above this are treated as this. PLACEHOLDER: Classic's
 * rule, chosen by the owner when asked, and not stated by Forever.
 *
 * Exactly one spell in the project reaches it -- Pyroblast, at six seconds --
 * and it is the difference between a coefficient of 1.0 and one of 1.714. A
 * Forever source stating Pyroblast's coefficient would settle it alone.
 */
export const PLACEHOLDER_MAX_COEFFICIENT_CAST_SECONDS = 3.5;

/**
 * The coefficient a DIRECT-damage spell of this cast time carries.
 *
 * The cast time is the BASE one, before talents and before haste, which is
 * the owner's wording and also the only stable reading -- a coefficient that
 * moved with haste would make Bloodlust raise the damage of every individual
 * cast as well as the number of them.
 *
 * @param castTimeMs the ability's declared `castTimeMs`; 0 or absent is instant
 */
export function directSpellCoefficient(castTimeMs: Milliseconds | undefined): number {
  const seconds = (castTimeMs ?? 0) / 1000;
  const clamped = Math.min(
    Math.max(seconds, INSTANT_CAST_SECONDS),
    PLACEHOLDER_MAX_COEFFICIENT_CAST_SECONDS,
  );
  return clamped / SPELL_COEFFICIENT_CAST_DIVISOR;
}

/**
 * The coefficient ONE TICK of a channelled spell carries.
 *
 * The whole channel is the cast, so it is worth `channelMs / 3.5` in total and
 * each tick gets an equal share. Uncapped: see the note at the top.
 *
 * Haste shortens a channel without removing ticks, so the per-tick figure is
 * derived from the BASE channel time for the same reason a direct cast is.
 */
export function channelTickCoefficient(channelMs: Milliseconds, ticks: number): number {
  if (ticks <= 0) return 0;
  return channelMs / 1000 / SPELL_COEFFICIENT_CAST_DIVISOR / ticks;
}

/**
 * The coefficient ONE TICK of a damage-over-time effect carries.
 *
 * ----------------------------------------------------------------------------
 * DERIVED FROM THE BASE DURATION AND THE BASE TICK COUNT, then applied to
 * every tick the effect actually gets -- which matters because a talent can
 * lengthen a DoT. Improved Shadow Word: Pain adds six seconds to an eighteen
 * second effect, and this project already reads that as two EXTRA ticks rather
 * than the same total spread thinner. Those two ticks carry the same
 * coefficient as the other six, so the talent scales with gear exactly as the
 * ticks it is adding to do.
 *
 * Deriving from the LENGTHENED duration instead would be the other reading and
 * is wrong twice over: it would hand the talent a bigger coefficient per tick
 * as well as more ticks, and it would make the same spell scale differently on
 * two characters.
 * ----------------------------------------------------------------------------
 *
 * @param baseDurationMs the duration BEFORE any talent lengthens it
 * @param baseTicks      how many ticks that base duration contains
 */
export function periodicTickCoefficient(
  baseDurationMs: Milliseconds,
  baseTicks: number,
): number {
  if (baseTicks <= 0) return 0;
  return (
    baseDurationMs / 1000 / PLACEHOLDER_SPELL_COEFFICIENT_DOT_DIVISOR / baseTicks
  );
}

/** A hybrid spell's two coefficients: the direct hit, and one DoT tick. */
export interface HybridSpellCoefficients {
  /** For the `dealDamage` that lands on cast. */
  readonly direct: number;
  /** For ONE tick of the effect it leaves behind. */
  readonly perTick: number;
}

/**
 * The coefficients for a spell that hits AND leaves a damage-over-time effect.
 *
 * ----------------------------------------------------------------------------
 * NEITHER HALF GETS ITS FULL COEFFICIENT, because the spell is one cast and
 * would otherwise scale about twice as hard as a nuke that costs the same
 * global cooldown. Each half is scaled by ITS OWN SHARE of the two:
 *
 *     directShare = direct / (direct + dot)
 *     dotShare    = dot    / (direct + dot)
 *     finalDirect = direct x directShare
 *     finalDot    = dot    x dotShare
 *
 * PLACEHOLDER: Classic's formula, chosen by the ruleset owner when asked, and
 * not stated by Forever. **It reproduces Classic's published pairs exactly**,
 * which is what makes it the right transcription of that rule rather than a
 * plausible one -- Moonfire, a 1.5-second instant with a 12-second DoT, comes
 * out at 0.1495 and 0.5209 against Classic's published 0.15 and 0.52.
 * `spellCoefficient.test.ts` pins that pair, because a normalisation that
 * merely LOOKS right is the failure this project keeps finding: several of
 * them land near the correct answer and only one reproduces it.
 *
 * Note the weighting is deliberately NOT "make the two sum to 1.0". The bigger
 * half keeps more of what it had, so a long DoT with a short cast stays a DoT
 * spell -- Immolate's two halves sum to 0.84, not to 1.0.
 *
 * ----------------------------------------------------------------------------
 * KNOWN CONSEQUENCE, AND IT IS WORTH READING BEFORE QUOTING FIREBALL.
 *
 * The shares are weighted by each half's COEFFICIENT -- which is to say by
 * DURATION -- and not by how much DAMAGE each half actually deals. Those come
 * apart when a big nuke leaves a token burn:
 *
 *   Fireball   483 direct + 60 over 8s   ->  0.652 direct, 0.186 over the DoT
 *
 * The burn is 11% of the spell's damage and takes 35% of its scaling, so
 * Fireball scales at 0.652 where a 3.5-second cast with no DoT would get the
 * full 1.0. Classic sidesteps this by giving Fireball's DoT no coefficient at
 * all and treating the spell as a pure nuke.
 *
 * LEFT AS THE RULE SAYS rather than special-cased, because the ruleset owner
 * chose the split knowing it applied to these spells, and a per-spell
 * exception is exactly the kind of invented content this project refuses. If
 * it should instead weight by damage share, or exempt a DoT below some
 * fraction of the whole, that is a change to THIS FUNCTION and nothing else.
 * ----------------------------------------------------------------------------
 */
export function hybridSpellCoefficients(
  castTimeMs: Milliseconds | undefined,
  baseDurationMs: Milliseconds,
  baseTicks: number,
): HybridSpellCoefficients {
  const direct = directSpellCoefficient(castTimeMs);
  // The effect's TOTAL, not one tick's: the shares are between the two halves
  // of the spell, and a tick count must not change how the cast is weighted.
  const dotTotal = periodicTickCoefficient(baseDurationMs, baseTicks) * baseTicks;

  const sum = direct + dotTotal;
  if (sum <= 0) return { direct: 0, perTick: 0 };

  const scaledDirect = direct * (direct / sum);
  const scaledDot = dotTotal * (dotTotal / sum);

  return {
    direct: scaledDirect,
    perTick: baseTicks > 0 ? scaledDot / baseTicks : 0,
  };
}
