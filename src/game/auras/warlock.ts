import type { AuraDefinition } from '../../engine';
import { dealDamage, seconds } from '../../engine';

/**
 * Warlock auras, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * ----------------------------------------------------------------------------
 * THE LAST CLASS, AND IT BRINGS NO PET EITHER. Both of the ruleset owner's
 * profiles take DEMONIC SACRIFICE -- "sacrifices your summoned Demon ...
 * granting you an effect that lasts 2 hrs" -- so both summon a demon, kill it,
 * and keep the buff. The profile names say which: SM/DS sacrifices the Imp for
 * +15% Shadow, and Firelock the Succubus for +15% Fire.
 *
 * That makes this the second class running whose builds opt out of the pet
 * system, after both Lone Wolf hunters. The pet work the Hunter needed is not
 * wasted -- it is simply not what these two profiles do.
 *
 * MOST OF A WARLOCK IS DAMAGE OVER TIME, which is why so much of this file is
 * periodic. Five of the SM/DS build's talents raise periodic damage
 * specifically, and the engine has crit-capable DoTs already.
 * ----------------------------------------------------------------------------
 */

const SHADOW = 'shadow' as const;
const FIRE = 'fire' as const;

/** One tick of a Warlock damage-over-time effect. */
function tick(
  context: Parameters<NonNullable<AuraDefinition['periodic']>['onTick']>[0],
  aura: Parameters<NonNullable<AuraDefinition['periodic']>['onTick']>[1],
  amount: number,
  school: typeof SHADOW | typeof FIRE,
): void {
  const source = context.combatant(aura.sourceId);
  const target = context.combatant(aura.targetId);
  if (!source || !target || !target.isAlive) return;

  dealDamage(context, {
    source,
    target,
    abilityId: aura.id,
    abilityName: aura.name,
    school,
    baseAmount: amount,
    // No coefficient is stated for any Warlock spell, as for every caster
    // before this one. None is invented.
    powerCoefficient: 0,
    periodic: true,
    critFrom: 'spell',
    appliesArmor: false,
  });
}

// ---------------------------------------------------------------------------
// Affliction
// ---------------------------------------------------------------------------

/** Corruption: "438 Shadow damage over 18 sec". Six ticks of 73. */
export const CORRUPTION_TOTAL = 438;
export const CORRUPTION_DURATION_MS = seconds(18);
export const CORRUPTION_TICK_INTERVAL_MS = seconds(3);

export const CORRUPTION: AuraDefinition = {
  id: 'corruption',
  name: 'Corruption',
  durationMs: CORRUPTION_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: CORRUPTION_TICK_INTERVAL_MS,
    onTick: (context, aura) =>
      tick(
        context,
        aura,
        CORRUPTION_TOTAL / (CORRUPTION_DURATION_MS / CORRUPTION_TICK_INTERVAL_MS),
        SHADOW,
      ),
  },
};

/**
 * Bane of Agony: "552 Shadow damage over 24 sec. This damage is dealt SLOWLY
 * AT FIRST, and builds up as the Bane reaches its full duration."
 *
 * ----------------------------------------------------------------------------
 * THE RAMP IS DESCRIBED AND NOT QUANTIFIED. The tooltip says the shape without
 * giving it: Classic's is three bands of four ticks at 50%, 100% and 150% of
 * the average, and nothing in Forever's data says whether that survived.
 *
 * SO IT TICKS FLAT, at 552 over eight ticks. The TOTAL is the source's own and
 * is exactly right over the full duration; what is wrong is the distribution
 * inside it -- too much early, too little late. Over a sixty-second fight in
 * which the Bane is re-applied at most twice, that difference is small and the
 * total is what shows.
 *
 * Borrowing Classic's three bands would be a guess dressed as precision, so
 * the flat reading is used and the caveat is printed on the ability.
 * ----------------------------------------------------------------------------
 */
export const BANE_OF_AGONY_TOTAL = 552;
export const BANE_OF_AGONY_DURATION_MS = seconds(24);
export const BANE_OF_AGONY_TICK_INTERVAL_MS = seconds(3);

export const BANE_OF_AGONY_UNMODELLED =
  'It ticks FLAT. The tooltip says the damage "is dealt slowly at first, and ' +
  'builds up", and states no figures for the ramp -- Classic uses three bands ' +
  'of 50/100/150% and nothing says Forever kept them. The 24-second total is ' +
  'the source’s own and is exact; only its distribution inside the duration ' +
  'is flattened.';

export const BANE_OF_AGONY: AuraDefinition = {
  id: 'bane_of_agony',
  name: 'Bane of Agony',
  durationMs: BANE_OF_AGONY_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: BANE_OF_AGONY_TICK_INTERVAL_MS,
    onTick: (context, aura) =>
      tick(
        context,
        aura,
        BANE_OF_AGONY_TOTAL / (BANE_OF_AGONY_DURATION_MS / BANE_OF_AGONY_TICK_INTERVAL_MS),
        SHADOW,
      ),
  },
};

/**
 * Siphon Life: "Transfers 41 health from the target to the caster every 3 sec.
 * Lasts 30 sec."
 *
 * THE DAMAGE HALF APPLIES AND THE HEAL DOES NOT. The engine has a healing
 * pipeline and no Warlock profile is attacked, so the health transferred back
 * would land on a character at full. Stated on the ability rather than
 * silently dropped.
 */
export const SIPHON_LIFE_PER_TICK = 41;
export const SIPHON_LIFE_DURATION_MS = seconds(30);
export const SIPHON_LIFE_TICK_INTERVAL_MS = seconds(3);

export const SIPHON_LIFE: AuraDefinition = {
  id: 'siphon_life',
  name: 'Siphon Life',
  durationMs: SIPHON_LIFE_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: SIPHON_LIFE_TICK_INTERVAL_MS,
    onTick: (context, aura) => tick(context, aura, SIPHON_LIFE_PER_TICK, SHADOW),
  },
};

/**
 * Improved Shadow Bolt: "Your Shadow Bolt critical strikes increase Shadow
 * damage taken by the target from your attacks by {0}% for 12 sec."
 *
 * ON THE TARGET AND PER SCHOOL, which `damageTakenBySchool` is exactly. Note
 * it says "from your attacks" -- the engine has one target, so a debuff that
 * only the applier benefits from and one that everybody benefits from are the
 * same thing here.
 */
export const IMPROVED_SHADOW_BOLT_DURATION_MS = seconds(12);

export function improvedShadowBoltAura(percent: number): AuraDefinition {
  return {
    id: 'improved_shadow_bolt',
    name: 'Improved Shadow Bolt',
    durationMs: IMPROVED_SHADOW_BOLT_DURATION_MS,
    isDebuff: true,
    refreshBehaviour: 'reset',
    damageTakenBySchool: { shadow: 1 + percent / 100 },
  };
}

/**
 * Shadow Trance, from Nightfall: "reduces the casting time of your next Shadow
 * Bolt spell by 100%."
 *
 * A ONE-SHOT PER-ABILITY CAST-TIME MODIFIER, which is the rule built for
 * Eclipse and Maelstrom Weapon -- and the fourth class to use it. An instant
 * three-second Shadow Bolt is the whole of the talent.
 */
export const SHADOW_TRANCE_DURATION_MS = seconds(10);

export const SHADOW_TRANCE: AuraDefinition = {
  id: 'shadow_trance',
  name: 'Shadow Trance',
  durationMs: SHADOW_TRANCE_DURATION_MS,
  refreshBehaviour: 'reset',
  castModifier: {
    abilityIds: ['shadow_bolt'],
    castTimeFraction: 1,
    consumedByCast: 'all',
    requiresCastTime: true,
  },
};

// ---------------------------------------------------------------------------
// Destruction
// ---------------------------------------------------------------------------

/** Immolate: "158 Fire damage and then an additional 275 Fire damage over 15 sec". */
export const IMMOLATE_DIRECT = 158;
export const IMMOLATE_TOTAL = 275;
export const IMMOLATE_DURATION_MS = seconds(15);
export const IMMOLATE_TICK_INTERVAL_MS = seconds(3);

export const IMMOLATE: AuraDefinition = {
  id: 'immolate',
  name: 'Immolate',
  durationMs: IMMOLATE_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: IMMOLATE_TICK_INTERVAL_MS,
    onTick: (context, aura) =>
      tick(
        context,
        aura,
        IMMOLATE_TOTAL / (IMMOLATE_DURATION_MS / IMMOLATE_TICK_INTERVAL_MS),
        FIRE,
      ),
  },
};

/**
 * Shadow and Flame: Conflagrate raises Shadow damage, Shadowburn raises Fire.
 *
 * TWO BUFFS FROM ONE TALENT, each 20 seconds, and they cross over on purpose
 * -- a Fire spell buffs your Shadow and a Shadow spell buffs your Fire, which
 * is what makes a hybrid Destruction build work at all.
 *
 * ITS THIRD CLAUSE IS THE ONE THAT CHANGES THE ROTATION: "Conflagrate has a
 * 100% chance NOT to consume Immolate." At 5/5 that removes the only reason
 * not to cast Conflagrate on cooldown, which is exactly what the Firelock list
 * does.
 */
export const SHADOW_AND_FLAME_DURATION_MS = seconds(20);

export function shadowAndFlameAura(school: 'shadow' | 'fire', percent: number): AuraDefinition {
  return {
    id: `shadow_and_flame_${school}`,
    name: school === 'shadow' ? 'Shadow and Flame (Shadow)' : 'Shadow and Flame (Fire)',
    durationMs: SHADOW_AND_FLAME_DURATION_MS,
    refreshBehaviour: 'reset',
    // A whole-character multiplier rather than a per-school one, because
    // `SchoolModifiers` is built once when the character is and cannot come
    // and go. Exact for a build whose damage is all one school; generous for
    // a hybrid, which Firelock is -- and it says so on the talent.
    damageDoneMultiplier: 1 + percent / 100,
  };
}

// ---------------------------------------------------------------------------
// Demonic Sacrifice
// ---------------------------------------------------------------------------

/**
 * Demonic Sacrifice: kill your demon, keep a buff for two hours.
 *
 * ----------------------------------------------------------------------------
 * WHICH DEMON DECIDES WHICH BUFF, and the tooltip lists all four:
 *
 *   Imp              +15% Shadow damage
 *   Succubus         +15% Fire damage
 *   Voidwalker       2% of maximum mana every 4 sec
 *   Felhunter        3% of maximum health every 4 sec
 *
 * SO THE DEMON IS A CHOICE, and it is read from the same profile field the
 * Hunter's pet family uses -- "the selection is a player action on the GUI",
 * which is the ruleset owner's standard. SM/DS names the Imp and Firelock the
 * Succubus, which is what those profile names mean.
 *
 * TWO HOURS IS FOREVER, for a sixty-second fight. So it is applied at the pull
 * rather than cast: a Warlock arrives having already done this, and spending a
 * global cooldown on a two-hour buff would be modelling the wrong thing.
 * ----------------------------------------------------------------------------
 */
export const DEMONIC_SACRIFICE_DAMAGE = 1.15;

export function demonicSacrificeAura(demon: string): AuraDefinition | undefined {
  if (demon === 'imp') {
    return {
      id: 'demonic_sacrifice_imp',
      name: 'Demonic Sacrifice (Imp)',
      durationMs: 0,
      // Shadow only, and a whole-character multiplier for the same reason
      // Shadow and Flame uses one. SM/DS deals almost nothing but Shadow.
      damageDoneMultiplier: DEMONIC_SACRIFICE_DAMAGE,
    };
  }
  if (demon === 'succubus') {
    return {
      id: 'demonic_sacrifice_succubus',
      name: 'Demonic Sacrifice (Succubus)',
      durationMs: 0,
      damageDoneMultiplier: DEMONIC_SACRIFICE_DAMAGE,
    };
  }
  // Voidwalker and Felhunter restore mana and health, neither of which moves a
  // damage figure for a profile nothing attacks.
  return undefined;
}

export const DEMONIC_SACRIFICE_UNMODELLED =
  'Its damage bonus is applied to EVERY school rather than only to the one the ' +
  'sacrificed demon names -- a damage multiplier that comes and goes cannot be ' +
  'per-school, because `SchoolModifiers` is built once when the character is. ' +
  'Exact for either profile, whose damage is almost entirely one school, and ' +
  'generous for a hybrid.';
