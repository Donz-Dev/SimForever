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
 */
const RULED_OUT_WORDING =
  /\bmovement\b|\bimmobilis|\bsnare|\bdaze|\bstun|\bfear\b|\bsilence|\bincapacitat|\bdisorient|\bdisarm|\bthreat\b|\btaunt\b|\bheals?\b|\bhealing\b|has a position|nothing (?:here )?moves|\btravel form\b|\bradius\b/i;

/**
 * Reasons that name a ruled-out concept IN PASSING while being inert for some
 * other, live reason. Each is here because the talent's real blocker is
 * something that can still expire, so scoping it would hide real work.
 *
 * Keep this list short and keep the justification on each entry. A long
 * allowlist is a broken test.
 */
const MENTIONS_BUT_IS_A_LIVE_GAP: Record<string, string> = {
  'warrior.improved_berserker_rage':
    'Inert because no priority list casts Berserker Rage -- a rotation decision, which can change. Its movement clause is incidental.',
  'shaman.water_shield':
    'MANA RETURN, which is explicitly in scope. Inert because neither profile is attacked and neither heals -- the target, not the ruling.',
  'paladin.divine_favor':
    'Two of its three spells are heals, but the Holy Shock clause needs a one-shot per-ability CRIT modifier, which is a live engine gap.',
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
    const known = new Set(everyReason().map((entry) => entry.id));
    const stale = Object.keys(MENTIONS_BUT_IS_A_LIVE_GAP).filter((id) => !known.has(id));

    // An allowlist entry for a talent that no longer reports itself unmodelled
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
     * Iron Will is a ruling (stun and fear duration). Improved Berserker Rage is a
     * live gap: no priority list casts the ability, which a rotation change could
     * fix. One allocation, both kinds, and the panel's own filter applied here.
     */
    const build = talentBuild('warrior', { iron_will: 5, improved_berserker_rage: 2 });

    const ruled = build.unmodelled.filter((entry) => entry.scope !== undefined);
    const gaps = build.unmodelled.filter((entry) => entry.scope === undefined);

    expect(ruled.map((entry) => entry.talentId)).toEqual(['iron_will']);
    expect(ruled[0].scope).toBe('crowdControl');
    expect(gaps.map((entry) => entry.talentId)).toEqual(['improved_berserker_rage']);
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
