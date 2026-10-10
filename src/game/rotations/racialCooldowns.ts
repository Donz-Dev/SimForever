import type { AplEntry } from './apl';

/**
 * The racial cooldowns every priority list carries.
 *
 * ============================================================================
 * WHY THEY ARE IN THE LISTS AT ALL, AND WHY THAT IS NOT A CHOICE.
 *
 * An ability in the book and in no list NEVER FIRES, and this project has paid
 * for that four separate ways -- it is the fourth cause of inert, "the list",
 * and the one that reads exactly like an engine gap. Blood Fury, Berserking,
 * Elune's Light and Eureka! are learned by a race rather than by a class, so no
 * class list was ever going to name them: without this they would be declared,
 * learnable, castable, never cast, and reported nowhere.
 *
 * ONE SHARED CONSTANT RATHER THAN TWENTY-SEVEN COPIES, which is the
 * `withStockRotations` argument: twenty-seven hand-written copies would be
 * twenty-seven chances to write the wrong one, and the one that drifted would
 * be the one nobody measured.
 *
 * A LIST NAMING AN ABILITY THE BUILD LACKS IS SILENT, which is what makes one
 * constant safe in every list of every class. `PriorityRotation` skips an
 * ability the character does not know, so an Orc Warrior's list carries all
 * four entries and only Blood Fury can ever fire. That is the same property
 * that lets one Hunter list serve a build without the capstone.
 *
 * ============================================================================
 * THEY GO SECOND, AND BOTH ENDS OF THE LIST WERE TRIED AND MEASURED FIRST.
 *
 * THE TOP WAS THE OBVIOUS PLACE AND IT BROKE CHARGE COMPLETELY. Charge's
 * `canCast` is `simulation.clock.now() === CHARGE_OPENING_TIMESTAMP_MS` -- it
 * is castable at the opening instant and never again -- and `nextDecisionTime`
 * gives a free actor `now + ROTATION_POLL_MS`. So a free off-GCD racial cast at
 * the pull pushes the next decision 100ms out, the window is gone, and the two
 * Warrior builds that open with Charge lost their opener for the whole fight.
 * Measured: Charge went from one cast a fight to ZERO.
 *
 * THE BOTTOM IS THIS PROJECT'S OWN RULE FOR A NEW ENTRY -- "the only position
 * that cannot change what the list already does" -- AND IT MADE FIVE OF SEVEN
 * RACIALS INERT. A list with anything castable never falls that far: Blood Fury
 * fired on two of the seven Orc profiles and Berserking and Eureka! on none at
 * all. That rule is about an entry that COSTS something, and these do not; what
 * the bottom costs instead is the entry ever being reached.
 *
 * SO: AFTER WHATEVER OPENS THE LIST. Every pull-only entry keeps its position,
 * and all seven profiles that learn an active racial cast it once a fight.
 *
 * WHAT IT COSTS IS ONE POLL PER CAST. An off-GCD cast leaves the actor free, so
 * `nextDecisionTime` returns `now + 100ms` rather than a GCD -- 100ms of idle,
 * once per two or three minute cooldown, which is about 0.17% of a fight. The
 * same price Bloodrage and the stance casts already pay at the top of the
 * Warrior lists.
 *
 * AND NONE OF THEM IS A FLOOR, which is the thing an unconditional entry
 * usually is. An entry is a floor under everything below it when it is ungated
 * AND ALWAYS CASTABLE -- and a two or three minute cooldown is the half that is
 * easy to forget, because the condition is what is written in the list and the
 * cooldown is not. Sniper Shot is the worked example: moved below an ungated
 * Arcane Shot it still fired twice a fight and measured identically, because
 * Arcane Shot's own cooldown let the list fall straight past it.
 *
 * All four are free -- no resource cost, because the client states none for any
 * racial and inventing one would be inventing data -- and all four are OFF the
 * global cooldown, which the owner states explicitly.
 *
 * WHY NOT GATED ON ANYTHING. Three of the four are a flat percentage for a
 * fixed window with nothing to line them up with, so there is no condition to
 * write that is not a guess at a burst phase this encounter does not have.
 * Eureka! is the one that could in principle want one -- its three charges want
 * to land on three expensive abilities -- and it is left ungated because the
 * charges have no duration: they wait until they are spent, so there is nothing
 * to waste by casting it at the pull. That is the opposite of the Cat's
 * Shifting Power, where a gate was worth positive DPS precisely because the
 * grant could overflow.
 * ============================================================================
 */
export const RACIAL_COOLDOWNS: readonly AplEntry[] = [
  // Orc: +10% attack power, ranged attack power and spell power for 15s.
  { abilityId: 'blood_fury' },
  // Troll: +10% spell and attack speed for 10s.
  { abilityId: 'berserking' },
  // Night Elf: +10% crit with everything for 15s.
  { abilityId: 'elunes_light' },
  // Gnome: the next three damaging abilities cost 10% less and hit 10% harder.
  { abilityId: 'eureka' },
];

/**
 * And the one that is defensive, which belongs only in a TANK list.
 *
 * ----------------------------------------------------------------------------
 * STONEFORM IS THE SHIELD WALL CASE, and it is separated for the same reason.
 * It reduces physical damage taken by 10% for eight seconds and it is the ONE
 * racial that costs a global cooldown -- the owner states "1.5 second Global
 * Cooldown" for this one and "No Global Cooldown" for the other four.
 *
 * So in a DPS list it is a straight loss: it buys nothing against a target that
 * never swings back, and it spends a global cooldown that would have been an
 * ability. In a tank list it is a real decision, which is exactly what was said
 * about Shield Wall when survival became a count of deaths rather than an
 * immunity.
 *
 * IT IS WORTH 0.0 TO ALL 25 PRESETS EITHER WAY, because none of them is a
 * Dwarf. What this placement decides is what a hand-built Dwarf tank does, and
 * what the entry means the day a Dwarf preset exists.
 * ----------------------------------------------------------------------------
 */
export const RACIAL_DEFENSIVE_COOLDOWNS: readonly AplEntry[] = [
  // Dwarf: -10% physical damage taken for 8s. Costs a global cooldown.
  { abilityId: 'stoneform' },
];
