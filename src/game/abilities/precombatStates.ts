import type { CharacterProfile } from '../../profiles/CharacterProfile';

/**
 * ==============================================================================
 * PRE-COMBAT IDS THAT NAME A *STATE* RATHER THAN AN ABILITY.
 *
 * THE RULESET OWNER'S INSTRUCTION, and it is about the PANEL rather than the
 * engine: "Even if lines were already true, like Moonkin Form, just leave it in
 * the pre-combat so users know that." Their openers name a form on four
 * profiles and Stealth on three, and none of the seven is an ability here --
 * a Druid's form is a COMBAT STYLE and a Rogue's Stealth is an `openingAura`.
 *
 * ------------------------------------------------------------------------------
 * SO THE ACTION IS DECLARED, SKIPPED, AND SAYS SO. `runPrecombat` finds no
 * ability and moves on in silence, which is right -- there is nothing to cast.
 * What this table buys is that the two readers who would otherwise MISREPORT it
 * can tell the difference:
 *
 *   the APL panel        would have labelled it "(not in this build)", which is
 *                        exactly backwards: the character is IN Cat Form
 *   the opener guard     asserts every declared action fires, and these never
 *                        do -- so it needs to check the STATE instead
 *
 * **A LIST OF IDS WOULD NOT HAVE BEEN ENOUGH.** "Already true" is a claim about
 * a particular character: `cat_form` is satisfied for a Druid in Cat Form and
 * NOT for a Moonkin, and a profile that names the wrong one should still read
 * as wrong. So each entry carries what makes it true.
 *
 * ------------------------------------------------------------------------------
 * IT IS NOT A WAY TO DECLARE SOMETHING INERT. An id belongs here only when the
 * character genuinely arrives in that state by another route -- which is why
 * `satisfied` reads the profile rather than returning true. The Cat's "0s
 * Ravage" is NOT in this table: that is a real ability with a real cost, and it
 * is declared and cast like any other.
 * ==============================================================================
 */
interface PrecombatState {
  /** What the panel calls it, since no ability carries the name. */
  readonly name: string;
  /** Why it is already true, in the words a reader needs. */
  readonly because: string;
  readonly satisfied: (profile: CharacterProfile) => boolean;
}

export const PRECOMBAT_STATES: Readonly<Record<string, PrecombatState>> = {
  cat_form: {
    name: 'Cat Form',
    because: 'the profile is in the Cat combat style',
    satisfied: (profile) => profile.character.combatStyle === 'cat',
  },
  bear_form: {
    name: 'Dire Bear Form',
    because: 'the profile is in the Bear combat style',
    satisfied: (profile) => profile.character.combatStyle === 'bear',
  },
  moonkin_form: {
    name: 'Moonkin Form',
    because: 'the profile is in the Moonkin combat style',
    satisfied: (profile) => profile.character.combatStyle === 'moonkin',
  },
  stealth: {
    name: 'Stealth',
    /*
     * ON THE CLASS AND NOT ON A BUILD, which is `openingAuras`' own reason:
     * opening stealthed is a fact about a Rogue, every Rogue learns Stealth
     * from a trainer, and only a list with an Ambush entry can spend it.
     */
    because: "every Rogue's openingAuras carry the stealth aura",
    satisfied: (profile) => profile.character.characterClass === 'rogue',
  },
};

/**
 * The state this pre-combat id names, when the character is already in it.
 *
 * Returns nothing for an ordinary ability, and nothing for a state id the
 * profile does NOT satisfy -- a Moonkin that somehow declared `cat_form` is
 * naming something untrue, and should read as such rather than as a comment.
 */
export function precombatStateFor(
  profile: CharacterProfile,
  abilityId: string,
): PrecombatState | undefined {
  const state = PRECOMBAT_STATES[abilityId];
  return state && state.satisfied(profile) ? state : undefined;
}
