/**
 * Seal of Righteousness and Seal of Fury per hit, for a list of weapons, at a
 * chosen spell power -- worked by hand from the formula AND measured off the
 * real reaction, so a disagreement between the two is visible.
 *
 *   npx vite-node tools/seal_table.ts
 *   SP=300 npx vite-node tools/seal_table.ts
 *
 * THE MEASURED COLUMN DRIVES THE SHIPPED REACTION through `dealDamage` against
 * a target with no armor and no vulnerabilities, on a character with no crit,
 * so the number that lands is the seal's whole base-plus-coefficient figure and
 * nothing else. A Retribution talent, a raid debuff or Judgement of the
 * Crusader would all move it, which is why none of them is present.
 */
import { Combatant, Simulation, seconds } from '../src/engine';
import type { AttackEvent } from '../src/engine';
import { sealOfFuryProc, sealOfRighteousnessProc } from '../src/game/reactions/paladin';
import {
  SEAL_OF_FURY,
  SEAL_OF_RIGHTEOUSNESS,
  sealOfRighteousnessBaseRow,
  sealOfRighteousnessHandMultiplier,
} from '../src/game/auras/paladin';
import {
  SEAL_OF_FURY_SP_COEFFICIENT,
  SEAL_OF_RIGHTEOUSNESS_SP_COEFFICIENT_ONE_HAND,
  SEAL_OF_RIGHTEOUSNESS_SP_COEFFICIENT_TWO_HAND,
} from '../src/game/combat/coefficients';
import { SEAL_OF_FURY_DAMAGE } from '../src/game/auras/paladin';

const SP = Number(process.env.SP ?? 500);
const WEAPONS = [
  { label: '1H 1.4', speed: 1.4, twoHanded: false },
  { label: '1H 2.6', speed: 2.6, twoHanded: false },
  { label: '2H 2.0', speed: 2.0, twoHanded: true },
  { label: '2H 3.6', speed: 3.6, twoHanded: true },
];

function measured(speed: number, twoHanded: boolean, seal: 'righteousness' | 'fury'): number {
  const actor = new Combatant({
    id: 'paladin',
    name: 'Paladin',
    kind: 'player',
    faction: 'friendly',
    maxHealth: 1000,
    autoAttack: 'none',
    stats: { spellPower: SP },
    weapons: {
      mainHand: { name: 'probe', twoHanded, swingTimerMs: speed * 1000, baseDamage: 100 },
    },
  });
  const target = new Combatant({
    id: 'target',
    name: 'Target',
    kind: 'enemy',
    faction: 'hostile',
    maxHealth: 1_000_000,
  });
  const simulation = new Simulation({
    durationMs: seconds(10),
    seed: 1,
    createCombatants: () => [actor, target],
  });
  simulation.begin();
  simulation.applyAura(actor, seal === 'fury' ? SEAL_OF_FURY : SEAL_OF_RIGHTEOUSNESS, actor.id);
  const reaction = seal === 'fury' ? sealOfFuryProc() : sealOfRighteousnessProc();
  const swing = {
    attacker: actor,
    defender: target,
    outcome: 'hit',
    abilityId: undefined,
    abilityName: 'Auto-Attack',
    attackTable: 'melee-auto',
    amount: 100,
    weaponSlot: 'mainHand',
    critical: false,
  } as unknown as AttackEvent;
  if (!reaction.canTrigger!(simulation, actor, swing)) throw new Error('the seal refused a swing');
  const before = target.health.current;
  reaction.onTrigger(simulation, actor, swing);
  simulation.advanceTo(1);
  return before - target.health.current;
}

console.log(`Spell power ${SP}\n`);
console.log('| weapon | SoR base row | x speed | x hand | flat | + SP | SoR hit | measured | Seal of Fury | measured |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const { label, speed, twoHanded } of WEAPONS) {
  const row = sealOfRighteousnessBaseRow(speed);
  const hand = sealOfRighteousnessHandMultiplier(speed, twoHanded);
  const flat = row * speed * hand;
  const coefficient = twoHanded
    ? SEAL_OF_RIGHTEOUSNESS_SP_COEFFICIENT_TWO_HAND
    : SEAL_OF_RIGHTEOUSNESS_SP_COEFFICIENT_ONE_HAND;
  const fromSp = coefficient * SP;
  const fury = SEAL_OF_FURY_DAMAGE + SEAL_OF_FURY_SP_COEFFICIENT * SP;
  console.log(
    `| ${label} | ${row.toFixed(2)} | ${(row * speed).toFixed(2)} | ${hand.toFixed(2)} | ${flat.toFixed(2)} | ` +
      `${fromSp.toFixed(2)} (${coefficient * 100}%) | **${(flat + fromSp).toFixed(2)}** | ` +
      `${measured(speed, twoHanded, 'righteousness').toFixed(2)} | **${fury.toFixed(2)}** | ` +
      `${measured(speed, twoHanded, 'fury').toFixed(2)} |`,
  );
}
