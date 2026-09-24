# Item data

Two files, 31 items and 1 enchant between them. **One file per set**, so
"where did this number come from" has a per-file answer.

| File | Items | What it is |
| --- | --- | --- |
| `classic-warrior.json` | 19 | Classic stand-ins curated for a Warrior, plus the Tier 1 Unstoppable Might set (Season of Discovery) and one real Forever item |
| `sod-hunter.json` | 12 | A level 60 Hunter's gear -- full Giantstalker with Rhok'delar -- from a sixtyupgrades.com set the project owner supplied |

**Almost none of it is WoW: Forever data, in a WoW: Forever simulator.** They
were chosen deliberately, to replace invented placeholder weapons with real
numbers, but a Forever item of the same name may not carry the same values.

**The Immovable Object** is the one real Forever item.

## The Hunter set

`sod-hunter.json` carries its `source` -- the sixtyupgrades set it came from
-- and each item its own Wowhead URL. They are **Season of Discovery** items,
the same id namespace the Unstoppable Might set already uses, and every
tooltip says `SoD Phase 4` in its own words rather than in an assertion of
ours. The Forever endpoint 404s on all of them and there is no `/sod/` path;
SoD items are served under `/classic/`.

It holds **twelve** of the set's sixteen pieces, because four were already in
`classic-warrior.json`: Onyxia Tooth Pendant, Cape of the Black Baron, Don
Julio's Band and Blackhand's Breadth. `itemData.ts` throws on a duplicate id
rather than silently keeping one of two entries.

**Validated against the planner's own stat panel.** Unbuffed, the LW Ranged
preset reads 58 strength, 334 agility, 225 stamina, 118 intellect and 73
spirit -- every primary exactly what sixtyupgrades shows -- and 961 ranged
attack power against its 959. Crit differs on purpose: base stats here are
Forever's, from the ruleset owner's spreadsheet, and the planner's are SoD's.

## Where it came from

`https://nether.wowhead.com/<game>/tooltip/item/<id>` returns JSON: a name, an
icon, and the tooltip as HTML. That is the whole source — no page rendering
needed, unlike the talent calculators.

**Both `classic` and `forever` work**, with the same shape. Forever is the
ruleset this simulator is for and is always the one to prefer; the Classic
eighteen predate anyone checking whether a Forever endpoint existed.

## Adding an item

```bash
node tools/import_item.mjs forever 19321   # prints the entry to append
node tools/import_item.mjs classic 228291  # a Season of Discovery id
node tools/import_item.mjs --verify        # re-parse EVERY item file
```

`--verify` reads both files. Its list is `FILES` in the tool; **a new item
file has to be added there**, or the check silently stops covering it, which
is worse than no check because it still reads as one.

The first eighteen were parsed in a browser and transferred with a SHA-256
check, which proved the BYTES arrived intact — not that they were parsed
correctly. `--verify` closes that gap: it re-fetches every item on file and
diffs the parse against what is stored. **It currently reproduces all 31
exactly**, which is why the tool can be trusted with the next one.

Add the slot to `SLOTS_BY_INVENTORY_TYPE` in `itemData.ts` if it is a kind
nothing else uses. Note that a SHIELD is resolved by its subclass rather than
its inventory type: Wowhead calls a shield's slot "Off Hand", the same as a held
off-hand item, so mapping on inventory type alone would put a shield in the
off-hand weapon slot where a dual-wielder could swing it.

## What the loader does with it

`src/game/items/itemData.ts` turns each raw item into an `Item`:

| Tooltip says | Becomes |
| --- | --- |
| `+26 Strength` | `stats.strength` |
| `749 Armor` | `stats.armor` |
| `+20 Attack Power.` | `stats.attackPower` |
| `+48 ranged Attack Power.` | `stats.rangedAttackPower` |
| `Improves your chance to hit ... by 1%.` | `stats.hitChance` |
| `Improves your chance to get a critical strike ... by 2%.` | `stats.critChance` |
| `100 - 187 Damage`, `Speed 2.60` | a `WeaponProfile` |
| `Increased Two-handed Swords +3.` | the weapon's `skill` |
| anything else | an entry in `unmodelled`, applied nowhere |

**Nothing is guessed.** An effect that matches no rule is kept verbatim and does
nothing, and the Gear panel lists every one of them under "Equipped but not
simulated". A geared character here is weaker than the same character in the
game, by exactly the listed amount.

Procs are the exception: they are behaviour, not stats, so they live in
`src/game/items/procs.ts` rather than being either. Vis'kag, Crusader and Hand
of Justice are all implemented there, using rates the ruleset owner supplied --
the tooltips give none of them, saying only "Chance on hit" and "often".

Currently unmodelled: **one line**, Dreadforge Retaliator's "Increases your
chance to parry an attack by 1%." Parry is a real stat here, but nothing
attacks a Hunter in these profiles, so it would reduce nothing; it is listed
rather than applied. Resistances are totalled on the character sheet
for display and are deliberately not a combat stat, which is the ruleset
owner's decision rather than a gap. Crusader's heal was the last real omission
and is implemented -- its reason, "nothing damages the player", expired when
the encounter grew a ramping target and a healer.

## A check worth keeping

Each weapon tooltip states damage, speed AND dps, which are redundant. The
loader recomputes dps from damage and speed and throws if they disagree by more
than 0.05, so a scrape that dropped a digit fails loudly instead of producing a
quietly wrong weapon.
