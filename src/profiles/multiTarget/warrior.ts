import type { AplCondition, AplEntry } from '../../game/rotations/apl';
import { not, resource } from '../../game/rotations/apl/shorthand';
import {
  BERSERKER_HEROIC_STRIKE_RAGE,
  TANK_EXECUTE_PHASE,
  WARRIOR_DUAL_WIELD_BERSERKER,
  WARRIOR_FURY_PROT,
  WARRIOR_SHIELD_DEFENSIVE,
  WARRIOR_TWO_HAND_BATTLE,
} from '../../game/rotations/warrior';
import type { MultiTargetDefaults } from './types';

/*
 * ============================================================================
 * THE WARRIOR PRESETS' MULTI TARGET LISTS (round 78), keyed by preset id.
 *
 * EACH IS ITS SINGLE TARGET LIST WITH A FEW EDITS, DERIVED BY MAPPING rather
 * than copied, so a change to the owner's Single Target list reaches the Multi
 * Target one for free and the edits are the only lines that say anything --
 * the arrangement `WARRIOR_FURY_PROT` already uses against the Prot list.
 *
 * Measured with `tools/optimise/warriorVariants.ts`, 400 paired fights unless
 * stated, against the Single Target list run on the same adds. Every list was
 * also checked at 3 targets / 60s and 8 targets / 30s and wins at both, so no
 * entry needs a `targetCount` gate.
 *
 * NO PRE-COMBAT LIST OF ITS OWN: each section defaults to its preset's Single
 * Target opener. Sweeping Strikes pre-cast at 0s on 2H Arms was priced and
 * loses (-6.9 against the list without it).
 * ============================================================================
 */

const only = (entries: readonly AplEntry[], id: string): AplEntry => {
  const found = entries.filter((e) => e.abilityId === id);
  if (found.length !== 1) throw new Error(`expected exactly one ${id} entry, found ${found.length}`);
  return found[0];
};

/** Insert `entry` directly above the one entry for `beforeId`. */
const insertAbove = (entries: readonly AplEntry[], beforeId: string, entry: AplEntry): AplEntry[] => {
  const at = entries.indexOf(only(entries, beforeId));
  return [...entries.slice(0, at), entry, ...entries.slice(at)];
};

const without = (entries: readonly AplEntry[], ...ids: string[]): AplEntry[] => {
  for (const id of ids) only(entries, id);
  return entries.filter((e) => !ids.includes(e.abilityId));
};

/** Heroic Strike's entry turned into Cleave, in the same place, under `condition`. */
const cleaveFor = (entries: readonly AplEntry[], condition: AplCondition): AplEntry[] => {
  const hs = only(entries, 'heroic_strike');
  return entries.map((e) => (e === hs ? { ...hs, abilityId: 'cleave', condition } : e));
};

/*
 * 2H ARMS: Sweeping Strikes above Heroic Strike, Cleave in Heroic Strike's
 * place at 60 rage, and WHIRLWIND above Mortal Strike -- a Berserker ability
 * the list DANCES for, the way it already dances for Recklessness, and comes
 * back to Battle for Overpower and Rend. **+337.5 +/- 13.7** at 5 targets,
 * +265.6 at 3, +390.5 at 8 (30s). The dance is most of it: the same list
 * without Whirlwind is +141.5.
 *
 * Priced and lost against this list: Whirlwind higher (-24 to -32) or lower
 * (-25); Cleave at 40 (-57) or 80 (-17); dropping Rend (-71: Bloodthrill's
 * Overpowers need it), Overpower (-123), or Sweeping Strikes (-126); Thunder
 * Clap above Slam (-94). Recklessness switched on is +61.7 more -- it stays
 * off, as in the Single Target list, by the owner's ruling.
 */
export const ARMS_MULTI_SWEEPING_RAGE = 30;
export const ARMS_MULTI_CLEAVE_RAGE = 60;
const armsEntries = insertAbove(
  cleaveFor(
    insertAbove(WARRIOR_TWO_HAND_BATTLE.entries, 'heroic_strike', {
      abilityId: 'sweeping_strikes',
      condition: resource('atLeast', ARMS_MULTI_SWEEPING_RAGE, 'rage'),
    }),
    resource('atLeast', ARMS_MULTI_CLEAVE_RAGE, 'rage'),
  ),
  'mortal_strike',
  { abilityId: 'whirlwind' },
);

/*
 * DW FURY: Whirlwind above Execute, and Cleave in Heroic Strike's place at the
 * owner's own 42. **+187.0 +/- 14.3** at 5 targets, +176.5 at 3, +198.0 at 8
 * (30s). Whirlwind already hit four targets from the bottom of the list; it is
 * worth +43.9 moved up on its own, Cleave +136.7 on its own.
 *
 * Indistinguishable from it (each within +/- 20 of +187): Whirlwind higher
 * still, Cleave at 36 or 50, Bloodthirst above Cleave, Death Wish ungated.
 * Lost: Cleave at 65 (-14), Thunder Clap with a dance to Battle (-104).
 * Recklessness on is +122.9 more and stays off, by the owner's ruling.
 */
const furyEntries = cleaveFor(
  insertAbove(
    without(WARRIOR_DUAL_WIELD_BERSERKER.entries, 'whirlwind'),
    'execute',
    only(WARRIOR_DUAL_WIELD_BERSERKER.entries, 'whirlwind'),
  ),
  resource('atLeast', BERSERKER_HEROIC_STRIKE_RAGE, 'rage'),
);

/*
 * THE TWO TANKS: Cleave in Heroic Strike's place, still switched off in the
 * tank execute window -- at the owner's 26 on Prot Warr, and at 40 on Fury
 * Prot, whose Single Target Heroic Strike sits at 65 (Cleave at 65 measured
 * +58.4 against +67.6 at 40) -- and THUNDER CLAP AND DEMORALIZING SHOUT OUT.
 *
 * DROPPING THUNDER CLAP AT FIVE TARGETS READS BACKWARDS AND IS MEASURED, on
 * both tanks and at every target count the report runs, with deaths inside
 * their interval each time (800 paired fights, TPS against the Single Target
 * list on the same adds):
 *
 *   |            | 3 targets | 5 targets | 8 targets (30s) |
 *   | ---------- | --------- | --------- | --------------- |
 *   | Prot Warr  | +169.3    | +198.2    | +226.3          |
 *   | Fury Prot  | +139.5    | +137.1    | +170.7          |
 *
 * against Cleave alone at +90.7 / +159.3 / +202.0 (Prot) and +46.0 / +67.8 /
 * +138.6 (Fury Prot). Both are MITIGATION -- a slowed or weakened enemy hits
 * for less, and a Warrior's rage is `D x 10 / H` off the damage taken -- and
 * Thunder Clap carries no threat multiplier here (`game/combat/threat.ts`), so
 * its rage buys four small hits at x1.0. WHETHER IT SHOULD BE x1.75, AS IN
 * CLASSIC, IS A QUESTION FOR THE OWNER: the answer could put it back.
 */
/*
 * ROUND 80, DW FURY: THE OWNER'S OPENER PLUS DEATH WISH AND MIGHTY RAGE AT 0s,
 * in the Multi Target section only. A one-minute (or thirty-second) fight has
 * no last 35 seconds worth holding Death Wish for, and the potion's 60 Strength
 * and rage are worth most at the pull: +20.6 +/- 15.0 at 5 targets / 60 s,
 * +31.4 +/- 24.1 at 8 / 30 s, -2.6 (noise) at 3 / 60 s. In the Single Target
 * list both are noise (-0.46 and +0.94 at 120 s), so it stays as it is.
 */
const FURY_MULTI_PRECOMBAT = [
  { abilityId: 'bloodrage_cast', secondsBefore: 10 },
  { abilityId: 'battle_shout_cast', secondsBefore: 10 },
  { abilityId: 'berserker_stance_cast', secondsBefore: 3 },
  { abilityId: 'blood_fury', secondsBefore: 0 },
  { abilityId: 'death_wish', secondsBefore: 0 },
  { abilityId: 'mighty_rage_potion', secondsBefore: 0 },
];

/*
 * ROUND 80: AND THE TANK EXECUTE CLAUSE IS LIFTED HERE, which it cannot be in
 * the Single Target list because there it is the owner's ("swap to Battle
 * Stance and spam Execute"). The Multi Target list is this project's: Execute
 * goes, and so does the `not(execute phase)` half of every gate, so the tank
 * keeps tanking in Defensive Stance -- Cleave, Revenge, Shield Slam -- to the
 * end. Battle Stance loses Defensive's threat modifier on every add, and
 * Execute hits one target. **+190.3 +/- 6.2 TPS on Prot Warr at 5 targets and
 * +209.1 +/- 7.6 on Fury Prot**, deaths down on both.
 *
 * AND PROT WARR'S REND IS SPREAD (`multiDot: 5`), worth another +77.6 at five
 * targets once the clause is lifted: +199.7 at 3 and +235.3 at 8 for the pair.
 * Three measured +247.8 at 8 and 248.0 at 5; five is the best sum. On Fury Prot
 * the spread is noise (-15.5 at 5), because its rage goes to Bloodthirst.
 */
export const PROT_MULTI_CLEAVE_RAGE = 26;
export const FURY_PROT_MULTI_CLEAVE_RAGE = 40;
export const PROT_MULTI_REND_TARGETS = 5;
const NOT_EXECUTE = JSON.stringify(not(TANK_EXECUTE_PHASE));
const liftExecuteClause = (condition: AplCondition | undefined): AplCondition | undefined => {
  if (!condition || JSON.stringify(condition) === NOT_EXECUTE) return undefined;
  if (condition.kind !== 'all') return condition;
  const of = condition.of.filter((c) => JSON.stringify(c) !== NOT_EXECUTE);
  return of.length === 0 ? undefined : of.length === 1 ? of[0] : { ...condition, of };
};
const tankEntries = (entries: readonly AplEntry[], rage: number, rendTargets?: number): AplEntry[] =>
  without(
    cleaveFor(entries, resource('atLeast', rage, 'rage')),
    'thunder_clap',
    'demoralizing_shout_cast',
    'execute',
  ).map((entry) => {
    const condition = liftExecuteClause(entry.condition);
    const { condition: _dropped, ...rest } = entry;
    void _dropped;
    const lifted: AplEntry = condition ? { ...rest, condition } : rest;
    return rendTargets && lifted.abilityId === 'rend_cast' ? { ...lifted, multiDot: rendTargets } : lifted;
  });

export const WARRIOR_MULTI_TARGET: MultiTargetDefaults = {
  two_hand_arms: { name: 'Warrior (Two-Hander, Battle) - Multi Target', entries: armsEntries },
  dw_fury: {
    name: 'Warrior (Dual-Wield, Berserker) - Multi Target',
    entries: furyEntries,
    precombat: FURY_MULTI_PRECOMBAT,
  },
  prot_warr: {
    name: 'Warrior (Shield, Defensive) - Multi Target',
    entries: tankEntries(WARRIOR_SHIELD_DEFENSIVE.entries, PROT_MULTI_CLEAVE_RAGE, PROT_MULTI_REND_TARGETS),
  },
  fury_prot: {
    name: 'Warrior (Fury Prot) - Multi Target',
    entries: tankEntries(WARRIOR_FURY_PROT.entries, FURY_PROT_MULTI_CLEAVE_RAGE),
  },
};
