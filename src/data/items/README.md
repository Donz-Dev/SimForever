# Item data

Nine files, 151 items and 2 enchants between them. **One file per set**, so
"where did this number come from" has a per-file answer.

| File | Items | What it is |
| --- | --- | --- |
| `classic-warrior.json` | 19 | Classic stand-ins curated for a Warrior, plus the Tier 1 Unstoppable Might set (Season of Discovery) and one real Forever item |
| `sod-hunter.json` | 12 | A Hunter's gear -- full Giantstalker with Rhok'delar |
| `sod-rogue.json` | 13 | A Rogue's -- full Nightslayer, with daggers and swords |
| `sod-druid.json` | 35 | A Druid's, in three cuts: Cenarion caster, feral and tank |
| `sod-shaman.json` | 20 | A Shaman's -- Earthfury, Elemental and Enhancement |
| `sod-mage.json` | 8 | A Mage's -- full Arcanist |
| `sod-paladin.json` | 27 | A Paladin's, in three cuts: Retribution, Shockadin, Protection |
| `sod-warlock.json` | 8 | A Warlock's -- Felheart with the Deathmist pieces |
| `sod-priest.json` | 9 | A Shadow Priest's -- Vestments of Prophecy with Anathema |

Every one after the first came from a **sixtyupgrades.com set the project owner
supplied**, and each file carries the URL it came from.

**Almost none of it is WoW: Forever data, in a WoW: Forever simulator.** They
were chosen deliberately, to replace invented placeholder weapons with real
numbers, but a Forever item of the same name may not carry the same values.

**The Immovable Object** is the one real Forever item. Nothing equips it any
more -- the owner's Protection Paladin set uses Earthen Guard -- and it is still
on file and still selectable.

## Where the sets themselves live

The item DATA is here; which items make up a set is
[`src/game/items/gearSets.ts`](../../game/items/gearSets.ts). Two things read
it, in different layers: `profiles/presets.ts`, where a preset states a whole
build, and `startingSets.ts`, which answers the narrower "which gear, given the
class and style on screen" for a character created from scratch. They share the
named sets and neither calls the other.

## Which file owns a shared piece

**Twenty-two items are worn by more than one set.** Choker of the Fire Lord is in
five of them; Hand of Justice is in five. `itemData.ts` **throws on a duplicate
id**, by design, so that nothing can silently keep one of two entries for the
same item -- which means an id has to live in exactly one file.

The order in `tools/item-sets.json` decides it: an id lands in the **first** file
that asks for it and is skipped in every later one. So every file is shorter than
the set it came from, and the caster jewellery five classes share is owned by
`sod-druid.json` for no better reason than that the Druid came first.

`node tools/import_item.mjs --build` prints what it skipped and where it went.

## Adding an item, or a whole set

```bash
node tools/import_item.mjs forever 19321   # prints the entry to append
node tools/import_item.mjs classic 228291  # a Season of Discovery id
node tools/import_item.mjs --build         # rebuild EVERY file from the spec
node tools/import_item.mjs --build sod-mage  # ...or one of them
node tools/import_item.mjs --verify        # re-parse EVERY item on file
```

A new set is a new entry in `tools/item-sets.json` -- its file, its game, its
description, the sixtyupgrades URL and the ids in slot order -- plus an import in
`itemData.ts`'s `ITEM_FILES`.

**`--build` IS A GENERATOR AND NOT ONLY A REFRESH.** The spec lists every id and
every file's own header, so deleting the whole of `src/data/items/*.json` and
running it brings all 151 items back byte for byte, provenance included. It did
not: the first two files said "reuse the ids already in the file", which left
fourteen ids -- the Giantstalker pieces, Rhok'delar, Dreadforge Retaliator, the
Royal Seal -- recorded nowhere but inside the data they were meant to rebuild.
Deleting one of those files would have failed rather than regenerated it, and
listing the ids alone brought the items back while silently dropping the
sixtyupgrades link they came from. `--verify` reads the same spec, so **a file added to
one is covered by the other**; the two lists used to be separate and a file was
once added to only one, which turns "re-parse everything on file" into a false
promise.

**An item's GAME is per item, not per set.** `classic-warrior.json` is eighteen
Classic items and one Forever one, and a rebuild that assumed one endpoint for
the file replaced The Immovable Object with its Classic self -- same stats, a
different source url and a differently worded block line. `--build` reads each
stored item's own `source` back rather than assuming.

**It currently reproduces all 151 exactly**, which is why the tool can be trusted
with the next one.

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
| `Increases damage and healing done by magical spells and effects by up to 47.` | `stats.spellPower` |
| `Improves your chance to hit ... by 1%.` | `stats.hitChance` |
| `Improves your chance to get a critical strike by 2%.` | `stats.critChance` |
| `...a critical strike with all spells and attacks by 2%.` | **both** `critChance` and `spellCritChance` |
| `...a critical strike with spells by 2%.` | `stats.spellCritChance` |
| `Increased Defense +7.` | `stats.defenseSkill` |
| `44 Block`, `+27 Block Value`, `Increases the block value of your shield by 12.` | `stats.blockValue` |
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

**"With all spells and attacks" is TWO stats.** `critChance` and
`spellCritChance` are separate and are read by separate tables, so a line saying
both has to grant both, exactly as the raid buffs that say it already do. It used
to grant only the melee half, which was invisible for as long as nothing in the
item data was caster gear -- sixty-two lines across these files say it.

**Two enchants, and one of them is a stat.** Crusader is a proc; Enchant Weapon -
Spell Power is a flat 30 spell power, which the five caster sets put on a staff or
a dagger. A stat enchant applies to a weapon that is only ever HELD, which is
what a caster's main hand is.

## What is NOT modelled, and why

Thirty-one lines across the nine files, plus every set bonus. The ones that cost
a real number:

**SCHOOL-SPECIFIC SPELL POWER, which is most of the Priest's set.** "Increases
damage done by Shadow spells and effects by up to 39" appears on six of the eight
Vestments of Prophecy pieces and at 75 on Anathema, and `spellPower` here is one
school-blind number. Applying a Shadow-only bonus to it would make the Priest's
Holy and Arcane spells hit harder, so it is listed instead. The planner reads 204
generic and 497 Shadow; this character gets the 204. **That ~293 is the largest
known shortfall in the item data**, and it is a missing engine stat rather than
missing data. Eight Paladin lines say the same thing about Holy.

**+172 ATTACK POWER IN CAT, BEAR AND DIRE BEAR FORMS ONLY**, on the Glaive of
Obsidian Fury that both feral Druids hold. An item stat cannot be conditional on
the combat style. It is the largest single unmodelled line on any one item, and
both feral figures are understated by it.

**Set bonuses, all of them.** A set bonus counts pieces across a whole set and
nothing here tracks that. They are now at least VISIBLE: they read `(4) Set : ...`
and start with a bracket, so they matched no rule and were **dropped** -- not
unmodelled, dropped -- until twenty profiles went into Tier 1. The Priest's
four-piece is a flat +2% spell crit that would have read as simply missing.

**Ability-specific relic lines.** Almost everything an idol, libram or totem does
names one ability: "the damage of your Moonfire spell", "the rage cost of Maul and
Swipe". The `relic` slot exists so the item is visible rather than absent.

**Totem of Rage grants nothing at all.** The tooltip Wowhead serves for id 227977
carries no equip line -- item level, binding, "Relic", and nothing else. Whatever
it does is not stated by the source, so nothing is invented.

**A wand's damage.** "110 - 204 Fire Damage" is not the `min - max Damage` shape a
weapon parses from, and no caster style swings the ranged slot anyway.

Resistances are totalled on the character sheet for display and are deliberately
not a combat stat, which is the ruleset owner's decision rather than a gap.

## Validated against the planner's own stat panel

Every set was checked by building the profile with **raid buffs and talents off**
and comparing each primary stat to `panel - base`. **All twelve sets supply
exactly what the planner says they do.**

Where the resulting figure still differs, it is the BASE and not the set, and
base stats here are Forever's from the ruleset owner's spreadsheet:

| | |
| --- | --- |
| gnome Mage | intellect 139, the planner implies 148 |
| troll Priest | strength 36/34, agility 42/38, intellect 116/118, spirit 126/130 |

Crit differs everywhere for the same reason. Do not "fix" either.

**One item disagrees between the two sources.** sixtyupgrades states Cenarion
Trousers at +20 agility and +16 stamina; `nether.wowhead.com/classic/tooltip/item/226666`
states +18 and +11. Wowhead's is kept, because it is this project's item source
and the one `--verify` reproduces -- so both feral Druid sets read 2 agility and 5
stamina below the planner's own total, and that is the whole of the difference.

## A check worth keeping

Each weapon tooltip states damage, speed AND dps, which are redundant. The
loader recomputes dps from damage and speed and throws if they disagree by more
than 0.05, so a scrape that dropped a digit fails loudly instead of producing a
quietly wrong weapon.

The first eighteen items were parsed in a browser and transferred with a SHA-256
check, which proved the BYTES arrived intact -- not that they were parsed
correctly. `--verify` closes that gap: it re-fetches every item on file and diffs
the parse, including the effect list, against what is stored.
