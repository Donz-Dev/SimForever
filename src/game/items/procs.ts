import type {
  AttackEvent,
  AuraDefinition,
  CastReaction,
  Combatant,
  MeleeWeaponSlot,
  Reaction,
  WeaponSlot,
} from '../../engine';
import {
  applyHealing,
  dealDamage,
  flat,
  isWeaponUse,
  isWeaponUseOf,
  seconds,
} from '../../engine';
import { ITEMS_BY_ID, ITEM_PROCS } from './itemData';
import { REVELATION_ENCHANT_ID } from './foreverEnchants';

/**
 * Procs per minute.
 *
 * THE RULESET OWNER'S EQUATION, in their own notation:
 *
 *     % chance to proc = PPM * baseweaponspeed / 60
 *
 * A 2.6 second weapon at 1 PPM is a 4.33% chance per attack; a 2.5 second
 * weapon at 1.1 PPM is 4.58%. The point of the system is that a slow weapon and
 * a fast weapon proc the same number of times per minute, so an effect is not
 * quietly worth more on a dagger.
 *
 * ----------------------------------------------------------------------------
 * `PPM` IS AN EQUATION VARIABLE AND NOT A CEILING, confirmed by the owner on
 * 2026-10-07 when exactly that was asked. The distinction has teeth, because the
 * two readings diverge the moment anything other than an auto-attack rolls:
 *
 *   AS A VARIABLE   every weapon USE rolls `PPM * speed / 60`. An Enhancement
 *                   shaman makes about 35 melee uses a minute -- swings,
 *                   Stormstrike, and two Windfury attacks per proc -- so 5 PPM
 *                   delivers about 11 procs a minute. Only auto-attacks cost
 *                   swing time, so specials and extra attacks are free rolls.
 *   AS A CEILING    the rate would have to be throttled to 5 a minute however
 *                   many uses there were, which is a different mechanic and not
 *                   what the formula describes.
 *
 * It is the FIRST, so 11 procs a minute at 5 PPM is the intended consequence of
 * the equation rather than a number to be explained away. Recorded because the
 * figure invites the question a second time: `tools/maelstrom_probe.ts` exists
 * to answer it with the per-source rates, and `procs.test.ts` pins the equation
 * in the owner's own form.
 *
 * BASE SPEED, NOT THE SWING TIMER. `baseweaponspeed` is the item's own number,
 * so a hasted character swings more often at the same per-use chance and
 * therefore procs MORE per minute. That is the same reading `rageFromSwing`
 * takes of "base speed before any modifiers", and it is why `speed` here comes
 * from `weapon.swingTimerMs` rather than from anything haste has touched.
 * ----------------------------------------------------------------------------
 *
 * The item tooltips give none of this -- they say "Chance on hit" and "often" --
 * which is why these sat unmodelled until the owner supplied both the equation
 * and the rate for each effect below.
 */
export function ppmChance(weaponSpeedSeconds: number, ppm: number): number {
  return (weaponSpeedSeconds / 60) * ppm;
}

/**
 * The speed of the weapon that landed an attack.
 *
 * A proc belongs to the weapon it is ON, so the chance has to come from that
 * weapon's speed rather than from whichever hand happens to be faster. Returns
 * undefined when the attack came from no weapon at all, in which case a
 * weapon proc cannot fire.
 *
 * `swingTimerMs` IS THE BASE SPEED. Haste is applied when a swing is scheduled
 * and never written back onto the weapon, so reading it here gives the item's
 * own number -- which is what PPM wants, because a hasted character should proc
 * more often per minute rather than the same amount.
 *
 * EXPORTED BECAUSE IT WAS ALREADY WRITTEN TWICE. `reactions/paladin.ts` carries
 * its own `baseSpeedSeconds` for Seal of Command, and Maelstrom Weapon would
 * have been the third copy. CLAUDE.md's rule about `isWeaponUse` is the same
 * lesson: a one-liner that several files re-derive is a one-liner two of them
 * get wrong.
 */
export function triggeringSpeedSeconds(
  actor: Combatant,
  slot: WeaponSlot | undefined,
): number | undefined {
  if (!slot) return undefined;
  const weapon = actor.weapons[slot];
  if (!weapon) return undefined;
  return weapon.swingTimerMs / 1000;
}

/** Whether the attack that just landed could carry a weapon proc at all. */
function canProc(attack: AttackEvent): boolean {
  // An attack that never landed cannot proc, and a bleed tick is not an attack.
  return !attack.outcome || (attack.outcome !== 'miss' && attack.outcome !== 'dodge' && attack.outcome !== 'parry');
}

/**
 * Build a reaction that fires on a PPM roll from the weapon in one slot.
 *
 * `slot` is which weapon carries the effect. Only attacks made WITH that weapon
 * can trigger it, which is what makes an off-hand enchant an off-hand enchant.
 */
function weaponProc(options: {
  readonly id: string;
  /*
   * MELEE ONLY, AND THE TABLE BELOW NEVER OFFERED ANYTHING ELSE: the equipment
   * slots it walks are mainHand, twoHand and offHand. The type says so now
   * because `isWeaponUseOf` can only honestly answer for a melee slot -- see
   * `MeleeWeaponSlot`. A bow enchant would never have procced.
   */
  readonly slot: MeleeWeaponSlot;
  readonly ppm: number;
  readonly onProc: (context: Parameters<Reaction['onTrigger']>[0], actor: Combatant, attack: AttackEvent) => void;
}): Reaction {
  return {
    id: options.id,
    on: 'dealt',
    // Every landed outcome, including glancing and critical blows.
    outcomes: ['hit', 'crit', 'glance', 'crush'],
    canTrigger: (context, actor, attack) => {
      if (!canProc(attack)) return false;
      // A use of THIS weapon: a swing with it, or an ability that needed it.
      if (!isWeaponUseOf(attack, options.slot)) return false;

      const speed = triggeringSpeedSeconds(actor, attack.weaponSlot);
      if (speed === undefined) return false;

      return context.rng.nextFloat(0, 1) < ppmChance(speed, options.ppm);
    },
    onTrigger: (context, actor, attack) => options.onProc(context, actor, attack),
  };
}

// ---------------------------------------------------------------------------
// Vis'kag the Bloodletter
// ---------------------------------------------------------------------------

/** Vis'kag's stated rate. */
export const VISKAG_PPM = 1;

/** "Delivers a fatal wound for 240 damage." */
export const VISKAG_DAMAGE = 240;

/**
 * Fatal Wound.
 *
 * Damage in its own right rather than added to the swing, so it shows as its
 * own line in the breakdown and can be seen to be worth what it is worth.
 *
 * It takes no attack table: the swing that triggered it already landed, and
 * rolling a second time would let a proc from a hit come out as a miss.
 */
function fatalWound(context: Parameters<Reaction['onTrigger']>[0], actor: Combatant, attack: AttackEvent) {
  dealDamage(context, {
    source: actor,
    target: attack.defender,
    abilityId: 'fatal_wound',
    abilityName: 'Fatal Wound',
    school: 'physical',
    baseAmount: VISKAG_DAMAGE,
    // Flat damage, and it is not a weapon swing, so no armor reduction applies
    // to it any differently than to any other physical hit.
  });
}

// ---------------------------------------------------------------------------
// Enchant Weapon - Crusader
// ---------------------------------------------------------------------------

/** Crusader's stated rate. */
export const CRUSADER_PPM = 1.1;

/** "increases Strength by 100 for 15 sec" */
export const CRUSADER_STRENGTH = 100;
export const CRUSADER_DURATION_MS = seconds(15);

/**
 * "Heals for 75 to 125 on proc."
 *
 * Both figures are the enchant's own tooltip. Nothing here is invented.
 *
 * THIS WAS LISTED AS UNMODELLED UNTIL THE ENCOUNTER GREW A HEALER. Its reason
 * read "Nothing damages the player, so a heal would restore nothing", which
 * was true on the day it was written and stopped being true the moment the
 * target started killing people. A reason is a claim about the engine at a
 * point in time, and this one expired.
 */
export const CRUSADER_HEAL_MINIMUM = 75;
export const CRUSADER_HEAL_MAXIMUM = 125;

/**
 * Holy Strength, ONE AURA PER HAND.
 *
 * ----------------------------------------------------------------------------
 * THE TWO HANDS STACK. This is a Forever rule given by the ruleset owner, and
 * it is not what this file assumed.
 *
 * Both hands used to share a single `holy_strength`, so the second to proc
 * refreshed the first and a dual-wielder enchanted on both weapons got one
 * hundred strength however often either hand fired. Forever gives each hand
 * its own effect, so both up at once is TWO HUNDRED strength.
 *
 * That is a real damage change and not a reporting one -- and it also answers
 * the uptime question, because there are now genuinely two buffs to chart
 * rather than one shared window that could not be attributed to a hand.
 *
 * Each still refreshes ITSELF rather than stacking: a second main-hand proc
 * while the main hand's buff is up resets its fifteen seconds, which is what
 * "capable of triggering again to refresh its duration" means. The stacking is
 * between hands, not within one.
 *
 * The heal IS modelled, and lands on the same proc. It is small next to a
 * hundred strength and it is not why anyone uses this, but it is real and a
 * character being hit has somewhere to put it.
 * ----------------------------------------------------------------------------
 */
function holyStrengthFor(slot: WeaponSlot): AuraDefinition {
  return {
    id: `holy_strength_${slot}`,
    name: slot === 'offHand' ? 'Holy Strength (Off Hand)' : 'Holy Strength (Main Hand)',
    durationMs: CRUSADER_DURATION_MS,
    refreshBehaviour: 'reset',
    statModifiers: [flat('strength', CRUSADER_STRENGTH)],
  };
}

export const HOLY_STRENGTH_MAIN_HAND = holyStrengthFor('mainHand');
export const HOLY_STRENGTH_OFF_HAND = holyStrengthFor('offHand');

/** Both, so a caller can look one up by the hand that procced it. */
export const HOLY_STRENGTH_BY_SLOT: Partial<Record<WeaponSlot, AuraDefinition>> = {
  mainHand: HOLY_STRENGTH_MAIN_HAND,
  offHand: HOLY_STRENGTH_OFF_HAND,
};

/**
 * Crusader can be on both hands at once, each rolling off its own weapon's
 * speed and each granting its own hundred strength.
 *
 * The aura is chosen by the hand that PROCCED, which is the attack's slot --
 * not by the reaction's configured slot, though `canTrigger` has already made
 * those the same. Reading it off the attack keeps the two from ever drifting.
 */
function crusaderProc(
  context: Parameters<Reaction['onTrigger']>[0],
  actor: Combatant,
  attack: AttackEvent,
) {
  const aura = attack.weaponSlot ? HOLY_STRENGTH_BY_SLOT[attack.weaponSlot] : undefined;
  if (!aura) return;
  context.applyAura(actor, aura, actor.id);

  /*
   * The heal, on the same proc. Rolled AFTER the aura so that adding it moved
   * nothing that came before it in the random stream -- though it does shift
   * everything after, so a seeded run with Crusader equipped is a different
   * fight from the one the same seed produced before this existed.
   *
   * `external` is not set: this heal genuinely comes from the character's own
   * enchant, so if anything ever raises their healing done it should raise
   * this too. That is the difference between it and the assumed healer.
   */
  applyHealing(context, {
    source: actor,
    target: actor,
    abilityId: 'crusader',
    abilityName: 'Holy Strength',
    baseAmount: context.rng.nextInt(CRUSADER_HEAL_MINIMUM, CRUSADER_HEAL_MAXIMUM),
    canCrit: false,
  });
}

// ---------------------------------------------------------------------------
// Hand of Justice
// ---------------------------------------------------------------------------

/** "2% chance for any attack to trigger an extra attack." */
export const HAND_OF_JUSTICE_CHANCE = 0.02;

/**
 * The internal cooldown that stops an extra attack from proccing another.
 *
 * Without it the effect chains off itself: the extra swing is an attack, so it
 * rolls again, and a run of them is possible. 1.5 seconds is the stated window.
 *
 * THE SEASON OF DISCOVERY TOOLTIP SAYS TWO SECONDS -- item 228722 spells out
 * "(Proc chance: 2%, 2s cooldown)" where the Classic one states nothing at all.
 * The 1.5 here is the ruleset owner's own figure and stays, because this is a
 * Forever simulator and an SoD item is a stand-in; the disagreement is recorded
 * rather than averaged. Both agree on the 2%.
 */
export const HAND_OF_JUSTICE_ICD_MS = 1500;

/**
 * The trinket's ids. TWO of them, which is the whole reason this is a list.
 *
 * 11815 is the Classic Hand of Justice and 228722 the Season of Discovery one,
 * and the sixtyupgrades sets the owner supplied all name the second. Keying the
 * proc on one id meant five profiles could equip a trinket whose "2% chance on
 * melee hit to gain 1 extra attack" is reported as MODELLED -- it matches
 * `MODELLED_AS_PROCS`, so it is not even listed as missing -- while firing
 * never. A proc that never fires leaves nothing behind to notice.
 */
export const HAND_OF_JUSTICE_IDS: readonly number[] = [11815, 228722];

/**
 * Hand of Justice.
 *
 * NOT a PPM effect -- a flat 2% on any USE of a melee weapon, ability or
 * swing, from EITHER hand. The internal cooldown is what keeps it bounded
 * rather than the roll.
 *
 * A GLOBAL extra-attack source, in the ruleset owner's words, as against a
 * weapon-bound one: it does not care which hand, only that a melee weapon was
 * used. That is the whole difference between it and Crusader, and between it
 * and Windfury.
 *
 * IT USED TO ACCEPT ANY LANDED ATTACK, which included Thunder Clap, Intercept
 * and Charge -- three abilities that need no melee weapon and resolve on the
 * ranged table. `isWeaponUse` is what excludes them.
 */
export function handOfJusticeReaction(): Reaction {
  // The last time it fired, per combatant. Held in the closure rather than on
  // the combatant, because the reaction is built per character in
  // `reactionsForEquipment` and never shared between them.
  let lastProcAt: number | null = null;

  return {
    id: 'hand_of_justice',
    on: 'dealt',
    outcomes: ['hit', 'crit', 'glance', 'crush'],
    canTrigger: (context, _actor, attack) => {
      if (!canProc(attack)) return false;
      if (!isWeaponUse(attack)) return false;

      const now = context.clock.now();
      if (lastProcAt !== null && now - lastProcAt < HAND_OF_JUSTICE_ICD_MS) return false;

      return context.rng.nextFloat(0, 1) < HAND_OF_JUSTICE_CHANCE;
    },
    onTrigger: (context, actor) => {
      lastProcAt = context.clock.now();
      context.extraAttack(actor, 'mainHand');
    },
  };
}

// ---------------------------------------------------------------------------

/**
 * Every proc the equipped set brings, as reactions.
 *
 * Built per character rather than shared, because Hand of Justice keeps its own
 * cooldown and two warriors must not share one.
 */
export function reactionsForEquipment(
  equipment: Readonly<Record<string, { itemId: number; enchantId?: number } | undefined>>,
): readonly Reaction[] {
  const reactions: Reaction[] = [];

  const weaponSlots: readonly (readonly [string, MeleeWeaponSlot])[] = [
    ['mainHand', 'mainHand'],
    ['twoHand', 'mainHand'],
    ['offHand', 'offHand'],
  ];

  for (const [equipmentSlot, weaponSlot] of weaponSlots) {
    const equipped = equipment[equipmentSlot];
    if (!equipped) continue;

    const item = ITEMS_BY_ID.get(equipped.itemId);
    /*
     * BY THE TOOLTIP'S WORDING, NOT BY AN ITEM ID. This read `item?.id ===
     * 17075` -- Vis'kag the Bloodletter, which is in Forever's `missing.json`
     * and in no capture, so the branch was unreachable. `ITEM_PROCS` is the one
     * place that says which procs are implemented, and `itemData` reads the
     * same table to decide that such a line is NOT a gap.
     */
    if (item !== undefined && ITEM_PROCS.fatalWound.test(item.tooltip)) {
      reactions.push(
        weaponProc({
          id: `viskag_${weaponSlot}`,
          slot: weaponSlot,
          ppm: VISKAG_PPM,
          onProc: fatalWound,
        }),
      );
    }

    if (equipped.enchantId === 20034) {
      reactions.push(
        weaponProc({
          id: `crusader_${weaponSlot}`,
          slot: weaponSlot,
          ppm: CRUSADER_PPM,
          onProc: crusaderProc,
        }),
      );
    }

    /*
     * REVELATION, ONCE PER ENCHANTED HAND, ON THE OWNER'S RULING.
     *
     * ------------------------------------------------------------------------
     * IT SITS IN THE PER-HAND LOOP AND IS STILL NOT A WEAPON PROC, which is
     * the thing to hold onto. Everything else here is triggered by a USE of
     * that weapon and rolls against that weapon's own speed; Revelation is
     * triggered by a SPELL, which belongs to no hand and has no speed -- so it
     * takes a flat chance and asks `isWeaponUseOf` nothing.
     *
     * SO THE SLOT BUYS ONE THING ONLY: a second opportunity. Two enchanted
     * hands roll twice against the same chance, which is "roll once per hand"
     * read exactly -- the per-spell probability becomes `1 - (1 - p)^2`.
     *
     * AND THE REACTION IDS DIFFER BY SLOT, because `runReactions` would
     * otherwise be holding two reactions with one id and nothing says which
     * fired.
     * ------------------------------------------------------------------------
     */
    if (equipped.enchantId === REVELATION_ENCHANT_ID) {
      reactions.push(revelationReaction(weaponSlot));
    }
  }

  for (const slot of ['trinket1', 'trinket2'] as const) {
    const itemId = equipment[slot]?.itemId;
    if (itemId === undefined) continue;
    const item = ITEMS_BY_ID.get(itemId);
    /*
     * THE WORDING, OR THE TWO KNOWN IDS. Hand of Justice is in Forever's
     * `missing.json` like Vis'kag, so the id list alone is dead -- and unlike
     * Vis'kag this one has to keep working for a trinket that states the proc
     * in its tooltip without the exact sentence, which is why both routes are
     * tried. The ids are the Classic and Season of Discovery ones and are kept
     * because a SAVED PROFILE can still name them.
     */
    if (
      HAND_OF_JUSTICE_IDS.includes(itemId) ||
      (item !== undefined && ITEM_PROCS.extraAttack.test(item.tooltip))
    ) {
      reactions.push(handOfJusticeReaction());
    }
  }

  return reactions;
}

// ---------------------------------------------------------------------------
// Enchant Weapon - Revelation
// ---------------------------------------------------------------------------

/**
 * "Permanently enchant a Melee Weapon to have a chance to trigger Revelation
 * when a non-periodic spell fails to critically strike. Revelation grants 100%
 * increased critical strike chance to the next spell cast. Revelation's chance
 * to trigger is diminished as your critical strike chance increases."
 *
 * ============================================================================
 * NOT A PPM EFFECT, AND NOT A WEAPON USE, WHICH IS THE WHOLE SHAPE OF IT.
 *
 * Every other weapon proc here triggers off a USE of the weapon it is on --
 * `isWeaponUseOf`, rolled against that weapon's own base speed. Revelation
 * sits on a melee weapon and triggers off a SPELL, which belongs to no hand.
 * So it takes a flat chance rather than `ppmChance`, and it asks the attack
 * which TABLE resolved it rather than which slot swung.
 *
 * ONE ROLL PER SPELL, EVEN WITH BOTH HANDS ENCHANTED, AND THAT IS A CHOICE.
 * ----------------------------------------------------------------------------
 * Crusader is per-hand because only a use of THAT weapon can trigger it, so
 * two hands genuinely present two independent opportunities. Revelation's
 * trigger is a spell cast: there is nothing about it that belongs to one
 * weapon rather than the other, and nothing to attribute a second roll to.
 *
 * THE GENEROUS READING IS TWO ROLLS AND IT IS NOT TAKEN. "A bigger number and
 * no error" is the failure mode this project keeps meeting, and the Gear
 * panel's "a dual-wielder applies the weapon EFFECT twice" ruling is about a
 * CONSUMABLE coated on each weapon rather than about a proc with a shared
 * trigger. FLAGGED FOR THE OWNER rather than decided quietly: if two enchanted
 * hands should roll twice, `reactionsForEquipment` is a one-line change.
 * ----------------------------------------------------------------------------
 *
 * "FAILS TO CRITICALLY STRIKE" IS A LANDED NON-CRIT. A miss is not a failure
 * to crit, it is a failure to connect -- and `canProc` already refuses one for
 * every other effect in this file, so reading it the other way would make this
 * the only proc in the project that fires off a miss.
 *
 * "NON-PERIODIC" NEEDS NO CHECK. A `dealt` reaction never sees a tick:
 * `dealDamage` dispatches `dealt` only for damage that consulted a table and
 * is not periodic. The clause is in the tooltip because it is true, not
 * because something here has to enforce it.
 * ============================================================================
 */
export const REVELATION_BASE_CHANCE = 0.11;

/**
 * The owner's own expression, kept as one:
 *
 *     11% * ((1 - CharacterSpellCritChance) - CharacterSpellCritChance)
 *
 * WRITTEN OUT RATHER THAN SIMPLIFIED TO `1 - 2c`, which is the same arithmetic
 * and not the same statement. The owner's form says what it is -- the chance
 * you did not crit, less the chance you did -- where the simplified one reads
 * as a tuning constant somebody picked.
 *
 * IT GOES TO ZERO AT 50% AND IS CLAMPED THERE, which the owner states in as
 * many words: "it no longer procs if your CharacterSpellCritChance is >= 50%".
 * Without the clamp the expression goes NEGATIVE, and `rng.nextFloat(0, 1) <
 * negative` is false anyway -- so the clamp changes no outcome and is here so
 * that anyone READING the rate sees zero rather than -0.03.
 *
 * ----------------------------------------------------------------------------
 * IT TAKES THE EFFECTIVE PER-SPELL CRIT, ON THE OWNER'S RULING, AND IT USED TO
 * TAKE THE CHARACTER SHEET'S FIGURE.
 *
 * Asked which "CharacterSpellCritChance" meant, they said effective -- and
 * added that a sheet reading 10.82% was "likely missing proper calculation".
 * **IT WAS.** `CharacterSheetPanel` printed `stats.spellCritChance` raw and
 * ignored `critRating` entirely, on all 28 profiles and in BOTH crit rows: the
 * Fire Mage's sheet said 3.00% melee crit where the engine rolls 14.00%.
 *
 * SO THE WRONG READING HERE CAME FROM A WRONG NUMBER ON SCREEN, which is this
 * project's own "a mislabelled number becomes a documented fact in one
 * reading" -- arrived at from the other end. The figure was read off the sheet,
 * used to build the proc, and written into a PR as the thing to check.
 *
 * A FRACTION AND NOT PERCENTAGE POINTS, which is the one place this could be
 * out by a hundred. `AttackEvent.critChance` is already a fraction because the
 * roll units it comes from are, so the conversion that used to live here is
 * gone rather than moved.
 * ----------------------------------------------------------------------------
 */
export function revelationChance(spellCrit: number): number {
  return Math.max(0, REVELATION_BASE_CHANCE * (1 - spellCrit - spellCrit));
}

/** "grants 100% increased critical strike chance to the next spell cast" */
export const REVELATION_CRIT_BONUS = 100;

/**
 * A minute, as a backstop only.
 *
 * FOREVER STATES NO DURATION -- "the next spell cast" is a charge and not a
 * clock -- so this is not a `PLACEHOLDER_`: no figure is being invented for it
 * to stand in for. It exists because an aura with no duration never expires
 * and would sit on the character for the whole fight if the spender ever
 * failed to fire. The Priest's Inner Focus carries the same backstop for the
 * same reason, and the one time ITS spender failed to register, the buff was
 * permanent for sixty seconds of every fight.
 */
export const REVELATION_DURATION_MS = seconds(60);

/**
 * Revelation.
 *
 * ----------------------------------------------------------------------------
 * A STAT, NOT A PER-ABILITY MODIFIER, AND THE STAT IS WHAT SCOPES IT TO SPELLS.
 *
 * "the next SPELL cast" is a set no `abilityModifiers` entry can name: the
 * catch-all reaches melee abilities too, and this enchant goes on a melee
 * weapon, so a Shockadin's Holy Strike would have collected a guaranteed crit
 * meant for its Holy Shock. Listing spells by id is the unmaintainable option
 * `SchoolModifiers` exists to avoid.
 *
 * `spellCritChance` IS ALREADY EXACTLY THAT SCOPE. It is the engine's one
 * spell-table crit stat -- the spell table's crit slice IS the caster's
 * `spellCritChance` -- and the melee and ranged tables read `critChance`
 * instead. So a hundred points of it is a guaranteed crit on a spell and worth
 * nothing to a swing, with no new engine field at all.
 *
 * 100 POINTS, ON THE OWNER'S RULING, which is the reading of "100% increased
 * critical strike chance" that makes the proc condition make sense: it fires
 * only when a spell FAILED to crit, and its rate shrinks as crit rises, which
 * is the shape of a catch-up mechanic rather than of a multiplier.
 * ----------------------------------------------------------------------------
 */
export const REVELATION: AuraDefinition = {
  id: 'revelation',
  name: 'Revelation',
  durationMs: REVELATION_DURATION_MS,
  refreshBehaviour: 'reset',
  statModifiers: [flat('spellCritChance', REVELATION_CRIT_BONUS)],
};

/**
 * What triggers it: a spell that landed and did not crit.
 *
 * THE CHANCE READS WHAT *THIS SPELL* ROLLED AGAINST, which is the owner's
 * ruling and is stronger than reading the character. `AttackEvent.critChance`
 * is the slice the roll actually faced -- the rating, the per-ability crit, the
 * per-school crit, the per-table crit and the target's contribution, all folded
 * -- so the rate diminishes with everything that genuinely makes the character
 * crit more, including a trinket that procs mid-fight and a talent that names
 * one spell.
 *
 * SO TWO SPELLS ON ONE CHARACTER CAN HAVE DIFFERENT RATES, and that is the
 * consequence worth stating: a Fire Mage's Scorch carries Improved Scorch's
 * crit and its Fireball does not, so Revelation is rarer off the Scorch. That
 * follows from the tooltip rather than being a special case.
 *
 * NO FEEDBACK LOOP TO GUARD. While Revelation is up the next spell crits, so
 * the outcome filter refuses it; and if something ever did reach this with the
 * aura up, the hundred points take the chance below zero and
 * `revelationChance` clamps it to nothing.
 *
 * ONE REACTION PER ENCHANTED HAND, on the owner's ruling -- "Revelation should
 * roll once per hand". `slot` is carried so the two rolls are genuinely two
 * opportunities rather than one counted twice, and it is NOT checked against
 * the attack: a spell is a use of no weapon, so asking `isWeaponUseOf` would
 * make every roll false. See `reactionsForEquipment`.
 */
export function revelationReaction(slot: MeleeWeaponSlot): Reaction {
  /*
   * ==========================================================================
   * ONCE PER CAST, NOT ONCE PER TARGET HIT (round 80), the owner's ruling. A
   * `dealt` reaction fires per DAMAGE EVENT, so an area spell striking eight
   * targets rolled eight times -- which is where most of the enchant's value on
   * the area builds came from.
   *
   * THE CAST IS KEYED BY `castSequence - channelTicksDelivered`, Arcane
   * Concentration's key: `runCast` stamps a new sequence on every channel tick
   * and the delivered count rises with it, so the difference names the whole
   * cast. The ability id is part of the key so a hit dealt outside any cast of
   * its own cannot share the last cast's roll. The FIRST non-crit hit of the
   * cast takes the roll; a cast whose first hits all crit keeps its roll for
   * the first that does not, which is "a non-periodic spell fails to crit"
   * read once per cast. Per HAND still, so each hand's closure keeps its own.
   * ==========================================================================
   */
  let rolledFor: string | undefined;
  return {
    id: `revelation_${slot}`,
    on: 'dealt',
    // Landed, and not a crit. `glance` and `crush` cannot occur on the spell
    // table and are left out rather than filtered later.
    outcomes: ['hit'],
    canTrigger: (context, actor, attack) => {
      if (attack.attackTable !== 'spell') return false;
      const cast = `${actor.castSequence - actor.channelTicksDelivered}:${attack.abilityId ?? ''}`;
      if (rolledFor === cast) return false;
      rolledFor = cast;
      const chance = revelationChance(attack.critChance ?? 0);
      if (chance <= 0) return false;
      return context.rng.nextFloat(0, 1) < chance;
    },
    onTrigger: (context, actor) => {
      context.applyAura(actor, REVELATION, actor.id);
    },
  };
}

/**
 * Whether an ability resolves on the spell table, read off the ability itself.
 *
 * NOT A LIST OF IDS, for the reason the aura is a stat rather than a modifier
 * map: the set is "every spell this character owns" and a list is the thing
 * that goes stale. A pure damage-over-time cast declares no table and is not a
 * spell for this purpose, which is the same line "non-periodic" draws on the
 * trigger side.
 */
function isSpellCast(actor: Combatant, abilityId: string): boolean {
  return actor.abilities.get(abilityId)?.attackTable === 'spell';
}

/**
 * What spends it: the next spell cast, AFTER it has happened.
 *
 * ----------------------------------------------------------------------------
 * THE SHAPE INNER FOCUS AND FINGERS OF FROST ALREADY USE, and for the same
 * reason: `consumedByCast` is spent at cast START, which is right for a cost
 * and useless for a crit -- a Shadow Bolt lands three seconds later, by which
 * time the aura carrying the hundred points would be gone. `runCast` runs
 * `onCast` BEFORE the cast reactions, so the spell has already rolled its crit
 * inside the window by the time this fires.
 *
 * `appliedAt < now` IS NOT ENOUGH HERE, AND THAT IS THE DIFFERENCE FROM INNER
 * FOCUS. Inner Focus is APPLIED BY A CAST, so its guard only has to exclude
 * that one cast. Revelation is applied by a DAMAGE event, which for an instant
 * spell lands in the same millisecond as the cast that produced it -- so a
 * timestamp guard alone would let the spell that triggered the proc spend it.
 * `castSequence` is the discriminator the engine already stamps for exactly
 * this, the way Seal Fate's per-use cap reads it.
 *
 * AND ONLY A SPELL SPENDS IT. "the next spell cast" -- a Shockadin pressing
 * Holy Strike between two Holy Shocks must not throw the charge away, which is
 * the invisible failure: the proc still fires, the aura still reports its
 * uptime, and the saving lands somewhere it was never meant to.
 *
 * THE CLOSURE IS PER CHARACTER, which `reactionsForEquipment` guarantees by
 * building one per equipment set -- the same reason Hand of Justice's internal
 * cooldown can live in one and a module-level variable could not.
 * ----------------------------------------------------------------------------
 */
export function revelationSpender(): CastReaction {
  let procCastSequence: number | null = null;

  return {
    id: 'revelation_spend',
    canTrigger: (_context, actor, event) => {
      /*
       * A CHANNEL SPENDS IT ON ITS LAST TICK, NOT ITS FIRST, by the owner's
       * ruling: "Wrack, Mind Flay, and Arcane Missiles inherit the 100% chance
       * to crit from the Revelation proc for the entire channel." A cast
       * reaction fires once per channel TICK, so without this the first
       * missile spent the charge and the other four rolled at ordinary crit.
       * A plain cast is `final` on its one and only run.
       */
      if (!event.final) return false;
      const aura = actor.auras.get(REVELATION.id);
      if (!aura) {
        procCastSequence = null;
        return false;
      }
      // The cast that PROCCED it does not spend it: a proc fired from inside
      // this cast's own damage shares its sequence number.
      if (procCastSequence === null) procCastSequence = actor.castSequence;
      if (procCastSequence === actor.castSequence) return false;

      return isSpellCast(actor, event.ability.id);
    },
    onTrigger: (context, actor) => {
      procCastSequence = null;
      actor.auras.remove(context, REVELATION.id);
    },
  };
}

/**
 * The cast reactions the equipped set brings.
 *
 * ----------------------------------------------------------------------------
 * A SECOND FUNCTION BESIDE `reactionsForEquipment`, because a cast event is
 * not an attack event and `createPlayer` keeps the two lists apart -- the same
 * split `RaidBuffReactions` makes for Judgement of Wisdom.
 *
 * IT RETURNS AT MOST ONE EVEN THOUGH BOTH HANDS ROLL, and the reason is the
 * aura rather than the roll. Two enchanted hands are two OPPORTUNITIES -- the
 * owner's "roll once per hand" -- and they feed ONE `revelation` aura holding
 * ONE charge, so there is one thing to spend. Two spenders would each try to
 * remove it and the second would find it gone; harmless today and exactly the
 * kind of thing that stops being harmless.
 *
 * AND EACH SPENDER CARRIES ITS OWN `castSequence` LATCH, which is the real
 * reason a second one would be wrong rather than merely redundant: the two
 * would disagree about which cast procced the aura, and whichever ran first
 * would decide.
 * ----------------------------------------------------------------------------
 */
export function castReactionsForEquipment(
  equipment: Readonly<Record<string, { itemId: number; enchantId?: number } | undefined>>,
): readonly CastReaction[] {
  return hasRevelation(equipment) ? [revelationSpender()] : [];
}

/** Whether any melee weapon slot carries Revelation. */
function hasRevelation(
  equipment: Readonly<Record<string, { itemId: number; enchantId?: number } | undefined>>,
): boolean {
  return MELEE_EQUIPMENT_SLOTS.some(
    (slot) => equipment[slot]?.enchantId === REVELATION_ENCHANT_ID,
  );
}

/** The three equipment slots a melee weapon can be in. */
const MELEE_EQUIPMENT_SLOTS = ['mainHand', 'twoHand', 'offHand'] as const;
