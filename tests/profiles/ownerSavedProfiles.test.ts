import { describe, expect, it } from 'vitest';
import type { AplEntry } from '../../src/game/rotations/apl';
import { withSection } from '../../src/profiles/aplSections';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { characterAtCombatStart } from '../../src/simulator';

/*
 * ============================================================================
 * THE OWNER'S THREE SAVED BUILDS (round 82) CARRY THEIR OWN LISTS, which
 * `rotationIds.test.ts` cannot see: it checks the lists in `game/rotations`,
 * and these live in `profiles/ownerLists.ts` because no dispatch selects them.
 * So this is the check it would have given them -- an entry naming an ability
 * the character does not know is skipped in SILENCE, which is how a list
 * quietly does less.
 * ============================================================================
 */

const OWNER_PRESETS = ['hunter_survival_weave', 'shaman_spellhance', 'warlock_sm_ruin'] as const;

/** Every ability an entry can cast: itself, its sequence and its weave. */
const named = (entries: readonly AplEntry[]): string[] =>
  entries
    .filter((entry) => !entry.disabled)
    .flatMap((entry) => [entry.abilityId, ...(entry.sequence ?? []), ...(entry.weave ?? [])]);

/*
 * NAMED ON PURPOSE, each for a stated reason, so a new unlearnable entry fails:
 * SM Ruin's Siphon Life is the owner's line on a build that does not take the
 * talent, and is inert rather than wrong.
 */
const KNOWN_UNLEARNED: Readonly<Record<string, readonly string[]>> = {
  warlock_sm_ruin: ['siphon_life'],
};

describe("the owner's saved builds", () => {
  for (const id of OWNER_PRESETS) {
    it(`${id} carries a custom list in both sections`, () => {
      const profile = PRESETS_BY_ID.get(id)!.build();
      expect(profile.rotation.source).toBe('custom');
      expect(withSection(profile, 'multi').rotation.source).toBe('custom');
    });

    it(`${id} names only abilities its character knows, in both sections and its openers`, () => {
      const profile = PRESETS_BY_ID.get(id)!.build();
      const book = characterAtCombatStart(profile)!.abilities;
      const multi = withSection(profile, 'multi');
      const wanted = new Set([
        ...named(profile.rotation.entries),
        ...named(multi.rotation.entries),
        ...(profile.precombat ?? []).map((action) => action.abilityId),
        ...(multi.precombat ?? []).map((action) => action.abilityId),
      ]);
      const unknown = [...wanted].filter((ability) => !book.get(ability)).sort();
      expect(unknown).toEqual([...(KNOWN_UNLEARNED[id] ?? [])].sort());
    });
  }

  it("gates SM Ruin's Single Target Hellfire to two targets, and leaves the Multi Target one alone", () => {
    /*
     * THE ONE OWNER-RULED EDIT TO A LIST. As saved, the Single Target list cast
     * Hellfire at one target and never Shadow Bolt: 675 DPS against 906 at
     * 1T/120s.
     */
    const profile = PRESETS_BY_ID.get('warlock_sm_ruin')!.build();
    const hellfire = (entries: readonly AplEntry[]) => entries.find((entry) => entry.abilityId === 'hellfire')!;
    expect(JSON.stringify(hellfire(profile.rotation.entries).condition)).toContain('"targetCount"');
    expect(JSON.stringify(hellfire(withSection(profile, 'multi').rotation.entries).condition)).not.toContain(
      'targetCount',
    );
  });
});
