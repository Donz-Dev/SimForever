/*
 * ============================================================================
 * THE RULESET OWNER'S COEFFICIENT TABLE.
 *
 * Source: `WoWSimWorksheet.xlsx`, supplied 2026-09-29 as the AUTHORITATIVE
 * document for attack power, weapon damage and spell power coefficients. It is
 * transcribed here row for row, in the sheet's own order, so refreshing it is a
 * diff against one file.
 *
 * ----------------------------------------------------------------------------
 * IT REPLACED A RULE WITH DATA, and that is the whole point of it.
 *
 * Every coefficient in this project used to be DERIVED -- `castTime / 3.5` for
 * a direct spell, `duration / 15` for a periodic one, and a share formula for
 * anything that did both. Three of those four were WoW Classic's, borrowed on
 * the owner's ruling because Forever had stated none, and each carried a
 * `PLACEHOLDER_` name saying so. The sheet states them outright, so the rule,
 * its three placeholders and the hybrid split are all gone: see
 * docs/spell-coefficients.md.
 *
 * The derivation and the sheet DISAGREE in both directions and by a lot --
 * Blast Wave fell from 0.43 to 0.129, Devouring Plague's tick halved, Siphon
 * Life's quartered, and Fireball's burn lost its share entirely. A derived
 * number that looks reasonable is exactly what this project is built not to
 * trust.
 *
 * ----------------------------------------------------------------------------
 * A COEFFICIENT IS ADDED TO THE BASE DAMAGE, NEVER INSTEAD OF IT. The owner's
 * instruction, given with the sheet: "many spells have a base damage that needs
 * to be added to this ... make sure that flat ability damage doesn't get lost."
 *
 * `scaleByPower` computes `baseAmount + coefficient x power`, so the pipeline
 * already does this -- what the instruction guards against is an EDIT that
 * drops a flat term while setting a coefficient. Mortal Strike is "weapon
 * damage plus 160" and the 160 is not part of any coefficient;
 * `tests/game/flatDamageSurvives.test.ts` fails if any of them goes missing.
 *
 * ----------------------------------------------------------------------------
 * WHAT `0` MEANS HERE. The sheet states zero for a damage source that does not
 * scale with that stat, and those zeros are transcribed rather than omitted --
 * an absent entry and a stated zero are different claims, and only the second
 * is the owner saying so.
 *
 * WEAPON-DAMAGE ROWS CARRY NO NUMBER. "weapon damage" is not a coefficient: the
 * ability deals the weapon's damage, so attack power reaches it through the
 * weapon at `speed / 14` and the fraction is the ability's own share of a
 * swing. Those rows are listed in `WEAPON_DAMAGE_SOURCES` below for the record,
 * and the fractions live with their abilities where they always have.
 * ============================================================================
 */

/**
 * A damage source that ticks states its coefficient PER TICK, and one that
 * lands once states it for the hit.
 *
 * Kept as separate named constants rather than one big object because an
 * ability importing its own number is how every other value in `game` works,
 * and because a typo in a key reads as `undefined` while a typo in an import
 * fails to compile.
 */

// ---------------------------------------------------------------------------
// Warrior
// ---------------------------------------------------------------------------

/** Revenge: 22% of attack power, on top of its flat damage. */
export const REVENGE_AP_COEFFICIENT = 0.22;

/** Rend: 2% of attack power PER TICK. */
export const REND_TICK_AP_COEFFICIENT = 0.02;

/** Thunder Clap: 7% of attack power. */
export const THUNDER_CLAP_AP_COEFFICIENT = 0.07;

/** Bloodthirst: 35% of attack power. Unchanged by the sheet. */
export const BLOODTHIRST_AP_COEFFICIENT = 0.35;

// ---------------------------------------------------------------------------
// Paladin
// ---------------------------------------------------------------------------

/**
 * Seal of Command: 70% of weapon damage, AND 20.3% spell power per strike.
 *
 * The weapon half was already right; the spell power half is new, and it is the
 * reason this row is not simply "weapon damage".
 */
export const SEAL_OF_COMMAND_SP_COEFFICIENT = 0.203;

/**
 * Seal of Righteousness, per strike, and IT DEPENDS ON WHAT IS HELD: 20% spell
 * power with a one-hander, 22% with a two-hander.
 *
 * ----------------------------------------------------------------------------
 * THIS SUPERSEDES THE FORMULA THE OWNER GAVE EARLIER, and the difference is not
 * a refinement. The old one was
 * `base + baseWeaponSpeed x (0.022 x AP + 0.044 x SP)`: it read ATTACK POWER as
 * well as spell power, and it scaled continuously with weapon speed. The sheet
 * gives NO attack power term at all and two flat figures chosen by weapon type.
 *
 * The later document wins, being the one handed over as authoritative. The
 * earlier formula is recorded in docs/spell-coefficients.md rather than deleted,
 * because a reader meeting `0.022` in this project's history should be able to
 * find out what happened to it.
 * ----------------------------------------------------------------------------
 */
export const SEAL_OF_RIGHTEOUSNESS_SP_COEFFICIENT_ONE_HAND = 0.2;
export const SEAL_OF_RIGHTEOUSNESS_SP_COEFFICIENT_TWO_HAND = 0.22;

/** Seal of Fury: 10% spell power per strike. Was flat. */
export const SEAL_OF_FURY_SP_COEFFICIENT = 0.1;

/** Holy Shock: 42.857% spell power — three sevenths, i.e. 1.5 / 3.5. */
export const HOLY_SHOCK_SP_COEFFICIENT = 0.4285714285714286;

/** Consecration: 9.5% spell power PER TICK. */
export const CONSECRATION_TICK_SP_COEFFICIENT = 0.095;

/** Holy Strike: 50% of weapon damage, AND 21.45% spell power. */
export const HOLY_STRIKE_SP_COEFFICIENT = 0.2145;

/**
 * Judgement, and its coefficient depends on the SEAL it unleashes.
 *
 * One ability in this simulator and three rows on the sheet, because Judgement
 * "unleashes the energy of a Seal spell" and the seal decides what lands. The
 * ability already reads which seal is up in order to choose its damage; it now
 * reads it for the coefficient too.
 */
export const JUDGEMENT_OF_COMMAND_SP_COEFFICIENT = 0.43;
export const JUDGEMENT_OF_FURY_SP_COEFFICIENT = 0.45;
export const JUDGEMENT_OF_RIGHTEOUSNESS_SP_COEFFICIENT = 0.5;

/**
 * Hammer of Wrath: 42.857% spell power.
 *
 * APPLIED. It was transcribed and unapplied for as long as the ability did not
 * exist, which was the sheet's last such row -- the two poison rows were
 * cleared when the poison system landed and this one when the ruleset owner
 * put Hammer of Wrath in two Paladin priority lists.
 *
 * Its "only usable on enemies that have 20% or less health" is the CLOCK here,
 * by the same ruling Execute runs on; see `combat/executePhase.ts`.
 */
export const HAMMER_OF_WRATH_SP_COEFFICIENT = 0.4285714285714286;

// ---------------------------------------------------------------------------
// Hunter — every row unchanged by the sheet, and transcribed to say so.
// ---------------------------------------------------------------------------

/** Serpent Sting: 15% of ranged attack power over its duration. */
export const SERPENT_STING_RAP_COEFFICIENT = 0.15;

/** Arcane Shot: 10% of ranged attack power. */
export const ARCANE_SHOT_RAP_COEFFICIENT = 0.1;

// ---------------------------------------------------------------------------
// Rogue
// ---------------------------------------------------------------------------

/**
 * Eviscerate: 4% of attack power PER COMBO POINT SPENT.
 *
 * The first of the four finishers the audit found flat while their own tooltips
 * said they scaled. The sheet answers all four the same way -- per combo point,
 * not a flat fraction of the finisher.
 */
export const EVISCERATE_AP_COEFFICIENT_PER_COMBO_POINT = 0.04;

/** Rupture: 3% of attack power PER TICK, whatever it was cast at. */
export const RUPTURE_TICK_AP_COEFFICIENT = 0.03;

/**
 * Instant Poison (0.5%) and Deadly Poison (0.45% per tick).
 *
 * APPLIED. This comment said "TRANSCRIBED AND NOT APPLIED: poisons are not
 * implemented at all" until the poison system landed, which is exactly the shape
 * of expired claim this project keeps finding: a reason that was true on the day
 * it was written and stayed on the page afterwards. `poisons.ts` reads the first
 * and `auras/rogue.ts` the second.
 *
 * The owner's own wording for the tick is "115 damage + 0.45% of attack power",
 * which is the sheet's row said twice -- so the two sources agree here.
 */
export const INSTANT_POISON_AP_COEFFICIENT = 0.005;
export const DEADLY_POISON_TICK_AP_COEFFICIENT = 0.0045;

// ---------------------------------------------------------------------------
// Priest
// ---------------------------------------------------------------------------

/** Shadow Word: Pain: 20% spell power per tick. */
export const SHADOW_WORD_PAIN_TICK_SP_COEFFICIENT = 0.2;

/** Devouring Plague: 10% spell power per tick. */
export const DEVOURING_PLAGUE_TICK_SP_COEFFICIENT = 0.1;

/** Mind Flay: 16.7% spell power per tick. */
export const MIND_FLAY_TICK_SP_COEFFICIENT = 0.167;

/** Mind Blast: 42.857% spell power. */
export const MIND_BLAST_SP_COEFFICIENT = 0.42857142857142855;

/** Shadow Word: Death: 43% spell power. */
export const SHADOW_WORD_DEATH_SP_COEFFICIENT = 0.43;

// ---------------------------------------------------------------------------
// Shaman
// ---------------------------------------------------------------------------

export const LAVA_BURST_SP_COEFFICIENT = 0.714;
export const LIGHTNING_BOLT_SP_COEFFICIENT = 0.714;
export const EARTH_SHOCK_SP_COEFFICIENT = 0.386;
export const FROST_SHOCK_SP_COEFFICIENT = 0.386;
export const CHAIN_LIGHTNING_SP_COEFFICIENT = 0.571;

/** Flame Shock is stated as two rows: the hit, and then the burn per tick. */
export const FLAME_SHOCK_SP_COEFFICIENT = 0.214;
export const FLAME_SHOCK_TICK_SP_COEFFICIENT = 0.1;

/*
 * FIRE NOVA: 10% of spell power.
 *
 * ----------------------------------------------------------------------------
 * THE SECOND ROW IN THIS FILE THAT IS NOT FROM THE SHEET, and it is the same
 * shape as Wrack above. `WoWSimWorksheet.xlsx` gives the Shaman six rows --
 * Lightning Bolt, Chain Lightning, Lava Burst, the two other Shocks and Flame
 * Shock's two halves -- and Fire Nova is not one of them. It could not be: Fire
 * Nova is `versusClassic: "new"`, a spell Forever added, so there is no Classic
 * row to have carried over and nothing to transcribe.
 *
 * SUPPLIED BY THE RULESET OWNER DIRECTLY, on 2026-09-30, asked for with the
 * alternatives beside it: "give it a 10% spell power coefficient for now".
 * The "for now" is theirs and is recorded rather than smoothed away -- it is a
 * ruling that may be revisited, which is different from a placeholder nobody
 * has answered.
 *
 * SAID HERE RATHER THAN FOLDED IN, for Wrack's reason: everything around it is
 * transcribed from one document, and the next refresh of that document will not
 * contain this line. The authority is the same -- it is the owner either way --
 * and the PROVENANCE is not.
 *
 * IT IS A SMALL COEFFICIENT ON A LARGE FLAT HIT, which is worth knowing before
 * reading it as generous: 436 base against 10% of spell power, so an
 * Enhancement shaman's 300-odd spell power adds about 7% to the spell. Fire
 * Nova is a flat nuke here and the coefficient makes it scale rather than
 * making it scale much.
 * ----------------------------------------------------------------------------
 */
export const FIRE_NOVA_SP_COEFFICIENT = 0.1;

// ---------------------------------------------------------------------------
// Mage
// ---------------------------------------------------------------------------

export const ARCANE_MISSILES_TICK_SP_COEFFICIENT = 0.286;
export const ARCANE_BLAST_SP_COEFFICIENT = 0.714;
export const FIRE_BLAST_SP_COEFFICIENT = 0.429;
export const SCORCH_SP_COEFFICIENT = 0.429;
/**
 * Ice Lance: `1.5 / 3.5 / 4`, which is 0.107.
 *
 * ----------------------------------------------------------------------------
 * THE RULESET OWNER'S OWN EXPRESSION, GIVEN IN THAT FORM: "Ice lance now has a
 * 1.5/3.5/4 spell power coefficient instead of 1.5/3.5." It was 0.43 here, which
 * is `1.5 / 3.5` rounded -- so this is a QUARTER of what shipped.
 *
 * WRITTEN AS THE EXPRESSION RATHER THAN AS A DECIMAL, which is the one place in
 * this file that does so, for two reasons. The owner stated it that way, and
 * `1.5 / 3.5` does not terminate: 0.43 was already a rounding, and rounding a
 * second division would compound it. `0.107` is 0.11% low against 0.1071428...
 *
 * AND THE FOUR IN IT IS NOT THE FROZEN MULTIPLIER, however much it looks like
 * one. `ICE_LANCE_FROZEN_MULTIPLIER` is also 4 and is applied SEPARATELY, in the
 * ability, to the base damage and this coefficient alike -- so a frozen Ice
 * Lance now carries `1.5 / 3.5 / 4 * 4`, which is exactly `1.5 / 3.5`, the
 * figure the spell used to have UNFROZEN.
 *
 * THAT COINCIDENCE IS THE TRAP THIS NOTE EXISTS FOR. The two readings -- "the
 * owner divided by the frozen multiplier, so the ability should stop applying
 * it" and "the owner gave a base coefficient and the multiplier still applies"
 * -- differ by a factor of SIXTEEN on a frozen cast, and the second is the right
 * one: the owner has already ruled separately that the multiplier reaches the
 * coefficient as well as the base ("deals 300% increased damage" is all of the
 * damage), and a new statement of a VALUE does not overturn a ruling about which
 * terms a multiplier reaches. See `ICE_LANCE` for that ruling.
 * ----------------------------------------------------------------------------
 */
export const ICE_LANCE_SP_COEFFICIENT = 1.5 / 3.5 / 4;
export const BLAST_WAVE_SP_COEFFICIENT = 0.129;
export const FROSTBOLT_SP_COEFFICIENT = 0.814;

/**
 * Three of the Mage's spells hit AND burn, and the sheet gives each half its
 * own row. TWO OF THE THREE BURNS ARE STATED AS ZERO.
 *
 * That is the sheet contradicting the old hybrid rule outright rather than
 * merely restating it. The rule split one cast's scaling between its halves by
 * DURATION, which handed Fireball's eight-second burn 35% of the spell's
 * scaling for 11% of its damage -- a known consequence, documented and left
 * alone because the rule was the owner's. The sheet gives the burn nothing and
 * the hit the full 0.84, which is also how Classic treats it.
 */
export const PYROBLAST_SP_COEFFICIENT = 0.91;
export const PYROBLAST_TICK_SP_COEFFICIENT = 0.15;
export const FIREBALL_SP_COEFFICIENT = 0.84;
export const FIREBALL_TICK_SP_COEFFICIENT = 0;
export const FROSTFIRE_BOLT_SP_COEFFICIENT = 0.814;
export const FROSTFIRE_BOLT_TICK_SP_COEFFICIENT = 0;

// ---------------------------------------------------------------------------
// Warlock
// ---------------------------------------------------------------------------

/**
 * BANE OF AGONY: 160% of spell power across the WHOLE effect, not per tick.
 *
 * ----------------------------------------------------------------------------
 * THE SECOND ROW IN THIS FILE THAT IS NOT FROM THE SHEET, AND THE FIRST THAT
 * CONTRADICTS IT. `WoWSimWorksheet.xlsx` gives Bane of Agony 13.3% a tick,
 * which over the eight ticks it then had is 1.064 in total. The ruleset owner
 * has since stated the figure directly, with the cadence and the ramp in the
 * same message: "ticks every 2 seconds, lasts 24 seconds, benefits from 160% of
 * the character sheet spell power", worked through as "552 + 500 * 1.6 = 1352"
 * for a caster with 500 spell power.
 *
 * SO IT SUPERSEDES THE SHEET, by the standing rule that the later and more
 * specific statement from the owner wins -- the same way the sheet itself
 * superseded `WoWForeverWarriorAbilities.xlsx` on Rend and Revenge. Both sites
 * say so, because a reader who knows the sheet would otherwise read 1.6 as a
 * transcription error.
 *
 * IT IS A TOTAL AND THE TICKS DIVIDE IT, which is why this constant is not
 * named `_TICK_`. `BANE_OF_AGONY_TICK_SHARES` in `auras/warlock.ts` holds the
 * ramp that splits it, and both the flat 552 and this coefficient are split by
 * the SAME shares -- so a tick is `(552 + SP * 1.6) * share` however the ramp
 * is read.
 *
 * WORTH ROUGHLY HALF AGAIN what the sheet gave it: 1.6 against 1.064, on an
 * effect that is a fifth of the SM/DS profile's damage.
 * ----------------------------------------------------------------------------
 */
export const BANE_OF_AGONY_SP_COEFFICIENT = 1.6;
export const SIPHON_LIFE_TICK_SP_COEFFICIENT = 0.05;
export const CORRUPTION_TICK_SP_COEFFICIENT = 0.2;
export const SHADOW_BOLT_SP_COEFFICIENT = 0.857;
export const INCINERATE_SP_COEFFICIENT = 0.714;
export const CONFLAGRATE_SP_COEFFICIENT = 0.429;
export const SHADOWBURN_SP_COEFFICIENT = 0.429;
export const SEARING_PAIN_SP_COEFFICIENT = 0.429;

/** Immolate, both halves: the hit, then the burn per tick. */
export const IMMOLATE_SP_COEFFICIENT = 0.2;
export const IMMOLATE_TICK_SP_COEFFICIENT = 0.13;

/*
 * WRACK: 14.3% of spell power PER TICK, six ticks one second apart.
 *
 * ----------------------------------------------------------------------------
 * THE ONE ROW IN THIS FILE THAT IS NOT FROM THE SHEET. `WoWSimWorksheet.xlsx`
 * lists nine Warlock spells and Wrack is not one of them, so this number was
 * supplied by the ruleset owner directly, in the same message that confirmed
 * the cadence: "14.3% of spell power each tick, ticks every second for 6
 * seconds, 6 total ticks."
 *
 * SAID HERE RATHER THAN FOLDED IN, because everything around it is transcribed
 * from one document and a reader who knows that would otherwise look for this
 * row in the sheet and not find it. The authority is the same -- it is the
 * owner either way -- but the PROVENANCE is different, and the next refresh of
 * the sheet will not contain this line.
 *
 * SIX TICKS AT 14.3% IS 0.858 OVER THE CHANNEL, which is Shadow Bolt's 0.857
 * delivered in twice the time. That is worth knowing before reading this as a
 * buff: the coefficient closes the DATA gap and does NOT make Wrack worth
 * casting, because the reason to cast it is still unmodelled. See `WRACK` in
 * `abilities/warlock.ts`.
 * ----------------------------------------------------------------------------
 */
export const WRACK_TICK_SP_COEFFICIENT = 0.143;

// ---------------------------------------------------------------------------
// Druid
// ---------------------------------------------------------------------------

/** Ferocious Bite: 3% of attack power per combo point spent. */
export const FEROCIOUS_BITE_AP_COEFFICIENT_PER_COMBO_POINT = 0.03;

/**
 * Rip: 4% of attack power per combo point spent, OVER THE WHOLE DURATION.
 *
 * ----------------------------------------------------------------------------
 * THE NAME USED TO SAY `RIP_TICK_...` AND THE COMMENT USED TO SAY "PER TICK",
 * and nothing in the source ever did. The sheet's own notation key separates
 * the two cases -- `N% per tick` for an effect stated per tick, and
 * `N%*combo point spent` for one multiplied by what the finisher spent -- and
 * Rip's row carries the SECOND marker and not the first. So the per-tick
 * reading contradicted the notation documented one line above it in
 * `docs/spell-coefficients.md`.
 *
 * Rip has SIX ticks (12 seconds at 2), so the per-tick reading was paying
 * `0.04 x points x 6` -- 120% of attack power on a five-point Rip instead of
 * 20%, six times the stated figure. The ruleset owner reported the Cat's damage
 * as too high and named Rip: "rip should be 4% attack power coefficient per
 * combo point spent over its duration NOT each tick; each tick should be
 * 4%/6 attack power coefficient per combo point spent."
 *
 * `ripAura` divides this across the ticks THE SAME WAY it divides the flat
 * damage, which is the structural point: both halves of a Rip tick now come
 * from one duration total over one tick count, so they cannot drift apart
 * again. The flat half was always a duration total -- `RIP_BY_COMBO_POINT`
 * divided by the tick count -- and only the coefficient was per tick, and that
 * inconsistency between the two halves of the same effect was the tell.
 * ----------------------------------------------------------------------------
 */
export const RIP_AP_COEFFICIENT_PER_COMBO_POINT = 0.04;

export const STARFIRE_SP_COEFFICIENT = 1;
export const WRATH_SP_COEFFICIENT = 0.57;
export const INSECT_SWARM_TICK_SP_COEFFICIENT = 0.158;

/** Moonfire, both halves. */
export const MOONFIRE_SP_COEFFICIENT = 0.15;
export const MOONFIRE_TICK_SP_COEFFICIENT = 0.13;

/**
 * Rake: 1% of attack power on the hit, and 5.5% PER TICK on the bleed.
 *
 * ----------------------------------------------------------------------------
 * THE TICK DOES NOT COME FROM THE SHEET. `WoWSimWorksheet.xlsx` states 1% for
 * both halves and that is what shipped; the ruleset owner has since given the
 * tick directly as **5.5%**, and a later statement from the owner outranks the
 * sheet exactly as the sheet outranked the Warrior ability spreadsheet on Rend,
 * Revenge and Thunder Clap.
 *
 * THE HIT IS UNCHANGED AT 1%, which is the half to be careful about: the owner
 * moved one of the two numbers, so reading "Rake is 5.5%" and setting both
 * would quietly inflate the direct damage as well.
 *
 * RECORDED HERE BECAUSE A REFRESH OF THE SHEET WILL NOT CARRY IT -- the same
 * reason Wrack's 14.3% says so beside its own constant. A reader who knows the
 * sheet would otherwise read this as drift.
 * ----------------------------------------------------------------------------
 */
export const RAKE_AP_COEFFICIENT = 0.01;
export const RAKE_TICK_AP_COEFFICIENT = 0.055;

/**
 * Swipe: 3% of attack power.
 *
 * ----------------------------------------------------------------------------
 * THE SHEET SAYS 10% AND THE PATCH NOTES SAY 3%, AND THE NOTES ARE LATER. The
 * 1.60.1.70170 notes read "Fixed a bug causing Swipe to not scale with Attack
 * Power. It will now correctly gain 3% of the Druid's attack power" -- so the
 * figure Forever has now SHIPPED is three, and `WoWSimWorksheet.xlsx` records
 * what it was meant to be before the fix landed.
 *
 * THE SAME RULE RAKE'S TICK RUNS ON: a later statement from the owner outranks
 * the sheet, and it is recorded here because a refresh of the sheet will not
 * carry it and a reader who knows the sheet would read 0.03 as drift.
 *
 * WORTH NOTHING TO EVERY PROFILE, and that is not a reason to leave it. Swipe is
 * in no priority list -- it is a three-target rage ability and every encounter
 * here has one target -- so this moves no figure in the baseline table. What it
 * changes is what the number MEANS the day a multi-target encounter exists.
 * ----------------------------------------------------------------------------
 */
export const SWIPE_AP_COEFFICIENT = 0.03;

/**
 * Lacerate: 10% of WEAPON DAMAGE per existing application, per tick.
 *
 * The only row on the sheet that is a weapon-damage fraction AND stacking AND
 * per tick at once, which is why it is a number here rather than a note beside
 * the ability: at three stacks each tick carries 30% of a swing.
 */
export const LACERATE_TICK_WEAPON_FRACTION_PER_APPLICATION = 0.1;

/**
 * The rows the sheet marks "weapon damage", which carry no coefficient because
 * the damage IS the weapon's and attack power reaches it through the weapon.
 *
 * Listed so the transcription covers every row of the sheet and a reader can
 * see that none was dropped. `tests/game/ownerCoefficients.test.ts` checks each
 * one still scales with the weapon.
 */
export const WEAPON_DAMAGE_SOURCES = [
  // Warrior
  'mortal_strike',
  'heroic_strike',
  'slam',
  'cleave',
  'overpower',
  'whirlwind',
  'spearing_strike',
  // Paladin
  'seal_of_command',
  'holy_strike',
  // Hunter
  'sniper_shot',
  'aimed_shot',
  'multi_shot',
  'raptor_strike',
  'mongoose_bite',
  'strider_kick',
  // Rogue
  'backstab',
  'ghostly_strike',
  'sinister_strike',
  'mutilate',
  'hemorrhage',
  // Shaman
  'stormstrike',
  // Druid
  'shred',
  'claw',
  'maul',
  'primal_bite',
] as const;

/**
 * The rows the sheet states as ZERO on both axes: flat damage, and no scaling.
 *
 * Also listed rather than omitted, because "the owner says this does not scale"
 * and "nobody has looked at this" are different claims and the audit exists to
 * tell them apart.
 */
export const FLAT_DAMAGE_SOURCES = [
  'execute',
  'shield_slam',
  'intercept',
  'hamstring',
  'summon_hawk',
] as const;
