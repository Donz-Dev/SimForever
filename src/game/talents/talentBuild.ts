import type { PartialStats, ResourceType, StatModifierSpec, StatName } from '../../engine';
import { seconds } from '../../engine';
import type { ClassId } from '../character';
import type { TalentAllocation } from './Talent';
import type { TalentEffects, UnmodelledTalent } from './TalentEffect';
import { talentsForClass } from './talentData';
import { talentDescription, talentNumber } from './talentValues';
import { WARRIOR_TALENT_EFFECTS } from './warriorEffects';

/** Effect tables per class. Only the Warrior has one. */
const EFFECTS: Partial<Record<ClassId, Readonly<Record<string, TalentEffects>>>> = {
  warrior: WARRIOR_TALENT_EFFECTS,
};

/**
 * Everything an allocation contributes, resolved once before the fight.
 *
 * Talents are decided when a character is built and do not change during
 * combat, so resolving them into plain data here keeps the engine unaware that
 * talents exist at all. Nothing below `createPlayer` ever sees a talent.
 */
export interface TalentBuild {
  /** Flat additions, applied on top of gear and profile stats. */
  readonly stats: PartialStats;
  /**
   * Percentage contributions, as modifiers rather than folded into `stats`.
   *
   * A talent reading "+2% Stamina" has to stay a modifier: stats are base plus
   * modifiers and derived values are produced by a function over them, so a
   * percentage kept as a modifier still composes correctly when a buff moves
   * the underlying stat. Folding it into a flat number at build time would
   * freeze it against the unbuffed value -- the same mistake that would leave
   * attack power stuck at its starting figure.
   */
  readonly statModifiers: readonly StatModifierSpec[];
  /** Resource caps to raise. */
  readonly resourceMaximums: Partial<Record<ResourceType, number>>;
  /** Abilities a talent grants, which the character otherwise would not have. */
  readonly grantedAbilities: ReadonlySet<string>;
  /** Resource cost to SUBTRACT from an ability, by ability id. */
  readonly abilityCostReduction: ReadonlyMap<string, number>;
  /** Cooldown to SUBTRACT from an ability, in milliseconds, by ability id. */
  readonly abilityCooldownReductionMs: ReadonlyMap<string, number>;
  /**
   * Talents with points in them that are doing nothing, and why.
   *
   * Shown to the person under "Chosen but not simulated", the same way the Gear
   * panel lists an item's unmodelled effects. A talent that silently did
   * nothing would be indistinguishable from one that worked.
   */
  readonly unmodelled: readonly UnmodelledTalent[];
}

const EMPTY: TalentBuild = {
  stats: {},
  statModifiers: [],
  resourceMaximums: {},
  grantedAbilities: new Set(),
  abilityCostReduction: new Map(),
  abilityCooldownReductionMs: new Map(),
  unmodelled: [],
};

/**
 * Resolve an allocation into what it actually does.
 *
 * A talent contributes nothing unless it has a point in it, its class has an
 * effect table, and — for every effect that needs a number — the values file
 * has one for that rank. A MISSING VALUE IS NOT ZERO AND NOT EXTRAPOLATED: the
 * talent is reported as unmodelled, so a gap in the data looks like a gap
 * rather than like a talent that works and is worth nothing.
 */
export function talentBuild(
  characterClass: ClassId,
  allocation: TalentAllocation | undefined,
): TalentBuild {
  if (!allocation) return EMPTY;

  const effects = EFFECTS[characterClass];
  const talents = talentsForClass(characterClass);
  if (!effects || !talents) return EMPTY;

  const stats: Partial<Record<StatName, number>> = {};
  const statModifiers: StatModifierSpec[] = [];
  const resourceMaximums: Partial<Record<ResourceType, number>> = {};
  const grantedAbilities = new Set<string>();
  const abilityCostReduction = new Map<string, number>();
  const abilityCooldownReductionMs = new Map<string, number>();
  const unmodelled: UnmodelledTalent[] = [];

  const report = (talentId: string, rank: number, reason: string) => {
    const talent = talents.byId.get(talentId);
    unmodelled.push({
      talentId,
      name: talent?.name ?? talentId,
      rank,
      text: talentDescription(characterClass, talentId, rank) ?? talent?.description ?? '',
      reason,
    });
  };

  for (const [talentId, rank] of Object.entries(allocation)) {
    if (rank <= 0) continue;

    const declared = effects[talentId];
    if (!declared) {
      // A talent the class's table does not mention. Not silently ignored: the
      // table is meant to cover every talent, so a gap is a mistake worth
      // seeing rather than a talent that quietly does nothing.
      report(talentId, rank, 'No effect is declared for this talent.');
      continue;
    }

    for (const effect of declared) {
      if (effect.kind === 'unmodelled') {
        report(talentId, rank, effect.reason);
        continue;
      }

      if (effect.kind === 'grantAbility') {
        grantedAbilities.add(effect.abilityId);
        continue;
      }

      const value = talentNumber(characterClass, talentId, rank);
      if (value === undefined) {
        report(
          talentId,
          rank,
          `No value is recorded for rank ${rank}. See src/data/talents/values/${characterClass}.json.`,
        );
        continue;
      }

      switch (effect.kind) {
        case 'stat': {
          const amount = value * (effect.scale ?? 1);
          if (effect.operation === 'flat') {
            stats[effect.stat] = (stats[effect.stat] ?? 0) + amount;
          } else {
            statModifiers.push({ stat: effect.stat, operation: effect.operation, value: amount });
          }
          break;
        }
        case 'abilityCost':
          abilityCostReduction.set(
            effect.abilityId,
            (abilityCostReduction.get(effect.abilityId) ?? 0) + value,
          );
          break;
        case 'abilityCooldown':
          abilityCooldownReductionMs.set(
            effect.abilityId,
            (abilityCooldownReductionMs.get(effect.abilityId) ?? 0) +
              seconds(effect.unit === 'minutes' ? value * 60 : value),
          );
          break;
        case 'resourceMax':
          resourceMaximums[effect.resource] = (resourceMaximums[effect.resource] ?? 0) + value;
          break;
      }
    }
  }

  return {
    stats,
    statModifiers,
    resourceMaximums,
    grantedAbilities,
    abilityCostReduction,
    abilityCooldownReductionMs,
    unmodelled,
  };
}
