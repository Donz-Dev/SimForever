import type { Ability } from '../../engine';
import { applyHealing, seconds } from '../../engine';
import {
  MAJOR_FRENZY_POTION_AURA,
  MAJOR_SPELLBLASTING_POTION_AURA,
  MIGHTY_RAGE_POTION_AURA,
} from '../auras/consumables';

/**
 * The nine consumables a character uses DURING a fight, as abilities.
 *
 * ============================================================================
 * THE TWELVE CATEGORIES THAT CAME BEFORE THESE ARE STATS; THESE ARE ACTIONS,
 * AND THAT IS THE WHOLE DIFFERENCE.
 *
 * A flask is drunk before the pull and lasts the fight, so it is a layer of the
 * starting stat block and needs no uptime row, no cooldown and no decision --
 * `buffs/consumables.ts` says so at length. A potion is pressed at a moment
 * somebody chooses, on a cooldown, for an effect that may be wasted if the
 * moment is wrong. There is exactly one thing in this project shaped like that,
 * and it is an ability.
 *
 * SO THEY GO THROUGH THE ABILITY BOOK AND THE PRIORITY LIST, which is what the
 * ruleset owner asked for: "must be treated like a character ability and be
 * exposed on the APL and consumable panels". Everything below follows from
 * that one sentence rather than from any new engine capability -- nothing here
 * needed a field that did not already exist.
 *
 * ============================================================================
 * ALL NINE ARE OFF THE GLOBAL COOLDOWN, BY THE OWNER'S RULING.
 *
 * Being off it means ONE thing in this engine -- the ability does not START a
 * global cooldown -- and what it buys is that the action AFTER it is free. It is
 * still BLOCKED by a global cooldown already running, so a potion is not a way
 * to act twice in an instant; it is a way to drink without giving up a cast.
 *
 * THIS MATTERS MORE THAN IT LOOKS, AND IT IS THE SAME LESSON THE RACIALS
 * LEARNED NEXT DOOR. An ability wrongly taking a global cooldown still restores
 * the right pool for the right amount on the right cooldown, so the mistake is
 * invisible everywhere except the DPS figure -- which is why four of the five
 * racials say `triggersGcd: false` in their own line and why all nine of these
 * do too.
 *
 * `triggersGcd` IS DECLARED RATHER THAN DERIVED. The engine derives it as
 * `triggersGcd ?? onNextSwing === undefined`, which makes an on-next-swing
 * ability free and everything else not -- right for a class ability and wrong
 * for every one of these.
 *
 * ============================================================================
 * NONE OF THEM COSTS A RESOURCE, AND ONE OF THEM COSTS HEALTH.
 *
 * `Ability.cost` is for a pool the engine checks and refunds; the Demonic Rune's
 * 600 to 1000 Hit Points is neither -- health is not a refundable resource and
 * the amount is rolled per use. It is spent inside `onCast`, which is where Life
 * Tap already spends its own, and guarded by the same `canCast`.
 *
 * ============================================================================
 * NONE OF THEM NEEDS A TARGET. All nine act on the drinker, so `requiresTarget`
 * is false on each: an ability asking for a target it does not use would be
 * refused by `checkCast` in any fight that had none.
 *
 * AND NONE OF THEM IS GATED ON BEING WORTH ANYTHING. A healing potion drunk at
 * full health is pure overhealing and a mana potion drunk at full mana is pure
 * overflow, and neither carries a `canCast` refusing it -- because in the game
 * you may do exactly that, and WHEN to drink is the decision the priority list
 * exists to express. "A gate an ability's own `canCast` enforces belongs there
 * and not in the list" is the rule, and its converse is this: a gate the LIST
 * should own does not belong on the ability. The stock entries carry those
 * conditions; see `rotations/consumableCooldowns.ts`.
 * ============================================================================
 */

/**
 * The cooldown every Potion shares, from the owner's own statement: using one
 * "put[s] all Potions on a 2 min cooldown".
 */
export const POTION_COOLDOWN_MS = seconds(120);

/**
 * The group that shares it.
 *
 * ----------------------------------------------------------------------------
 * INERT TODAY, AND DECLARED ANYWAY. A selection holds at most one consumable
 * per CATEGORY, so a character can never carry two Potions and there is never a
 * second ability for the group's cooldown to reach -- the exclusivity the owner
 * described as the effect of the shared cooldown is already a property of the
 * shape, "effectively make the choice exclusive".
 *
 * So this is the owner's sentence written down where it is enforced rather than
 * assumed. It costs nothing while the shape holds and is the difference between
 * a correct simulator and a quietly generous one the day anything lets a
 * character hold two -- which is the direction every mistake of this kind in
 * this project has gone.
 * ----------------------------------------------------------------------------
 */
export const POTION_COOLDOWN_GROUP = 'potion';

// ---------------------------------------------------------------------------
// Potions
// ---------------------------------------------------------------------------

/** "Restores 1050 to 1750 Hit Points." */
export const MAJOR_HEALING_POTION_MINIMUM = 1050;
export const MAJOR_HEALING_POTION_MAXIMUM = 1750;

/**
 * Major Healing Potion.
 *
 * ============================================================================
 * THE STATED RANGE IS THE WHOLE ANSWER, BY THE OWNER'S RULING: nothing about the
 * drinker scales it. `external: true` is the flag that enforces that and
 * `canCrit: false` is the other half -- a crit would quietly make 1750 into
 * 2625, and healing crits by default.
 *
 * THE FLAG IS NAMED FOR THE ASSUMED HEALER AND IS USED HERE FOR ITS EFFECT,
 * which is worth saying out loud because the two readings of a heal are already
 * split in this project and the split goes the other way. The Crusader
 * enchant's heal is deliberately NOT external, "because this heal genuinely
 * comes from the character's own enchant, so if anything ever raises their
 * healing done it should raise this too". A potion is not the character's own
 * power at all: it is a flat quantity in a bottle, and the owner has ruled it
 * flat.
 *
 * IT IS WORTH ZERO DPS ON TWENTY-THREE OF THE 25 PRESETS AND THAT IS CORRECT.
 * Nothing attacks them, so health never leaves maximum and every point of this
 * is overhealing -- which the heal event reports as such rather than hiding.
 * The two tanks are where it means anything, and there it is a count of deaths
 * rather than a damage figure.
 * ============================================================================
 */
export const MAJOR_HEALING_POTION_ABILITY: Ability = {
  id: 'major_healing_potion',
  name: 'Major Healing Potion',
  cooldownMs: POTION_COOLDOWN_MS,
  cooldownGroup: POTION_COOLDOWN_GROUP,
  requiresTarget: false,
  triggersGcd: false,
  onCast: ({ simulation, caster, ability }) => {
    applyHealing(simulation, {
      source: caster,
      target: caster,
      abilityId: ability.id,
      abilityName: ability.name,
      baseAmount: simulation.rng.nextInt(
        MAJOR_HEALING_POTION_MINIMUM,
        MAJOR_HEALING_POTION_MAXIMUM,
      ),
      canCrit: false,
      external: true,
    });
  },
};

/** "Restores 1350 to 2250 Mana." */
export const MAJOR_MANA_POTION_MINIMUM = 1350;
export const MAJOR_MANA_POTION_MAXIMUM = 2250;

/**
 * Major Mana Potion.
 *
 * `grantResource` rather than `Resource.gain`, which is what makes the overflow
 * visible: it emits a `resource_gained` event carrying `wasted`, and that column
 * is the only thing that can say a potion was drunk into a nearly full pool.
 * A DPS figure cannot -- it was the Cat's Shifting Power waste that showed a
 * gate could be worth POSITIVE DPS, and the same reading applies to the entry
 * condition on this.
 *
 * A CLASS WITHOUT A MANA POOL IS NOT AN ERROR. `grantResource` finds no pool and
 * ignores it, so a Warrior that somehow carried this would simply gain nothing
 * -- but nothing offers it one: the panel gates the choice and the ability book
 * gates the ability, which is where that is decided.
 */
export const MAJOR_MANA_POTION_ABILITY: Ability = {
  id: 'major_mana_potion',
  name: 'Major Mana Potion',
  cooldownMs: POTION_COOLDOWN_MS,
  cooldownGroup: POTION_COOLDOWN_GROUP,
  requiresTarget: false,
  triggersGcd: false,
  onCast: ({ simulation, caster, ability }) => {
    simulation.grantResource(
      caster,
      'mana',
      simulation.rng.nextInt(MAJOR_MANA_POTION_MINIMUM, MAJOR_MANA_POTION_MAXIMUM),
      { id: ability.id, name: ability.name },
    );
  },
};

/** "Restores Rage by 45 to 75, and increases Strength by 60 for 20 seconds." */
export const MIGHTY_RAGE_POTION_MINIMUM_RAGE = 45;
export const MIGHTY_RAGE_POTION_MAXIMUM_RAGE = 75;

/**
 * Mighty Rage Potion: a Warrior's and a Druid's.
 *
 * ============================================================================
 * TWO EFFECTS IN ONE USE, AND THEY ARE DIFFERENT SHAPES. The rage is instant,
 * rolled per use and gone; the strength lasts twenty seconds. So the rage is
 * here and the strength is an aura -- the same split Enrage and a dozen other
 * two-clause abilities already make, rather than one mechanism stretched over
 * both.
 *
 * A CAT DRUID DRINKS IT FOR THE STRENGTH ALONE, which is the entry a reader
 * would get wrong from the name: sixty strength is 120 attack power to a Druid,
 * three times what the Major Frenzy Potion gives it, and the rage is worth
 * nothing. So the potion is named for the half that does nothing for the build
 * most likely to drink it.
 *
 * AND THE REASON THE RAGE IS WORTH NOTHING IS NOT THE OBVIOUS ONE, which is
 * worth writing down because the obvious one is wrong. A Cat DOES have a rage
 * pool: `resourceSpecsFor` keys pools by CLASS and not by form, so a Druid owns
 * mana, rage and energy in every form, and the 45 to 75 genuinely lands. What
 * makes it worthless is that nothing ever takes it out again -- measured at
 * **zero rage gained and zero spent over twenty fights** on the Cat preset
 * (`tools/probe_cat_rage.ts`), because every ability a Cat casts costs energy.
 *
 * THE FIRST VERSION OF THIS COMMENT SAID "Cat Form has an energy pool and no
 * rage, so `grantResource` finds nothing" -- specific, mechanical, plausible,
 * and contradicted by the function two files away. It reached the same
 * conclusion by an argument that was false, which is this project's own rule
 * about a prediction in a comment being a measurement that has not happened.
 *
 * THE RAGE IS NOT MULTIPLIED BY ANYTHING. `critResourceMultiplier` is a rule
 * about a critical SWING and this is not one; and Forever's two rage rules are
 * "flat per swing" and "per point of damage taken", neither of which a potion
 * is. Forty-five to seventy-five is the figure.
 * ============================================================================
 */
export const MIGHTY_RAGE_POTION_ABILITY: Ability = {
  id: 'mighty_rage_potion',
  name: 'Mighty Rage Potion',
  cooldownMs: POTION_COOLDOWN_MS,
  cooldownGroup: POTION_COOLDOWN_GROUP,
  requiresTarget: false,
  triggersGcd: false,
  onCast: ({ simulation, caster, ability }) => {
    simulation.grantResource(
      caster,
      'rage',
      simulation.rng.nextInt(MIGHTY_RAGE_POTION_MINIMUM_RAGE, MIGHTY_RAGE_POTION_MAXIMUM_RAGE),
      { id: ability.id, name: ability.name },
    );
    simulation.applyAura(caster, MIGHTY_RAGE_POTION_AURA, caster.id);
  },
};

/** "Grants 40 Attack Power and Ranged Attack Power for 30 seconds." */
export const MAJOR_FRENZY_POTION_ABILITY: Ability = {
  id: 'major_frenzy_potion',
  name: 'Major Frenzy Potion',
  cooldownMs: POTION_COOLDOWN_MS,
  cooldownGroup: POTION_COOLDOWN_GROUP,
  requiresTarget: false,
  triggersGcd: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, MAJOR_FRENZY_POTION_AURA, caster.id);
  },
};

/**
 * Why Major Mender's Potion does nothing, in the source's own words.
 *
 * ----------------------------------------------------------------------------
 * DECLARED ONCE AND READ TWICE -- by the ability, where the engine records what
 * it cannot do, and by the consumable, where the Consumables panel prints it
 * beside the choice. Two hand-written copies of one caveat is two things to keep
 * in step, and the one that drifts is the one somebody reads.
 * ----------------------------------------------------------------------------
 */
export const MAJOR_MENDERS_POTION_UNMODELLED =
  'Healing power is not a stat the engine has: nothing a character does here ' +
  'heals anybody, so there is no throughput for it to scale. Selectable, ' +
  'castable and worth nothing -- the same as the Food row\'s "+44 Healing ' +
  'Power" and the two Healing Power armour enchants.';

/**
 * Major Mender's Potion: "Grants 75 Healing Power for 30 seconds."
 *
 * ============================================================================
 * AN ABILITY THAT DOES NOTHING, AND IT IS DECLARED ANYWAY SO THAT IT SAYS SO.
 *
 * Healing power is not a stat `STAT_NAMES` carries, and nothing in this
 * simulator heals anybody -- so there is no throughput for seventy-five of it to
 * scale. "An inert effect that SAYS it is inert is the honest failure mode", and
 * the alternative was to leave the row out of the catalogue, which would have
 * been this simulator quietly deciding the owner's table has six potions rather
 * than seven.
 *
 * IT APPLIES NO AURA, WHICH IS THE PART WORTH BEING DELIBERATE ABOUT. A
 * 30-second aura carrying nothing would put a row on the buff-uptime table
 * reporting 30 seconds of a potion that did not do anything -- which is exactly
 * how Adrenaline Rush hid for the life of the project, reporting 24.9% uptime
 * while delivering no energy. There is nothing to show, so nothing is shown.
 *
 * WHAT IT STILL COSTS IS ONE ROTATION POLL, about 100ms per two minutes, the
 * same price every other off-GCD entry pays. That is the honest cost of having
 * it in a list and is why its `note` on the stock entry says to switch the entry
 * off rather than leaving it to fire.
 * ============================================================================
 */
export const MAJOR_MENDERS_POTION_ABILITY: Ability = {
  id: 'major_menders_potion',
  name: "Major Mender's Potion",
  cooldownMs: POTION_COOLDOWN_MS,
  cooldownGroup: POTION_COOLDOWN_GROUP,
  requiresTarget: false,
  triggersGcd: false,
  onCast: () => {
    /* Nothing to do: see `MAJOR_MENDERS_POTION_UNMODELLED`. */
  },
  unmodelled: MAJOR_MENDERS_POTION_UNMODELLED,
};

/** "Grants 40 Spell Power for 30 seconds." */
export const MAJOR_SPELLBLASTING_POTION_ABILITY: Ability = {
  id: 'major_spellblasting_potion',
  name: 'Major Spellblasting Potion',
  cooldownMs: POTION_COOLDOWN_MS,
  cooldownGroup: POTION_COOLDOWN_GROUP,
  requiresTarget: false,
  triggersGcd: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, MAJOR_SPELLBLASTING_POTION_AURA, caster.id);
  },
};

// ---------------------------------------------------------------------------
// Other
// ---------------------------------------------------------------------------

/*
 * THE SECOND CATEGORY, AND ITS EXCLUSIVITY IS WITH ITSELF RATHER THAN WITH THE
 * POTIONS. The owner: these "are not exclusive with Potions BUT ARE EXCLUSIVE
 * with all items in the Other category" -- which is one more category keyed the
 * same way, so a character may drink one Potion and use one Other and nothing
 * has to permit it.
 *
 * NONE OF THE THREE SHARES A COOLDOWN WITH ANYTHING. The owner states a cooldown
 * per item -- five minutes, two and two -- and no group, so none is declared.
 * Reading the Potions' shared cooldown across to these by analogy is the
 * mistake Explosive Trap taught: a ruling covers what it says.
 */

/** "Restores 100 Energy. 5 minute cooldown." */
export const THISTLE_TEA_ENERGY = 100;
export const THISTLE_TEA_COOLDOWN_MS = seconds(300);

/**
 * Thistle Tea: a Rogue's and a Druid's.
 *
 * A FULL ENERGY BAR, which is what makes the entry condition on it matter more
 * than on anything else here: an energy pool caps at 100, so a hundred energy
 * drunk at fifty is fifty energy thrown away. `grantResource` reports that in
 * `wasted`, and the Cat's Shifting Power is the worked example of a gate on
 * exactly this being worth POSITIVE DPS.
 *
 * FIVE MINUTES, so it fires at most once in any fight this simulator runs --
 * the default is sixty seconds and the longest anyone measures is a few
 * minutes. The cooldown is still the owner's figure rather than a simplification
 * of it.
 */
export const THISTLE_TEA_ABILITY: Ability = {
  id: 'thistle_tea',
  name: 'Thistle Tea',
  cooldownMs: THISTLE_TEA_COOLDOWN_MS,
  requiresTarget: false,
  triggersGcd: false,
  onCast: ({ simulation, caster, ability }) => {
    simulation.grantResource(caster, 'energy', THISTLE_TEA_ENERGY, {
      id: ability.id,
      name: ability.name,
    });
  },
};

/** "Restores 900 to 1500 mana at the cost of 600 to 1000 Hit Points." */
export const DEMONIC_RUNE_MINIMUM_MANA = 900;
export const DEMONIC_RUNE_MAXIMUM_MANA = 1500;
export const DEMONIC_RUNE_MINIMUM_HEALTH = 600;
export const DEMONIC_RUNE_MAXIMUM_HEALTH = 1000;
export const DEMONIC_RUNE_COOLDOWN_MS = seconds(120);

/**
 * Demonic Rune: mana for health.
 *
 * ============================================================================
 * IT IS REFUSED RATHER THAN ALLOWED TO KILL, BY THE OWNER'S RULING, AND THE
 * GUARD IS ON THE MAXIMUM COST RATHER THAN THE ROLLED ONE.
 *
 * `canCast` runs BEFORE the cost is rolled -- the roll happens inside `onCast`
 * -- so the only honest question it can ask is whether EVERY roll is affordable.
 * A thousand health is that threshold, so a character on 800 cannot use it even
 * though a roll of 600 would have been payable. That is the conservative
 * direction, and the cost of the other one is worse than it looks.
 *
 * WHAT MAKES THE GUARD LOAD-BEARING RATHER THAN TIDY: `Resource.spend` is
 * ALL-OR-NOTHING. It "returns false and changes nothing" when the pool is
 * short -- so without this, a character below the cost would pay NO health and
 * still collect the mana. A free Demonic Rune is a bigger number and no error,
 * and nothing in the results page would have said which half failed.
 *
 * THE GUARD MIRRORS LIFE TAP'S, which is the same trade in the same direction
 * and already carries `caster.health.current > LIFE_TAP_AMOUNT`. One half of
 * Life Tap's guard is deliberately NOT copied: it also refuses when there is no
 * mana worth gaining, which is right for a spammable filler and wrong for a
 * two-minute cooldown -- when to spend one is the list's decision, and the
 * stock entry's condition is where it is written.
 * ============================================================================
 */
export const DEMONIC_RUNE_ABILITY: Ability = {
  id: 'demonic_rune',
  name: 'Demonic Rune',
  cooldownMs: DEMONIC_RUNE_COOLDOWN_MS,
  requiresTarget: false,
  triggersGcd: false,
  canCast: ({ caster }) => caster.health.current > DEMONIC_RUNE_MAXIMUM_HEALTH,
  onCast: ({ simulation, caster, ability }) => {
    /*
     * HEALTH FIRST AND MANA SECOND, so a `spend` that somehow failed cannot be
     * followed by a gain that succeeded. `canCast` has already established that
     * it cannot fail; this is the order that makes that a belt rather than a
     * braces.
     */
    caster.health.spend(
      simulation.rng.nextInt(DEMONIC_RUNE_MINIMUM_HEALTH, DEMONIC_RUNE_MAXIMUM_HEALTH),
    );
    simulation.grantResource(
      caster,
      'mana',
      simulation.rng.nextInt(DEMONIC_RUNE_MINIMUM_MANA, DEMONIC_RUNE_MAXIMUM_MANA),
      { id: ability.id, name: ability.name },
    );
  },
};

/** "Restores 1440 Hit Points. 2 minute cooldown." */
export const HEALTHSTONE_HEALTH = 1440;
export const HEALTHSTONE_COOLDOWN_MS = seconds(120);

/**
 * Healthstone.
 *
 * FLAT, NOT A RANGE, which is the only thing separating it from the Major
 * Healing Potion mechanically -- so it takes the same `external: true` and
 * `canCrit: false` for the same reason, and the owner's ruling that the stated
 * figure is the whole answer covers both.
 *
 * ITS TWO-MINUTE COOLDOWN IS ITS OWN, not the Potions' shared one: it is in the
 * Other category, which the owner says is not exclusive with Potions. So a
 * character may carry a Major Mana Potion AND a Healthstone and use both.
 */
export const HEALTHSTONE_ABILITY: Ability = {
  id: 'healthstone',
  name: 'Healthstone',
  cooldownMs: HEALTHSTONE_COOLDOWN_MS,
  requiresTarget: false,
  triggersGcd: false,
  onCast: ({ simulation, caster, ability }) => {
    applyHealing(simulation, {
      source: caster,
      target: caster,
      abilityId: ability.id,
      abilityName: ability.name,
      baseAmount: HEALTHSTONE_HEALTH,
      canCrit: false,
      external: true,
    });
  },
};

/**
 * Every mid-fight consumable ability, by id.
 *
 * ----------------------------------------------------------------------------
 * NOT A SECOND SOURCE OF TRUTH. `buffs/consumables.ts` names each ability by
 * REFERENCE -- `ability: MAJOR_MANA_POTION_ABILITY` on the entry itself -- so
 * there is no id to resolve and no lookup that can miss. That is the one
 * difference from `RACIAL_ABILITIES` and `TALENT_AURAS`, both of which resolve
 * an id through a table and DROP what they cannot find: `lone_wolf` was never
 * registered and both Hunter profiles named after the talent went the whole
 * project without its 20% damage, with nothing erroring.
 *
 * This map exists for the readers that have an id and want the ability --
 * `withoutUnselectedConsumables` telling one entry from another, and the tests.
 * It is derived from the catalogue rather than written out, in
 * `buffs/consumables.ts`, so it cannot disagree with it either.
 * ----------------------------------------------------------------------------
 */
export const MID_FIGHT_CONSUMABLE_ABILITIES: readonly Ability[] = [
  MAJOR_HEALING_POTION_ABILITY,
  MAJOR_MANA_POTION_ABILITY,
  MIGHTY_RAGE_POTION_ABILITY,
  MAJOR_FRENZY_POTION_ABILITY,
  MAJOR_MENDERS_POTION_ABILITY,
  MAJOR_SPELLBLASTING_POTION_ABILITY,
  THISTLE_TEA_ABILITY,
  DEMONIC_RUNE_ABILITY,
  HEALTHSTONE_ABILITY,
];
