/*
 * ============================================================================
 * THE COEFFICIENT PROBE.
 *
 * Measures, for every ability every one of the 23 presets can reach, how much
 * its damage moves when ONE stat axis moves -- and derives the implied
 * coefficient from the damage that actually landed.
 *
 * Run it from the repo root:
 *
 *     npx vite-node tools/coefficient_probe.ts            # the table
 *     npx vite-node tools/coefficient_probe.ts --json     # machine-readable
 *     npx vite-node tools/coefficient_probe.ts --all      # every preset, not the best
 *
 * ----------------------------------------------------------------------------
 * WHY BEHAVIOURAL AND NOT STATIC. A coefficient is passed per `dealDamage`
 * call, so `powerCoefficient` written in the wrong place is SILENT: the spell
 * deals exactly the damage its source states and looks entirely normal. That
 * is how every caster in this project read for months. Grepping the source
 * gives 77 damage sites and no ability names, because every call passes
 * `abilityId: ability.id`. You have to run the thing.
 *
 * THREE AXES, NOT TWO. `attackPower`, `rangedAttackPower` and `spellPower` are
 * separate stats read by separate code. A probe that varies only the first and
 * the last reports Arcane Shot and Serpent Sting as unscaled when both carry
 * real ranged coefficients -- a mistake the handoff for this task made once.
 *
 * EVERY PRESET, NOT THE FIRST THAT KNOWS THE ABILITY. Taking the first sent
 * every Cat ability -- Rip, Ferocious Bite, Shred, Claw -- to be measured on a
 * MOONKIN, who holds no paws, so all five read flat and four of them are the
 * headline finding of this whole task. An ability is measured on every build
 * that has it and the strongest reading wins, because "does it scale" is
 * answered yes by any build that shows it scaling.
 * ============================================================================
 */
import {
  type Combatant,
  type Milliseconds,
  type Rotation,
  type TelemetryEvent,
  Simulation,
  castAbility,
  seconds,
} from '../src/engine';
import { NO_CHANCES } from '../src/engine/combat/attackTable';
import { abilitiesForClass } from '../src/game/abilities/abilitiesForClass';
import { createPlayer } from '../src/game/actors/createPlayer';
import { createTrainingDummy } from '../src/game/actors/createTrainingDummy';
import { PROFILE_PRESETS } from '../src/profiles/presets';
import type { CharacterProfile } from '../src/profiles/CharacterProfile';
import { SEAL_OF_RIGHTEOUSNESS } from '../src/game/auras/paladin';
import { IMMOLATE } from '../src/game/auras/warlock';
import { OVERPOWER_READY, REVENGE_READY, WARRIOR_STANCES } from '../src/game/auras/warrior';
import { EXPOSE_PREY } from '../src/game/reactions/hunterTalents';

/*
 * ----------------------------------------------------------------------------
 * `NO_CHANCES` IS NOT ENOUGH TO STOP A CRIT, and this is the subtlest thing in
 * the probe.
 *
 * `applyAbilityModifiers` ADDS a talent's `abilityCrit` to whatever the provider
 * returned, so an ability a talent grants crit chance to still crits at zero
 * base -- and then `damageMultiplier` is the crit multiplier, which multiplies
 * the base damage AND the coefficient's contribution alike. Conflagrate, whose
 * Fire and Brimstone does exactly that, read 0.7071 against a declared 0.4286:
 * not a coefficient error at all, but 1.5x of one, and the 1.5 is a spell crit.
 *
 * A LARGE NEGATIVE CHANCE is what makes it hold, because the modifier is added
 * rather than overriding. Zero is the number that looks right and is not.
 * ----------------------------------------------------------------------------
 */
const NEVER_CRITS = { ...NO_CHANCES, crit: -1_000_000, critMultiplier: 1 };

/** How far each axis is pushed. Large enough that rounding is invisible. */
const PROBE = 1000;

/** Long enough for every effect here: Siphon Life is 30s, Rupture 16s. */
const HORIZON: Milliseconds = seconds(90);

type Axis = 'attackPower' | 'rangedAttackPower' | 'spellPower';
const AXES: readonly Axis[] = ['attackPower', 'rangedAttackPower', 'spellPower'];

/** Combo points to bank before a finisher, so every one measures at five. */
const COMBO_POINTS = 5;

/*
 * ----------------------------------------------------------------------------
 * PRECONDITIONS, one per ability that will not act without one.
 *
 * Everything here is a state a real rotation reaches, arranged directly rather
 * than waited for. Arranging it is not cheating: the question this probe asks
 * is what an ability's damage does when a stat moves, and it can only ask that
 * of an ability that fires.
 *
 * A WRONG STANCE IS HANDLED GENERICALLY below and is deliberately not here --
 * `ability.stances` already names the auras that satisfy it, so reading the
 * ability is better than maintaining a list beside it.
 *
 * WHATEVER A SETUP APPLIES IS EXCLUDED BY ID, not subtracted by amount,
 * because several of these deal damage of their own: a seal strikes on every
 * swing and Immolate burns for six ticks. Subtracting the control's TOTAL gets
 * it wrong in the one direction nobody would check -- Judgement CONSUMES its
 * seal, so the control's ninety seconds of seal strikes are more than the cast
 * run's, and Judgement came back at 414 against a true 768. Excluding the ids
 * the control produced credits Judgement with `judgement` alone.
 *
 * It also catches what no setup put there: `fatal_wound`, an item proc riding
 * the auto-attack, was quietly adding 480 to two Warrior and two Rogue builds.
 * ----------------------------------------------------------------------------
 */
const SETUP: Readonly<
  Record<string, (simulation: Simulation, actor: Combatant, target: Combatant) => void>
> = {
  // Judgement refuses without a seal, and reads which one is up.
  judgement: (simulation, actor) => simulation.applyAura(actor, SEAL_OF_RIGHTEOUSNESS, actor.id),
  // Conflagrate requires Immolate on the target and consumes it.
  conflagrate: (simulation, actor, target) => simulation.applyAura(target, IMMOLATE, actor.id),
  // Two windows a real fight opens by being dodged, and by blocking.
  overpower: (simulation, actor) => simulation.applyAura(actor, OVERPOWER_READY, actor.id),
  revenge: (simulation, actor) => simulation.applyAura(actor, REVENGE_READY, actor.id),
  // Improved Wing Clip's window, which a Hunter reaches by landing a hit.
  mongoose_bite: (simulation, actor) => simulation.applyAura(actor, EXPOSE_PREY, actor.id),
  /*
   * Swift Judgement resets Judgement's cooldown and is "only worth a global
   * cooldown when there is something to reset", so it refuses while Judgement
   * is ready. Casting Judgement first is what a rotation does.
   */
  swift_judgement: (simulation, actor, target) => {
    simulation.applyAura(actor, SEAL_OF_RIGHTEOUSNESS, actor.id);
    const judgement = actor.abilities.get('judgement');
    if (judgement) castAbility(simulation, actor, judgement, target);
    // Past the global cooldown that cast just started, or the next one is
    // refused `on_gcd` -- which is what the first version of this setup did.
    simulation.advanceTo(seconds(2));
  },
  // Life Tap trades health for mana and refuses at a full pool.
  life_tap: (_simulation, actor) => actor.resources.get('mana')?.set(0),
  /*
   * EXECUTE IS GATED ON THE CLOCK AND NOT ON HEALTH, by the ruleset owner's
   * decision: the last 20% of the FIGHT. So the probe advances into the execute
   * phase rather than wounding the dummy, which is what the first attempt did
   * and why it read `condition_failed` against a target at 10% health.
   */
  execute: (simulation) => simulation.advanceTo(HORIZON * 0.85),
};

interface Reading {
  readonly preset: string;
  readonly className: string;
  readonly abilityId: string;
  readonly abilityName: string;
  /** Why the cast was refused, if it was. */
  readonly refused: string | undefined;
  /** Damage with the character's own stats, its setup's damage removed. */
  readonly base: number;
  readonly byAxis: Readonly<Record<Axis, number>>;
  /** The same axis pushed twice as far, to check the response is linear. */
  readonly doubled: number | undefined;
  readonly school: string;
  /*
   * The build's weapon speeds, in seconds, so the EXPECTED coefficient of a
   * weapon-scaled ability can be computed from the source's own words:
   * `speed / 14 x fraction`, where the fraction is the "150% weapon damage" the
   * tooltip states. Without them a measured 0.2649 cannot be checked against
   * anything.
   */
  readonly mainHandSeconds: number | undefined;
  readonly offHandSeconds: number | undefined;
  /**
   * The off hand's own damage multiplier -- the dual-wield penalty, which two
   * talents change. Needed to check an ability that strikes with both hands:
   * assuming a flat half reported Whirlwind off by 60% when it is exact.
   */
  readonly offHandDamageMultiplier: number | undefined;
  readonly rangedSeconds: number | undefined;
  /*
   * EVERY MULTIPLIER THIS BUILD PUTS ON THIS ABILITY, multiplied together.
   *
   * Without it the report raises 36 false alarms and buries the four real ones.
   * A measured coefficient is the rule's TIMES whatever the build multiplies the
   * ability by -- Defensive Stance's 0.9, Shadow Mastery's 1.1, a Moonkin's
   * Moonfury -- so `measured / expected` came back at 1.100 for eight spells at
   * once, which is Shadow Mastery and Moonfury and not a coefficient error.
   *
   * It is READ FROM THE COMBATANT rather than looked up per talent, so a new
   * talent is included without anyone remembering.
   */
  readonly damageMultiplier: number;
  /**
   * Of `base`, how much arrived NOT as a periodic tick. Zero means a pure
   * damage-over-time spell, which is on a different coefficient rule.
   */
  readonly instantBase: number;
  /*
   * NON-PERIODIC DAMAGE EVENTS IN THE BASE RUN, which is how an ability that
   * strikes with BOTH WEAPONS is recognised.
   *
   * It cannot be read from the tooltip. Mutilate says "attacks with both
   * weapons" and Whirlwind does not -- Whirlwind's off-hand strike comes from
   * RAGING BLOWS, a talent, so the source text of the ability could never say
   * so. Two events say so.
   */
  readonly instantEvents: number;
  /*
   * HOW MUCH THE STAT ACTUALLY MOVED, per axis, and it is not always 1000.
   *
   * `bonusStats` adds a FLAT amount and `StatBlock` computes
   * `(base + flat) x (1 + sum(percentAdd))`, so a build with a percentage stat
   * talent turns +1000 into more than 1000 effective -- and dividing by 1000
   * would report a coefficient inflated by exactly that talent. Divide by what
   * the stat block says instead, and the reading is exact on every build.
   */
  readonly effectiveDelta: Readonly<Record<Axis, number>>;
  /*
   * WHERE THE ATTACK POWER RESPONSE COMES FROM, measured by halving every
   * weapon's speed and asking again.
   *
   *   'weapon'  the coefficient halved with the weapon, so the damage IS weapon
   *             damage and the attack power arrives through it at speed / 14
   *   'own'     the coefficient did not move, so the ability carries its own --
   *             Bloodthirst's "35% of your Attack Power" is the same on any
   *             weapon
   *   'none'    no attack power response at all
   *
   * Mortal Strike and Bloodthirst are indistinguishable without this: both just
   * read "AP".
   */
  /**
   * Non-periodic damage events this ability causes with the AUTO-ATTACK OFF:
   * what ONE cast does by itself.
   *
   * Zero alongside a positive `instantEvents` means the damage is SWING-DRIVEN
   * -- a seal, which strikes once per swing for the whole fight. Its figures
   * are then per strike rather than per cast.
   */
  readonly castOnlyEvents: number;
  readonly apSource: 'weapon' | 'own' | 'none';
  readonly rapSource: 'weapon' | 'own' | 'none';
}

/**
 * Build the probe's character: the preset's own, with one axis pushed.
 *
 * `bonusStats` is the same field the encounter fills from `profile.stats`, so
 * pushing an axis here is exactly what a thousand points of gear would do and
 * goes through every derivation on the way -- including `statFromStat`, which
 * is why the axis is pushed here rather than written onto a finished stat
 * block.
 */
/*
 * ----------------------------------------------------------------------------
 * HALVING EVERY WEAPON'S SPEED IS HOW "SCALES THROUGH THE WEAPON" IS MEASURED.
 *
 * Two abilities can respond identically to attack power for completely
 * different reasons. Mortal Strike deals WEAPON DAMAGE, so its attack power
 * comes through the weapon at `speed / 14` and moves when the weapon does.
 * Bloodthirst deals "35% of your Attack Power", which is its own coefficient and
 * is the same on any weapon. Both just read as "AP" without this.
 *
 * So each ability is measured twice, once on a weapon of half the speed. A
 * coefficient that HALVES came through the weapon; one that does not is the
 * ability's own. Behavioural, like everything else here -- the alternative is
 * checking whether the measured figure happens to land near `speed / 14`, which
 * is a guess dressed as a test.
 * ----------------------------------------------------------------------------
 */
const WEAPON_SPEED_PROBE = 0.5;

function probePlayer(
  profile: CharacterProfile,
  axis: Axis | undefined,
  amount: number,
  {
    weaponSpeedScale = 1,
    autoAttack,
  }: { weaponSpeedScale?: number; autoAttack?: 'none' } = {},
): Combatant {
  const player = createPlayer({
    name: profile.character.name,
    race: profile.character.race,
    characterClass: profile.character.characterClass,
    combatStyle: profile.character.combatStyle,
    stance: profile.character.stance,
    bonusStats: {
      ...profile.stats,
      ...(axis ? { [axis]: (profile.stats[axis] ?? 0) + amount } : {}),
    },
    equipment: profile.equipment,
    talents: profile.talents,
  });

  /*
   * THE ROTATION COMES OFF, and forgetting it was the first bug in this probe.
   * A preset's character carries its priority list, so advancing ninety seconds
   * runs the whole list -- and fourteen Warrior abilities came back at an
   * identical 14,372.7, which is one fight's rotation and not any ability's
   * damage. Numbers equal across unrelated abilities are the tell.
   *
   * THE AUTO-ATTACK STAYS ON. It has to, for the on-next-swing abilities --
   * Heroic Strike and Cleave never resolve without a swing to ride -- and it
   * costs nothing, because an auto-attack carries NO `abilityId` while
   * everything an ability causes carries one. The control run proves it.
   */
  (player as { rotation?: Rotation }).rotation = undefined;
  /*
   * SWITCHING THE AUTO-ATTACK OFF ISOLATES WHAT ONE CAST DOES, which is how a
   * seal is told apart from an ability that strikes twice.
   *
   * Whirlwind's two hits are one cast and happen with or without a swing. A
   * seal's nine are nine SWINGS, and counting them as one cast's output states
   * a per-fight total where the table promises a coefficient -- Seal of
   * Righteousness read 71% / 143% where its per-strike figures are 8% / 16%.
   */
  if (autoAttack) (player as { autoAttack: string }).autoAttack = autoAttack;

  if (weaponSpeedScale !== 1) {
    // Written onto the finished weapons rather than passed in, because the
    // weapons come from the equipped items and nothing lets a caller override
    // one. The same technique as the rotation above.
    const weapons = player.weapons as Record<
      string,
      { swingTimerMs: number; powerCoefficient?: number } | undefined
    >;
    for (const slot of Object.keys(weapons)) {
      const weapon = weapons[slot];
      if (!weapon) continue;
      /*
       * BOTH FIELDS, and the first attempt moved only the timer -- which
       * changed nothing, because a weapon carries its attack power scaling as a
       * PRECOMPUTED `powerCoefficient` (`attackPowerCoefficientFor`, which is
       * `speed / 14`) rather than deriving it from the timer at each hit. Every
       * ability then read "own", including Mortal Strike.
       */
      weapons[slot] = {
        ...weapon,
        swingTimerMs: weapon.swingTimerMs * weaponSpeedScale,
        powerCoefficient:
          weapon.powerCoefficient === undefined
            ? undefined
            : weapon.powerCoefficient * weaponSpeedScale,
      };
    }
  }
  return player;
}

interface Outcome {
  /** Damage this run dealt, per `abilityId`. Auto-attacks are not in it. */
  readonly byId: ReadonlyMap<string, number>;
  /*
   * The same, counting only what a damage event declares NOT periodic.
   *
   * This is what tells a pure damage-over-time spell from a hybrid, and the two
   * are on different rules -- `duration / 15` against the hybrid share. Reading
   * it from the tooltip's wording cannot be done reliably; the telemetry says
   * so outright, on every event, in `periodic`.
   */
  readonly instant: ReadonlyMap<string, number>;
  /** How many non-periodic damage events landed. Two hands is two events. */
  readonly instantEvents: number;
  readonly refused: string | undefined;
  readonly school: string;
}

/**
 * Cast one ability in isolation and total every point of damage it causes,
 * ticks included. With `cast: false` it arranges the same state and casts
 * nothing, which is the control.
 *
 * TWO THINGS ARE FLATTENED so the delta is the coefficient and nothing else.
 * `NEVER_CRITS` makes every attack a clean unmodified hit -- no miss, no glance,
 * no crit -- because an avoided attack emits a damage event of zero and reads as
 * "deals nothing", and a crit multiplies the coefficient's contribution as well
 * as the base. The target's ARMOR is zero, because armor multiplies the whole
 * total and would scale every physical coefficient by 0.6.
 */
function measure(
  profile: CharacterProfile,
  abilityId: string,
  axis: Axis | undefined,
  amount: number,
  {
    cast = true,
    weaponSpeedScale = 1,
    autoAttack,
  }: { cast?: boolean; weaponSpeedScale?: number; autoAttack?: 'none' } = {},
): Outcome {
  const events: TelemetryEvent[] = [];
  const player = probePlayer(profile, axis, amount, { weaponSpeedScale, autoAttack });
  const target = createTrainingDummy({
    name: 'Probe',
    health: 1_000_000_000,
    armor: 0,
    level: profile.encounter.targetLevel,
    attacks: false,
  });

  const simulation = new Simulation(
    {
      durationMs: HORIZON,
      seed: 1,
      createCombatants: () => [player, target],
      attackChances: () => NEVER_CRITS,
    },
    { emit: (event) => events.push(event) },
  );

  // Every pool full, and a finisher's combo points banked, so nothing is
  // refused for want of resource.
  for (const resource of player.resources.all) {
    /*
     * AND WHOSE THEY ARE. Combo points live on a target, so setting the pool
     * without also naming the target leaves a finisher unable to spend them --
     * which reads exactly like an ability that lost its flat damage.
     */
    if (resource.type === 'comboPoints') resource.set(COMBO_POINTS);
    if (resource.type === 'comboPoints') player.comboPointTargetId = target.id;
    else resource.fill();
  }

  const ability = player.abilities.get(abilityId);
  if (!ability) {
    return {
      byId: new Map(),
      instant: new Map(),
      instantEvents: 0,
      refused: 'not_known',
      school: '',
    };
  }

  // The setup runs in BOTH arms, so whatever damage it brings cancels.
  SETUP[abilityId]?.(simulation, player, target);

  let refused: string | undefined;
  if (cast) {
    let result = castAbility(simulation, player, ability, target);
    /*
     * A WRONG STANCE IS SATISFIED FROM THE ABILITY ITSELF. `ability.stances`
     * names the auras that permit it, so the probe applies the first one it
     * recognises and asks again -- which is what a rotation does, and means a
     * new stance-gated ability needs nothing added here.
     */
    if (result.ok === false && result.reason === 'wrong_stance') {
      const wanted = WARRIOR_STANCES.find((stance) => ability.stances?.includes(stance.id));
      if (wanted) {
        simulation.applyAura(player, wanted, player.id);
        result = castAbility(simulation, player, ability, target);
      }
    }
    if (result.ok === false) refused = result.reason;
  }

  simulation.advanceTo(HORIZON);

  const byId = new Map<string, number>();
  const instant = new Map<string, number>();
  let instantEvents = 0;
  let school = '';
  for (const event of events) {
    if (event.type !== 'damage' || event.sourceId !== player.id) continue;
    // An auto-attack carries no `abilityId`; everything an ability causes,
    // including its DoT's ticks under the aura's own id, carries one.
    if (event.abilityId === undefined) continue;
    byId.set(event.abilityId, (byId.get(event.abilityId) ?? 0) + event.amount);
    if (!event.periodic) {
      instant.set(event.abilityId, (instant.get(event.abilityId) ?? 0) + event.amount);
      /*
       * ONLY THIS ABILITY'S OWN EVENTS. Counting every tagged event let
       * `fatal_wound`, an item proc riding the auto-attack, make Sinister
       * Strike look like a two-handed ability -- and the expectation then
       * carried an off-hand strike it never makes.
       */
      if (event.abilityId === abilityId) instantEvents += 1;
    }
    if (event.amount > 0 && !school) school = event.school;
  }
  return { byId, instant, instantEvents, refused, school };
}

/** One ability measured on one build, with everything it did not cause removed. */
function probe(profile: CharacterProfile, abilityId: string, preset: string, name: string): Reading {
  /*
   * The damage the CAST is responsible for: every tagged id the control did
   * not also produce. See the note on `SETUP`.
   */
  const net = (axis: Axis | undefined, amount: number, which: 'byId' | 'instant' = 'byId') => {
    const withCast = measure(profile, abilityId, axis, amount);
    const control = measure(profile, abilityId, axis, amount, { cast: false });
    let total = 0;
    for (const [id, amountDealt] of withCast[which]) {
      if (!control.byId.has(id)) total += amountDealt;
    }
    return total;
  };

  const cast = measure(profile, abilityId, undefined, 0);
  const base = net(undefined, 0);
  const instantBase = net(undefined, 0, 'instant');
  const byAxis = {} as Record<Axis, number>;
  for (const axis of AXES) byAxis[axis] = net(axis, PROBE);

  const biggest = AXES.reduce((a, b) => (byAxis[b] > byAxis[a] ? b : a));
  const doubled = byAxis[biggest] > base ? net(biggest, PROBE * 2) : undefined;

  /*
   * The same net measurement on a weapon of half the speed. Only the two
   * attack power axes need it -- a spell has no weapon to scale with.
   */
  /*
   * The same net measurement on a weapon of half the speed, with the number of
   * hits it produced -- because the comparison has to be PER HIT.
   */
  const slowNet = (axis: Axis) => {
    const withCast = measure(profile, abilityId, axis, PROBE, {
      weaponSpeedScale: WEAPON_SPEED_PROBE,
    });
    const control = measure(profile, abilityId, axis, PROBE, {
      cast: false,
      weaponSpeedScale: WEAPON_SPEED_PROBE,
    });
    const slowBase = measure(profile, abilityId, undefined, 0, {
      weaponSpeedScale: WEAPON_SPEED_PROBE,
    });
    const slowControl = measure(profile, abilityId, undefined, 0, {
      cast: false,
      weaponSpeedScale: WEAPON_SPEED_PROBE,
    });
    const sum = (outcome: Outcome, against: Outcome) => {
      let total = 0;
      for (const [id, dealt] of outcome.byId) if (!against.byId.has(id)) total += dealt;
      return total;
    };
    return {
      amount: sum(withCast, control) - sum(slowBase, slowControl),
      events: Math.max(1, withCast.instantEvents),
    };
  };

  /*
   * ----------------------------------------------------------------------------
   * PER HIT, AND THAT IS THE WHOLE TRICK.
   *
   * Halving the weapon's speed halves what one hit scales by AND changes how
   * many hits land in ninety seconds. Comparing TOTALS therefore cancels itself
   * for anything that fires once per swing: a seal's strikes double while each
   * one halves, so Seal of Command -- which is literally 70% of another hit --
   * read as carrying its own coefficient. Comparing per hit is right for every
   * case at once, including an on-next-swing ability that lands exactly once
   * either way.
   * ----------------------------------------------------------------------------
   */
  const sourceOf = (axis: Axis): 'weapon' | 'own' | 'none' => {
    const full = byAxis[axis] - base;
    if (Math.abs(full) < 1e-6) return 'none';
    const perHitFull = full / Math.max(1, cast.instantEvents);
    const slow = slowNet(axis);
    const perHitSlow = slow.amount / slow.events;
    // Halved the weapon, halved the response per hit: it came through the weapon.
    return Math.abs(perHitSlow / perHitFull - 0.5) < 0.02 ? 'weapon' : 'own';
  };

  const castOnlyEvents = measure(profile, abilityId, undefined, 0, { autoAttack: 'none' })
    .instantEvents;

  const apSource = sourceOf('attackPower');
  const rapSource = sourceOf('rangedAttackPower');

  const reference = probePlayer(profile, undefined, 0);
  const effectiveDelta = {} as Record<Axis, number>;
  for (const axis of AXES) {
    effectiveDelta[axis] =
      probePlayer(profile, axis, PROBE).stats.effective[axis] - reference.stats.effective[axis];
  }
  const weapons = reference.weapons;
  const school = (cast.school || 'physical') as Parameters<
    typeof reference.schoolModifiers.for
  >[0];
  /*
   * ALL FOUR SCOPES `dealDamage` CONSULTS, and the fourth was missed first
   * time. Ranged Weapon Specialization is an ATTACK TABLE modifier -- "the
   * damage you deal with ranged weapons", which is neither one ability nor one
   * school nor the whole character -- so leaving it out made every Hunter shot
   * report "105% ranged weapon damage" where it deals exactly 100%. A
   * coefficient inflated by a talent is not a coefficient.
   */
  const damageMultiplier =
    reference.damageDoneMultiplier *
    (reference.abilityModifiers.for(abilityId).damageMultiplier ?? 1) *
    (reference.schoolModifiers.for(school).damageMultiplier ?? 1) *
    (reference.attackTableModifiers.for(reference.abilities.get(abilityId)?.attackTable)
      .damageMultiplier ?? 1);

  return {
    preset,
    className: profile.character.characterClass,
    abilityId,
    abilityName: name,
    refused: cast.refused,
    base,
    byAxis,
    doubled,
    school: cast.school,
    mainHandSeconds: weapons.mainHand ? weapons.mainHand.swingTimerMs / 1000 : undefined,
    offHandSeconds: weapons.offHand ? weapons.offHand.swingTimerMs / 1000 : undefined,
    offHandDamageMultiplier: weapons.offHand?.damageMultiplier ?? undefined,
    rangedSeconds: weapons.ranged ? weapons.ranged.swingTimerMs / 1000 : undefined,
    damageMultiplier,
    instantBase,
    instantEvents: cast.instantEvents,
    effectiveDelta,
    castOnlyEvents,
    apSource,
    rapSource,
  };
}

/** Every (build, ability) pair there is. */
function run(): readonly Reading[] {
  const readings: Reading[] = [];
  for (const preset of PROFILE_PRESETS) {
    const profile = preset.build();
    for (const ability of abilitiesForClass(
      profile.character.characterClass,
      profile.character.combatStyle as never,
      profile.talents,
    )) {
      readings.push(probe(profile, ability.id, preset.label, ability.name));
    }
  }
  return readings;
}

const coefOf = (reading: Reading, axis: Axis) => {
  const delta = reading.effectiveDelta[axis];
  return delta === 0 ? 0 : (reading.byAxis[axis] - reading.base) / delta;
};
const strength = (reading: Reading) =>
  Math.max(...AXES.map((axis) => Math.abs(coefOf(reading, axis))));

/**
 * One reading per ability: the build that shows the most scaling, or failing
 * that the one that at least dealt damage.
 *
 * Deliberately the MOST and not the first. A flat reading proves nothing on a
 * build that cannot use the ability properly -- a Moonkin's Shred -- while a
 * scaling reading proves the coefficient reaches the damage on some build.
 */
function best(readings: readonly Reading[]): readonly Reading[] {
  const byAbility = new Map<string, Reading>();
  for (const reading of readings) {
    const held = byAbility.get(reading.abilityId);
    if (!held) {
      byAbility.set(reading.abilityId, reading);
      continue;
    }
    const better =
      strength(reading) > strength(held) ||
      (strength(reading) === strength(held) && reading.base > held.base);
    if (better) byAbility.set(reading.abilityId, reading);
  }
  return [...byAbility.values()];
}

/*
 * ----------------------------------------------------------------------------
 * THE TWO THAT NO CAST REACHES.
 *
 * Deep Wounds and Ignite are auras applied by a REACTION to a critical strike,
 * so no ability sweep ever sees them -- `everySpellScales.test.ts` says outright
 * that it cannot. They deal real damage, so leaving them out would be exactly
 * the silent omission this task exists to stop.
 *
 * Reached by making every attack a crit, which is the only thing that applies
 * them, and measured the same way as everything else: cast the parent ability,
 * then total the damage tagged with the AURA's id.
 *
 * WHAT THEY SHOW IS INHERITED SCALING, AND THAT IS THE POINT. Both are declared
 * with `powerCoefficient: 0`, because both are a SHARE OF A HIT THAT WAS
 * ALREADY SCALED -- Deep Wounds a percentage of average weapon damage, Ignite a
 * percentage of the crit that caused it. A coefficient here would apply the
 * stat twice. So they must move with the stat and must not carry one, and the
 * two statements are not in conflict.
 * ----------------------------------------------------------------------------
 */
const ALL_CRIT = { ...NO_CHANCES, crit: 10_000, critMultiplier: 2 };

function derived(presetLabel: string, abilityId: string, auraId: string) {
  const profile = PROFILE_PRESETS.find((preset) => preset.label === presetLabel)!.build();
  const total = (axis: Axis | undefined, amount: number) => {
    const events: TelemetryEvent[] = [];
    const player = probePlayer(profile, axis, amount);
    const target = createTrainingDummy({
      name: 'Probe',
      health: 1_000_000_000,
      armor: 0,
      level: profile.encounter.targetLevel,
      attacks: false,
    });
    const simulation = new Simulation(
      {
        durationMs: HORIZON,
        seed: 1,
        createCombatants: () => [player, target],
        attackChances: () => ALL_CRIT,
      },
      { emit: (event) => events.push(event) },
    );
    for (const resource of player.resources.all) {
      if (resource.type === 'comboPoints') resource.set(COMBO_POINTS);
      else resource.fill();
    }
    const ability = player.abilities.get(abilityId);
    if (ability) castAbility(simulation, player, ability, target);
    // One second only: long enough for the crit and the aura it applies, short
    // enough that the auto-attack does not keep re-applying it.
    simulation.advanceTo(seconds(8));
    let dealt = 0;
    for (const event of events) {
      if (event.type !== 'damage' || event.sourceId !== player.id) continue;
      if (event.abilityId === auraId) dealt += event.amount;
    }
    return dealt;
  };

  const base = total(undefined, 0);
  return {
    auraId,
    via: `${presetLabel} / ${abilityId}`,
    base,
    byAxis: Object.fromEntries(AXES.map((axis) => [axis, total(axis, PROBE)])) as Record<
      Axis,
      number
    >,
  };
}

const all = run();
const chosen = process.argv.includes('--all') ? all : best(all);
const DERIVED = [
  // A Warrior crit applies Deep Wounds; 2H Arms takes the talent.
  derived('2H Arms', 'mortal_strike', 'deep_wounds'),
  // A Fire Mage crit applies Ignite.
  derived('Fire', 'fireball', 'ignite'),
];

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ readings: chosen, derived: DERIVED }, null, 1));
} else {
  const r4 = (n: number) => n.toFixed(4);
  console.log(
    ['class', 'ability', 'preset', 'school', 'base', 'AP', 'RAP', 'SP', 'linear', 'note'].join('\t'),
  );
  for (const reading of chosen) {
    const biggest = AXES.reduce((a, b) => (reading.byAxis[b] > reading.byAxis[a] ? b : a));
    const linear =
      reading.doubled === undefined
        ? '-'
        : r4((reading.doubled - reading.base) / (PROBE * 2) / (coefOf(reading, biggest) || 1));
    console.log(
      [
        reading.className,
        reading.abilityId,
        reading.preset,
        reading.school || '-',
        reading.base.toFixed(1),
        r4(coefOf(reading, 'attackPower')),
        r4(coefOf(reading, 'rangedAttackPower')),
        r4(coefOf(reading, 'spellPower')),
        linear,
        reading.refused ?? '',
      ].join('\t'),
    );
  }

  const damaging = chosen.filter((reading) => reading.base > 0);
  const flat = damaging.filter((reading) => strength(reading) === 0);
  console.log(`\n${chosen.length} abilities; ${damaging.length} deal damage.`);
  /*
   * FLAT IS A CLAIM ABOUT EVERY BUILD THAT HAS THE ABILITY, not about the one
   * that happened to be picked. Naming the builds is what makes it checkable:
   * a Moonkin's Shred is flat because a Moonkin holds no paws, and that is not
   * a finding about Shred.
   */
  console.log(`\n${flat.length} DEAL DAMAGE THAT MOVES ON NO AXIS (builds measured in brackets):`);
  for (const reading of flat) {
    const everywhere = all.filter((other) => other.abilityId === reading.abilityId && other.base > 0);
    const scaling = everywhere.filter((other) => strength(other) > 0);
    console.log(
      `  ${reading.className}\t${reading.abilityId}\t${reading.base.toFixed(1)}\t` +
        `[${everywhere.map((other) => other.preset).join(', ')}]` +
        (scaling.length > 0 ? `\tBUT SCALES ON ${scaling.map((o) => o.preset).join(', ')}` : ''),
    );
  }
  const refused = chosen.filter((reading) => reading.refused && reading.base === 0);
  console.log(`\n${refused.length} REFUSED ON EVERY BUILD, so unmeasured:`);
  for (const reading of refused) {
    console.log(`  ${reading.className}\t${reading.abilityId}\t${reading.refused}`);
  }
  const silent = chosen.filter((reading) => reading.base === 0 && !reading.refused);
  console.log(`\n${silent.length} CAST AND DEALT NOTHING -- non-damaging, or damage unseen:`);
  for (const reading of silent) {
    console.log(`  ${reading.className}\t${reading.abilityId}`);
  }
  const nonlinear = chosen.filter(
    (reading) =>
      reading.doubled !== undefined &&
      Math.abs(
        (reading.doubled - reading.base) /
          (PROBE * 2) /
          (coefOf(
            reading,
            AXES.reduce((a, b) => (reading.byAxis[b] > reading.byAxis[a] ? b : a)),
          ) || 1) -
          1,
      ) > 0.02,
  );
  if (nonlinear.length > 0) {
    console.log(`\n!! ${nonlinear.length} respond NON-LINEARLY to the stat -- read these by hand:`);
    for (const reading of nonlinear) console.log(`  ${reading.className}\t${reading.abilityId}`);
  }

  console.log(`\nAURA-ONLY DAMAGE, reached by forcing a crit (see the note in the source):`);
  for (const entry of DERIVED) {
    console.log(
      `  ${entry.auraId}\tvia ${entry.via}\tbase ${entry.base.toFixed(1)}\t` +
        AXES.map((axis) => `${axis}=${((entry.byAxis[axis] - entry.base) / PROBE).toFixed(4)}`).join(
          ' ',
        ),
    );
  }
}
