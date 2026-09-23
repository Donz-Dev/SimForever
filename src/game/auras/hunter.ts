import type { AuraDefinition } from '../../engine';
import { RATING_PER_PERCENT, dealDamage, flat, seconds } from '../../engine';

/**
 * Hunter auras, from the WoW Forever beta client and the Forever Hunter wiki.
 *
 * ----------------------------------------------------------------------------
 * A SECOND SOURCE OF RECORD ARRIVES HERE. The ruleset owner named
 * `github.com/classic-hunter/forever-hunter/wiki` as the reference for pet
 * scaling, and it turned out to carry a full Forever-versus-Classic diff for
 * the whole class -- every changed ability's new numbers, the pet stat
 * formulas, and which talents are new. Where it and the spellbook overlap they
 * agree; where only the wiki has something -- pet scaling, focus regeneration
 * -- it is the only source there is.
 *
 * DAMAGE-OVER-TIME EFFECTS CRIT AT RANGED CRIT AND DO NOT SNAPSHOT, which the
 * wiki states outright: "DoTs dynamically recalculate damage rather than
 * snapshotting Attack Power when applied". A periodic tick here already reads
 * the source's live stats, so that is the engine's existing behaviour rather
 * than anything new.
 * ----------------------------------------------------------------------------
 */

const NATURE = 'nature' as const;
const PHYSICAL = 'physical' as const;

/** A flat percentage as the engine's own haste rating. */
const hasteFromPercent = (percent: number) =>
  flat('hasteRating', percent * RATING_PER_PERCENT.haste);

// ---------------------------------------------------------------------------
// Aspects -- one at a time, like a stance or a seal
// ---------------------------------------------------------------------------

/** "Only one Aspect can be active at a time." */
export const ASPECT_AURA_IDS = ['aspect_of_the_hawk', 'aspect_of_the_beast'] as const;

export const ASPECT_OF_THE_HAWK_ATTACK_POWER = 120;

export const ASPECT_OF_THE_HAWK: AuraDefinition = {
  id: 'aspect_of_the_hawk',
  name: 'Aspect of the Hawk',
  durationMs: 0,
  statModifiers: [flat('rangedAttackPower', ASPECT_OF_THE_HAWK_ATTACK_POWER)],
};

/**
 * Aspect of the Beast: "increasing Melee Attack Power by 110."
 *
 * EXPANDED FROM ONE RANK TO FOUR IN FOREVER and it now grants melee attack
 * power, which Classic's did not -- the wiki lists it as a change and gives
 * the progression 50/70/90/110. It is what makes a Lone Wolf MELEE hunter a
 * build at all.
 */
export const ASPECT_OF_THE_BEAST_ATTACK_POWER = 110;

export const ASPECT_OF_THE_BEAST: AuraDefinition = {
  id: 'aspect_of_the_beast',
  name: 'Aspect of the Beast',
  durationMs: 0,
  statModifiers: [flat('attackPower', ASPECT_OF_THE_BEAST_ATTACK_POWER)],
};

// ---------------------------------------------------------------------------
// Stings
// ---------------------------------------------------------------------------

/**
 * Serpent Sting: "555 Nature damage over 15 sec", and in Forever it SCALES.
 *
 * ----------------------------------------------------------------------------
 * THE FIRST ATTACK POWER COEFFICIENT ON A DOT IN THIS PROJECT, and the wiki
 * states it twice over: "Now scales with 15% RAP over the full duration" and
 * "Each tick gains 3% RAP". Five ticks of 3% is 15%, so the two agree exactly
 * -- which is the reading that reproduces both statements, and it is why the
 * cadence is three seconds rather than anything else.
 *
 * NOT SNAPSHOT. "Changes to RAP while active affect subsequent ticks", so
 * Rapid Fire landing mid-sting raises the ticks after it. The tick reads the
 * source's live stats, which is what makes that free.
 *
 * TICKS CRIT AT RANGED CRIT. "Hunter DoTs use ranged Crit", which `critFrom`
 * names directly.
 * ----------------------------------------------------------------------------
 */
export const SERPENT_STING_TOTAL = 555;
export const SERPENT_STING_DURATION_MS = seconds(15);
export const SERPENT_STING_TICK_INTERVAL_MS = seconds(3);
export const SERPENT_STING_RAP_PER_TICK = 0.03;

export const SERPENT_STING: AuraDefinition = {
  id: 'serpent_sting',
  name: 'Serpent Sting',
  durationMs: SERPENT_STING_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: SERPENT_STING_TICK_INTERVAL_MS,
    onTick: (context, aura) => {
      const source = context.combatant(aura.sourceId);
      const target = context.combatant(aura.targetId);
      if (!source || !target || !target.isAlive) return;

      const ticks = SERPENT_STING_DURATION_MS / SERPENT_STING_TICK_INTERVAL_MS;
      const rangedAttackPower = source.stats.effective.rangedAttackPower;

      dealDamage(context, {
        source,
        target,
        abilityId: aura.id,
        abilityName: aura.name,
        school: NATURE,
        baseAmount:
          SERPENT_STING_TOTAL / ticks + rangedAttackPower * SERPENT_STING_RAP_PER_TICK,
        // The attack power is already in `baseAmount`, read LIVE off the
        // source every tick -- which is what "does not snapshot" means.
        powerCoefficient: 0,
        periodic: true,
        critFrom: 'ranged-special',
        appliesArmor: false,
      });
    },
  },
};

// ---------------------------------------------------------------------------
// Cooldowns and procs
// ---------------------------------------------------------------------------

/** "Increases ranged and melee attack speed by 40% for 15 sec." */
export const RAPID_FIRE_HASTE_PERCENT = 40;
export const RAPID_FIRE_DURATION_MS = seconds(15);

export const RAPID_FIRE: AuraDefinition = {
  id: 'rapid_fire',
  name: 'Rapid Fire',
  durationMs: RAPID_FIRE_DURATION_MS,
  refreshBehaviour: 'reset',
  statModifiers: [hasteFromPercent(RAPID_FIRE_HASTE_PERCENT)],
};

/**
 * Deadly Aspects: "While Aspect of the Hawk is active, Auto Shot has a 10%
 * chance of increasing ranged attack speed by 30% for 12 sec."
 *
 * REPLACED IMPROVED ASPECT OF THE HAWK, and the Beast half is new -- the same
 * proc off melee auto-attacks while Aspect of the Beast is up. One aura serves
 * both, because haste is haste and the engine has one haste rating.
 */
export const DEADLY_ASPECTS_HASTE_PERCENT = 30;
export const DEADLY_ASPECTS_DURATION_MS = seconds(12);

export const DEADLY_ASPECTS: AuraDefinition = {
  id: 'deadly_aspects',
  name: 'Deadly Aspects',
  durationMs: DEADLY_ASPECTS_DURATION_MS,
  refreshBehaviour: 'reset',
  statModifiers: [hasteFromPercent(DEADLY_ASPECTS_HASTE_PERCENT)],
};

/** Frenzy: "a {0}% chance to gain a 30% attack speed increase for 8 sec". */
export const FRENZY_HASTE_PERCENT = 30;
export const FRENZY_DURATION_MS = seconds(8);

export const FRENZY: AuraDefinition = {
  id: 'frenzy',
  name: 'Frenzy',
  durationMs: FRENZY_DURATION_MS,
  refreshBehaviour: 'reset',
  statModifiers: [hasteFromPercent(FRENZY_HASTE_PERCENT)],
};

/** Bestial Wrath: "causing 50% additional damage for 18 sec". */
export const BESTIAL_WRATH_DAMAGE = 1.5;
export const BESTIAL_WRATH_DURATION_MS = seconds(18);

export const BESTIAL_WRATH: AuraDefinition = {
  id: 'bestial_wrath',
  name: 'Bestial Wrath',
  durationMs: BESTIAL_WRATH_DURATION_MS,
  damageDoneMultiplier: BESTIAL_WRATH_DAMAGE,
};

/**
 * Summon Hawk, modelled as a repeating strike rather than as a creature.
 *
 * ----------------------------------------------------------------------------
 * THE RULESET OWNER'S CALL. A hawk is a TEMPORARY summon -- "continuing its
 * assault for 18 sec", up to two at once -- and the engine cannot add a
 * combatant mid-fight. Asked which way to go, the owner chose to model it
 * without a real combatant: a periodic effect on the Hunter that deals the
 * hawk's damage on its own timer.
 *
 * SO THE DAMAGE IS RIGHT AND THE ACTOR IS NOT THERE. It lands on the target,
 * it is credited to the Hunter, and it appears in the breakdown as its own
 * row. What is lost is that a hawk is not separately targetable and cannot be
 * killed, neither of which any encounter here does.
 *
 * TWO AT ONCE IS TRACKED AND ONLY ONE DEALS DAMAGE. `maxStacks` is two and the
 * periodic fires once per AURA rather than once per stack, so the second hawk
 * adds nothing. That is the one part of this that understates and it says so.
 * ----------------------------------------------------------------------------
 */
export const HAWK_DAMAGE_PER_STRIKE = 32;
export const HAWK_DURATION_MS = seconds(18);
export const HAWK_STRIKE_INTERVAL_MS = seconds(2);
export const HAWK_MAX_ACTIVE = 2;

export const HAWK_UNMODELLED =
  'A hawk is modelled as a repeating strike rather than as a creature, on the ' +
  'ruleset owner’s call -- the engine cannot add a combatant mid-fight. Its ' +
  'damage lands and is credited. What is missing is that only ONE hawk deals ' +
  'damage, so the second of the two it can have adds nothing and this ' +
  'understates.';

export const SUMMON_HAWK_AURA: AuraDefinition = {
  id: 'summon_hawk',
  name: 'Hawk',
  durationMs: HAWK_DURATION_MS,
  maxStacks: HAWK_MAX_ACTIVE,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: HAWK_STRIKE_INTERVAL_MS,
    onTick: (context, aura) => {
      const source = context.combatant(aura.sourceId);
      if (!source) return;
      const target = context.defaultTargetFor(source);
      if (!target || !target.isAlive) return;

      dealDamage(context, {
        source,
        target,
        abilityId: aura.id,
        abilityName: aura.name,
        school: PHYSICAL,
        baseAmount: HAWK_DAMAGE_PER_STRIKE,
        powerCoefficient: 0,
        periodic: true,
        critFrom: 'ranged-special',
        appliesArmor: false,
      });
    },
  },
};

/**
 * Lone Wolf: "You deal 20% increased damage with all attacks while you do not
 * have an active pet."
 *
 * THE CONDITION IS CHECKED WHERE THE PET IS DECIDED, not here. A build with
 * the talent is given no pet at all, so "while you do not have an active pet"
 * is always true for it -- which is the honest reading of a talent whose whole
 * point is that you chose not to bring one.
 */
export const LONE_WOLF_DAMAGE = 1.2;

export const LONE_WOLF: AuraDefinition = {
  id: 'lone_wolf',
  name: 'Lone Wolf',
  durationMs: 0,
  damageDoneMultiplier: LONE_WOLF_DAMAGE,
};
