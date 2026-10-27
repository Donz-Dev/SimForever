import type { Ability, Combatant, SimulationContext } from '../../engine';
import { applyHealing, dealDamage, seconds } from '../../engine';
import { areaTargets } from '../combat/multiTarget';
import {
  ELEMENTAL_MASTERY_AURA,
  FLAME_SHOCK_COEFFICIENTS,
  FLAME_SHOCK_DOT,
  flameShockDot,
  RAGE_OF_THE_FARSEER,
  SEARING_TOTEM_DOT,
  MAGMA_TOTEM_DOT,
  magmaTotemAura,
  STORMSTRIKE_DAMAGE_BONUS,
  STORMSTRIKE_DEBUFF,
  WINDFURY_WEAPON_IMBUE,
  FLAMETONGUE_WEAPON_IMBUE,
  MAIN_HAND_IMBUE_IDS,
  rockbiterWeaponImbue,
  ANCESTRAL_HEALING,
  MANA_TIDE,
  NATURES_SWIFTNESS,
  RIPTIDE_CHAIN_HEAL_BONUS,
  RIPTIDE_HOT,
  WATER_SHIELD,
  WATER_SHIELD_MANA_FRACTION,
} from '../auras/shaman';
import {
  CHAIN_LIGHTNING_SP_COEFFICIENT,
  EARTH_SHOCK_SP_COEFFICIENT,
  FIRE_NOVA_SP_COEFFICIENT,
  FROST_SHOCK_SP_COEFFICIENT,
  LAVA_BURST_SP_COEFFICIENT,
  LIGHTNING_BOLT_SP_COEFFICIENT,
  CHAIN_HEAL_HEAL_COEFFICIENT,
  HEALING_WAVE_HEAL_COEFFICIENT,
  LESSER_HEALING_WAVE_HEAL_COEFFICIENT,
  RIPTIDE_HEAL_COEFFICIENT,
} from '../combat/coefficients';
import { baseManaFor } from '../character';

/**
 * Shaman abilities, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * ----------------------------------------------------------------------------
 * THE SECOND CASTER, AND THE FIRST HYBRID THAT SPENDS ONE POOL ON BOTH HALVES.
 *
 * Enhancement pays mana for Stormstrike, its shocks and its weapon imbue while
 * swinging a two-hander, which no class here has done: a Warrior's rage and a
 * Rogue's energy both refill on their own, and a Moonkin casts until the bar
 * is empty and then stops. A Shaman that empties its bar keeps swinging, so
 * running dry costs it the abilities rather than the fight.
 *
 * EVERY NUKE SCALES NOW. The spell text still states flat damage -- "189 to
 * 211 Nature damage" -- and no coefficient, exactly as every Druid spell does;
 * the coefficient is the owner's universal `castTime / 3.5` RULE rather than
 * per-spell data. This file recorded the flat text as a FLOOR, which read the
 * data right and drew the wrong conclusion from it.
 *
 * IT MOVED THE ELEMENTAL SHAMAN 119.3 -> 279.0, which is the largest share of
 * any class here: it casts for a living and carries 453 spell power that used
 * to multiply nothing. Flame Shock is a hybrid; its pair is in
 * `auras/shaman.ts`.
 *
 * RESISTANCE IS RULED TO HAVE NO EFFECT on an enemy target, so these land for
 * full against a raid boss.
 *
 * NOT HERE, AND EACH FOR A STATED REASON:
 *
 *   TOTEMS       Magma Totem and Fire Nova. SEARING TOTEM IS NOW HERE, as a
 *                damage-over-time effect rather than an entity, by the ruleset
 *                owner's ruling -- which also supplied the attack interval and
 *                the coefficient this note used to say no source stated. Magma
 *                Totem still states none, and Fire Nova REQUIRES an active
 *                fire totem to go off at all. See docs.
 *   IMBUES       Windfury Weapon is here. Flametongue, Frostbrand and
 *                Rockbiter are not: Flametongue and Frostbrand scale their
 *                damage with weapon speed and state only a range, so the
 *                coefficient is missing, and Rockbiter's attack power is a
 *                threat imbue nothing here would choose.
 *   HEALS        Every Restoration spell. No Shaman profile heals.
 * ----------------------------------------------------------------------------
 */

const MAIN_HAND = 'mainHand' as const;
const PHYSICAL = 'physical' as const;

/** Said once, because every nuke in this file says it. */
/** The midpoint of a stated range. The combat table supplies the spread. */
const midpoint = (low: number, high: number) => (low + high) / 2;

/**
 * A Shaman's base mana, which a "% of base mana" cost is a share of.
 *
 * ONE RACE'S ROW, the arrangement `PALADIN_BASE_MANA` already uses: base mana
 * varies by race in `baseStats.ts` and a spell's cost does not, so the cost
 * has to be resolved against the CLASS rather than against whoever is casting
 * it. A Troll and a Tauren Shaman pay the same for Stormstrike.
 */
export const SHAMAN_BASE_MANA = baseManaFor('troll', 'shaman');

/** Costs stated as a share of base mana, resolved once. */
const shareOfBase = (fraction: number) => Math.round(SHAMAN_BASE_MANA * fraction);

/**
 * The max-rank cost, 35% off the capture's 485. See the ability.
 *
 * Named and rounded ONCE rather than written inline, so the arithmetic is
 * visible and the day the real figure arrives there is one line to change.
 */
export const CHAIN_LIGHTNING_MANA = Math.round(485 * (1 - 0.35));

/**
 * Spend Stormstrike's debuff, if it is up, and report the multiplier.
 *
 * Lightning Bolt, Chain Lightning and Earth Shock are the three spells the
 * tooltip names, and the debuff is consumed by whichever lands FIRST -- so
 * removing it here, in the cast that benefits, is the mechanic rather than
 * bookkeeping. See `STORMSTRIKE_DEBUFF` for why this is not a school
 * multiplier on the target.
 */
function spendStormstrike(simulation: SimulationContext, target: Combatant): number {
  if (!target.auras.has(STORMSTRIKE_DEBUFF.id)) return 1;
  target.auras.remove(simulation, STORMSTRIKE_DEBUFF.id);
  return STORMSTRIKE_DAMAGE_BONUS;
}

// ---------------------------------------------------------------------------
// Elemental
// ---------------------------------------------------------------------------

// Three figures from foreverchanges.pro against our capture at the same build:
// Lightning Bolt 185-207 (ours 189-211), Chain Lightning 116-130 (119-133) and
// Frost Shock 275-291 (278-294).
export const LIGHTNING_BOLT_DAMAGE = midpoint(185, 207);
export const LIGHTNING_BOLT_CAST_MS = seconds(2.5);
export const LIGHTNING_BOLT_COEFFICIENT = LIGHTNING_BOLT_SP_COEFFICIENT;

export const LIGHTNING_BOLT: Ability = {
  id: 'lightning_bolt',
  name: 'Lightning Bolt',
  cost: { resource: 'mana', amount: 220 },
  castTimeMs: LIGHTNING_BOLT_CAST_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'nature',
      baseAmount: LIGHTNING_BOLT_DAMAGE * spendStormstrike(simulation, target),
      powerCoefficient: LIGHTNING_BOLT_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
  /*
   * ITS `unmodelled` CAVEAT IS GONE, AND THE TALENT IT BELONGED TO IS WHY.
   * Lightning Bolt carried Maelstrom Weapon's "the proc chance is a
   * PLACEHOLDER" note, because the talent that discounts this spell had no
   * stated rate. The ruleset owner supplied five procs per minute on
   * 2026-09-30, so there is nothing left to caveat -- see
   * `MAELSTROM_WEAPON_PPM` in `reactions/shamanTalents.ts`.
   *
   * Removing it also broke a genuine import cycle: this file imported the
   * caveat string from `reactions/shamanTalents.ts`, which now imports this
   * file's damage constants for Lightning Overload.
   */
};

/**
 * Chain Lightning: "dealing 119 to 133 Nature damage and then jumping to
 * additional nearby enemies. Each jump reduces the damage by 30%. Affects 3
 * total targets."
 *
 * THE JUMPS LAND SINCE ROUND 57, on the owner's ask: the primary first, then up
 * to two more targets, each jump 30% less than the hit before -- x1, x0.7,
 * x0.49 -- on the flat damage AND the coefficient, since the reduction is to
 * "the damage". Each strike rolls its own spell table. At one target there is
 * nothing to jump to and the cast is exactly what it was.
 *
 * LIGHTNING OVERLOAD DUPLICATES THE WHOLE CHAIN (round 57c, the owner's ruling):
 * one roll per cast, and on a proc a second Chain Lightning at half damage with
 * the same jumps, no mana and no threat -- see `lightningOverload`. Elemental
 * Mastery removes this spell's cooldown while it is up -- see
 * `ELEMENTAL_MASTERY_AURA`.
 */
export const CHAIN_LIGHTNING_JUMP_FACTOR = 0.7;
/*
 * ==============================================================================
 * 116 TO 130 IS `foreverchanges.pro`'s FIGURE AND IT BEATS THE CAPTURE ABOVE,
 * WHICH IS WHY THIS DOES NOT SAY 119 TO 133.
 *
 * The owner's standing rule -- "when in doubt use foreverchanges.pro" -- and
 * `docs/source-cross-checks.md` records this exact row from the 2026-09-25
 * Shaman pass, beside Lightning Bolt's 185-207 and Frost Shock's 275-291 which
 * are resolved the same way. All three constants are the tie-break's figure and
 * not the capture's.
 *
 * ------------------------------------------------------------------------------
 * AND THIS CONSTANT WAS BRIEFLY SET TO THE CAPTURE'S MIDPOINT DURING THE
 * 1.60.1.70425 REFRESH, which is the failure this note exists to stop.
 *
 * The doc comment above states "119 to 133" because it quotes the CAPTURE, the
 * constant was 123 because it follows the RULING, and nothing between them said
 * so -- so a reader refreshing the captures finds a constant that disagrees
 * with the tooltip printed directly above it and reads 123 as drift. It is the
 * failure CLAUDE.md names in its own words: **a number that disagrees with the
 * checked-in capture must carry the ruling beside it, or the next person reads
 * it as drift.** The note was missing and the next person did.
 *
 * WHAT CAUGHT IT IS THAT LIGHTNING BOLT DID NOT MOVE. Its 196 is `midpoint(185,
 * 207)` against a capture reading 189-211, so the test asserting 196 passed on
 * the line above the one that failed -- two constants from one source where one
 * had been quietly switched to the other. **Two sibling figures resolved by the
 * same ruling, and only one of them moving, is the shape of a mistake.**
 *
 * THE COST IS A DIFFERENT QUESTION AND THE CAPTURE DOES WIN THERE: 485 to 315
 * at this build, which the cross-check pass never disputed -- it found every
 * cost, cast time and cooldown matching and only these damage ranges apart.
 * ==============================================================================
 */
export const CHAIN_LIGHTNING_DAMAGE = midpoint(116, 130);
export const CHAIN_LIGHTNING_TARGETS = 3;
export const CHAIN_LIGHTNING_CAST_MS = seconds(2);
export const CHAIN_LIGHTNING_COEFFICIENT = CHAIN_LIGHTNING_SP_COEFFICIENT;

export const CHAIN_LIGHTNING: Ability = {
  id: 'chain_lightning',
  name: 'Chain Lightning',
  /*
   * ==========================================================================
   * "CHAIN LIGHTNING: MANA COST REDUCED BY APPROXIMATELY 35% ON ALL FOUR
   * RANKS", AND "APPROXIMATELY" IS THE PROBLEM.
   *
   * 485 is the capture's own figure for the max rank, which is the only rank
   * this project casts -- `import_forever_spells.mjs` writes max rank by
   * construction. 35% off 485 is 315.25, and the note gives no exact value.
   *
   * 315 IS TAKEN AS THE ROUNDING OF A STATED PERCENTAGE RATHER THAN AS AN
   * INVENTED NUMBER, which is a distinction worth being careful about. The
   * note states an operation and an operand -- "reduced by approximately 35%"
   * applied to a cost this project has from the client -- so the arithmetic is
   * sourced even though the result is not quoted. That is different in kind
   * from Fire Nova's "significantly reduced", which states no operation at all
   * and is therefore left alone.
   *
   * AND THE BUILD HAS LANDED AND THE CAPTURE SAYS 315. This paragraph used to
   * end "a QUESTION FOR THE OWNER, and cheap to settle -- one re-read once the
   * build lands", because "approximately 35%" off 485 is 315.25 and Forever's
   * costs are round numbers. At 1.60.1.70425 the client's own figure is **315**,
   * so the derivation was exact and the flag comes off.
   *
   * **THE FLAG IS WHAT MADE IT CHECKABLE**, which is the half worth keeping: a
   * derived number with its derivation written beside it can be confirmed by a
   * later capture in one read. An undocumented 315 could not have been.
   * ==========================================================================
   */
  cost: { resource: 'mana', amount: CHAIN_LIGHTNING_MANA },
  castTimeMs: CHAIN_LIGHTNING_CAST_MS,
  cooldownMs: seconds(6),
  attackTable: 'spell',
  targets: { maxTargets: CHAIN_LIGHTNING_TARGETS },
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    areaTargets(simulation, caster, target, ability).forEach((struck, jump) => {
      const falloff = CHAIN_LIGHTNING_JUMP_FACTOR ** jump;
      dealDamage(simulation, {
        source: caster,
        target: struck,
        abilityId: ability.id,
        abilityName: ability.name,
        school: 'nature',
        baseAmount: CHAIN_LIGHTNING_DAMAGE * falloff * spendStormstrike(simulation, struck),
        powerCoefficient: CHAIN_LIGHTNING_COEFFICIENT * falloff,
        attackTable: ability.attackTable,
      });
    });
  },
};

/*
 * ============================================================================
 * THE THREE SHOCKS SHARE ONE COOLDOWN, and each having its own did not say so.
 *
 * The ruleset owner's ruling: "these do share a cooldown, but Flame Shock's
 * duration is long enough such that they can be alternated, therefore both
 * deserve to be on the list." Three independent six-second cooldowns let the
 * Enhancement list cast Flame Shock and Earth Shock in consecutive globals all
 * fight, which is a bigger number and looks exactly like a working rotation.
 *
 * The group's length is `cooldownMs` of whichever shock triggered it, and all
 * three are six seconds, so nothing else has to be said. This is the same
 * arrangement the Warrior's stances have and the same failure it was written
 * for: a per-ability cooldown does not stop the OTHER ability.
 * ============================================================================
 */
export const SHOCK_COOLDOWN_GROUP = 'shaman_shock';

export const EARTH_SHOCK_DAMAGE = midpoint(293, 309);
export const EARTH_SHOCK_COEFFICIENT = EARTH_SHOCK_SP_COEFFICIENT;

export const EARTH_SHOCK: Ability = {
  id: 'earth_shock',
  name: 'Earth Shock',
  cost: { resource: 'mana', amount: 450 },
  cooldownMs: seconds(6),
  cooldownGroup: SHOCK_COOLDOWN_GROUP,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'nature',
      baseAmount: EARTH_SHOCK_DAMAGE * spendStormstrike(simulation, target),
      powerCoefficient: EARTH_SHOCK_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
  unmodelled:
    'Its interrupt and school lockout do nothing: nothing the target does is ' +
    'a cast.',
};

export const FLAME_SHOCK_DIRECT = 166;

/**
 * Call of Flame's added burn duration, in SECONDS, handed to the cast.
 *
 * THE PRIEST HAS THE IDENTICAL THING -- `SWP_EXTRA_SECONDS_BONUS`, for Improved
 * Shadow Word: Pain -- so this is a second instance of a settled pattern rather
 * than a new shape, and `flameShockDot` takes the same unit its factory does.
 *
 * ==============================================================================
 * AN `abilityBonus` AND NOT AN AURA FIELD, because the number belongs to the
 * CHARACTER's talents and the aura is built per application. Mind Flay's
 * escalation and Wrack's Soul Siphon figures arrive the same way, and for the
 * same reason: `onCast` is the only place that has both the talent's value and
 * the aura it is about to apply.
 *
 * SECONDS, which is the unit the talent states, converted once here. Every
 * other time in this project below the UI is integer milliseconds, so the
 * conversion has exactly one site and `seconds()` does it.
 * ==============================================================================
 */
export const FLAME_SHOCK_EXTRA_DURATION_BONUS = 'flameShockExtraDurationSeconds';

export const FLAME_SHOCK: Ability = {
  id: 'flame_shock',
  name: 'Flame Shock',
  cost: { resource: 'mana', amount: 410 },
  cooldownMs: seconds(6),
  cooldownGroup: SHOCK_COOLDOWN_GROUP,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    // One roll decides both halves: whether the effect landed is settled by
    // the cast, and the burn does not re-roll the table.
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      baseAmount: FLAME_SHOCK_DIRECT,
      powerCoefficient: FLAME_SHOCK_COEFFICIENTS.direct,
      attackTable: ability.attackTable,
    });
    if (result.avoided) return;
    /*
     * CALL OF FLAME'S NINE SECONDS, read off the character rather than baked
     * into the definition. A build without the talent reads nothing and gets
     * the base twelve seconds, which is what `flameShockDot()` returns.
     */
    const extraSeconds = ability.bonuses?.[FLAME_SHOCK_EXTRA_DURATION_BONUS] ?? 0;
    simulation.applyAura(target, flameShockDot(extraSeconds), caster.id);
  },
};

export const FROST_SHOCK_DAMAGE = midpoint(275, 291);
export const FROST_SHOCK_COEFFICIENT = FROST_SHOCK_SP_COEFFICIENT;

export const FROST_SHOCK: Ability = {
  id: 'frost_shock',
  name: 'Frost Shock',
  cost: { resource: 'mana', amount: 430 },
  cooldownMs: seconds(6),
  cooldownGroup: SHOCK_COOLDOWN_GROUP,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'frost',
      baseAmount: FROST_SHOCK_DAMAGE,
      powerCoefficient: FROST_SHOCK_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
  unmodelled: 'Its slow does nothing; nothing here moves.',
};

/**
 * Lava Burst, granted by the 31-point Elemental talent.
 *
 * THE TALENT TOOLTIP SAYS 150 TO 192 AND THE SPELLBOOK SAYS 192 TO 248, and
 * they do not disagree: the talent shows RANK 1 and a level 60 trains rank 3.
 * The project rule, and the fourth time it has come up.
 *
 * THE TALENT'S FIGURE MOVED AT CLIENT BUILD 1.60.1.70170 AND THE SPELLBOOK'S DID
 * NOT -- rank 1 went 106-134 to 150-192 while rank 3 stayed at 192-248, which the
 * patch notes do not mention. So Forever buffed the low ranks and left the one
 * this project casts alone, and the figure here is unchanged. Recorded because
 * the two sources now look CLOSER together, and a reader who remembers the old
 * gap could easily read 192-248 as the talent's new number rather than the
 * spellbook's unchanged one.
 *
 * The Flame Shock clause is read off the target at cast time, which makes the
 * priority list's order load-bearing -- Flame Shock sits above it for exactly
 * this reason.
 */
export const LAVA_BURST_DAMAGE = midpoint(192, 248);
export const LAVA_BURST_FLAME_SHOCK_BONUS = 1.2;
export const LAVA_BURST_CAST_MS = seconds(2.5);
export const LAVA_BURST_COEFFICIENT = LAVA_BURST_SP_COEFFICIENT;

export const LAVA_BURST: Ability = {
  id: 'lava_burst',
  name: 'Lava Burst',
  cost: { resource: 'mana', amount: 265 },
  castTimeMs: LAVA_BURST_CAST_MS,
  cooldownMs: seconds(10),
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const burning = target.auras.has(FLAME_SHOCK_DOT.id);
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      baseAmount: LAVA_BURST_DAMAGE * (burning ? LAVA_BURST_FLAME_SHOCK_BONUS : 1),
      /*
       * THE FLAME SHOCK BONUS MULTIPLIES THE BASE AND NOT THE COEFFICIENT,
       * which is a choice and is stated because both readings are plausible.
       * "Deals 20% more damage if the target is affected by Flame Shock" is
       * read as a bonus to the spell's own damage; scaling the coefficient as
       * well would make the bonus grow with gear, which the tooltip does not
       * say.
       */
      powerCoefficient: LAVA_BURST_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
};

/*
 * ============================================================================
 * FIRE NOVA: "Instantly inflicts 413 to 459 fire damage to enemies within 10 yd
 * of your active Fire totem."
 *
 * 520 mana, instant, a 10 second cooldown, and `versusClassic: "new"` -- a spell
 * Forever added, which is why no Classic reading of it exists and why the
 * coefficient sheet has no row for it.
 *
 * ----------------------------------------------------------------------------
 * IT WAS BLOCKED ON THE WRONG THING FOR THE WHOLE PROJECT, and this is the
 * lesson worth keeping. Improved Fire Nova's `unmodelled` reason read "Fire Nova
 * requires an active fire totem to go off at all, so it is not an ability here"
 * and then cited the totems-are-not-entities gap -- which had ALREADY EXPIRED.
 * Searing Totem has been modelled since the owner ruled it a damage-over-time
 * effect "considered a totem for the purposes of other talents", and the
 * Enhancement priority list holds it up for 55 of every 60 seconds. The active
 * fire totem the spell needs has been there all along.
 *
 * What actually blocked it was the COEFFICIENT, which nobody had asked for. The
 * reason named the expensive blocker (an engine change shared with the Warlock
 * and the Mage) instead of the cheap one (one line from the owner), so the
 * talent sat in the queue behind work it did not need. CLAUDE.md's rule --
 * "check whether a missing number is missing DATA or a missing RULE before
 * recording it as a gap" -- is exactly this case, and it cost six talents'
 * worth of apparent queue.
 *
 * ----------------------------------------------------------------------------
 * THE FIRE TOTEM REQUIREMENT IS REAL AND IS `canCast`, NOT A COMMENT. Searing
 * Totem is the only fire totem in the book, so the requirement reduces to "is
 * the Searing Totem debuff on the target" -- and because the totem is modelled
 * as a debuff rather than as an entity, the question is asked of the TARGET and
 * not of the caster. A Shaman who has not cast Searing Totem cannot Fire Nova,
 * which is the behaviour the tooltip describes and is what makes the two entries
 * in the priority list ordered rather than independent.
 *
 * IT IS NOT A WEAPON USE AND ROLLS THE SPELL TABLE, so it can miss and it can
 * crit -- and Elemental Fury reaches its crit damage, because the ticks are Fire
 * and that talent is a school effect.
 * ============================================================================
 */
/*
 * 232 to 258 at build 1.60.1.70425, down from 413 to 459 -- a 44% cut, with the
 * cost falling 520 to 375 beside it. Fire Nova is in no priority list, every
 * encounter here having one target, so this moves no figure: what changes is
 * what the number MEANS the day a multi-target encounter exists.
 */
export const FIRE_NOVA_DAMAGE = midpoint(232, 258);
export const FIRE_NOVA_COOLDOWN_MS = seconds(10);
export const FIRE_NOVA_COEFFICIENT = FIRE_NOVA_SP_COEFFICIENT;

/** Every fire totem this class has: Searing, and Magma since round 57. */
export const FIRE_TOTEM_AURA_IDS: readonly string[] = [SEARING_TOTEM_DOT.id, MAGMA_TOTEM_DOT.id];

/** Whether any fire totem of this caster's is up on the target. */
function fireTotemActive(target: Combatant | undefined): boolean {
  if (!target) return false;
  return FIRE_TOTEM_AURA_IDS.some((id) => target.auras.has(id));
}

export const FIRE_NOVA: Ability = {
  id: 'fire_nova',
  name: 'Fire Nova',
  cost: { resource: 'mana', amount: 375 },
  cooldownMs: FIRE_NOVA_COOLDOWN_MS,
  attackTable: 'spell',
  requiresTarget: true,
  // "to enemies within 10 yd of your active Fire totem": every target (round 57).
  targets: { maxTargets: Infinity },
  canCast: ({ target }) => fireTotemActive(target),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    for (const struck of areaTargets(simulation, caster, target, ability)) {
      dealDamage(simulation, {
        source: caster,
        target: struck,
        abilityId: ability.id,
        abilityName: ability.name,
        school: 'fire',
        baseAmount: FIRE_NOVA_DAMAGE,
        powerCoefficient: FIRE_NOVA_COEFFICIENT,
        attackTable: ability.attackTable,
      });
    }
  },
  unmodelled:
    'Its 10 yard radius is dropped with every other distance, so it strikes ' +
    'every target in the fight.',
};

// ---------------------------------------------------------------------------
// Enhancement
// ---------------------------------------------------------------------------

/**
 * Stormstrike, granted by the Enhancement talent.
 *
 * "Instantly strike for normal weapon damage" -- ONE STRIKE, with the main
 * hand, which is what the singular says. Classic's version hits with both
 * weapons; Forever's wording does not, and a Shaman here carries a two-hander
 * in any case, so the two readings agree for both profiles in the project.
 *
 * IT IS A MAIN-HAND USE. It goes through a melee combat table and needs the
 * weapon, so `isWeaponUse` counts it and Windfury Weapon can proc from it --
 * the ruleset owner's rule, applied rather than re-derived.
 */
export const STORMSTRIKE: Ability = {
  id: 'stormstrike',
  name: 'Stormstrike',
  /*
   * EIGHT PERCENT OF BASE MANA, WHERE IT WAS A FLAT 125.
   *
   * "Stormstrike's cost changed to 8% of Base Mana (was 125 Mana at all points
   * in the game)" -- and the note's parenthetical matches both this file and
   * the spellbook capture exactly, which is what makes it a clean change.
   *
   * IT IS A RISE HERE, which is worth stating because "a percentage of base
   * mana" reads as a scaling convenience rather than as a nerf: a Shaman's base
   * mana at 60 puts 8% well above 125, so Enhancement pays more per Stormstrike
   * than it did. The Enhancement list casts it on cooldown, so what this costs
   * is sustain rather than casts -- `probe_resources.ts` is where that shows.
   */
  cost: { resource: 'mana', amount: shareOfBase(0.08) },
  cooldownMs: seconds(8),
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: 0,
      weaponScaling: { slot: MAIN_HAND, normalized: true },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
    // The debuff rides on a strike that CONNECTED. A dodged Stormstrike
    // buffs nothing, which is what "when you Stormstrike" has to mean.
    if (!result.avoided) simulation.applyAura(target, STORMSTRIKE_DEBUFF, caster.id);
  },
};

/**
 * Windfury Weapon, the imbue.
 *
 * Cast once, at the pull, for one global cooldown and 165 mana; it then lasts
 * an hour. It is in the priority list rather than assumed, because a global
 * cooldown spent is a global cooldown spent and the alternative is a free
 * buff.
 *
 * Casting it again while it is up would be a wasted cast, so `canCast` refuses
 * -- which is what keeps a priority list from sitting on it forever.
 */
export const WINDFURY_WEAPON: Ability = {
  id: 'windfury_weapon',
  name: 'Windfury Weapon',
  cost: { resource: 'mana', amount: 165 },
  canCast: ({ caster }) => !caster.auras.has(WINDFURY_WEAPON_IMBUE.id),
  onCast: ({ simulation, caster }) => {
    replaceImbue(simulation, caster, WINDFURY_WEAPON_IMBUE.id);
    simulation.applyAura(caster, WINDFURY_WEAPON_IMBUE, caster.id);
  },
  /*
   * NO `unmodelled` ANY MORE. It read "disables any benefit the caster
   * personally receives from Windfury Totem ... selecting both overstates" --
   * and `windfuryTotemReaction` has refused while the imbue is up since every
   * raid buff was ticked on every profile. A caveat about a rule the engine
   * enforces is a caveat that is false.
   */
};

/**
 * One weapon holds one imbue, so a new one takes the old one's place.
 *
 * Removed here rather than by `canCast` refusing, because the owner's three
 * combinations are a CHOICE between imbues and a character re-imbuing with a
 * different one is the choice being made.
 */
function replaceImbue(
  simulation: Parameters<NonNullable<Ability['onCast']>>[0]['simulation'],
  caster: Parameters<NonNullable<Ability['onCast']>>[0]['caster'],
  keep: string,
): void {
  for (const id of MAIN_HAND_IMBUE_IDS) {
    if (id !== keep && caster.auras.has(id)) caster.auras.remove(simulation, id);
  }
}

/** The key Elemental Weapons writes its figure under, on both imbues it raises. */
export const ELEMENTAL_WEAPONS_BONUS = 'elementalWeaponsPercent';

/**
 * Flametongue Weapon, the imbue: "Each hit causes 35 to 112 additional Fire
 * damage, based on the speed of the weapon ... When applied to main hand,
 * disables any benefit you personally receive from Flametongue Totem. Lasts
 * for 60 minutes." 155 mana.
 *
 * The damage is `flametongueWeaponReaction`'s. One of three main-hand imbues;
 * casting it takes the place of whichever was up.
 */
export const FLAMETONGUE_WEAPON: Ability = {
  id: 'flametongue_weapon',
  name: 'Flametongue Weapon',
  cost: { resource: 'mana', amount: 155 },
  canCast: ({ caster }) => !caster.auras.has(FLAMETONGUE_WEAPON_IMBUE.id),
  onCast: ({ simulation, caster }) => {
    replaceImbue(simulation, caster, FLAMETONGUE_WEAPON_IMBUE.id);
    simulation.applyAura(caster, FLAMETONGUE_WEAPON_IMBUE, caster.id);
  },
};

/**
 * Rockbiter Weapon, the imbue: +653 melee attack power for 60 minutes, 150
 * mana. Its threat clause is out of scope.
 */
export const ROCKBITER_WEAPON: Ability = {
  id: 'rockbiter_weapon',
  name: 'Rockbiter Weapon',
  cost: { resource: 'mana', amount: 150 },
  canCast: ({ caster }) => !caster.auras.has('rockbiter_weapon'),
  onCast: ({ simulation, caster, ability }) => {
    replaceImbue(simulation, caster, 'rockbiter_weapon');
    simulation.applyAura(
      caster,
      rockbiterWeaponImbue(ability.bonuses?.[ELEMENTAL_WEAPONS_BONUS] ?? 0),
      caster.id,
    );
  },
};

/**
 * Rage of the Farseer, granted by the 31-point Enhancement talent.
 *
 * Off the global cooldown is NOT claimed: the spellbook says "Instant" and
 * says nothing about the global cooldown, so it takes one like every other
 * instant here.
 */
export const RAGE_OF_THE_FARSEER_ABILITY: Ability = {
  id: 'rage_of_the_farseer',
  // A spell with no cost and no table: its GCD is hasted (round 81).
  spell: true,
  name: 'Rage of the Farseer',
  cooldownMs: seconds(180),
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, RAGE_OF_THE_FARSEER, caster.id);
  },
};

/**
 * Searing Totem: "Summons a Searing Totem with 5 health at your feet for 55 sec
 * that repeatedly attacks an enemy within 20 yards for 40 to 54 Fire damage."
 *
 * Modelled as a damage-over-time effect by the ruleset owner's ruling rather
 * than as an entity -- the reasoning, the cadence and the coefficient are all
 * on `SEARING_TOTEM_DOT`, and the cadence and coefficient are the owner's
 * because no source states either.
 *
 * NOT A WEAPON USE and not a spell hit: the totem's damage is applied by an
 * aura, so the CAST rolls nothing and the ticks do their own rolling. That is
 * why the ability declares no `attackTable`.
 */
export const SEARING_TOTEM: Ability = {
  id: 'searing_totem',
  name: 'Searing Totem',
  cost: { resource: 'mana', amount: 170 },
  requiresTarget: true,
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;
    // ONE FIRE TOTEM AT A TIME (round 57): placing this one takes Magma Totem
    // down, off every target. Silent when none is up, so no log moves.
    for (const enemy of simulation.enemiesOf(caster)) {
      enemy.auras.remove(simulation, MAGMA_TOTEM_DOT.id);
    }
    simulation.applyAura(target, SEARING_TOTEM_DOT, caster.id);
  },
  unmodelled:
    'The totem itself is not an entity: it has 5 health and can be killed in ' +
    'game, and here it is a damage-over-time effect that cannot be targeted. ' +
    'Its 20 yard range is dropped with every other distance.',
};

/**
 * Elemental Mastery: the Elemental capstone, and a three minute cooldown.
 *
 * ==============================================================================
 * NEW AT CLIENT BUILD 1.60.1.70425, replacing Call of Thunder in the tree and
 * taking Lava Burst's place as the 31-point talent -- Lava Burst moved to row 4
 * and lost its Lightning Overload prerequisite in the same patch.
 *
 * WHAT IT DOES IS ON THE AURA, which is where the two live clauses are. See
 * `ELEMENTAL_MASTERY_AURA`.
 *
 * IT TAKES A GLOBAL COOLDOWN, which is the DEFAULT rather than a decision: the
 * capture states no cost and no cast time and says nothing about the global
 * cooldown, and this project has four other instants in exactly that position.
 * Rage of the Farseer's own note says the same thing in the same words. **The
 * owner has ruled several cooldowns off the GCD individually**, so if this is
 * one of them it is one line -- and guessing it would be worth free uptime
 * nobody granted.
 * ==============================================================================
 */
export const ELEMENTAL_MASTERY_COOLDOWN_MS = seconds(180);

export const ELEMENTAL_MASTERY: Ability = {
  id: 'elemental_mastery',
  // A spell with no cost and no table: its GCD is hasted (round 81).
  spell: true,
  name: 'Elemental Mastery',
  cooldownMs: ELEMENTAL_MASTERY_COOLDOWN_MS,
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, ELEMENTAL_MASTERY_AURA, caster.id);
  },
};

/**
 * Magma Totem: 650 mana, instant, and every target carries its pulse (round
 * 53). ONE FIRE TOTEM AT A TIME, so it takes Searing Totem down first -- and
 * it is a fire totem for Fire Nova's requirement. The totem itself is not an
 * entity, as Searing Totem's is not.
 */
/** The key Trial by Fire writes on Magma Totem: extra seconds of totem. */
export const MAGMA_TOTEM_EXTRA_DURATION_BONUS = 'magmaTotemExtraDurationSeconds';

export const MAGMA_TOTEM: Ability = {
  id: 'magma_totem',
  name: 'Magma Totem',
  cost: { resource: 'mana', amount: 650 },
  requiresTarget: true,
  targets: { maxTargets: Infinity },
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    for (const enemy of simulation.enemiesOf(caster)) {
      enemy.auras.remove(simulation, SEARING_TOTEM_DOT.id);
    }
    // Trial by Fire's extra seconds arrive on the ability, Flame Shock's way.
    const aura = magmaTotemAura(ability.bonuses?.[MAGMA_TOTEM_EXTRA_DURATION_BONUS] ?? 0);
    for (const struck of areaTargets(simulation, caster, target, ability)) {
      simulation.applyAura(struck, aura, caster.id);
    }
  },
  unmodelled: 'The totem is not an entity and cannot be killed.',
};

/* -------------------------------------------------------------------------- */
/* Restoration (round 60): the Piss Beam profile's spells                     */
/* -------------------------------------------------------------------------- */

/**
 * The key an Ancestral Healing rank is carried under, on each heal it reaches.
 * Set by the talent; read by `shamanHeal`.
 */
export const ANCESTRAL_HEALING_KEY = 'ancestralHealing';

/**
 * Every Shaman heal goes through here, so its two crit riders cannot be
 * forgotten by one of them:
 *
 *   WATER SHIELD   2% of maximum mana on a HEALING SPELL crit -- the owner's,
 *                  and "not Riptide HoT effect", so only a DIRECT heal counts
 *   ANCESTRAL      the healed target carries Ancestral Healing for 15 seconds
 *   HEALING        after a direct crit, when the talent is taken -- tracked as
 *                  an uptime on its own, by the owner's instruction
 *
 * Each crit is its own: a Chain Heal that crits on two of its three targets
 * restores mana twice. The client's "only one globe every few seconds" is not
 * in the owner's statement.
 */
export function shamanHeal(
  simulation: SimulationContext,
  caster: Combatant,
  target: Combatant,
  ability: Ability,
  amount: number,
  coefficient: number,
): void {
  const result = applyHealing(simulation, {
    source: caster,
    target,
    abilityId: ability.id,
    abilityName: ability.name,
    baseAmount: amount,
    powerCoefficient: coefficient,
    threatens: true,
  });
  if (!result.critical) return;
  if (caster.auras.has(WATER_SHIELD.id)) {
    const mana = caster.resources.get('mana');
    if (mana) {
      simulation.grantResource(caster, 'mana', mana.maximum * WATER_SHIELD_MANA_FRACTION, {
        id: WATER_SHIELD.id,
        name: WATER_SHIELD.name,
      });
    }
  }
  if ((ability.bonuses?.[ANCESTRAL_HEALING_KEY] ?? 0) > 0) {
    simulation.applyAura(target, ANCESTRAL_HEALING, caster.id);
  }
}

const isFriendly = (caster: Combatant, target: Combatant | undefined): target is Combatant =>
  target !== undefined && !target.isHostileTo(caster);

/** Lesser Healing Wave, rank 6: "Heals a friendly target for 775 to 865." 380 mana, 1.5s. */
export const LESSER_HEALING_WAVE_HEAL = midpoint(775, 865);

export const LESSER_HEALING_WAVE: Ability = {
  id: 'lesser_healing_wave',
  name: 'Lesser Healing Wave',
  heals: true,
  cost: { resource: 'mana', amount: 380 },
  castTimeMs: seconds(1.5),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!isFriendly(caster, target)) return;
    shamanHeal(simulation, caster, target, ability, LESSER_HEALING_WAVE_HEAL, LESSER_HEALING_WAVE_HEAL_COEFFICIENT);
  },
};

/** Healing Wave, rank 10: "Heals a friendly target for 1,508 to 1,722." 620 mana, 3s. */
export const HEALING_WAVE_HEAL = midpoint(1508, 1722);

export const HEALING_WAVE: Ability = {
  id: 'healing_wave',
  name: 'Healing Wave',
  heals: true,
  cost: { resource: 'mana', amount: 620 },
  castTimeMs: seconds(3),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!isFriendly(caster, target)) return;
    shamanHeal(simulation, caster, target, ability, HEALING_WAVE_HEAL, HEALING_WAVE_HEAL_COEFFICIENT);
  },
};

/**
 * Chain Heal, rank 3: "Heals the friendly target for 474 to 538, then jumps to
 * heal additional nearby targets. If cast on a party member, the heal will only
 * jump to other party members. Each jump is 50% as effective as the previous
 * target. Heals 3 total targets." 405 mana, 2.5s.
 *
 * ============================================================================
 * THE JUMPS ARE THE OWNER'S RULE (round 60): to the LOWEST health percentage
 * among the INJURED members of the target's party, one at a time -- "if there
 * are not 3 injured targets in the party, then it will only jump once or not at
 * all." A member at full is never jumped to, and nobody is healed twice.
 *
 * +25% ON A RIPTIDE TARGET, and only on the target it is cast at: Riptide
 * improves "your Chain Heal casts DIRECTLY on that target". The jumps start
 * from that figure and halve it, so they collect the bonus too -- each jump is
 * 50% of the PREVIOUS target's heal.
 * ============================================================================
 */
export const CHAIN_HEAL_HEAL = midpoint(474, 538);
export const CHAIN_HEAL_TARGETS = 3;
export const CHAIN_HEAL_JUMP_FACTOR = 0.5;

export const CHAIN_HEAL: Ability = {
  id: 'chain_heal',
  name: 'Chain Heal',
  heals: true,
  cost: { resource: 'mana', amount: 405 },
  castTimeMs: seconds(2.5),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!isFriendly(caster, target)) return;
    const riptide = target.auras.get(RIPTIDE_HOT.id)?.sourceId === caster.id;
    let factor = riptide ? RIPTIDE_CHAIN_HEAL_BONUS : 1;
    const healed = new Set<string>([target.id]);
    shamanHeal(simulation, caster, target, ability, CHAIN_HEAL_HEAL * factor, CHAIN_HEAL_HEAL_COEFFICIENT * factor);
    if (target.party === undefined) return;
    for (let jump = 1; jump < CHAIN_HEAL_TARGETS; jump++) {
      const next = simulation.combatants
        .filter(
          (other) =>
            other !== caster &&
            !healed.has(other.id) &&
            other.party === target.party &&
            other.isAlive &&
            !other.isHostileTo(caster) &&
            other.health.current < other.health.maximum,
        )
        .reduce<Combatant | undefined>(
          (lowest, other) =>
            lowest === undefined ||
            other.health.current / other.health.maximum < lowest.health.current / lowest.health.maximum
              ? other
              : lowest,
          undefined,
        );
      if (!next) return;
      factor *= CHAIN_HEAL_JUMP_FACTOR;
      healed.add(next.id);
      shamanHeal(simulation, caster, next, ability, CHAIN_HEAL_HEAL * factor, CHAIN_HEAL_HEAL_COEFFICIENT * factor);
    }
  },
};

/**
 * Riptide, rank 3, granted by the Restoration talent: "Heals a friendly target
 * for 799 to 883, an additional 805 over 15 sec, and increases the
 * effectiveness of your Chain Heal casts directly on that target by 25%." 385
 * mana, instant, a 6 second cooldown. 21.4% of healing power on the hit, the
 * owner's; the heal over time is `RIPTIDE_HOT`.
 */
export const RIPTIDE_HEAL = midpoint(799, 883);

export const RIPTIDE: Ability = {
  id: 'riptide',
  name: 'Riptide',
  heals: true,
  cost: { resource: 'mana', amount: 385 },
  cooldownMs: seconds(6),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!isFriendly(caster, target)) return;
    shamanHeal(simulation, caster, target, ability, RIPTIDE_HEAL, RIPTIDE_HEAL_COEFFICIENT);
    simulation.applyAura(target, RIPTIDE_HOT, caster.id);
  },
};

/** Mana Tide Totem, rank 4, granted by the talent: 60 mana, instant, 5 minutes. */
export const MANA_TIDE_TOTEM: Ability = {
  id: 'mana_tide_totem',
  name: 'Mana Tide Totem',
  cost: { resource: 'mana', amount: 60 },
  cooldownMs: seconds(300),
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, MANA_TIDE, caster.id);
  },
};

/**
 * Nature's Swiftness, granted by the talent: instant, off the global cooldown,
 * three minutes. Its charge is the aura's -- see `NATURES_SWIFTNESS`.
 */
export const NATURES_SWIFTNESS_ABILITY: Ability = {
  id: 'nature_s_swiftness',
  name: "Nature's Swiftness",
  cooldownMs: seconds(180),
  triggersGcd: false,
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, NATURES_SWIFTNESS, caster.id);
  },
};

/** Water Shield, granted by the talent: instant, ten minutes, cast before the pull. */
export const WATER_SHIELD_ABILITY: Ability = {
  id: 'water_shield',
  // A spell with no cost and no table: its GCD is hasted (round 81).
  spell: true,
  name: 'Water Shield',
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, WATER_SHIELD, caster.id);
  },
};

export const SHAMAN_ABILITIES: readonly Ability[] = [
  MAGMA_TOTEM,
  LIGHTNING_BOLT,
  ELEMENTAL_MASTERY,
  CHAIN_LIGHTNING,
  EARTH_SHOCK,
  FLAME_SHOCK,
  FROST_SHOCK,
  LAVA_BURST,
  FIRE_NOVA,
  STORMSTRIKE,
  WINDFURY_WEAPON,
  FLAMETONGUE_WEAPON,
  ROCKBITER_WEAPON,
  RAGE_OF_THE_FARSEER_ABILITY,
  SEARING_TOTEM,
  LESSER_HEALING_WAVE,
  HEALING_WAVE,
  CHAIN_HEAL,
  RIPTIDE,
  MANA_TIDE_TOTEM,
  NATURES_SWIFTNESS_ABILITY,
  WATER_SHIELD_ABILITY,
];
