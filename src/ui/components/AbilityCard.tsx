import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { Ability } from '../../engine';
import type { ClassId } from '../../game/character';
import { abilityTooltip } from '../../game/abilities/abilityTooltips';
import { HoverCard } from './HoverCard';

/**
 * What an ability's hover card needs to know about the character: its class,
 * which picks the spellbook capture, and its ability book, which turns an id
 * into the ability. Provided once by the APL panel, so the rows that name an
 * ability do not each have to be handed both.
 */
export interface AbilityCardSource {
  readonly characterClass: ClassId;
  readonly book: ReadonlyMap<string, Ability>;
}

export const AbilityCardContext = createContext<AbilityCardSource | undefined>(undefined);

/**
 * The card an ability shows on hover, drawn like a talent's.
 *
 * ==============================================================================
 * THE CLIENT'S OWN TOOLTIP WHEN THERE IS ONE: the spellbook capture at max rank,
 * which is the rank a level 60 casts -- cost, range, cast and cooldown in the
 * client's words, then the description. See `abilityTooltip`.
 *
 * WHEN THERE IS NONE, WHAT THE SIMULATOR DECLARES, AND SAID AS SUCH. Racials,
 * consumables, Start Auto-attack and Melee Weave have no capture, and a blank
 * card would read as a missing feature while a borrowed description would be
 * invented. Cast time, cooldown and the global cooldown come off the ability
 * itself, which is exactly what the fight runs on.
 * ==============================================================================
 */
export function AbilityCard({ ability, characterClass }: { readonly ability: Ability; readonly characterClass: ClassId }) {
  const tooltip = abilityTooltip(characterClass, ability.name);
  if (tooltip) {
    // The client's two rows: cost against range, then cast against cooldown.
    const rows = [
      [tooltip.cost, tooltip.range],
      [tooltip.cast, tooltip.cooldown],
    ].filter(([left, right]) => left || right);
    return (
      <div className="talent-card ability-card">
        <div className="talent-card-name">{tooltip.name}</div>
        <div className="talent-card-rank">
          {[tooltip.rank !== null ? `Rank ${tooltip.rank}` : undefined, tooltip.school].filter(Boolean).join(' · ')}
        </div>
        {rows.map(([left, right], index) => (
          <div key={index} className="ability-card-lines">
            <span>{left ?? ''}</span>
            <span>{right ?? ''}</span>
          </div>
        ))}
        {tooltip.requires ? <div className="ability-card-requires">{tooltip.requires}</div> : null}
        <p className="talent-card-text">{tooltip.description}</p>
      </div>
    );
  }

  const cast =
    (ability.castTimeMs ?? 0) <= 0
      ? 'Instant'
      : `${seconds(ability.castTimeMs!)} sec ${(ability.channelTicks ?? 1) > 1 ? 'channel' : 'cast'}`;
  const offGcd = ability.triggersGcd === false || ability.onNextSwing !== undefined;
  return (
    <div className="talent-card ability-card">
      <div className="talent-card-name">{ability.name}</div>
      <div className="ability-card-lines">
        <span>{cast}</span>
        <span>{ability.cooldownMs ? `${seconds(ability.cooldownMs)} sec cooldown` : ''}</span>
      </div>
      {offGcd ? <div className="talent-card-label">Off the global cooldown</div> : null}
      <div className="talent-card-foot">No client tooltip on file; this is what the simulator declares.</div>
    </div>
  );
}

/** `1500` to `1.5`, `180000` to `180`. */
const seconds = (ms: number) => String(Math.round(ms / 100) / 10);

/**
 * Wraps whatever names an ability -- a label or a dropdown -- in its card.
 * Outside an `AbilityCardContext`, or for an id the book does not hold, it is
 * the children and nothing else.
 */
export function AbilityHover({ abilityId, children }: { readonly abilityId: string; readonly children: ReactNode }) {
  const source = useContext(AbilityCardContext);
  const ability = source?.book.get(abilityId);
  if (!source || !ability) return <>{children}</>;
  return (
    <HoverCard className="ability-hover" card={() => <AbilityCard ability={ability} characterClass={source.characterClass} />}>
      {children}
    </HoverCard>
  );
}
