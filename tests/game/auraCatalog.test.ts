import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { aurasForClass, auraName } from '../../src/game/auras/auraCatalog';
import * as druidAuras from '../../src/game/auras/druid';
import * as hunterAuras from '../../src/game/auras/hunter';
import * as mageAuras from '../../src/game/auras/mage';
import * as paladinAuras from '../../src/game/auras/paladin';
import * as priestAuras from '../../src/game/auras/priest';
import * as rogueAuras from '../../src/game/auras/rogue';
import * as shamanAuras from '../../src/game/auras/shaman';
import * as warlockAuras from '../../src/game/auras/warlock';
import * as warriorAuras from '../../src/game/auras/warrior';
import * as warriorTalentAuras from '../../src/game/auras/warriorTalents';
import * as consumableAuras from '../../src/game/auras/consumables';
import { ALL_PRIORITY_LISTS } from '../../src/game/rotations/allLists';
import type { AplCondition } from '../../src/game/rotations/apl';
import { CLASS_IDS } from '../../src/game/character';
import type { ClassId } from '../../src/game/character';
import { AplEntries, aplNamesFor } from '../../src/ui/panels/AplPanel';
import { PRESETS_BY_ID } from '../../src/profiles/presets';

/*
 * ============================================================================
 * THE BUFF DROPDOWN HAS TO OFFER WHAT THE LISTS ALREADY NAME.
 *
 * The panel's first version asked somebody to TYPE an aura id, with a datalist
 * of ability ids beside it. That made a buff condition unreachable unless you
 * already knew that Fire Vulnerability is `fire_vulnerability` -- findable only
 * by reading the source.
 *
 * AND A HALF-TYPED ID IS WORSE THAN A WRONG ONE, which is what makes this worth
 * a test rather than a glance: an aura that does not exist is never present, so
 * `is up` is permanently FALSE and `has run out` is permanently TRUE. One
 * silently disables an entry and the other silently ungates it, and neither
 * shows up as anything but a rotation that performs differently than expected.
 * ============================================================================
 */

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

describe('the catalog covers what the stock lists ask about', () => {
  /*
   * THE ASSERTION THAT MATTERS. Anything a stock list can name must be
   * choosable from the dropdown, wherever its definition happens to live --
   * otherwise opening an entry and changing its buff means losing the one it
   * had, because the control cannot represent it.
   */
  it.each(ALL_PRIORITY_LISTS.filter((record) => record.owner !== 'pet').map(
    (record) => [record.list.name, record] as const,
  ))('%s: every aura it names is in the dropdown', (_name, record) => {
    const wanted = new Set<string>();
    for (const entry of record.list.entries) auraIdsIn(entry.condition, wanted);

    const offered = new Set(aurasForClass(record.owner as ClassId).map((aura) => aura.id));
    for (const id of wanted) {
      expect(offered.has(id), `${id} is not offered to a ${record.owner}`).toBe(true);
    }
  });

  it('gives every class a usable number of buffs and debuffs', () => {
    for (const characterClass of CLASS_IDS) {
      const auras = aurasForClass(characterClass);
      // A guard on the guard: an empty catalog would pass every check above
      // for a list that happens to use no buff conditions.
      expect(auras.length, characterClass).toBeGreaterThan(10);
      expect(auras.some((aura) => aura.isDebuff), `${characterClass} debuffs`).toBe(true);
      expect(auras.some((aura) => !aura.isDebuff), `${characterClass} buffs`).toBe(true);
    }
  });

  it('names everything, and never shows a raw id as a name', () => {
    for (const characterClass of CLASS_IDS) {
      for (const aura of aurasForClass(characterClass)) {
        expect(aura.name.length, aura.id).toBeGreaterThan(0);
        // `prettify` is the fallback and still produces something readable --
        // what should never appear is the snake_case id itself.
        expect(aura.name, aura.id).not.toMatch(/^[a-z0-9]+(_[a-z0-9]+)+$/);
      }
    }
  });

  it('does not offer one class the talent auras of another', () => {
    // `TALENT_AURAS` is keyed by TALENT id, and talent ids are unique only
    // WITHIN a class -- so a first version handed every class the Warrior's
    // Anger Management.
    const druid = aurasForClass('druid').map((aura) => aura.id);
    expect(druid).not.toContain('anger_management');
    expect(aurasForClass('warrior').map((aura) => aura.id)).toContain('anger_management');
  });

  it('resolves a borrowed aura to its real name and kind', () => {
    /*
     * The Druid's Bear list asks whether the TARGET has the Warrior's
     * Demoralizing Shout. Resolved against every module rather than the
     * Druid's own, it keeps its name and its `isDebuff` -- otherwise it
     * appeared under Buffs with a name derived from the id.
     */
    const borrowed = aurasForClass('druid').find((aura) => aura.id === 'demoralizing_shout');
    expect(borrowed).toBeDefined();
    expect(borrowed!.name).toBe('Demoralizing Shout');
    expect(borrowed!.isDebuff).toBe(true);
  });

  /*
   * ==========================================================================
   * THE STRUCTURAL CHECK, AND THE ONE THAT WOULD HAVE CAUGHT THE REAL BUG.
   *
   * The catalog finds an aura by walking a module's exports and keeping what
   * looks like an `AuraDefinition`. That finds every aura declared as a
   * CONSTANT and none built by a FACTORY -- so Rip, Deep Wounds, Ignite,
   * Expose Armor, Deadly Poison and fifteen others were simply absent from
   * every dropdown, and the owner found it by trying to gate Rip on Rip.
   *
   * NOTHING IN THE SUITE COULD HAVE SEEN IT, because every earlier assertion
   * was about ids the stock LISTS mention and no stock list happens to mention
   * Rip's aura -- the Cat gates Rip on combo points. So this reads the SOURCE
   * and asserts the catalog offers everything declared in it, which is the
   * same argument `rotationIds.test.ts` makes about lists the registry misses.
   * ==========================================================================
   */
  it('offers every aura the aura modules declare, however it is built', () => {
    const directory = 'src/game/auras';
    const offeredAnywhere = new Set<string>();
    for (const characterClass of CLASS_IDS) {
      for (const aura of aurasForClass(characterClass)) offeredAnywhere.add(aura.id);
    }

    const declared: { id: string; name: string; file: string }[] = [];
    for (const file of readdirSync(directory)) {
      if (!file.endsWith('.ts') || file === 'auraCatalog.ts') continue;
      const source = readFileSync(`${directory}/${file}`, 'utf8');
      // An aura definition is the one object shape carrying all three.
      // `\s` already matches a newline, so the pattern needs no explicit one.
      for (const match of source.matchAll(
        /id:\s*'([a-z0-9_]+)',\s*name:\s*'([^']+)',\s*durationMs:/g,
      )) {
        declared.push({ id: match[1], name: match[2], file });
      }
    }

    // A guard on the guard: a pattern that stopped matching would assert
    // nothing at all and pass forever.
    expect(declared.length).toBeGreaterThan(90);

    const missing = declared.filter((aura) => !offeredAnywhere.has(aura.id));
    expect(
      missing.map((aura) => `${aura.id} (${aura.file})`),
      'declared but offered to nobody -- a factory-built aura needs listing in its module CATALOG_AURAS',
    ).toEqual([]);
  });

  it('offers each one from a real DEFINITION, not from the stock-list safety net', () => {
    /*
     * ========================================================================
     * THE GUARD THE TEST ABOVE TURNED OUT NOT TO BE, FOUND BY A REGRESSION IT
     * PASSED THROUGH.
     *
     * Arcane Blast's aura was an exported CONSTANT and a patch made it a
     * FACTORY -- `arcaneBlastAura(intellect)`, because the figure depends on
     * the caster's Intellect. That is precisely the change `CATALOG_AURAS`
     * exists to catch, and it was not listed there.
     *
     * THE TEST ABOVE STILL PASSED, because `aurasForClass` ends with a SAFETY
     * NET: "anything a stock list names must be choosable, wherever its
     * definition lives". The Arcane list gates on `arcane_blast` stacks, so the
     * id kept being offered -- with a name derived from the id and nothing
     * else, where the definition carries the aura's own name and `isDebuff`.
     *
     * **A SAFETY NET MASKS THE THING IT IS A NET FOR**, which is the general
     * shape: a fallback that makes the common case work also makes the fault
     * invisible to any check that only asks whether the common case works.
     *
     * ------------------------------------------------------------------------
     * ASKED OF THE MODULES' OWN EXPORTS RATHER THAN OF THE SOURCE, which is the
     * second version of this test and the reason the first was thrown away.
     *
     * Parsing the source for factory calls inside `CATALOG_AURAS` needed a
     * pattern for the list, a pattern for each factory shape -- both
     * `export function foo` and `export const foo = (...) =>` are used here --
     * and a pattern for the id inside each body. It reported ELEVEN
     * correctly-listed auras as missing on its first run, because `[^\]]*`
     * truncated the list at `berserkAura([])`, whose argument contains a `]`.
     *
     * The modules answer the same question directly: an id is reachable if some
     * export carries it or if the module's own `CATALOG_AURAS` does. That is
     * what `aurasForClass` walks, minus the net, and it cannot be defeated by a
     * bracket.
     * ------------------------------------------------------------------------
     *
     * IT IS NOT A DUPLICATE OF THE TEST ABOVE. That one would still catch an
     * aura no list mentions AND no catalogue carries, which is the case Rip was
     * -- so both are kept and neither subsumes the other.
     * ========================================================================
     */
    const MODULES: Readonly<Record<string, Record<string, unknown>>> = {
      'druid.ts': druidAuras,
      'hunter.ts': hunterAuras,
      'mage.ts': mageAuras,
      'paladin.ts': paladinAuras,
      'priest.ts': priestAuras,
      'rogue.ts': rogueAuras,
      'shaman.ts': shamanAuras,
      'warlock.ts': warlockAuras,
      'warrior.ts': warriorAuras,
      'warriorTalents.ts': warriorTalentAuras,
      'consumables.ts': consumableAuras,
    };

    /** Every id some module makes reachable without the stock lists. */
    const reachable = new Set<string>();
    const looksLikeAura = (value: unknown): value is { id: string } =>
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { id?: unknown }).id === 'string' &&
      typeof (value as { name?: unknown }).name === 'string' &&
      typeof (value as { durationMs?: unknown }).durationMs === 'number';

    for (const module of Object.values(MODULES)) {
      for (const value of Object.values(module)) {
        if (looksLikeAura(value)) reachable.add(value.id);
        // `CATALOG_AURAS`, and any other exported array of definitions.
        if (Array.isArray(value)) {
          for (const entry of value) if (looksLikeAura(entry)) reachable.add(entry.id);
        }
      }
    }

    /*
     * AND WHAT THE SOURCE DECLARES, read the same way the test above reads it --
     * that half was never the fragile part, because an aura definition is the
     * one object shape carrying all three fields.
     */
    const directory = 'src/game/auras';
    const declared: { id: string; file: string }[] = [];
    for (const file of readdirSync(directory)) {
      if (!file.endsWith('.ts') || file === 'auraCatalog.ts') continue;
      const source = readFileSync(`${directory}/${file}`, 'utf8');
      for (const match of source.matchAll(
        /id:\s*'([a-z0-9_]+)',\s*name:\s*'([^']+)',\s*durationMs:/g,
      )) {
        declared.push({ id: match[1], file });
      }
    }

    // A guard on the guard: either side going empty would assert nothing.
    expect(declared.length).toBeGreaterThan(90);
    expect(reachable.size).toBeGreaterThan(60);

    const onlyViaTheNet = [
      ...new Set(
        declared
          .filter((aura) => !reachable.has(aura.id))
          .map((aura) => `${aura.id} (${aura.file})`),
      ),
    ];

    expect(
      onlyViaTheNet,
      'reachable only through the stock-list safety net -- a factory-built aura needs a representative call in its module CATALOG_AURAS',
    ).toEqual([]);
    /*
     * ========================================================================
     * 30 SECONDS, AND THE CAUSE IS TRANSFORM CONTENTION RATHER THAN THIS TEST.
     *
     * It timed out against the 5000ms default under the full suite and passes
     * standalone -- and the numbers say where the time goes. Run alone, this
     * file reports **test body 629ms against transform 16.76s and collect
     * 20.35s**: it imports eleven aura modules, which pull in the abilities,
     * talents and rotations behind them, and vitest attributes that work to
     * the first test that runs after collection.
     *
     * SO IT IS NOT THE `readdirSync` WALK, which is thirteen files, and it is
     * not a slow assertion. That distinguishes it from
     * `protectedChannelTicks.test.ts` and `stealthBreaking.test.ts`, whose
     * limits carry the same number for a DIFFERENT and separately counted
     * reason -- those really do read 215 files. **Two tests can need the same
     * limit for two causes**, and writing one cause onto the other is how a
     * note stops being worth reading.
     *
     * PER-TEST, because `vite.config.ts` sets no global `testTimeout` on
     * purpose: widening it everywhere would hide the next test that genuinely
     * gets slower.
     * ========================================================================
     */
  }, 30_000);

  it('names an aura from an id, for one that came out of a saved file', () => {
    expect(auraName('rend')).toBe('Rend');
    expect(auraName('something_invented')).toBe('Something Invented');
  });
});

describe('the control the dropdown replaced', () => {
  const renderEntries = (presetId: string) => {
    const profile = PRESETS_BY_ID.get(presetId)!.build();
    const { names, nameOf } = aplNamesFor(profile);
    return renderToStaticMarkup(
      createElement(AplEntries, {
        list: profile.rotation,
        names,
        nameOf,
        abilities: [],
        auras: aurasForClass(profile.character.characterClass),
        onChange: () => undefined,
      }),
    );
  };

  it('is a select with named options, not a text box', () => {
    const markup = renderEntries('druid_cat');
    // The Cat list gates Shred on Clearcasting and Rake on Rake.
    expect(markup).toContain('<optgroup label="Buffs"');
    expect(markup).toContain('Clearcasting');
    // The thing that was wrong: a free text input asking for an id.
    expect(markup).not.toContain('placeholder="buff id"');
  });

  it('puts the group matching the subject first', () => {
    /*
     * The Cat's Rake entry reads the TARGET's Rake, so that control should
     * offer debuffs before buffs; its Clearcasting entry reads the Cat's own
     * buff and should be the other way round.
     *
     * THE SELECT IS FOUND BY WHICH OPTION IS SELECTED, not by which options
     * exist. Every aura dropdown contains an option for every aura -- that is
     * the point of it -- so matching on `value="rake"` found the first control
     * on the page rather than Rake's, and compared a select against itself.
     */
    const markup = renderEntries('druid_cat');
    const selects = markup.split('<select').filter((part) => part.includes('<optgroup'));
    const selecting = (value: string) =>
      selects.find((part) => part.includes(`<option value="${value}" selected="">`));
    const debuffsFirst = (select: string) =>
      select.indexOf('label="Debuffs"') < select.indexOf('label="Buffs"');

    const targetSelect = selecting('rake');
    const selfSelect = selecting('clearcasting');
    expect(targetSelect, "the Rake clause's control").toBeDefined();
    expect(selfSelect, "the Clearcasting clause's control").toBeDefined();

    // Both list both groups; only the ORDER differs, so nothing is hidden.
    expect(targetSelect!).toContain('label="Buffs"');
    expect(selfSelect!).toContain('label="Debuffs"');
    expect(debuffsFirst(targetSelect!), 'target clause').toBe(true);
    expect(debuffsFirst(selfSelect!), 'self clause').toBe(false);
  });

  it('keeps an id it does not recognise rather than silently changing it', () => {
    /*
     * A hand-edited file or a renamed aura. Falling back to the first option
     * would rewrite somebody's condition to name something else the moment the
     * panel drew it -- an edit nobody made.
     */
    const profile = PRESETS_BY_ID.get('druid_cat')!.build();
    const { names, nameOf } = aplNamesFor(profile);
    const markup = renderToStaticMarkup(
      createElement(AplEntries, {
        list: {
          name: 'Test',
          entries: [
            {
              abilityId: 'shred',
              condition: { kind: 'aura', on: 'self', auraId: 'from_the_future', present: true },
            },
          ],
        },
        names,
        nameOf,
        abilities: [],
        auras: aurasForClass('druid'),
        onChange: () => undefined,
      }),
    );
    expect(markup).toContain('from_the_future');
    expect(markup).toContain('not in this build');
  });
});
