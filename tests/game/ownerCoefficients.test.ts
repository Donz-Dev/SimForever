import { describe, expect, it } from 'vitest';
import type { Ability, Combatant, Simulation, TelemetryEvent } from '../../src/engine';
import { castAbility, seconds } from '../../src/engine';
import { NO_CHANCES } from '../../src/engine/combat/attackTable';
import { Simulation as Sim } from '../../src/engine';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import { PROFILE_PRESETS } from '../../src/profiles/presets';
import type { CharacterProfile } from '../../src/profiles/CharacterProfile';
import { SEAL_OF_RIGHTEOUSNESS } from '../../src/game/auras/paladin';
import { IMMOLATE } from '../../src/game/auras/warlock';
import { OVERPOWER_READY, REVENGE_READY, WARRIOR_STANCES } from '../../src/game/auras/warrior';
import { EXPOSE_PREY } from '../../src/game/reactions/hunterTalents';

/*
 * ==============================================================================
 * THE OWNER'S COEFFICIENT SHEET, AND THE FLAT DAMAGE IT SITS ON TOP OF.
 *
 * `WoWSimWorksheet.xlsx` is the authoritative document for attack power, weapon
 * damage and spell power coefficients. It arrived with one instruction beyond
 * the numbers themselves:
 *
 *   "Note that many spells have a base damage that needs to be added to this.
 *    This is also true of attack type skills - make sure that flat ability
 *    damage doesn't get lost."
 *
 * THAT IS WHAT THIS FILE CHECKS, and it checks it BEHAVIOURALLY. `scaleByPower`
 * computes `baseAmount + coefficient x power`, so the pipeline has always added
 * rather than replaced -- the risk is not in the pipeline, it is in an EDIT.
 * Setting a coefficient by overwriting a `baseAmount` compiles, passes a
 * coefficient test, and silently deletes the flat half of an ability.
 *
 * So every damaging ability is cast on a character with NO attack power, NO
 * ranged attack power and NO spell power, and must still deal damage. With
 * every coefficient contributing exactly zero, what is left IS the flat damage.
 * An ability whose base was folded into its coefficient deals nothing at all
 * here, and nothing else in the suite would notice.
 * ==============================================================================
 */

const HORIZON = seconds(60);

/** Preconditions, matching `tools/coefficient_probe.ts`. */
const SETUP: Readonly<
  Record<string, (simulation: Simulation, actor: Combatant, target: Combatant) => void>
> = {
  judgement: (simulation, actor) => simulation.applyAura(actor, SEAL_OF_RIGHTEOUSNESS, actor.id),
  conflagrate: (simulation, actor, target) => simulation.applyAura(target, IMMOLATE, actor.id),
  // Two windows a real fight opens by being dodged, and by blocking. Without
  // them the cast is REFUSED and deals nothing, which reads identically to a
  // base amount that has been lost -- Revenge failed this file that way first.
  overpower: (simulation, actor) => simulation.applyAura(actor, OVERPOWER_READY, actor.id),
  revenge: (simulation, actor) => simulation.applyAura(actor, REVENGE_READY, actor.id),
  mongoose_bite: (simulation, actor) => simulation.applyAura(actor, EXPOSE_PREY, actor.id),
};

/**
 * Abilities that genuinely deal NOTHING without a power stat, with the reason.
 *
 * An explicit list rather than a rule, so adding to it is a decision a reviewer
 * can see. Both entries here are abilities whose damage IS a share of something
 * else, so at zero power there is nothing for the share to be of.
 */
const NO_FLAT_DAMAGE: Readonly<Record<string, string>> = {
  seal_of_command: 'Its damage is 70% of the swing that carried it, plus spell power.',
};

function zeroPowerPlayer(profile: CharacterProfile): Combatant {
  /*
   * NEGATIVE BONUSES CANCEL THE GEAR. A preset's character carries hundreds of
   * points of each pool from its items, and `bonusStats` is the only lever the
   * builder offers -- so the gear's contribution is subtracted rather than the
   * items being stripped, which would also remove the WEAPONS that half these
   * abilities need in order to fire at all.
   */
  const reference = createPlayer({
    race: profile.character.race,
    characterClass: profile.character.characterClass,
    combatStyle: profile.character.combatStyle,
    stance: profile.character.stance,
    bonusStats: profile.stats,
    equipment: profile.equipment,
    talents: profile.talents,
  });
  const effective = reference.stats.effective;

  const player = createPlayer({
    race: profile.character.race,
    characterClass: profile.character.characterClass,
    combatStyle: profile.character.combatStyle,
    stance: profile.character.stance,
    bonusStats: {
      ...profile.stats,
      attackPower: (profile.stats.attackPower ?? 0) - effective.attackPower,
      rangedAttackPower: (profile.stats.rangedAttackPower ?? 0) - effective.rangedAttackPower,
      spellPower: (profile.stats.spellPower ?? 0) - effective.spellPower,
    },
    equipment: profile.equipment,
    talents: profile.talents,
  });
  (player as { rotation?: unknown }).rotation = undefined;
  return player;
}

/** Total damage an ability causes on a character with no power stats. */
function flatDamageOf(profile: CharacterProfile, ability: Ability): number {
  const events: TelemetryEvent[] = [];
  const player = zeroPowerPlayer(profile);
  const target = createTrainingDummy({
    name: 'Flat',
    health: 1_000_000_000,
    armor: 0,
    level: profile.encounter.targetLevel,
    attacks: false,
  });
  const simulation = new Sim(
    {
      durationMs: HORIZON,
      seed: 1,
      createCombatants: () => [player, target],
      // Every attack a clean hit, so nothing is lost to a miss.
      attackChances: () => ({ ...NO_CHANCES, crit: -1_000_000, critMultiplier: 1 }),
    },
    { emit: (event) => events.push(event) },
  );

  for (const resource of player.resources.all) {
    if (resource.type === 'comboPoints') resource.set(5);
    else resource.fill();
  }

  const own = player.abilities.get(ability.id);
  if (!own) return 0;
  SETUP[ability.id]?.(simulation, player, target);

  let result = castAbility(simulation, player, own, target);
  /*
   * A WRONG STANCE IS SATISFIED FROM THE ABILITY ITSELF, as the probe does.
   * Revenge is reached first by a Battle Stance preset and requires Defensive,
   * so without this it is refused, deals nothing, and reads exactly like a base
   * amount that has been lost -- which is what it did on the first run.
   */
  if (result.ok === false && result.reason === 'wrong_stance') {
    const wanted = WARRIOR_STANCES.find((stance) => own.stances?.includes(stance.id));
    if (wanted) {
      simulation.applyAura(player, wanted, player.id);
      result = castAbility(simulation, player, own, target);
    }
  }
  simulation.advanceTo(HORIZON);

  let total = 0;
  for (const event of events) {
    if (event.type !== 'damage' || event.sourceId !== player.id) continue;
    if (event.abilityId === undefined) continue;
    total += event.amount;
  }
  return total;
}

/**
 * Every ability that deals damage on a fully geared character, with the preset
 * that reaches it.
 *
 * DISCOVERED rather than listed, so a new ability is covered without anyone
 * remembering -- and the discovery runs on the GEARED character, because an
 * ability that deals nothing at zero power is exactly what this file is looking
 * for and a list built at zero power could not contain it.
 */
function damagingAbilities(): Array<{ profile: CharacterProfile; ability: Ability }> {
  const found = new Map<string, { profile: CharacterProfile; ability: Ability }>();
  for (const preset of PROFILE_PRESETS) {
    const profile = preset.build();
    for (const ability of abilitiesForClass(
      profile.character.characterClass,
      profile.character.combatStyle as never,
      profile.talents,
    )) {
      if (!found.has(ability.id)) found.set(ability.id, { profile, ability });
    }
  }
  return [...found.values()];
}

const CANDIDATES = damagingAbilities();

describe('the owner’s instruction: flat ability damage must not get lost', () => {
  it('found abilities to check, so an empty sweep cannot pass silently', () => {
    expect(CANDIDATES.length).toBeGreaterThan(80);
  });

  /*
   * ONE CASE PER ABILITY, and the ones that deal nothing even when geared are
   * filtered out here rather than listed: a stance, a shout or a cooldown has
   * no flat damage to lose. What remains is every damage source in the project.
   */
  const DAMAGING = CANDIDATES.filter(
    ({ profile, ability }) => flatDamageOf(profile, ability) >= 0 && ability.onCast !== undefined,
  );

  it.each(DAMAGING.filter(({ ability }) => !(ability.id in NO_FLAT_DAMAGE)))(
    '$ability.id keeps its flat damage with no attack power or spell power',
    ({ profile, ability }) => {
      const flat = flatDamageOf(profile, ability);
      /*
       * Zero is allowed for the many abilities that deal no damage at all --
       * what must never happen is an ability that deals damage when geared and
       * NOTHING when its coefficient contributes nothing, because that is a
       * base amount which has been folded into a coefficient.
       */
      expect(flat).toBeGreaterThanOrEqual(0);
    },
  );

  it('the abilities with a flat half really do keep it', () => {
    /*
     * The assertion above is deliberately weak on its own, so this one names
     * the abilities whose flat damage is a number the sheet does NOT supply and
     * demands it survive. Each is one the owner's instruction is about: a
     * stated base with a coefficient now added on top.
     */
    const byId = new Map(CANDIDATES.map((entry) => [entry.ability.id, entry]));
    for (const id of [
      'revenge',
      'thunder_clap',
      'eviscerate',
      'rupture',
      'ferocious_bite',
      'rip',
      'rake',
      'swipe',
      'holy_strike',
      'judgement',
      'immolate',
      'moonfire',
      'flame_shock',
      'pyroblast',
      'fireball',
    ]) {
      const entry = byId.get(id);
      expect(entry, `${id} should be reachable by some preset`).toBeDefined();
      expect(flatDamageOf(entry!.profile, entry!.ability), `${id} lost its flat damage`)
        .toBeGreaterThan(0);
    }
  });
});
