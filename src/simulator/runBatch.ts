import type {
  BatchAbilityTotals,
  BatchDamageTaken,
  BatchCastCharge,
  BatchHealingTotals,
  BatchResourceFlow,
  BatchSurvival,
  DistributionSummary,
  SimulationResult,
} from '../analysis';
import { EXTERNAL_HEALER } from '../game/encounters/externalHealer';
import { raidForcedAuraIds } from '../game/buffs/raidBuffs';
import { BatchTotals, summarize } from '../analysis';
import type { BatchAuraUptime, BatchStatAverages } from '../analysis';
import type { SimulationConfig } from '../engine';
import { Simulation, deriveSeed, toSeconds } from '../engine';
import { trainingDummyEncounter } from './trainingDummyEncounter';
import type { HealerFight } from './healerEncounter';
import { HEALER_ID, TANK_ID, healerEncounter } from './healerEncounter';
import { PET_UNMODELLED } from '../game/actors/createPet';
import type { CharacterProfile } from '../profiles';
import { runSimulation } from './runSimulation';

/** An ability the fight CAST that does less than its description says. */
export interface CastButNotSimulated {
  readonly abilityName: string;
  /** Mean casts per iteration, so the cost of it is visible too. */
  readonly uses: number;
  /** One line, from the ability's own `unmodelled`. */
  readonly reason: string;
}

export interface BatchOptions {
  readonly iterations: number;
  /** Seeds for individual iterations are derived from this. */
  readonly baseSeed: number;
  /** Called with a 0-to-1 fraction, for a progress bar. */
  readonly onProgress?: (fraction: number) => void;
  /**
   * Which figure picks the representative fight for the combat log: the
   * median DPS by default, the median HPS for a healer run (round 52).
   */
  readonly representativeBy?: 'dps' | 'hps';
  /**
   * Which combatant the report is ABOUT. The first friendly by default, which
   * is the player in every ordinary fight; a healer encounter puts the tank
   * first so the boss swings at it, and names the healer here (round 52).
   */
  readonly playerId?: string;
  /** The tank, in a healer fight, so its deaths are counted apart (round 53). */
  readonly tankId?: string;
}

/**
 * One pool's flow out of a batch, by name.
 *
 * A lookup rather than a field per resource, because which pools exist depends
 * on the class -- and because the field this replaced, `rage`, was returning
 * every pool added together under one name.
 */
export function resourceFlowOf(
  batch: Pick<BatchResult, 'resources'>,
  resource: string,
): BatchResourceFlow {
  return (
    batch.resources.find((flow) => flow.resource === resource) ?? {
      resource,
      gained: [],
      spent: [],
      totalGained: 0,
      totalSpent: 0,
      totalWasted: 0,
    }
  );
}

export interface BatchResult {
  readonly iterations: number;
  readonly baseSeed: number;
  /** DPS across every iteration. */
  readonly dps: DistributionSummary;
  /**
   * Every iteration's DPS, in iteration order.
   *
   * ----------------------------------------------------------------------------
   * THE ORDER IS THE POINT, not the values -- `dps` above already summarises
   * those. Iteration `i` derives its seed from `baseSeed` the same way every
   * time, so two batches run at the same base seed can be differenced ITERATION
   * BY ITERATION: the same fight with one thing changed, rather than two
   * independent samples. That paired difference is what a stat-weight run
   * measures, and it is worth about four orders of magnitude in variance over
   * differencing the two means. See `statWeights.ts`.
   *
   * Costs one number per iteration, which the batch had already built in order
   * to summarise it.
   * ----------------------------------------------------------------------------
   */
  readonly dpsSamples: readonly number[];
  /**
   * THREAT PER SECOND, the PLAYER's (round 47) -- a pet holds its own threat
   * on a boss and is not summed in, where its damage is.
   */
  readonly tps: DistributionSummary;
  /** Every iteration's TPS, in the same order as `dpsSamples`. */
  readonly tpsSamples: readonly number[];
  /**
   * HEALING PER SECOND, the player's effective healing (round 52). Overhealing
   * is excluded, and so is any external heal -- the assumed tank healer is not
   * the player. Zero for anybody who does not heal.
   */
  readonly hps: DistributionSummary;
  /** Every iteration's HPS, in the same order as `dpsSamples`. */
  readonly hpsSamples: readonly number[];
  /** The player's heals by spell, pooled across every iteration. */
  readonly healing: readonly BatchHealingTotals[];
  /** Mean effective healing done by the player per iteration. */
  readonly meanHealing: number;
  /**
   * Mean deaths per iteration among every OTHER friendly actor -- the people a
   * healer is keeping up (round 52). Zero in a fight with nobody else in it.
   */
  readonly alliedDeaths: number;
  /**
   * Mean deaths per iteration of the TANK, in a healer fight (round 53), and
   * absent in any other. Counted inside `alliedDeaths` as well.
   */
  readonly tankDeaths?: number;
  /** The combatant the report is about -- the healer in a healer fight. */
  readonly playerId: string;
  /** The player's threat per fight by source, largest first. */
  readonly threat: readonly { readonly name: string; readonly threat: number }[];
  /**
   * Every iteration's PLAYER DEATHS, in iteration order.
   *
   * ----------------------------------------------------------------------------
   * THE SAME ARRAY IN THE SAME ORDER AS `dpsSamples`, so the two can be paired
   * against another batch run at the same base seed. A TANK stat weight is the
   * same arithmetic as a damage one with this quantity in place of DPS: what a
   * point of a stat is worth is the DEATHS IT AVOIDS, and the baseline it is
   * differenced against is this.
   *
   * All zero unless the target swings back, which is off by default -- and the
   * tank panel only appears when it is on.
   * ----------------------------------------------------------------------------
   */
  readonly deathSamples: readonly number[];
  /**
   * A full result for the iteration whose DPS landed closest to the median.
   *
   * FOR THE COMBAT LOG ONLY. A log has to be a single fight to make any sense,
   * and this is a typical one. Every NUMBER a reader sees comes from the
   * aggregate below instead -- see `BatchTotals` for why reading a breakdown
   * off one iteration made a 2500-iteration batch report forty swings.
   */
  readonly representative: SimulationResult;
  /**
   * The priority list the player actually ran.
   *
   * Shown because it is not derivable from the character sheet: a Warrior's
   * list depends on combat style AND stance, and two builds that look
   * identical in every visible field can run different rotations. Someone
   * reading a result asked why Rend was being cast, and nothing on screen
   * could tell them which of three lists had produced it.
   */
  readonly rotationName: string | undefined;
  /** Mean damage dealt by the player per iteration. */
  readonly meanDamage: number;
  /** Mean fight length in milliseconds. */
  readonly meanDurationMs: number;
  /** The player's damage breakdown, pooled across every iteration. */
  readonly abilities: readonly BatchAbilityTotals[];
  /** What hit the player, pooled across every iteration. */
  readonly damageTaken: readonly BatchDamageTaken[];
  /**
   * Deaths, damage taken and healing received, per iteration.
   *
   * All zero in a fight the target does not swing in, which is the default.
   */
  readonly survival: BatchSurvival;
  /**
   * The character's stats, averaged over the fight and weighted by TIME.
   *
   * ----------------------------------------------------------------------------
   * THE CHARACTER SHEET CANNOT ANSWER THIS. It shows the character at the pull,
   * before a single one of its own buffs has landed -- so a Rogue's sheet reads
   * its unhasted swing speed for a build whose whole cycle is Slice and Dice,
   * and a Warrior's omits Flurry entirely. Averaged over the fight, haste is the
   * number that actually multiplied the swing timer.
   *
   * THE PLAYER'S, not every friendly actor's, which is the same choice
   * `survival` and `resources` make. A pet has its own attack power and
   * averaging the two together would describe nobody.
   *
   * `undefined` only when nothing was sampled at all.
   * ----------------------------------------------------------------------------
   */
  readonly stats: BatchStatAverages | undefined;
  /**
   * Where EVERY pool the player used came from and went, one entry each.
   *
   * ----------------------------------------------------------------------------
   * EVERY POOL, NOT JUST RAGE, and the old single `rage` field was worse than
   * incomplete: the totals behind it were never keyed by resource, so a Rogue's
   * energy and combo points were added together and rendered under a heading
   * that said "Rage". Only a Warrior's were about the resource named.
   *
   * Discovered from the event stream rather than from the class, so a character
   * that gains a pool it was not built with still gets a section.
   * ----------------------------------------------------------------------------
   */
  readonly resources: readonly BatchResourceFlow[];
  /**
   * What an aura's cast charges were spent on -- Clearcasting and its kin.
   *
   * BESIDE THE RESOURCES AND NOT INSIDE ONE, because a charge is not keyed by
   * pool: Presence of Mind saves no resource at all, and a character can spend
   * charges of two different auras against two different pools. The panel
   * renders it under the resource sections, which is where the owner asked for
   * it and is where the saving belongs -- a free cast emits no
   * `resource_spent`, so this is the only place that pool's missing points are
   * accounted for.
   */
  readonly castCharges: readonly BatchCastCharge[];
  /** Aura uptime on the player, longest first. */
  readonly buffUptime: readonly BatchAuraUptime[];
  /**
   * Aura ids the raid buff selection held up for the whole fight, which the
   * panels leave out. Set by `runProfileBatch`; empty for a bare config.
   */
  readonly forcedAuraIds?: readonly string[];
  /** Aura uptime on the target, longest first. */
  readonly debuffUptime: readonly BatchAuraUptime[];
  /**
   * The buffs on the people a healer heals, each as its MEAN uptime across them
   * (round 60) -- Ancestral Healing and Riptide's heal over time. Empty outside
   * a healer fight, where the report is about the player's own buffs.
   */
  readonly healedBuffUptime: readonly BatchAuraUptime[];
  /**
   * Abilities the rotation actually cast that do less than they say.
   *
   * ----------------------------------------------------------------------------
   * THE SAME DISCIPLINE THE GEAR PANEL APPLIES TO ITEMS, for the same reason.
   *
   * Demoralizing Shout sits in the tank list at about 80% uptime and reduces
   * no damage at all, because the target's swing damage is stated outright
   * rather than derived from the attack power the debuff removes. Every
   * number on the page is consistent with it working. Nothing on the page
   * said it did not, until this.
   *
   * Only abilities that were CAST. An inert ability no list reaches is not a
   * caveat about this result, and listing it would bury the one that is.
   * ----------------------------------------------------------------------------
   */
  readonly castButNotSimulated: readonly CastButNotSimulated[];
  /**
   * The caveat on a PET, when this fight had one.
   *
   * --------------------------------------------------------------------------
   * A SEPARATE CHANNEL BECAUSE A PET IS NOT AN ABILITY. `castButNotSimulated`
   * is read off the player's ability book, so `PET_UNMODELLED` had no route to
   * the page at all -- it was written, exported, and referenced by nothing,
   * while its own comment claimed it was "printed in the app".
   *
   * That matters more than an ordinary gap: the pet's base DPS is an invented
   * number, and the project's rule for those is that a person has to be able
   * to see it. A placeholder nobody is told about is the failure mode the rule
   * exists to prevent.
   * --------------------------------------------------------------------------
   */
  readonly petCaveat?: string;
  /** Wall-clock time the batch took, in milliseconds. */
  readonly elapsedRealMs: number;
}

/**
 * Monte Carlo: run the same fight many times and summarise the spread.
 *
 * One fight tells you very little, because crit rolls and fight length move the
 * result several percent either way. The distribution is the actual answer, and
 * its relative error says whether two builds are really different or just
 * noisy.
 *
 * Kept out of the Simulation class deliberately: a Simulation runs one fight
 * and knows nothing about batches, which is what lets this runner later hand
 * iterations to Web Workers without the engine noticing.
 */
export function runBatch(config: SimulationConfig, options: BatchOptions): BatchResult {
  const iterations = Math.max(1, Math.floor(options.iterations));
  const startedAt = Date.now();

  const dpsSamples: number[] = new Array(iterations);
  const tpsSamples: number[] = new Array(iterations);
  const hpsSamples: number[] = new Array(iterations);
  let healingSoFar = 0;
  let alliedIds: readonly string[] = [];
  let threatSoFar = 0;
  const deathSamples: number[] = new Array(iterations);
  const seeds: number[] = new Array(iterations);
  const durations: number[] = new Array(iterations);
  let enemyIds: string[] = [];

  /*
   * ONE accumulator for the whole batch, not one per iteration. It holds
   * running sums and no events, so 2500 iterations cost the same memory as one.
   */
  const totals = new BatchTotals();
  let playerId = '';
  // Every friendly actor, for the damage breakdown. A pet is one of these.
  let friendlyIdsForReporting: readonly string[] = [];
  let rotationName: string | undefined;
  let damageSoFar = 0;
  let deathsSoFar = 0;
  /*
   * Read off the player's ABILITY BOOK rather than from a static table,
   * because what a character knows depends on their talents and their gear.
   * Captured once, on the first iteration, since every iteration builds the
   * same character.
   */
  let caveats: readonly { abilityName: string; reason: string }[] = [];
  let hasPetInFight = false;

  for (let index = 0; index < iterations; index++) {
    const seed = deriveSeed(options.baseSeed, index);
    seeds[index] = seed;

    // Aggregate as we go; the event stream for this iteration is discarded.
    const simulation = new Simulation({ ...config, seed }, totals);
    const run = simulation.run();

    const everyFriendly = run.actors
      .filter((actor) => actor.faction === 'friendly')
      .map((actor) => actor.id);
    /*
     * A NAMED PLAYER IS THE WHOLE REPORT. A healer fights beside a tank and a
     * raid whose damage, buffs and swings are not the healer's, so with a
     * `playerId` the friendly side counted is that one actor (round 52).
     */
    const friendlyIds = options.playerId ? [options.playerId] : everyFriendly;
    if (enemyIds.length === 0) {
      enemyIds = run.actors
        .filter((actor) => actor.faction === 'hostile')
        .map((actor) => actor.id);
    }

    // Per-second figures divide by IN-COMBAT time -- a dungeon route's gaps
    // are nobody's DPS. The whole fight for every other encounter.
    const elapsedSeconds = Math.max(toSeconds(run.inCombatMs), 0.001);
    durations[index] = run.elapsedMs;
    if (!playerId) {
      playerId = options.playerId ?? friendlyIds[0] ?? '';
      friendlyIdsForReporting = friendlyIds;
      alliedIds = everyFriendly.filter((id) => id !== playerId);
      rotationName = run.actors.find((actor) => actor.id === playerId)?.rotation;
      const player = simulation.combatants.find((actor) => actor.id === playerId);
      caveats = (player?.abilities.all ?? [])
        .filter((ability) => ability.unmodelled !== undefined)
        .map((ability) => ({ abilityName: ability.name, reason: ability.unmodelled! }));
      /*
       * A HUNTER'S PET ONLY. The caveat is Hunter-worded -- happiness, the
       * family modifier -- and a Warlock's demon is built by `createDemon`,
       * which uses neither. A Hunter's pet is the one that runs on FOCUS.
       */
      hasPetInFight = simulation.combatants.some(
        (actor) => actor.kind === 'pet' && actor.resources.get('focus') !== undefined,
      );
    }

    /*
     * DPS FOR THIS ITERATION ALONE. `totals` now runs for the whole batch, so
     * its total is cumulative and the per-iteration figure is the difference
     * since the last one. Reading the cumulative total here was the first
     * version of this and made iteration 2500 look 2500 times as good.
     */
    const cumulative = totals.totalForAny(friendlyIds);
    dpsSamples[index] = (cumulative - damageSoFar) / elapsedSeconds;
    damageSoFar = cumulative;

    // HEALING THE SAME WAY, the player's alone (round 52).
    const healingNow = totals.totalHealingForAny([playerId]);
    hpsSamples[index] = (healingNow - healingSoFar) / elapsedSeconds;
    healingSoFar = healingNow;

    // THREAT THE SAME WAY, the player's alone.
    const threatNow = totals.totalThreatFor(playerId);
    tpsSamples[index] = (threatNow - threatSoFar) / elapsedSeconds;
    threatSoFar = threatNow;

    /*
     * DEATHS THE SAME WAY, and for the same reason: one accumulator runs the
     * whole batch, so this iteration's count is the difference since the last.
     * THE PLAYER'S, not every friendly actor's -- which is the split `survival`
     * already makes, and a pet dying is not what a tank weight is avoiding.
     */
    const deathsSoFarNow = totals.totalDeathsFor(playerId);
    deathSamples[index] = deathsSoFarNow - deathsSoFar;
    deathsSoFar = deathsSoFarNow;

    totals.finishIteration(run.elapsedMs);

    options.onProgress?.((index + 1) / iterations);
  }

  const dps = summarize(dpsSamples);

  // Re-run the most typical iteration, this time recording everything. One
  // extra fight is a rounding error next to the batch, and it means the log the
  // user reads actually matches the headline number.
  const hps = summarize(hpsSamples);
  const representativeIndex =
    options.representativeBy === 'hps'
      ? indexClosestTo(hpsSamples, hps.median)
      : indexClosestTo(dpsSamples, dps.median);
  const representative = runSimulation({ ...config, seed: seeds[representativeIndex] });

  /*
   * EVERY FRIENDLY ACTOR, NOT JUST THE PLAYER.
   *
   * `dps` has summed the whole friendly side since batching was written, so a
   * breakdown covering only the player adds up to LESS than the DPS printed
   * beside it -- and a Beast Mastery hunter would show a third of its damage
   * missing with nothing on the page to say where it went.
   *
   * `playerId` still names the player alone for rage, buffs and survival,
   * which are genuinely the player's. Damage is the one thing a pet shares.
   */
  const abilities = totals.abilityBreakdown(friendlyIdsForReporting);

  return {
    iterations,
    baseSeed: options.baseSeed,
    dps,
    dpsSamples,
    tps: summarize(tpsSamples),
    tpsSamples,
    hps,
    hpsSamples,
    healing: totals.healingBreakdown(playerId),
    meanHealing: totals.meanHealingFor(playerId),
    alliedDeaths: totals.totalDeathsForAny(alliedIds) / iterations,
    ...(options.tankId ? { tankDeaths: totals.totalDeathsFor(options.tankId) / iterations } : {}),
    playerId,
    threat: totals.threatBreakdown(playerId),
    deathSamples,
    representative,
    rotationName,
    meanDamage: totals.meanDamageFor(playerId),
    meanDurationMs: durations.reduce((a, b) => a + b, 0) / Math.max(1, durations.length),
    abilities,
    damageTaken: totals.damageTaken(playerId),
    survival: totals.survival(playerId),
    stats: totals.statAverages(playerId),
    resources: totals
      .resourcesFor(playerId)
      .map((resource) => totals.resourceFlow(playerId, resource)),
    castCharges: totals.castChargesFor(playerId),
    /*
     * EVERY FRIENDLY ACTOR, for the same reason the damage breakdown covers
     * them: a talent the HUNTER spent points on can put a buff on its PET.
     * Frenzy is exactly that -- 30% attack speed after the pet crits -- and
     * reading the player alone made it invisible, so there was no way to tell
     * a working pet talent from an inert one.
     *
     * Debuffs stay on the target and rage stays on the player, which are
     * genuinely theirs.
     */
    buffUptime: friendlyIdsForReporting.flatMap((id) => totals.auraUptime(id, 'buff')),
    /*
     * Debuffs are read off the TARGET, not the player. "Sunder Armor uptime"
     * means how long the boss carried it, which is the only reading that
     * matters and the only one the aura lives on.
     *
     * THE FIRST ENEMY ONLY, which is the boss (round 57). With adds in the
     * fight, reading every enemy printed one row per target for the same aura
     * -- eight "Thunder Clap" rows on an eight-target fight -- and the boss is
     * what "on the target" has always meant. At one target it is the same list.
     */
    debuffUptime: enemyIds.slice(0, 1).flatMap((id) => totals.auraUptime(id, 'debuff')),
    healedBuffUptime: options.playerId ? meanUptime(alliedIds.map((id) => totals.auraUptime(id, 'buff'))) : [],
    castButNotSimulated: castButNotSimulated(caveats, abilities),
    // Present only when a pet was actually built, so a Lone Wolf hunter and a
    // sacrificed demon say nothing rather than carrying someone else's caveat.
    ...(hasPetInFight ? { petCaveat: PET_UNMODELLED } : {}),
    elapsedRealMs: Date.now() - startedAt,
  };
}

/** Run a batch described by a character profile. */
export function runProfileBatch(
  profile: CharacterProfile,
  onProgress?: (fraction: number) => void,
): BatchResult {
  return {
    ...runBatch(trainingDummyEncounter(profile), {
      iterations: profile.simulation.iterations,
      baseSeed: profile.simulation.seed,
      onProgress,
    }),
    /*
     * AND THE ASSUMED HEALER, by the owner's ask: the encounter forces it for
     * the whole fight whenever the target attacks back, so it is the same kind
     * of row as a raid buff -- 100% because of a setting.
     */
    forcedAuraIds: [
      ...raidForcedAuraIds(profile.raidBuffs),
      ...(profile.encounter.targetAttacks ? [EXTERNAL_HEALER.id] : []),
    ],
  };
}

/**
 * A healer's batch for one of the two fights (round 52): the report is about the
 * healer, and the combat log is the fight closest to the median HPS.
 */
export function runHealerBatch(
  profile: CharacterProfile,
  fight: HealerFight,
  onProgress?: (fraction: number) => void,
): BatchResult {
  return {
    ...runBatch(healerEncounter(profile, fight), {
      iterations: profile.simulation.iterations,
      baseSeed: profile.simulation.seed,
      onProgress,
      representativeBy: 'hps',
      playerId: HEALER_ID,
      tankId: TANK_ID,
    }),
    forcedAuraIds: raidForcedAuraIds(profile.raidBuffs),
  };
}

/**
 * The caveats that this fight actually earned: an ability was cast, and it
 * does less than it says.
 *
 * Matched on NAME, which is the key the breakdown uses. An ability whose
 * damage is reported under a different name -- Whirlwind's off-hand strike --
 * would not match, and correctly so: the caveat belongs to the cast.
 */
function castButNotSimulated(
  caveats: readonly { abilityName: string; reason: string }[],
  abilities: readonly BatchAbilityTotals[],
): readonly CastButNotSimulated[] {
  const uses = new Map(abilities.map((row) => [row.abilityName, row.uses]));

  return caveats
    .map((caveat) => ({ ...caveat, uses: uses.get(caveat.abilityName) ?? 0 }))
    .filter((entry) => entry.uses > 0)
    .sort((a, b) => b.uses - a.uses);
}

function indexClosestTo(values: readonly number[], target: number): number {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < values.length; index++) {
    const distance = Math.abs(values[index] - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

/**
 * Several actors' uptime tables as one: each aura's uptime averaged across ALL
 * of them, so a buff that sat on one of twenty for the whole fight reads 5%,
 * and its applications summed (round 60).
 */
function meanUptime(tables: readonly (readonly BatchAuraUptime[])[]): readonly BatchAuraUptime[] {
  if (tables.length === 0) return [];
  const byId = new Map<string, { row: BatchAuraUptime; uptime: number; applications: number }>();
  for (const table of tables) {
    for (const row of table) {
      const entry = byId.get(row.auraId) ?? { row, uptime: 0, applications: 0 };
      entry.uptime += row.uptime;
      entry.applications += row.applications;
      byId.set(row.auraId, entry);
    }
  }
  return [...byId.values()]
    .map(({ row, uptime, applications }) => ({ ...row, uptime: uptime / tables.length, applications }))
    .sort((a, b) => b.uptime - a.uptime);
}
