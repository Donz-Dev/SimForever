import type { AuraDefinition } from '../../engine';
import { dealDamage, seconds } from '../../engine';
import {
  BANE_OF_AGONY_SP_COEFFICIENT,
  CORRUPTION_TICK_SP_COEFFICIENT,
  IMMOLATE_SP_COEFFICIENT,
  IMMOLATE_TICK_SP_COEFFICIENT,
  SIPHON_LIFE_TICK_SP_COEFFICIENT,
} from '../combat/coefficients';

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
  powerCoefficient = 0,
  /**
   * Whether this tick can crit at all.
   *
   * --------------------------------------------------------------------------
   * SIPHON LIFE CANNOT, BY THE RULESET OWNER'S RULING, and it is the only DoT
   * in the project that cannot -- every other one does, which is a Forever
   * rule rather than Classic's. So this is an exception stated per effect
   * rather than a default being changed.
   *
   * OMITTING `critFrom` CONSUMES NO RANDOM NUMBER, which is the engine's own
   * documented property. Turning it off therefore SHIFTS a seeded run for any
   * profile casting Siphon Life -- the opposite direction from the usual, where
   * ADDING the field is the edit that cannot shift one.
   * --------------------------------------------------------------------------
   */
  canCrit = true,
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
    // Per TICK. A pure DoT takes the whole periodic coefficient; Immolate's
    // burn takes its share of a hybrid pair.
    powerCoefficient,
    periodic: true,
    ...(canCrit ? { critFrom: 'spell' as const } : {}),
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
export const CORRUPTION_CAST_MS = seconds(2);

/** A pure DoT: the cast deals no damage, and the sheet states the tick. */
export const CORRUPTION_TICK_COEFFICIENT = CORRUPTION_TICK_SP_COEFFICIENT;

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
        CORRUPTION_TICK_COEFFICIENT,
      ),
  },
};

/**
 * Bane of Agony: "552 Shadow damage over 24 sec. This damage is dealt SLOWLY
 * AT FIRST, and builds up as the Bane reaches its full duration."
 *
 * ----------------------------------------------------------------------------
 * THE RAMP IS QUANTIFIED NOW, BY THE RULESET OWNER. This ticked FLAT for most
 * of the project with a caveat saying so, because the tooltip describes the
 * shape without giving it and Classic's bands could not be borrowed as
 * precision. The owner has stated it:
 *
 *   ticks 1-4     1/24th of the total each
 *   ticks 5-8     1/12th of the total each
 *   ticks 9-12    1/8th of the total each
 *
 * TWELVE TICKS, NOT EIGHT: the cadence is every 2 seconds over 24, also the
 * owner's, where this file had 3 seconds. The shares sum to exactly 1 --
 * 4/24 + 4/12 + 4/8 -- which is the check that the ramp redistributes the
 * total rather than changing it.
 *
 * IT IS CLASSIC'S SHAPE AT A DIFFERENT RESOLUTION, worth noticing before
 * reading these as arbitrary: 1/24 : 1/12 : 1/8 is 1 : 2 : 3, and the FLAT
 * share over twelve ticks is 1/12. So the bands are 50%, 100% and 150% of the
 * average, exactly as Classic's are. The old caveat guessed that ratio and had
 * no authority to assert it; now there is authority and the guess was right.
 *
 * THE TOTAL IS `552 + SP * 1.6`, the coefficient also the owner's and
 * superseding the sheet. Both halves are split by the SAME shares, so a tick
 * is `(552 + SP * 1.6) * share` however the arithmetic is arranged. See
 * `BANE_OF_AGONY_SP_COEFFICIENT`.
 * ----------------------------------------------------------------------------
 */
export const BANE_OF_AGONY_TOTAL = 552;
export const BANE_OF_AGONY_DURATION_MS = seconds(24);
export const BANE_OF_AGONY_TICK_INTERVAL_MS = seconds(2);
export const BANE_OF_AGONY_TICKS = BANE_OF_AGONY_DURATION_MS / BANE_OF_AGONY_TICK_INTERVAL_MS;

/**
 * What each of the twelve ticks is worth, as a fraction of the total.
 *
 * WRITTEN OUT RATHER THAN COMPUTED from the bands, because the owner stated
 * three bands and a formula would invite the next reader to re-derive them.
 * Its test sums the array and asserts exactly 1.
 */
export const BANE_OF_AGONY_TICK_SHARES: readonly number[] = [
  1 / 24,
  1 / 24,
  1 / 24,
  1 / 24,
  1 / 12,
  1 / 12,
  1 / 12,
  1 / 12,
  1 / 8,
  1 / 8,
  1 / 8,
  1 / 8,
];

/**
 * Which share this tick draws, from the aura's own clock.
 *
 * ----------------------------------------------------------------------------
 * READ FROM `appliedAt` RATHER THAN COUNTED ON THE INSTANCE, because a refresh
 * sets `appliedAt = now` -- so the ramp restarts when the Bane is re-applied,
 * which is what `refreshBehaviour: 'reset'` means everywhere else here. A
 * counter held on the instance would have to be reset by hand in the one place
 * that is easy to forget.
 *
 * CLAMPED INTO THE ARRAY, so the final tick -- due at the exact moment the
 * aura falls off, and ordered before the expiry by the event queue -- reads the
 * last band rather than running off the end.
 * ----------------------------------------------------------------------------
 */
export function baneOfAgonyTickShare(elapsedMs: number): number {
  const index = Math.round(elapsedMs / BANE_OF_AGONY_TICK_INTERVAL_MS) - 1;
  const clamped = Math.min(Math.max(index, 0), BANE_OF_AGONY_TICK_SHARES.length - 1);
  return BANE_OF_AGONY_TICK_SHARES[clamped]!;
}

/**
 * Bane of Agony, optionally AMPLIFIED by Amplify Curse.
 *
 * ----------------------------------------------------------------------------
 * TWO DEFINITIONS SHARING ONE ID, which is the whole trick. Amplify Curse
 * raises "the effect of your next Curse of Weakness or Bane of Agony by 50%",
 * and that damage lands over 24 seconds rather than at the cast -- so a
 * `CastModifier`, which is resolved and spent AT cast time, has nothing to
 * carry it to the ticks. This is why the talent was listed as wanting a
 * one-shot per-ability DAMAGE modifier and why it does not need one.
 *
 * THE ID STAYS `bane_of_agony`, so Malediction, Pandemic and Improved Bane of
 * Agony all still reach it and the priority list's `expired('bane_of_agony')`
 * still sees it. Only the per-tick damage differs, and the factory is what
 * keeps the ramp written once.
 * ----------------------------------------------------------------------------
 */
export const AMPLIFY_CURSE_MULTIPLIER = 1.5;

function baneOfAgonyAura(multiplier: number): AuraDefinition {
  return {
    id: 'bane_of_agony',
    name: 'Bane of Agony',
    durationMs: BANE_OF_AGONY_DURATION_MS,
    isDebuff: true,
    refreshBehaviour: 'reset',
    periodic: {
      intervalMs: BANE_OF_AGONY_TICK_INTERVAL_MS,
      onTick: (context, aura) => {
        const share = baneOfAgonyTickShare(context.clock.now() - aura.appliedAt) * multiplier;
        tick(
          context,
          aura,
          BANE_OF_AGONY_TOTAL * share,
          SHADOW,
          /*
           * THE SAME SHARE ON BOTH HALVES. `scaleByPower` adds
           * `baseAmount + SP * powerCoefficient`, so splitting each by this
           * tick's share gives `(552 + SP * 1.6) * share` -- the owner's own
           * arithmetic, and the reason the coefficient is a fraction of a
           * TOTAL rather than a per-tick figure.
           */
          BANE_OF_AGONY_SP_COEFFICIENT * share,
        );
      },
    },
  };
}

export const BANE_OF_AGONY: AuraDefinition = baneOfAgonyAura(1);
export const BANE_OF_AGONY_AMPLIFIED: AuraDefinition = baneOfAgonyAura(AMPLIFY_CURSE_MULTIPLIER);

/**
 * Amplify Curse: "Increases the effect of your next Curse of Weakness or Bane
 * of Agony by 50%, or your next Curse of Exhaustion by 20%. Lasts 30 sec."
 *
 * A PLAIN MARKER AURA carrying no modifier of its own. Bane of Agony's `onCast`
 * reads it, applies the amplified definition and removes it, which is what
 * makes the 50% reach ticks landing half a minute later.
 */
export const AMPLIFY_CURSE_DURATION_MS = seconds(30);

export const AMPLIFY_CURSE_AURA: AuraDefinition = {
  id: 'amplify_curse',
  name: 'Amplify Curse',
  durationMs: AMPLIFY_CURSE_DURATION_MS,
  refreshBehaviour: 'reset',
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

/**
 * A pure DoT, 30 seconds in ten ticks. 5% a tick.
 *
 * THE DERIVED FIGURE WAS FOUR TIMES THIS. `duration / 15` made it 2.0 in total
 * and the largest coefficient in the project; the sheet makes it 0.5. A rule
 * that rewards a long duration without limit is exactly the shape of thing the
 * owner's own numbers were wanted for.
 */
export const SIPHON_LIFE_TICK_COEFFICIENT = SIPHON_LIFE_TICK_SP_COEFFICIENT;

export const SIPHON_LIFE: AuraDefinition = {
  id: 'siphon_life',
  name: 'Siphon Life',
  durationMs: SIPHON_LIFE_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: SIPHON_LIFE_TICK_INTERVAL_MS,
    onTick: (context, aura) =>
      /*
       * `false` IS THE WHOLE RULING: Siphon Life cannot crit, by the owner's
       * word, and it is the only damage-over-time effect here that cannot.
       */
      tick(context, aura, SIPHON_LIFE_PER_TICK, SHADOW, SIPHON_LIFE_TICK_COEFFICIENT, false),
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

/**
 * WRACK's second half: "increasing the damage they take from your other Shadow
 * damage over time effects by 10%. Lasts 6 sec."
 *
 * ----------------------------------------------------------------------------
 * THE CLAUSE THAT WAS THE REASON TO CAST THE ABILITY, and it was `unmodelled`
 * for as long as Wrack existed. The reason given was true and specific: damage
 * taken here was per SCHOOL, and a Shadow vulnerability would also raise Shadow
 * Bolt -- over half of the SM/DS profile's damage -- which is a bigger number
 * wearing the right label rather than an approximation. That reason named the
 * field it wanted, and `periodicDamageTakenBySchool` is it.
 *
 * "OTHER" IS FREE, AND NOT BY ACCIDENT. Wrack is a CHANNEL, so its own six
 * ticks are cast ticks and carry no `periodic` flag -- only a real
 * damage-over-time tick does. So this debuff cannot amplify the ability that
 * applied it, which is exactly what the word asks for.
 *
 * `ignore` ON REFRESH, so the six seconds run from the FIRST tick of the
 * channel rather than from the last. The tooltip states one six-second effect
 * and the channel is six seconds long; resetting on every tick would leave the
 * debuff standing for five seconds after the channel ended.
 * ----------------------------------------------------------------------------
 */
export const WRACK_DOT_AMPLIFICATION_PERCENT = 10;
export const WRACK_DEBUFF_DURATION_MS = seconds(6);

export const WRACK_AMPLIFICATION: AuraDefinition = {
  id: 'wrack',
  name: 'Wrack',
  durationMs: WRACK_DEBUFF_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'ignore',
  periodicDamageTakenBySchool: { shadow: 1 + WRACK_DOT_AMPLIFICATION_PERCENT / 100 },
};

// ---------------------------------------------------------------------------
// Destruction
// ---------------------------------------------------------------------------

/** Immolate: "158 Fire damage and then an additional 275 Fire damage over 15 sec". */
export const IMMOLATE_DIRECT = 158;
export const IMMOLATE_TOTAL = 275;
export const IMMOLATE_DURATION_MS = seconds(15);
export const IMMOLATE_TICK_INTERVAL_MS = seconds(3);
export const IMMOLATE_CAST_MS = seconds(2);

/*
 * BOTH HALVES ARE THE OWNER'S, one row of the sheet each, and they are no
 * longer derived from one another. The hybrid SHARE rule that used to split a
 * single cast's scaling by duration is gone: see src/game/combat/coefficients.ts.
 */
export const IMMOLATE_COEFFICIENTS = {
  direct: IMMOLATE_SP_COEFFICIENT,
  perTick: IMMOLATE_TICK_SP_COEFFICIENT,
};

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
        IMMOLATE_COEFFICIENTS.perTick,
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
    /*
     * PER SCHOOL, WHICH IS THE WHOLE POINT OF THE TALENT. This was a
     * whole-character `damageDoneMultiplier` with a caveat saying it was
     * "generous for a hybrid, which Firelock is" -- and Firelock holds BOTH
     * halves for most of a fight, so it collected x1.10 twice on every school
     * where the talent gives x1.10 once per school.
     *
     * `SchoolModifiers` still cannot hold this: it is built once when the
     * character is, and this comes and goes on a twenty-second timer.
     * `damageDoneBySchool` on the AURA is the field that was missing, and
     * `game/auras/warrior.ts` named it before it existed.
     */
    damageDoneBySchool: { [school]: 1 + percent / 100 },
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
      // "Increases your SHADOW damage by 15%", and it now says so. SM/DS deals
      // almost nothing else, so this is where the change costs nothing.
      damageDoneBySchool: { shadow: DEMONIC_SACRIFICE_DAMAGE },
    };
  }
  if (demon === 'succubus') {
    return {
      id: 'demonic_sacrifice_succubus',
      name: 'Demonic Sacrifice (Succubus)',
      durationMs: 0,
      /*
       * "Increases your FIRE damage by 15%", and this is where the old
       * whole-character reading actually cost something: Firelock deals 22% of
       * its damage in Shadow -- Corruption and Shadowburn -- and a sacrificed
       * Succubus was raising all of it.
       */
      damageDoneBySchool: { fire: DEMONIC_SACRIFICE_DAMAGE },
    };
  }
  // Voidwalker and Felhunter restore mana and health, neither of which moves a
  // damage figure for a profile nothing attacks.
  return undefined;
}

/**
 * The clause that is still not modelled, and it is no longer the school.
 *
 * THE SCHOOL HALF EXPIRED when `damageDoneBySchool` landed on `AuraDefinition`:
 * the Imp's buff is Shadow and the Succubus's is Fire, and each now reaches its
 * own school alone. What is left is the other two demons, whose buffs restore
 * mana and health rather than raising damage.
 */
export const DEMONIC_SACRIFICE_UNMODELLED =
  'Its Voidwalker and Felhunter options restore mana and health, and neither ' +
  'moves a damage figure for a profile nothing attacks. The Imp and Succubus ' +
  'options -- the two the ruleset owner takes -- are fully applied, each to ' +
  'the one school it names.';
