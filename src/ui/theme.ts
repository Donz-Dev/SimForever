/**
 * The four colour schemes.
 *
 * Each is a set of values for the SAME role tokens in `styles.css` -- no theme
 * adds a rule, and no rule names a colour. That is the whole constraint: if a
 * scheme needed its own CSS it would not be a scheme, it would be a second
 * stylesheet, and the two would drift the way the character sheet and the gear
 * list already had.
 *
 * The pairings are conventions rather than inventions. Teal against copper is
 * a complementary pair used across fintech and enterprise SaaS; charcoal with
 * an ember accent is the developer-tool look; gold on near-black is what
 * premium and luxury brands reach for; near-black with electric violet is the
 * current dark-mode SaaS default.
 *
 * NOT EXPOSED IN THE INTERFACE. The picker was there to choose with, and the
 * choice is made: Abyssal Copper holds the bare `:root`, so it is what the
 * page renders with no JavaScript involved at all.
 *
 * The other three are KEPT rather than deleted. Each is a block of values
 * with no rule and no branch behind it, so they cost nothing at runtime, and
 * a scheme is cheap to try and expensive to reconstruct. To see one, set
 * `data-theme` on the root element:
 *
 *     document.documentElement.dataset.theme = 'obsidian';
 *
 * This module is what keeps them honest. Nothing imports it, and that is the
 * point -- it is the catalogue the tests check the stylesheet against, so a
 * scheme cannot quietly lose a token or disagree with the default.
 *
 * The chart series colours are NOT part of a theme. They stay fixed, because a
 * slice's colour identifies what it measures and should not move when the
 * chrome does.
 */
export type ThemeId = 'midnight' | 'graphite' | 'abyss' | 'obsidian';

export interface ThemeDefinition {
  readonly id: ThemeId;
  readonly name: string;
  /** What the pairing is. */
  readonly note: string;
  /** Page background and accent, for identifying it at a glance. */
  readonly swatch: readonly [background: string, accent: string];
}

export const THEMES: readonly ThemeDefinition[] = [
  {
    id: 'abyss',
    name: 'Abyssal Copper',
    note: 'Deep teal against copper',
    swatch: ['#0b1417', '#d98a5f'],
  },
  {
    id: 'graphite',
    name: 'Graphite Ember',
    note: 'Neutral charcoal and ember orange',
    swatch: ['#121214', '#e8722c'],
  },
  {
    id: 'midnight',
    name: 'Midnight Gold',
    note: 'Near-black navy and burnished gold',
    swatch: ['#0f1116', '#c8a45c'],
  },
  {
    id: 'obsidian',
    name: 'Obsidian Violet',
    note: 'Near-black and electric violet',
    swatch: ['#0d0d12', '#8b6cf0'],
  },
];

/*
 * The scheme chosen by the project owner, and the only one anyone sees.
 *
 * It must match whichever block holds the bare `:root` selector in
 * `styles.css`. With no picker that is not a flash-of-wrong-colour risk any
 * more -- it is the whole mechanism, because nothing else ever sets
 * `data-theme`. A test pins the pair together.
 */
export const DEFAULT_THEME: ThemeId = 'abyss';

const KNOWN = new Set<string>(THEMES.map((theme) => theme.id));

/** Whether a stored or hand-typed value is a theme this build knows. */
export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && KNOWN.has(value);
}
