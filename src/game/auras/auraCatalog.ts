import type { AuraDefinition } from '../../engine';
import type { ClassId } from '../character';
import { ALL_PRIORITY_LISTS } from '../rotations/allLists';
import type { AplCondition } from '../rotations/apl';
import { RAID_BUFFS } from '../buffs/raidBuffs';
import { TALENT_AURAS } from './talentAuras';
import { talentsForClass } from '../talents/talentData';

import * as druidAuras from './druid';
import * as hunterAuras from './hunter';
import * as mageAuras from './mage';
import * as paladinAuras from './paladin';
import * as priestAuras from './priest';
import * as rogueAuras from './rogue';
import * as shamanAuras from './shaman';
import * as warlockAuras from './warlock';
import * as warriorAuras from './warrior';
import * as warriorTalentAuras from './warriorTalents';
import { CATALOG_AURAS as CONSUMABLE_AURAS } from './consumables';

/**
 * Which buffs and debuffs a class can be asked about in a priority list.
 *
 * ============================================================================
 * THIS EXISTS BECAUSE THE PANEL ASKED SOMEBODY TO TYPE AN AURA ID.
 *
 * The first version of the condition editor offered a free text box with a
 * datalist of ABILITY ids beside it, on the reasoning that most aura ids are
 * ability ids and there was no registry of the rest. Both halves were true and
 * the conclusion was wrong: it meant choosing a buff condition required already
 * knowing that Clearcasting is `clearcasting` and Fire Vulnerability is
 * `fire_vulnerability`, which is a thing you can only find by reading the
 * source or an external site.
 *
 * AND A HALF-TYPED ID IS WORSE THAN A WRONG ONE. An aura that does not exist is
 * never present, so `is up` is permanently FALSE and `has run out` is
 * permanently TRUE -- an entry silently disabled, or an entry silently
 * ungated, with nothing on screen to say which. A dropdown cannot produce
 * either.
 *
 * DERIVED, NOT WRITTEN DOWN. A hand-maintained list of every class's auras
 * would be a second place for a name to live and would be wrong the first time
 * somebody added an aura without thinking of it. Three sources, in order:
 *
 *   1. the class's own aura module, read as a namespace -- every
 *      `AuraDefinition` it exports
 *   2. every aura id the class's own STOCK LISTS mention, which is the safety
 *      net: whatever a list can ask about must be choosable, wherever the
 *      definition happens to live
 *   3. the talent auras and the raid buffs, which are shared and which lists
 *      genuinely ask about -- four Warrior lists gate on Battle Shout
 *
 * `auraCatalog.test.ts` ASSERTS (2) HOLDS FOR EVERY LIST, so an aura that moves
 * out of a class module fails a test instead of quietly dropping out of the
 * dropdown.
 * ============================================================================
 */

export interface CatalogAura {
  readonly id: string;
  readonly name: string;
  /** Debuffs are offered first when the clause is about the target. */
  readonly isDebuff: boolean;
}

const CLASS_AURA_MODULES: Readonly<Record<ClassId, readonly Record<string, unknown>[]>> = {
  druid: [druidAuras],
  hunter: [hunterAuras],
  mage: [mageAuras],
  paladin: [paladinAuras],
  priest: [priestAuras],
  rogue: [rogueAuras],
  shaman: [shamanAuras],
  warlock: [warlockAuras],
  // The Warrior's talent auras are their own module, which no other class has.
  warrior: [warriorAuras, warriorTalentAuras],
};

/**
 * Is this exported value an aura definition?
 *
 * Checked by SHAPE rather than by a marker, because the modules also export
 * durations, coefficients, id arrays and factory functions -- and because a
 * marker would be a thing to remember to add.
 */
function isAuraDefinition(value: unknown): value is AuraDefinition {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<AuraDefinition>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.durationMs === 'number'
  );
}

/**
 * Take an aura from an exported value, or a LIST of them.
 *
 * ----------------------------------------------------------------------------
 * THE LIST HALF IS WHAT FINDS A FACTORY-BUILT AURA. Walking a module's exports
 * finds every aura declared as a constant and none built by a function, which
 * silently cost the dropdowns 20 auras across nine classes -- Rip, Deep Wounds,
 * Ignite, Expose Armor, Deadly Poison and more. Each module that has factories
 * now exports a `CATALOG_AURAS` array built by calling them, so this one check
 * picks all of them up with no per-module wiring here.
 *
 * `SEAL_AURA_IDS` AND ITS KIND ARE SKIPPED, because an array of STRINGS is not
 * an array of definitions and `every` says so.
 * ----------------------------------------------------------------------------
 */
function addFrom(value: unknown, add: (aura: AuraDefinition) => void): void {
  if (isAuraDefinition(value)) {
    add(value);
    return;
  }
  if (Array.isArray(value) && value.length > 0 && value.every(isAuraDefinition)) {
    for (const aura of value) add(aura);
  }
}

/** Every aura id a condition tree mentions. */
function auraIdsIn(condition: AplCondition | undefined, found: Set<string>): void {
  if (!condition) return;
  if (condition.kind === 'aura' || condition.kind === 'auraTime' || condition.kind === 'auraStacks') {
    found.add(condition.auraId);
    return;
  }
  if (condition.kind === 'all' || condition.kind === 'any') {
    for (const part of condition.of) auraIdsIn(part, found);
    return;
  }
  if (condition.kind === 'not') auraIdsIn(condition.of, found);
}

/** The aura ids the stock lists belonging to a class mention. */
function idsFromStockLists(characterClass: ClassId): ReadonlySet<string> {
  const found = new Set<string>();
  for (const record of ALL_PRIORITY_LISTS) {
    if (record.owner !== characterClass) continue;
    for (const entry of record.list.entries) auraIdsIn(entry.condition, found);
  }
  return found;
}

/** `shadow_word_pain` to `Shadow Word Pain`, for an id with no definition. */
function prettify(id: string): string {
  return id
    .split('_')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/**
 * Every aura definition in the project, by id.
 *
 * The safety net below resolves against THIS rather than against the asking
 * class's own modules, so an id a list borrows from elsewhere keeps its real
 * name and its real `isDebuff`. The Druid's Bear list asks whether the target
 * has the WARRIOR's Demoralizing Shout -- without this it was offered as a
 * buff called "Demoralizing Shout" that the Druid could not see on itself.
 */
const EVERY_AURA: ReadonlyMap<string, AuraDefinition> = (() => {
  const all = new Map<string, AuraDefinition>();
  const modules = [
    druidAuras, hunterAuras, mageAuras, paladinAuras, priestAuras,
    rogueAuras, shamanAuras, warlockAuras, warriorAuras, warriorTalentAuras,
  ];
  for (const module of modules) {
    for (const value of Object.values(module)) {
      addFrom(value, (aura) => {
        if (!all.has(aura.id)) all.set(aura.id, aura);
      });
    }
  }
  for (const aura of CONSUMABLE_AURAS) if (!all.has(aura.id)) all.set(aura.id, aura);
  for (const aura of Object.values(TALENT_AURAS)) if (!all.has(aura.id)) all.set(aura.id, aura);
  for (const buff of RAID_BUFFS) {
    const aura = buff.aura;
    if (aura && !all.has(aura.id)) all.set(aura.id, aura);
  }
  return all;
})();

const CACHE = new Map<ClassId, readonly CatalogAura[]>();

/** A single aura's display name, for an id that came from a saved file. */
export function auraName(id: string): string {
  return EVERY_AURA.get(id)?.name ?? prettify(id);
}

/**
 * Every buff and debuff a priority list for this class may sensibly name.
 *
 * Sorted by name, because the dropdown is read alphabetically; the panel
 * groups them into buffs and debuffs and puts the group matching the clause's
 * subject first.
 */
export function aurasForClass(characterClass: ClassId): readonly CatalogAura[] {
  const cached = CACHE.get(characterClass);
  if (cached) return cached;

  const byId = new Map<string, CatalogAura>();
  const add = (aura: AuraDefinition) => {
    if (!byId.has(aura.id)) {
      byId.set(aura.id, { id: aura.id, name: aura.name, isDebuff: aura.isDebuff === true });
    }
  };

  for (const module of CLASS_AURA_MODULES[characterClass]) {
    for (const value of Object.values(module)) addFrom(value, add);
  }

  /*
   * THE MID-FIGHT CONSUMABLE BUFFS, FOR EVERY CLASS, which is the raid buff
   * compromise rather than the talent-aura one.
   *
   * A consumable belongs to no class, so there is no tree to narrow these by --
   * and this function is CACHED PER CLASS and so cannot see a selection at all.
   * That leaves offering them always or never: a Mage is offered Mighty Rage,
   * which only a Warrior or a Druid can drink, and that costs a reader one line
   * in a dropdown. Leaving them out instead costs anybody who HAS chosen one the
   * ability to gate on it, which is the failure this whole catalog exists to fix.
   */
  for (const aura of CONSUMABLE_AURAS) add(aura);

  /*
   * TALENT AURAS, NARROWED TO THIS CLASS'S OWN TALENTS.
   *
   * `TALENT_AURAS` is keyed by TALENT id and talent ids are unique only WITHIN
   * a class, so the record alone cannot attribute an entry -- but the TREE
   * can, and `talentsForClass` already carries every id a class has. Without
   * this every class's dropdown offered the Warrior's Anger Management.
   */
  const tree = talentsForClass(characterClass);
  for (const talentId of tree?.byId.keys() ?? []) {
    const aura = TALENT_AURAS[talentId];
    if (aura) add(aura);
  }

  /*
   * AND THE RAID BUFFS FOR EVERYONE, which is not the same compromise: a raid
   * buff genuinely is shared, and four Warrior lists gate on Battle Shout
   * while any class might reasonably ask whether one is up.
   */
  for (const buff of RAID_BUFFS) if (buff.aura) add(buff.aura);

  // The safety net: anything a stock list names must be choosable, wherever
  // its definition lives. An id with no definition anywhere still gets a
  // readable name rather than being left out.
  for (const id of idsFromStockLists(characterClass)) {
    if (byId.has(id)) continue;
    const known = EVERY_AURA.get(id);
    byId.set(
      id,
      known
        ? { id, name: known.name, isDebuff: known.isDebuff === true }
        : { id, name: prettify(id), isDebuff: false },
    );
  }

  const auras = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  CACHE.set(characterClass, auras);
  return auras;
}
