import type { Rotation } from '../../engine';
import type { ClassId, CombatStyleId, StanceId } from '../character';
import type { TalentAllocation } from '../talents/Talent';
import { warriorRotation } from './warrior';
import { rogueRotation } from './rogue';
import { druidRotation } from './druid';
import { shamanRotation } from './shaman';
import { mageRotation } from './mage';
import { paladinRotation } from './paladin';
import { hunterRotation } from './hunter';
import { warlockRotation } from './warlock';

/**
 * The action priority list for a class and combat style.
 *
 * Combat style exists partly to select this: a Warrior with a shield has a
 * different list from one with a two-hander, and a Druid's bear and cat
 * rotations share almost nothing.
 *
 * STANCE SELECTS A LIST TOO, for the Warrior. A rotation that never leaves
 * Berserker Stance is a different rotation rather than a filtered one: it has
 * its own order, its own thresholds, and it pays no stance-change cost because
 * it never reaches for anything outside the stance.
 *
 * AND TALENTS SELECT ONE TOO, for the Rogue. It is dual-wield in every spec
 * and has no stance, so style and stance cannot tell its three builds apart --
 * the capstone can. Passing the allocation here rather than inspecting it
 * inside `rogueRotation`'s caller keeps one lookup deciding what a character
 * runs.
 */
export function rotationFor(
  characterClass: ClassId,
  style: CombatStyleId,
  stance?: StanceId,
  talents?: TalentAllocation,
): Rotation | undefined {
  if (characterClass === 'warrior') return warriorRotation(style, stance);
  if (characterClass === 'rogue') return rogueRotation(talents ?? {});
  // A Druid's form IS its combat style, so the style selects the list -- the
  // Warrior's arrangement rather than the Rogue's.
  if (characterClass === 'druid') return druidRotation(style);
  // A Shaman's two specs are a caster and a two-hander, which the style
  // already separates -- so the style selects the list here too.
  if (characterClass === 'shaman') return shamanRotation(style);
  // AND TALENTS SELECT ONE FOR THE MAGE TOO, but by POINTS SPENT rather than
  // by a capstone: all three builds are `caster`, and the Frostfire one is
  // 0/29/22 with no 31-point talent for the Rogue's test to find.
  if (characterClass === 'mage') return mageRotation(talents ?? {});
  // AND THE PALADIN BY CAPSTONE, the Rogue's test: Holy Shield, Twist of Light
  // and Holy Shock each belong to exactly one of the three builds.
  if (characterClass === 'paladin') return paladinRotation(talents ?? {});
  /*
   * AND THE HUNTER BY BOTH. Beast Mastery is told by its capstone -- which is
   * also the talent that means "I have a pet" -- and the two Lone Wolf builds
   * by STYLE, because both take Lone Wolf and neither reaches a capstone that
   * would separate them. One stands in melee and the other does not.
   */
  if (characterClass === 'hunter') return hunterRotation(style, talents ?? {});
  // AND THE WARLOCK BY CAPSTONE. Wrack is 31 into Affliction and Incinerate 31
  // into Destruction, and 51 points cannot reach both.
  if (characterClass === 'warlock') return warlockRotation(talents ?? {});
  return undefined;
}
