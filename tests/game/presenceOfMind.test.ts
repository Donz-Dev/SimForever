import { describe, expect, it } from 'vitest';
import type { Ability, Combatant } from '../../src/engine';
import { resolveCast, seconds } from '../../src/engine';
import { spreadsEffectAcrossCast } from '../../src/engine/abilities/channelled';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { CLEARCASTING, PRESENCE_OF_MIND } from '../../src/game/auras/mage';
import { ARCANE_MISSILES, EVOCATION, MAGE_ABILITIES } from '../../src/game/abilities/mage';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { characterAtCombatStart } from '../../src/simulator';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeTarget } from '../helpers/actors';
import { legalise } from '../helpers/legalTalents';

/*
 * ==============================================================================
 * PRESENCE OF MIND IS A RULE, NOT A LIST, AND THE LIST IS WHY IT WAS BUGGED.
 *
 * The ruleset owner: "Presence of Mind is bugged for at least Arcane Wrath. It's
 * not actually making it instant cast. Presence of Mind should make the next
 * non-channeled, non-instant spell an instant cast."
 *
 * IT NAMED SEVEN SPELLS BY HAND. Arcane Wrath arrived at client build
 * 1.60.1.70425 as a 3.5-second cast, nobody added it, and the aura took the
 * charge and reported its uptime while the Mage cast the full 3.5 seconds.
 *
 * AND THE LIST WAS WRONG THE OTHER WAY TOO: it named ARCANE MISSILES, a
 * channel. Zeroing a channel's cast delivers one tick of five and reports a
 * successful cast.
 *
 * SO WHAT IS ASSERTED HERE IS THE OWNER'S TWO CLAUSES AND A STRUCTURAL GUARD
 * over the whole book -- because the previous test on this aura checked
 * PYROBLAST and its own comment named the hazard it was not covering: "a NAMED
 * LIST, so a spell absent from it takes the full cast with every condition
 * reading true."
 * ==============================================================================
 */

/** A Mage that has taken Arcane Wrath, Presence of Mind and Clearcasting. */
const mageWithWrath = (): Combatant =>
  createPlayer({
    race: 'gnome',
    characterClass: 'mage',
    combatStyle: 'caster',
    /*
     * ICE LANCE AND BLAST WAVE ARE TALENT-GRANTED and are asked about below,
     * so they are taken here. Without them `mage.abilities.get` returns
     * undefined and an assertion about their cost says nothing.
     */
    talents: legalise(
      {
        arcane_wrath: 1,
        presence_of_mind: 1,
        arcane_concentration: 5,
        ice_lance: 1,
        blast_wave: 1,
      },
      'mage',
    ),
  });

/** Cast time and cost for one ability, with the given auras up. */
function resolved(
  mage: Combatant,
  auraDefinitions: readonly (typeof PRESENCE_OF_MIND)[],
  abilityId: string,
): { castMs: number; cost: number } {
  const simulation = buildSimulation([mage, makeTarget()]);
  simulation.begin();
  for (const aura of auraDefinitions) simulation.applyAura(mage, aura, mage.id);
  /*
   * THROWS ON AN ABILITY THE BUILD LACKS rather than returning undefined,
   * which is how the Clearcasting row below first passed vacuously: Ice Lance
   * and Blast Wave are TALENT-GRANTED, this fixture does not take them, and
   * `.cost ?? 0` read "not in the book" as "costs nothing".
   */
  const ability = mage.abilities.get(abilityId);
  if (!ability) throw new Error(`this Mage has no ${abilityId}`);
  const cast = resolveCast(mage, ability);
  return { castMs: cast.baseCastTimeMs, cost: cast.costAmount };
}

describe('Presence of Mind', () => {
  it('makes ARCANE WRATH instant, which is the bug as reported', () => {
    const mage = mageWithWrath();
    expect(mage.abilities.get('arcane_wrath')).toBeDefined();
    expect(resolved(mage, [], 'arcane_wrath').castMs).toBe(seconds(3.5));
    expect(resolved(mageWithWrath(), [PRESENCE_OF_MIND], 'arcane_wrath').castMs).toBe(0);
  });

  it('still makes the spells it always did instant', () => {
    for (const id of ['fireball', 'frostbolt', 'frostfire_bolt', 'scorch']) {
      const before = resolved(mageWithWrath(), [], id).castMs;
      expect(before, id).toBeGreaterThan(0);
      expect(resolved(mageWithWrath(), [PRESENCE_OF_MIND], id).castMs, id).toBe(0);
    }
  });

  /*
   * ==========================================================================
   * "NON-CHANNELED" IS THE CLAUSE THAT WAS MISSING, and `requiresCastTime` is
   * the near miss: a channel HAS a cast time and satisfies it gladly.
   * ==========================================================================
   */
  it('does NOT touch Arcane Missiles, which is a channel', () => {
    const before = resolved(mageWithWrath(), [], 'arcane_missiles').castMs;
    expect(before).toBe(seconds(5));
    expect(resolved(mageWithWrath(), [PRESENCE_OF_MIND], 'arcane_missiles').castMs).toBe(before);
  });

  it('does NOT touch Evocation, which is a channel with NO channelTicks', () => {
    /*
     * THE CASE THAT SHAPED THE PREDICATE. Evocation's effect is a RATE, so it
     * declares no ticks -- and made instant its `onCastStart` window would open
     * and close in the same millisecond, spending an eight-minute cooldown for
     * no mana and logging a successful cast.
     */
    expect(EVOCATION.channelTicks).toBeUndefined();
    const before = resolved(mageWithWrath(), [], 'evocation').castMs;
    expect(before).toBe(seconds(8));
    expect(resolved(mageWithWrath(), [PRESENCE_OF_MIND], 'evocation').castMs).toBe(before);
  });

  it('is not spent by an instant', () => {
    const mage = mageWithWrath();
    const simulation = buildSimulation([mage, makeTarget()]);
    simulation.begin();
    simulation.applyAura(mage, PRESENCE_OF_MIND, mage.id);
    const fireBlast = mage.abilities.get('fire_blast')!;
    expect(fireBlast.castTimeMs ?? 0).toBe(0);
    expect(resolveCast(mage, fireBlast).modified).toBe(false);
  });

  /*
   * ==========================================================================
   * THE STRUCTURAL GUARD THAT REPLACES THE HAND-WRITTEN LIST.
   *
   * Two claims, over every DECLARED Mage ability rather than over the handful a
   * preset happens to carry: every cast-time ability is either made instant or
   * is a channel, and nothing instant is touched. A spell added later is
   * covered the day it lands -- which is exactly what Arcane Wrath was not.
   * ==========================================================================
   */
  it('reaches every non-channeled cast in the whole Mage book', () => {
    const mage = mageWithWrath();
    const simulation = buildSimulation([mage, makeTarget()]);
    simulation.begin();
    simulation.applyAura(mage, PRESENCE_OF_MIND, mage.id);

    const seen: string[] = [];
    for (const declared of MAGE_ABILITIES) {
      const ability: Ability | undefined = mage.abilities.get(declared.id);
      if (!ability) continue;
      const cast = ability.castTimeMs ?? 0;
      const after = resolveCast(mage, ability).baseCastTimeMs;
      if (cast <= 0) {
        expect(after, `${ability.id} is an instant`).toBe(cast);
        continue;
      }
      if (spreadsEffectAcrossCast(ability)) {
        expect(after, `${ability.id} is a channel`).toBe(cast);
        continue;
      }
      expect(after, `${ability.id} should be instant`).toBe(0);
      seen.push(ability.id);
    }
    // And it really did cover several spells, not zero.
    expect(seen.length).toBeGreaterThan(4);
    expect(seen).toContain('arcane_wrath');
  });

  /*
   * THE CATCH-ALL REACHES EVERY ABILITY, SO WHAT KEEPS IT HONEST IS THAT A
   * MAGE OWNS NO NON-SPELL WITH A CAST TIME. `Aura.ts` records that "every
   * ability" and "every SPELL" are different sets; these two clauses close the
   * gap for this class, and that is measured here rather than assumed -- over
   * the BUILT book, so racials and consumables are included.
   */
  it('finds no non-spell with a cast time in any built Mage book', () => {
    /*
     * READ LEY LINE IS A SPELL TOO (round 79): a High Order Skyborne's 2-second
     * racial cast. Presence of Mind making it instant is the game's own reading
     * of "your next non-instant spell", so it is allowed here by name.
     */
    const spells = new Set([...MAGE_ABILITIES.map((ability) => ability.id), 'read_ley_line']);
    for (const id of ['mage_arcane', 'mage_fire', 'mage_frostfire']) {
      const mage = characterAtCombatStart(PRESETS_BY_ID.get(id)!.build())!;
      for (const ability of mage.abilities.all) {
        if ((ability.castTimeMs ?? 0) <= 0) continue;
        expect(spells.has(ability.id), `${id}: ${ability.id} has a cast time`).toBe(true);
      }
    }
  });
});

describe('Clearcasting, which shared the same broken list', () => {
  it('makes ARCANE WRATH free, which the borrowed list could never do', () => {
    expect(resolved(mageWithWrath(), [], 'arcane_wrath').cost).toBe(395);
    expect(resolved(mageWithWrath(), [CLEARCASTING], 'arcane_wrath').cost).toBe(0);
  });

  it('still frees every damage spell it already did', () => {
    for (const id of ['fireball', 'fire_blast', 'ice_lance', 'blast_wave', 'arcane_missiles']) {
      const before = resolved(mageWithWrath(), [], id).cost ?? 0;
      expect(before, id).toBeGreaterThan(0);
      expect(resolved(mageWithWrath(), [CLEARCASTING], id).cost, id).toBe(0);
    }
  });

  it('is NOT spent on Mage Armor, which costs mana and rolls nothing', () => {
    /*
     * "YOUR NEXT DAMAGE SPELL". `requiresAttackTable` is the owner's definition
     * of offensive -- processed through a combat table -- and Mage Armor is the
     * one costed Mage ability that is not. A charge spent there is thrown away
     * and looks exactly like one that worked.
     */
    const armor = mageWithWrath().abilities.get('mage_armor')!;
    expect(armor.cost?.amount ?? 0).toBeGreaterThan(0);
    expect(armor.attackTable).toBeUndefined();
    expect(resolved(mageWithWrath(), [CLEARCASTING], 'mage_armor').cost).toBe(
      armor.cost!.amount,
    );
  });

  it('keeps touching a channel, because free is not the same as instant', () => {
    /*
     * The difference from its sibling, and deliberate: making a channel FREE is
     * coherent, where making it instant destroys it. So Clearcasting declares
     * no `excludesChannel` and Arcane Missiles stays in its reach.
     */
    expect(spreadsEffectAcrossCast(ARCANE_MISSILES)).toBe(true);
    expect(resolved(mageWithWrath(), [CLEARCASTING], 'arcane_missiles').cost).toBe(0);
  });
});

describe('spreadsEffectAcrossCast, the one shared answer', () => {
  it('catches both shapes of channel', () => {
    // A series of ticks.
    expect(spreadsEffectAcrossCast(ARCANE_MISSILES)).toBe(true);
    expect((ARCANE_MISSILES.channelTicks ?? 1) > 1).toBe(true);
    // A window that must last the cast, with no ticks to count.
    expect(spreadsEffectAcrossCast(EVOCATION)).toBe(true);
    expect((EVOCATION.channelTicks ?? 1) > 1).toBe(false);
  });

  it('calls an ordinary cast and an instant what they are', () => {
    const plain = MAGE_ABILITIES.find((ability) => ability.id === 'fireball')!;
    const instant = MAGE_ABILITIES.find((ability) => ability.id === 'fire_blast')!;
    expect(spreadsEffectAcrossCast(plain)).toBe(false);
    expect(spreadsEffectAcrossCast(instant)).toBe(false);
  });
});
