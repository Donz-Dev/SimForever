import { describe, expect, it } from 'vitest';
import type { AttackChances, AuraDefinition, Reaction } from '../../src/engine';
import { NO_CHANCES, dealDamage, seconds } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ==============================================================================
 * A BLOCK IS AN OUTCOME A REACTION CAN SEE, AND FOUR PLACES IN THIS PROJECT SAID
 * IT WAS NOT.
 *
 * CLAUDE.md carried it as design, `Reaction.outcomes` carried it as a note on
 * the type, `game/reactions/paladinTalents.ts` opened with it, and the Paladin
 * deep-dive brief listed it as the class's largest shape of partly-modelled
 * talent. The true half of the rule is that a block is not AVOIDED and that its
 * reduction is flat rather than a multiplier. The false half was that
 * `melee-received` cannot produce `block` -- it has produced it since the table
 * was written, and the Warrior's Shield Specialization, Revenge, Enrage and
 * Blood Craze have all keyed on it and all fired.
 *
 * This file is the test that says so, so the claim cannot come back.
 *
 * AND ONE REAL ORDERING BUG CAME OUT OF THE SAME CLAUSE: a block's CHARGE was
 * spent before the reactions ran, so the last charge of a four-charge aura was
 * gone before its own reaction could see the block that spent it. Holy Shield
 * would have been worth three quarters of itself, silently.
 * ==============================================================================
 */

/* 100% block, so every swing at the defender is blocked and nothing is rolled
 * for twice. Scripted certainty rather than sampling: a count is the subject. */
const ALWAYS_BLOCKS: AttackChances = { ...NO_CHANCES, block: 10_000 };

function fight(reaction: Reaction, aura?: AuraDefinition) {
  const boss = makeAttacker({ id: 'boss', name: 'Boss', autoAttack: 'none' });
  const player = makeTarget({
    id: 'player',
    name: 'Player',
    kind: 'player',
    faction: 'friendly',
    maxHealth: 1_000_000,
    stats: { blockValue: 10 },
    reactions: [reaction],
  });
  const simulation = buildSimulation([boss, player], {
    attackChances: () => ALWAYS_BLOCKS,
  });
  if (aura) simulation.applyAura(player, aura, player.id);

  /** One blow from the boss, resolved on the attacks-received table. */
  const swing = (at: number) => {
    simulation.advanceTo(at);
    dealDamage(simulation, {
      source: boss,
      target: player,
      abilityName: 'Boss swing',
      school: 'physical',
      baseAmount: 500,
      attackTable: 'melee-received',
      appliesArmor: false,
    });
  };

  return { simulation, player, swing };
}

describe('a reaction that fires on a block', () => {
  it('fires, which is the whole of the claim that said it could not', () => {
    let fired = 0;
    const { swing } = fight({
      id: 'on_block',
      on: 'taken',
      outcomes: ['block'],
      onTrigger: () => {
        fired += 1;
      },
    });

    swing(seconds(1));
    swing(seconds(2));
    expect(fired).toBe(2);
  });

  it('is offered the block as its outcome, not as a hit', () => {
    const outcomes: string[] = [];
    const { swing } = fight({
      id: 'watch',
      on: 'taken',
      outcomes: ['hit', 'crit', 'glance', 'crush', 'block'],
      onTrigger: (_context, _actor, attack) => {
        outcomes.push(attack.outcome);
      },
    });

    swing(seconds(1));
    expect(outcomes).toEqual(['block']);
  });

  it('sees a blow that LANDED: a blocked attack still carries damage', () => {
    let amount = -1;
    const { swing } = fight({
      id: 'amount',
      on: 'taken',
      outcomes: ['block'],
      onTrigger: (_context, _actor, attack) => {
        amount = attack.amount;
      },
    });

    swing(seconds(1));
    // 500 raw, less the flat block value of 10. Flat, not a fraction -- that
    // flatness is the character of the stat and is the TRUE half of the rule.
    expect(amount).toBe(490);
  });
});

describe('a charge spent by a block', () => {
  /*
   * FOUR CHARGES, FOUR PAYOUTS. The aura is consumed by blocks and its reaction
   * asks whether it is still up, which is exactly Holy Shield's shape.
   */
  const FOUR_CHARGES: AuraDefinition = {
    id: 'four_blocks',
    name: 'Four blocks',
    durationMs: seconds(60),
    chargesOnApply: 4,
    consumedByBlock: true,
  };

  it('pays out on the LAST charge as well as the first three', () => {
    let fired = 0;
    const { player, swing } = fight(
      {
        id: 'while_up',
        on: 'taken',
        outcomes: ['block'],
        canTrigger: (_context, actor) => actor.auras.has('four_blocks'),
        onTrigger: () => {
          fired += 1;
        },
      },
      FOUR_CHARGES,
    );

    for (let i = 1; i <= 4; i += 1) swing(seconds(i));

    /*
     * FOUR, AND IT WAS THREE. `consumeBlockCharges` used to run before the
     * reactions, so the fourth block removed the aura and then asked whether it
     * was up. Nothing errored and the ability was simply worth 75% of itself.
     */
    expect(fired).toBe(4);
    expect(player.auras.has('four_blocks')).toBe(false);
  });

  it('stops paying out once the charges are gone', () => {
    let fired = 0;
    const { swing } = fight(
      {
        id: 'while_up',
        on: 'taken',
        outcomes: ['block'],
        canTrigger: (_context, actor) => actor.auras.has('four_blocks'),
        onTrigger: () => {
          fired += 1;
        },
      },
      FOUR_CHARGES,
    );

    for (let i = 1; i <= 8; i += 1) swing(seconds(i));
    expect(fired).toBe(4);
  });

  it('still spends one charge per block, no more', () => {
    const { player, swing } = fight(
      { id: 'noop', on: 'taken', outcomes: ['block'], onTrigger: () => {} },
      FOUR_CHARGES,
    );

    swing(seconds(1));
    expect(player.auras.get('four_blocks')?.stacks).toBe(3);
    swing(seconds(2));
    expect(player.auras.get('four_blocks')?.stacks).toBe(2);
  });
});

describe('an absorb shield re-applied', () => {
  /*
   * SEAL OF FURY GRANTS ONE ON EVERY SWING, so a refresh that left the old pool
   * alone would cap the shield at one swing's worth for its whole thirty
   * seconds -- a working-looking shield worth a fraction of itself.
   */
  const SHIELD: AuraDefinition = {
    id: 'small_shield',
    name: 'Small shield',
    durationMs: seconds(30),
    refreshBehaviour: 'reset',
    absorb: () => 100,
  };

  it('starts a new pool rather than keeping the drawn-down one', () => {
    const boss = makeAttacker({ id: 'boss', autoAttack: 'none' });
    const player = makeTarget({
      id: 'player',
      kind: 'player',
      faction: 'friendly',
      maxHealth: 1_000_000,
    });
    const simulation = buildSimulation([boss, player]);

    simulation.applyAura(player, SHIELD, player.id);
    expect(player.auras.absorbAvailable()).toBe(100);

    player.auras.consumeAbsorb(simulation, 60);
    expect(player.auras.absorbAvailable()).toBe(40);

    simulation.advanceTo(seconds(2));
    simulation.applyAura(player, SHIELD, player.id);
    expect(player.auras.absorbAvailable()).toBe(100);
  });

  it('is removed the moment it is fully spent, which is how "fully absorbed" is known', () => {
    let expired = 0;
    let remainingAtExpiry = -1;
    const boss = makeAttacker({ id: 'boss', autoAttack: 'none' });
    const player = makeTarget({
      id: 'player',
      kind: 'player',
      faction: 'friendly',
      maxHealth: 1_000_000,
    });
    const simulation = buildSimulation([boss, player]);

    simulation.applyAura(
      player,
      {
        ...SHIELD,
        onExpire: (_context, aura) => {
          expired += 1;
          remainingAtExpiry = aura.absorbRemaining;
        },
      },
      player.id,
    );

    player.auras.consumeAbsorb(simulation, 100);

    /*
     * ZERO LEFT is what tells a spent shield from one that ran out of TIME, and
     * it is the whole of Improved Seal of Fury's "when the shield is fully
     * absorbed" -- no engine hook was needed for it.
     */
    expect(expired).toBe(1);
    expect(remainingAtExpiry).toBe(0);
    expect(player.auras.has('small_shield')).toBe(false);
  });
});
