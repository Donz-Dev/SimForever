import type { Ability, Combatant } from '../../engine';
import { dealDamage, seconds } from '../../engine';
import { baseManaFor } from '../character/baseStatLookup';
import {
  arcaneBlastAura,
  ARCANE_BLAST_UNMODELLED,
  ARCANE_POWER,
  COMBUSTION,
  FIREBALL_CAST_MS,
  FIREBALL_COEFFICIENTS,
  FIREBALL_DOT,
  EVOCATION_AURA,
  EVOCATION_CHANNEL_MS,
  FROSTFIRE_ALSO_COUNTS_AS,
  FROSTFIRE_CAST_MS,
  FROSTFIRE_COEFFICIENTS,
  FROSTFIRE_DOT,
  FINGERS_OF_FROST,
  MAGE_ARMOR,
  ICE_BARRIER,
  MAGE_ARMOR_MAGIC_RESISTANCE,
  PRESENCE_OF_MIND,
  PYROBLAST_CAST_MS,
  PYROBLAST_COEFFICIENTS,
  PYROBLAST_DOT,
} from '../auras/mage';
import {
  ARCANE_WRATH_SP_COEFFICIENT,
  ARCANE_BLAST_SP_COEFFICIENT,
  ARCANE_MISSILES_TICK_SP_COEFFICIENT,
  BLAST_WAVE_SP_COEFFICIENT,
  CONE_OF_COLD_SP_COEFFICIENT,
  FIRE_BLAST_SP_COEFFICIENT,
  FROSTBOLT_SP_COEFFICIENT,
  ICE_LANCE_SP_COEFFICIENT,
  SCORCH_SP_COEFFICIENT,
} from '../combat/coefficients';

/**
 * Mage abilities, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * ----------------------------------------------------------------------------
 * THE THIRD CASTER, AND THE FIRST TO NEED ENGINE WORK. Two rules arrived
 * before it and both are general: per-SCHOOL modifiers, because six Mage
 * talents read "your Fire spells" rather than naming an ability, and CHANNELLED
 * casts, because Arcane Missiles is the Arcane build's core spender.
 *
 * EVERY NUKE NOW SCALES, and the rule came from the ruleset owner rather than
 * from the spell data: `castTime / 3.5` of the character's spell power, added
 * to the flat damage the source states. The data is unchanged -- it still
 * gives "425 to 541 Fire damage" and no coefficient -- but the coefficient is
 * a RULE and it is universal, so it does not need to be stated per spell. See
 * `game/combat/spellCoefficient.ts`.
 *
 * THREE OF THESE ARE HYBRIDS and their pairs live in `auras/mage.ts`, beside
 * the burn each one leaves: Fireball, Pyroblast and Frostfire Bolt share one
 * spell's scaling between the hit and the DoT rather than taking both.
 *
 * NOTHING FREEZES A RAID BOSS, AND IT COSTS THE FROSTFIRE BUILD NOTHING. This
 * said "three talents" for a long time and the number was never re-read:
 * `FROZEN_UNMODELLED` is carried by Frostbite alone now, and the 0/29/22 build
 * does not take Frostbite. Ice Lance and Shatter both reach their Frozen
 * clauses through Fingers of Frost, which does not freeze the target -- it
 * makes the caster's next spells behave as though it were, which is a state on
 * the MAGE and is reachable exactly as written.
 * ----------------------------------------------------------------------------
 */

/** The midpoint of a stated range. The combat table supplies the spread. */
const midpoint = (low: number, high: number) => (low + high) / 2;

/**
 * A Mage's base mana, which is what a "% of base mana" cost is a share of.
 *
 * BASE MANA IS A CLASS CONSTANT, not a character one: it is the same 933 for
 * every race, and intellect is added on top of it to make the pool. So the
 * cost can be resolved here rather than per character, and a test pins the
 * race-independence rather than trusting it.
 */
export const MAGE_BASE_MANA = baseManaFor('gnome', 'mage');

// ---------------------------------------------------------------------------
// Fire
// ---------------------------------------------------------------------------

export const FIREBALL_DAMAGE = midpoint(425, 541);

export const FIREBALL: Ability = {
  id: 'fireball',
  name: 'Fireball',
  cost: { resource: 'mana', amount: 410 },
  castTimeMs: FIREBALL_CAST_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      baseAmount: FIREBALL_DAMAGE,
      // The hit's share of the pair. NOT `directSpellCoefficient(3.5s)`: the
      // burn takes the rest, and the two come out of one call so they cannot
      // be weighted against different assumptions.
      powerCoefficient: FIREBALL_COEFFICIENTS.direct,
      attackTable: ability.attackTable,
    });
    if (!result.avoided) simulation.applyAura(target, FIREBALL_DOT, caster.id);
  },
};

// 163 to 193 from foreverchanges.pro; our capture says 166 to 196 at the same
// rank 7 and build. Same for Fire Blast and Ice Lance below.
export const SCORCH_DAMAGE = midpoint(163, 193);
export const SCORCH_CAST_MS = seconds(1.5);
export const SCORCH_COEFFICIENT = SCORCH_SP_COEFFICIENT;

export const SCORCH: Ability = {
  id: 'scorch',
  name: 'Scorch',
  cost: { resource: 'mana', amount: 150 },
  castTimeMs: SCORCH_CAST_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      baseAmount: SCORCH_DAMAGE,
      powerCoefficient: SCORCH_COEFFICIENT,
      attackTable: ability.attackTable,
    });
    /*
     * IMPROVED SCORCH'S VULNERABILITY IS APPLIED BY A REACTION, not here. The
     * talent gives it a chance and a magnitude, and an ability that applied it
     * unconditionally would hand an untalented mage the debuff for free.
     */
  },
};

export const PYROBLAST_DAMAGE = midpoint(520, 646);

export const PYROBLAST: Ability = {
  id: 'pyroblast',
  name: 'Pyroblast',
  cost: { resource: 'mana', amount: 440 },
  castTimeMs: PYROBLAST_CAST_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      baseAmount: PYROBLAST_DAMAGE,
      powerCoefficient: PYROBLAST_COEFFICIENTS.direct,
      attackTable: ability.attackTable,
    });
    if (!result.avoided) simulation.applyAura(target, PYROBLAST_DOT, caster.id);
  },
};

export const FIRE_BLAST_DAMAGE = midpoint(402, 474);
/** Instant, so 1.5 / 3.5 by the owner's own wording. */
export const FIRE_BLAST_COEFFICIENT = FIRE_BLAST_SP_COEFFICIENT;

export const FIRE_BLAST: Ability = {
  id: 'fire_blast',
  name: 'Fire Blast',
  cost: { resource: 'mana', amount: 340 },
  cooldownMs: seconds(8),
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      baseAmount: FIRE_BLAST_DAMAGE,
      powerCoefficient: FIRE_BLAST_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
};

/**
 * Blast Wave, granted by the Fire talent.
 *
 * AN AREA EFFECT ON A SINGLE TARGET. It lands in full on the one enemy there
 * is, which is correct for that enemy and says nothing about what the spell is
 * worth in a pull of five. The talent tooltip's 154 to 184 is rank 1; a level
 * 60 trains rank 5.
 */
export const BLAST_WAVE_DAMAGE = midpoint(453, 533);
export const BLAST_WAVE_COEFFICIENT = BLAST_WAVE_SP_COEFFICIENT;

export const BLAST_WAVE: Ability = {
  id: 'blast_wave',
  name: 'Blast Wave',
  cost: { resource: 'mana', amount: 545 },
  cooldownMs: seconds(45),
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      baseAmount: BLAST_WAVE_DAMAGE,
      powerCoefficient: BLAST_WAVE_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
  unmodelled:
    'It is an AREA effect and lands on the one target this project has, so ' +
    'its value in a pull of several is not shown.',
};

/**
 * Combustion, granted by the Fire capstone.
 *
 * ----------------------------------------------------------------------------
 * APPLIED AT ONE STACK, WHICH IS THE RAMP STARTING. It used to be applied at
 * FULL stacks -- ten at once, worth +100% crit to every school, for a
 * placeholder thirty seconds -- because nothing counted Fire spell hits and
 * nothing counted the four crits that end it. `combustionCounter` in
 * `reactions/mageTalents.ts` counts both now, so the ability does the one thing
 * the tooltip gives it: switch the effect on.
 *
 * THE FIRST STACK IS THE CAST'S OWN, and not a hit's. "When activated, this
 * spell causes each of your Fire damage spell hits to increase..." describes an
 * effect that exists before the first hit, and an aura cannot be applied at
 * zero stacks. So the Fire spell cast immediately after Combustion already
 * carries 10%, and each hit after it adds another.
 * ----------------------------------------------------------------------------
 */
export const COMBUSTION_ABILITY: Ability = {
  /*
   * ==========================================================================
   * OFF THE GLOBAL COOLDOWN, ON THE OWNER'S RULING: "Combustion is off the
   * GCD."
   *
   * IT IS THE THIRD MAGE ABILITY OF ONE SHAPE AND THE LAST TO BE ASKED ABOUT.
   * Their earlier ruling named the other two -- "Ensure Presence of Mind and
   * Arcane Power don't trigger a global cooldown" -- and in
   * `src/data/abilities/forever-mage-spellbook.json` all three are the same
   * row: no cost, "Instant", "3 min cooldown", no rank, each granted by a
   * capstone. Combustion was not named because that ruling arrived as an audit
   * of the ARCANE profile and Combustion is in the FIRE list.
   *
   * SO WAITING TO BE TOLD WAS RIGHT AND IT WAS NOT FREE. A ruling covers what
   * it says and is not extended by analogy -- the rule that made waiting for
   * Explosive Trap correct -- and the price of waiting here was one release in
   * which the Fire Mage paid a global cooldown it should not have. The
   * alternative was changing a ruleset fact on an inference, which is failure
   * mode 4 in CLAUDE.md: asking what the engine allows instead of what the
   * rules of the game are.
   *
   * WORTH **+24.93 +/- 4.21** AT 60s AND **+5.58 +/- 3.76** AT 180s, measured
   * before the ruling with the flag flipped at runtime between two paired
   * samplings. It falls with fight length because the saved global cooldown is
   * one of fewer and fewer, and because the build is mana bound by then.
   *
   * AND IT DECLARES A `cooldownMs`, which is not incidental:
   * `freeCastChain.test.ts` asserts across all nine classes that every off-GCD
   * ability has one, because an off-GCD ability with no cooldown would win the
   * list forever and HANG a fight rather than fail one.
   *
   * BEING OFF IT MEANS ONE THING -- the ability does not START a global
   * cooldown. It is still BLOCKED by one running, and what it buys is that the
   * action AFTER it is free, which is what makes the potion that waits for this
   * window resolve in the same instant rather than a global cooldown later.
   * ==========================================================================
   */
  id: 'combustion',
  name: 'Combustion',
  cooldownMs: seconds(180),
  triggersGcd: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, COMBUSTION, caster.id);
  },
};

// ---------------------------------------------------------------------------
// Frost
// ---------------------------------------------------------------------------

export const FROSTBOLT_DAMAGE = midpoint(457, 493);
export const FROSTBOLT_CAST_MS = seconds(3);
export const FROSTBOLT_COEFFICIENT = FROSTBOLT_SP_COEFFICIENT;

export const FROSTBOLT: Ability = {
  id: 'frostbolt',
  name: 'Frostbolt',
  cost: { resource: 'mana', amount: 290 },
  castTimeMs: FROSTBOLT_CAST_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'frost',
      baseAmount: FROSTBOLT_DAMAGE,
      powerCoefficient: FROSTBOLT_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
  unmodelled: 'Its slow does nothing; nothing here moves.',
};

/**
 * Frostfire Bolt: "counts as both Frost and Fire damage".
 *
 * DEALT AS FIRE, and stated rather than silently chosen. A `DamageRequest`
 * carries one school, and Fire is the one that matters to both builds that
 * cast this: Improved Fireball names Frostfire Bolt explicitly and Fire Power
 * covers it, while Piercing Ice does not name it at all.
 *
 * The resist clause -- "checked against the lower of the target's Frost and
 * Fire resists" -- is the Fire resistance the pipeline already reads, because
 * a raid boss has none in either school (round 46) and the lower of two zeros
 * is the Fire one. A target resistant in one school would need the clause
 * built; nothing reaches that today.
 */
export const FROSTFIRE_BOLT_DAMAGE = midpoint(270, 314);

export const FROSTFIRE_BOLT: Ability = {
  id: 'frostfire_bolt',
  name: 'Frostfire Bolt',
  cost: { resource: 'mana', amount: 370 },
  castTimeMs: FROSTFIRE_CAST_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      // AND FROST, for the caster's own Frost talents. See above.
      countsAsSchools: FROSTFIRE_ALSO_COUNTS_AS,
      baseAmount: FROSTFIRE_BOLT_DAMAGE,
      powerCoefficient: FROSTFIRE_COEFFICIENTS.direct,
      attackTable: ability.attackTable,
    });
    if (!result.avoided) simulation.applyAura(target, FROSTFIRE_DOT, caster.id);
  },
  unmodelled:
    'It counts as both Frost and Fire and is DEALT as Fire, so its ' +
    'school-scoped SPELL POWER is read as Fire only -- adding two pools to one ' +
    'cast is more than any talent asks for. Its Frost TALENTS do reach it: ' +
    'Piercing Ice, Ice Shards and Frost Channeling all select it now, which ' +
    'is what `countsAsSchools` is for.',
};

/*
 * ============================================================================
 * ICE LANCE, AND ITS 300% CLAUSE NOW FIRES.
 *
 * "Deals 300% increased damage to Frozen targets." It was recorded as
 * permanently inert -- nothing freezes a raid boss -- and that is still true
 * of every OTHER Frozen effect in this class. Fingers of Frost is the
 * exception: it does not freeze the target, it makes the caster's next spells
 * behave as though it were, which is a state on the Mage.
 *
 * TIMES THREE NOW, AND IT WAS FOUR. "Ice Lance damage against Frozen targets
 * changed to a 200% increase (Was 300%)." The READING is unchanged and is the
 * owner's: "increased BY 200%" is base plus twice itself, so the multiplier is
 * three. "Deals 200% damage" would be two, and the owner rejected exactly that
 * reading of the old 300% -- which is also what Classic's Ice Lance does, and
 * Forever marks this spell `new`, so Classic is not authoritative about it in
 * either direction.
 *
 * 133-157 AND NOT THE CAPTURE'S 136-160, by the standing rule that
 * `foreverchanges.pro` wins a disagreement. Recorded in
 * docs/source-cross-checks.md; said here too, because a number that disagrees
 * with the checked-in capture reads as drift without the ruling beside it.
 * ============================================================================
 */
export const ICE_LANCE_DAMAGE = midpoint(133, 157);
/*
 * ============================================================================
 * "N% INCREASED" IS `1 + N/100`, AND GETTING THAT WRONG HAS NOW COST FIVE
 * RULINGS ON ONE SPELL.
 *
 * "Deals 200% increased damage to Frozen targets" is **times THREE**: base,
 * plus twice itself. The note twenty lines above has said so since the figure
 * moved -- "increased BY 200% is base plus twice itself, so the multiplier is
 * three" -- and a block was later added HERE claiming the opposite, that the
 * project "reads that phrasing as the multiplier itself" and that the client's
 * 200% therefore implied 2.
 *
 * **IT WAS WRONG, AND IT CONTRADICTED A CORRECT NOTE IN THE SAME FILE.** Two
 * statements about one number, twenty lines apart, disagreeing -- which is
 * exactly the failure CLAUDE.md records about a pointer and the document it
 * points at, met inside a single file. The wrong one was newer, so it read as
 * the current thinking.
 *
 * SO THE CLIENT MOVING 300% TO 200% IS THE CLIENT CATCHING UP to the patch note
 * that already took the multiplier 4 -> 3. There was never a disagreement
 * between the sources; there was a disagreement between this file and itself.
 *
 * THE OWNER, FOR THE FIFTH TIME: "Ice lance was changed. It now says 200%
 * increased damage. WHICH IS A 3x MULTIPLIER. So the damage is multiplied by 3
 * against a frozen enemy. In order to compensate the spell power coefficient
 * for Ice Lance is 1.5/3.5/3."
 *
 * BOTH NUMBERS WERE ALREADY RIGHT and nothing here changed. What changed is
 * that the note which caused the question twice is gone.
 * ============================================================================
 */
export const ICE_LANCE_FROZEN_MULTIPLIER = 3;
export const ICE_LANCE_COEFFICIENT = ICE_LANCE_SP_COEFFICIENT;

/*
 * ============================================================================
 * TWO THREES SIT NEXT TO EACH OTHER HERE AND THEY ARE STILL SEPARATE NUMBERS.
 * THEY HAVE NOW MATCHED, DIVERGED, AND MATCHED AGAIN.
 *
 * `ICE_LANCE_FROZEN_MULTIPLIER` is the ruleset's frozen bonus -- "a 200%
 * increase", so times three. The three INSIDE `ICE_LANCE_SP_COEFFICIENT` is
 * part of the owner's own expression for the coefficient, `1.5 / 3.5 / 3`, and
 * is a DIFFERENT THREE: it is applied once, when the damage is scaled, and the
 * multiplier is applied separately to the base damage and the coefficient
 * alike.
 *
 * ----------------------------------------------------------------------------
 * THE HISTORY IS THE WHOLE REASON THIS COMMENT IS LONG, AND IT ENDS WITH THE
 * COINCIDENCE BEING THE RULESET.
 *
 * 1. Both numbers were FOUR, and a frozen Ice Lance carried
 *    `1.5 / 3.5 / 4 * 4` = `1.5 / 3.5` = 0.4286 -- exactly the coefficient the
 *    spell had UNFROZEN before any of this. Asked whether their `/4` had
 *    already done the frozen division, the owner said "This is intended stop
 *    asking." So the comment here warned a reader not to read it as a four
 *    cancelled by accident.
 *
 * 2. A patch took the frozen bonus to three and said NOTHING about the
 *    coefficient. That left two readings a third apart -- the divisor is a
 *    separate settled fact (frozen 0.3214), or "intended" meant the PRODUCT and
 *    the divisor follows (0.4286). The first was implemented, on this project's
 *    rule that a statement of a VALUE does not overturn a separate ruling about
 *    which terms a multiplier reaches, and FLAGGED as a reading.
 *
 * 3. "Ice Lance was changed to use 1.5/3.5/3." **The owner meant the product.**
 *
 * SO THE CHOSEN READING WAS WRONG AND THE LABEL IS WHAT FIXED IT. The argument
 * for it was sound and is still the right default -- it is the rule that
 * settled these two numbers the first time -- and what made this recoverable in
 * one message was writing it down AS a reading rather than as a fact. Third
 * time on this one constant.
 * ----------------------------------------------------------------------------
 *
 * AND THEY ARE NOT DERIVED FROM EACH OTHER, WHICH IS THE POINT OF SAYING THEY
 * ARE SEPARATE WHILE THEY AGREE. Writing the coefficient as
 * `1.5 / 3.5 / ICE_LANCE_FROZEN_MULTIPLIER` would move it on nobody's authority
 * the next time the frozen bonus changes -- and step 2 above is exactly that
 * patch happening. Two owner statements that happen to agree, pinned by
 * IDENTITY rather than by equality, which is `critRageMultiplierFor`'s
 * arrangement for the same reason.
 *
 * WHAT WOULD GO WRONG IF THEY WERE CONFLATED is still large in both directions.
 * Dropping the frozen multiplier from the coefficient -- reading the owner's
 * `/3` as having already done it -- makes a frozen Ice Lance a third of its
 * intended coefficient. Applying the multiplier twice makes it three times.
 * NINE between the two, on a spell that is **8.6% of the Frostfire profile and
 * is in no other list** -- it was 35.7% before the owner quartered the
 * coefficient, which is the figure three comments and a HANDOVER row carried
 * forward long after it stopped being true. **Every cast is a FROZEN one**: the
 * entry is gated on Fingers of Frost, so the unfrozen coefficient is worth
 * nothing to any profile and the product above is the whole of it.
 *
 * THE GUARD IS A TEST THAT MULTIPLIES THEM OUT END TO END rather than a check
 * on either constant, which is the argument the pet's 1.375 damage multiplier
 * already makes: a constant check cannot see a double application.
 * ============================================================================
 */

/**
 * Three while Fingers of Frost is up, one otherwise.
 *
 * READ AT CAST TIME rather than being decided when the aura lands, because the
 * charge can expire between the proc and the cast -- the aura is fifteen
 * seconds and the rotation may have a Scorch and a Pyroblast to get through
 * first.
 *
 * THE CHARGE IS NOT SPENT HERE. `fingersOfFrostSpender` takes one on every
 * cast, which is what "your next 2 SPELLS" says: spending it in this ability
 * would leave a charge surviving the Scorch above it in the list.
 */
function frozenMultiplier(caster: Combatant): number {
  return caster.auras.has(FINGERS_OF_FROST.id) ? ICE_LANCE_FROZEN_MULTIPLIER : 1;
}

export const ICE_LANCE: Ability = {
  id: 'ice_lance',
  name: 'Ice Lance',
  cost: { resource: 'mana', amount: 160 },
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'frost',
      /*
       * THE MULTIPLIER IS ON THE BASE AND THE COEFFICIENT BOTH, which is what
       * "deals 300% increased damage" says: all of the damage, not the flat
       * half of it. Applying it to `baseAmount` alone would leave a
       * spell-power-heavy Mage's Ice Lance barely improved and would look
       * entirely reasonable.
       */
      baseAmount: ICE_LANCE_DAMAGE * frozenMultiplier(caster),
      powerCoefficient: ICE_LANCE_COEFFICIENT * frozenMultiplier(caster),
      attackTable: ability.attackTable,
    });
  },
  unmodelled:
    'Its 300% clause is reachable ONLY through Fingers of Frost. Nothing ' +
    'freezes a raid boss, so a Mage without that talent deals the base ' +
    'damage always -- which is the target being what it is, not a gap.',
};

// ---------------------------------------------------------------------------
// Arcane
// ---------------------------------------------------------------------------

/**
 * Arcane Missiles: "209 Arcane damage each second for 5 sec".
 *
 * ----------------------------------------------------------------------------
 * THE FIRST CHANNEL IN THE PROJECT, and the reason `Ability.channelTicks`
 * exists. Five ticks over five seconds, each rolling the spell table on its
 * own -- so a missile can miss while the rest land, which is what a channel
 * does and is not what a 1045-damage cast at the five-second mark would do.
 *
 * MISSILE BARRAGE HALVES THE CHANNEL and the ticks stay at five, because
 * `channelTicks` is a COUNT and the gaps shrink with the cast. That is the
 * tooltip's "reduce the channeled duration by 50% ... and missiles fire every
 * 0.5 sec" -- three clauses that turn out to be one thing.
 * ----------------------------------------------------------------------------
 */
export const ARCANE_MISSILES_PER_TICK = 209;
export const ARCANE_MISSILES_TICKS = 5;
export const ARCANE_MISSILES_CHANNEL_MS = seconds(ARCANE_MISSILES_TICKS);

/*
 * THE WHOLE CHANNEL IS THE CAST, so five seconds over 3.5 is 1.429 shared
 * evenly across the five missiles -- 0.286 each. It is the largest total
 * coefficient in the project and it is NOT clamped, unlike a direct cast:
 * a channel pays for its scaling in time, which is the thing the clamp on a
 * direct cast exists to prevent.
 *
 * FROM THE BASE CHANNEL TIME, not the talented one. Missile Barrage halves
 * the channel and keeps all five missiles; reading the shortened time here
 * would make that talent cut the spell's scaling in half while doubling its
 * rate, which nets out to nothing and would look like the talent working.
 */
export const ARCANE_MISSILES_TICK_COEFFICIENT = ARCANE_MISSILES_TICK_SP_COEFFICIENT;

export const ARCANE_MISSILES: Ability = {
  id: 'arcane_missiles',
  name: 'Arcane Missiles',
  cost: { resource: 'mana', amount: 655 },
  castTimeMs: ARCANE_MISSILES_CHANNEL_MS,
  channelTicks: ARCANE_MISSILES_TICKS,
  /*
   * WILLING TO BE CUT SHORT, which on its own changes nothing.
   *
   * BOTH HALVES HAVE TO AGREE: a channel says it is interruptible and an ENTRY
   * says it is worth interrupting for, and nothing is cancelled unless both do.
   * So marking this costs no DPS and takes no decision -- it makes the panel's
   * "interrupt" checkbox mean something for a Mage, and the person ticking it
   * is the one deciding.
   *
   * EVOCATION IS THE OTHER MAGE CHANNEL AND IS DELIBERATELY NOT MARKED, on the
   * owner's instruction. It is eight seconds of mana regeneration and cutting
   * it short would throw away the thing it was cast for -- so the checkbox on
   * a Mage entry can only ever interrupt THIS, which is what makes it safe to
   * offer. `mageAbilities.test.ts` pins that Evocation stays uninterruptible.
   */
  interruptibleChannel: true,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'arcane',
      baseAmount: ARCANE_MISSILES_PER_TICK,
      // Per MISSILE. `onCast` runs once per tick for a channel.
      powerCoefficient: ARCANE_MISSILES_TICK_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
};

/**
 * Arcane Blast, granted by the Arcane talent.
 *
 * ITS COST IS A SHARE OF BASE MANA -- "15% of base mana" -- which is 140 for
 * every Mage, and it ESCALATES: each cast adds a stack worth +175% of that
 * base, to four. See `ARCANE_BLAST` in `auras/mage.ts` for what is and is not
 * modelled; the short version is that the cost half is exact and the "+10% to
 * all your other spells" half is not.
 */
export const ARCANE_BLAST_BASE_MANA_FRACTION = 0.15;

/**
 * ============================================================================
 * THE REDESIGN'S THREE NUMBERS, AND TWO OF THEM TURN OUT TO BE ONE.
 *
 * "This spell is now a 1.5 second cast ... Mana cost unchanged, but damage done
 * and Spell Damage coefficients both reduced 40%."
 *
 * THE -40% ON THE COEFFICIENT *IS* THE CAST TIME CHANGE, which is the finding
 * here rather than a coincidence to note. This ruleset's spell coefficients
 * follow `castTime / 3.5`: the old 0.714 is `2.5 / 3.5` rounded, and
 *
 *     2.5 / 3.5 x 0.6  =  1.5 / 3.5     exactly
 *
 * so a 2.5-second cast becoming a 1.5-second one carries its coefficient down
 * by precisely the 40% the note states. The two clauses are one change written
 * twice, and that agreement is strong evidence the figure is right.
 *
 * KEPT AS THE EXPRESSION rather than as 0.4284, for the reason Ice Lance's is:
 * `1.5 / 3.5` does not terminate, 0.714 was already a rounding, and rounding a
 * second time compounds it. It is also the same figure the two Judgements just
 * took -- "the correct spell power coefficient for instant cast spells" -- which
 * is the convention a 1.5-second cast sits on in this ruleset.
 *
 * THE BASE DAMAGE IS WRITTEN AS THE OLD RANGE TIMES 0.6, so the captured
 * 364-424 stays visible and the note's own arithmetic is the thing a reader
 * checks. Folding it to a flat 236 would hide which half came from the client.
 * ============================================================================
 */
/*
 * ==============================================================================
 * THE CLIENT STATES THIS NUMBER NOW, SO THE DERIVATION COMES OUT.
 *
 * It was `midpoint(364, 424) * (1 - 0.4)` -- the old capture's damage with a
 * patch note's 40% cut applied on top, because the capture predated the
 * redesign. At build 1.60.1.70425 the spellbook says **218 to 254** outright.
 *
 * AND THE DERIVATION WAS RIGHT TO WITHIN A POINT: 394 x 0.6 is 236.4 against a
 * stated midpoint of 236. **A derived figure confirmed by a later capture is
 * the best outcome available to one**, and it is only checkable because the
 * derivation was written down rather than folded into a literal.
 *
 * `ARCANE_BLAST_DAMAGE_REDUCTION` IS DELETED WITH IT. A note's operation kept
 * beside a figure the client now states is a second source of truth for one
 * number, and the next refresh would have applied the cut twice.
 * ==============================================================================
 */
export const ARCANE_BLAST_DAMAGE = midpoint(218, 254);
export const ARCANE_BLAST_CAST_MS = seconds(1.5);
export const ARCANE_BLAST_COEFFICIENT = ARCANE_BLAST_SP_COEFFICIENT;

export const ARCANE_BLAST_ABILITY: Ability = {
  id: 'arcane_blast',
  name: 'Arcane Blast',
  cost: {
    resource: 'mana',
    amount: Math.round(MAGE_BASE_MANA * ARCANE_BLAST_BASE_MANA_FRACTION),
  },
  castTimeMs: ARCANE_BLAST_CAST_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'arcane',
      baseAmount: ARCANE_BLAST_DAMAGE,
      powerCoefficient: ARCANE_BLAST_COEFFICIENT,
      attackTable: ability.attackTable,
    });
    /*
     * THE STACK GOES UP AFTER THE CAST THAT PAID THE OLD PRICE. The cost was
     * resolved and taken at cast START, so this stack raises the price of the
     * NEXT one -- which is what "each time you cast Arcane Blast, the mana
     * cost is increased" means, and the opposite of what applying it first
     * would do.
     *
     * IT ALSO MEANS THIS CAST DOES NOT COLLECT ITS OWN SPELL POWER, which is
     * the same ordering answering a question the redesign raised: the aura now
     * grants spell power, `dealDamage` above has already run, and "each time it
     * is cast it GRANTS" describes what the cast leaves behind rather than what
     * it benefits from. Applying it first would have the spell pay the old
     * price and collect the new power, which is generous in both directions.
     *
     * BUILT FROM THE CASTER'S OWN INTELLECT, read here because an
     * `AuraDefinition` is a module constant and cannot know it. The value is
     * frozen for the window -- see `arcaneBlastAura`, which says why.
     */
    simulation.applyAura(
      caster,
      arcaneBlastAura(caster.stats.effective.intellect),
      caster.id,
    );
  },
  unmodelled: ARCANE_BLAST_UNMODELLED,
};

/**
 * Arcane Power, granted by the Arcane capstone.
 *
 * NO CAVEAT ANY MORE. Both halves of "your spells deal 30% more damage while
 * costing 30% more mana" are modelled -- see `ARCANE_POWER` for the list the
 * cost half names and the test that keeps it in step with the book.
 */
export const ARCANE_POWER_ABILITY: Ability = {
  id: 'arcane_power',
  name: 'Arcane Power',
  cooldownMs: seconds(180),
  triggersGcd: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, ARCANE_POWER, caster.id);
  },
};

/** Presence of Mind, granted by the Arcane talent. */
export const PRESENCE_OF_MIND_ABILITY: Ability = {
  /*
   * OFF THE GLOBAL COOLDOWN, ON THE OWNER'S RULING: "Ensure Presence of Mind
   * and Arcane Power don't trigger a global cooldown."
   *
   * BEING OFF IT MEANS ONE THING -- the ability does not START a global
   * cooldown. It is still BLOCKED by one running, and what it buys is that the
   * action AFTER it is free. That is what makes a cooldown STACK expressible at
   * all: `nextDecisionTime` lets a free cast act again at once, so the potion,
   * this, and the payload resolve in a single instant rather than spending a
   * global cooldown each.
   *
   * AND IT DECLARES A `cooldownMs`, which is not incidental --
   * `freeCastChain.test.ts` asserts across all nine classes that every off-GCD
   * ability has one, because an off-GCD ability with no cooldown would win the
   * list forever and HANG a fight rather than fail one.
   *
   * THE MISTAKE IS INVISIBLE IN EVERYTHING BUT THE DPS: an ability wrongly
   * taking a global cooldown still applies the right aura for the right
   * duration on the right cooldown.
   */
  id: 'presence_of_mind',
  name: 'Presence of Mind',
  cooldownMs: seconds(180),
  triggersGcd: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, PRESENCE_OF_MIND, caster.id);
  },
};

/**
 * Mage Armor. One instant at the pull, and it lasts the fight.
 *
 * Its worth is entirely the five second rule -- see `MAGE_ARMOR` for why the
 * mana half is the half that matters here and the resistance half is not.
 */
/**
 * Ice Barrier, a castable buff for any Mage (round 55).
 *
 * ============================================================================
 * THE OWNER'S RULING: "Ice Barrier needs to be a usable skill for Frostfire
 * profile. It should be cast at T-10 seconds. It applies a buff that gives 6%
 * Frost Damage for 60 seconds."
 *
 * IT IS ALSO A TIER-30 FROST TALENT, which the Frostfire build's 22 Frost
 * points cannot reach -- so it is declared here, in the trainer book, on the
 * owner's word. The spellbook capture lists it "Learned at level 58", which is
 * the line CLAUDE.md warns a talent-granted spell carries too; the ruling is
 * what settles it, not the line.
 *
 * COST, CAST AND COOLDOWN ARE THE CAPTURE'S: 480 mana, instant, 30 seconds.
 * ============================================================================
 */
export const ICE_BARRIER_ABILITY: Ability = {
  id: 'ice_barrier',
  name: 'Ice Barrier',
  cost: { resource: 'mana', amount: 480 },
  cooldownMs: seconds(30),
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, ICE_BARRIER, caster.id);
  },
  unmodelled:
    'Its 819-point absorb does nothing: no Mage profile is attacked. The +6% ' +
    'Frost damage the owner stated is modelled in full.',
};

export const MAGE_ARMOR_ABILITY: Ability = {
  id: 'mage_armor',
  name: 'Mage Armor',
  cost: { resource: 'mana', amount: 490 },
  requiresTarget: false,
  canCast: ({ caster }) => !caster.auras.has('mage_armor'),
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, MAGE_ARMOR, caster.id);
  },
  unmodelled:
    `Its +${MAGE_ARMOR_MAGIC_RESISTANCE} resistance to all magic does nothing: ` +
    'no Mage profile is attacked, so there is no incoming spell for it to ' +
    'reduce. The mana half is modelled in full.',
};

/**
 * Evocation. An eight-second channel that buys mana and costs damage.
 *
 * ----------------------------------------------------------------------------
 * THE FIRST ABILITY IN THE PROJECT THAT PAYS OUT DURING ITS OWN CAST, which is
 * why `Ability.onCastStart` exists. The pair is the design: `onCastStart`
 * opens the window and `onCast` closes it, so it ends exactly when the channel
 * does. Giving the aura a duration instead would mean keeping an eight-second
 * constant in step with a cast time haste shortens -- and getting that wrong is
 * free mana after the channel, which nothing would flag.
 *
 * NO `channelTicks`, and it is still a channel. `castEndsAt` is what locks the
 * caster out, and that is set for any cast with a cast time; ticks exist for an
 * ability whose EFFECT repeats, and this one's effect is a rate rather than a
 * series of events. A one-tick channel and a plain cast are the same thing in
 * this engine, which is exactly what this wants.
 *
 * THE COST IS THE EIGHT SECONDS. It has no mana cost and a 480-second
 * cooldown, so it fires once a fight and the question a list has to answer is
 * whether the mana is worth more than the casts it displaces -- which is why
 * the entry is gated at 10% mana rather than used on cooldown.
 * ----------------------------------------------------------------------------
 */
export const EVOCATION_COOLDOWN_MS = seconds(480);

export const EVOCATION: Ability = {
  id: 'evocation',
  name: 'Evocation',
  castTimeMs: EVOCATION_CHANNEL_MS,
  cooldownMs: EVOCATION_COOLDOWN_MS,
  requiresTarget: false,
  onCastStart: ({ simulation, caster }) => {
    simulation.applyAura(caster, EVOCATION_AURA, caster.id);
  },
  /*
   * THE CHANNEL ENDING IS THE EFFECT ENDING. Removing it here rather than
   * letting the aura expire is what keeps the window and the cast the same
   * length under haste.
   */
  onCast: ({ simulation, caster }) => {
    caster.auras.remove(simulation, EVOCATION_AURA.id);
  },
  /*
   * STOPS AT A FULL POOL, by the owner (round 51): "if while casting evocation
   * your current mana reaches 100% then stop the channel and continue with the
   * rotation." The engine polls this, ends the channel, and runs `onCast` above
   * -- so the regeneration window closes with it.
   */
  endsChannelEarly: (_context, caster) => {
    const mana = caster.resources.get('mana');
    return mana !== undefined && mana.current >= mana.maximum;
  },
};

/**
 * Mana Ruby: "regain 1000 to 1200 Mana", ONCE A FIGHT, OFF THE GLOBAL COOLDOWN.
 *
 * ----------------------------------------------------------------------------
 * THE OWNER, ROUND 51: "Mana Ruby needs to be APL rotation. If current mana
 * reaches 25% then use a Mana Ruby to regain 1000 to 1200 Mana. Can be used
 * once per combat iteration regardless of duration. Does not trigger a global
 * cooldown."
 *
 * "ONCE PER COMBAT ITERATION REGARDLESS OF DURATION" IS A COOLDOWN NO FIGHT
 * OUTLASTS. A day, named, rather than `Infinity` -- every reader of a cooldown
 * does arithmetic on it, and a finite number keeps `cooldownTime` and the
 * panels honest. `freeCastChain.test.ts` requires an off-GCD ability to declare
 * one anyway, or it could win the list forever in one instant.
 *
 * A CLASS ABILITY AND NOT A CONSUMABLE CATEGORY, because the owner stated it as
 * a Mage's rotation entry rather than as a selection, and a conjured gem shares
 * no cooldown with a potion -- so it does NOT join `POTION_COOLDOWN_GROUP`.
 * Free and instant, so neither Clearcasting (`requiresCost`) nor Presence of
 * Mind (`requiresCastTime`) can spend a charge on it.
 * ----------------------------------------------------------------------------
 */
export const MANA_RUBY_MINIMUM = 1000;
export const MANA_RUBY_MAXIMUM = 1200;
export const MANA_RUBY_COOLDOWN_MS = seconds(24 * 60 * 60);

export const MANA_RUBY: Ability = {
  id: 'mana_ruby',
  name: 'Mana Ruby',
  cooldownMs: MANA_RUBY_COOLDOWN_MS,
  requiresTarget: false,
  triggersGcd: false,
  onCast: ({ simulation, caster, ability }) => {
    simulation.grantResource(
      caster,
      'mana',
      simulation.rng.nextInt(MANA_RUBY_MINIMUM, MANA_RUBY_MAXIMUM),
      { id: ability.id, name: ability.name },
    );
  },
};

/**
 * Arcane Wrath: a 3.5 second Arcane nuke that scales with the Mage's mana POOL.
 *
 * ==============================================================================
 * "Launches a projectile of pure Arcane energy at the enemy target, causing 439
 * to 529 Arcane damage. This spell gains additional Spell Damage equal to 5% of
 * your maximum Mana." 395 mana, **3.5 second cast**, 6 second cooldown, and
 * **100% of Spell Power** for its coefficient.
 *
 * NEW AT CLIENT BUILD 1.60.1.70425, granted by the Arcane tree's new row-3
 * talent of the same name, which requires Arcane Blast.
 *
 * ------------------------------------------------------------------------------
 * THREE OF THOSE FOUR NUMBERS ARE THE OWNER'S CORRECTION, AND THE CAST TIME IS
 * THE ONE WORTH READING TWICE.
 *
 * This shipped as an INSTANT with 406-496 damage and a borrowed 0.429, and the
 * note here said "the capture states no cost and no cast time". **The capture
 * states `"cast": "3.5 sec cast"` in its own field.** The probe that read the
 * entry asked for `castTime`, got `undefined`, and a reading error became a
 * claim about the source -- after which every rule this project has for
 * reasoning around a silent source was applied to a source that had spoken.
 *
 * **A FIELD READ BY THE WRONG NAME REPORTS AS A SOURCE THAT IS SILENT**, and
 * silence is the one state those rules are generous about: a tie-break does not
 * apply, an omission has not denied anything, and a neighbouring spell's figure
 * becomes borrowable. Every one of those is right about a quiet source and
 * none is right about a misread field. The spell came out instant, which with
 * 0.429 made it look weak and with a correct 1.0 would have made it absurd.
 *
 * SO THE CHEAP CHECK IS THE ENTRY ITSELF RATHER THAN A PROBE OVER IT. `cost`,
 * `range`, `cast` and `cooldown` are the capture's four field names and
 * `import_forever_spells.mjs` writes them; printing the whole object once would
 * have shown all four.
 *
 * ------------------------------------------------------------------------------
 * 439 TO 529 IS THE OWNER'S FIGURE AND THE CAPTURE SAYS 406 TO 496, exactly 33
 * lower at both ends. **A later statement from the owner outranks a capture**,
 * which is the rule Rake's 5.5% tick and Swipe's 3% already follow -- and the
 * even offset says this is a BUILD difference rather than a transcription
 * error, so the capture is probably one refresh behind rather than wrong. Both
 * figures are recorded here because a reader who knows the checked-in capture
 * would otherwise read 484 as drift.
 *
 * AND THE TALENT TOOLTIP SAYS 122 TO 146, WHICH IS RANK 1. That is the figure a
 * reader meets first and it is a quarter of the real spell -- **a talent tooltip
 * shows rank 1 of the ability it grants**, which has cost this project two
 * Hunter abilities (Sniper Shot at 160 against 295, Summon Hawk at 32 against
 * 108, the second worth 144 DPS). The capture's own `rank` field reads 4.
 *
 * ------------------------------------------------------------------------------
 * THE MANA CLAUSE IS A SPELL POWER ADDITION AND IS DEALT AS ONE. It is folded
 * into `baseAmount` already multiplied by the coefficient, so the total comes
 * out as `base + (spellPower + 5% of max mana) x coefficient` -- which is what
 * "gains additional Spell Damage" says, and is the arithmetic a second
 * `powerCoefficient` could not express.
 *
 * **AT A COEFFICIENT OF EXACTLY 1.0 THAT READING AND "5% AS FLAT DAMAGE"
 * COINCIDE**, which is luck rather than a resolution: the two differ by the
 * coefficient and the coefficient is one. The day a patch moves it they come
 * apart and nothing here would flag it.
 *
 * MAXIMUM AND NOT CURRENT, which the tooltip states and which matters: a Mage's
 * mana falls through a fight, so reading the current pool would make the spell
 * get weaker the longer it is cast -- a smaller number, no error, and exactly
 * backwards for a spell whose point is that a big pool is damage.
 *
 * THE POOL IS SIZED ONCE from a stats snapshot, so this is stable across the
 * fight for free; it is not re-read per cast because it cannot move.
 * ==============================================================================
 */
export const ARCANE_WRATH_DAMAGE = midpoint(439, 529);
export const ARCANE_WRATH_MANA = 395;
export const ARCANE_WRATH_CAST_MS = seconds(3.5);
export const ARCANE_WRATH_COOLDOWN_MS = seconds(6);
/** "Additional Spell Damage equal to 5% of your maximum Mana." */
export const ARCANE_WRATH_MANA_TO_SPELL_POWER = 0.05;
export const ARCANE_WRATH_COEFFICIENT = ARCANE_WRATH_SP_COEFFICIENT;

export const ARCANE_WRATH: Ability = {
  id: 'arcane_wrath',
  name: 'Arcane Wrath',
  cost: { resource: 'mana', amount: ARCANE_WRATH_MANA },
  castTimeMs: ARCANE_WRATH_CAST_MS,
  cooldownMs: ARCANE_WRATH_COOLDOWN_MS,
  attackTable: 'spell',
  requiresTarget: true,
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const fromMana =
      (caster.resources.get('mana')?.maximum ?? 0) * ARCANE_WRATH_MANA_TO_SPELL_POWER;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'arcane',
      /*
       * THE MANA SHARE ARRIVES HERE, ALREADY SCALED. `scaleByPower` adds
       * `spellPower x powerCoefficient` to whatever this is, so putting
       * `fromMana x coefficient` in the base makes the two pools add before the
       * coefficient -- which is one multiplication of a combined pool, not two.
       */
      baseAmount: ARCANE_WRATH_DAMAGE + fromMana * ARCANE_WRATH_COEFFICIENT,
      powerCoefficient: ARCANE_WRATH_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
};

/**
 * Cone of Cold: "Targets in a cone in front of the caster take 332.929 to
 * 362.071 Frost damage and are slowed by 40% for 6 sec." 555 mana, instant, 10
 * second cooldown, 12.9% spell power.
 *
 * ----------------------------------------------------------------------------
 * THE OWNER'S TOOLTIP, NOT THE CAPTURE. `forever-mage-spellbook.json` has rank
 * 4 at 260 to 286 for 465 mana; the owner's is the later statement and wins,
 * the same reading that gives Swipe 3% over a sheet saying 10%.
 *
 * ONE TARGET, because every encounter here has one. The cone is positioning.
 *
 * THE SLOW IS OUT OF SCOPE EXCEPT AS A CHILL, by the owner's ruling: "the slow
 * element doesn't need to be part of the scope other than the ability to proc
 * fingers of frost". So it is in `CHILL_ABILITY_IDS`, and nothing else about
 * the snare is modelled.
 *
 * IT IS WHAT WINTER'S CHILL AND IMPROVED CONE OF COLD WERE WAITING FOR, and
 * both talents name it: the debuff amplifies Cone of Cold alone, and the talent
 * is a flat damage bonus on it.
 * ----------------------------------------------------------------------------
 */
export const CONE_OF_COLD_DAMAGE = (332.929 + 362.071) / 2;

export const CONE_OF_COLD: Ability = {
  id: 'cone_of_cold',
  name: 'Cone of Cold',
  cost: { resource: 'mana', amount: 555 },
  cooldownMs: seconds(10),
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'frost',
      baseAmount: CONE_OF_COLD_DAMAGE,
      powerCoefficient: CONE_OF_COLD_SP_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
};

export const MAGE_ABILITIES: readonly Ability[] = [
  ARCANE_WRATH,
  FIREBALL,
  SCORCH,
  PYROBLAST,
  FIRE_BLAST,
  BLAST_WAVE,
  COMBUSTION_ABILITY,
  FROSTBOLT,
  FROSTFIRE_BOLT,
  ICE_LANCE,
  CONE_OF_COLD,
  ARCANE_MISSILES,
  ARCANE_BLAST_ABILITY,
  ARCANE_POWER_ABILITY,
  PRESENCE_OF_MIND_ABILITY,
  MAGE_ARMOR_ABILITY,
  ICE_BARRIER_ABILITY,
  EVOCATION,
  MANA_RUBY,
];
