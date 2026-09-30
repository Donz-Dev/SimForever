import type { PriorityEntry, Rotation, SimulationContext, Combatant } from '../../engine';
import { PriorityRotation } from '../../engine';
import type { CombatStyleId } from '../character';
import { MAX_COMBO_POINTS, comboPointsOn } from '../combat/comboPoints';

/**
 * Druid priority lists.
 *
 * ----------------------------------------------------------------------------
 * THE RULESET OWNER'S OWN LISTS. Every list in this file was specified by them,
 * entry by entry, and measured after -- so a number taken off one describes the
 * ruleset rather than this file's guess.
 *
 * IT SAID THE OPPOSITE FOR MOST OF THIS PROJECT'S LIFE, and the header that
 * said so was doing real work: "these are the standard shape of each build and
 * are NOT the ruleset owner's own lists, which have not been given." That is
 * how a shell is supposed to read, and it is why the figures measured off one
 * were never mistaken for the ruleset's.
 *
 * CHOSEN BY FORM, not by talents. A Druid's form IS its combat style, and a
 * style is a field on the character -- so unlike the Rogue, whose three specs
 * are all dual-wield and had to be told apart by their capstone, this is the
 * Warrior's arrangement: the style selects the list.
 * ----------------------------------------------------------------------------
 */



/*
 * ============================================================================
 * THE RULESET OWNER'S CONDITIONS. These three lists are theirs; what was here
 * before was this file's own guess and said so.
 * ============================================================================
 */

/**
 * "IF NOT ACTIVE", which is the owner's wording and NOT the two-second refresh
 * window that `missing` implements.
 *
 * A refresh RESETS an aura, so a window throws away whatever is left -- and the
 * faster the character acts, the sooner it reaches the entry inside the window
 * and the more it clips.
 *
 * MEASURED ON THIS CLASS. Nature's Grace cost the Moonkin 14.9 DPS doing
 * nothing but speeding it up: casts went 26.3 a fight to 27.4 while Moonfire
 * ticks fell 25.1 to 22.5 and Insect Swarm's 27.9 to 25.5. The buff was fine;
 * the two-second window was paying for it. `missing` and `REFRESH_WINDOW_MS`
 * are gone from this file with the lists that used them.
 */
const expired = (auraId: string) =>
  (context: SimulationContext, _actor: Combatant, target?: Combatant): boolean =>
    target !== undefined && target.auras.remainingMs(auraId, context.clock.now()) <= 0;

/** "<buff> duration > 0", on the Druid. */
const selfActive = (auraId: string) =>
  (_context: SimulationContext, actor: Combatant): boolean => actor.auras.has(auraId);

/** "<buff> stacks >= N", on the Druid. */
const selfStacksAtLeast = (auraId: string, minimum: number) =>
  (_context: SimulationContext, actor: Combatant): boolean =>
    actor.auras.stacksOf(auraId) >= minimum;

/** "energy <= N". */
const energyAtMost = (maximum: number) =>
  (_context: SimulationContext, actor: Combatant): boolean =>
    (actor.resources.get('energy')?.current ?? 0) <= maximum;

/** "rage >= N". */
const rageAtLeast = (minimum: number) =>
  (_context: SimulationContext, actor: Combatant): boolean =>
    (actor.resources.get('rage')?.current ?? 0) >= minimum;

/** "hit points <= N% of maximum". */
const healthAtMostFraction = (fraction: number) =>
  (_context: SimulationContext, actor: Combatant): boolean =>
    actor.health.maximum > 0 && actor.health.current / actor.health.maximum <= fraction;

/** "combo points = N", read THROUGH the target so a stale pool reads zero. */
const exactlyPoints = (count: number) =>
  (_context: SimulationContext, actor: Combatant, target?: Combatant): boolean =>
    comboPointsOn(actor, target) === count;

/** "<debuff> is on the target". */
const hasDebuff = (auraId: string) =>
  (_context: SimulationContext, _actor: Combatant, target?: Combatant): boolean =>
    target !== undefined && target.auras.has(auraId);

/** Every condition must hold. */
const all =
  (...conditions: readonly ((
    context: SimulationContext,
    actor: Combatant,
    target?: Combatant,
  ) => boolean)[]) =>
  (context: SimulationContext, actor: Combatant, target?: Combatant): boolean =>
    conditions.every((condition) => condition(context, actor, target));

/** The condition must NOT hold. */
const not =
  (condition: (context: SimulationContext, actor: Combatant, target?: Combatant) => boolean) =>
  (context: SimulationContext, actor: Combatant, target?: Combatant): boolean =>
    !condition(context, actor, target);

/*
 * ----------------------------------------------------------------------------
 * A FORM IS NOT AN ABILITY HERE, so "moonkin form if not active", "cat form if
 * not active" and "bear form if not active" are absent from the three lists
 * below rather than unimplemented.
 *
 * A Druid's form is its COMBAT STYLE -- a field the preset sets and the
 * character is built with -- not an aura and not something in the spellbook.
 * Every profile starts in the right form and cannot leave it, so the entry
 * would be a no-op even if it existed.
 *
 * IT WOULD BECOME REAL WORK the day form-shifting is modelled mid-fight, and
 * that same day would have to answer why nothing currently stops a Cat casting
 * Starfire: the engine gates on WARRIOR STANCES and on nothing else.
 * ----------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------

/**
 * MOONKIN — two damage-over-time effects held up, then Starfire.
 *
 * Starfire is 350-412 for 340 mana on a 3.5 second cast; Wrath is 62-68 for 120
 * on a 2 second one. Starfire is far better per cast AND per mana, so Wrath
 * appears only as the filler that keeps Eclipse stacking -- which currently
 * stacks and does nothing, and says so.
 */
export const DRUID_MOONKIN: readonly PriorityEntry[] = [
  { abilityId: 'moonfire', condition: expired('moonfire') },
  { abilityId: 'insect_swarm', condition: expired('insect_swarm') },
  /*
   * TWO STARFIRE ENTRIES, and the second is not a duplicate. Eclipse charges
   * shorten Starfire's cast and Nature's Grace shortens every cast AND the
   * global cooldown -- so the owner's first entry spends charges freely when
   * there are two or more, and the second spends the LAST one only while
   * Nature's Grace is up, which is the window where it is worth most.
   *
   * A repeated ability id is legal and is checked for the shape that is not:
   * a copy below an UNCONDITIONAL one, which can never be reached. Both of
   * these are gated, and the ungated filler below is Wrath.
   */
  {
    abilityId: 'starfire',
    condition: selfStacksAtLeast('eclipse', 2),
  },
  {
    abilityId: 'starfire',
    condition: all(selfStacksAtLeast('eclipse', 1), selfActive('natures_grace')),
  },
  { abilityId: 'wrath' },
];

/**
 * CAT — Rake and Rip held up, Ferocious Bite otherwise, Shred as the builder.
 *
 * SHRED IS THE BUILDER DESPITE ITS POSITIONAL REQUIREMENT, which this project
 * drops because nothing here has a facing. That is generous to the build and
 * the ability says so where it is declared.
 *
 * RIP ABOVE FEROCIOUS BITE. Rip at five points is 855 over twelve seconds for
 * 30 energy; Bite is 817 plus whatever the energy bar converts, for 35 and the
 * whole bar. Holding the bleed up is worth more than a burst that empties the
 * resource the rest of the list runs on.
 */
export const DRUID_CAT: readonly PriorityEntry[] = [
  /*
   * TIGER'S FURY ON A LOW ENERGY BAR, which is the owner's condition and reads
   * backwards until the ability is read: it is a damage buff on a thirty
   * second cooldown and costs no energy, so casting it while the bar is empty
   * spends a global cooldown that had nothing else to do with it.
   */
  { abilityId: 'tigers_fury', condition: energyAtMost(30) },
  { abilityId: 'berserk' },
  { abilityId: 'rip', condition: exactlyPoints(MAX_COMBO_POINTS) },
  { abilityId: 'rake', condition: expired('rake') },
  { abilityId: 'shred' },
];

/**
 * BEAR — Mangle on cooldown, Lacerate held up, Maul as the rage dump.
 *
 * MAUL IS LAST AND IS NOT A GLOBAL COOLDOWN. It replaces the next swing rather
 * than taking a cast, exactly as the Warrior's Heroic Strike does, so putting
 * it at the bottom costs the entries above it nothing.
 */
export const DRUID_BEAR: readonly PriorityEntry[] = [
  /*
   * NOT IF THE WARRIOR'S SHOUT IS ALREADY ON THE TARGET. The two do not stack
   * -- both are an attack power reduction -- so the owner's condition checks
   * for the other before spending a global cooldown on this one.
   *
   * IT CANNOT FIRE TODAY and is correct anyway: `demoralizing_shout` is not in
   * any preset's raid buff list, so nothing applies it to this encounter's
   * target. The clause costs nothing and is right the day a raid does.
   */
  {
    abilityId: 'demoralizing_roar',
    condition: all(expired('demoralizing_roar'), not(hasDebuff('demoralizing_shout'))),
  },
  { abilityId: 'barkskin', condition: healthAtMostFraction(0.5) },
  { abilityId: 'frenzied_regeneration', condition: healthAtMostFraction(0.35) },
  { abilityId: 'enrage' },
  { abilityId: 'berserk' },
  /*
   * "QUEUE MAUL IF RAGE >= 42". Maul is on-next-swing, so `queue` is exactly
   * what the list does with it: arming costs no global cooldown and the swing
   * carries it. The rage floor is what stops it eating the rage Primal Bite
   * and Lacerate below it need.
   */
  { abilityId: 'maul', condition: rageAtLeast(42) },
  // Primal Bite is `mangle`: the id kept the old name, the display name did not.
  { abilityId: 'mangle' },
  { abilityId: 'lacerate' },
];

export const DRUID_MOONKIN_ROTATION: Rotation = new PriorityRotation(
  'Druid (Moonkin)',
  DRUID_MOONKIN,
);
export const DRUID_CAT_ROTATION: Rotation = new PriorityRotation('Druid (Cat)', DRUID_CAT);
export const DRUID_BEAR_ROTATION: Rotation = new PriorityRotation('Druid (Bear)', DRUID_BEAR);

/** Which list a Druid runs, from the form it is in. */
export function druidRotation(style: CombatStyleId): Rotation | undefined {
  if (style === 'moonkin') return DRUID_MOONKIN_ROTATION;
  if (style === 'cat') return DRUID_CAT_ROTATION;
  if (style === 'bear') return DRUID_BEAR_ROTATION;
  // Caster and Tree of Life have no damage list worth the name.
  return undefined;
}
