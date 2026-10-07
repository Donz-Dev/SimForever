import type { AuraDefinition } from '../../engine';
import { ANGER_MANAGEMENT } from './warrior';
import { PARTY_CRIT_AURA, PARTY_CRIT_AURA_ID } from './druid';

/**
 * Auras a TALENT puts on a character, by the id its effect names.
 *
 * ----------------------------------------------------------------------------
 * A LOOKUP RATHER THAN DIRECT IMPORTS, so the talent tables stay data: a talent
 * says `{ kind: 'grantAura', auraId }` and never imports an aura. That is the
 * same arrangement `grantAbility` has, and it is why `createPlayer` can resolve
 * a granted aura without knowing which class asked.
 *
 * IT LIVED IN `auras/warrior.ts` UNTIL THE DRUID NEEDED IT, which was fine
 * while Anger Management was the only entry and wrong the moment a second class
 * had one: a Druid talent reaching into the Warrior's aura file is an arrow
 * pointing sideways for no reason. One map in one file, listing every class's,
 * is not a fifth place a class has to be registered -- a class with no
 * `grantAura` talent has no entry and nothing notices.
 *
 * An id with no entry here is DROPPED rather than throwing, and `createPlayer`
 * says why: a typo should show up as a talent that visibly does nothing, not as
 * a character that cannot be built.
 * ----------------------------------------------------------------------------
 */
export const TALENT_AURAS: Readonly<Record<string, AuraDefinition>> = {
  anger_management: ANGER_MANAGEMENT,
  /*
   * MOONKIN AURA AND LEADER OF THE PACK ARE ONE AURA, and both talents grant
   * it. The ruleset owner: "these are all the same exclusive 3% global critical
   * strike chance and do not stack" -- so there is one `AuraDefinition`, one id,
   * and `AuraCollection.apply` refreshes it rather than stacking a second
   * instance however many of the three sources a character has.
   *
   * THE KEY HERE IS STILL THE TALENT'S `auraId`, which is why both point at the
   * same value: a talent names what it grants, and two talents granting the
   * same thing is exactly what this is.
   */
  [PARTY_CRIT_AURA_ID]: PARTY_CRIT_AURA,
};
