/**
 * The four colour schemes.
 *
 * Each is a set of values for the SAME role tokens in `styles.css` -- no theme
 * adds a rule, and no rule names a colour. That is the whole constraint: if a
 * scheme needed its own CSS it would not be a scheme, it would be a second
 * stylesheet, and the two would drift the way the character sheet and the gear
 * list already had.
 *
 * The pairings are conventions rather than inventions. Gold on near-black is
 * what premium and luxury brands reach for; charcoal with an ember accent is
 * the developer-tool look; teal against copper is a complementary pair used
 * across fintech and enterprise SaaS; near-black with electric violet is the
 * current dark-mode SaaS default.
 *
 * The chart series colours are NOT part of a theme. They stay fixed, because a
 * slice's colour identifies what it measures and should not move when the
 * chrome does.
 */
export type ThemeId = 'midnight' | 'graphite' | 'abyss' | 'obsidian';

export interface ThemeDefinition {
  readonly id: ThemeId;
  readonly name: string;
  /** What the pairing is, for the person choosing. */
  readonly note: string;
  /** Page background and accent, for the picker's own swatch. */
  readonly swatch: readonly [background: string, accent: string];
}

export const THEMES: readonly ThemeDefinition[] = [
  {
    id: 'midnight',
    name: 'Midnight Gold',
    note: 'Near-black navy and burnished gold',
    swatch: ['#0f1116', '#c8a45c'],
  },
  {
    id: 'graphite',
    name: 'Graphite Ember',
    note: 'Neutral charcoal and ember orange',
    swatch: ['#121214', '#e8722c'],
  },
  {
    id: 'abyss',
    name: 'Abyssal Copper',
    note: 'Deep teal against copper',
    swatch: ['#0b1417', '#d98a5f'],
  },
  {
    id: 'obsidian',
    name: 'Obsidian Violet',
    note: 'Near-black and electric violet',
    swatch: ['#0d0d12', '#8b6cf0'],
  },
];

export const DEFAULT_THEME: ThemeId = 'midnight';

const KNOWN = new Set<string>(THEMES.map((theme) => theme.id));

/** Whether a stored or hand-typed value is a theme this build knows. */
export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && KNOWN.has(value);
}

/** Storage key for the viewer's choice. Their browser only; nothing reads it back. */
export const THEME_STORAGE_KEY = 'simforever.theme';

/**
 * The theme to open in.
 *
 * Wrapped because `localStorage` throws outright in a private window with site
 * data blocked, and a colour preference is not worth a blank page.
 */
export function storedTheme(): ThemeId {
  try {
    const stored = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function storeTheme(theme: ThemeId): void {
  try {
    globalThis.localStorage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // A viewer who cannot store it simply picks again next visit.
  }
}

/**
 * Put the theme on the document.
 *
 * `data-theme` on the root element, which is what every `:root[data-theme=...]`
 * block in the stylesheet keys off. The default is written out rather than
 * left off, so the attribute always says which scheme is showing -- a missing
 * attribute and "midnight" would otherwise look the same to anyone debugging.
 */
export function applyTheme(theme: ThemeId, root: HTMLElement): void {
  root.dataset.theme = theme;
}
