import type { CastReaction, Reaction } from '../../engine';
import type { TalentReactionBuilder } from './warriorTalents';
import {
  ARCANE_BLAST,
  CLEARCASTING,
  COMBUSTION,
  COMBUSTION_CRITS_TO_END,
  FINGERS_OF_FROST,
  FINGERS_OF_FROST_PROC_CHANCE,
  FIRE_SPELL_IDS,
  FROST_SPELL_IDS,
  MAGE_DAMAGE_SPELL_IDS,
  wintersChillAura,
  fingersOfFrostAura,
  HEATING_UP,
  MISSILE_BARRAGE,
  fireVulnerabilityAura,
  igniteAura,
} from '../auras/mage';

/**
 * Mage talent procs.
 *
 * ----------------------------------------------------------------------------
 * ALMOST ALL OF THE MAGE'S REACTIVE TALENTS FIRE OFF A CRITICAL STRIKE, which
 * makes crit worth more to this class than to any other in the project: Ignite
 * turns a crit into a burn, Heating Up turns one into a faster Pyroblast, and
 * Master of Elements turns one into mana back.
 *
 * WHICH SPELLS COUNT IS PART OF EACH TOOLTIP and is checked by ability id
 * rather than by school. Heating Up names four spells and Ignite says "Fire
 * damage spells", and those are different sets -- Pyroblast is Fire and is not
 * a Heating Up trigger, which is what stops it feeding itself.
 * ----------------------------------------------------------------------------
 */

/**
 * "Fire damage spells" -- every Fire spell the Mage can cast.
 *
 * THE LIST LIVES IN `auras/mage.ts` NOW, because Combustion's crit bonus needs
 * the same school written out as ability ids and two copies of "which spells
 * are Fire" is exactly one too many: the failure of them disagreeing is Ignite
 * firing off a spell Combustion does not count, and both numbers plausible.
 */
const FIRE_SPELLS = new Set(FIRE_SPELL_IDS);

/** Heating Up names four, and Pyroblast is deliberately not one of them. */
const HEATING_UP_TRIGGERS = new Set(['fireball', 'frostfire_bolt', 'fire_blast', 'scorch']);

/**
 * Every damage spell, for the talents that say "any damage spell".
 *
 * ALSO IN `auras/mage.ts` NOW, for the same reason the Fire list is: Arcane
 * Blast's "+10% to all your OTHER spells" and its "until any other damage
 * spell is cast" have to select the SAME set, or a spell could take the bonus
 * without ending the window.
 */
const DAMAGE_SPELLS = new Set(MAGE_DAMAGE_SPELL_IDS);

/**
 * Ignite: a Fire crit burns for a share of the damage it just dealt.
 *
 * THE MAGNITUDE COMES OFF THE ATTACK, which is what `attack.amount` is for and
 * is why the aura is built per proc rather than declared once. A crit for 1200
 * with 5/5 Ignite is 480 over four seconds.
 *
 * NON-PERIODIC ONLY, checked by refusing anything whose ability id is a
 * DoT's. Without it Ignite's own ticks would crit and re-apply Ignite, which
 * compounds forever off a single lucky roll.
 */
export const ignite: TalentReactionBuilder = (percentOfDamage) => ({
  id: 'ignite',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (_context, _actor, attack) =>
    attack.abilityId !== undefined &&
    FIRE_SPELLS.has(attack.abilityId) &&
    attack.amount > 0,
  onTrigger: (context, actor, attack) => {
    const target = context.combatant(attack.defender.id);
    if (!target) return;
    context.applyAura(target, igniteAura((attack.amount * percentOfDamage) / 100), actor.id);
  },
});

/*
 * ============================================================================
 * COMBUSTION'S RAMP AND ITS END, IN ONE REACTION, because they are one
 * sentence: "each of your Fire damage spell hits increases your critical
 * strike chance with Fire damage spells by 10%. This effect lasts until you
 * have caused 4 non-periodic critical strikes with Fire spells."
 *
 * IT USED TO BE NEITHER. The ability applied ten stacks at once for a
 * placeholder thirty seconds, and the stacks were `spellCritChance` -- every
 * school, not Fire -- so a three-minute cooldown was worth +100% crit to
 * everything the Mage cast. All three errors pointed the same way and all
 * three were written down, which is the only reason it was allowed to stand.
 *
 * "NON-PERIODIC" NEEDS NO CHECK. A reaction only ever sees attacks that went
 * through a combat table, and `dealDamage` dispatches none for a tick -- so
 * Pyroblast's burn cannot spend one of the four crits. That is stated here
 * because the tooltip says the word and a reader will look for it.
 *
 * THE COUNTER IS PER CHARACTER, held in this closure, which is the same reason
 * an internal cooldown is: a batch that shared one closure between iterations
 * would carry the first Mage's crit count into the second's window. It is
 * keyed on the aura's `appliedAt` so a SECOND Combustion starts from zero --
 * and `appliedAt` survives a stack, because `refresh` leaves it alone for a
 * permanent aura.
 * ============================================================================
 */
export const combustionCounter: TalentReactionBuilder = () => {
  let countedWindow = -1;
  let crits = 0;

  return {
    id: 'combustion',
    on: 'dealt',
    outcomes: ['hit', 'crit'],
    canTrigger: (_context, actor, attack) =>
      actor.auras.has(COMBUSTION.id) &&
      attack.abilityId !== undefined &&
      FIRE_SPELLS.has(attack.abilityId),
    onTrigger: (context, actor, attack) => {
      const aura = actor.auras.get(COMBUSTION.id);
      if (!aura) return;
      if (aura.appliedAt !== countedWindow) {
        countedWindow = aura.appliedAt;
        crits = 0;
      }

      /*
       * THE STACK GOES ON FIRST AND THE END IS CHECKED SECOND, which is the
       * order the tooltip reads and the order that costs nothing either way:
       * the hit being reacted to has already rolled, so this stack is for the
       * spells after it and the removal below takes it straight off again on
       * the fourth crit.
       */
      context.applyAura(actor, COMBUSTION, actor.id);

      if (attack.outcome !== 'crit') return;
      crits += 1;
      if (crits >= COMBUSTION_CRITS_TO_END) actor.auras.remove(context, COMBUSTION.id);
    },
  };
};

/**
 * Master of Elements: a Fire or Frost crit refunds part of the base mana cost.
 *
 * THE BASE COST, NOT WHAT WAS PAID. A Clearcasting-free Fireball that crits
 * still refunds 30% of 410, which is what "their base mana cost" says -- and
 * it is the reading that makes the talent worth taking with Arcane
 * Concentration, which a 47-point Arcane build has and a Fire build does not.
 *
 * The cost is read off the caster's own copy of the ability, so a talent that
 * reduced it reduces the refund too.
 */
export const masterOfElements: TalentReactionBuilder = (percentRefunded) => ({
  id: 'master_of_elements',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (_context, actor, attack) => {
    if (attack.abilityId === undefined) return false;
    // Fire and Frost, by the spells that are them.
    if (!FIRE_SPELLS.has(attack.abilityId) && attack.abilityId !== 'frostbolt') return false;
    return (actor.abilities.get(attack.abilityId)?.cost?.amount ?? 0) > 0;
  },
  onTrigger: (context, actor, attack) => {
    const cost = actor.abilities.get(attack.abilityId!)?.cost?.amount ?? 0;
    context.grantResource(actor, 'mana', (cost * percentRefunded) / 100, {
      id: 'master_of_elements',
      name: 'Master of Elements',
    });
  },
});

/**
 * Heating Up: a non-periodic Fire crit shortens Pyroblast.
 *
 * FOUR NAMED SPELLS, and Pyroblast is not one of them -- so a Pyroblast crit
 * does not refresh the buff that made it fast. Reading "Fire damage spells"
 * here instead would let the spell feed itself.
 *
 * CALLED HOT STREAK UNTIL CLIENT BUILD 1.60.1.70170, and the four spells it
 * names did not change with the name.
 */
export const heatingUp: TalentReactionBuilder = () => ({
  id: 'heating_up',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (_context, _actor, attack) =>
    attack.abilityId !== undefined && HEATING_UP_TRIGGERS.has(attack.abilityId),
  onTrigger: (context, actor) => {
    context.applyAura(actor, HEATING_UP, actor.id);
  },
});

/**
 * Arcane Concentration: a damage spell that HITS may grant Clearcasting.
 *
 * "After any damage spell hits a target" -- so an avoided spell rolls nothing,
 * which `outcomes` expresses directly.
 */
export const arcaneConcentration: TalentReactionBuilder = (chancePercent) => ({
  id: 'arcane_concentration',
  on: 'dealt',
  outcomes: ['hit', 'crit'],
  canTrigger: (context, _actor, attack) =>
    attack.abilityId !== undefined &&
    DAMAGE_SPELLS.has(attack.abilityId) &&
    context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    context.applyAura(actor, CLEARCASTING, actor.id);
  },
});

/**
 * Missile Barrage: Arcane Blast at 40%, three others at 20%.
 *
 * TWO RATES IN ONE TALENT. The 40 comes through the values file, hand-filled
 * because a single-rank talent has no variable the calculator can identify --
 * and the 20 is named here, because a builder takes one number and the text
 * carries two. Both are the source's own.
 */
export const MISSILE_BARRAGE_CHANCE_OTHERS = 20;
const MISSILE_BARRAGE_OTHERS = new Set(['fireball', 'frostbolt', 'frostfire_bolt']);

export const missileBarrage: TalentReactionBuilder = (chanceFromArcaneBlast) => ({
  id: 'missile_barrage',
  on: 'dealt',
  outcomes: ['hit', 'crit'],
  canTrigger: (context, _actor, attack) => {
    const id = attack.abilityId;
    if (id === undefined) return false;
    const chance =
      id === 'arcane_blast'
        ? chanceFromArcaneBlast
        : MISSILE_BARRAGE_OTHERS.has(id)
          ? MISSILE_BARRAGE_CHANCE_OTHERS
          : 0;
    return chance > 0 && context.rng.rollChance(chance / 100);
  },
  onTrigger: (context, actor) => {
    context.applyAura(actor, MISSILE_BARRAGE, actor.id);
  },
});

/**
 * Improved Scorch, properly. Scorch applies a stacking Fire vulnerability.
 *
 * The talent's values are `[chance, percentPerStack, duration, maxStacks]`, and
 * the effect table hands over the CHANCE at index 0. The per-stack percentage
 * is index 1 and is the same 3 at every rank, so it is named here rather than
 * threaded through a second builder argument.
 */
export const IMPROVED_SCORCH_PERCENT_PER_STACK = 3;

export const improvedScorchReaction: TalentReactionBuilder = (chancePercent) => ({
  id: 'improved_scorch',
  on: 'dealt',
  outcomes: ['hit', 'crit'],
  canTrigger: (context, _actor, attack) =>
    attack.abilityId === 'scorch' && context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor, attack) => {
    context.applyAura(
      attack.defender,
      fireVulnerabilityAura(IMPROVED_SCORCH_PERCENT_PER_STACK),
      actor.id,
    );
  },
});

/*
 * ============================================================================
 * WINTER'S CHILL: a Frost damage spell may leave a stacking crit debuff.
 *
 * "Gives your Frost damage spells a {0}% chance to apply the Winter's Chill
 * effect, which increases the chance your Ice Lance and Frostbolt spells will
 * critically hit the target by 2% for 15 sec. Stacks up to {3} times."
 *
 * THE FIRST PROC HERE WHOSE RANK MOVES TWO NUMBERS, which is why it takes the
 * whole values row: the chance is index 0 and the stack cap is index 3, and
 * they scale together 20/1 .. 100/5. Deriving one from the other works today
 * and is exactly the arithmetic that goes wrong the day a rank changes.
 *
 * WHAT APPLIES IT AND WHAT BENEFITS ARE DIFFERENT SETS, and the tooltip says
 * so: any Frost damage spell applies it, and only Ice Lance and Frostbolt crit
 * more for it. Frostfire Bolt is in the first and not the second.
 *
 * `WINTERS_CHILL_MAX_STACKS_INDEX` IS NAMED because an index into a values row
 * read wrong is the failure this project keeps meeting -- Arcane Mind's crit
 * clause at index 0 would have been a tenth of its value.
 * ============================================================================
 */
const WINTERS_CHILL_MAX_STACKS_INDEX = 3;

export const wintersChill: TalentReactionBuilder = (chancePercent, values) => {
  /*
   * NO FALLBACK IF THE ROW IS SHORT. A default of 1 would be a talent silently
   * capped at one stack -- a fifth of its value, and no error -- so the aura
   * is built with whatever the file states and a test pins all five ranks.
   */
  const maxStacks = values?.[WINTERS_CHILL_MAX_STACKS_INDEX] ?? 1;
  return {
    id: 'winter_s_chill',
    on: 'dealt',
    outcomes: ['hit', 'crit'],
    canTrigger: (context, _actor, attack) =>
      attack.abilityId !== undefined &&
      FROST_SPELL_IDS.includes(attack.abilityId) &&
      context.rng.rollChance(chancePercent / 100),
    onTrigger: (context, actor, attack) => {
      context.applyAura(attack.defender, wintersChillAura(maxStacks), actor.id);
    },
  };
};

/*
 * ============================================================================
 * FINGERS OF FROST, IN TWO REACTIONS, because the talent has two verbs.
 *
 *   PROCS  off a Chill effect, and a Chill effect is a spell that slows --
 *          Frostbolt and Frostfire Bolt both say "slowing movement speed by
 *          40%". Named by ability id rather than by a slow the engine does not
 *          model, which is the honest way round: nothing here has movement, so
 *          "a Chill effect" cannot be detected and has to be declared.
 *
 *   SPENDS on every cast, because the tooltip says "your next 2 SPELLS" and
 *          not "your next 2 Ice Lances". A charge that only Ice Lance could
 *          spend would survive a Scorch and a Pyroblast cast above it in the
 *          list -- which is generous, and generous in the direction nobody
 *          would notice.
 *
 * AND THE CAST THAT PROCCED IT DOES NOT SPEND A CHARGE. Cast reactions run
 * after `onCast`, so the Frostbolt whose damage applied the aura would
 * otherwise immediately eat one of its own charges. "Your NEXT 2 spells" is
 * what rules that out, and `appliedAt < now` is how it is checked.
 * ============================================================================
 */

/** The ids that slow, which is what "a Chill effect" means here. */
export const CHILL_ABILITY_IDS: readonly string[] = ['frostbolt', 'frostfire_bolt'];

export const fingersOfFrost = (charges: number): Reaction => ({
  id: 'fingers_of_frost',
  on: 'dealt',
  outcomes: ['hit', 'crit'],
  canTrigger: (context, _actor, attack) =>
    attack.abilityId !== undefined &&
    CHILL_ABILITY_IDS.includes(attack.abilityId) &&
    context.rng.rollChance(FINGERS_OF_FROST_PROC_CHANCE / 100),
  onTrigger: (context, actor) => {
    context.applyAura(actor, fingersOfFrostAura(charges), actor.id);
  },
});

/*
 * ============================================================================
 * ARCANE BLAST'S WINDOW, ENDED BY THE SPELL THAT COLLECTED IT.
 *
 * "Effect stacks up to 4 times and lasts 8 sec or until any other damage spell
 * is cast." Read literally against the sentence before it -- "the damage of
 * all your OTHER spells is increased by 10%" -- the bonus is destroyed by the
 * only thing that could ever collect it, and the clause pays nothing. So the
 * reading taken is that the other spell TAKES the bonus and the stacks then
 * go, which is the project's standing rule for a specification that would
 * otherwise disable itself.
 *
 * `cast.final` IS WHAT MAKES A CHANNEL WORK. `runCast` runs once per tick, so
 * without it the first of five missiles would end the window and the other
 * four would fire unbuffed -- a smaller number, no error, and the opposite of
 * what the owner's own Arcane list is built to do.
 *
 * WIRED THROUGH THE TALENT THAT GRANTS THE SPELL, which is the only hook a
 * cast reaction has: `MAGE_CAST_REACTIONS` is keyed by talent id, and a Mage
 * without the Arcane Blast talent has neither the spell nor the aura. Its
 * value -- the 10 -- is hand-filled in the values file and cross-checked
 * against `ARCANE_BLAST_DAMAGE_PER_STACK` by a test, because an effect that
 * reads no value is DROPPED rather than reported.
 * ============================================================================
 */
export const arcaneBlastSpender = (): CastReaction => ({
  id: 'arcane_blast_spend',
  canTrigger: (_context, actor, cast) =>
    cast.final &&
    cast.ability.id !== 'arcane_blast' &&
    DAMAGE_SPELLS.has(cast.ability.id) &&
    actor.auras.has(ARCANE_BLAST.id),
  onTrigger: (context, actor) => {
    actor.auras.remove(context, ARCANE_BLAST.id);
  },
});

export const fingersOfFrostSpender = (): CastReaction => ({
  id: 'fingers_of_frost_spend',
  canTrigger: (context, actor) => {
    const aura = actor.auras.get(FINGERS_OF_FROST.id);
    return aura !== undefined && aura.appliedAt < context.clock.now();
  },
  onTrigger: (context, actor) => {
    actor.auras.consumeStack(context, FINGERS_OF_FROST.id);
  },
});

/** Procs that fire on a cast, by the talent that grants them. */
export const MAGE_CAST_REACTIONS: Readonly<Record<string, (value: number) => CastReaction>> = {
  fingers_of_frost: fingersOfFrostSpender,
  arcane_blast: arcaneBlastSpender,
};

export const MAGE_TALENT_REACTIONS: Readonly<Record<string, TalentReactionBuilder>> = {
  ignite,
  combustion: combustionCounter,
  master_of_elements: masterOfElements,
  heating_up: heatingUp,
  arcane_concentration: arcaneConcentration,
  missile_barrage: missileBarrage,
  improved_scorch: improvedScorchReaction,
  fingers_of_frost: fingersOfFrost,
  winter_s_chill: wintersChill,
};
