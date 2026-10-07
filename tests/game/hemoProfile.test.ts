import { describe, expect, it } from 'vitest';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { characterAtCombatStart } from '../../src/simulator';
import { ROGUE_HEMO, ROGUE_RUPTURE, rogueRotation } from '../../src/game/rotations/rogue';

const built = (id: string) => PRESETS_BY_ID.get(id)!.build();
const talentsOf = (id: string) =>
  (built(id) as unknown as { talents: Record<string, number> }).talents;

describe('the Hemo build', () => {
  /*
   * DECODED FROM THE OWNER'S URL rather than transcribed from a tree:
   * talentsforever.com/rogue/60/005303105-3-5320003301013211501-...
   *
   * A build coming back at other than 51 points, or throwing "X given N of M
   * ranks", means the tree on disk disagrees with the tree the URL was written
   * against -- and a WRONG tree does not always fail, so the total is asserted.
   */
  it('spends exactly 51 points, 17 / 3 / 31', () => {
    const talents = talentsOf('rogue_hemo');
    const total = Object.values(talents).reduce((a, b) => a + b, 0);
    expect(total).toBe(51);
  });

  it('takes Hemorrhage and NOT Cutthroat, which is what picks its list', () => {
    const talents = talentsOf('rogue_hemo');
    expect(talents.hemorrhage).toBe(1);
    expect(talents.cutthroat ?? 0).toBe(0);
    // And the Rupture build is the other way round on the second of those.
    expect(talentsOf('rogue_rupture').cutthroat).toBe(5);
  });

  it('drops the whole Backstab engine', () => {
    /*
     * THE REASON REMOVING THE ENTRY IS NOT A ROTATION PREFERENCE. Cutthroat is
     * Backstab's proc and Puncturing Wounds is its extra combo point and crit;
     * with both gone, Backstab is a 60-energy strike with nothing attached.
     */
    const talents = talentsOf('rogue_hemo');
    expect(talents.cutthroat ?? 0).toBe(0);
    expect(talents.puncturing_wounds ?? 0).toBe(0);
    expect(talents.ghostly_strike ?? 0).toBe(0);
  });

  it('matches the Rupture preset in every field except the talents', () => {
    /*
     * THE OWNER'S SPECIFICATION IS "EXACTLY THE SAME EXCEPT THESE TALENTS", and
     * a build is FIVE settings that have to agree -- class, playstyle, stance or
     * form, gear, and whether the target swings back. Checking them one by one is
     * the test that the new preset did not quietly inherit a different encounter
     * or a different weapon set.
     */
    const hemo = built('rogue_hemo');
    const rupture = built('rogue_rupture');
    expect(hemo.character.race).toBe(rupture.character.race);
    expect(hemo.character.characterClass).toBe(rupture.character.characterClass);
    expect(hemo.character.level).toBe(rupture.character.level);
    expect(hemo.character.combatStyle).toBe(rupture.character.combatStyle);
    expect(hemo.character.stance).toBe(rupture.character.stance);
    expect(hemo.equipment).toEqual(rupture.equipment);
    expect(hemo.raidBuffs).toEqual(rupture.raidBuffs);
    expect(hemo.encounter).toEqual(rupture.encounter);
    expect(hemo.talents).not.toEqual(rupture.talents);
  });

  it('holds two daggers, because Ambush needs one in the main hand', () => {
    const character = characterAtCombatStart(built('rogue_hemo') as never);
    expect(character).toBeDefined();
    expect(character!.weapons.mainHand?.weaponType).toBe('dagger');
    expect(character!.weapons.offHand?.weaponType).toBe('dagger');
  });
});

describe('the Hemo list', () => {
  const ids = ROGUE_HEMO.map((entry) => entry.abilityId);

  it('has no Backstab at all', () => {
    expect(ids).not.toContain('backstab');
    // And the list it derives from still does.
    expect(ROGUE_RUPTURE.map((e) => e.abilityId)).toContain('backstab');
  });

  it('is the Rupture list in the Rupture list’s order, otherwise', () => {
    /*
     * IT IS DERIVED FROM `ROGUE_RUPTURE` RATHER THAN TRANSCRIBED, so that
     * anything measured into the Rupture list reaches this one for free. Two
     * near-identical lists maintained by hand DRIFT, and the drift is invisible:
     * an entry is four lines and a difference reads as deliberate.
     *
     * This is the test that the derivation is still a derivation. It compares the
     * ORDER of everything the two lists share, so an entry inserted into Rupture
     * in the wrong place here would fail rather than being absorbed.
     */
    const shared = ROGUE_RUPTURE.map((e) => e.abilityId).filter(
      (id) => id !== 'backstab' && id !== 'hemorrhage',
    );
    expect(ids.filter((id) => id !== 'hemorrhage')).toEqual(shared);
  });

  it('puts Hemorrhage last and ungated, as the filler', () => {
    /*
     * +108.9, AND THE GATE'S JUSTIFICATION WENT WITH BACKSTAB. The Rupture list
     * gates Hemorrhage on its own debuff because there "it MAINTAINS and Backstab
     * BUILDS" -- correct while something else was building, and it made Hemorrhage
     * a floor that starved the entries beneath it. Here there is nothing beneath
     * it, so the floor costs nothing and the building has to come from somewhere.
     *
     * Ungated it wastes 272.7 fewer energy a fight; the specification as first
     * written threw away a third of the profile's income.
     */
    expect(ids[ids.length - 1]).toBe('hemorrhage');
    expect(ROGUE_HEMO[ROGUE_HEMO.length - 1].condition).toBeUndefined();
    // The Rupture list's own Hemorrhage is still gated.
    expect(ROGUE_RUPTURE.find((e) => e.abilityId === 'hemorrhage')?.condition).toBeDefined();
  });

  it('names no ability twice', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('which list a Subtlety Rogue runs', () => {
  /*
   * ============================================================================
   * HEMORRHAGE NO LONGER SEPARATES THE TWO SUBTLETY BUILDS -- both take it,
   * because both are built around it. Cutthroat is the discriminator, and it is a
   * FUNCTIONAL one: Cutthroat is the Rupture list's only in-combat route to
   * Ambush, so a Hemorrhage build without it cannot run that list's Backstab
   * engine at all.
   *
   * `rotationFor` dispatches on five different patterns across nine classes and a
   * Shockadin once ran a list built around a talent it does not take for its whole
   * life without erroring. A claim about which list a build runs is worth a test.
   * ============================================================================
   */
  it('sends a Hemorrhage build WITH Cutthroat to the Rupture list', () => {
    expect(rogueRotation({ hemorrhage: 1, cutthroat: 5 }).name).toContain('Rupture');
  });

  it('sends a Hemorrhage build WITHOUT Cutthroat to the Hemo list', () => {
    expect(rogueRotation({ hemorrhage: 1 }).name).toContain('Hemo');
  });

  it('still sends Mutilate to Venom and everything else to Combat', () => {
    // Mutilate wins even over a Hemorrhage build, which is the existing order.
    expect(rogueRotation({ mutilate: 1, hemorrhage: 1 }).name).toContain('Venom');
    expect(rogueRotation({ adrenaline_rush: 1 }).name).toContain('Combat');
  });

  it('routes each of the four presets to its own list', () => {
    const listFor = (id: string) =>
      rogueRotation(talentsOf(id) as Readonly<Record<string, number>>).name;
    expect(listFor('rogue_venom')).toContain('Venom');
    expect(listFor('rogue_combat')).toContain('Combat');
    expect(listFor('rogue_rupture')).toContain('Rupture');
    expect(listFor('rogue_hemo')).toContain('Hemo');
  });
});
