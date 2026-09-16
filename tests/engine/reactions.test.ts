import { describe, expect, it } from 'vitest';
import type { AttackEvent, AuraDefinition, Reaction } from '../../src/engine';
import {
  NO_CHANCES,
  ROLL_MAX,
  dealDamage,
  seconds,
} from '../../src/engine';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { buildSimulation } from '../helpers/buildSimulation';

/**
 * Reactions are how content responds to an attack result without the engine
 * knowing what the response means.
 *
 * Every case below drives the outcome with scripted chances rather than
 * sampling, so "fires on a dodge" is tested against an actual dodge instead of
 * against a dodge that probably happened somewhere in a long fight.
 */

/** Chances that force exactly one outcome on a single-roll melee table. */
function always(outcome: 'dodge' | 'parry' | 'miss' | 'crit') {
  return () => ({ ...NO_CHANCES, [outcome]: ROLL_MAX });
}

const MARK: AuraDefinition = {
  id: 'mark',
  name: 'Mark',
  durationMs: seconds(5),
};

/** Records what it saw, so a test can assert on the event as well as the count. */
function recorder(overrides: Partial<Reaction> = {}) {
  const seen: AttackEvent[] = [];
  const reaction: Reaction = {
    id: 'recorder',
    on: 'dealt',
    outcomes: ['dodge'],
    onTrigger: (_context, _actor, attack) => {
      seen.push(attack);
    },
    ...overrides,
  };
  return { reaction, seen };
}

/** Swing once with a fixed outcome and return what the reactions recorded. */
function swingOnce(
  attackerReactions: readonly Reaction[],
  defenderReactions: readonly Reaction[],
  chances: ReturnType<typeof always>,
) {
  const attacker = makeAttacker({ stats: { attackPower: 0 }, reactions: attackerReactions });
  const defender = makeTarget({ reactions: defenderReactions });
  const simulation = buildSimulation([attacker, defender], { attackChances: chances });
  simulation.begin();

  dealDamage(simulation, {
    source: attacker,
    target: defender,
    abilityName: 'Swing',
    school: 'physical',
    baseAmount: 100,
    attackTable: 'melee-auto',
  });

  return { attacker, defender, simulation };
}

describe('reaction dispatch', () => {
  it('fires on the declared outcome', () => {
    const { reaction, seen } = recorder();
    swingOnce([reaction], [], always('dodge'));

    expect(seen).toHaveLength(1);
    expect(seen[0].outcome).toBe('dodge');
  });

  it('ignores an outcome it did not declare', () => {
    const { reaction, seen } = recorder();
    swingOnce([reaction], [], always('parry'));

    expect(seen).toHaveLength(0);
  });

  it('gives the attacker `dealt` and the defender `taken`', () => {
    const dealt = recorder({ id: 'dealt', on: 'dealt' });
    const taken = recorder({ id: 'taken', on: 'taken' });

    swingOnce([dealt.reaction, taken.reaction], [taken.reaction, dealt.reaction], always('dodge'));

    // The attacker only runs its `dealt` entry; the defender only its `taken`.
    expect(dealt.seen).toHaveLength(1);
    expect(taken.seen).toHaveLength(1);
  });

  it('describes the attack it is reacting to', () => {
    const { reaction, seen } = recorder({ outcomes: ['crit'] });
    const attacker = makeAttacker({ stats: { attackPower: 0 }, reactions: [reaction] });
    const defender = makeTarget();
    const simulation = buildSimulation([attacker, defender], {
      attackChances: () => ({ ...NO_CHANCES, crit: ROLL_MAX, critMultiplier: 2 }),
    });
    simulation.begin();

    dealDamage(simulation, {
      source: attacker,
      target: defender,
      abilityId: 'mortal_strike',
      abilityName: 'Mortal Strike',
      school: 'physical',
      baseAmount: 100,
      attackTable: 'melee-special',
      weaponSlot: 'mainHand',
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      attacker,
      defender,
      abilityId: 'mortal_strike',
      abilityName: 'Mortal Strike',
      outcome: 'crit',
      critical: true,
      weaponSlot: 'mainHand',
    });
    expect(seen[0].amount).toBeGreaterThan(0);
  });

  it('respects an extra canTrigger condition', () => {
    const { reaction, seen } = recorder({ canTrigger: () => false });
    swingOnce([reaction], [], always('dodge'));

    expect(seen).toHaveLength(0);
  });

  it('applies an aura that an ability can then read', () => {
    const reaction: Reaction = {
      id: 'mark_on_dodge',
      on: 'dealt',
      outcomes: ['dodge'],
      onTrigger: (context, actor) => {
        context.applyAura(actor, MARK, actor.id);
      },
    };
    const { attacker, simulation } = swingOnce([reaction], [], always('dodge'));

    expect(attacker.auras.remainingMs(MARK.id, simulation.clock.now())).toBe(seconds(5));
  });
});

describe('what does not trigger a reaction', () => {
  it('ignores damage that consulted no attack table', () => {
    // A bleed tick has no outcome to react to. Its `outcome` defaults to 'hit',
    // which would otherwise fire anything watching for a hit.
    const { reaction, seen } = recorder({ outcomes: ['hit'] });
    const attacker = makeAttacker({ stats: { attackPower: 0 }, reactions: [reaction] });
    const defender = makeTarget();
    const simulation = buildSimulation([attacker, defender]);
    simulation.begin();

    dealDamage(simulation, {
      source: attacker,
      target: defender,
      abilityName: 'Bleed',
      school: 'physical',
      baseAmount: 10,
      // No attackTable at all.
    });

    expect(seen).toHaveLength(0);
  });

  it('ignores periodic ticks', () => {
    const { reaction, seen } = recorder({ outcomes: ['hit'] });
    const attacker = makeAttacker({ stats: { attackPower: 0 }, reactions: [reaction] });
    const defender = makeTarget();
    const simulation = buildSimulation([attacker, defender], { attackChances: () => NO_CHANCES });
    simulation.begin();

    dealDamage(simulation, {
      source: attacker,
      target: defender,
      abilityName: 'Rend',
      school: 'physical',
      baseAmount: 10,
      attackTable: 'melee-special',
      periodic: true,
    });

    expect(seen).toHaveLength(0);
  });

  it('does not recurse when a reaction deals damage of its own', () => {
    // Without the re-entrancy guard this is an infinite loop: the reaction
    // fires on a dodge, deals damage that is itself dodged, and fires again.
    let triggered = 0;
    const reaction: Reaction = {
      id: 'riposte',
      on: 'dealt',
      outcomes: ['dodge'],
      onTrigger: (context, actor, attack) => {
        triggered++;
        dealDamage(context, {
          source: actor,
          target: attack.defender,
          abilityName: 'Riposte',
          school: 'physical',
          baseAmount: 10,
          attackTable: 'melee-auto',
        });
      },
    };

    swingOnce([reaction], [], always('dodge'));

    expect(triggered).toBe(1);
  });
});
