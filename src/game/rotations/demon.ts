import type { Rotation } from '../../engine';
import type { AplList } from './apl';
import { compileRotation } from './apl';

/*
 * THE TWO DEMONS' LISTS, one entry each, which is the owner's description
 * verbatim: the Imp "repeatedly casts Firebolt", and the Succubus "melee
 * auto-attacks, and uses Lash of Pain on cooldown". The Succubus's swing is not
 * an entry -- auto-attacks run on their own timer.
 */
export const IMP_PRIORITY: AplList = {
  name: 'Imp',
  entries: [{ abilityId: 'imp_firebolt' }],
};

export const SUCCUBUS_PRIORITY: AplList = {
  name: 'Succubus',
  entries: [{ abilityId: 'lash_of_pain' }],
};

export const IMP_ROTATION: Rotation = compileRotation(IMP_PRIORITY);
export const SUCCUBUS_ROTATION: Rotation = compileRotation(SUCCUBUS_PRIORITY);
