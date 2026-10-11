# Item data

**Forever's own items, and nothing else.** Five captures from
`foreverchanges.pro`, 1,943 items and 2 enchants between them. One file per
population, so "where did this number come from" has a per-file answer.

| File | Items | What it is |
| --- | --- | --- |
| `forever-new-epics.json` | 449 | Every new epic at item level 55 and up, beta build 1.60.1.70338 |
| `forever-new-rares.json` | 412 | Every new RARE (blue) at item level 50-60 |
| `forever-changed-epics.json` | 614 | Every CLASSIC epic at item level 55+ that Forever changed. An **override layer** |
| `forever-changed-rares.json` | 198 | The same for rares. Also an override layer |
| `forever-same.json` | 273 | Classic items Forever KEPT UNCHANGED |
| `weapon-enchants.json` | — | Crusader and Enchant Weapon - Spell Power, the two SCRAPED enchants |

**All five are beta build 1.60.1.70338**, which is two builds AHEAD of the
project's spell and talent captures (1.60.1.70170) -- a dated fact rather than
a suspicion. Each file's header records the capture it came from; each capture
under `tools/data/` records its own SHA-256, the build and the filter used.

```bash
node tools/import_forever_items.mjs --check   # what it would write, and any unread line
node tools/import_forever_items.mjs --write
```

## The Classic and Season of Discovery stand-ins are gone

Nine files and 151 items used to sit here — a curated set per class, scraped
from sixtyupgrades sets the project owner supplied. The owner removed them:
they "were just random templates of items that won't exist 1-to-1 in Forever".
`src/game/items/gearSets.ts`, `tools/item-sets.json` and
`tools/import_item.mjs` went with them, because all three existed to build and
verify exactly those files.

**What replaced them as the presets' gear is the E65 BENCHMARK SET**, generated
from the itemization budget rather than captured — `src/game/items/benchmarkGear.ts`
and `benchmarkSets.ts`. Those items are **not in this directory and will not
be**: everything here is captured data with a source url, and a generated item
has neither. They are built in code, numbered from 9,500,000, and
`itemsForSlot` never offers one, so a person browsing a slot sees real items
only.

**Do not go looking for more Classic or SoD gear.** A new Forever capture is
the supported way to add items.

## The override layer

`forever-changed-*.json` are allowed to share an id with something already on
file, which is why they are kept out of `ITEM_FILES` — the duplicate check has
to keep throwing for everything else. The owner's ruling is that the Forever
side is definitive, so a colliding id is **REPLACED rather than merged**:
merged is how an item ends up carrying Classic's flat "+1% crit" AND Forever's
"+14 Critical Strike Rating" at once.

`FOREVER_OVERRIDDEN_IDS` is exported so a test can pin how many collide. An
override that silently stops matching — because an id moved or a file was
renamed — leaves the older version in place and looks like nothing at all.

## `same.json` is the file that is easy not to take

A diff site publishes what CHANGED, so "new plus changed" is a complete
description of the diff and an incomplete description of the game. Without this
file, 273 items Forever left alone would simply have been absent from a
database claiming to be Forever's.

## The changed files are a control group as well as data

487 of the changed epics differ from Classic **only in WORDING** — Classic's
"Improves your chance to get a critical strike by 1%" is Forever's "+14
Critical Strike Rating" — so their stats ARE Classic's, and pricing them
measures Classic's own itemization through the same model with the same blind
spots. Each such item carries `wordingOnly: true`, which is what makes the
comparison possible.

Without it the only baseline is 100%, and **100% is not a number the budget
model reaches even on Classic gear**. Three successive answers about Forever's
budget were wrong for exactly that reason. See
[docs/itemization.md](../../../docs/itemization.md).

## Taking a new capture

`foreverchanges.pro` serves plain JSON at `/items/new.json` and four siblings —
`changed`, `same`, `missing`, `sources` — each stating its beta build.

A plain `fetch` from outside is refused with a **403**, so it is read in a
browser ON THE ORIGIN, hashed there with SHA-256 and re-hashed on disk before
being accepted. Two things that cost a transfer:

- **the tab must be FRONTED for a clipboard write to land.** `execCommand`
  returns `true` from a background tab and the clipboard keeps its old
  contents, so without the hash check the previous chunk gets imported twice
  under the new chunk's name.
- **chunk it at 70-90KB.** 362KB in one write came back empty with no error.
  Hash each chunk in the browser, re-hash on disk, concatenate once every
  piece matches.

The importer re-checks the capture's hash and **refuses to write if any item
carries a line it could not read**, so a changed tooltip format fails loudly
instead of dropping a stat.

## What the import excludes, and each exclusion gets its own line

| | why |
| --- | --- |
| 39 "90 Epic" test items | developer test gear, matched on NAME at the owner's instruction |
| 8 "Premier Emboldened" seals | not equippable items |
| Orb of Deception | a bag item with **no equipment slot at all**, whose only line is a Use effect. It reached the importer because the capture filter keeps anything with an effect — right for a trinket, wrong for this |

**Two exclusions for two reasons are two lines of output.** A shared label made
the Orb read as a developer test item, which it is not.

## Checking whether an item's numbers add up

```bash
npx vite-node tools/item_budget.ts            # the items on file
FOREVER=1 npx vite-node tools/item_budget.ts  # Forever's own, split by population
REFERENCE=1 npx vite-node tools/item_budget.ts
```

`budget = qualityBase(ilvl) x slotMultiplier`, spent at
`budget^1.5 = sum((stat x cost)^1.5)`. **122 of 133 non-weapon items land
within 90% to 110%**, so an item well outside that is worth a second look at
the capture.

It is a reading aid and an audit. [docs/itemization.md](../../../docs/itemization.md)
has what it can and cannot say, the two things that come free with the item
level rather than out of the budget (base armour and weapon DPS), and the one
authorised exception to running it backwards — the benchmark sets, which the
owner asked for and which do not claim to be real items.

## What the loader does with it

`src/game/items/itemData.ts` turns each raw item into an `Item`:

| Tooltip says | Becomes |
| --- | --- |
| `+26 Strength` | `stats.strength` |
| `749 Armor` | `stats.armor` |
| `+20 Attack Power.` | **both** `attackPower` and `rangedAttackPower` |
| `+48 ranged Attack Power.` | `stats.rangedAttackPower` alone |
| `+94 Spell Power` / `+58 Spell Damage` | `stats.spellPower` — **Forever's wording** |
| `Increases damage and healing done by magical spells and effects by up to 47.` | `stats.spellPower` — Classic's |
| `+14 Critical Strike Rating` | `stats.critRating`, which feeds **both** crit tables |
| `+10 Hit Rating`, `+10 Haste Rating`, `+10 Expertise Rating`, `+12 Dodge Rating`, `+20 Parry Rating`, `+5 Block Rating`, `+1 Defense Rating` | the matching rating stat |
| `Improves your chance to hit ... by 1%.` | `stats.hitChance` — Classic's flat form |
| `...a critical strike with all spells and attacks by 2%.` | **both** `critChance` and `spellCritChance` |
| `Increased Defense +7.` | `stats.defenseSkill` |
| `-15 Agility` | `stats.agility`, negative |
| `100 - 187 Damage`, `Speed 2.60` | a `WeaponProfile` |
| `Increased Two-handed Swords +3.` | the weapon's `skill` |
| anything else | an entry in `unmodelled`, applied nowhere |

**"ATTACK POWER" REACHES BOTH POOLS**, by the owner's hard ruling: "Attack
Power always equals and reaches Melee & Ranged Attack Power. And Melee Attack
Power NEVER reaches Ranged Attack Power." 164 item lines were melee-only before
it; it is worth +24.1 to BM Hunter and +29.2 to LW Ranged.

**FOREVER USES RATINGS WHERE CLASSIC USES FLAT PERCENTAGES**, and the owner's
conversions are 1 point of Defense, 10 hit, 14 crit, 10 haste, 10 expertise,
12 dodge, 20 parry, 5 block. Forever's own rewrites of Classic items reproduce
every one of them exactly — crit 14.0 across 42 items, spell crit 14.0 across
20, hit 10.0 across 18, dodge 12.0 across 3, **with no variation at all** —
which also settles that ONE Critical Strike Rating feeds both the melee and the
spell table: Classic has two item lines and Forever has one.

**A RULESET CAN WRITE A STAT IN WORDS THE PARSER HAS NEVER SEEN.** Only
Classic's spell power sentence had a rule, so **1,384 Forever spell power lines
fell through** — Premier High Warlord's War Staff reported +94 on its tooltip
and granted zero. Invisible because no preset wore a Forever item. **When a new
source lands, diff its vocabulary and not only its numbers**; a count of
unmodelled lines per file is the cheap check.

**Nothing is guessed.** An effect that matches no rule is kept verbatim and
does nothing. A geared character here is weaker than the same character in the
game, by exactly the listed amount.

Procs are the exception: they are behaviour, not stats, so they live in
`src/game/items/procs.ts`. Vis'kag, Crusader and Hand of Justice are
implemented there using rates the ruleset owner supplied — the tooltips give
none of them, saying only "Chance on hit" and "often".

## Two enchants here, and 28 that are not

Crusader is a proc; Enchant Weapon - Spell Power is a flat 30 spell power. Both
came out of Wowhead with a spell id, an icon and a tooltip, **which is the
whole reason they are a data file at all.**

They used to live inside `classic-warrior.json` because that is the file they
were scraped with, so deleting it would have silently unenchanted every weapon
in the project. They were moved here first.

**THE ARMOUR ENCHANTS ARE NOT IN THESE FILES AND WILL NOT BE.** The ruleset
owner supplied 28 of them as a table — an effect and a slot per entry, with no
spell behind any of them — so there is nothing to scrape, nothing to re-fetch
and no tooltip to store. They are declared outright in
`src/game/items/foreverEnchants.ts` with simulator-allocated ids, which is also
where the reasoning is written down.

## Spell power for one school is not the same stat

"Increases damage done by Shadow spells and effects by up to 39" names a
school; "Increases damage and healing done by magical spells and effects by up
to 47" does not. The scoped ones land in `Item.schoolPower`, which becomes a
`SchoolModifiers` entry beside the crit and damage already keyed by school.
`STAT_NAMES` is a deliberately closed flat set with no room for a keyed stat,
which is why this has its own route out of the item.

**They cannot be folded together in EITHER direction.** A Shadow-only bonus
added to `spellPower` would make the same character's Holy and Arcane spells
hit harder; a generic bonus filed under one school would be lost by the other
six. The wording also draws the damage/healing line: the scoped one says
"damage", the blind one says "damage AND HEALING", so `resolveHealing` reads
the blind stat alone and a Paladin's Holy power raises its seal and not its
Holy Light.

## What is NOT modelled, and why

**Set bonuses, all of them.** A set bonus counts pieces across a whole set and
nothing here tracks that. They are at least VISIBLE: they read `(4) Set : ...`
and start with a bracket, so they matched no rule and were **dropped** — not
unmodelled, dropped — until twenty profiles went into gear that had them.

**Ability-specific relic lines.** Almost everything an idol, libram or totem
does names one ability. The `relic` slot exists so the item is visible rather
than absent.

**Spell power for a named ability** — "Increases the damage of your Moonfire
spell by up to 33" — is the scope between the school-scoped kind above and
nothing. `AbilityModifiers` is the shape it wants and deliberately has no
`spellPower` field: the type is what stops a modifier being hung where nothing
reads it.

**A wand's damage.** "110 - 204 Fire Damage" is not the `min - max Damage`
shape a weapon parses from, and no caster style swings the ranged slot anyway.

**A conditional stat line.** "+172 Attack Power in Cat, Bear, and Dire Bear
forms only" is now modelled — `Item.styleStats`, read through `statsForStyle`
— and the FORM LIST is mapped in full or not at all, because half a stat is
worse than a reported one.

Resistances are totalled on the character sheet for display and are
deliberately not a combat stat, which is the ruleset owner's decision rather
than a gap.

## A check worth keeping

Each weapon tooltip states damage, speed AND dps, which are redundant. The
loader recomputes dps from damage and speed and throws if they disagree by more
than 0.05, so a capture that dropped a digit fails loudly instead of producing
a quietly wrong weapon.

**The dps is derived from the ROUNDED min and max**, not computed
independently: `damage 70-105 at 2.4s` gives 36.46 where the tooltip says
36.39, and the tooltip is right about its own arithmetic because Forever
rounded the damage range for display.

Hashing the transfer proves the BYTES arrived intact — not that they were
parsed correctly. `--check` closes part of that gap: it refuses to write when
any item carries a line no rule reads, so a format change cannot quietly drop a
stat.
