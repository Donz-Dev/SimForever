import { describe, expect, it } from 'vitest';
import { DRUID_ABILITIES } from '../../src/game/abilities/druid';
import { ROGUE_ABILITIES } from '../../src/game/abilities/rogue';
import { PROFILE_PRESETS } from '../../src/profiles/presets';

/*
 * ==============================================================================
 * "BEHIND THE TARGET" IS ASSUMED, EXCEPT WHEN THE TARGET ATTACKS BACK.
 *
 * THE RULESET OWNER'S RULING, given with Ravage: "You do NOT need to scope in
 * behind the target positioning. **Once again this should be assumed in all
 * cases EXCEPT when 'Target attacks back' is checked.**"
 *
 * ------------------------------------------------------------------------------
 * IT OVERTURNED FOUR WRITTEN-DOWN CAVEATS, all saying the same thing and all of
 * them honest about the engine and wrong about the ruleset:
 *
 *   Shred     'its "must be behind the target" is dropped ... not pretended to
 *             be met'
 *   Backstab  the same wording, plus "the dagger requirement IS enforced"
 *   Ambush    'is dropped: nothing here has a facing'
 *   the Cat   its list called the drop "generous to the build"
 *
 * **THE BEHAVIOUR NEVER CHANGED.** All three abilities always dealt their
 * damage; what was wrong was four notes telling a reader the build was getting
 * something it had not earned, and three `unmodelled` entries inflating the gap
 * census with a decision. The ruling made them true rather than making them
 * work.
 *
 * ------------------------------------------------------------------------------
 * SO WHAT IS LEFT TO TEST IS THE EXCEPTION, AND NOTHING REACHES IT.
 *
 * A character whose target swings back is standing in FRONT of it -- that is
 * why the encounter grants the target 14% parry, on the owner's own ruling --
 * so a behind-the-target ability should be refused on such a build. No engine
 * field carries `targetAttacks`: it is baked into the attack-chance provider
 * and into whether the enemy has a rotation, so there is nothing for a
 * `canCast` to read.
 *
 * **THAT IS NOT BUILT, AND THIS FILE IS WHY IT IS SAFE NOT TO BE.** The gate
 * would be unreachable: every profile that can cast one of these sets
 * `targetAttacks: false`. A condition nobody declared is a bonus being paid, so
 * something has to ASK whether the predicate would ever fire -- which is the
 * guard `isWeaponUseOf(attack, 'ranged')` and `EFFECT_RULES` both got, and the
 * cheaper half of building a mechanism for a build that does not exist.
 *
 * THE DAY A TANK BUILD TAKES SHRED, THIS TEST FAILS and the gate becomes worth
 * building. That is the whole arrangement.
 * ==============================================================================
 */

/**
 * The abilities whose tooltip says "must be behind the target".
 *
 * WRITTEN OUT BY HAND FROM THE SOURCE TOOLTIPS rather than derived from a flag,
 * because there is no flag -- the requirement is prose in a capture, and a
 * derivation would have to parse it. Four entries, and the fifth the capture
 * contains is POUNCE, which is declared nowhere.
 */
const BEHIND_THE_TARGET = ['shred', 'ravage', 'backstab', 'ambush'];

describe('the behind-the-target ruling', () => {
  it('names abilities that all exist, so the list cannot go stale in silence', () => {
    /*
     * A LIST OF IDS GOES WRONG THE WAY EVERY LIST OF IDS IN THIS PROJECT GOES
     * WRONG: something is renamed and the entry quietly matches nothing. The
     * catalogues are the source of truth for whether an id is real.
     */
    const declared = new Set([...DRUID_ABILITIES, ...ROGUE_ABILITIES].map((a) => a.id));
    for (const id of BEHIND_THE_TARGET) {
      expect(declared.has(id), `${id} is declared`).toBe(true);
    }
  });

  it('carries no unmodelled caveat about the position any more', () => {
    /*
     * THE FOUR CAVEATS ARE GONE AND THIS IS WHAT STOPS THEM COMING BACK. A
     * reason matched by WORDING is a test -- the arrangement
     * `grantCastModifier.test.ts` uses -- and it is the right shape here
     * because the thing to prevent is a sentence, not a value: somebody
     * re-deriving "nothing here has a facing" and writing the apology again.
     */
    for (const ability of [...DRUID_ABILITIES, ...ROGUE_ABILITIES]) {
      const caveat = ability.unmodelled ?? '';
      expect(caveat.toLowerCase(), `${ability.id} claims the position is dropped`).not.toContain(
        'behind the target" is dropped',
      );
    }
  });

  it('is never claimed by a profile whose target attacks back', () => {
    /*
     * ========================================================================
     * THE EXCEPTION, ASSERTED AS AN INVARIANT INSTEAD OF BUILT AS A GATE.
     *
     * Every profile that can reach one of these has `targetAttacks: false`, so
     * the owner's "EXCEPT when Target attacks back is checked" is vacuous
     * today -- and this is what says so out loud rather than leaving a rule
     * nobody enforces to look like a rule nobody needs.
     *
     * CHECKED THROUGH THE PRIORITY LIST AND THE OPENER, which is what a
     * profile can actually DO, rather than through the ability book: Shred is
     * in every Druid's book including the Bear's, and the Bear is a tank whose
     * target does swing back. It never casts it.
     * ========================================================================
     */
    for (const preset of PROFILE_PRESETS) {
      const profile = preset.build();
      if (!profile.encounter.targetAttacks) continue;

      const reachable = [
        ...profile.rotation.entries.map((entry) => entry.abilityId),
        ...(profile.precombat ?? []).map((action) => action.abilityId),
      ];
      for (const id of BEHIND_THE_TARGET) {
        expect(
          reachable,
          `${preset.id} fights a target that swings back and would use ${id} from behind it`,
        ).not.toContain(id);
      }
    }
  });
});
