import type { ClassId } from '../character';
import druid from '../../data/abilities/forever-druid-spellbook.json';
import hunter from '../../data/abilities/forever-hunter-spellbook.json';
import mage from '../../data/abilities/forever-mage-spellbook.json';
import paladin from '../../data/abilities/forever-paladin-spellbook.json';
import priest from '../../data/abilities/forever-priest-spellbook.json';
import rogue from '../../data/abilities/forever-rogue-spellbook.json';
import shaman from '../../data/abilities/forever-shaman-spellbook.json';
import warlock from '../../data/abilities/forever-warlock-spellbook.json';
import warrior from '../../data/abilities/forever-warrior-spellbook.json';

/**
 * One spell's client tooltip, as the spellbook capture holds it: max rank, the
 * client's own words for cost, range, cast and cooldown, and its description.
 */
export interface AbilityTooltip {
  readonly name: string;
  readonly rank: number | null;
  readonly school: string;
  readonly cost?: string;
  readonly range?: string;
  readonly cast?: string;
  readonly cooldown?: string;
  readonly requires?: string;
  readonly description: string;
}

interface Capture {
  readonly spells: readonly (AbilityTooltip & { readonly id: number })[];
}

const CAPTURES: Readonly<Record<ClassId, Capture>> = {
  druid,
  hunter,
  mage,
  paladin,
  priest,
  rogue,
  shaman,
  warlock,
  warrior,
} as unknown as Readonly<Record<ClassId, Capture>>;

/*
 * ==============================================================================
 * MATCHED BY NAME, because the capture is keyed by the client's spell id and an
 * ability here by an id of its own -- `rend_cast` is "Rend", and `mangle` is
 * "Primal Bite" since the rename. Every class spell any preset can cast matches
 * its capture entry by name; the one difference is an apostrophe --
 * Hunter's Mark is named with a curly one here and a straight one in the
 * capture -- which is why names are normalised first.
 *
 * WHAT IS NOT IN A CLASS CAPTURE GETS NO TOOLTIP, rather than a borrowed one:
 * racials (`/racials.js` is not captured), consumables, Start Auto-attack, Melee
 * Weave and two proc-granted Mage abilities. The card falls back to what the
 * simulator itself declares -- see `AbilityCard`.
 * ==============================================================================
 */
const normalise = (name: string) => name.replace(/[‘’]/g, "'").trim().toLowerCase();

const BY_CLASS = new Map<ClassId, ReadonlyMap<string, AbilityTooltip>>(
  (Object.keys(CAPTURES) as ClassId[]).map((characterClass) => [
    characterClass,
    new Map(CAPTURES[characterClass].spells.map((spell) => [normalise(spell.name), spell])),
  ]),
);

/** The client tooltip for an ability of this class, by its display name. */
export function abilityTooltip(characterClass: ClassId, name: string): AbilityTooltip | undefined {
  return BY_CLASS.get(characterClass)?.get(normalise(name));
}
