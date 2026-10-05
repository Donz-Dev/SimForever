import type { CastReaction } from '../../engine';
import { dealDamage, isWeaponUse, seconds } from '../../engine';
import type { TalentReactionBuilder } from './warriorTalents';
import { flurry } from './warriorTalents';
import {
  ELEMENTAL_FOCUS_CLEARCASTING,
  SHAMAN_DAMAGE_SPELL_IDS,
  elementalDevastationAura,
  improvedStormstrikeAura,
  maelstromWeaponAura,
} from '../auras/shaman';
import {
  CHAIN_LIGHTNING_COEFFICIENT,
  CHAIN_LIGHTNING_DAMAGE,
  LIGHTNING_BOLT_COEFFICIENT,
  LIGHTNING_BOLT_DAMAGE,
} from '../abilities/shaman';
import { ppmChance, triggeringSpeedSeconds } from '../items/procs';

/**
 * Shaman talent procs.
 *
 * ----------------------------------------------------------------------------
 * FLURRY IS THE WARRIOR'S, REUSED RATHER THAN RETYPED. Both read "increases
 * your attack speed by {0}% for your next 3 swings after dealing a melee
 * critical strike" -- the same effect at a different percentage, which is
 * exactly what a `TalentReactionBuilder` takes. Copying it would have been two
 * files to keep in step, and the copy would be the one that went stale.
 *
 * The builder is per-class-registry-keyed, so the Shaman's five ranks reach
 * the same code with 25 where a Warrior's reach it with 30.
 *
 * AND SHARING IT MEANS SHARING A RULING. When the owner widened Flurry's trigger
 * to any non-DoT critical strike, that reached the Shaman through this import and
 * moved Enh Shaman by +10.5 DPS -- a figure with nothing to do with the Warrior.
 * The reuse is still right; what it needs is that a change to the Warrior's copy
 * is measured on the SHAMAN too. It was split in two for one PR while the owner
 * ruled on this class, and is one builder again now that they have.
 * ----------------------------------------------------------------------------
 */

/**
 * Elemental Devastation: a spell crit raises MELEE crit.
 *
 * THE TRIGGER IS A SPELL AND THE PAYOUT IS MELEE, which is why the usual
 * `isWeaponUse` test is inverted here: this is the one reaction in the project
 * that fires on something that is NOT a weapon use. A Stormstrike crit does
 * not arm it; a Lightning Bolt crit does.
 *
 * "Offensive spell critical strikes" -- so a periodic tick of Flame Shock
 * counts, because it crits off the spell table and is offensive. Nothing here
 * excludes it and nothing in the tooltip does either.
 */
export const elementalDevastation: TalentReactionBuilder = (critPercent) => ({
  id: 'elemental_devastation',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (_context, _actor, attack) => !isWeaponUse(attack),
  onTrigger: (context, actor) => {
    context.applyAura(actor, elementalDevastationAura(critPercent), actor.id);
  },
});

/**
 * Maelstrom Weapon: melee damage stacks a discount on the next Lightning Bolt.
 *
 * ----------------------------------------------------------------------------
 * FIVE PROCS PER MINUTE, the ruleset owner's ruling, given 2026-09-30 when the
 * missing rate was asked for. It replaces a flat 20% chance that was the last
 * `PLACEHOLDER_` number in this class.
 *
 * THE SHAPE CHANGED AND NOT ONLY THE NUMBER, which is the part worth reading.
 * "When you deal damage with a melee attack, you have A CHANCE" is a flat
 * per-hit chance on its face -- and a flat chance is worth more to a FAST
 * weapon, because a fast weapon hits more often. PPM is the normalisation that
 * removes exactly that: `speed / 60 x PPM`, so a slow two-hander and a fast one
 * hand proc the same number of times a minute. The two readings are not the
 * same talent, and picking the wrong one is invisible -- both produce an
 * ordinary uptime and an ordinary figure.
 *
 * WHICH DIRECTION IT MOVES THIS BUILD: Enhancement swings a two-hander, so the
 * old flat 20% was the worse reading for it. At a 3.4 second weapon the PPM
 * chance is 28.3%, and every Windfury extra attack rolls it too.
 *
 * THE OPPOSITE ARRANGEMENT LIVES NEXT DOOR AND MUST NOT BE MADE TO MATCH. A
 * Rogue's poison is "each strike has a 20% chance", flat per strike and
 * deliberately NOT normalised, so a fast off hand really does poison more
 * often. CLAUDE.md carries both rules side by side for this reason.
 *
 * THE VALUE HANDED TO THE BUILDER IS THE REDUCTION -- 4/8/12/16/20 by rank,
 * index 0 -- and not the rate. The first version of this file passed it in as
 * the CHANCE, so the reduction was being rolled as the proc rate: a 20% rate
 * that looked completely ordinary because 20% IS an ordinary proc rate. Kept on
 * the record because the same mistake is available to anyone editing the line
 * below.
 * ----------------------------------------------------------------------------
 */
export const MAELSTROM_WEAPON_PPM = 5;

export const maelstromWeapon: TalentReactionBuilder = (reductionPercentPerStack) => ({
  id: 'maelstrom_weapon',
  on: 'dealt',
  outcomes: ['hit', 'crit', 'glance', 'crush'],
  canTrigger: (context, actor, attack) => {
    if (!isWeaponUse(attack)) return false;
    const speed = triggeringSpeedSeconds(actor, attack.weaponSlot);
    if (speed === undefined || speed <= 0) return false;
    return context.rng.nextFloat(0, 1) < ppmChance(speed, MAELSTROM_WEAPON_PPM);
  },
  onTrigger: (context, actor) => {
    // `applyAura` adds a stack itself, up to `maxStacks`, and resets the
    // thirty seconds. Setting `stacks` here as well would count every proc
    // twice -- which the Warrior's Flurry does deliberately and this must not.
    context.applyAura(actor, maelstromWeaponAura(reductionPercentPerStack), actor.id);
  },
});

/*
 * ============================================================================
 * ELEMENTAL FOCUS: A CAST, NOT A HIT.
 *
 * "Gives you a 10% chance to enter a Clearcasting state AFTER CASTING any Fire,
 * Frost, or Nature damage spell."
 *
 * A `CastReaction` and not a `Reaction`, and the difference is the whole point.
 * The Mage's Arcane Concentration is the same payout off "after any damage
 * spell HITS a target", which is a damage reaction -- so a resisted spell rolls
 * nothing there and does roll here. Building this as a copy of the Mage's would
 * have made it quietly worse by the Shaman's spell miss chance, and nothing
 * would have failed.
 *
 * IT CANNOT PAY FOR THE CAST THAT PRODUCED IT. `runCast` runs `onCast` and
 * consumes cast charges BEFORE the cast reactions, so the spell that rolls this
 * has already settled its own cost. That ordering is load-bearing elsewhere in
 * the engine and is relied on here rather than re-derived.
 *
 * THE VALUE IS THE CHANCE. The talent's other number, the 100% reduction, is the
 * aura's `costFraction: 1` and needs no per-rank figure -- see the note in
 * `values/shaman.json`, hand-filled because a single-rank talent has no `{0}`
 * for the importer to match.
 * ============================================================================
 */
export const elementalFocus = (chancePercent: number): CastReaction => ({
  id: 'elemental_focus',
  canTrigger: (context, _actor, cast) =>
    SHAMAN_DAMAGE_SPELL_IDS.includes(cast.ability.id) &&
    context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    context.applyAura(actor, ELEMENTAL_FOCUS_CLEARCASTING, actor.id);
  },
});

/*
 * ============================================================================
 * LIGHTNING OVERLOAD: "a 10% chance to cast a SECOND, SIMILAR SPELL on the same
 * target at no additional cost that causes half damage and no threat."
 *
 * ----------------------------------------------------------------------------
 * A CAST REACTION THAT DEALS DAMAGE, which is the first one in the project --
 * every other `CastReaction` grants a resource or spends a charge. It is not a
 * second CAST: nothing re-enters `runCast`, so the copy takes no global
 * cooldown, no cast time and no mana, which is exactly what "at no additional
 * cost" says and is also why it cannot overload itself.
 *
 * IT CARRIES THE SOURCE SPELL'S `abilityId` AND ITS OWN NAME, and that pairing
 * is deliberate:
 *
 *   the ID    is what per-ability modifiers key off, so the copy is reached by
 *             Concussion's damage and Call of Thunder's crit exactly as the
 *             original is. "A second, SIMILAR spell" has to mean a spell the
 *             character's own talents apply to.
 *   the NAME  is what the damage analyzer groups by, so the copy gets its own
 *             line in the breakdown and the talent can be seen to be worth what
 *             it is worth.
 *
 * Using the same name for both would fold it into Lightning Bolt and make it
 * unmeasurable; giving it its own id would strip every modifier and make it
 * quietly worth less. Neither failure would look wrong.
 *
 * HALF THE BASE AND HALF THE COEFFICIENT, so "half damage" is half of the
 * spell rather than half of its flat term with full scaling. Halving only the
 * base would leave an overload worth MORE than half at high spell power, which
 * is the opposite of what a copy should do.
 *
 * HALF OF THE SPELL'S OWN DAMAGE, NOT OF WHAT THE CAST DEALT. Stormstrike's
 * +20% is spent by the bolt that consumed the debuff, and this copy reads the
 * ability's base constant rather than that buffed figure. It is an
 * interpretation, and it is unreachable in both Shaman profiles -- the
 * Elemental build takes Lightning Overload and no Stormstrike, the Enhancement
 * build the other way round -- so it is recorded rather than measured.
 *
 * THE RE-ENTRY GUARD MEANS THE COPY PROCS NOTHING. `runCastReactions` sets the
 * reacting flag, so the damage this deals reaches no `dealt` reaction:
 * Elemental Devastation would not see an overload crit. No profile takes both
 * talents, so that is a stated consequence rather than a live one.
 * ============================================================================
 */
export const LIGHTNING_OVERLOAD_FRACTION = 0.5;

/** The two spells the talent names, with the numbers a copy of each needs. */
const OVERLOADABLE: ReadonlyMap<
  string,
  { readonly name: string; readonly damage: number; readonly coefficient: number }
> = new Map([
  [
    'lightning_bolt',
    {
      name: 'Lightning Bolt',
      damage: LIGHTNING_BOLT_DAMAGE,
      coefficient: LIGHTNING_BOLT_COEFFICIENT,
    },
  ],
  [
    'chain_lightning',
    {
      name: 'Chain Lightning',
      damage: CHAIN_LIGHTNING_DAMAGE,
      coefficient: CHAIN_LIGHTNING_COEFFICIENT,
    },
  ],
]);

export const lightningOverload = (chancePercent: number): CastReaction => ({
  id: 'lightning_overload',
  canTrigger: (context, _actor, cast) =>
    cast.target !== undefined &&
    OVERLOADABLE.has(cast.ability.id) &&
    context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor, cast) => {
    const copy = OVERLOADABLE.get(cast.ability.id);
    if (!copy || !cast.target) return;
    dealDamage(context, {
      source: actor,
      target: cast.target,
      abilityId: cast.ability.id,
      abilityName: copy.name + ' (Overload)',
      school: 'nature',
      baseAmount: copy.damage * LIGHTNING_OVERLOAD_FRACTION,
      powerCoefficient: copy.coefficient * LIGHTNING_OVERLOAD_FRACTION,
      attackTable: 'spell',
    });
  },
});

/*
 * ============================================================================
 * IMPROVED STORMSTRIKE'S MANA CLAUSE: "When you Stormstrike, you have a 100%
 * chance to gain 50% mana regeneration while casting spells for 15 sec."
 *
 * A CAST REACTION BECAUSE THE TOOLTIP SAYS "WHEN YOU STORMSTRIKE" AND NOT "WHEN
 * STORMSTRIKE HITS". A dodged Stormstrike is still a Stormstrike cast, and the
 * same distinction Elemental Focus turns on decides this one.
 *
 * TWO OF ITS THREE NUMBERS DO NOT VARY BY RANK. The values file reads
 * `[[50,50,15,50],[100,50,15,100]]`: the chance at index 0 goes 50 to 100 and
 * the dodge/parry reset at index 3 with it, while the bypass at index 1 is 50 at
 * both ranks and the duration at index 2 is 15 at both. A reaction builder takes
 * ONE number, so it takes the one that moves and the two that do not are named
 * here. The Mage's Missile Barrage is the same arrangement for the same reason,
 * and `shamanAbilities.test.ts` asserts both constants against the values file
 * at every rank so a data change cannot leave them behind.
 *
 * ITS SECOND CLAUSE IS THE INERT ONE, and the talent's `unmodelled` reason used
 * to cover both with a single sentence about dodging -- so a clause that has
 * been expressible since the first caster was reported as blocked by a clause
 * that genuinely is not.
 * ============================================================================
 */
export const IMPROVED_STORMSTRIKE_BYPASS_PERCENT = 50;
export const IMPROVED_STORMSTRIKE_DURATION_MS = seconds(15);

export const improvedStormstrike = (chancePercent: number): CastReaction => ({
  id: 'improved_stormstrike',
  abilityId: 'stormstrike',
  canTrigger: (context) => context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    context.applyAura(
      actor,
      improvedStormstrikeAura(
        IMPROVED_STORMSTRIKE_BYPASS_PERCENT,
        IMPROVED_STORMSTRIKE_DURATION_MS,
      ),
      actor.id,
    );
  },
});

/** Procs that fire on a cast, by the talent that grants them. */
export const SHAMAN_CAST_REACTIONS: Readonly<Record<string, (value: number) => CastReaction>> = {
  elemental_focus: elementalFocus,
  lightning_overload: lightningOverload,
  improved_stormstrike: improvedStormstrike,
};

export const SHAMAN_TALENT_REACTIONS: Readonly<Record<string, TalentReactionBuilder>> = {
  /*
   * THE WARRIOR'S BUILDER, BROAD TRIGGER AND ALL, by the ruleset owner's ruling
   * -- ANY non-DoT critical strike refreshes Flurry, for the Shaman as well.
   *
   * IT IS WORTH +10.5 DPS HERE AND NOTHING ON THE WARRIOR, because a Shaman
   * crits with Lightning Bolt, Flame Shock and Earth Shock where DW Fury's list
   * casts nothing off a weapon: Enh Shaman 593.5 to 604.0. The owner ruled the
   * Warrior first and this second, and it shipped narrow for exactly one PR in
   * between -- so the figure in the baseline moved on a ruling rather than on a
   * fix, which is worth knowing when reading the history.
   *
   * Both tooltips say "after dealing a MELEE critical strike". The override is
   * deliberate in both places; see `flurry`.
   */
  flurry,
  elemental_devastation: elementalDevastation,
  maelstrom_weapon: maelstromWeapon,
};
