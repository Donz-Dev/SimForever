# Item data

`classic-warrior.json` holds 19 items and 1 enchant.

**Eighteen of them are WoW CLASSIC items, in a WoW: Forever simulator.** The Tier 1
Unstoppable Might set is Season of Discovery. They were chosen deliberately, to
replace the invented placeholder weapons with real numbers, but a Forever item
of the same name may not carry the same values. Nothing in this file is Forever
data.

The nineteenth, **The Immovable Object**, is a real Forever item and the first
one here.

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
node tools/import_item.mjs --verify        # re-parse everything already on file
```

The first eighteen were parsed in a browser and transferred with a SHA-256
check, which proved the BYTES arrived intact — not that they were parsed
correctly. `--verify` closes that gap: it re-fetches every item on file and
diffs the parse against what is stored. **It currently reproduces all 19
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

Currently unmodelled: all Fire Resistance (not a stat the engine has), and
Crusader's heal (nothing damages the player, so it would restore nothing).

## A check worth keeping

Each weapon tooltip states damage, speed AND dps, which are redundant. The
loader recomputes dps from damage and speed and throws if they disagree by more
than 0.05, so a scrape that dropped a digit fails loudly instead of producing a
quietly wrong weapon.
