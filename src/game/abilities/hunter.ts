import type { Ability, AuraDefinition, Combatant, SimulationContext } from '../../engine';
import { dealDamage, seconds } from '../../engine';
import { baseManaFor } from '../character/baseStatLookup';
import {
  ASPECT_AURA_IDS,
  ASPECT_OF_THE_BEAST,
  ASPECT_OF_THE_HAWK,
  HUNTERS_MARK,
  BESTIAL_WRATH,
  HAWK_DAMAGE_PER_STRIKE,
  HAWK_MAX_ACTIVE,
  HAWK_UNMODELLED,
  EXPLOSIVE_TRAP,
  IMMOLATION_TRAP,
  RAPID_FIRE,
  SERPENT_STING,
  SUMMON_HAWK_AURA,
} from '../auras/hunter';

/** The midpoint of a stated range. The combat table supplies the spread. */
const midpoint = (low: number, high: number) => (low + high) / 2;

/** Both traps deal Fire. Declared here as it is in `auras/hunter.ts`. */
const FIRE = 'fire' as const;

/**
 * Hunter abilities, from the WoW Forever beta client and the Forever Hunter
 * wiki.
 *
 * ----------------------------------------------------------------------------
 * ALMOST EVERY NUMBER HERE IS A FOREVER NUMBER RATHER THAN A CLASSIC ONE, and
 * the wiki lists them side by side. A few examples, Classic first:
 *
 *   Arcane Shot r8      183 -> 217, and it now scales with 10% RAP
 *   Aimed Shot r6       600 -> 166 bonus, and the cast is 2s rather than 3
 *   Serpent Sting r9    490 -> 555 total, and it now scales with 15% RAP
 *   Raptor Strike r8    140 -> 70 bonus
 *
 * Reading any of these from Classic would have been badly wrong in both
 * directions at once. The spellbook agrees with the wiki on every one.
 *
 * THE FIRST ATTACK POWER COEFFICIENTS ON ABILITIES. Arcane Shot takes 10% of
 * ranged attack power and Serpent Sting 15% over its duration -- which is the
 * Hunter's whole identity as a scaling class and is why these two are the ones
 * Forever bothered to give coefficients to.
 *
 * MELEE RESETS THE RANGED SWING TIMER, which the wiki reports as current
 * behaviour and flags as possibly unintended. Not modelled: it would make
 * melee weaving a loss, and acting on a sentence that says a behaviour may be
 * a bug is worse than recording it. See `docs/`.
 * ----------------------------------------------------------------------------
 */

const MAIN_HAND = 'mainHand' as const;
const RANGED = 'ranged' as const;
const PHYSICAL = 'physical' as const;

/** A Hunter's base mana, which a "% of base mana" cost is a share of. */
export const HUNTER_BASE_MANA = baseManaFor('orc', 'hunter');
const shareOfBase = (fraction: number) => Math.round(HUNTER_BASE_MANA * fraction);

/**
 * Cast an aspect, removing whichever one is up.
 *
 * "Only one Aspect can be active at a time" -- the same exclusivity a stance
 * and a seal already have, handled in one place so a new aspect cannot forget
 * it.
 */
function castAspect(
  simulation: SimulationContext,
  caster: Combatant,
  aspect: AuraDefinition,
): void {
  for (const id of ASPECT_AURA_IDS) {
    if (id !== aspect.id) caster.auras.remove(simulation, id);
  }
  simulation.applyAura(caster, aspect, caster.id);
}

// ---------------------------------------------------------------------------
// Aspects
// ---------------------------------------------------------------------------

export const ASPECT_OF_THE_HAWK_ABILITY: Ability = {
  id: 'aspect_of_the_hawk',
  name: 'Aspect of the Hawk',
  cost: { resource: 'mana', amount: 120 },
  requiresTarget: false,
  canCast: ({ caster }) => !caster.auras.has('aspect_of_the_hawk'),
  onCast: ({ simulation, caster }) => castAspect(simulation, caster, ASPECT_OF_THE_HAWK),
};

/**
 * Hunter’s Mark. One instant cast on the pull, and it lasts the fight.
 *
 * The aura carries the caveat: it is really a debuff on the TARGET that helps
 * every attacker, and with one attacker a buff on the Hunter is the same
 * number. See `HUNTERS_MARK`.
 */
export const HUNTERS_MARK_ABILITY: Ability = {
  id: 'hunters_mark',
  name: "Hunter’s Mark",
  cost: { resource: 'mana', amount: 60 },
  requiresTarget: true,
  canCast: ({ caster }) => !caster.auras.has('hunters_mark'),
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, HUNTERS_MARK, caster.id);
  },
  unmodelled:
    'It is really a debuff on the TARGET, raising the ranged attack power of ' +
    'every attacker against it. With one attacker that is the same number, so ' +
    'it is applied to the Hunter -- the difference would only show in a raid.',
};

export const ASPECT_OF_THE_BEAST_ABILITY: Ability = {
  id: 'aspect_of_the_beast',
  name: 'Aspect of the Beast',
  cost: { resource: 'mana', amount: 110 },
  requiresTarget: false,
  canCast: ({ caster }) => !caster.auras.has('aspect_of_the_beast'),
  onCast: ({ simulation, caster }) => castAspect(simulation, caster, ASPECT_OF_THE_BEAST),
};

// ---------------------------------------------------------------------------
// Shots
// ---------------------------------------------------------------------------

/**
 * Arcane Shot: "causes 217 Arcane damage", and in Forever it scales.
 *
 * "NOW SCALES WITH 10% OF RANGED ATTACK POWER. Classic Spell Power scaling
 * removed." Both halves of that matter: the coefficient is new AND the old one
 * is gone, so reading this from Classic would have scaled it off a stat a
 * Hunter does not stack.
 */
export const ARCANE_SHOT_DAMAGE = 217;
export const ARCANE_SHOT_RAP_COEFFICIENT = 0.1;

export const ARCANE_SHOT: Ability = {
  id: 'arcane_shot',
  name: 'Arcane Shot',
  cost: { resource: 'mana', amount: 190 },
  cooldownMs: seconds(6),
  // Shares its cooldown with Summon Hawk, which the wiki states.
  cooldownGroup: 'arcane_shot',
  attackTable: 'ranged-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'arcane',
      baseAmount:
        ARCANE_SHOT_DAMAGE +
        caster.stats.effective.rangedAttackPower * ARCANE_SHOT_RAP_COEFFICIENT,
      powerCoefficient: 0,
      attackTable: ability.attackTable,
      weaponSlot: RANGED,
    });
  },
};

/**
 * Aimed Shot: "increases ranged damage by 166", a 2-second cast.
 *
 * A TALENT IN CLASSIC AND A TRAINER ABILITY IN FOREVER, learned at 20 by every
 * Hunter -- so all three profiles have it whatever they spent. Its bonus was
 * also cut by more than two thirds, 600 to 166, which is the largest single
 * change in the class.
 */
export const AIMED_SHOT_BONUS = 166;

export const AIMED_SHOT: Ability = {
  id: 'aimed_shot',
  name: 'Aimed Shot',
  cost: { resource: 'mana', amount: 310 },
  castTimeMs: seconds(2),
  cooldownMs: seconds(6),
  // "Aimed Shot shares its cooldown with Multi-Shot."
  cooldownGroup: 'aimed_shot',
  attackTable: 'ranged-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: AIMED_SHOT_BONUS,
      weaponScaling: { slot: RANGED, normalized: true },
      attackTable: ability.attackTable,
      weaponSlot: RANGED,
    });
  },
};

/**
 * Multi-Shot: "Fires several missiles, hitting 3 targets."
 *
 * ONE RANK IN FOREVER, down from five, and a 0.5-second cast where Classic's
 * was instant. It lands on the one target this project has, so what is shown
 * is a third of what it is worth in a pull of three -- and it shares a
 * cooldown with Aimed Shot, which is the better single-target spell.
 */
export const MULTI_SHOT_TARGETS = 3;

export const MULTI_SHOT: Ability = {
  id: 'multi_shot',
  name: 'Multi-Shot',
  cost: { resource: 'mana', amount: shareOfBase(0.139) },
  castTimeMs: seconds(0.5),
  cooldownMs: seconds(6),
  cooldownGroup: 'aimed_shot',
  attackTable: 'ranged-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: 0,
      weaponScaling: { slot: RANGED, normalized: true },
      attackTable: ability.attackTable,
      weaponSlot: RANGED,
    });
  },
  unmodelled:
    `It hits ${MULTI_SHOT_TARGETS} targets and there is one, so only that ` +
    'one is dealt damage -- which says nothing about its value in a pull.',
};

export const SERPENT_STING_ABILITY: Ability = {
  id: 'serpent_sting',
  name: 'Serpent Sting',
  cost: { resource: 'mana', amount: 250 },
  attackTable: 'ranged-special',
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;
    simulation.applyAura(target, SERPENT_STING, caster.id);
  },
};

/**
 * Sniper Shot, granted by the Marksmanship talent.
 *
 * ----------------------------------------------------------------------------
 * THIS WAS WRONG IN FOUR WAYS AND ITS OWN CAPTURE HELD EVERY ANSWER, at both
 * builds. `forever-hunter-spellbook.json` has said
 * `"rank": 3, "cost": "365 Mana", "cast": "4 sec cast",
 *  "cooldown": "15 sec cooldown", "A steady snipe that increases ranged damage
 *  by 295."` since it was first captured.
 *
 * | | was | is |
 * | damage  | 160        | **295** |
 * | cost    | 200, a PLACEHOLDER | **365 mana**, stated |
 * | cast    | instant    | **4 seconds** |
 * | cooldown| 6 seconds  | **15 seconds** |
 *
 * THE RANK-1 RULE WAS APPLIED TO A CAPTURE THAT IS ALREADY MAX RANK. The old
 * comment reasoned that "the spellbook opens on rank 1, and a talent shows the
 * rank it grants" -- true of the WEBSITE, and irrelevant here, because
 * `import_forever_spells.mjs` captures max rank by construction and this entry
 * says `rank: 3`. The rule is real and it was applied to the wrong artifact.
 *
 * AND THE PLACEHOLDER CAVEAT WAS FALSE. It said "the spellbook gives the
 * ability no cost line at all"; the capture's own `cost` field says 365 Mana.
 * That is one of the 19 placeholders gone, and it was never needed.
 *
 * A FOUR-SECOND CAST IS THE PART THAT MATTERS MOST. A cast resets the ranged
 * swing timer, and auto-shot is 42% of a Marksmanship Hunter's damage on a
 * 3.2-second cycle -- so the LW Ranged priority list was measured against an
 * instant and needs measuring again. See `docs/source-cross-checks.md`.
 * ----------------------------------------------------------------------------
 */
export const SNIPER_SHOT_BONUS = 295;
export const SNIPER_SHOT_CAST_MS = seconds(4);

export const SNIPER_SHOT: Ability = {
  id: 'sniper_shot',
  name: 'Sniper Shot',
  cost: { resource: 'mana', amount: 365 },
  castTimeMs: SNIPER_SHOT_CAST_MS,
  cooldownMs: seconds(15),
  attackTable: 'ranged-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: SNIPER_SHOT_BONUS,
      weaponScaling: { slot: RANGED, normalized: true },
      attackTable: ability.attackTable,
      weaponSlot: RANGED,
    });
  },
};

// ---------------------------------------------------------------------------
// Melee
// ---------------------------------------------------------------------------

/** Raptor Strike: "melee weapon damage plus 70". Forever cut it from 140. */
export const RAPTOR_STRIKE_BONUS = 70;

/**
 * Raptor Strike, and it is ON THE NEXT SWING rather than an instant.
 *
 * ----------------------------------------------------------------------------
 * ITS CAPTURE SAID SO ALL ALONG, in the field nothing was reading.
 * `forever-hunter-spellbook.json` gives it `"range": "Next melee"` where every
 * instant in the book gives a distance, and it was declared as an ordinary
 * `melee-special` for the whole life of the class. The ruleset owner settled it
 * in the same words: "an on-next-hit ability very similar to Heroic Strike,
 * therefore the APL queues it like Heroic Strike".
 *
 * TWO THINGS CHANGE AND ONLY ONE OF THEM IS THE DAMAGE. It now replaces a swing
 * instead of landing beside one, and it stops taking a global cooldown --
 * `triggersGcd ?? onNextSwing === undefined` derives that, so the rule arrives
 * with the field and is not declared twice. Neither was visible in a DPS figure
 * that looked entirely ordinary: an instant Raptor Strike cost the right mana,
 * dealt the right damage, and quietly spent a global cooldown the melee Hunter
 * did not have to give.
 *
 * The 6-second cooldown is the capture's and is unchanged. It runs from the
 * QUEUE, not from the swing that spends it, which is the same arrangement
 * Heroic Strike has with no cooldown at all to make the difference visible.
 * ----------------------------------------------------------------------------
 */
export const RAPTOR_STRIKE: Ability = {
  id: 'raptor_strike',
  name: 'Raptor Strike',
  cost: { resource: 'mana', amount: 100 },
  cooldownMs: seconds(6),
  attackTable: 'melee-special',
  onNextSwing: MAIN_HAND,
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: RAPTOR_STRIKE_BONUS,
      weaponScaling: { slot: MAIN_HAND },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

/**
 * Mongoose Bite: "Counterattack the enemy for melee weapon damage plus 57. Can
 * only be performed after you dodge."
 *
 * ITS CONDITION NEVER FIRES ON ITS OWN, because nothing in these profiles is
 * attacked -- so no dodge, so no window. What DOES open it is Expose Prey,
 * a Survival talent the Lone Wolf melee build takes: "your attacks against
 * targets with Hunter's Mark have a 10% chance to activate your Mongoose
 * Bite". That is the only route to it here, and `canCast` reads the aura that
 * talent applies.
 */
export const MONGOOSE_BITE_BONUS = 57;

export const MONGOOSE_BITE: Ability = {
  id: 'mongoose_bite',
  name: 'Mongoose Bite',
  cost: { resource: 'mana', amount: 65 },
  cooldownMs: seconds(5),
  attackTable: 'melee-special',
  canCast: ({ caster }) => caster.auras.has('expose_prey'),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    caster.auras.remove(simulation, 'expose_prey');
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: MONGOOSE_BITE_BONUS,
      weaponScaling: { slot: MAIN_HAND, normalized: true },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

/** Strider Kick, granted by the Survival talent: 100% melee weapon damage. */
export const STRIDER_KICK: Ability = {
  id: 'strider_kick',
  name: 'Strider Kick',
  cooldownMs: seconds(8),
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
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
  },
};

// ---------------------------------------------------------------------------
// Cooldowns
// ---------------------------------------------------------------------------

export const RAPID_FIRE_ABILITY: Ability = {
  id: 'rapid_fire',
  name: 'Rapid Fire',
  cost: { resource: 'mana', amount: 100 },
  cooldownMs: seconds(300),
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, RAPID_FIRE, caster.id);
  },
};

/** Bestial Wrath, granted by the Beast Mastery capstone. */
export const BESTIAL_WRATH_ABILITY: Ability = {
  id: 'bestial_wrath',
  name: 'Bestial Wrath',
  cost: { resource: 'mana', amount: shareOfBase(0.12) },
  cooldownMs: seconds(120),
  requiresTarget: false,
  /*
   * IT BUFFS THE PET, NOT THE HUNTER. "Send your PET into a rage causing 50%
   * additional damage" -- so the aura goes on whichever combatant names this
   * one as its owner, which is what `ownerId` is for and the first thing to
   * use it.
   */
  onCast: ({ simulation, caster }) => {
    const pet = simulation.combatants.find((actor) => actor.ownerId === caster.id);
    if (!pet) return;
    simulation.applyAura(pet, BESTIAL_WRATH, caster.id);
  },
  unmodelled:
    'With no pet it does nothing at all, which is correct -- and a Lone Wolf ' +
    'build cannot take the talent that grants it in any case.',
};

/**
 * Summon Hawk, granted by the Beast Mastery talent.
 *
 * ----------------------------------------------------------------------------
 * TWO CLAUSES, ONE EACH. "Command a hawk to dive-bomb your targeted enemy,
 * dealing 108 Physical damage AND CONTINUING ITS ASSAULT for 18 sec" -- so the
 * dive is this ability's own hit and the assault is `SUMMON_HAWK_AURA`'s
 * periodic. The owner's ruling is that both are 108: "108 for initial and every
 * other hit, once every 2 seconds."
 *
 * REFUSED AT TWO HAWKS, which is the ability's own sentence -- "Only 2 hawks
 * can be active at once." Without the gate the Beast Mastery list casts it
 * every six seconds for the whole fight and every cast past the second spends
 * 190 mana to reset a timer, on a build that runs dry. The list falls through
 * to Aimed Shot instead, which is what a priority list is for.
 * ----------------------------------------------------------------------------
 */
export const SUMMON_HAWK: Ability = {
  id: 'summon_hawk',
  name: 'Summon Hawk',
  cost: { resource: 'mana', amount: 190 },
  cooldownMs: seconds(6),
  // "Shares cooldown with Arcane Shot", which the wiki states outright.
  cooldownGroup: 'arcane_shot',
  canCast: ({ caster }) => caster.auras.stacksOf('summon_hawk') < HAWK_MAX_ACTIVE,
  onCast: ({ simulation, caster, target }) => {
    simulation.applyAura(caster, SUMMON_HAWK_AURA, caster.id);
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      // Credited to the AURA's id so the dive and the assault are one row in
      // the damage table, which is what a reader means by "the hawk".
      abilityId: SUMMON_HAWK_AURA.id,
      abilityName: SUMMON_HAWK_AURA.name,
      school: PHYSICAL,
      baseAmount: HAWK_DAMAGE_PER_STRIKE,
      // The owner's figure is flat. Neither half of the hawk takes a
      // coefficient.
      powerCoefficient: 0,
      critFrom: 'ranged-special',
      appliesArmor: false,
    });
  },
  unmodelled: HAWK_UNMODELLED,
};

/**
 * Immolation Trap, the one trap in scope.
 *
 * ----------------------------------------------------------------------------
 * THE OWNER PUT IT IN AND RULED AWAY THE PART THE ENGINE CANNOT DO: "Let's add
 * Immolation Trap. Assume it triggers instantly when cast." So the capture's
 * "burn the FIRST ENEMY TO APPROACH" and its one-minute lifetime on the ground
 * are both gone, and what is left is a 245-mana instant that applies a burn to
 * the current target. `IMMOLATION_TRAP` carries the damage and the ruling that
 * it takes no coefficient.
 *
 * IT IS THE ONLY TRAP DECLARED. Explosive Trap is the other damaging one and
 * the owner named this one, so Explosive stays undeclared rather than being
 * inferred from the same ruling.
 *
 * NO ATTACK TABLE. It rolls nothing: the trap does not miss, and "Only one Fire
 * trap can be active at a time" is what the 30-second cooldown already
 * enforces against a single target.
 * ----------------------------------------------------------------------------
 */
export const IMMOLATION_TRAP_ABILITY: Ability = {
  id: 'immolation_trap',
  name: 'Immolation Trap',
  cost: { resource: 'mana', amount: 245 },
  cooldownMs: seconds(30),
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;
    simulation.applyAura(target, IMMOLATION_TRAP, caster.id);
  },
  unmodelled:
    'It is placed on the ground and burns "the first enemy to approach", and ' +
    'the engine has no positions -- so on the ruleset owner’s ruling it ' +
    'triggers instantly when cast. Its one-minute life as an untriggered trap ' +
    'and its 10-yard radius are the two clauses that go with that. By the same ' +
    'ruling it scales with neither attack power nor spell power.',
};

/**
 * Explosive Trap, the second trap the owner put in scope.
 *
 * ----------------------------------------------------------------------------
 * "Explosive trap can be implemented -- there isn't an AP or SP scaler, all the
 * information should be known already." That settled both open questions at once:
 * it is declared, and it takes no coefficient on either half.
 *
 * IT INHERITS IMMOLATION TRAP'S RULING RATHER THAN BEING INFERRED FROM IT. The
 * first trap's "assume it triggers instantly when cast" could not be extended by
 * analogy -- a ruling covers what it says -- so this one stayed undeclared until
 * the owner named it. Now that both are named, both lose their placement, their
 * one-minute life on the ground and their radius.
 *
 * THE ONE THING THAT MAKES IT DIFFERENT FROM THE FIRST TRAP is that it has an
 * INITIAL HIT. 208 to 264 on the cast, midpointed to 236, plus 330 over 20
 * seconds carried by `EXPLOSIVE_TRAP`. Immolation Trap is burn-only, so this is
 * the first trap in the project that deals damage from its own `onCast`.
 *
 * NO ATTACK TABLE on either half, for the reason Immolation Trap states: the
 * trap does not miss. The initial hit still CRITS, at ranged crit, which is the
 * same `critFrom` its burn uses and the wiki's own rule for Hunter effects.
 *
 * "TO ALL WITHIN 10 YARDS" IS THE CLAUSE THAT GOES UNMODELLED, and it is the
 * ordinary one-target limit rather than anything new -- the same reason Multi-Shot
 * and Blast Wave carry.
 *
 * ----------------------------------------------------------------------------
 * AND "ONLY ONE FIRE TRAP CAN BE ACTIVE AT A TIME" IS A CONSTRAINT THAT ONLY
 * EXISTS NOW THAT THERE ARE TWO. Both traps say it, and while Immolation Trap was
 * the only one declared its own 30-second cooldown enforced it for free against a
 * single target -- which is what the comment on that ability says. That stopped
 * being true the moment this one landed: the two have SEPARATE cooldowns, so a
 * list casting both would run two Fire burns at once and the ruleset allows one.
 *
 * NOTHING EXPLOITS IT TODAY, because no priority list casts Explosive Trap and
 * only the Lone Wolf melee list casts Immolation. **So this is a live hazard
 * rather than a live bug**, and the honest fix if a list ever wants both is a
 * shared cooldown group, which the engine has no form for. Said here because the
 * next person to add a trap to a list is the one who needs to know.
 *
 * ----------------------------------------------------------------------------
 * AND IT IS IN NO LIST BECAUSE IT MEASURED WORSE, not because nobody tried.
 * Swapped for Immolation Trap in the Lone Wolf melee list -- the one list that
 * casts a trap at all, and a swap rather than an addition because of the one-Fire-
 * trap rule above -- it came back **353.3 against 362.7**, 30 batches of 10.
 *
 * THE ARITHMETIC SAYS WHY, which is what makes it a finding rather than a
 * disappointment: Explosive is **520 mana for 236 + 330 = 566**, and Immolation is
 * **245 mana for 690**. More than twice the cost for less damage. The difference
 * is bought by "to all within 10 yards", and there is one target -- so on a single
 * target the cheaper trap is simply the better one, and no measurement was going
 * to say otherwise.
 *
 * A CORRECTLY IMPLEMENTED ABILITY CAN BE WORTH CASTING NEVER, and this is the
 * clearest case of it in the project: both halves are right, both are tested, and
 * one line re-measures it the day the encounter grows a second target.
 * ----------------------------------------------------------------------------
 */
export const EXPLOSIVE_TRAP_INITIAL_DAMAGE = midpoint(208, 264);

export const EXPLOSIVE_TRAP_ABILITY: Ability = {
  id: 'explosive_trap',
  name: 'Explosive Trap',
  cost: { resource: 'mana', amount: 520 },
  cooldownMs: seconds(30),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: FIRE,
      baseAmount: EXPLOSIVE_TRAP_INITIAL_DAMAGE,
      // The owner's ruling, the same as the burn's: neither pool scales it.
      powerCoefficient: 0,
      critFrom: 'ranged-special',
    });
    simulation.applyAura(target, EXPLOSIVE_TRAP, caster.id);
  },
  unmodelled:
    'It is placed on the ground and explodes when an enemy approaches, and the ' +
    'engine has no positions -- so on the ruleset owner’s ruling it triggers ' +
    'instantly when cast, the same ruling Immolation Trap runs on. Its ' +
    'one-minute life as an untriggered trap goes with that, and so does "to all ' +
    'within 10 yards": there is one target. By the same ruling it scales with ' +
    'neither attack power nor spell power. "Only one Fire trap can be active at ' +
    'a time" is not enforced between the two traps either -- they have separate ' +
    'cooldowns and no list casts both.',
};

export const HUNTER_ABILITIES: readonly Ability[] = [
  HUNTERS_MARK_ABILITY,
  ASPECT_OF_THE_HAWK_ABILITY,
  ASPECT_OF_THE_BEAST_ABILITY,
  ARCANE_SHOT,
  AIMED_SHOT,
  MULTI_SHOT,
  SERPENT_STING_ABILITY,
  SNIPER_SHOT,
  RAPTOR_STRIKE,
  MONGOOSE_BITE,
  STRIDER_KICK,
  RAPID_FIRE_ABILITY,
  BESTIAL_WRATH_ABILITY,
  SUMMON_HAWK,
  IMMOLATION_TRAP_ABILITY,
  EXPLOSIVE_TRAP_ABILITY,
];
