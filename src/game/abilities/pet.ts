import type { Ability } from '../../engine';
import { dealDamage, seconds } from '../../engine';

/**
 * Pet abilities, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * ----------------------------------------------------------------------------
 * GATED BY FAMILY, and the spellbook states it per spell: Claw reads "Pet:
 * Bear, Bird of Prey, Carrion Bird, Cat, Crab, Raptor, Scorpid" and Bite reads
 * "Pet: every family". So `families` is carried on the ability and read by
 * `abilitiesForFamily`, which keeps one source for the gating rather than a
 * second table that has to agree with the first.
 *
 * FOCUS, NOT MANA. A pet's pool is 100 and regenerates 10 a second on the
 * Forever Hunter wiki's figure -- roughly double Classic's -- which is enough
 * for a Claw every few seconds and not enough to ignore.
 *
 * THE WIKI CONFIRMS THESE ARE UNCHANGED: "Bite, Claw, Growl, Cower, Dash,
 * Dive, Charge, Lightning Breath, Scorpid Poison, Prowl, Shell Shield,
 * Thunderstomp Ranks 1-3, and passive abilities remain unchanged." So the
 * spellbook's numbers are Forever's numbers and Classic's at once.
 * ----------------------------------------------------------------------------
 */

/** The midpoint of a stated range. The combat table supplies the spread. */
const midpoint = (low: number, high: number) => (low + high) / 2;

const MAIN_HAND = 'mainHand' as const;
const PHYSICAL = 'physical' as const;

/** An ability restricted to some families. Absent means every family. */
type PetAbility = Ability & { readonly families?: readonly string[] };

export const CLAW_DAMAGE = midpoint(43, 59);

export const CLAW: PetAbility = {
  id: 'pet_claw',
  name: 'Claw',
  cost: { resource: 'focus', amount: 25 },
  attackTable: 'melee-special',
  families: ['Bear', 'Bird of Prey', 'Carrion Bird', 'Cat', 'Crab', 'Raptor', 'Scorpid'],
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: CLAW_DAMAGE,
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

export const BITE_DAMAGE = midpoint(81, 99);

export const BITE: PetAbility = {
  id: 'pet_bite',
  name: 'Bite',
  cost: { resource: 'focus', amount: 35 },
  cooldownMs: seconds(10),
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: BITE_DAMAGE,
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

/**
 * Growl, the pet's taunt.
 *
 * IN THE BOOK AND NOT IN THE LIST. It generates threat and the engine does not
 * track threat, so casting it would spend 15 focus a Claw could have used. It
 * is declared so a family's ability set is honest about what the pet knows.
 */
export const GROWL: PetAbility = {
  id: 'pet_growl',
  name: 'Growl',
  cost: { resource: 'focus', amount: 15 },
  cooldownMs: seconds(5),
  requiresTarget: false,
  onCast: () => {},
  unmodelled: 'Threat, which the engine does not track.',
};

export const PET_ABILITIES: readonly PetAbility[] = [CLAW, BITE, GROWL];
