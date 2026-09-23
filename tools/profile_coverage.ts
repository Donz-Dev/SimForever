/*
 * What does each preset ACTUALLY simulate?
 *
 *   npx vite-node tools/profile_coverage.ts
 *   npx vite-node tools/profile_coverage.ts --markdown > docs/profile-coverage.md
 *
 * Every choice a preset makes -- race, style, stance, each talent, each item,
 * each enchant, each raid buff, and each ability the rotation reaches -- put
 * into one of three buckets:
 *
 *   FULL      every part of it is simulated
 *   PARTIAL   some of it is simulated and some is not, and it says which
 *   INERT     none of it changes a number in a result
 *
 * DERIVED, NOT TRANSCRIBED. Every classification below is read out of the
 * project's own `unmodelled` declarations at runtime, so this cannot drift
 * from the code the way a hand-written list would. Where a judgement cannot be
 * read out -- a talent that IS modelled but whose ability no rotation casts --
 * it is computed from the rotation rather than asserted.
 */
import { PROFILE_PRESETS } from '../src/profiles/presets';
import { talentBuild, talentContextFor } from '../src/game/talents/talentBuild';
import { weaponsFor } from '../src/game/actors/createPlayer';
import { talentsForClass } from '../src/game/talents/talentData';
import { WARRIOR_TALENT_EFFECTS } from '../src/game/talents/warriorEffects';
import { unmodelledEffects, liveEquipment } from '../src/game/items/equipment';
import { ITEMS_BY_ID, ENCHANTS_BY_ID } from '../src/game/items/itemData';
import { RAID_BUFFS_BY_ID } from '../src/game/buffs/raidBuffs';
import { warriorRotation } from '../src/game/rotations/warrior';
import { runSimulation } from '../src/simulator';
import { trainingDummyEncounter } from '../src/simulator/trainingDummyEncounter';
import { WARRIOR_ABILITIES } from '../src/game/abilities/warrior';
import { WARRIOR_TALENT_REACTIONS } from '../src/game/reactions/warriorTalents';

type Verdict = 'FULL' | 'PARTIAL' | 'INERT';

interface Row {
  readonly group: string;
  readonly name: string;
  readonly detail: string;
  readonly verdict: Verdict;
  readonly note: string;
}

const markdown = process.argv.includes('--markdown');

/**
 * Which abilities and auras this preset ACTUALLY exercises, MEASURED.
 *
 * Reading the priority list statically is not enough and gets real answers
 * wrong: Improved Rend modifies `rend`, the bleed's own id, while the list
 * casts `rend_cast`. A static check calls that talent dead when it is doing
 * its job every three seconds.
 *
 * So this runs the fight and collects every id the telemetry carries. Twelve
 * seeds, because a rarely-reached entry -- Execute below 20% health, Revenge
 * after an avoided blow -- can miss a single fight.
 */
function idsExercised(profile: ReturnType<(typeof PROFILE_PRESETS)[number]['build']>): Set<string> {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 12; seed += 1) {
    const timeline = runSimulation(
      trainingDummyEncounter({
        ...profile,
        simulation: { ...profile.simulation, seed },
      } as never),
    ).timeline as readonly Record<string, unknown>[];
    for (const event of timeline) {
      const id = event.abilityId ?? event.auraId;
      if (typeof id === 'string') seen.add(id);
    }
  }
  return seen;
}

function coverage(preset: (typeof PROFILE_PRESETS)[number]): readonly Row[] {
  const profile = preset.build();
  const rows: Row[] = [];
  const style = profile.character.combatStyle;
  const stance = profile.character.stance;
  const cast = idsExercised(profile);
  const rotation = warriorRotation(style as never, stance as never);
  const listed = new Set(
    (rotation as unknown as { entries?: readonly { abilityId: string }[] }).entries?.map(
      (e) => e.abilityId,
    ) ?? [],
  );

  // -- the character itself -------------------------------------------------
  rows.push({
    group: 'Character',
    name: 'Race',
    detail: profile.character.race,
    verdict: 'FULL',
    note: 'Base stats come from the generated table; racials are not modelled for any race.',
  });
  rows.push({
    group: 'Character',
    name: 'Combat style',
    detail: style,
    verdict: 'FULL',
    note: 'Decides which equipment slots resolve, which attack tables apply, and which rotation runs.',
  });
  rows.push({
    group: 'Character',
    name: 'Stance',
    detail: stance,
    verdict: 'FULL',
    note: 'Its aura is applied and its modifiers apply; it also selects the priority list.',
  });
  rows.push({
    group: 'Character',
    name: 'Target attacks back',
    detail: String(profile.encounter.targetAttacks),
    verdict: 'FULL',
    note: profile.encounter.targetAttacks
      ? 'Ramping damage, the assumed healer and deaths are all simulated.'
      : 'Off, so the target never swings and nothing keyed to being hit can fire.',
  });

  // -- talents --------------------------------------------------------------
  /*
   * `talentContextFor` and not a bare weapons map -- the same function
   * `createPlayer` and the Talent panel use. Passing only the weapons makes
   * every gear-conditional talent report "this character is not holding one"
   * however the character is geared: it read Bastion as inert on a warrior
   * carrying a shield, because a shield is not a weapon.
   */
  const build = talentBuild(
    'warrior',
    profile.talents,
    talentContextFor(profile.equipment, style, weaponsFor(profile.equipment, style)),
  );
  const byId = talentsForClass('warrior')?.byId;
  const unmodelledById = new Map<string, { name: string; reasons: string[] }>();
  for (const u of build.unmodelled) {
    const entry = unmodelledById.get(u.talentId) ?? { name: u.name, reasons: [] };
    entry.reasons.push(u.reason);
    unmodelledById.set(u.talentId, entry);
  }

  for (const [id, rank] of Object.entries(profile.talents)) {
    if (!rank) continue;
    const gap = unmodelledById.get(id);
    /*
     * PARTIAL vs INERT is decided by the talent's own effect list: if every
     * declared effect is `unmodelled` the talent changes nothing, and if some
     * are modelled it does part of its job. Read from the declaration rather
     * than guessed, so a talent that gains an effect reclassifies itself.
     */
    const declared = WARRIOR_TALENT_EFFECTS[id] ?? [];
    const modelled = declared.filter((e) => e.kind !== 'unmodelled');

    let verdict: Verdict;
    if (!gap) verdict = 'FULL';
    else if (modelled.length > 0) verdict = 'PARTIAL';
    else verdict = 'INERT';

    /*
     * AND THEN THE CONTEXT, which is the question actually being asked. A
     * talent can be fully implemented in the engine and still change no number
     * in THIS profile, because the thing it modifies never happens here.
     * Derived, not listed by hand:
     *
     *   - an effect naming an `abilityId` needs that ability in the priority
     *     list. Improved Cleave is the example: Cleave is in no list.
     *   - a reaction with `on: 'taken'` needs the target to swing back.
     *   - a defensive stat is only read when something is attacking you.
     */
    const contextNotes: string[] = [];
    const abilityIds = new Set(
      modelled
        .map((e) => (e as { abilityId?: string }).abilityId)
        .filter((a): a is string => a !== undefined),
    );
    if (abilityIds.size > 0 && [...abilityIds].every((a) => !cast.has(a))) {
      const names = [...abilityIds]
        .map((a) => WARRIOR_ABILITIES.find((w) => w.id === a)?.name ?? a)
        .join(', ');
      /*
       * WHY it is unused is the useful half. An ability the list never mentions
       * is a different problem from one the list mentions and never reaches --
       * the first is a build choice, the second is a rage economy.
       */
      const inList = [...abilityIds].some((a) => listed.has(a));
      contextNotes.push(
        inList
          ? `${names} is in the priority list but never reached in 12 fights -- ` +
            `higher entries take the rage.`
          : `${names} is in no priority list for this build.`,
      );
    }

    const reactionIds = modelled
      .filter((e) => e.kind === 'reaction')
      .map((e) => (e as { reactionId: string }).reactionId);
    const onTaken = reactionIds.filter((rid) => {
      const builder = WARRIOR_TALENT_REACTIONS[rid];
      try {
        return builder ? builder(1).on === 'taken' : false;
      } catch {
        return false;
      }
    });
    if (
      onTaken.length > 0 &&
      onTaken.length === reactionIds.length &&
      !profile.encounter.targetAttacks
    ) {
      contextNotes.push('Triggers off being hit, and the target never swings here.');
    }

    const DEFENSIVE = ['parryChance', 'dodgeChance', 'blockChance', 'defense', 'armor'];
    const stats = modelled
      .filter((e) => e.kind === 'stat')
      .map((e) => (e as { stat: string }).stat);
    if (
      stats.length > 0 &&
      stats.length === modelled.length &&
      stats.every((st) => DEFENSIVE.includes(st)) &&
      !profile.encounter.targetAttacks
    ) {
      contextNotes.push(`${stats.join(', ')} is only read when something attacks you.`);
    }

    if (id === 'improved_tactical_mastery') {
      // Its own note says it better than the derived one, which lists all
      // three stances because the effect names all three.
      contextNotes.length = 0;
      contextNotes.push('Retains rage through a stance change; this list never changes stance.');
    }

    /*
     * A CONTEXT NOTE OVERRIDES PARTIAL. "Partial" has to mean some of it works
     * HERE, or it is a comforting word for a talent that does nothing. Sweeping
     * Strikes is the case: its ability is granted (so, partial in the engine)
     * but it needs a second enemy AND is never cast -- inert in this profile.
     *
     * The context checks only fire when EVERY ability a talent touches is
     * unused, so this cannot hide a talent that is half-live.
     */
    if (contextNotes.length > 0) verdict = 'INERT';

    rows.push({
      group: 'Talents',
      name: byId?.get(id)?.name ?? gap?.name ?? id,
      detail: `${rank} point${rank === 1 ? '' : 's'}`,
      verdict,
      note: [...(gap?.reasons ?? []), ...contextNotes].join(' '),
    });
  }

  // -- gear -----------------------------------------------------------------
  const live = liveEquipment(profile.equipment, style);
  const gaps = unmodelledEffects(profile.equipment, style);
  const gapsByItem = new Map<string, string[]>();
  for (const g of gaps) {
    gapsByItem.set(g.itemName, [...(gapsByItem.get(g.itemName) ?? []), g.text]);
  }
  for (const [slot, equipped] of Object.entries(live)) {
    if (!equipped) continue;
    const item = ITEMS_BY_ID.get(equipped.itemId);
    if (!item) continue;
    const itemGaps = gapsByItem.get(item.name) ?? [];
    rows.push({
      group: 'Gear',
      name: item.name,
      detail: slot,
      verdict: itemGaps.length === 0 ? 'FULL' : 'PARTIAL',
      note: itemGaps.join(' | '),
    });
    if (equipped.enchantId !== undefined) {
      const enchant = ENCHANTS_BY_ID.get(equipped.enchantId);
      if (enchant) {
        const enchantGaps = gapsByItem.get(enchant.name) ?? [];
        rows.push({
          group: 'Gear',
          name: `${enchant.name} (enchant)`,
          detail: slot,
          verdict: enchantGaps.length === 0 ? 'FULL' : 'PARTIAL',
          note: enchantGaps.join(' | '),
        });
      }
    }
  }

  // -- raid buffs -----------------------------------------------------------
  for (const id of profile.raidBuffs) {
    const buff = RAID_BUFFS_BY_ID.get(id);
    if (!buff) continue;
    rows.push({
      group: 'Raid buffs',
      name: buff.name,
      detail: buff.source,
      verdict: buff.unmodelled ? 'PARTIAL' : 'FULL',
      note: buff.unmodelled ?? '',
    });
  }

  // -- the priority list ----------------------------------------------------
  for (const abilityId of listed) {
    const ability = WARRIOR_ABILITIES.find((a) => a.id === abilityId);
    if (!ability) {
      rows.push({
        group: 'Rotation',
        name: abilityId,
        detail: 'unresolvable id',
        verdict: 'INERT',
        note: 'No ability with this id: PriorityRotation skips it silently.',
      });
      continue;
    }
    const everCast = cast.has(abilityId);
    /*
     * NEVER CAST IS NOT THE SAME AS DEAD. Battle Stance and Battle Shout sit
     * at the top of every list guarded by "if not already active", and both
     * are already active before the first global cooldown -- the stance from
     * the character's own opening aura, Battle Shout from the raid. The guard
     * working is the entry doing its job.
     *
     * Told apart by whether the AURA is up: if the effect is present and the
     * cast never happened, nothing is missing.
     */
    const auraId = abilityId.replace(/_cast$/, '');
    const effectPresent = cast.has(auraId);

    let verdict: Verdict;
    let note = ability.unmodelled ?? '';
    if (ability.unmodelled) {
      verdict = 'PARTIAL';
    } else if (everCast) {
      verdict = 'FULL';
    } else if (effectPresent) {
      verdict = 'FULL';
      note = 'Never cast in 12 fights, and never needed: its effect is already up.';
    } else {
      verdict = 'INERT';
      note = 'Listed but never reached in 12 fights.';
    }

    rows.push({ group: 'Rotation', name: ability.name, detail: abilityId, verdict, note });
  }

  return rows;
}

// ---------------------------------------------------------------------------

const MARK: Record<Verdict, string> = {
  FULL: '**Full**',
  PARTIAL: '**Partial**',
  INERT: '**Inert**',
};

for (const preset of PROFILE_PRESETS) {
  const rows = coverage(preset);
  const tally = (v: Verdict) => rows.filter((r) => r.verdict === v).length;

  if (markdown) {
    console.log(`\n## ${preset.label}\n`);
    console.log(`${preset.detail}\n`);
    console.log(
      `**${tally('FULL')} full, ${tally('PARTIAL')} partial, ${tally('INERT')} inert** ` +
        `across ${rows.length} choices.\n`,
    );
    let group = '';
    for (const r of rows) {
      if (r.group !== group) {
        group = r.group;
        console.log(`\n### ${group}\n`);
        console.log('| | | | |');
        console.log('| --- | --- | --- | --- |');
      }
      console.log(`| ${r.name} | ${r.detail} | ${MARK[r.verdict]} | ${r.note} |`);
    }
  } else {
    console.log(`\n${'='.repeat(78)}\n${preset.label}  --  ${preset.detail}`);
    console.log(
      `${tally('FULL')} full, ${tally('PARTIAL')} partial, ${tally('INERT')} inert ` +
        `(${rows.length} choices)\n`,
    );
    let group = '';
    for (const r of rows) {
      if (r.group !== group) {
        group = r.group;
        console.log(`-- ${group} ${'-'.repeat(70 - group.length)}`);
      }
      const flag = r.verdict.padEnd(8);
      console.log(`  ${flag} ${r.name.padEnd(34)} ${r.detail}`);
      if (r.note) console.log(`           ${' '.repeat(34)} ${r.note}`);
    }
  }
}
