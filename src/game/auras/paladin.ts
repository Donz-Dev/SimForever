import type { AuraDefinition, Combatant } from '../../engine';
import { RATING_PER_PERCENT, dealDamage, flat, seconds } from '../../engine';
import { periodicTickCoefficient } from '../combat/spellCoefficient';

/**
 * Paladin auras, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * Captured in `src/data/abilities/forever-paladin-spellbook.json` at MAX RANK.
 *
 * ----------------------------------------------------------------------------
 * A SEAL IS A STANCE THAT DEALS DAMAGE. "Only one Seal can be active on the
 * Paladin at any one time" is the same exclusivity rule a Warrior's stances
 * already follow, and it is modelled the same way: casting one removes the
 * others. Nothing new in the engine was needed for that.
 *
 * WHAT IS NEW IS THAT A SEAL PAYS OUT TWICE. It rides on every melee swing for
 * thirty seconds, AND it can be spent by Judgement for a one-off effect -- and
 * in Forever, unlike Classic, JUDGEMENT DOES NOT CONSUME THE SEAL. The
 * spellbook says so outright, which removes the whole reason Classic paladins
 * re-cast a seal after every judgement.
 *
 * SEAL DAMAGE IS NOT A WEAPON USE, by the ruleset owner's ruling. The swing
 * that carried it is one and triggers Windfury, Crusader and Hand of Justice
 * normally; the Holy damage the seal adds is not a second use and triggers
 * nothing. Every seal effect here therefore deals its damage with NO
 * `weaponSlot`, which is exactly what `isWeaponUse` reads.
 * ----------------------------------------------------------------------------
 */

/** Every seal lasts half a minute, and the spellbook says so for each. */
export const SEAL_DURATION_MS = seconds(30);

/**
 * The seals that are mutually exclusive, by aura id.
 *
 * Written out rather than derived from a prefix, so that adding a seal is a
 * visible change here rather than a silent consequence of naming.
 */
export const SEAL_AURA_IDS = [
  'seal_of_righteousness',
  'seal_of_command',
  'seal_of_the_crusader',
  'seal_of_fury',
] as const;

/** Which seal a Paladin currently carries, if any. */
export function activeSeal(actor: Combatant): string | undefined {
  return SEAL_AURA_IDS.find((id) => actor.auras.has(id));
}

// ---------------------------------------------------------------------------
// The seals
// ---------------------------------------------------------------------------

/**
 * Seal of Righteousness: "granting each melee attack an additional 21 to 75
 * Holy damage. Slower weapons cause more Holy damage per swing."
 *
 * ----------------------------------------------------------------------------
 * THE FIRST SPELL POWER COEFFICIENT IN THIS PROJECT, and it is the ruleset
 * owner's own formula rather than anything derived:
 *
 *     damage = base + baseWeaponSpeed x (0.022 x attackPower + 0.044 x spellPower)
 *
 * Every caster so far -- Druid, Shaman, Mage -- states flat damage and no
 * coefficient at all, and each says so. The Paladin is the exception, and that
 * makes this the one place in the project where gear reaches a Holy number.
 *
 * WHICH HALF OF "21 TO 75" IS THE BASE is an INTERPRETATION and is isolated
 * here so it is cheap to flip. The range is described as the effect of WEAPON
 * SPEED, so the low end is read as the base -- what the seal is worth before
 * any speed scaling -- and the rest comes from the formula. Reading the
 * midpoint instead would double-count the speed term.
 * ----------------------------------------------------------------------------
 */
export const SEAL_ATTACK_POWER_COEFFICIENT = 0.022;
export const SEAL_SPELL_POWER_COEFFICIENT = 0.044;

/** The low end of "21 to 75", read as the pre-speed base. See above. */
export const SEAL_OF_RIGHTEOUSNESS_BASE = 21;

/** The owner's formula, in one place, for every seal that uses it. */
export function sealDamage(
  base: number,
  baseWeaponSpeedSeconds: number,
  attackPower: number,
  spellPower: number,
): number {
  return (
    base +
    baseWeaponSpeedSeconds *
      (SEAL_ATTACK_POWER_COEFFICIENT * attackPower + SEAL_SPELL_POWER_COEFFICIENT * spellPower)
  );
}

export const SEAL_OF_RIGHTEOUSNESS: AuraDefinition = {
  id: 'seal_of_righteousness',
  name: 'Seal of Righteousness',
  durationMs: SEAL_DURATION_MS,
  refreshBehaviour: 'reset',
};

/**
 * Seal of Command: "a chance to deal additional Holy damage equal to 70% of
 * normal weapon damage."
 *
 * PROCS PER MINUTE, on the ruleset owner's ruling -- the same normalisation
 * Crusader and Vis'kag already use, so a slow weapon and a fast one proc the
 * same number of times a minute. The RATE itself is still a placeholder; see
 * `PLACEHOLDER_SEAL_OF_COMMAND_PPM` in `reactions/paladin.ts`.
 */
export const SEAL_OF_COMMAND_WEAPON_FRACTION = 0.7;

export const SEAL_OF_COMMAND: AuraDefinition = {
  id: 'seal_of_command',
  name: 'Seal of Command',
  durationMs: SEAL_DURATION_MS,
  refreshBehaviour: 'reset',
};

/**
 * Seal of the Crusader: "granting 325 melee attack power. The Paladin also
 * attacks 40% faster, but deals less damage with each attack."
 *
 * THE THIRD CLAUSE HAS NO NUMBER. "Deals less damage with each attack" states
 * no figure anywhere, and in Classic the reduction exactly cancels the haste
 * so that damage per second is unchanged. Neither reading is stated here, so
 * the haste and the attack power apply and the penalty does not -- which makes
 * this seal GENEROUS, and the ability says so where a person can see it.
 */
export const SEAL_OF_THE_CRUSADER_ATTACK_POWER = 325;
export const SEAL_OF_THE_CRUSADER_HASTE_PERCENT = 40;

export const SEAL_OF_THE_CRUSADER: AuraDefinition = {
  id: 'seal_of_the_crusader',
  name: 'Seal of the Crusader',
  durationMs: SEAL_DURATION_MS,
  refreshBehaviour: 'reset',
  statModifiers: [
    flat('attackPower', SEAL_OF_THE_CRUSADER_ATTACK_POWER),
    flat('hasteRating', SEAL_OF_THE_CRUSADER_HASTE_PERCENT * RATING_PER_PERCENT.haste),
  ],
};

export const SEAL_OF_THE_CRUSADER_UNMODELLED =
  'Its "deals less damage with each attack" clause states no number anywhere ' +
  'in the client data, so it is not applied -- the attack power and the 40% ' +
  'haste are, which makes this seal generous rather than neutral.';

/**
 * Seal of Fury: "causing melee attacks to deal an additional 35 Holy damage."
 *
 * Its shield clause needs a shield AND something to absorb, so it is live only
 * for the Protection profile, which is the one that is hit back.
 */
export const SEAL_OF_FURY_DAMAGE = 35;
export const SEAL_OF_FURY_ABSORB_FRACTION = 0.5;

export const SEAL_OF_FURY: AuraDefinition = {
  id: 'seal_of_fury',
  name: 'Seal of Fury',
  durationMs: SEAL_DURATION_MS,
  refreshBehaviour: 'reset',
};

// ---------------------------------------------------------------------------
// Judgements
// ---------------------------------------------------------------------------

/**
 * The Crusader's judgement: "increasing Holy damage taken by up to 161. Your
 * melee strikes will refresh the spell's duration."
 *
 * A FLAT INCREASE RATHER THAN A PERCENTAGE, which nothing else in this project
 * is: `damageTakenBySchool` multiplies. So this is NOT modelled as that debuff
 * -- a flat +161 to every Holy hit is a different shape entirely, and reading
 * it as +161% would be absurd.
 *
 * AND `SchoolModifier.spellPower` IS NOT IT EITHER, which is worth saying
 * because the two read alike and the number is even the same. That one is
 * spell power on the ATTACKER, reaching damage only through a coefficient --
 * so it is worth 0.044 x baseWeaponSpeed per point to a seal and nothing at
 * all to anything else. This is a flat amount added to every Holy hit the
 * TARGET takes, from whoever deals it. Different side, different arithmetic.
 *
 * Applied as a tracked debuff so its uptime is visible and the judgement is
 * not silent, and the ability says what it is not doing.
 */
export const JUDGEMENT_OF_THE_CRUSADER_BONUS = 161;
export const JUDGEMENT_OF_THE_CRUSADER_DURATION_MS = seconds(40);

export const JUDGEMENT_OF_THE_CRUSADER_UNMODELLED =
  'Its judgement raises Holy damage taken by a FLAT 161 rather than by a ' +
  'percentage, and nothing declares a flat per-school damage bonus -- ' +
  '`damageTakenBySchool` is a multiplier. The debuff is tracked and adds no ' +
  'damage, so this understates.';

export const JUDGEMENT_OF_THE_CRUSADER: AuraDefinition = {
  id: 'judgement_of_the_crusader',
  name: 'Judgement of the Crusader',
  durationMs: JUDGEMENT_OF_THE_CRUSADER_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
};

// ---------------------------------------------------------------------------
// Talents
// ---------------------------------------------------------------------------

/**
 * Twist of Light, the Retribution capstone and the reason a profile is called
 * "Seal Twist":
 *
 *   "When you replace your Seal of Command, Seal of Righteousness, Seal of
 *    Fury, or Seal of Justice with a different Seal, gain an Echo. Your next
 *    melee attack applies the replaced Seal's effects, consuming the Echo."
 *
 * ----------------------------------------------------------------------------
 * SEAL TWISTING AS A TALENT RATHER THAN AS A TECHNIQUE. In Classic this was a
 * timing trick -- swap seals in the window before a swing lands and both
 * resolve. Forever has made it an explicit effect with an explicit trigger,
 * which means it can be modelled exactly instead of being approximated by a
 * rotation that pretends to have millisecond hands.
 *
 * ONE CHARGE, consumed by the next melee attack. Carried as an aura holding
 * the id of the seal it echoes, so the reaction knows which effect to apply
 * without the talent having to enumerate them.
 * ----------------------------------------------------------------------------
 */
export const ECHO_DURATION_MS = seconds(30);

export function echoAura(replacedSealId: string): AuraDefinition {
  return {
    id: `echo_${replacedSealId}`,
    name: 'Echo',
    durationMs: ECHO_DURATION_MS,
    refreshBehaviour: 'reset',
  };
}

/** Every echo aura, so a reaction can find whichever one is up. */
export const ECHO_AURA_IDS = SEAL_AURA_IDS.map((id) => `echo_${id}`);

/**
 * Vengeance: "Increases your Physical and Holy damage dealt by {0}% for 30 sec
 * after landing a critical strike. Stacks up to 5 times."
 *
 * TWO SCHOOLS BY NAME, so it is a pair of school modifiers rather than a
 * blanket one -- except that a Paladin deals only physical and Holy damage, so
 * for these three profiles the two readings agree. Expressed as the tooltip
 * writes it anyway, because being right for the wrong reason does not survive
 * a fourth profile.
 *
 * A SCHOOL MODIFIER CANNOT COME AND GO, which is the catch: `SchoolModifiers`
 * is built once when the character is. So this is an aura with a blanket
 * `damageDoneMultiplier`, and the difference only shows on a Paladin dealing
 * damage of some third school -- which none of them do.
 */
export const VENGEANCE_DURATION_MS = seconds(30);
export const VENGEANCE_MAX_STACKS = 5;

export function vengeanceAura(percentPerStack: number): AuraDefinition {
  return {
    id: 'vengeance',
    name: 'Vengeance',
    durationMs: VENGEANCE_DURATION_MS,
    maxStacks: VENGEANCE_MAX_STACKS,
    refreshBehaviour: 'reset',
    modifiersScaleWithStacks: true,
    damageDoneMultiplier: 1 + percentPerStack / 100,
  };
}

/**
 * Holy Shield: "Increases chance to block by 20% for 10 sec, and deals 221
 * Holy damage for each attack blocked while active. Each block expends a
 * charge. 4 charges."
 *
 * FOUR BLOCKS OR TEN SECONDS, WHICHEVER ENDS FIRST, which is exactly what
 * `consumedByBlock` and `chargesOnApply` were built for -- Shield Block is the
 * same shape and came first.
 */
export const HOLY_SHIELD_BLOCK_CHANCE = 20;
export const HOLY_SHIELD_DAMAGE = 221;
export const HOLY_SHIELD_DURATION_MS = seconds(10);
export const HOLY_SHIELD_CHARGES = 4;

export const HOLY_SHIELD: AuraDefinition = {
  id: 'holy_shield',
  name: 'Holy Shield',
  durationMs: HOLY_SHIELD_DURATION_MS,
  chargesOnApply: HOLY_SHIELD_CHARGES,
  consumedByBlock: true,
  statModifiers: [flat('blockChance', HOLY_SHIELD_BLOCK_CHANCE)],
};

/**
 * Redoubt: "Damaging melee attacks against you have a 10% chance to increase
 * your chance to block by 30%. Lasts 10 sec or 5 blocks."
 *
 * The same charge-and-duration shape again, and the third effect in the
 * project to use it.
 */
export const REDOUBT_DURATION_MS = seconds(10);
export const REDOUBT_CHARGES = 5;

export function redoubtAura(blockChance: number): AuraDefinition {
  return {
    id: 'redoubt',
    name: 'Redoubt',
    durationMs: REDOUBT_DURATION_MS,
    chargesOnApply: REDOUBT_CHARGES,
    consumedByBlock: true,
    refreshBehaviour: 'reset',
    statModifiers: [flat('blockChance', blockChance)],
  };
}

/**
 * Consecration's ground effect: "96 Holy damage over 8 sec ... an additional
 * 216 damage over 8 sec" to the first four enemies in it.
 *
 * BOTH HALVES, because there is one target and it is certainly among the first
 * four -- 312 over eight seconds. A two-second cadence divides it into four
 * ticks of 78, which is the reading that leaves whole ticks.
 *
 * A DEBUFF ON THE TARGET rather than a patch of ground, which is the only
 * shape the engine has and is exactly right for a target that never moves.
 */
export const CONSECRATION_TOTAL = 96 + 216;
export const CONSECRATION_DURATION_MS = seconds(8);
export const CONSECRATION_TICK_INTERVAL_MS = seconds(2);

/**
 * A PURE periodic effect -- the cast deals no damage of its own -- so it takes
 * the whole periodic coefficient rather than a share of a hybrid pair.
 */
export const CONSECRATION_TICK_COEFFICIENT = periodicTickCoefficient(
  CONSECRATION_DURATION_MS,
  CONSECRATION_DURATION_MS / CONSECRATION_TICK_INTERVAL_MS,
);

export const CONSECRATION_GROUND: AuraDefinition = {
  id: 'consecration',
  name: 'Consecration',
  durationMs: CONSECRATION_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: CONSECRATION_TICK_INTERVAL_MS,
    onTick: (context, aura) => {
      const source = context.combatant(aura.sourceId);
      const target = context.combatant(aura.targetId);
      if (!source || !target || !target.isAlive) return;

      dealDamage(context, {
        source,
        target,
        abilityId: aura.id,
        abilityName: aura.name,
        school: 'holy',
        baseAmount:
          CONSECRATION_TOTAL / (CONSECRATION_DURATION_MS / CONSECRATION_TICK_INTERVAL_MS),
        // A pure periodic effect: 8 seconds over 15, spread across its ticks.
        powerCoefficient: CONSECRATION_TICK_COEFFICIENT,
        periodic: true,
        critFrom: 'spell',
        appliesArmor: false,
      });
    },
  },
};
