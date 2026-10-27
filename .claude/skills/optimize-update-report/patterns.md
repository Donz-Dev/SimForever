# What won and what lost: a cross-class catalogue

Distilled from the nine class reports of round 80 (the second run of this skill, under the round 79
rules). Each class's full tables are in its `docs/handoff/<class>.md` round 80 section, and the
owner questions are in HANDOVER round 80. Use this file to start a profile from the shapes that
already paid elsewhere. Every figure is a dated claim about the build it was taken on, so re-price
it before relying on it.

## Shapes that won, and where

| shape | where it paid (round 80) | why it works |
| --- | --- | --- |
| **An area spell in a melee list** | LW Melee Volley above Raptor Strike: +603 at 5T, +1376 at 8T. Hawk Melee, gated at 4+ targets: +504 at 5T | A melee build's Multi Target list was its Single Target list; one AoE spell more than doubles the area columns |
| **A whole list built around the class AoE** | Warlocks on Hellfire (+600 to +940 at 5T); Mages on Flamestrike, Blizzard, Arcane Explosion; Ele and Enh on Magma Totem and Fire Nova | Before round 78 most profiles had no Multi Target list at all |
| **Gate an AoE entry on `targetCount`** | Hawk Volley at 4+ (ungated costs -29.5 at 3T); Frost Cone of Cold at 3 to 7 (loses at 8); Fire Blast Wave at 3+ | An area spell that wins at 5 often loses at 3 or 8; a gate keeps the gain without the loss |
| **A proc chain from another tree** | Arcane 48/3/0 to 32/16/3, Fire Blast into Heating Up into Pyroblast: +145.4 weighted | The owner's named miss from round 78; 16 Arcane points were doing nothing |
| **Shots in a melee Single Target list** | LW Melee Serpent Sting and Arcane Shot above Raptor: +185.5 at 1T; Hawk Melee +90.3 | A hybrid's spare global cooldowns and mana |
| **Lift a Single-Target-only clause from the Multi Target list** | Prot Warr and Fury Prot: execute clause gone from Multi Target, +190 and +209 TPS at 5T | A clause written for one boss is wrong with several targets and short clocks |
| **Spread a DoT with `multiDot`** | Prot Warr Rend to 5 (+77.6 at 5T); Moonkin DoT walks at 3T (+144.7); Firelock Immolate over 4 targets (+75.7 at 3T); Shadow Word: Pain spread | A DoT on extra targets costs one global cooldown each |
| **A pure DoT or a free buff at 0 s in an opener** | Moonkin Insect Swarm (+5.5); LW Ranged Serpent Sting; Shockadin and Prot Pally Consecration in the Multi Target opener; Bear Berserk at the Multi Target pull (+54 at 5T) | Passes Gate B: the owner's single damaging action is still the pull |
| **A cooldown or Spellblasting at the Multi Target pull** | DW Fury Death Wish and Mighty Rage; Prot Pally and Enh Spellblasting at the pull (Enh only from 5 targets) | In a 60 s or 30 s fight, the pull is the only potion window |
| **End-of-fight dump** | Rogue Eviscerate at 2+ points in the last N seconds: +3 to +13 on five lists | Stops a maintenance refresh that cannot pay back before the fight ends |
| **Do not refresh a DoT in the last N seconds** | Moonkin, last 8 s: +2.2 | The same reason |
| **Hold a cheap spell while a crit proc is up** | Ele Shaman Multi Target, Flame Shock held while Revelation is up: +24 at 5T | Spend the guaranteed crit on the area spell |
| **A rule clarification** | Hellfire and Rain of Fire as Destruction spells: Firelock +183, Fire Demo +183, Sbolt +108 weighted | Not an optimisation at all: an agent noticed a spell missing from a school list |

## Shapes that lost, so try them last

- **Reordering an owner list.** It was noise almost everywhere it was legal, and illegal everywhere
  else. The real gains were additions, new Multi Target lists and talents.
- **Talents on a forced build.** 2H Arms, DW Fury, Ret, both Shockadins, Firelock, Combat and Combat
  Mut: every legal move strands a capstone. Check `tools/buildVariants.ts`'s refusal first; it is
  free.
- **Spirit and mp5 enchants on a caster.** They are -10 to -24 everywhere. While casting, the five
  second rule stops gear mp5 as well (an open owner question).
- **Strength on a tank.** +45 weighted TPS on the Warriors, but it roughly doubled single-target
  deaths. The owner kept the defensive row. Price a tank's TPS with its deaths column beside it.
- **Mana-spending fillers on a mana-bound 120 s build** (Ele Earth Shock, Fire Nova, Chain Lightning
  in single target). The 120 s fight is a mana fight for Ele, Enh, both ranged Hunters, Ret and the
  healers.
- **Sunder Armor or Hamstring as tank threat fillers**: -8 to -332.
- **A second Spellblasting on a healer.** It is drunk at the pull and blocks the mana potion: -20 to
  -30.

## Potions: the pair that works

| build | Primary | Secondary | logic |
| --- | --- | --- | --- |
| mana-bound caster or hybrid (Ele, Enh, Ret, Arcane, Frostfire, Warlocks) | Major Mana, under 30% | Spellblasting | Single Target: Spellblasting only in the last 30 s. Multi Target: Spellblasting at the pull |
| caster with mana to spare at 120 s (Fire, Shadow) | Spellblasting, with the burst cooldown | Major Mana, under 30% | the fallback; it may never fire |
| healer | Major Mana only | none worth carrying | Major Mender's is inert; a damage potion does nothing; a Spellblasting secondary blocks the mana potion |
| no mana (Warrior, Rogue, Cat, Bear) | the damage potion (Mighty Rage, Major Frenzy) | Major Healing, or another damage potion | inert by design: report fights are 120 s or shorter, so only one potion is drunk |

- **"Under 50% mana after 60 s" is only an example.** It costs -128 HPS in the 60 s raid healer fight,
  which never reaches 60 s with mana left to restore. Sweep the gate.
- **The `secondary_*` potions grant the primary's ability id**, so a list's existing potion entry
  also acts on the secondary. An ungated owner Spellblasting line at the top drinks the secondary at
  the pull. That is how Arcane and Frost collided with the pair rule. An extra gate on an owner line
  is a question for the owner.

## Race, after the round 79 rule

- **Troll** won on most casters (Berserking inside the burst cooldown). On healers, hold Berserking
  5 s for the first raid pulse.
- **Undead** won on both Warrior tanks and is forced on every Paladin. Touch of the Grave needs
  damage, so a healer loses about 6.5 HPS to it.
- **Orc** won on most melee builds, and on BM, where Command adds +5% pet damage.
- **Windshaper** won on the feral Druids and Piss Beam.
- **Tauren** cost the Warrior tanks about 1% TPS through the rage formula, and won on Resto only
  because Night Elf was no longer allowed.
- **The healers that were Gnome or Night Elf lost ground on race alone** (about 24 weighted HPS on
  the Priests). That is the rule's price, not a regression to chase.

## Healers

- **The tank healer fight overheals and is capped by incoming damage.** Most tank-list variants are
  within ±6. The gains were in the raid list: Greater Heal on the tank under 60 to 70%, and Chain
  Heal ungated on the Riptide target.
- **Smart healing makes a list's thresholds unread**: every friendly entry aims at the lowest
  member. A gate sweep that runs bit-identical fights is this, not a dead entry.
- **The owner's pre-cast heal lines are the biggest withheld items** (Holy Pal +61 tank HPS).
  Price them and ask.
