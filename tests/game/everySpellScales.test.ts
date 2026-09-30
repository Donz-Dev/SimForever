import { describe, expect, it } from 'vitest';
import type { Ability, Combatant, Simulation, TelemetryEvent } from '../../src/engine';
import { castAbility, seconds } from '../../src/engine';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { SEAL_OF_RIGHTEOUSNESS } from '../../src/game/auras/paladin';
import { IMMOLATE } from '../../src/game/auras/warlock';

/*
 * ------------------------------------------------------------------------------
 * EVERY SPELL SCALES WITH SPELL POWER, AND THIS IS THE STRUCTURAL CHECK.
 *
 * The coefficient is passed per `dealDamage` call rather than derived by the
 * pipeline, because the hybrid rule needs BOTH an ability's cast time and its
 * DoT's duration and those live in two different files. That is a declaration,
 * and CLAUDE.md is emphatic about what happens to declarations: the one that
 * forgets is SILENT. A spell with no coefficient deals exactly the damage its
 * source states and looks entirely normal -- which is how every caster in this
 * project read for months.
 *
 * SO THIS TEST IS BEHAVIOURAL, NOT DECLARATIVE. It casts each spell twice, on
 * two characters differing ONLY in spell power, and demands the damage differ.
 * Nothing about it can be satisfied by writing `powerCoefficient` somewhere; it
 * can only be satisfied by the number reaching the damage.
 *
 * AND THE LIST IS DISCOVERED FROM THE EVENT STREAM rather than filtered by
 * `attackTable`, which is the second version of this file. The first filtered
 * on `attackTable === 'spell'` and silently skipped every PURE DoT -- Shadow
 * Word: Pain, Corruption, Bane of Agony, Siphon Life, Devouring Plague and
 * Consecration -- because a spell that only applies an aura declares no table.
 * Those six are exactly the spells the periodic rule exists for, so the check
 * covered everything except the part most likely to be wrong.
 *
 * A NEW CLASS OR A NEW SPELL IS COVERED WITHOUT ANYONE REMEMBERING, which is
 * the same property `classRegistration.test.ts` has and the reason both exist.
 * ------------------------------------------------------------------------------
 */

const SPELL_POWER = 1000;

/**
 * Preconditions some spells need before they will do anything.
 *
 * Without these they deal ZERO in both runs and would pass the comparison by
 * being equally nothing twice -- which is why the assertion below also demands
 * the unpowered run deal real damage.
 */
const SETUP: Readonly<
  Record<string, (simulation: Simulation, actor: Combatant, target: Combatant) => void>
> = {
  // Judgement refuses to cast without a seal, and reads which one is up.
  judgement: (simulation, actor) =>
    simulation.applyAura(actor, SEAL_OF_RIGHTEOUSNESS, actor.id),
  // Conflagrate requires Immolate on the target and consumes it.
  conflagrate: (simulation, actor, target) =>
    simulation.applyAura(target, IMMOLATE, actor.id),
};

/**
 * Spells that legitimately do NOT scale through `powerCoefficient`, with the
 * reason each one is exempt.
 *
 * An explicit list rather than a rule, so adding to it is a decision somebody
 * makes on purpose and a reviewer can see.
 */
const EXEMPT: Readonly<Record<string, string>> = {
  /*
   * A HUNTER SHOT IS NOT A SPELL, even though it deals arcane or nature
   * damage. Forever REMOVED Arcane Shot's spell power coefficient and gave it
   * a ranged attack power one instead -- stated outright by the Hunter wiki
   * the ruleset owner named -- so reading spell power here would reinstate
   * something Forever deliberately took out.
   */
  arcane_shot: 'Forever replaced its spell power coefficient with a ranged AP one.',
  serpent_sting: 'A sting ticks NATURE but scales with ranged attack power.',
};

/*
 * ----------------------------------------------------------------------------
 * TWO MORE DO NOT SCALE AND ARE NOT LISTED ABOVE, because this test cannot
 * reach either one and an exemption it cannot check is worse than none.
 *
 *   Summon Hawk  the hawk's pecks are PHYSICAL, so they never appear in the
 *                magical total and the discovery step skips it outright.
 *   Ignite       an aura with no ability behind it, so it is never cast here.
 *                Its magnitude is a share of the crit that caused it and that
 *                hit was ALREADY scaled, so a coefficient would apply spell
 *                power twice to the same damage. The zero is asserted where it
 *                lives, in `mageAbilities.test.ts`.
 * ----------------------------------------------------------------------------
 */

/** Every ability any profile can cast, once each. */
function everyAbility(): readonly Ability[] {
  const seen = new Map<string, Ability>();
  for (const preset of PRESETS_BY_ID.values()) {
    const built = preset.build();
    for (const ability of abilitiesForClass(
      built.character.characterClass,
      built.character.combatStyle as never,
      built.talents,
    )) {
      if (!seen.has(ability.id)) seen.set(ability.id, ability);
    }
  }
  return [...seen.values()];
}

interface Measured {
  /** Total non-physical damage this ability caused, ticks included. */
  readonly magical: number;
  /** Total physical damage, so a melee ability can be told apart. */
  readonly physical: number;
}

/**
 * Cast one ability and total what it causes, INCLUDING what its
 * damage-over-time effect goes on to deal.
 *
 * The clock runs well past every DoT in the project, because a pure DoT spell
 * deals nothing at the instant it is cast -- measuring only the cast would
 * report Corruption and Shadow Word: Pain as unscaled when they are the two
 * spells the periodic rule exists for.
 */
function measure(ability: Ability, spellPower: number): Measured {
  const events: TelemetryEvent[] = [];
  const actor: Combatant = makeAttacker({
    autoAttack: 'none',
    abilities: [ability],
    // Attack power is held FIXED across both runs, so a physical ability
    // cannot move and be mistaken for a scaling spell.
    stats: { spellPower, attackPower: 500, intellect: 100 },
    resources: [
      { type: 'mana', maximum: 1_000_000 },
      { type: 'energy', maximum: 1000 },
      { type: 'rage', maximum: 1000 },
      { type: 'soulShards', maximum: 10 },
    ],
  });
  const target = makeTarget({ maxHealth: 100_000_000 });
  const simulation = buildSimulation([actor, target], { durationMs: seconds(120) }, {
    emit: (event) => events.push(event),
  });

  SETUP[ability.id]?.(simulation, actor, target);
  castAbility(simulation, actor, actor.abilities.get(ability.id)!, target);
  // Past the longest effect here -- Siphon Life at 30 seconds -- and every
  // channel.
  simulation.advanceTo(seconds(60));

  let magical = 0;
  let physical = 0;
  for (const event of events) {
    if (event.type !== 'damage' || event.sourceId !== actor.id) continue;
    if (event.school === 'physical') physical += event.amount;
    else magical += event.amount;
  }
  return { magical, physical };
}

/*
 * DISCOVERED, NOT DECLARED: anything that deals non-physical damage with no
 * spell power at all is a spell and must scale. A melee ability shows up as
 * physical and is skipped; a hybrid that does both is still a spell.
 */
const SPELLS = everyAbility()
  .map((ability) => ({ ability, base: measure(ability, 0) }))
  .filter(({ base }) => base.magical > 0);

describe('every damaging spell scales with spell power', () => {
  it('discovered the spells, so an empty list cannot pass silently', () => {
    /*
     * A discovery step that found nothing would make every assertion below
     * vacuous -- the failure mode this whole file exists to prevent, arriving
     * through the back door.
     */
    expect(SPELLS.length).toBeGreaterThan(25);

    // And the six that the first version of this test missed are in it.
    const found = SPELLS.map(({ ability }) => ability.id);
    for (const pureDot of [
      'shadow_word_pain',
      'devouring_plague',
      'corruption',
      'bane_of_agony',
      'siphon_life',
      'consecration',
    ]) {
      expect(found, `${pureDot} must be covered`).toContain(pureDot);
    }
  });

  it.each(SPELLS.filter(({ ability }) => !(ability.id in EXEMPT)))(
    '$ability.id deals more magical damage with 1000 spell power than with none',
    ({ ability, base }) => {
      const powered = measure(ability, SPELL_POWER);

      // Guards the comparison: zero in both runs would otherwise "pass".
      expect(base.magical, `${ability.id} dealt nothing unpowered`).toBeGreaterThan(0);
      expect(powered.magical, ability.id).toBeGreaterThan(base.magical);
    },
  );
});

describe('the spells that deliberately do not scale', () => {
  it.each(Object.entries(EXEMPT))('%s: %s', (id) => {
    /*
     * The exemption list must not rot into a set of typos that exempt nothing.
     * Each entry has to name something that really deals magical damage --
     * otherwise a misspelled id would silently stop covering a real spell.
     */
    expect(
      SPELLS.some(({ ability }) => ability.id === id),
      `${id} is exempt but no longer deals magical damage`,
    ).toBe(true);
  });
});
