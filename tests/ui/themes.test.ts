import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, isThemeId, THEMES } from '../../src/ui/theme';

/*
 * The four colour schemes, checked structurally.
 *
 * A theme is a set of values for the SAME role tokens, so the things that can
 * break it are: a rule naming a colour directly, a theme missing a token the
 * others define, or a token nothing reads. All three are findable in the
 * stylesheet, and none of them are findable by looking at one theme.
 */

const CSS = readFileSync(new URL('../../src/ui/styles.css', import.meta.url), 'utf8');

/** The body of one `:root...{ }` block, by the selector that opens it. */
function block(selector: string): string {
  const start = CSS.indexOf(selector);
  expect(start, `no block for ${selector}`).toBeGreaterThan(-1);
  const open = CSS.indexOf('{', start);
  const close = CSS.indexOf('}', open);
  return CSS.slice(open + 1, close);
}

function tokensIn(body: string): string[] {
  return [...body.matchAll(/^\s*(--[a-z0-9-]+):/gim)].map((match) => match[1]);
}

describe('the theme catalogue', () => {
  it('offers exactly four schemes, the chosen one first', () => {
    expect(THEMES.map((theme) => theme.id)).toEqual([
      'abyss',
      'graphite',
      'midnight',
      'obsidian',
    ]);
  });

  it('opens in Abyssal Copper', () => {
    expect(DEFAULT_THEME).toBe('abyss');
    expect(THEMES.some((theme) => theme.id === DEFAULT_THEME)).toBe(true);
  });

  it('gives the default scheme the bare :root selector too', () => {
    /*
     * THE ONE THAT WOULD BITE. The page paints before React runs, so the
     * scheme on the bare `:root` is what shows for that first frame. If
     * DEFAULT_THEME and that block disagree, every load flashes the wrong
     * colours and then corrects itself -- which looks like a rendering bug
     * rather than a one-character mismatch in a stylesheet.
     */
    expect(CSS).toContain(`:root,
:root[data-theme='${DEFAULT_THEME}'] {`);

    // And exactly one block holds it, or the later one silently wins.
    expect(CSS.match(/^:root,$/gm)).toHaveLength(1);
  });

  it('gives every scheme a name, a note and a swatch', () => {
    for (const theme of THEMES) {
      expect(theme.name.length).toBeGreaterThan(3);
      expect(theme.note.length).toBeGreaterThan(10);
      // The picker paints its own chips from these, so both must be real hex.
      for (const colour of theme.swatch) {
        expect(colour).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('rejects a theme id this build does not know', () => {
    // A hand-edited localStorage value, or one from a future build.
    expect(isThemeId('midnight')).toBe(true);
    expect(isThemeId('solarized')).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
    expect(isThemeId(null)).toBe(false);
  });
});

describe('every scheme defines the same roles', () => {
  /*
   * THE CHECK THAT MATTERS. A theme missing one token silently inherits the
   * default's value for it, which is how a "dark violet" scheme ends up with
   * one gold border nobody can explain.
   */
  const base = tokensIn(block(":root,\n:root[data-theme='abyss']"));

  it('defines a good number of roles, not a handful', () => {
    // Guards the guard: if the block parser broke and returned nothing, every
    // assertion below would pass vacuously.
    expect(base.length).toBeGreaterThan(20);
  });

  for (const id of ['graphite', 'midnight', 'obsidian']) {
    it(`${id} defines every role the default does, and no extras`, () => {
      expect([...tokensIn(block(`:root[data-theme='${id}']`))].sort()).toEqual(
        [...base].sort(),
      );
    });
  }
});

describe('no rule names a colour', () => {
  /*
   * Everything below the theme blocks must go through a token. A literal
   * there is a colour one scheme cannot change, which is exactly the failure
   * this whole refactor was for -- the gold `rgba(200, 164, 92, ...)` washes
   * meant no other accent was possible however many tokens were declared.
   */
  const afterThemes = CSS.slice(CSS.indexOf('* {\n  box-sizing: border-box;\n}'));

  it('uses no hex literal outside the theme definitions', () => {
    const hex = [...afterThemes.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0]);
    expect(hex).toEqual([]);
  });

  it('uses no rgb() or rgba() literal outside the theme definitions', () => {
    const rgb = [...afterThemes.matchAll(/\brgba?\([^)]*\)/gi)].map((m) => m[0]);
    expect(rgb).toEqual([]);
  });
});

describe('the game layer holds no colours', () => {
  it('names tree accents as tokens, not as hex', () => {
    /*
     * `talentData.ts` is game content, and it used to carry three literal
     * colours for the tree headers -- presentation in the layer that is not
     * allowed to know the UI exists. What stays there is the game fact (a
     * class has three trees, in a fixed order); the values live with every
     * other colour.
     */
    const data = readFileSync(
      new URL('../../src/game/talents/talentData.ts', import.meta.url),
      'utf8',
    );
    expect(data).not.toMatch(/#[0-9a-f]{6}/i);
    expect(data).toContain('var(--tree-1)');
  });
});

describe('the chart series palette', () => {
  const shared = block(':root {\n  /* Accent washes are DERIVED');

  it('is declared once, outside every theme', () => {
    /*
     * Series colours identify WHAT is being measured, so they must not move
     * when the chrome does -- Heroic Strike's slice is the same colour in all
     * four schemes. Declaring them per theme is how that would stop being
     * true.
     */
    for (const id of ['abyss', 'graphite', 'midnight', 'obsidian']) {
      const body =
        id === 'abyss'
          ? block(":root,\n:root[data-theme='abyss']")
          : block(`:root[data-theme='${id}']`);
      expect(body).not.toContain('--series-');
    }
    expect(tokensIn(shared).filter((t) => t.startsWith('--series-'))).toHaveLength(8);
  });

  it('is the validated dark categorical set, in its validated order', () => {
    /*
     * Written out by hand. The ORDER is the colour-vision-deficiency safety
     * mechanism rather than a preference: it is what keeps neighbouring
     * slices apart for a protan or tritan reader. Re-ordering these to make
     * one chart look better breaks a guarantee, so it should break a test.
     */
    const expected = [
      '#3987e5',
      '#d95926',
      '#199e70',
      '#c98500',
      '#d55181',
      '#008300',
      '#9085e9',
      '#e66767',
    ];
    for (const [index, colour] of expected.entries()) {
      expect(shared).toContain(`--series-${index + 1}: ${colour};`);
    }
  });
});
