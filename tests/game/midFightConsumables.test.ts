import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import { buildSimulation } from '../helpers/buildSimulation';
import { createDefaultProfile } from '../../src/profiles';
import { PROFILE_PRESETS } from '../../src/profiles/presets';
import { stockListFor, syncDefaultRotation } from '../../src/profiles/rotation';
import { abilityBookFor } from '../../src/ui/panels/AplPanel';
import { aurasForClass } from '../../src/game/auras/auraCatalog';
import {
  CONSUMABLE_ABILITY_IDS,
  consumableAbilities,
  consumableEffects,
  consumableOptionsFor,
  CONSUMABLE_CATEGORIES_BY_ID,
} from '../../src/game/buffs/consumables';
import {
  DEMONIC_RUNE_MAXIMUM_HEALTH,
  DEMONIC_RUNE_MAXIMUM_MANA,
  DEMONIC_RUNE_MINIMUM_HEALTH,
  DEMONIC_RUNE_MINIMUM_MANA,
  HEALTHSTONE_HEALTH,
  MAJOR_HEALING_POTION_MAXIMUM,
  MAJOR_HEALING_POTION_MINIMUM,
  MAJOR_MANA_POTION_MAXIMUM,
  MAJOR_MANA_POTION_MINIMUM,
  MID_FIGHT_CONSUMABLE_ABILITIES,
  MIGHTY_RAGE_POTION_MAXIMUM_RAGE,
  MIGHTY_RAGE_POTION_MINIMUM_RAGE,
  POTION_COOLDOWN_GROUP,
  POTION_COOLDOWN_MS,
  THISTLE_TEA_ENERGY,
  THISTLE_TEA_COOLDOWN_MS,
} from '../../src/game/abilities/consumables';
import type { CharacterProfile } from '../../src/profiles';
import type { ClassId } from '../../src/game/character';

/*
 * ==============================================================================
 * THE MID-FIGHT CONSUMABLES: NINE ABILITIES, TWO CATEGORIES.
 *
 * Every figure below is written out BY HAND from the ruleset owner's table and
 * their four rulings on it, never read back out of the code under test. The
 * table:
 *
 *   Potion   Major Healing Potion        1050-1750 Hit Points
 *            Major Mana Potion           1350-2250 Mana
 *            Mighty Rage Potion          45-75 Rage, +60 Strength for 20s
 *                                        (Warrior, Druid)
 *            Major Frenzy Potion         +40 Attack Power and Ranged for 30s
 *            Major Mender's Potion       +75 Healing Power for 30s
 *            Major Spellblasting Potion  +40 Spell Power for 30s
 *            -- all on a shared 2 minute cooldown
 *
 *   Other    Thistle Tea                 100 Energy, 5 min (Rogue, Druid)
 *            Demonic Rune                900-1500 Mana for 600-1000 Hit
 *                                        Points, 2 min
 *            Healthstone                 1440 Hit Points, 2 min
 *
 * THE FOUR RULINGS, each of which is a test below rather than a comment:
 *   - all nine are OFF the global cooldown
 *   - a heal's stated range is the whole answer: no crit, no scaling
 *   - the Demonic Rune is REFUSED rather than allowed to kill
 *   - every preset gets one, which is the commit after this one
 *
 * WHAT THESE TESTS ARE AIMED AT is the shape of failure this project keeps
 * paying for: an ability that is declared, selectable, castable and silently
 * does nothing. Adrenaline Rush reported 24.9% uptime for the life of the
 * project while delivering no energy; `lone_wolf` left both Hunter profiles
 * named after it without its aura. So each one asserts the MECHANISM'S OWN
 * QUANTITY -- the mana that arrived, the attack power the aura moved -- and not
 * that a cast happened.
 * ==============================================================================
 */

const PROFILE_CLASSES: readonly ClassId[] = [
  'warrior', 'rogue', 'druid', 'shaman', 'mage', 'paladin', 'hunter', 'warlock', 'priest',
];

/**
 * A race that may actually be this class.
 *
 * A Human cannot be a Druid or a Shaman, and `baseStatsFor` THROWS on the
 * combination rather than guessing -- which is the right behaviour and is what
 * caught this test handing every class a Human.
 */
const raceFor = (characterClass: ClassId) =>
  characterClass === 'druid' || characterClass === 'shaman' ? 'tauren' : 'human';

/** A character built with a selection, through the one path the fight uses. */
function drinker(characterClass: ClassId, consumables: Record<string, string>) {
  return createPlayer({ race: raceFor(characterClass), characterClass, consumables });
}

/** A simulation around one drinker and a dummy, begun and ready to be told. */
function fight(player: ReturnType<typeof createPlayer>) {
  const dummy = createTrainingDummy({ name: 'D', health: 100_000, armor: 0, level: 63 });
  const sim = buildSimulation([player, dummy]);
  sim.begin();
  return { sim, dummy };
}

const profileWith = (
  characterClass: ClassId,
  consumables: Record<string, string>,
): CharacterProfile => {
  const base = createDefaultProfile();
  return syncDefaultRotation({
    ...base,
    character: { ...base.character, characterClass, race: raceFor(characterClass) },
    consumables,
  });
};

// ---------------------------------------------------------------------------
// The catalogue, and who may drink what
// ---------------------------------------------------------------------------

describe('the two mid-fight categories', () => {
  it('gives every option an ability, and only these two categories do', () => {
    /*
     * THE DIVIDING LINE OF THE WHOLE FEATURE: a consumable with an `ability` is
     * used DURING the fight and one without it is a layer of the starting stat
     * block. Asserted in both directions, because an ability appearing on a
     * flask would put a Flask entry in every priority list.
     */
    for (const category of CONSUMABLE_CATEGORIES_BY_ID.values()) {
      const midFight = category.id === 'potion' || category.id === 'other';
      for (const option of category.options) {
        expect(option.ability !== undefined, `${category.id}/${option.id}`).toBe(midFight);
      }
    }
  });

  it('declares exactly nine of them, and the id set is derived from the table', () => {
    expect(MID_FIGHT_CONSUMABLE_ABILITIES).toHaveLength(9);
    expect([...CONSUMABLE_ABILITY_IDS].sort()).toEqual(
      MID_FIGHT_CONSUMABLE_ABILITIES.map((ability) => ability.id).sort(),
    );
  });

  it('offers the Mighty Rage Potion to a Warrior and a Druid and to nobody else', () => {
    const potion = CONSUMABLE_CATEGORIES_BY_ID.get('potion')!;
    for (const characterClass of PROFILE_CLASSES) {
      const offered = consumableOptionsFor(potion, characterClass).map((option) => option.id);
      const allowed = characterClass === 'warrior' || characterClass === 'druid';
      expect(offered.includes('mighty_rage_potion'), characterClass).toBe(allowed);
      // And the unrestricted five are offered to everybody, so the gate is on
      // the one entry rather than on the row.
      expect(offered.includes('major_mana_potion'), characterClass).toBe(true);
    }
  });

  it('offers Thistle Tea to a Rogue and a Druid and to nobody else', () => {
    const other = CONSUMABLE_CATEGORIES_BY_ID.get('other')!;
    for (const characterClass of PROFILE_CLASSES) {
      const offered = consumableOptionsFor(other, characterClass).map((option) => option.id);
      const allowed = characterClass === 'rogue' || characterClass === 'druid';
      expect(offered.includes('thistle_tea'), characterClass).toBe(allowed);
    }
  });

  it('contributes no starting stats, which is what separates it from a flask', () => {
    /*
     * A potion is drunk DURING the fight, so none of it may arrive in the
     * starting stat block. The failure this guards is a Major Frenzy Potion
     * whose 40 attack power was granted twice -- once as a stat at the pull and
     * once by its aura -- which would be a bigger number and no error.
     */
    const effects = consumableEffects({
      potion: 'major_frenzy_potion',
      other: 'healthstone',
    });
    expect(effects.stats).toEqual({});
    expect(effects.bonusHitPoints).toBe(0);
    expect(effects.schoolPower).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Reaching the ability book
// ---------------------------------------------------------------------------

describe('what selecting one does to the ability book', () => {
  it('is absent until it is selected, and present after', () => {
    expect(drinker('mage', {}).abilities.has('major_mana_potion')).toBe(false);
    expect(
      drinker('mage', { potion: 'major_mana_potion' }).abilities.has('major_mana_potion'),
    ).toBe(true);
  });

  it('lets a character hold one Potion AND one Other, which are separate categories', () => {
    /*
     * THE OWNER'S OWN RULE: the Other items "are not exclusive with Potions BUT
     * ARE EXCLUSIVE with all items in the Other category". Both halves fall out
     * of a selection keyed by category, so this is the shape being asserted
     * rather than a check somebody has to run.
     */
    const player = drinker('warlock', {
      potion: 'major_mana_potion',
      other: 'demonic_rune',
    });
    expect(player.abilities.has('major_mana_potion')).toBe(true);
    expect(player.abilities.has('demonic_rune')).toBe(true);
  });

  it('refuses one the class may not drink, rather than refusing to build', () => {
    /*
     * A HAND-EDITED PROFILE IS THE CASE THIS IS FOR, or one saved as a Warrior
     * and loaded after a class change. The panel does not offer it; the
     * character is built WITHOUT the ability rather than not built at all,
     * which is the rule `startingEquipmentFor` follows for a stale item id.
     */
    const mage = drinker('mage', { potion: 'mighty_rage_potion' });
    expect(mage.abilities.has('mighty_rage_potion')).toBe(false);
    expect(consumableAbilities('mage', { potion: 'mighty_rage_potion' })).toEqual([]);
    // And the two classes that may keep it.
    expect(drinker('warrior', { potion: 'mighty_rage_potion' }).abilities.has('mighty_rage_potion'))
      .toBe(true);
    expect(drinker('druid', { potion: 'mighty_rage_potion' }).abilities.has('mighty_rage_potion'))
      .toBe(true);
  });

  it('shows the panel exactly what the fight will carry', () => {
    /*
     * ==========================================================================
     * THE TWO COMPOSITIONS THAT MUST NOT DRIFT. `createPlayer` appends
     * `consumableAbilities` to its book and `abilityBookFor` appends the same
     * ones for the dropdown -- two call sites, which is the shape this project
     * has been bitten by repeatedly.
     *
     * BOTH DIRECTIONS FAIL DIFFERENTLY AND BOTH ARE SILENT. A potion in the
     * dropdown and not in the fight is an entry that never fires; one in the
     * fight and not in the dropdown is an entry nobody can add back after
     * deleting it, which is exactly what happened to the racials.
     * ==========================================================================
     */
    for (const characterClass of PROFILE_CLASSES) {
      const selection = { potion: 'major_mana_potion', other: 'healthstone' };
      const profile = profileWith(characterClass, selection);
      const panel = abilityBookFor(profile)
        .map((ability) => ability.id)
        .filter((id) => CONSUMABLE_ABILITY_IDS.has(id));
      const built = createPlayer({
        race: raceFor(characterClass),
        characterClass,
        consumables: selection,
      })
        .abilities.all.map((ability) => ability.id)
        .filter((id) => CONSUMABLE_ABILITY_IDS.has(id));
      expect(panel.sort(), characterClass).toEqual(built.sort());
      expect(panel.sort(), characterClass).toEqual(['healthstone', 'major_mana_potion']);
    }
  });
});

// ---------------------------------------------------------------------------
// Reaching the priority list
// ---------------------------------------------------------------------------

describe('what selecting one does to the priority list', () => {
  it('puts no entry in the list until something is selected', () => {
    /*
     * THE CONTAINMENT PROPERTY OF THIS WHOLE COMMIT. The shared constant names
     * all nine in every one of the 25 stock lists; `stockListFor` narrows it to
     * what the profile carries. A build that drank nothing therefore runs
     * exactly the list it ran before any of this existed, which is why no
     * published figure moves.
     */
    for (const characterClass of PROFILE_CLASSES) {
      const list = stockListFor(profileWith(characterClass, {}));
      const found = (list?.entries ?? [])
        .map((entry) => entry.abilityId)
        .filter((id) => CONSUMABLE_ABILITY_IDS.has(id));
      expect(found, characterClass).toEqual([]);
    }
  });

  it('puts exactly the selected one in, and nothing else', () => {
    const list = stockListFor(profileWith('mage', { potion: 'major_mana_potion' }));
    const found = (list?.entries ?? [])
      .map((entry) => entry.abilityId)
      .filter((id) => CONSUMABLE_ABILITY_IDS.has(id));
    expect(found).toEqual(['major_mana_potion']);
  });

  it('appears in a default list the moment the selection changes', () => {
    /*
     * THE OWNER'S ASK, END TO END: "when a potion is selected it will then
     * become visible on the APL so the user can place it amongst their rotation
     * with conditions."
     *
     * It needed no new mechanism. `editProfile` in `App.tsx` already runs
     * `syncDefaultRotation` on every change a panel makes, and its own comment
     * predicted this case -- "applied to every change rather than to the four
     * that can matter, because the alternative is a list of edits that change
     * which stock list applies that is correct until somebody adds a fifth".
     */
    const before = profileWith('mage', {});
    expect(before.rotation.entries.some((entry) => entry.abilityId === 'major_mana_potion'))
      .toBe(false);

    const after = syncDefaultRotation({
      ...before,
      consumables: { potion: 'major_mana_potion' },
    });
    const entry = after.rotation.entries.find((e) => e.abilityId === 'major_mana_potion');
    expect(entry).toBeDefined();
    // With the condition and the note that travel with it, which is what makes
    // the entry something a person can act on rather than a bare line.
    expect(entry?.condition).toBeDefined();
    expect(entry?.note).toContain('mana');
    // And a `default` list stays default: this is a re-derivation, not an edit.
    expect(after.rotation.source).toBe('default');
  });

  it('leaves a custom list alone, selection or no selection', () => {
    // The freezing. Somebody's own list is never silently rewritten, which is
    // the whole purpose of `source`.
    const custom: CharacterProfile = {
      ...profileWith('mage', {}),
      rotation: { source: 'custom', name: 'Mine', entries: [{ abilityId: 'fireball' }] },
    };
    const after = syncDefaultRotation({ ...custom, consumables: { potion: 'major_mana_potion' } });
    expect(after.rotation.entries).toEqual([{ abilityId: 'fireball' }]);
  });

  it('gives a tank its heals beside the survival cooldowns, not at the bottom', () => {
    /*
     * A TANK LIST PUTS THE FREE ENTRIES LAST and that is exactly wrong for a
     * healing potion: the bottom of a tank list is a place entries are not
     * REACHED, which is how five of seven racials came back inert when they
     * were tried there. So the heals go with Last Stand and Shield Wall.
     *
     * Asserted as "above the rotation proper" rather than at an index, which is
     * the lesson `protectionRotation.test.ts` learned when Charge was inserted.
     */
    const base = createDefaultProfile();
    const tank = syncDefaultRotation({
      ...base,
      character: {
        ...base.character,
        characterClass: 'warrior',
        combatStyle: 'one_hand_shield',
        stance: 'defensive',
      },
      consumables: { potion: 'major_healing_potion', other: 'healthstone' },
    });
    const ids = tank.rotation.entries.map((entry) => entry.abilityId);
    expect(ids).toContain('major_healing_potion');
    expect(ids.indexOf('major_healing_potion')).toBeLessThan(ids.indexOf('shield_slam'));
    expect(ids.indexOf('healthstone')).toBeLessThan(ids.indexOf('shield_slam'));
    // And below the two cooldowns that are the bigger answer to the same
    // question, so the cheap one is not spent first.
    expect(ids.indexOf('shield_wall_cast')).toBeLessThan(ids.indexOf('major_healing_potion'));
  });

  it('leaves every preset with no consumable entry, so no figure can move', () => {
    /*
     * THE OTHER HALF OF CONTAINMENT, read off the presets themselves rather
     * than off a class. `withStockRotations` runs `syncDefaultRotation` on each
     * preset's built profile, so this is what the measured 25 actually run.
     */
    for (const preset of PROFILE_PRESETS) {
      const profile = preset.build();
      const found = profile.rotation.entries
        .map((entry) => entry.abilityId)
        .filter((id) => CONSUMABLE_ABILITY_IDS.has(id));
      expect(found, preset.id).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// The global cooldown, and the shared one
// ---------------------------------------------------------------------------

describe('the cooldowns', () => {
  it('starts no global cooldown, on the owner’s ruling', () => {
    /*
     * ==========================================================================
     * BEING OFF THE GLOBAL COOLDOWN MEANS ONE THING -- the ability does not
     * START one -- and what it buys is that the action AFTER it is free.
     *
     * THE MISTAKE IS INVISIBLE IN EVERYTHING EXCEPT THE DPS. An ability wrongly
     * taking a global cooldown still restores the right pool for the right
     * amount on the right cooldown, which is why four of the five racials
     * declare this in their own line and why all nine of these do.
     * ==========================================================================
     */
    for (const ability of MID_FIGHT_CONSUMABLE_ABILITIES) {
      expect(ability.triggersGcd, ability.id).toBe(false);
    }

    const player = drinker('mage', { potion: 'major_mana_potion' });
    const { sim } = fight(player);
    expect(player.isOnGcd(sim.clock.now())).toBe(false);
    sim.cast(player, player.abilities.get('major_mana_potion')!, undefined);
    expect(player.isOnGcd(sim.clock.now()), 'drinking costs no global cooldown').toBe(false);
  });

  it('puts every Potion on one shared two minute cooldown', () => {
    /*
     * THE OWNER'S SENTENCE: using one "put[s] all Potions on a 2 min cooldown",
     * which they describe as what "effectively make[s] the choice exclusive".
     *
     * THE GROUP IS INERT TODAY AND DECLARED ANYWAY. A selection holds at most
     * one consumable per category, so there is never a second Potion for the
     * group to reach -- the exclusivity is already a property of the shape. This
     * is the ruling written down where it is enforced, which is what makes it
     * right the day anything lets a character hold two.
     */
    const potion = CONSUMABLE_CATEGORIES_BY_ID.get('potion')!;
    for (const option of potion.options) {
      expect(option.ability?.cooldownMs, option.id).toBe(POTION_COOLDOWN_MS);
      expect(option.ability?.cooldownGroup, option.id).toBe(POTION_COOLDOWN_GROUP);
    }
    expect(POTION_COOLDOWN_MS).toBe(120_000);
  });

  it('gives each Other item its own cooldown and no group', () => {
    /*
     * THE OWNER STATES A COOLDOWN PER ITEM AND NO GROUP for these, so none is
     * declared. Reading the Potions' shared cooldown across by analogy is the
     * mistake Explosive Trap taught: a ruling covers what it says.
     */
    const other = CONSUMABLE_CATEGORIES_BY_ID.get('other')!;
    const expected: Record<string, number> = {
      thistle_tea: 300_000,
      demonic_rune: 120_000,
      healthstone: 120_000,
    };
    for (const option of other.options) {
      expect(option.ability?.cooldownMs, option.id).toBe(expected[option.id]);
      expect(option.ability?.cooldownGroup, option.id).toBeUndefined();
    }
    expect(THISTLE_TEA_COOLDOWN_MS).toBe(300_000);
  });

  it('needs no target, so a fight with none does not refuse it', () => {
    for (const ability of MID_FIGHT_CONSUMABLE_ABILITIES) {
      expect(ability.requiresTarget, ability.id).toBe(false);
    }
  });

  it('costs no resource, because the table states none', () => {
    // Inventing a cost would be inventing data. The Demonic Rune's health is
    // not a `cost`: health is not refundable and the amount is rolled per use.
    for (const ability of MID_FIGHT_CONSUMABLE_ABILITIES) {
      expect(ability.cost, ability.id).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// What each one actually does
// ---------------------------------------------------------------------------

describe('Major Mana Potion', () => {
  it('restores between 1350 and 2250 mana', () => {
    expect([MAJOR_MANA_POTION_MINIMUM, MAJOR_MANA_POTION_MAXIMUM]).toEqual([1350, 2250]);

    const player = drinker('mage', { potion: 'major_mana_potion' });
    const { sim } = fight(player);
    const mana = player.resources.require('mana');
    // Emptied first, so nothing is lost to the cap and the whole roll lands.
    mana.set(0);
    sim.cast(player, player.abilities.get('major_mana_potion')!, undefined);
    expect(mana.current).toBeGreaterThanOrEqual(1350);
    expect(mana.current).toBeLessThanOrEqual(2250);
  });

  it('reports what the cap wasted, which a DPS figure cannot', () => {
    /*
     * `grantResource` rather than `Resource.gain` is what makes the overflow
     * visible -- it emits `resource_gained` carrying `wasted`. The Cat's
     * Shifting Power is the worked example: a gate on exactly this was worth
     * POSITIVE DPS, and only the `wasted` column could say which half moved.
     */
    const player = drinker('mage', { potion: 'major_mana_potion' });
    const { sim } = fight(player);
    const mana = player.resources.require('mana');
    mana.fill();
    sim.cast(player, player.abilities.get('major_mana_potion')!, undefined);
    expect(mana.current).toBe(mana.maximum);
  });
});

describe('Mighty Rage Potion', () => {
  it('restores 45 to 75 rage and grants sixty strength for twenty seconds', () => {
    expect([MIGHTY_RAGE_POTION_MINIMUM_RAGE, MIGHTY_RAGE_POTION_MAXIMUM_RAGE]).toEqual([45, 75]);

    const player = drinker('warrior', { potion: 'mighty_rage_potion' });
    const { sim } = fight(player);
    const rage = player.resources.require('rage');
    rage.set(0);
    const strengthBefore = player.stats.get('strength');
    const attackPowerBefore = player.stats.get('attackPower');

    sim.cast(player, player.abilities.get('mighty_rage_potion')!, undefined);

    expect(rage.current).toBeGreaterThanOrEqual(45);
    expect(rage.current).toBeLessThanOrEqual(75);
    expect(player.auras.has('mighty_rage_potion')).toBe(true);
    expect(player.stats.get('strength') - strengthBefore).toBe(60);
    /*
     * AND THE STRENGTH REACHES ATTACK POWER THROUGH THE CONVERSION, which is
     * why the aura grants a PRIMARY rather than 120 attack power directly: a
     * Warrior converts at 2 per strength, and writing the attack power here
     * would stop following the conversion table the day it moved.
     */
    expect(player.stats.get('attackPower') - attackPowerBefore).toBe(120);
  });

  it('is worth its strength alone to a Cat Druid, whose rage nothing spends', () => {
    /*
     * ==========================================================================
     * THE ENTRY THAT LOOKS LIKE A BUG AND IS NOT -- AND THE FIRST VERSION OF
     * THIS TEST GOT THE REASON WRONG, WHICH IS WHY IT IS WRITTEN OUT.
     *
     * It asserted `cat.resources.get('rage')` was undefined, on the comment
     * "Cat Form has an energy pool and no rage". A CAT HAS A RAGE POOL:
     * `resourceSpecsFor` keys pools by CLASS and not by form, so a Druid owns
     * mana, rage and energy in every form and the 45 to 75 genuinely lands.
     *
     * What makes it worthless is that nothing ever takes it out -- measured at
     * zero rage gained and zero spent over twenty fights on the Cat preset, by
     * `tools/probe_cat_rage.ts`, because every ability a Cat casts costs energy.
     * Same conclusion, different mechanism, and the wrong one was specific and
     * plausible enough to be believed.
     *
     * The STRENGTH is what the Cat drinks it for: 120 attack power to a Druid,
     * three times what the Major Frenzy Potion gives it.
     * ==========================================================================
     */
    const cat = createPlayer({
      race: 'tauren',
      characterClass: 'druid',
      combatStyle: 'cat',
      consumables: { potion: 'mighty_rage_potion' },
    });
    const rage = cat.resources.get('rage');
    expect(rage, 'a Druid owns a rage pool in every form').toBeDefined();
    expect(rage?.current, 'and it opens empty').toBe(0);

    const { sim } = fight(cat);
    const strengthBefore = cat.stats.get('strength');
    const attackPowerBefore = cat.stats.get('attackPower');
    sim.cast(cat, cat.abilities.get('mighty_rage_potion')!, undefined);

    expect(cat.stats.get('strength') - strengthBefore).toBe(60);
    expect(cat.stats.get('attackPower') - attackPowerBefore).toBe(120);
    // The rage arrives and has nowhere to go, which is the honest outcome.
    expect(rage?.current).toBeGreaterThanOrEqual(45);
  });
});

describe('Major Frenzy Potion', () => {
  it('grants forty attack power AND forty ranged attack power', () => {
    /*
     * BOTH POOLS, AND THE TABLE SAYS SO IN SO MANY WORDS -- which is what makes
     * this the one entry where the wording settles a question this project has
     * got wrong before. The "+40 Attack Power" ELIXIR says only "Attack Power"
     * and shipped melee-only before the owner ruled it feeds both.
     */
    const player = drinker('hunter', { potion: 'major_frenzy_potion' });
    const { sim } = fight(player);
    const melee = player.stats.get('attackPower');
    const ranged = player.stats.get('rangedAttackPower');
    sim.cast(player, player.abilities.get('major_frenzy_potion')!, undefined);
    expect(player.stats.get('attackPower') - melee).toBe(40);
    expect(player.stats.get('rangedAttackPower') - ranged).toBe(40);
  });
});

describe('Major Spellblasting Potion', () => {
  it('grants forty school-blind spell power', () => {
    const player = drinker('mage', { potion: 'major_spellblasting_potion' });
    const { sim } = fight(player);
    const before = player.stats.get('spellPower');
    sim.cast(player, player.abilities.get('major_spellblasting_potion')!, undefined);
    expect(player.stats.get('spellPower') - before).toBe(40);
  });
});

describe("Major Mender's Potion", () => {
  it('says it does nothing, and applies no aura claiming otherwise', () => {
    /*
     * ==========================================================================
     * AN INERT ABILITY THAT SAYS IT IS INERT, which is the honest failure mode.
     * Healing power is not a stat `STAT_NAMES` carries and nothing here heals,
     * so there is no throughput for seventy-five of it to scale.
     *
     * THE PART WORTH ASSERTING IS THAT IT APPLIES NO AURA. A thirty-second aura
     * carrying nothing would put a row on the buff-uptime table reporting a
     * potion that did not do anything -- which is exactly how Adrenaline Rush
     * hid for the life of the project, reporting 24.9% uptime while delivering
     * no energy. "An inert buff with visible uptime is the hardest kind to
     * find, because the results page shows it working."
     * ==========================================================================
     */
    const player = drinker('priest', { potion: 'major_menders_potion' });
    const ability = player.abilities.get('major_menders_potion')!;
    expect(ability.unmodelled).toContain('Healing power is not a stat');

    const { sim } = fight(player);
    const auraCount = player.auras.active.length;
    const statsBefore = JSON.stringify(player.stats.effective);
    sim.cast(player, ability, undefined);
    expect(player.auras.active.length, 'no aura to report an uptime').toBe(auraCount);
    expect(JSON.stringify(player.stats.effective)).toBe(statsBefore);
  });
});

describe('Thistle Tea', () => {
  it('restores a full hundred energy', () => {
    expect(THISTLE_TEA_ENERGY).toBe(100);

    const player = drinker('rogue', { other: 'thistle_tea' });
    const { sim } = fight(player);
    const energy = player.resources.require('energy');
    energy.set(0);
    sim.cast(player, player.abilities.get('thistle_tea')!, undefined);
    expect(energy.current).toBe(100);
  });
});

describe('the two heals', () => {
  it('restores 1050 to 1750, flat, with no crit and no scaling', () => {
    /*
     * THE OWNER'S RULING: the stated range is the whole answer, nothing about
     * the drinker scales it. `external: true` enforces that and
     * `canCrit: false` is the other half -- healing crits by default, and a
     * crit would quietly make 1750 into 2625.
     */
    expect([MAJOR_HEALING_POTION_MINIMUM, MAJOR_HEALING_POTION_MAXIMUM]).toEqual([1050, 1750]);

    const player = drinker('warrior', { potion: 'major_healing_potion' });
    const { sim } = fight(player);
    player.health.set(1);
    sim.cast(player, player.abilities.get('major_healing_potion')!, undefined);
    const restored = player.health.current - 1;
    expect(restored).toBeGreaterThanOrEqual(1050);
    expect(restored).toBeLessThanOrEqual(1750);
  });

  it('restores exactly 1440 from a Healthstone', () => {
    expect(HEALTHSTONE_HEALTH).toBe(1440);

    const player = drinker('warlock', { other: 'healthstone' });
    const { sim } = fight(player);
    player.health.set(1);
    sim.cast(player, player.abilities.get('healthstone')!, undefined);
    expect(player.health.current - 1).toBe(1440);
  });

  it('cannot take a character above full, and says how much was wasted', () => {
    const player = drinker('warlock', { other: 'healthstone' });
    const { sim } = fight(player);
    expect(player.health.current).toBe(player.health.maximum);
    sim.cast(player, player.abilities.get('healthstone')!, undefined);
    expect(player.health.current).toBe(player.health.maximum);
  });
});

describe('Demonic Rune', () => {
  it('spends health and grants mana, both within their stated ranges', () => {
    expect([DEMONIC_RUNE_MINIMUM_MANA, DEMONIC_RUNE_MAXIMUM_MANA]).toEqual([900, 1500]);
    expect([DEMONIC_RUNE_MINIMUM_HEALTH, DEMONIC_RUNE_MAXIMUM_HEALTH]).toEqual([600, 1000]);

    const player = drinker('warlock', { other: 'demonic_rune' });
    const { sim } = fight(player);
    const mana = player.resources.require('mana');
    mana.set(0);
    const healthBefore = player.health.current;

    sim.cast(player, player.abilities.get('demonic_rune')!, undefined);

    const spent = healthBefore - player.health.current;
    expect(spent).toBeGreaterThanOrEqual(600);
    expect(spent).toBeLessThanOrEqual(1000);
    expect(mana.current).toBeGreaterThanOrEqual(900);
    expect(mana.current).toBeLessThanOrEqual(1500);
  });

  it('is refused below the most it can cost, rather than killing or being free', () => {
    /*
     * ==========================================================================
     * THE OWNER'S RULING -- refused, not allowed to kill -- AND THE GUARD IS
     * LOAD-BEARING FOR A SECOND REASON.
     *
     * `Resource.spend` is ALL-OR-NOTHING: it "returns false and changes
     * nothing" when the pool is short. So without the guard, a character below
     * the cost would pay NO health and still collect the mana -- a free Demonic
     * Rune, which is a bigger number and no error, with nothing in the results
     * page to say which half failed.
     *
     * THE THRESHOLD IS THE MAXIMUM COST because `canCast` runs BEFORE the cost
     * is rolled, so the only honest question it can ask is whether every roll
     * is affordable.
     * ==========================================================================
     */
    const player = drinker('warlock', { other: 'demonic_rune' });
    const { sim } = fight(player);
    const mana = player.resources.require('mana');
    const rune = player.abilities.get('demonic_rune')!;

    player.health.set(DEMONIC_RUNE_MAXIMUM_HEALTH);
    mana.set(0);
    expect(sim.cast(player, rune, undefined).ok, 'exactly at the cost is not above it').toBe(false);
    expect(mana.current, 'and no mana arrived').toBe(0);

    player.health.set(DEMONIC_RUNE_MAXIMUM_HEALTH + 1);
    expect(sim.cast(player, rune, undefined).ok).toBe(true);
    expect(mana.current).toBeGreaterThanOrEqual(900);
  });
});

// ---------------------------------------------------------------------------
// The dropdowns
// ---------------------------------------------------------------------------

describe('the aura catalog', () => {
  it('offers the three potion buffs to every class', () => {
    /*
     * SO A CONDITION CAN BE WRITTEN ON ONE. "A half-typed id is worse than a
     * wrong one" -- an aura that does not exist is never present, so `is up` is
     * permanently false and `has run out` permanently true.
     *
     * TO EVERY CLASS, which is the raid buff compromise: the catalog is cached
     * per class and cannot see a selection, so the choice is between offering
     * these always and never. Mighty Rage is offered to a Mage that cannot
     * drink it, which costs a reader one line.
     */
    for (const characterClass of PROFILE_CLASSES) {
      const ids = aurasForClass(characterClass).map((aura) => aura.id);
      for (const id of [
        'mighty_rage_potion',
        'major_frenzy_potion',
        'major_spellblasting_potion',
      ]) {
        expect(ids, `${characterClass} / ${id}`).toContain(id);
      }
    }
  });

  it('offers no aura for the six that leave nothing behind', () => {
    /*
     * The mirror assertion, and it is the one that expires: a potion gaining an
     * aura has to be a deliberate edit here. Six of the nine restore a pool or
     * do nothing, and an aura for any of them would be a row on the buff table
     * carrying nothing.
     */
    const ids = aurasForClass('warrior').map((aura) => aura.id);
    for (const id of [
      'major_healing_potion',
      'major_mana_potion',
      'major_menders_potion',
      'thistle_tea',
      'demonic_rune',
      'healthstone',
    ]) {
      expect(ids, id).not.toContain(id);
    }
  });
});
