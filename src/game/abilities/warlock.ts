import type { Ability } from '../../engine';
import { dealDamage, seconds } from '../../engine';
import {
  BANE_OF_AGONY,
  BANE_OF_AGONY_UNMODELLED,
  CORRUPTION,
  CORRUPTION_CAST_MS,
  IMMOLATE,
  IMMOLATE_CAST_MS,
  IMMOLATE_COEFFICIENTS,
  IMMOLATE_DIRECT,
  SIPHON_LIFE,
  WRACK_AMPLIFICATION,
} from '../auras/warlock';
import {
  CONFLAGRATE_SP_COEFFICIENT,
  INCINERATE_SP_COEFFICIENT,
  SEARING_PAIN_SP_COEFFICIENT,
  SHADOWBURN_SP_COEFFICIENT,
  SHADOW_BOLT_SP_COEFFICIENT,
  WRACK_TICK_SP_COEFFICIENT,
} from '../combat/coefficients';

/**
 * Warlock abilities, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * ----------------------------------------------------------------------------
 * THE NINTH AND LAST CLASS. No pet: both of the ruleset owner's profiles take
 * Demonic Sacrifice, which kills the demon and keeps a two-hour buff, so
 * neither has one active. The demon they sacrifice is read from the same
 * profile field the Hunter's pet family uses.
 *
 * EVERY SPELL SCALES, AND THIS CLASS GAINED THE MOST OF ANY. SM/DS went
 * 135.3 -> 331.7 and the Firelock 247.5 -> 479.1, because almost all of a
 * Warlock's damage is PERIODIC and a DoT's coefficient is its duration over
 * 15 -- uncapped, so Bane of Agony's 24 seconds is worth 1.6 and Siphon Life's
 * 30 is worth 2.0, the two largest in the project.
 *
 * The spell text is unchanged and still states flat damage with no
 * coefficient; the coefficient is the owner's universal RULE. See
 * `game/combat/spellCoefficient.ts`. Immolate is the one hybrid here and its
 * pair lives in `auras/warlock.ts`.
 *
 * SOUL SHARDS ARE A RESOURCE WITH NO INCOME HERE. Shadowburn and Soul Fire
 * cost one, and the only way to earn one is Drain Soul killing something --
 * which never happens against a target that survives every fight. So a
 * Warlock starts with a banked pool and spends it, which is what a Warlock
 * walking into a raid actually does.
 * ----------------------------------------------------------------------------
 */

/** The midpoint of a stated range. The combat table supplies the spread. */
const midpoint = (low: number, high: number) => (low + high) / 2;

// ---------------------------------------------------------------------------
// Affliction
// ---------------------------------------------------------------------------

export const SHADOW_BOLT_DAMAGE = midpoint(253, 283);
export const SHADOW_BOLT_CAST_MS = seconds(3);
export const SHADOW_BOLT_COEFFICIENT = SHADOW_BOLT_SP_COEFFICIENT;

export const SHADOW_BOLT: Ability = {
  id: 'shadow_bolt',
  name: 'Shadow Bolt',
  cost: { resource: 'mana', amount: 380 },
  castTimeMs: SHADOW_BOLT_CAST_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'shadow',
      baseAmount: SHADOW_BOLT_DAMAGE,
      powerCoefficient: SHADOW_BOLT_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
};

export const CORRUPTION_ABILITY: Ability = {
  id: 'corruption',
  name: 'Corruption',
  cost: { resource: 'mana', amount: 340 },
  castTimeMs: CORRUPTION_CAST_MS,
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;
    /*
     * A PURE DoT: the cast itself deals nothing, so the whole coefficient is
     * on the aura's ticks and there is no direct half to weight against.
     * NOTHING IS PASSED HERE -- the scaling lives with the damage.
     */
    simulation.applyAura(target, CORRUPTION, caster.id);
  },
};

export const BANE_OF_AGONY_ABILITY: Ability = {
  id: 'bane_of_agony',
  name: 'Bane of Agony',
  cost: { resource: 'mana', amount: 215 },
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;
    simulation.applyAura(target, BANE_OF_AGONY, caster.id);
  },
  unmodelled: BANE_OF_AGONY_UNMODELLED,
};

/** Siphon Life, granted by the Affliction talent. */
export const SIPHON_LIFE_ABILITY: Ability = {
  id: 'siphon_life',
  name: 'Siphon Life',
  cost: { resource: 'mana', amount: 365 },
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;
    simulation.applyAura(target, SIPHON_LIFE, caster.id);
  },
  unmodelled:
    'Its damage applies and the health it transfers back does not: no Warlock ' +
    'profile is attacked, so the heal would land on a character at full.',
};

/**
 * Life Tap: "Converts 424 health into 424 Mana."
 *
 * THE ONE ABILITY IN THE PROJECT THAT SPENDS HEALTH. It is what keeps an
 * Affliction warlock casting, and it is genuinely free here for the same
 * reason Siphon Life's heal is wasted -- nothing is attacking, so the health
 * has no other use.
 *
 * ITS SPIRIT CLAUSE IS NOT MODELLED. "Mana gained is increased by your Spirit"
 * states no rate, so the flat conversion is used and the ability says so.
 *
 * ----------------------------------------------------------------------------
 * 840 AND NOT 424, ON THE RULESET OWNER'S RULING, AND THE TWO SOURCES DISAGREE
 * AT THE SAME CLIENT BUILD.
 *
 * `talentsforever.com/spelldesc.js` says 424 at rank 6 and
 * `foreverchanges.pro/spellbook/warlock` says 840, both read at build
 * 1.60.1.70009 -- so this is not our capture being stale, and refreshing it
 * does not settle it. The owner's ruling is 840, and the standing rule that
 * came with it is that **foreverchanges.pro wins a disagreement**. See
 * `docs/source-cross-checks.md`.
 *
 * IT IS WORTH 13.5% TO FIRELOCK AND NOTHING TO SM/DS. Destruction is mana-bound
 * and Affliction is not, so the same number moves one Warlock profile a long way
 * and leaves the other inside noise. The checked-in capture still says 424,
 * because it is scraped data and is never hand-edited; this constant deliberately
 * disagrees with it and says why.
 * ----------------------------------------------------------------------------
 */
export const LIFE_TAP_AMOUNT = 840;

export const LIFE_TAP: Ability = {
  id: 'life_tap',
  name: 'Life Tap',
  requiresTarget: false,
  // Only when there is health to spend AND mana worth gaining.
  canCast: ({ caster }) =>
    caster.health.current > LIFE_TAP_AMOUNT &&
    (caster.resources.get('mana')?.current ?? 0) <
      (caster.resources.get('mana')?.maximum ?? 0) - LIFE_TAP_AMOUNT,
  onCast: ({ simulation, caster }) => {
    caster.health.spend(LIFE_TAP_AMOUNT);
    simulation.grantResource(caster, 'mana', LIFE_TAP_AMOUNT, {
      id: 'life_tap',
      name: 'Life Tap',
    });
  },
  unmodelled:
    'Its "Mana gained is increased by your Spirit" clause states no rate, so ' +
    'the flat conversion is used and this understates.',
};

// ---------------------------------------------------------------------------
// Destruction
// ---------------------------------------------------------------------------

export const IMMOLATE_ABILITY: Ability = {
  id: 'immolate',
  name: 'Immolate',
  cost: { resource: 'mana', amount: 380 },
  castTimeMs: IMMOLATE_CAST_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    // One roll decides both halves, as every direct-plus-burn spell here does.
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      baseAmount: IMMOLATE_DIRECT,
      powerCoefficient: IMMOLATE_COEFFICIENTS.direct,
      attackTable: ability.attackTable,
    });
    if (!result.avoided) simulation.applyAura(target, IMMOLATE, caster.id);
  },
};

/**
 * Incinerate, granted by the Destruction capstone: "201 to 233 Fire damage and
 * an additional 25% damage if the target is afflicted by Immolate."
 *
 * ITS CONDITION IS READ AT CAST TIME, which makes the priority list's order
 * load-bearing -- Immolate sits above it for exactly that reason.
 */
export const INCINERATE_DAMAGE = midpoint(201, 233);
export const INCINERATE_IMMOLATE_BONUS = 1.25;
export const INCINERATE_CAST_MS = seconds(2.5);
export const INCINERATE_COEFFICIENT = INCINERATE_SP_COEFFICIENT;

export const INCINERATE: Ability = {
  id: 'incinerate',
  name: 'Incinerate',
  cost: { resource: 'mana', amount: 325 },
  castTimeMs: INCINERATE_CAST_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const burning = target.auras.has('immolate');
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      baseAmount: INCINERATE_DAMAGE * (burning ? INCINERATE_IMMOLATE_BONUS : 1),
      powerCoefficient: INCINERATE_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
};

/**
 * Conflagrate, granted by the Destruction talent.
 *
 * "Ignites a target that is ALREADY AFFLICTED BY YOUR IMMOLATE, dealing 251 to
 * 313 Fire damage and CONSUMING your Immolate effect."
 *
 * BOTH CLAUSES MATTER AND SHADOW AND FLAME UNDOES THE SECOND. At 5/5 that
 * talent gives "a 100% chance NOT to consume Immolate", which is why the
 * Firelock list casts this on cooldown rather than weighing it against the
 * burn it would otherwise eat. The consumption is gated on the talent's flag
 * rather than assumed either way.
 */
export const CONFLAGRATE_DAMAGE = midpoint(251, 313);
export const CONFLAGRATE_KEEPS_IMMOLATE = 'keepsImmolate';
export const CONFLAGRATE_COEFFICIENT = CONFLAGRATE_SP_COEFFICIENT;

export const CONFLAGRATE: Ability = {
  id: 'conflagrate',
  name: 'Conflagrate',
  cost: { resource: 'mana', amount: 255 },
  cooldownMs: seconds(10),
  attackTable: 'spell',
  canCast: ({ caster, target }) => target?.auras.has('immolate') === true && caster.isAlive,
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      baseAmount: CONFLAGRATE_DAMAGE,
      powerCoefficient: CONFLAGRATE_COEFFICIENT,
      attackTable: ability.attackTable,
    });

    // Shadow and Flame at full rank keeps it; without the talent it burns.
    const keeps = (ability.bonuses?.[CONFLAGRATE_KEEPS_IMMOLATE] ?? 0) > 0;
    if (!keeps) target.auras.remove(simulation, 'immolate');
  },
};

/**
 * Shadowburn, granted by the Destruction talent.
 *
 * A SOUL SHARD, AND SHADOW AND FLAME REFUNDS IT. "Shadowburn has a 100% chance
 * to instantly refund a Soul Shard" at 5/5, which is the only reason a build
 * with no shard income can cast it more than once.
 *
 * ----------------------------------------------------------------------------
 * IT COSTS BOTH A SHARD AND 365 MANA, AND THAT IS THE ONE PLACE THE OWNER'S
 * "PREFER foreverchanges.pro" RULE IS NOT APPLIED LITERALLY.
 *
 * The two sources do not contradict each other here; each carries the half its
 * own data model holds. `talentsforever` lists `Reagents: Soul Shard` and no
 * mana line. `foreverchanges.pro` lists `365 Mana` and **carries no reagent
 * field at all, for any spell in the payload** -- so its silence on the shard is
 * structural rather than a statement that there is none. Classic charges both.
 *
 * Taking the rule literally would DELETE a cost that one source states and the
 * other cannot express, which is the opposite of what a tie-break is for. Both
 * are charged, and this comment is the flag: one line reverts it if the owner
 * means mana alone.
 *
 * `cost` is singular, so the shard stays the declared cost -- a rotation's
 * affordability check is the reason it exists, and shards are the scarce pool --
 * and the mana is taken in `onCast`, the same shape Execute uses for the rage it
 * drains beyond its declared 15.
 * ----------------------------------------------------------------------------
 */
export const SHADOWBURN_MANA = 365;
// 251 to 281 from foreverchanges.pro, which the owner's ruling prefers over
// talentsforever's 258 to 288. Same rank 6, same level 56, same build.
export const SHADOWBURN_DAMAGE = midpoint(251, 281);
export const SHADOWBURN_REFUNDS_SHARD = 'refundsShard';
export const SHADOWBURN_COEFFICIENT = SHADOWBURN_SP_COEFFICIENT;

export const SHADOWBURN: Ability = {
  id: 'shadowburn',
  name: 'Shadowburn',
  cost: { resource: 'soulShards', amount: 1 },
  cooldownMs: seconds(15),
  attackTable: 'spell',
  // The mana half of the cost, so a caster that cannot afford it does not cast
  // it -- `checkCast` only knows about the declared shard.
  canCast: ({ caster }) => (caster.resources.get('mana')?.current ?? 0) >= SHADOWBURN_MANA,
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;

    // The engine has taken the shard; the mana is the half no single `cost` can
    // carry. See the note above on why both are charged.
    caster.resources.get('mana')?.spend(SHADOWBURN_MANA);

    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'shadow',
      baseAmount: SHADOWBURN_DAMAGE,
      powerCoefficient: SHADOWBURN_COEFFICIENT,
      attackTable: ability.attackTable,
    });

    if ((ability.bonuses?.[SHADOWBURN_REFUNDS_SHARD] ?? 0) > 0) {
      simulation.grantResource(caster, 'soulShards', 1, {
        id: 'shadow_and_flame',
        name: 'Shadow and Flame',
      });
    }
  },
};

// 105 to 123 from foreverchanges.pro, over talentsforever's 107 to 125, by the
// same ruling. Same rank 6, same level 58, same build.
export const SEARING_PAIN_DAMAGE = midpoint(105, 123);
export const SEARING_PAIN_CAST_MS = seconds(1.5);
export const SEARING_PAIN_COEFFICIENT = SEARING_PAIN_SP_COEFFICIENT;

export const SEARING_PAIN: Ability = {
  id: 'searing_pain',
  name: 'Searing Pain',
  cost: { resource: 'mana', amount: 168 },
  castTimeMs: SEARING_PAIN_CAST_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      baseAmount: SEARING_PAIN_DAMAGE,
      powerCoefficient: SEARING_PAIN_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
  unmodelled: 'Its "high amount of threat" does nothing; the engine does not track threat.',
};

/*
 * ============================================================================
 * WRACK, the Affliction capstone: "Tears the target apart from within, dealing
 * 36 Shadow damage every 1 sec and increasing the damage they take from your
 * other Shadow damage over time effects by 10%. Lasts 6 sec." 200 mana, a
 * six-second CHANNEL, new in Forever and rank 1 IS max.
 *
 * ----------------------------------------------------------------------------
 * BOTH HALVES NOW APPLY, AND THE SECOND ONE IS THE REASON TO CAST IT.
 *
 * ITS COEFFICIENT IS 14.3% OF SPELL POWER PER TICK, supplied by the ruleset
 * owner directly rather than by `WoWSimWorksheet.xlsx`, which has no Wrack row.
 * The provenance is recorded at `WRACK_TICK_SP_COEFFICIENT`, because it is the
 * one row in that file which a refresh of the sheet will not contain.
 *
 * ITS +10% TO YOUR OTHER SHADOW DoTs IS APPLIED NOW, through
 * `periodicDamageTakenBySchool` on `WRACK_AMPLIFICATION`. The old reason for
 * its absence was specific enough to re-read and named the field it wanted: a
 * plain Shadow vulnerability would also raise Shadow Bolt, at over half of the
 * SM/DS profile's damage, so the clause waited for a PERIODIC-only one. It is
 * the fourth time in this project a reason written that way has expired
 * usefully.
 *
 * AND IT IS IN THE SM/DS LIST NOW. The owner paused it -- "it's unimportant for
 * the rest of the simulator for now, there isn't a profile that uses it" -- and
 * has since un-paused it, at the position and on the condition the list's own
 * comment had been carrying all along: between Life Tap and Shadow Bolt, gated
 * on all three bleeds having six seconds left.
 *
 * WORTH +5.6 DPS, AND IT RESHAPES THE PROFILE OUT OF ALL PROPORTION TO THAT.
 * 435.9 to 441.5 over thirty batches of ten, and in exchange Shadow Bolt falls
 * from 14.8 casts a fight to 5.6 and from 51.1% of the damage to 20.2%, while
 * Wrack takes 30.3%. **A list can change completely and be worth almost
 * nothing**, which this project has now measured three times -- and the uses
 * column is what says the list changed at all.
 *
 * THE ARITHMETIC THAT SAID IT COULD NOT BE WORTH CASTING WAS NEARLY RIGHT. Six
 * ticks at 14.3% is 0.858 over the channel against Shadow Bolt's 0.857 in half
 * the time, so the direct damage is roughly a wash per second; what pays for it
 * is the amplification on the three bleeds plus the 200 mana against Shadow
 * Bolt's 380. The margin is thin and REAL, which is why it took the full
 * method -- one batch of ten read +12.9, more than twice the truth.
 * ----------------------------------------------------------------------------
 */
export const WRACK_TICK_DAMAGE = 36;
export const WRACK_TICKS = 6;
export const WRACK_CHANNEL_MS = seconds(WRACK_TICKS);

/**
 * Soul Siphon and Improved Drains both reach Wrack, and nothing else here.
 *
 * ----------------------------------------------------------------------------
 * BOTH TALENTS NAME "DRAIN LIFE, DRAIN SOUL AND WRACK", and Wrack is the only
 * one of the three this project declares -- so both were `unmodelled` with a
 * reason that already said Wrack was declared and had not been acted on. SM/DS
 * spends SIX of its fifty-one points across the pair.
 *
 * SOUL SIPHON IS READ AT CAST TIME rather than being a standing modifier,
 * because its size depends on what is on the target: "+{0}% per each of your
 * other Affliction effects active on the target, up to {1}%". That is what
 * `abilityBonus` is for -- a named number handed to one ability and read by its
 * own `onCast`.
 *
 * WHICH EFFECTS COUNT IS AN INTERPRETATION AND IT IS NAMED.
 * `WARLOCK_AFFLICTION_PERIODICS` is the declared subset of the Affliction tab;
 * Bane of Doom, Drain Life and Drain Soul are in the source's spellbook and not
 * in this project, so a fully-loaded target counts three here where the ruleset
 * would allow more. The talent's own `unmodelled` clause says so, rather than
 * this constant pretending to be the whole tab.
 * ----------------------------------------------------------------------------
 */
export const WRACK_SOUL_SIPHON_PER_EFFECT = 'soulSiphonPerEffect';
export const WRACK_SOUL_SIPHON_CAP = 'soulSiphonCap';

export const WRACK: Ability = {
  id: 'wrack',
  name: 'Wrack',
  cost: { resource: 'mana', amount: 200 },
  castTimeMs: WRACK_CHANNEL_MS,
  channelTicks: WRACK_TICKS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;

    /*
     * THE DEBUFF FIRST, and it refuses to refresh -- so the six seconds run
     * from the first tick of the channel and not from the last. See
     * `WRACK_AMPLIFICATION`.
     */
    simulation.applyAura(target, WRACK_AMPLIFICATION, caster.id);

    /*
     * SOUL SIPHON, COUNTED PER TICK rather than once for the channel, because
     * a bleed the rotation refreshed halfway through should raise the ticks
     * after it and not the ones before. Capped by the talent's own second
     * number; a build without the talent reads 0 for both and multiplies by 1.
     */
    const perEffect = ability.bonuses?.[WRACK_SOUL_SIPHON_PER_EFFECT] ?? 0;
    const cap = ability.bonuses?.[WRACK_SOUL_SIPHON_CAP] ?? 0;
    const active = WARLOCK_AFFLICTION_PERIODICS.filter((id) => target.auras.has(id)).length;
    const siphon = 1 + Math.min(active * perEffect, cap) / 100;

    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'shadow',
      /*
       * PER TICK, and `onCast` runs once per channel tick, so this is the
       * per-tick figure and not the total. The coefficient is ADDED to the flat
       * 36 rather than replacing it -- the owner's standing instruction with the
       * sheet was to make sure flat ability damage does not get lost.
       *
       * SOUL SIPHON SCALES BOTH TERMS, which is what "increases the damage done"
       * means: scaling the flat half alone would make the talent worth less the
       * better the gear, which is the opposite of every other damage talent here.
       */
      baseAmount: WRACK_TICK_DAMAGE * siphon,
      powerCoefficient: WRACK_TICK_SP_COEFFICIENT * siphon,
      attackTable: ability.attackTable,
    });
  },
};

export const WARLOCK_DESTRUCTION_SPELLS: readonly string[] = [
  'shadow_bolt',
  'immolate',
  'incinerate',
  'conflagrate',
  'shadowburn',
  'searing_pain',
];

/**
 * The periodic Affliction effects Pandemic and Soul Siphon both count.
 *
 * DECLARED ONES ONLY, and the two talents name more than this between them --
 * Bane of Doom, Drain Life and Drain Soul are in the spellbook capture and not
 * in this project. Each talent carries its own `unmodelled` clause saying so,
 * rather than this list pretending to be complete.
 */
export const WARLOCK_AFFLICTION_PERIODICS: readonly string[] = [
  'corruption',
  'bane_of_agony',
  'siphon_life',
];

export const WARLOCK_ABILITIES: readonly Ability[] = [
  SHADOW_BOLT,
  CORRUPTION_ABILITY,
  BANE_OF_AGONY_ABILITY,
  SIPHON_LIFE_ABILITY,
  LIFE_TAP,
  IMMOLATE_ABILITY,
  INCINERATE,
  CONFLAGRATE,
  SHADOWBURN,
  SEARING_PAIN,
  // Granted by the Affliction capstone; `grantsByAbility` gates it.
  WRACK,
];
