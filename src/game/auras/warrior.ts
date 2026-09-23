import type { AuraDefinition, SimulationContext } from '../../engine';
import { RATING_PER_PERCENT, dealDamage, flat, seconds } from '../../engine';

/**
 * Warrior auras, from WoWForeverWarriorAbilities.xlsx.
 *
 * Read `docs/warrior-abilities.md` before changing anything here: it holds the
 * spreadsheet transcribed verbatim, and the list of what the spreadsheet does
 * not say.
 *
 * ----------------------------------------------------------------------------
 * WHERE THE MAGNITUDES COME FROM
 *
 * The spreadsheet gives a cost, a cooldown and an attack table for every buff
 * and debuff, and NOTHING ELSE. No magnitudes, no durations, no stack counts.
 * Ten of its rows are like this, and for months every one of them was a
 * `PLACEHOLDER_` constant holding zero -- castable, logged, and inert.
 *
 * They are not placeholders any more. `nether.wowhead.com/forever/tooltip/spell/`
 * serves Forever's own spell data, the same way the item endpoint already
 * served Forever items, and `src/data/abilities/forever-warrior.json` holds the
 * captured tooltip for all eleven. Each constant below names the spell id it
 * was read from, and `tests/game/warriorAbilityValues.test.ts` asserts every one
 * against the stored text so a transcription typo fails.
 *
 * THESE ARE NOT CLASSIC VALUES, and the difference is not cosmetic: Forever's
 * Demoralizing Shout removes 210 attack power for 45 seconds where Classic
 * removes 146 for 30. The standing decision to borrow from Classic was never
 * exercised, and would have been 30% wrong on that ability alone.
 *
 * WHAT IS STILL PLACEHOLDER, and why each one is:
 *
 *   - `PLACEHOLDER_BERSERKER_RAGE_*` -- Forever's own tooltip gives no
 *     magnitude. "Generating extra rage when taking damage", no number.
 *   - the Overpower and Revenge windows -- reactive windows are not a spell and
 *     have no tooltip; the 5 second figure is still assumed.
 *
 * Everything else below is sourced. Battle Stance carries no modifiers because
 * Forever says it has none ("A balanced combat stance"), which the engine had
 * assumed and is now confirmed.
 * ----------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// Rend — the one damage-over-time effect the sheet DOES specify in full.
// ---------------------------------------------------------------------------

/**
 * "147 damage/21 sec, ticks every 3 seconds", with a stated 0% coefficient per
 * tick.
 *
 * 21 seconds at one tick every 3 gives 7 ticks, and 147 / 7 is exactly 21 per
 * tick. The numbers divide evenly, which is the reading reproducing the stated
 * total; a partial final tick would not.
 *
 * These are REAL values, not placeholders.
 */
export const REND_TOTAL_DAMAGE = 147;
export const REND_DURATION_MS = seconds(21);
export const REND_TICK_INTERVAL_MS = seconds(3);
export const REND_TICK_COUNT = REND_DURATION_MS / REND_TICK_INTERVAL_MS;
export const REND_DAMAGE_PER_TICK = REND_TOTAL_DAMAGE / REND_TICK_COUNT;

export const REND: AuraDefinition = {
  id: 'rend',
  name: 'Rend',
  durationMs: REND_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: REND_TICK_INTERVAL_MS,
    onTick: (context, aura) => {
      const source = context.combatant(aura.sourceId);
      const target = context.combatant(aura.targetId);
      if (!source || !target || !target.isAlive) return;

      dealDamage(context, {
        source,
        target,
        abilityId: aura.id,
        abilityName: aura.name,
        school: 'physical',
        baseAmount: REND_DAMAGE_PER_TICK,
        // The sheet states "0% per tick": Rend does not scale with attack
        // power at all.
        powerCoefficient: 0,
        // No attack table. Whether Rend landed was decided when it was
        // applied, so its ticks do not roll the table again.
        periodic: true,
        // RULESET: every damage-over-time effect in Forever can crit, at the
        // crit chance of the kind of event that applied it. Rend is applied by
        // a melee special, so its ticks crit at melee crit chance.
        critFrom: 'melee-special',
        // A bleed is physical but ignores armor. True of every DoT here, not
        // just this one.
        appliesArmor: false,
      });
    },
  },
};

// ---------------------------------------------------------------------------
// Sunder Armor — PLACEHOLDER
// ---------------------------------------------------------------------------

/**
 * Spell 11597, rank 5: "reducing it by 450 per Sunder Armor ... Can be applied
 * up to 5 times. Lasts 30 sec."
 *
 * Armor reduction feeds straight into every physical damage event, so this is
 * the single most load-bearing number in the file. The stack count and duration
 * were already right; only the magnitude was missing.
 */
export const SUNDER_ARMOR_PER_STACK = 450;
export const SUNDER_ARMOR_MAX_STACKS = 5;
export const SUNDER_ARMOR_DURATION_MS = seconds(30);

export const SUNDER_ARMOR: AuraDefinition = {
  id: 'sunder_armor',
  name: 'Sunder Armor',
  durationMs: SUNDER_ARMOR_DURATION_MS,
  maxStacks: SUNDER_ARMOR_MAX_STACKS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  modifiersScaleWithStacks: true,
  // 450 per stack to a maximum of 5 is 2250 armor off a 3731-armor boss, which
  // is most of the way to halving its mitigation. Sunder is not a small effect.
  statModifiers: [flat('armor', -SUNDER_ARMOR_PER_STACK)],
};

// ---------------------------------------------------------------------------
// Shouts — PLACEHOLDER
// ---------------------------------------------------------------------------

/**
 * Spell 25289, rank 7: "increasing the melee attack power of all party members
 * within 20 yards by 140. Lasts 3 min."
 *
 * The rank matters: rank 1 grants 12. The simulator runs at level 60 only, so
 * rank 7 is the only one that can apply.
 *
 * The 20 yard radius and the party are both dropped -- the engine simulates one
 * character, so a party-wide buff is a self-buff here. That understates Battle
 * Shout's real worth to a raid by a factor of the raid, and is the honest
 * reading for a single-character simulator.
 *
 * The duration was PLACEHOLDER 120s and is really 180s. At three minutes it
 * outlasts most fights, so it is cast once and never refreshed.
 */
export const BATTLE_SHOUT_ATTACK_POWER = 140;
export const BATTLE_SHOUT_DURATION_MS = seconds(180);

export const BATTLE_SHOUT: AuraDefinition = {
  id: 'battle_shout',
  name: 'Battle Shout',
  durationMs: BATTLE_SHOUT_DURATION_MS,
  statModifiers: [flat('attackPower', BATTLE_SHOUT_ATTACK_POWER)],
};

/**
 * Spell 11556, rank 5: "Reduces the melee attack power of all enemies within 10
 * yards by 210 for 45 sec."
 *
 * CLASSIC SAYS 146 FOR 30 SECONDS. This is the ability that most justifies
 * having fetched Forever's own numbers rather than borrowing: the standing
 * decision would have made it 30% too weak and a third too short.
 *
 * Only useful when the target attacks back, since it lowers the TARGET's damage
 * and changes nothing a standing dummy does.
 */
export const DEMORALIZING_SHOUT_ATTACK_POWER = 210;
export const DEMORALIZING_SHOUT_DURATION_MS = seconds(45);

export const DEMORALIZING_SHOUT: AuraDefinition = {
  id: 'demoralizing_shout',
  name: 'Demoralizing Shout',
  durationMs: DEMORALIZING_SHOUT_DURATION_MS,
  isDebuff: true,
  statModifiers: [flat('attackPower', -DEMORALIZING_SHOUT_ATTACK_POWER)],
};

// ---------------------------------------------------------------------------
// Cooldowns — PLACEHOLDER
// ---------------------------------------------------------------------------

/**
 * Spell 1719: "The warrior will gain 100% increased critical strike chance and
 * will be immune to Fear effects for the next 15 sec, but all damage taken is
 * increased by 20%."
 *
 * A 30 minute cooldown never comes up twice in a raid-length fight, so the
 * duration matters far more than the cooldown does.
 *
 * 100 PERCENTAGE POINTS, not a 100% relative increase. Crit chance is held in
 * points everywhere in this engine, and the reading that makes Recklessness the
 * ability it is known to be is "every attack crits". The combat table clamps
 * anything above the space left by miss and dodge, so the excess is not wasted
 * arithmetic -- it is what guarantees the clamp.
 *
 * The fear immunity is dropped: the engine has no fear. The damage taken
 * penalty is NOT dropped, because something attacks the player now.
 */
export const RECKLESSNESS_CRIT_BONUS = 100;
export const RECKLESSNESS_DAMAGE_TAKEN_MULTIPLIER = 1.2;
export const RECKLESSNESS_DURATION_MS = seconds(15);

export const RECKLESSNESS: AuraDefinition = {
  id: 'recklessness',
  name: 'Recklessness',
  durationMs: RECKLESSNESS_DURATION_MS,
  damageTakenMultiplier: RECKLESSNESS_DAMAGE_TAKEN_MULTIPLIER,
  statModifiers: [flat('critChance', RECKLESSNESS_CRIT_BONUS)],
};

/**
 * PLACEHOLDER. Berserker Rage has a 30 second cooldown and costs nothing. The
 * sheet states no effect and no duration.
 */
export const PLACEHOLDER_BERSERKER_RAGE_DURATION_MS = seconds(10);

export const BERSERKER_RAGE: AuraDefinition = {
  id: 'berserker_rage',
  name: 'Berserker Rage',
  durationMs: PLACEHOLDER_BERSERKER_RAGE_DURATION_MS,
  // No modifiers at all: nothing is stated, so nothing is claimed.
};

/**
 * PLACEHOLDER. Bloodrage has a 60 second cooldown and costs nothing. In every
 * ruleset it grants rage, which is exactly the sort of number that changes a
 * rotation's shape — and the sheet does not give it.
 */
/*
 * Spell 2687: "Generates 10 rage at the cost of health, and then generates an
 * additional 10 rage over 10 sec." Free, 1 minute cooldown, any stance, and it
 * costs 20% of base health.
 *
 * NO LONGER A PLACEHOLDER. It was inert not for want of a number -- Forever
 * states both halves -- but for want of a mechanism: the aura had no periodic,
 * so there was nowhere for "over 10 sec" to live.
 *
 * The ten over ten seconds is modelled as one rage a second rather than a lump
 * at the end, which is the reading that matters to a rotation: rage arriving
 * steadily can be spent as it lands.
 *
 * THE HEALTH COST IS NOT MODELLED, and that overstates the ability. The player
 * cannot drop below one health and survival is not simulated, so paying 20% of
 * base health costs nothing here. Real, and it is the same caveat that makes
 * Last Stand worth nothing.
 */
export const BLOODRAGE_INSTANT_RAGE = 10;
export const BLOODRAGE_RAGE_OVER_TIME = 10;
export const BLOODRAGE_DURATION_MS = seconds(10);
export const BLOODRAGE_TICK_INTERVAL_MS = seconds(1);

/** One rage a second for ten seconds. */
const BLOODRAGE_RAGE_PER_TICK =
  BLOODRAGE_RAGE_OVER_TIME / (BLOODRAGE_DURATION_MS / BLOODRAGE_TICK_INTERVAL_MS);

/* ---------------------------------------------------------------------------
   Anger Management
   --------------------------------------------------------------------------- */

/**
 * "Generates 1 Rage every 3 sec while in combat."
 *
 * The out-of-combat half of the tooltip -- "reduces Rage loss while out of
 * combat by 30%" -- is deliberately not modelled, on the ruleset owner's
 * instruction: this simulator has no out-of-combat state, so the character is
 * always in combat and there is no rage decay for it to reduce.
 */
export const ANGER_MANAGEMENT_RAGE_PER_TICK = 1;
export const ANGER_MANAGEMENT_INTERVAL_MS = seconds(3);

/**
 * The widest the first tick can be from the pull.
 *
 * A passive on its own timer did not start that timer when the pull did, so a
 * character entering combat is somewhere random inside the current three
 * seconds. Rolled per fight rather than fixed: every iteration in a batch
 * ticking at exactly 3000ms would give one extra rage to fights of one length
 * and not another, and tighten the distribution around a fiction.
 *
 * 1 to 3000 milliseconds inclusive, which is the ruleset owner's model of a
 * random combat start.
 */
export const ANGER_MANAGEMENT_MAX_START_OFFSET_MS = 3000;

export const ANGER_MANAGEMENT: AuraDefinition = {
  id: 'anger_management',
  name: 'Anger Management',
  // Permanent: it is a passive, not something applied and lost.
  durationMs: 0,
  periodic: {
    intervalMs: ANGER_MANAGEMENT_INTERVAL_MS,
    firstTickDelay: (context) =>
      context.rng.nextInt(1, ANGER_MANAGEMENT_MAX_START_OFFSET_MS),
    onTick: (context, aura) => {
      const actor = combatantIn(context, aura.targetId);
      if (!actor) return;
      context.grantResource(actor, 'rage', ANGER_MANAGEMENT_RAGE_PER_TICK, {
        id: 'anger_management',
        name: 'Anger Management',
      });
    },
  },
};

/**
 * Bloodrage's over-time half, scaled by Improved Bloodrage.
 *
 * A FUNCTION rather than a constant, because the talent multiplies "all the
 * Rage generated" and the over-time half is most of it. An aura definition is
 * a module-level object shared by every character in every iteration of a
 * batch, so the multiplier cannot be written into the shared one -- it has to
 * produce a definition per character, the way `enrageAura` does.
 *
 * The ID STAYS `bloodrage` whatever the multiplier, so telemetry, uptime and
 * the rage breakdown group a talented cast with an untalented one.
 */
export function bloodrageAura(rageMultiplier = 1): AuraDefinition {
  return {
    id: 'bloodrage',
    name: 'Bloodrage',
    durationMs: BLOODRAGE_DURATION_MS,
    periodic: {
      intervalMs: BLOODRAGE_TICK_INTERVAL_MS,
      onTick: (context, aura) => {
        const actor = combatantIn(context, aura.targetId);
        if (!actor) return;
        context.grantResource(actor, 'rage', BLOODRAGE_RAGE_PER_TICK * rageMultiplier, {
          id: 'bloodrage',
          name: 'Bloodrage',
        });
      },
    },
  };
}

/** The bonus key Improved Bloodrage sets, as a percentage. */
export const BLOODRAGE_RAGE_BONUS = 'ragePercent';

/** The untalented one, for anything that just needs the definition. */
export const BLOODRAGE: AuraDefinition = bloodrageAura();

// ---------------------------------------------------------------------------
// Defensive — PLACEHOLDER
// ---------------------------------------------------------------------------

/**
 * PLACEHOLDER. Shield Wall has a 30 minute cooldown and costs nothing; Shield
 * Block costs 10 rage on a 5 second cooldown. Neither has a stated effect or
 * duration.
 *
 * Both are damage-taken effects, and something does attack the player now, so
 * the only thing keeping them inert is the missing magnitudes.
 *
 * Shield Block needs more than a number. Its effect is a block chance bonus and
 * there is no `blockChance` modifier below to fill in -- `blockChance` became a
 * real stat with a real outcome behind it after this was written, so the aura
 * has to gain the modifier before any value can reach it.
 */
/*
 * Spell 871: "Reduces the damage taken from all attacks by 60% for 12 sec."
 *
 * CLASSIC SAYS 75% FOR 10 SECONDS; Forever is weaker and longer, and 60% taken
 * off is a multiplier of 0.40. Both figures here are Forever's, and the two
 * sources agree on them.
 *
 * THEY DISAGREED ABOUT THE COOLDOWN, and this comment was right: fifteen
 * minutes, confirmed by the ruleset owner against their own spreadsheet's
 * thirty. See `SHIELD_WALL_ABILITY` for how that was settled.
 */
/*
 * Thunder Clap's slow, spell 11581.
 *
 * ----------------------------------------------------------------------------
 * THE SOURCES DISAGREE ABOUT WHAT 20% MEANS, and this is the ruleset owner's
 * answer.
 *
 *   - the owner, asked directly    attack speed MINUS 20%, so a 2.00 second
 *                                  swing becomes 2.00 / 0.8 = 2.50
 *   - Forever's spell description  "increasing the TIME BETWEEN their attacks
 *                                  by 20%", which is 2.00 x 1.2 = 2.40
 *   - Forever's own effect row     "Mod Melee Attack Speed", value -19, which
 *                                  is 2.00 / 0.81 = 2.47
 *
 * Three readings, three answers, and the captured data does not even agree
 * with itself -- its description says the swing gets a fifth longer while its
 * effect row says the speed drops by nineteen percent. The owner's direct
 * answer settles it, by the rule that settled Shield Wall's cooldown, and the
 * other two are written down here rather than lost.
 *
 * WORTH RESOLVING. It is a quarter versus a fifth of the target's swings, and
 * the target is what kills the character.
 *
 * Carried as a NEGATIVE HASTE RATING because that is how the engine already
 * expresses attack speed -- `applyHaste` divides a swing timer by the haste
 * multiplier -- and converted with the same constant `hasteMultiplierFrom`
 * divides by, so the round trip is exact whatever that constant is set to.
 *
 * THE SAME AURA THE RAID APPLIES. `game/buffs/raidBuffs.ts` lists Thunder Clap
 * as something the raid may already have put on the target, and it reuses this
 * rather than declaring a second copy -- so a warrior keeping it up and a raid
 * that supplied it refresh one debuff instead of stacking two.
 * ----------------------------------------------------------------------------
 */
export const THUNDER_CLAP_ATTACK_SPEED_PERCENT = 20;
export const THUNDER_CLAP_SLOW_DURATION_MS = seconds(30);

export const THUNDER_CLAP_SLOW: AuraDefinition = {
  id: 'thunder_clap',
  name: 'Thunder Clap',
  durationMs: THUNDER_CLAP_SLOW_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  statModifiers: [
    flat('hasteRating', -THUNDER_CLAP_ATTACK_SPEED_PERCENT * RATING_PER_PERCENT.haste),
  ],
};

export const SHIELD_WALL_DAMAGE_TAKEN_MULTIPLIER = 0.4;
export const SHIELD_WALL_DURATION_MS = seconds(12);

export const SHIELD_WALL: AuraDefinition = {
  id: 'shield_wall',
  name: 'Shield Wall',
  durationMs: SHIELD_WALL_DURATION_MS,
  damageTakenMultiplier: SHIELD_WALL_DAMAGE_TAKEN_MULTIPLIER,
  // Spent to prevent a death, so it does not survive one. See the flag.
  removedOnDeath: true,
};

/*
 * Spell 2565: "Increases chance to block by 75% for 7 sec, but will only block
 * 2 attacks."
 *
 * ALL THREE NUMBERS ARE FOREVER'S OWN, from the captured spell data, and none
 * of them is what this file used to say. The duration was a PLACEHOLDER five
 * seconds, and the aura carried no block modifier at all -- the two-attack
 * limit could not be expressed, so rather than overstate the effect by
 * granting seventy-five percent for a full seven seconds it granted nothing,
 * and Shield Block was castable and inert.
 *
 * The charge limit exists now: `consumedByBlock` spends a stack per block and
 * `chargesOnApply` starts it full, so the aura ends on two blocks or seven
 * seconds, whichever comes first.
 */
export const SHIELD_BLOCK_BLOCK_CHANCE = 75;
export const SHIELD_BLOCK_DURATION_MS = seconds(7);
export const SHIELD_BLOCK_CHARGES = 2;

export const SHIELD_BLOCK: AuraDefinition = {
  id: 'shield_block',
  name: 'Shield Block',
  durationMs: SHIELD_BLOCK_DURATION_MS,
  maxStacks: SHIELD_BLOCK_CHARGES,
  chargesOnApply: SHIELD_BLOCK_CHARGES,
  consumedByBlock: true,
  statModifiers: [flat('blockChance', SHIELD_BLOCK_BLOCK_CHANCE)],
};

// ---------------------------------------------------------------------------
// Stances — PLACEHOLDER
// ---------------------------------------------------------------------------

/**
 * PLACEHOLDER EFFECTS.
 *
 * The sheet has rows for Berserker Stance and Defensive Stance, both costing
 * nothing on a 1 second cooldown, and NO ROW FOR BATTLE STANCE at all. It says
 * nothing about what any stance does, and nothing about which abilities each
 * one gates.
 *
 * Battle Stance is defined here anyway, because two stances with no third and
 * no way back to it is not a coherent ruleset. That it exists is an assumption.
 *
 * The gating — which abilities require which stance — is deliberately NOT
 * expressed yet, and is an open question with the ruleset owner.
 */
/*
 * Spell 71, Defensive Stance: "Decreases damage taken by 10% and damage caused
 * by 10%. Increases all threat generated by 30%." The threat clause is dropped;
 * the engine does not track threat.
 *
 * Spell 2458, Berserker Stance: "Critical strike chance increased by 3% and all
 * damage taken is increased by 10%."
 *
 * Spell 2457, Battle Stance: "A balanced combat stance." That is the entire
 * tooltip. It really does nothing, which this file previously ASSUMED and can
 * now state.
 */
export const DEFENSIVE_STANCE_DAMAGE_DONE = 0.9;
export const DEFENSIVE_STANCE_DAMAGE_TAKEN = 0.9;
export const BERSERKER_STANCE_DAMAGE_TAKEN = 1.1;
export const BERSERKER_STANCE_CRIT_BONUS = 3;

/** A stance lasts until another replaces it. */
const STANCE_DURATION_MS = 0;

export const BATTLE_STANCE: AuraDefinition = {
  id: 'battle_stance',
  name: 'Battle Stance',
  durationMs: STANCE_DURATION_MS,
};

export const DEFENSIVE_STANCE: AuraDefinition = {
  id: 'defensive_stance',
  name: 'Defensive Stance',
  durationMs: STANCE_DURATION_MS,
  damageDoneMultiplier: DEFENSIVE_STANCE_DAMAGE_DONE,
  damageTakenMultiplier: DEFENSIVE_STANCE_DAMAGE_TAKEN,
};

export const BERSERKER_STANCE: AuraDefinition = {
  id: 'berserker_stance',
  name: 'Berserker Stance',
  durationMs: STANCE_DURATION_MS,
  damageTakenMultiplier: BERSERKER_STANCE_DAMAGE_TAKEN,
  statModifiers: [flat('critChance', BERSERKER_STANCE_CRIT_BONUS)],
};

/**
 * Rage kept when changing stance, before Improved Tactical Mastery.
 *
 * Stated by the ruleset owner: a stance change drops everything above ten.
 * This is why stance dancing is a real cost and not a free action, and until
 * now the simulator charged nothing for it -- which the rotation exploited,
 * swapping whenever an ability in another stance looked slightly better.
 *
 * Improved Tactical Mastery adds to the floor rather than multiplying it:
 * "retain up to an additional 3/6/9/12/15 Rage", so rank 5 keeps 25.
 */
export const STANCE_RAGE_FLOOR = 10;

/** The bonus key Improved Tactical Mastery adds to that floor. */
export const STANCE_RAGE_RETAINED_BONUS = 'rageRetained';

/** Every stance, so that applying one can clear the others. */
/**
 * Auras a TALENT puts on a character, by the id its effect names.
 *
 * Kept as a lookup rather than imported directly by `createPlayer`, so the
 * talent tables stay data: a talent says `{ kind: 'grantAura', auraId }` and
 * never imports an aura.
 */
export const TALENT_AURAS: Readonly<Record<string, AuraDefinition>> = {
  anger_management: ANGER_MANAGEMENT,
};

export const WARRIOR_STANCES: readonly AuraDefinition[] = [
  BATTLE_STANCE,
  DEFENSIVE_STANCE,
  BERSERKER_STANCE,
];

// ---------------------------------------------------------------------------
// Reactive windows
// ---------------------------------------------------------------------------

/**
 * Marks that the target dodged, which is what Overpower keys off.
 *
 * CONFIRMED by the ruleset owner as Classic behaviour; the spreadsheet itself
 * states no trigger, only a 5 second cooldown.
 *
 * Modelled as an aura on the warrior rather than as a telemetry query because
 * an aura already has a duration, a refresh rule and a visible lifetime in the
 * combat log. The window length is NOT stated anywhere and is a placeholder.
 */
export const OVERPOWER_WINDOW_MS = seconds(6);

/**
 * The Overpower window: ONE charge, six seconds, consumed by a single use.
 *
 * Stated by the ruleset owner: a dodge grants one hidden charge against that
 * target, the cap is one, it expires after six seconds or when an Overpower
 * spends it, and another dodge inside the window refreshes the six seconds
 * without stacking. Bloodthrill's own tooltip corroborates the duration --
 * "activate your Overpower ability for 1 attack ... Lasts 6 sec".
 *
 * It was a PLACEHOLDER five seconds, assumed because nothing stated it.
 *
 * Every clause is a property of this aura rather than logic somewhere:
 * `maxStacks` defaults to one, `durationMs` expires it, `refreshBehaviour:
 * 'reset'` restarts the clock without a second stack, and Overpower's own
 * `onCast` removes it. Bloodthrill applies the same aura, so it inherits all
 * four -- which is what "works exactly the same besides the trigger" means.
 */
export const OVERPOWER_READY: AuraDefinition = {
  id: 'overpower_ready',
  name: 'Overpower Ready',
  durationMs: OVERPOWER_WINDOW_MS,
  maxStacks: 1,
  refreshBehaviour: 'reset',
};

/**
 * Marks that the warrior blocked, parried or dodged, which is what Revenge
 * keys off. Same provenance and the same placeholder window as above.
 *
 * Fires whenever `encounter.targetAttacks` is on, which is off by default.
 */
export const PLACEHOLDER_REVENGE_WINDOW_MS = seconds(5);

export const REVENGE_READY: AuraDefinition = {
  id: 'revenge_ready',
  name: 'Revenge Ready',
  durationMs: PLACEHOLDER_REVENGE_WINDOW_MS,
  refreshBehaviour: 'reset',
};

// ---------------------------------------------------------------------------
// Granted by talents. Absent from the ability spreadsheet; values from Forever.
// ---------------------------------------------------------------------------

/**
 * The combatant an aura is sitting on.
 *
 * `AuraInstance` carries a `targetId` rather than the combatant, so that an
 * aura cannot keep a dead reference alive. Everything that needs the actor
 * looks it up.
 */
function combatantIn(context: SimulationContext, id: string) {
  return context.combatants.find((actor) => actor.id === id);
}

/*
 * Spell 12328, Death Wish: "increases your Physical damage done by 20% and
 * makes you immune to Fear effects, but increases all damage you take by 5%.
 * Lasts 30 sec." 10 rage, 3 minute cooldown, usable in any stance.
 *
 * THE "PHYSICAL" QUALIFIER IS NOT EXPRESSED, and for a warrior it does not
 * matter: `damageDoneMultiplier` is school-agnostic and every point of warrior
 * damage in this simulator is physical. It would matter for a class with a
 * magic school, and the day an aura needs to scale one school and not another
 * is the day this needs a `damageDoneBySchool`.
 *
 * The fear immunity is dropped; the engine has no fear.
 */
export const DEATH_WISH_DAMAGE_DONE = 1.2;
export const DEATH_WISH_DAMAGE_TAKEN = 1.05;
export const DEATH_WISH_DURATION_MS = seconds(30);

export const DEATH_WISH: AuraDefinition = {
  id: 'death_wish',
  name: 'Death Wish',
  durationMs: DEATH_WISH_DURATION_MS,
  damageDoneMultiplier: DEATH_WISH_DAMAGE_DONE,
  damageTakenMultiplier: DEATH_WISH_DAMAGE_TAKEN,
};

/*
 * Spell 12975, Last Stand: "temporarily grants you 30% of your maximum health
 * for 20 sec. After the effect expires, the health is lost." Free, 3 minute
 * cooldown, ANY STANCE -- its captured entry has an empty `stances` list, so
 * unlike Shield Wall it is not a Defensive-only ability. Every figure here is
 * from that capture.
 *
 * ----------------------------------------------------------------------------
 * "THE HEALTH IS LOST" IS THE WHOLE ABILITY, and it used to be the one part
 * that was not modelled.
 *
 * Applying it raises the maximum by 30% and grants the same amount as current
 * health. Expiry used to take the MAXIMUM back and then merely clamp current
 * into it -- which meant a warrior who cast Last Stand while hurt kept every
 * point of the borrowed health for the rest of the fight. That is a 1,200
 * point heal on a three minute cooldown, and the tooltip says the opposite in
 * so many words.
 *
 * So expiry now removes the granted amount from CURRENT health as well. That
 * is what makes this a survival cooldown -- a window, not a heal -- and it is
 * the difference between casting it at 20% health and being saved, versus
 * casting it and being back at 20% twenty seconds later.
 *
 * IT CANNOT KILL. "The health is lost" says what goes, not what happens if
 * there is not enough of it, so this was implemented as a floor of one health
 * and flagged as an interpretation -- and the ruleset owner has since
 * confirmed it: Last Stand leaves you at 1 hit point rather than killing you.
 * So it can fail to save a character and can never be the thing that finishes
 * them.
 *
 * WHAT CHANGED AROUND IT. This used to end "the player cannot drop below one
 * health, so extra health changes no outcome; anything reading Last Stand's
 * worth from this simulator is reading the wrong simulator". That was true
 * when written. The character now dies, is counted, and casts this at 30%
 * health as the first entry of the Protection list.
 * ----------------------------------------------------------------------------
 */
export const LAST_STAND_HEALTH_FRACTION = 0.3;
export const LAST_STAND_DURATION_MS = seconds(20);

/** How much health Last Stand borrows for a pool of this size. */
export function lastStandGrant(maximumHealth: number): number {
  return Math.floor(maximumHealth * LAST_STAND_HEALTH_FRACTION);
}

export const LAST_STAND: AuraDefinition = {
  id: 'last_stand',
  name: 'Last Stand',
  durationMs: LAST_STAND_DURATION_MS,
  // Spent to prevent a death, so it does not survive one. See the flag.
  removedOnDeath: true,
  onApply: (context, aura) => {
    const health = combatantIn(context, aura.targetId)?.health;
    if (!health) return;
    const granted = lastStandGrant(health.maximum);
    health.setMaximum(health.maximum + granted);
    health.gain(granted);
  },
  onExpire: (context, aura) => {
    const health = combatantIn(context, aura.targetId)?.health;
    if (!health) return;

    /*
     * Recovered from the inflated maximum rather than remembered, and it is
     * exact: with a maximum of b + floor(0.3b), this expression is always
     * floor(0.3b) again. It would stop being exact if anything else resized
     * the pool while Last Stand was up, and nothing does -- a buff that moved
     * stamina would not currently resize health either.
     */
    const granted = Math.floor(
      (health.maximum / (1 + LAST_STAND_HEALTH_FRACTION)) * LAST_STAND_HEALTH_FRACTION,
    );
    health.setMaximum(health.maximum - granted);

    // "The health is lost." Both halves go: the pool shrinks AND the borrowed
    // current health is taken back, floored at one so the expiry cannot be
    // the killing blow. See the interpretation note above.
    health.set(Math.max(1, Math.min(health.current - granted, health.maximum)));
  },
};

/*
 * Spell 12292, Sweeping Strikes: "Your next 5 melee attacks strike an
 * additional nearby opponent." 30 rage, 30 second cooldown, Battle Stance.
 *
 * DOES NOTHING AGAINST ONE TARGET, and that is the whole ability. Its entire
 * effect is the additional opponent, and an encounter here has exactly one
 * enemy -- so this is 30 rage and a global cooldown for no damage whatever.
 *
 * It is defined rather than omitted so that the talent grants something real
 * and so the charge count is written down. It is deliberately absent from every
 * rotation, for the same reason the inert buffs were. See
 * `engine/combat/targeting.ts`.
 */
export const SWEEPING_STRIKES_CHARGES = 5;
export const SWEEPING_STRIKES_DURATION_MS = seconds(30);

export const SWEEPING_STRIKES: AuraDefinition = {
  id: 'sweeping_strikes',
  name: 'Sweeping Strikes',
  durationMs: SWEEPING_STRIKES_DURATION_MS,
  maxStacks: SWEEPING_STRIKES_CHARGES,
};

/*
 * Spell 12317, Enrage: "a 30% chance to deal X% increased Physical damage for
 * 12 sec after being the victim of any damaging attack." 2/4/6/8/10 by rank.
 *
 * The MAGNITUDE is per rank and lives in the values file, so the aura is built
 * per rank rather than being a constant here. The 30% trigger chance and the 12
 * second duration do not vary and do.
 */
export const ENRAGE_TRIGGER_CHANCE = 30;
export const ENRAGE_DURATION_MS = seconds(12);

export function enrageAura(damageBonusPercent: number): AuraDefinition {
  return {
    id: 'enrage',
    name: 'Enrage',
    durationMs: ENRAGE_DURATION_MS,
    damageDoneMultiplier: 1 + damageBonusPercent / 100,
    refreshBehaviour: 'reset',
  };
}

/** Unused today; kept so the import surface matches the other modules. */
export const WARRIOR_AURAS: readonly AuraDefinition[] = [
  REND,
  SUNDER_ARMOR,
  BATTLE_SHOUT,
  DEMORALIZING_SHOUT,
  RECKLESSNESS,
  BERSERKER_RAGE,
  BLOODRAGE,
  SHIELD_WALL,
  SHIELD_BLOCK,
  BATTLE_STANCE,
  DEFENSIVE_STANCE,
  BERSERKER_STANCE,
  OVERPOWER_READY,
  REVENGE_READY,
  DEATH_WISH,
  LAST_STAND,
  SWEEPING_STRIKES,
];
