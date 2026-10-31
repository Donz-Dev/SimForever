import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { abilityBookFor } from '../../src/ui/panels/AplPanel';
import { AbilityCard, AbilityHover } from '../../src/ui/components/AbilityCard';
import { abilityTooltip } from '../../src/game/abilities/abilityTooltips';
import { RACIAL_ABILITIES } from '../../src/game/racials';
import type { Ability } from '../../src/engine';

/*
 * The APL panel's ability hover card. Matched by NAME against the class's
 * spellbook capture, so the thing to pin is that the match actually lands: a
 * name that drifts from the client's would quietly fall back to the
 * simulator's own declaration, which reads as a working card.
 */

/** Abilities that belong to no class spellbook, written out by hand. */
const NOT_IN_A_CLASS_CAPTURE = new Set([
  'melee_weave',
  'mana_ruby',
  'eureka',
  // New at client build 1.60.1.70707, after the Paladin spellbook capture was
  // taken -- so its card falls back to what the simulator declares.
  'oath_of_light',
  ...Object.keys(RACIAL_ABILITIES),
]);
const isNotClassSpell = (ability: Ability) =>
  NOT_IN_A_CLASS_CAPTURE.has(ability.id) ||
  ability.id.startsWith('start_auto_attack') ||
  /potion|rune|healthstone|thistle_tea/.test(ability.id);

describe('the ability tooltip lookup', () => {
  it('finds every class spell any preset can cast', () => {
    const missing: string[] = [];
    for (const preset of PRESETS_BY_ID.values()) {
      const profile = preset.build();
      for (const ability of abilityBookFor(profile)) {
        if (isNotClassSpell(ability)) continue;
        if (!abilityTooltip(profile.character.characterClass, ability.name)) {
          missing.push(`${preset.id}: ${ability.id} (${ability.name})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('reads past a curly apostrophe', () => {
    // The ability is named with one; the capture writes a straight one.
    expect(abilityTooltip('hunter', 'Hunter’s Mark')?.name).toBe("Hunter's Mark");
  });

  it('looks only in the named class', () => {
    expect(abilityTooltip('warrior', 'Fireball')).toBeUndefined();
    expect(abilityTooltip('mage', 'Fireball')).toBeDefined();
  });
});

describe('the card', () => {
  const fireball: Ability = { id: 'fireball', name: 'Fireball', castTimeMs: 3000, onCast: () => {} };

  it("shows the client's tooltip when there is one", () => {
    const html = renderToStaticMarkup(createElement(AbilityCard, { ability: fireball, characterClass: 'mage' }));
    const tooltip = abilityTooltip('mage', 'Fireball')!;
    expect(html).toContain(tooltip.description);
    expect(html).toContain(tooltip.cast!);
    expect(html).not.toContain('No client tooltip');
  });

  it('falls back to what the simulator declares, and says so', () => {
    const potion: Ability = {
      id: 'major_mana_potion',
      name: 'Major Mana Potion',
      triggersGcd: false,
      cooldownMs: 120000,
      onCast: () => {},
    };
    const html = renderToStaticMarkup(createElement(AbilityCard, { ability: potion, characterClass: 'mage' }));
    expect(html).toContain('Instant');
    expect(html).toContain('120 sec cooldown');
    expect(html).toContain('Off the global cooldown');
    expect(html).toContain('No client tooltip');
  });

  it('is only the children outside the panel', () => {
    expect(renderToStaticMarkup(createElement(AbilityHover, { abilityId: 'fireball', children: 'Fireball' }))).toBe('Fireball');
  });
});
