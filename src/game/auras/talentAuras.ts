import type { AuraDefinition } from '../../engine';
import { ANGER_MANAGEMENT } from './warrior';
import { LEADER_OF_THE_PACK, MOONKIN_AURA } from './druid';

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
   * THE TWO PARTY AURAS ARE ALSO RAID BUFFS, and the ids are deliberately the
   * same ones `raidBuffs.ts` applies. A Cat that takes Leader of the Pack in a
   * raid that also selected it gets 3% once, because `AuraCollection.apply`
   * refreshes a matching id instead of stacking a second aura.
   */
  leader_of_the_pack: LEADER_OF_THE_PACK,
  moonkin_form: MOONKIN_AURA,
};
