import { describe, expect, it } from 'vitest';

import { WARRIOR_TALENT_EFFECTS } from '../../src/game/talents/warriorEffects';
import { ROGUE_TALENT_EFFECTS } from '../../src/game/talents/rogueEffects';
import { DRUID_TALENT_EFFECTS } from '../../src/game/talents/druidEffects';
import { SHAMAN_TALENT_EFFECTS } from '../../src/game/talents/shamanEffects';
import { MAGE_TALENT_EFFECTS } from '../../src/game/talents/mageEffects';
import { PALADIN_TALENT_EFFECTS } from '../../src/game/talents/paladinEffects';
import { HUNTER_TALENT_EFFECTS } from '../../src/game/talents/hunterEffects';
import { WARLOCK_TALENT_EFFECTS } from '../../src/game/talents/warlockEffects';
import { PRIEST_TALENT_EFFECTS } from '../../src/game/talents/priestEffects';
import type { TalentEffects } from '../../src/game/talents/TalentEffect';
import { talentBuild } from '../../src/game/talents/talentBuild';

/*
 * THE RULINGS ARE DATA, AND THIS IS WHAT MAKES THEM CHECKABLE.
 *
 * The project owner has ruled four things permanently out of scope: positions
 * and range, crowd control, threat, and healing throughput. A talent blocked on
 * one of those is a DECISION and not an engine gap, and the milestone -- "every
 * talent resolves to an effect or to a permanent ruling" -- can only be measured
 * if the two are told apart mechanically.
 *
 * So this file asserts two things prose cannot:
 *
 *   1. A reason that names a ruled-out concept CARRIES the ruling. Otherwise a
 *      new class writes "nothing here moves" and it reads as work outstanding,
 *      which is exactly how the queue came to be a third too long.
 *   2. A ruled-out reason does NOT read as pending. "Out of scope" and "not
 *      written yet" are the same sentence shape and only one of them expires.
 *
 * The wording match is deliberate. It is the same lever `grantCastModifier`'s
 * test uses: match the SENTENCE rather than a list of ids, so a class nobody has
 * written yet is covered.
 */

const TABLES: Record<string, Readonly<Record<string, TalentEffects>>> = {
  warrior: WARRIOR_TALENT_EFFECTS,
  rogue: ROGUE_TALENT_EFFECTS,
  druid: DRUID_TALENT_EFFECTS,
  shaman: SHAMAN_TALENT_EFFECTS,
  mage: MAGE_TALENT_EFFECTS,
  paladin: PALADIN_TALENT_EFFECTS,
  hunter: HUNTER_TALENT_EFFECTS,
  warlock: WARLOCK_TALENT_EFFECTS,
  priest: PRIEST_TALENT_EFFECTS,
};

/** Every unmodelled entry in the project, with where it came from. */
function everyReason(): { id: string; reason: string; scope?: string }[] {
  const out: { id: string; reason: string; scope?: string }[] = [];
  for (const [characterClass, table] of Object.entries(TABLES)) {
    for (const [talentId, effects] of Object.entries(table)) {
      for (const effect of effects) {
        if (effect.kind !== 'unmodelled') continue;
        out.push({ id: `${characterClass}.${talentId}`, reason: effect.reason, scope: effect.scope });
      }
    }
  }
  return out;
}

/**
 * Wording that names something ruled out. `\bheals?\b` rather than `heal`,
 * because "health" is not healing -- several live gaps are conditional on target
 * health and must not be swept in.
 *
 * THE STEALTH ENTRY IS THE NEWEST AND THE POINT OF ADDING IT. That ruling arrived
 * after six Rogue talents had spent the project counted as live gaps, and without
 * a word here the NEXT talent written with a stealth reason and no `scope` would
 * pass this test in silence -- which is the decay this file exists to prevent.
 * Unprefixed, so it catches "stealthed" too.
 */
const RULED_OUT_WORDING =
  /\bmovement\b|\bimmobilis|\bsnare|\bdaze|\bstun|\bfear\b|\bsilence|\bincapacitat|\bdisorient|\bdisarm|\bthreat\b|\btaunt\b|\bheals?\b|\bhealing\b|has a position|nothing (?:here )?moves|\btravel form\b|\bradius\b|\bstealth/i;

/**
 * Reasons that name a ruled-out concept IN PASSING while being inert for some
 * other, live reason. Each is here because the talent's real blocker is
 * something that can still expire, so scoping it would hide real work.
 *
 * Keep this list short and keep the justification on each entry. A long
 * allowlist is a broken test.
 */
const MENTIONS_BUT_IS_A_LIVE_GAP: Record<string, string> = {
  'shaman.water_shield':
    'MANA RETURN, which is explicitly in scope. Inert because neither profile is attacked and neither heals -- the target, not the ruling.',
  'paladin.guardian_s_favor':
    'Names movement impairment, but that is one of two clauses and the blocker is that NEITHER blessing is declared -- and whether a physical immunity that also stops you attacking is in scope has not been ruled on.',
  'druid.nature_s_splendor':
    'Names healing spells, but the blocker is a per-ability aura DURATION bonus having no declaration. Moonfire is not a heal.',
  'priest.divine_fury':
    'Names heals, but it also reaches Smite; inert because no Shadow list casts either -- the build, not the ruling.',
  'shaman.elemental_weapons':
    'Names a threat imbue, but the blocker is that Flametongue and Frostbrand scale off a coefficient the SOURCE does not state -- missing data, which asking could clear.',
  'warlock.demonic_brand':
    'Names threat, but it is inert because both profiles take Demonic Sacrifice and bring no demon -- the build, which another profile could change.',
  'rogue.riposte':
    'Names a disarm, but it becomes active after PARRYING, so what blocks it is a target that does not swing back -- and `targetAttacks` can change that.',
};

/** Wording that says work is outstanding. A ruling must not read like this. */
const READS_AS_PENDING = /\bnot yet\b|\bpending\b|has no declaration\b|\bhas no form\b|\bnot written\b|\bwould need\b/i;

describe('the out-of-scope rulings are data, not prose', () => {
  it('gives every reason that names a ruled-out concept the ruling that covers it', () => {
    const undeclared = everyReason()
      .filter((entry) => entry.scope === undefined)
      .filter((entry) => RULED_OUT_WORDING.test(entry.reason))
      .filter((entry) => !(entry.id in MENTIONS_BUT_IS_A_LIVE_GAP))
      .map((entry) => `${entry.id}: ${entry.reason}`);

    /*
     * A failure here means one of two things, and they need different fixes:
     * either the talent IS out of scope and wants a `scope`, or it is a live gap
     * that mentions a ruled-out concept in passing and wants an entry in
     * MENTIONS_BUT_IS_A_LIVE_GAP with the reason why.
     */
    expect(undeclared).toEqual([]);
  });

  it('never lets a ruling read as work outstanding', () => {
    const soundsPending = everyReason()
      .filter((entry) => entry.scope !== undefined)
      .filter((entry) => READS_AS_PENDING.test(entry.reason))
      .map((entry) => `${entry.id}: ${entry.reason}`);

    expect(soundsPending).toEqual([]);
  });

  it('keeps the allowlist pointed at talents that really exist', () => {
    /*
     * ----------------------------------------------------------------------
     * AN ALLOWLIST ENTRY ONLY MEANS ANYTHING FOR AN UNSCOPED REASON, and
     * checking that the talent merely EXISTS was not enough.
     *
     * The first test filters on `scope === undefined` BEFORE it consults this
     * list, so the moment a reason gains a `scope` its entry here stops being
     * consulted at all -- and the old check still passed, because the talent
     * went on reporting itself unmodelled. Warrior Improved Berserker Rage is
     * how that was found: it was built, its remaining clause took a
     * `crowdControl` scope, and its entry sat here for a while afterwards
     * saying "inert because no priority list casts Berserker Rage", which by
     * then was the opposite of what the code did.
     *
     * So the requirement is UNSCOPED, not merely present. An entry that
     * nothing can reach is a justification nobody will re-read, and this file
     * exists to stop exactly that.
     * ----------------------------------------------------------------------
     */
    const live = new Set(
      everyReason()
        .filter((entry) => entry.scope === undefined)
        .map((entry) => entry.id),
    );
    const stale = Object.keys(MENTIONS_BUT_IS_A_LIVE_GAP).filter((id) => !live.has(id));

    // An allowlist entry for a talent that no longer reports an UNSCOPED reason
    // is a claim that has expired, which is the failure mode this project keeps
    // hitting. Delete it rather than leaving it to rot.
    expect(stale).toEqual([]);
  });

  it('carries the ruling through to what a person is shown', () => {
    /*
     * The Talent panel splits its list on exactly this field -- a decision above,
     * work outstanding below -- because showing them together told someone their
     * build was missing features that were never coming. So the split has to
     * survive `talentBuild`, not just exist in the effect table.
     *
     * Iron Will is a ruling (stun and fear duration). Sweeping Strikes is a gap
     * with no scope: its effect is an additional target, and an encounter could
     * one day have one. One allocation, both kinds, and the panel's own filter
     * applied here.
     *
     * THE GAP HALF USED TO BE IMPROVED BERSERKER RAGE and had to move, which is
     * the good kind of test failure. Its reason argued that no priority list
     * casts Berserker Rage -- an argument about a LIST, filed as though it were
     * an argument about the engine -- and its rage-on-activation number was
     * stated in the values file all along. It is built now, and what is left of
     * it is snare removal, which carries a `crowdControl` scope. So the talent
     * is on the RULING side of this split and can no longer stand for the other.
     */
    const build = talentBuild('warrior', { iron_will: 5, sweeping_strikes: 1 });

    const ruled = build.unmodelled.filter((entry) => entry.scope !== undefined);
    const gaps = build.unmodelled.filter((entry) => entry.scope === undefined);

    expect(ruled.map((entry) => entry.talentId)).toEqual(['iron_will']);
    expect(ruled[0].scope).toBe('crowdControl');
    expect(gaps.map((entry) => entry.talentId)).toEqual(['sweeping_strikes']);
  });

  it('puts Improved Berserker Rage on the ruling side now that it is built', () => {
    /*
     * The talent this file used to hold up as the example of a live gap. Both
     * halves are asserted because only having both makes the point: the rage
     * ARRIVES as a bonus on the ability, and what is left unmodelled carries a
     * scope, so nothing about it is outstanding work.
     */
    const build = talentBuild('warrior', { improved_berserker_rage: 2 });

    expect(build.abilityBonuses.get('berserker_rage_cast')).toEqual({ rage: 10 });
    expect(build.unmodelled.map((entry) => entry.scope)).toEqual(['crowdControl']);
  });

  it('reports how much of the gap is a decision rather than work', () => {
    const reasons = everyReason();
    const ruled = reasons.filter((entry) => entry.scope !== undefined);

    /*
     * NOT AN EXACT COUNT, on purpose: a new class moves both numbers and this
     * test must not have to be edited for that. What it pins is the SHAPE of the
     * claim HANDOVER.md makes -- that a substantial minority of the 262 reasons
     * are rulings rather than gaps, so nobody reads the raw total as a work
     * queue again.
     */
    expect(reasons.length).toBeGreaterThan(200);
    expect(ruled.length).toBeGreaterThan(80);
    expect(ruled.length).toBeLessThan(reasons.length);
  });
});
