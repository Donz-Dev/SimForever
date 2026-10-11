# The Gear panel, as a character planner

The third UI pass. It replaced nineteen rows of two `<select>` elements with a
character pane: item cards on hover, a list filtered to what the class can
equip, items sorted by what the build values, and the four test sets exposed.

[CLAUDE.md](../CLAUDE.md)'s **Gear and items** section holds the rules this
produced; this is how the panel is put together and why each piece is where it
is.

---

## Why the select had to go

The owner asked for four things. A native dropdown can do none of them:

| asked for | why a `<select>` cannot |
| --- | --- |
| a WoW item card on hover | an `<option>` renders in the operating system's own widget, where there is no hover and React cannot reach |
| a list filtered by class | this one it could, by filtering the options |
| items sorted by value, with the value beside each | an option is one string; there is no second column |
| the four test sets, with cards | the same hover problem |

So the select became a button that opens a list, and everything else follows
from that one change.

---

## The pieces, and which of them can be wrong

`Panel` is `useState(true)`: a collapsible panel starts SHUT and renders no
body at all in a static render. **A test that went through `GearPanel` would
assert nothing** and would pass just as happily if the whole pane were deleted.
So the part that can be wrong lives in plain modules, the way `aplEditing.ts`
does.

| | what it decides | tested by |
| --- | --- | --- |
| `game/character/proficiency.ts` | the owner's 27-column table | `proficiency.test.ts` |
| `game/items/equipRules.ts` | whether a class may equip an item in a slot | `proficiency.test.ts` |
| `game/items/itemValue.ts` | what an item is worth under a valuation | `itemValue.test.ts` |
| `game/items/defaultValuation.ts` | the valuation a build opens with | `itemValue.test.ts` |
| `ui/panels/gear/tooltipLines.ts` | the card's rows and their colours | `gearPlanner.test.ts` |
| `ui/panels/gear/slots.ts` | the pane's layout, and a slot's sorted list | `gearPlanner.test.ts` |
| `ui/panels/gear/valuationFromWeights.ts` | a measured run becoming a valuation | `valuationFromWeights.test.ts` |

`GearPanel.tsx`, `ItemPicker.tsx`, `ItemCard.tsx`, `HoverCard.tsx` and
`ItemIcon.tsx` are the rendering, and hold no decision the modules above do not
already make.

---

## The item card

**It is the capture's own tooltip, drawn.** Nothing is assembled from
`item.stats`, which would be a second item parser living beside the real one --
and the second implementation is always the one that drifts. It also means the
card shows the lines the simulator does not apply, which is honest: a proc is
on the item in the game and is on the card here.

Two things are added and both are the header: the item level, which is a FIELD
rather than a tooltip line, and the value under a rule. **The rule matters** --
everything above it is the item speaking and the figure below it is what this
tool thinks the item is worth, and running the two together would make a
placeholder weight look like a sourced number.

### Two leading lines are dropped, by shape and not by position

The name, because the card draws it as a heading, and an `Item Level N` line.
**The two populations differ**: a captured Forever item writes no item-level
line and a generated benchmark item writes one, so the card printed "Item Level
65" twice for half the database until it was matched by shape.

### It is portalled and positioned `fixed`

Every gear row lives inside a panel body that scrolls, so a card rendered in
place is clipped by the panel it is in -- which is exactly where a tooltip is
least useful. It is mounted only while hovered, which is also what keeps the
static test renders working: `react-dom/server` cannot render a portal at all.

### The colours are tokens

`styles.css` carries `--quality-0` to `--quality-5` beside the nine class
colours, and `qualityColour` returns `var(--quality-N)`. An inline `style` can
name a custom property just as a rule can, which is what lets the palette have
ONE copy while still being applied per item. `themes.test.ts` enforces "roles,
never shades" for the stylesheet; `gearPlanner.test.ts` enforces it on this
side.

**The card itself is near-black rather than a theme surface.** Blizzard's
quality colours are tuned against the client's own black tooltip; on this
page's teal panel the blue of a rare and the purple of an epic are hard to tell
apart, and those two are the thing a player reads first.

---

## Sorting, and the valuation behind it

A valuation is `Partial<Record<StatName, number>>` and its unit is **the
stat-weight run's own unit**: "per displayed unit", with the two ratings in
percentage points and everything else in its own points.

That is not a detail. The item parser is inconsistent about ratings on purpose
-- `+14 Hit Rating` becomes `hitChance: 1.4` at parse time and `+14 Critical
Strike Rating` stays `critRating: 14`, because one has a reader for the rating
and the other does not. Scoring the engine stats raw would make a point of crit
worth ten times a point of hit for no reason anybody chose. `unitsOf` is the one
place that is undone, and `itemValue.test.ts` pins it against
`WeightableStat.statPerUnit` for every stat both tables name -- the two live in
layers that cannot import each other, so nothing in the type system holds them
together.

### The two attack power pools are one purchase

The owner's ruling is that a bare `+40 Attack Power` line reaches both melee and
ranged attack power, so 164 item lines set both fields to the same number.
Pricing them independently doubles every one. The rule is **the larger amount
times the larger weight of the pools the item actually grants**, and that last
clause is the whole thing -- without it a Warrior is paid in full for a line
reading "+36 Ranged Attack Power", which is the owner's "Melee Attack Power
NEVER reaches Ranged Attack Power" read backwards. It got as far as a test.

### What a profile opens with

Every stat in the build's benchmark template `preferred` list, at **1.00**, by
the owner's instruction -- "I'll provide the stat valuation after this feature
is fully implemented. For now just make all the preferred stats valued at
1.00."

So no magnitude is invented: WHICH stats a build prefers is the owner's own
spreadsheet column, and the flat 1.00 is what they specified. **What it costs,
said plainly: at 1.00 each the ORDER the owner wrote is discarded**, so the sort
is "how much preferred stat is on this item" rather than "how good is this
item". That is one record away from being right, and the Stat Weights button is
the other way to replace it.

A build with **no template** gets an EMPTY valuation and the panel sorts by item
level and says so. There is nothing to derive from, and a column of identical
zeroes sorted alphabetically is worse than no sorting at all.

### Overwriting it from a run

The Stat Weights panel grows a **Use for gear** button. It is a button and not
something a finished run does by itself, because the owner's word was
"choosing" -- and a run that silently rewrote the sort order would change what
the panel says about every item with nothing on screen to say a decision had
been made.

Only a `measured` row is taken. The run reports three verdicts and the other two
are not answers:

- `none` means the variant ran bit-identical fights, so the build cannot read
  the stat. It is DROPPED rather than written as zero -- an absent entry and a
  zero entry score identically, and the absent one re-derives if the build
  changes.
- `inconclusive` means the interval is wider than the value. Writing it in would
  publish a number the run itself refused to stand behind, with none of the
  interval beside it.

A tiered stat is SUMMED. Hit is measured as a ladder, one row per interval
between the caps, so three rows can carry the same `statId`; for sorting, the
stat is worth what the whole ladder says.

---

## The proficiency filter

See CLAUDE.md's **Gear and items** for the table and the three rows that
disagree with Classic.

**TWO FILTERS, NOT ONE.** The owner's proficiency table answers "may this class
wear leather"; an item's own `Classes:` line answers "may a Warrior wear the
ROGUE tier set", which is leather and says so. **895 of the 1,946 items carry
one**, and 7 more are answered from a Wowhead capture for items whose Forever
tooltip omits the line -- read because the preferred source is SILENT rather
than different, which is a rule this project already states for Shadowburn's
Soul Shard. `forever-class-restrictions.json`, and the capture never overrides
a stated line.

**177 SET PIECES ARE RESTRICTED BY NEITHER SOURCE**, including every T3 set and
most of the tier-0 dungeon sets, because Classic's own data has no line for
them either. That is a question for the owner and not a gap here; nothing
infers a class from a set bonus, since a good fraction of the 177 are crafted
and reputation sets with no restriction at all.

The panel-side rules:

- the list is **filtered by default**, with a checkbox that greys the unusable
  ones instead of hiding them;
- **whatever is equipped is always listed**, whatever the filter says, because a
  profile loaded from a file can be wearing something this table calls illegal
  and a picker that hid it would show the slot's contents nowhere at all;
- an illegal row is dimmed and still **clickable and hoverable**. A disabled
  button takes no focus and fires no hover, so the card -- the thing that would
  explain the row -- would be unreachable on exactly the rows that need
  explaining.

---

## The pane

Two columns, seven and eight, with the hands across the bottom. **No model
between them and no shirt or tabard**, both on the owner's instruction: a shirt
and a tabard are cosmetic, carry no stat this project reads, and would be two
permanently empty rows in the middle of the pane.

The columns are identical rather than mirrored. A real character pane mirrors
its right column so the icons frame the model; with the model gone there is
nothing to frame, and mirroring would put two icon columns on the outside edges
with the text crammed together in the middle.

`weaponSlotsFor` is unchanged from the panel this replaced. Every branch in it
was arrived at by something going wrong -- a two-hander with an off-hand row, a
caster shield with nowhere to be shown -- and a layout change is no reason to
re-derive them.

---

## What is not done

- **The default valuation discards the owner's preference ORDER.** Every
  preferred stat is 1.00, which is what was asked for until a real valuation
  arrives.
- **177 set pieces are class-restricted by neither source**, the T3 sets among
  them. The owner's ruling decides whether Forever means them class-locked.
- **E85 runs about 8% above the best real item-level-80-92 set** -- crit 271
  against 252, spell power 531 against 491. Arguably right for the top
  benchmark, and recorded rather than tuned.
- **The enchant list is not filtered by class or by what the item is.** Every
  enchant whose table lists the slot is offered, which is how it worked before.
- **A slot's picker lists every item in the database for that slot**, with no
  filter for item level or source. The search box is the only narrowing.
- **The Poison and Weapon Stone rows still use `<select>`**, and have no cards.
  They are a closed set of four and three entries respectively, so the cost of
  the dropdown is much lower there -- but they are the last two controls in the
  panel that cannot show what they do.
