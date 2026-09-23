import type { Rotation } from '../../engine';
import type { ClassId, CombatStyleId, StanceId } from '../character';
import type { TalentAllocation } from '../talents/Talent';
import { warriorRotation } from './warrior';
import { rogueRotation } from './rogue';
import { druidRotation } from './druid';

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
  return undefined;
}
