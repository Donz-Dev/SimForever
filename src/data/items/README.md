# Item data

`classic-warrior.json` holds 18 items and 1 enchant, scraped once from
Wowhead's Classic tooltip endpoint.

**These are WoW CLASSIC items, in a WoW: Forever simulator.** The Tier 1
Unstoppable Might set is Season of Discovery. They were chosen deliberately, to
replace the invented placeholder weapons with real numbers, but a Forever item
of the same name may not carry the same values. Nothing in this file is Forever
data.

## Where it came from

`https://nether.wowhead.com/classic/tooltip/item/<id>` returns JSON: a name, an
icon, and the tooltip as HTML. That is the whole source — no page rendering
needed, unlike the talent calculators.

The extracted text was hashed with SHA-256 in the browser and the written file
had to hash to the same value, so this is the bytes the endpoint produced rather
than a transcription of them.

To add an item: fetch its tooltip, append it, and add the slot to
`SLOTS_BY_INVENTORY_TYPE` in `itemData.ts` if it is a kind nothing else uses.

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

Currently unmodelled: Vis'kag's chance-on-hit (the proc RATE is not stated
anywhere), Hand of Justice's extra attack (no such mechanic), Crusader (its rate
is stated only as "often"), and all Fire Resistance (not a stat the engine has).

## A check worth keeping

Each weapon tooltip states damage, speed AND dps, which are redundant. The
loader recomputes dps from damage and speed and throws if they disagree by more
than 0.05, so a scrape that dropped a digit fails loudly instead of producing a
quietly wrong weapon.
