import type { AttackChanceProvider, AttackTableKind, Combatant, WeaponSlot } from '../../engine';
import { toPercent } from '../../engine';

/**
 * How much of a CAPPED stat a build can still use, table by table.
 *
 * ------------------------------------------------------------------------------
 * "CHANCE TO MISS" IS UP TO FIVE DIFFERENT NUMBERS, AND A BUILD CAN BE CAPPED ON
 * ONE AND NOT ANOTHER. That is the whole reason this file exists. A level 60
 * character against a level 63 target misses specials on 8%, main-hand swings on
 * 27% while dual-wielding, and spells on 17% floored at 1% -- so a Rogue sitting
 * on 16 points of hit has NO headroom on its specials, none on its spells, and
 * eleven points of it left on its auto-attacks.
 *
 *   profile        melee specials   main-hand swings   spells
 *   rogue_combat      0.00 capped             11.00      1.00 (at the floor)
 *   dw_fury           0.00 capped             19.00      9.00
 *   prot_warr         0.00 capped      0.00 capped          --
 *
 * AND THE PROT WARRIOR IS THE CASE THE REPORTING IS FOR: every slice it rolls on
 * is at zero, so the ladder below comes back EMPTY and the answer is "already
 * capped, no stat weight" rather than a measurement of nothing.
 *
 * SO THE ANSWER IS NOT ONE NUMBER BUT A LADDER. Each distinct headroom is a
 * point where one more table stops paying, which makes the intervals between
 * them the only places a point of hit is worth a CONSTANT amount: nothing
 * changes behaviour inside a tier, because the tier boundaries are exactly the
 * points where something does. That is what `tiersFrom` builds, and it is what
 * lets the stat-weight runner measure a whole tier in one go and still report a
 * true per-point figure -- a single large step across a cap would average the
 * first point (worth a lot) together with the last (worth nothing), and a single
 * small step would be swamped by noise.
 *
 * THE TABLES ARE THE ONES THE CHARACTER CAN ROLL ON, read from its auto-attack
 * mode and its ability book -- the same "gate at the book" reasoning
 * `abilitiesForBuild` uses. An ability in the book that no priority list ever
 * casts still contributes its table here, which can add a boundary that splits
 * one tier into two identical ones. That is wasteful and not wrong: the two
 * halves measure the same per-point value and say so. Reading the tables off a
 * RUN instead would be more precise and would mean the plan could not be shown
 * until after the baseline, which is the thing a person wants to see first.
 *
 * ONE KNOWN OVER-ESTIMATE, AND IT IS WRITTEN DOWN RATHER THAN HIDDEN. Spell hit
 * arrives along two routes and only one goes through `attackChances`: the
 * character-wide `hitChance` stat is folded into the table, and a SCHOOL-scoped
 * `hitBonus` -- five talents across three classes -- is folded in later by
 * `withModifier`. The `spell` slice below reads the table, so for the Shockadin,
 * whose Divine Precision puts Holy at the 1% floor already, the planned
 * headroom is larger than Holy can use. The MEASUREMENT is unaffected and will
 * price that tier at what it is really worth; it is the plan's own words that
 * are optimistic. Narrowing it would need the schools the build actually casts,
 * and an ability declares its table but not its school -- a school is decided
 * per `dealDamage` call.
 * ------------------------------------------------------------------------------
 */

/**
 * A stat whose value falls to zero at a cap, and whose cap differs per table.
 *
 * Only two, and both are ATTACKER-SIDE terms in slices the defender otherwise
 * owns: hit comes off miss, and `dodgeParryReduction` comes off dodge and parry.
 * Everything else a stat-weight run can ask about is uncapped in any range a
 * piece of gear could reach, so it takes a fixed step instead.
 */
export type TieredStat = 'hitChance' | 'dodgeParryReduction';

/** One row of what is left, after slices that agree have been folded together. */
export interface HeadroomSlice {
  readonly table: AttackTableKind;
  /** Which hand swung, where that changes the answer. */
  readonly slot?: WeaponSlot;
  /**
   * Human words, for the plan the panel prints.
   *
   * THE FOLDED NAME WHERE SEVERAL SLICES AGREE. `dodgeParryReduction` comes off
   * three melee tables and the answer is the same 6.50% on every one of them,
   * so printing "main-hand swings (dodge), off-hand swings (dodge), melee
   * specials (dodge)" is three rows of one fact. It is one row called "Dodge",
   * and the detail comes back only if the tables ever disagree -- which they
   * would the day anything grants weapon skill with one hand and not the other.
   */
  readonly label: string;
  /** Percentage points the slice currently shows. */
  readonly current: number;
  /**
   * Percentage points of the stat this slice can still absorb.
   *
   * Zero means capped: a further point buys nothing HERE, though it may still
   * buy something on another slice.
   */
  readonly headroom: number;
}

/**
 * One rung: the points it takes to cap the next slice, and what that is.
 *
 * `from` and `to` are percentage points ADDED to the character, so a rung is
 * read as "`to - from` more points, on top of whatever the gear already
 * gives". `caps` is what runs out at `to` and is what the rung is NAMED after
 * -- "+9.00% to cap off-hand swings" is the figure somebody asked for, where
 * "the first 9.00%" reads like a cap and is not one. `benefits` is everything
 * still paying anywhere inside the rung, which is the wider set.
 */
export interface StatTier {
  readonly from: number;
  readonly to: number;
  /** The slices whose headroom runs out exactly at `to`. */
  readonly caps: readonly string[];
  /** Everything still gaining anywhere inside the rung. */
  readonly benefits: readonly string[];
}

/**
 * Labels for the table-and-slot pairs, so the plan reads in words.
 *
 * `ranged-special` IS NOT CALLED "ranged abilities", and that is deliberate.
 * Thunder Clap, Intercept and Charge are melee Warrior abilities that declare
 * it -- the table has no dodge or parry, which is why -- so a Warrior's plan
 * shows this slice with no bow in sight. Naming it after the table rather than
 * after what the table sounds like is the only honest option: this project's
 * own note on it is "check a class's own abilities, not a table name".
 */
const SLICE_LABELS: Readonly<Record<string, string>> = {
  'melee-auto:mainHand': 'Main-hand swings',
  'melee-auto:offHand': 'Off-hand swings',
  'melee-special:mainHand': 'Melee specials',
  'ranged-auto:ranged': 'Ranged swings',
  'ranged-special:ranged': 'Ranged-table specials',
  spell: 'Spells',
};

/**
 * The table-and-slot pairs this character can actually roll on.
 *
 * MELEE SPECIALS ARE READ MAIN-HAND ONLY, which is a simplification and the one
 * place this file rounds. A special declares the weapon it needs and almost
 * every one in the project declares the main hand; the exceptions are
 * multi-hit abilities whose off-hand half is a second strike. Reporting a
 * second slice for them would split a tier on a difference only Whirlwind's
 * off hand can see.
 */
function slicesToConsider(player: Combatant): readonly { table: AttackTableKind; slot?: WeaponSlot }[] {
  const out: { table: AttackTableKind; slot?: WeaponSlot }[] = [];

  if (player.autoAttack === 'main-hand' || player.autoAttack === 'dual-wield') {
    out.push({ table: 'melee-auto', slot: 'mainHand' });
  }
  if (player.autoAttack === 'dual-wield') {
    out.push({ table: 'melee-auto', slot: 'offHand' });
  }
  if (player.autoAttack === 'ranged') {
    out.push({ table: 'ranged-auto', slot: 'ranged' });
  }

  const tables = new Set(
    player.abilities.all.flatMap((ability) => (ability.attackTable ? [ability.attackTable] : [])),
  );
  if (tables.has('melee-special')) out.push({ table: 'melee-special', slot: 'mainHand' });
  if (tables.has('ranged-special')) out.push({ table: 'ranged-special', slot: 'ranged' });
  if (tables.has('spell')) out.push({ table: 'spell' });

  return out;
}

function labelFor(table: AttackTableKind, slot?: WeaponSlot): string {
  return SLICE_LABELS[slot ? `${table}:${slot}` : table] ?? table;
}

/**
 * What one point of hit still has left to eat, slice by slice.
 *
 * MISS MINUS THE TABLE'S OWN FLOOR, never miss alone. The floor travels on the
 * table rather than being applied where the table is built, precisely so both
 * routes to spell hit respect it -- so reading `miss` here and ignoring
 * `missFloor` would promise a caster the seventeenth point of hit that the
 * ruleset owner's own cap says buys nothing.
 */
export function hitHeadroom(
  player: Combatant,
  target: Combatant,
  chances: AttackChanceProvider,
): readonly HeadroomSlice[] {
  return fold(
    slicesToConsider(player).map(({ table, slot }) => {
      const rolled = chances(table, player, target, slot ? { slot } : {});
      const floor = rolled.missFloor ?? 0;
      return {
        table,
        ...(slot ? { slot } : {}),
        // Both specials tables are one row while they agree, which they do
        // unless something grants hit to one and not the other.
        group: table.endsWith('-special') ? 'Specials' : labelFor(table, slot),
        label: labelFor(table, slot),
        current: toPercent(rolled.miss),
        headroom: Math.max(0, toPercent(rolled.miss - floor)),
      };
    }),
  );
}

/**
 * What one point of `dodgeParryReduction` still has left to eat.
 *
 * TWO SLICES OUT OF ONE TABLE, which is the shape that makes this stat tiered
 * at all: the reduction is subtracted from the defender's dodge AND from its
 * parry, and those are different sizes. Enemy parry is 14% for a character
 * standing in front of the target and ZERO for everybody else, so a
 * dual-wielder's ladder has one rung at its 6.5% dodge and a shield build's has
 * a second at 14%.
 *
 * NEITHER SLICE FLOORS ANYWHERE BUT ZERO. `clampChance` is what holds them,
 * which is the whole cap: a slice at zero cannot go negative and a further
 * point is simply discarded.
 */
export function dodgeParryHeadroom(
  player: Combatant,
  target: Combatant,
  chances: AttackChanceProvider,
): readonly HeadroomSlice[] {
  const rows: Grouped[] = [];

  for (const { table, slot } of slicesToConsider(player)) {
    // Dodge and parry exist on the two melee tables and nowhere else. A shot
    // and a spell cannot be dodged here, so the stat has nothing to buy on them.
    if (table !== 'melee-auto' && table !== 'melee-special') continue;

    const rolled = chances(table, player, target, slot ? { slot } : {});
    for (const [outcome, units] of [
      ['Dodge', rolled.dodge],
      ['Parry', rolled.parry],
    ] as const) {
      rows.push({
        table,
        ...(slot ? { slot } : {}),
        /*
         * GROUPED BY THE OUTCOME, not by the table it was read off. Enemy
         * dodge is the same 6.50% on every melee table a build rolls on, so
         * three rows saying so is three rows of one fact -- `fold` turns them
         * into one called "Dodge" and only splits them if they disagree.
         */
        group: outcome,
        label: `${labelFor(table, slot)} (${outcome.toLowerCase()})`,
        current: toPercent(units),
        headroom: Math.max(0, toPercent(units)),
      });
    }
  }

  return fold(rows);
}

/** A slice before folding: it still knows which table it came off. */
interface Grouped extends HeadroomSlice {
  readonly group: string;
}

/**
 * Fold slices that agree, and keep the detail only where they do not.
 *
 * ------------------------------------------------------------------------------
 * ONE ROW PER (GROUP, HEADROOM). Where a whole group agrees -- which is every
 * build in this project, because nothing grants weapon skill to one hand -- the
 * row is called by the group alone: "Dodge", "Specials". Where it splits, each
 * row keeps its own full label, so a difference can never be folded away
 * silently.
 *
 * The TIERS are unaffected either way: a rung boundary is a distinct headroom
 * value, and folding rows that share one removes no value.
 * ------------------------------------------------------------------------------
 */
function fold(rows: readonly Grouped[]): readonly HeadroomSlice[] {
  const byGroup = new Map<string, Grouped[]>();
  for (const row of rows) {
    const existing = byGroup.get(row.group);
    if (existing) existing.push(row);
    else byGroup.set(row.group, [row]);
  }

  const out: HeadroomSlice[] = [];
  for (const [group, members] of byGroup) {
    const distinct = [...new Set(members.map((member) => member.headroom))];
    if (distinct.length === 1) {
      const [first] = members;
      out.push({ ...first, label: group });
      continue;
    }
    // The group disagrees with itself, so every member keeps its own name.
    for (const member of members) out.push(member);
  }
  return out;
}

/** Headroom for whichever of the two tiered stats is asked for. */
export function headroomFor(
  stat: TieredStat,
  player: Combatant,
  target: Combatant,
  chances: AttackChanceProvider,
): readonly HeadroomSlice[] {
  return stat === 'hitChance'
    ? hitHeadroom(player, target, chances)
    : dodgeParryHeadroom(player, target, chances);
}

/**
 * The ladder: one rung per distinct cap, each one named by what it reaches.
 *
 * A boundary is a headroom value, so crossing one always drops at least one
 * slice out of `benefits` and the set shrinks monotonically. Returns EMPTY when
 * every slice is already capped, which is the "Already capped. No stat weight."
 * case and is a real answer rather than a failure -- a Protection Warrior's hit
 * is exactly that.
 *
 * NOTHING IS TRUNCATED. An earlier version capped the whole ladder at twelve
 * points on the reasoning that no item grants more, and it made the top rung
 * say "+3.00% more" where the honest figure was "+10.00% more to cap main-hand
 * swings". The question being answered is "how much would it take to cap this",
 * so a rung that stops short of a cap answers a question nobody asked.
 */
export function tiersFrom(slices: readonly HeadroomSlice[]): readonly StatTier[] {
  const boundaries = [...new Set(slices.map((slice) => slice.headroom))]
    .filter((value) => value > 0)
    .sort((a, b) => a - b);

  const tiers: StatTier[] = [];
  let from = 0;
  for (const to of boundaries) {
    tiers.push({
      from,
      to,
      // What runs out HERE, which is what the rung is named after.
      caps: slices.filter((slice) => slice.headroom === to).map((slice) => slice.label),
      // Everything still gaining ANYWHERE inside (from, to]: a slice whose
      // headroom reaches the top of the rung pays across the whole of it.
      benefits: slices.filter((slice) => slice.headroom >= to).map((slice) => slice.label),
    });
    from = to;
  }

  return tiers;
}
