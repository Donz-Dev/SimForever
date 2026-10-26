# SHAMAN DEEP DIVE

**Class:** Shaman
**Profiles:** Ele Shaman, Enh Shaman, Piss Beam (Restoration, a healer)

Read [CLAUDE.md](../../CLAUDE.md) first, then [README.md](README.md) in this
directory for what the census columns mean and how to reprint every figure below.

---

## Round 78 — the three presets optimised for the full report

`tools/optimise/shamanVariants.ts` holds every group, each with its control;
`tools/optimise/probe_healer_book.ts` prints a healer's casts, overheal and
mana book in one fight (a diagnostic, one batch). `full_report.ts`, 300 fights a
cell, before -> after:

| | 1 target 120 s | 3 targets 60 s | 5 targets 60 s | 8 targets 30 s |
| --- | --- | --- | --- | --- |
| Ele Shaman | 690.8 -> **737.2** | 774.4 -> **1272.8** | 774.4 -> **1607.7** | 865.5 -> **2210.2** |
| Enh Shaman | 801.9 -> **847.4** | 1046.2 -> **1301.3** | 1204.7 -> **1614.0** | 1544.5 -> **2126.4** |

| | tank healer 120 s | raid healer 60 s |
| --- | --- | --- |
| Piss Beam | 286.6 -> **330.0** HPS | 1175.9 -> **1228.4** HPS |

**AT 120 s BOTH DAMAGE BUILDS ARE MANA-BOUND** (1.0% and 1.2% headroom), which
is the regime round 27 found for Elemental and is now the published clock. So
the Major Mana Potion wins the Single Target fight on both (+35.7 / +23.3 alone,
+12.5 / +10.3 in combination) and loses the 5-target one (-9.4 / -11.9 alone,
-18.7 / -10.3 in combination). **Shipped on the brief's tie-break** -- prefer the
Single Target answer unless the Multi Target gain is clearly larger. On Elemental
the combined figures are 12.5 against 18.7, which is the closest call of the
round and the owner's to overturn.

**THE MULTI TARGET LISTS ARE THE ROUND** -- `profiles/multiTarget/shaman.ts`.
Magma Totem for Searing (one fire totem at a time; Searing in its place is -306
on Elemental), Fire Nova on cooldown, Flame Shock multi-DoT 5, Chain Lightning.
Each beats the Single Target list at 3, 5 and 8 targets by hundreds.

**PISS BEAM'S RAID FIGHT IS CAST-BOUND, NOT MANA-BOUND** -- about 5,000 mana
unspent at 60 s -- so its raid list drops Mana Tide Totem (a global cooldown for
mana it never needs, +24.9) and Nature's Swiftness (+5.5). Its tank list gains
**Healing Wave**, which the owner's talents spend eight points on (Improved
Healing Wave 5, Healing Way 3) and which no list cast: +30.4 HPS at 90%.

**RACE: ORC FOR BOTH DAMAGE BUILDS, WINDSHAPER SKYBORNE FOR THE HEALER.** Orc is
+15.7 / +22.6 on Elemental and +4.5 / +13.3 on Enhancement; Windshaper's passive
3% haste is +29.6 in the cast-bound raid fight. Troll and Tauren were ours.

**A KNOCK-ON REVERSED AN ENCHANT INSIDE THE ROUND.** Elemental's head and legs
+8 Intellect for +1% Haste was +12.77 on the starting build and **-10.17** once
Orc and the mana potion were in, so the haste stays. Haste on this build is also
the Searing Totem knife-edge (`docs/profile-optimisation.md` Appendix B).

**PRICED AND WITHHELD:**

- Elemental Warding 3 -> 2 for Totemic Focus 1: +0.98 +/- 0.84 at 120 s, zero at
  5 targets, and it would have contradicted a spread HANDOVER states. And
  **Totemic Focus's ability list names Searing Totem only** -- Magma Totem
  arrived later (round 57) and is not on it, nor Mana Tide Totem. A data
  question for the owner, not fixed here.
- Enhancement's Earth Shock gate at Flame Shock >= 1 s for the owner's 3 s:
  +3.64 +/- 3.55 at 120 s. The owner's gate stands.
- Lava Burst and Searing Totem entries on Elemental are the owner's lines and
  were not re-priced for removal.

**QUESTIONS FOR THE OWNER:** Elemental Mastery, Rage of the Farseer and Mana Tide
Totem all take a global cooldown (Nature's Swiftness does not); all three are
pre-cast or once a fight, so nothing was priced. Is Elemental Mastery meant to
be off the GCD, as in Classic?

---

## Round 27 — the Elemental build is MANA-bound, and the file said otherwise

**THE FIRST THING TO KNOW ABOUT THIS PROFILE IS THAT ITS PUBLISHED FIGURE IS
TAKEN IN THE ONE REGIME WHERE ITS MANA IS FREE.** 802 DPS at 60 seconds, **546
at 180 and 465 at 300**, with mana headroom falling 14.3% to **1.3%**: it
empties the pool inside the first minute and then stands still.
`npx vite-node tools/probe_clock.ts` prints it in one command.

`shamanVariants.ts` carried, in capitals, *"THE ELEMENTAL BUILD IS CAST-BOUND
AND NOT MANA-BOUND, WHICH IS THE FINDING THAT RULES OUT HALF ITS TREE."* Honest,
measured at 60s, and the sentence had closed the whole question.

**AND MINDFULNESS WAS A LIVE MANA TALENT FILED AS A RULED-OUT THREAT EFFECT**,
carrying `natural_grace`'s tooltip from one talent across in the same tier. The
owner's own spread spends 3 points there; an earlier round moved them out on
that reason. Restored, with Convection 5 bought from five dead points, the pair
is **+84.08 +/- 2.84 at 180s and noise at 60s**. See `HANDOVER.md`'s round 27
for the full dimension table — and note that **four other answers on this
profile invert between 60s and 180s** and are all waiting on the fight-length
question.

**HASTE IS NOT A STAT WEIGHT HERE.** `stat_weights` prices it wrong-signed
because a 55 second Searing Totem's last re-application lands on a knife edge
against the fight end. Use `tools/probe_stat_sweep.ts` before trusting any
weight on this build.

---

## Client build 1.60.1.70170 — a tier swap the patch notes do not mention

**ENHANCEMENT WAS RE-SPECIFIED and the owner supplied the URL when asked.**
Enh Shaman 727.2 → **708.6 (-18.6, noise)**, Ele Shaman unchanged to the decimal.

**ELEMENTAL FURY AND ELEMENTAL ALACRITY SWAPPED TIERS** -- Fury from row 3 (tier
10) to row 6 (tier 25), Alacrity the other way -- and Call of Thunder now requires
Alacrity 3 where it required Fury 5. **None of that is in the notes.**

**WHICH BROKE ONE BUILD AND NOT THE OTHER, AND THAT IS THE WHOLE STORY.**
ELEMENTAL takes both talents at the same ranks, so only its digits moved: its
allocation is byte-for-byte what the owner's original URL decoded to, re-encoded,
and `decode_talent_build.mjs` says so on the entry. ENHANCEMENT had five points in
Elemental Fury and nineteen in the tree, which cannot reach tier 25 -- so there was
no re-encoding to do and the owner chose where the points went.

**IT COST THE BUILD ELEMENTAL FURY'S +100% CRIT DAMAGE on Fire, Frost and Nature**,
which an Enhancement shaman reaches through Maelstrom Weapon's Lightning Bolts and
its Flametongue. **-18.6 is inside the interval and the mechanism is not**, which
is the shape CLAUDE.md records under Naturalist: a `noise` verdict is a statement
about variance, not about whether anything happened.

**AND IT PUT A LIVE GAP INTO THE BUILD** -- Elemental Warding, three of the freed
points, which reduces Fire, Frost and Nature damage TAKEN and neither profile
faces a target that deals any. The ENCOUNTER cause, not the engine's.

**LAVA BURST'S RANK 1 MOVED AND ITS MAX RANK DID NOT**, 106-134 → 150-192 against
an unchanged 192-248. So the talent tooltip and the spellbook now look CLOSER
together than they used to, and a reader who remembers the old gap could take the
spellbook's figure for the talent's new one.

---


## The Enhancement optimisation round — **761.9 → 838.8**

Run from `docs/profile-optimisation.md`. **36 variants measured, five shipped,
and one engine bug** that the round found by refusing to publish a figure it
could not explain.

| | |
| --- | --- |
| the optimisation | 761.9 → **829.4**, `+67.01 ±3.35` paired over 4000 iterations |
| the engine fix it turned up | 829.4 → **838.8**, and it moves two other profiles |

Every figure below is what REVERTING that change costs **on the finished
build** — the only reading publishable beside the others, because this round
moved its own baseline five times.

| dimension | shipped | marginal worth |
| --- | --- | --- |
| **consumables** | flask `+1200 Hit Points` → **`+150 Spell Power`** | **+36.95 ±0.08** |
| **talents** | five dead points → **Reverberation 5/5**, 17/34/0 → 19/32/0 | **+23.32 ±3.12** |
| **pre-combat** | **Rage of the Farseer at a 0s lead** | **+12.78 ±3.35** |
| **APL** | **Lightning Bolt below Earth Shock** instead of above Stormstrike | **+3.63 ±1.59** |
| **consumables** | food `+40 Attack Power` → **`+20 Strength`** | **+0.73 ±0.00** |
| **gear** | fixed by the brief. E65, verified, nothing to do | — |
| **enchants** | nothing. Nine of ten slots settled by arithmetic, the tenth measured | — |

**MARGINAL, NEVER ADDENDS**: those five sum to 77.4 against a measured 67.01.
And they are RE-PRICED on the fixed engine -- as the round ran they measured
+36.00, +25.24, +13.30, +3.90 and +0.73 for an end-to-end +67.19. Both sets are
honest and only one describes what ships.

### The flask was the largest single thing and nobody had asked

`hybridConsumables` hands all four of its callers `flask_hit_points`, and the
three Paladins that want otherwise override it per preset — Retribution and both
Shockadins carry `flask_spell_power`, priced at +59.9 and +73.3 in round 9.
**The Enhancement Shaman was simply never asked.**

**+1200 Hit Points reaches NOTHING here.** `targetAttacks` is false, so health
never leaves maximum, and a Shaman has no `D × 10 / H` rage rule for a bigger
pool to feed. The stat weight predicted the alternative at `150 × 0.2227 = 33.4`
and it measured **+33.45 ±0.24** on the build as found.

**AND SPELL POWER BEATS ATTACK POWER PER POINT ON A BUILD THAT IS 73.5%
PHYSICAL**, which reads like a contradiction and is not: attack power sat at
1,965 and spell power at 124, so a point of the second is a far larger share of
the smaller thing it reaches. 0.2227 against 0.1798. It is also why the potion
row does not divide — Spellblasting's +40 Spell Power beats Frenzy's +40 Attack
Power by 0.88, measured.

### The tree had five dead points and only three live destinations

Establishing that was the first result, and it is one of the smallest design
spaces in the project.

| out | why it is dead |
| --- | --- |
| `elemental_warding` 3 | Fire, Frost and Nature damage **TAKEN**, on a profile nothing attacks |
| `improved_ghost_wolf` 1 | `scope: 'positioning'` — a travel form |
| `spirit_weapons` 1 | `scope: 'threat'` — an unquantified parry chance and two threat clauses |

**EVERYTHING LIVE IN THE ENHANCEMENT TREE WAS ALREADY MAXED**, so no destination
is in it: what is unbought there is `toughness` (stamina), `anticipation`
(dodge), the two totem talents, `improved_lightning_shield` (not in the book) and
the second rank of Improved Ghost Wolf. The three live destinations are
`reverberation`, `tidal_focus` and the fifth rank of `ancestral_knowledge`.

**THE TIER ARITHMETIC BOUNDED IT IN BOTH TREES AT ONCE.** Elemental's seventeen
sat **exactly** on `trial_by_fire`'s tier-15 gate — 5 + 6 + 4 below it is 15 — so
Warding's three could not leave the tree without stranding Fire Nova's cooldown
reduction, but they could move DOWN a row. That is what makes Reverberation
reachable and Restoration's Tidal Focus not. Enhancement held every gate with
slack, so at most **three** points could leave it and at most **two** of those
from rows 0–2; `mental_dexterity` 3 and `mental_quickness` 2 are locked by
`requiresRanks` on Flurry and on the capstone.

**WHAT REVERBERATION BUYS IS A SHOCK CHARGE.** All three shocks share one
`cooldownGroup`, so 1.0 second takes it from 6.0s to 5.0s — twelve charges in a
sixty second fight where there were ten — and the build was already spending 9.1
of the ten. Flame Shock is duration-bound at 21 seconds, so the extra charges all
go to Earth Shock: **5.90 casts a fight → 7.60**.

**AND THREE DESTINATIONS MEASURED EXACTLY NOTHING, WHICH IS A STATEMENT ABOUT
THE TREE:**

| | |
| --- | --- |
| `convection` 3 | **IDENTICAL FIGHTS.** 10% off the shocks and the bolt, on a build ending the fight with 1,984 mana of headroom |
| `elemental_alacrity` 3 | **IDENTICAL FIGHTS.** Cast time on a Lightning Bolt this list only ever casts instant |
| `improved_stormstrike` 2 → 1 | +0.50 ±3.89, noise. Its live clause is 50% mana regeneration while casting, which is the same nothing Convection buys |

**SO `docs/handoff/shaman.md` WAS WRONG THAT THIS BUILD IS MANA-BOUND**, and the
Convection cell is the containment check that proves it rather than an argument.
The decomposition further down this file reads "The build is MANA-BOUND, so four
changes compete for one pool" — true when raid buffs were not assumed. Judgement
of Wisdom now returns **1,790 mana a fight**, which is 22% of everything the
build spends.

### The owner's shock gate is right, and the sweep that said otherwise expired inside the round

Earth Shock is gated on "Flame Shock has at least 3 seconds left", which exists
because the shocks share a cooldown. It was swept seven ways, three times:

| gate | on the build as found | after the talents | after everything |
| --- | --- | --- | --- |
| ungated | **+4.44 ±3.15 REAL** | +1.64 ±2.98 | +0.35 ±0.54 |
| ≥ 1s | **+4.25 ±3.13 REAL** | +1.82 ±2.96 | +0.25 ±0.43 |
| ≥ 2s | **+4.28 ±2.92 REAL** | +2.66 ±2.68 | +0.33 ±0.37 |
| **≥ 3s — the owner's** | — | — | — |
| ≥ 5s | −0.56 ±0.71 | −6.37 ±1.63 | **−5.26 ±1.28** |
| ≥ 8s | −8.69 ±2.13 | −13.67 ±2.42 | **−23.50 ±2.88** |

**LOOSENING IT WAS A REAL +4.44 AT THE START OF THE ROUND AND IS WORTH A THIRD
OF A DPS AT THE END OF IT**, because Reverberation removed the contention the
gate was mediating: two more shock charges a fight means Earth Shock rarely has
to take one Flame Shock wanted. **A gate's value is a fact about how scarce the
thing it rations is.** The owner's 3s sits at the top of a flat plateau and
tightening it is now sharply worse.

### Lightning Bolt was contending with Earth Shock for the Stormstrike debuff

Stormstrike leaves "+20% to your next Lightning Bolt, Chain Lightning or Earth
Shock", consumed by whichever casts first rather than by the clock. The bolt was
the first damage entry in the list, so it took that charge the instant Maelstrom
reached five stacks — and the shock is the harder hit, 590 against 553.

**THE POSITION WAS SWEPT RATHER THAN MOVED ONCE, and the shape is what names the
mechanism:**

| position | worth |
| --- | --- |
| below `stormstrike` | +1.65 ±0.98 — Stormstrike *applies* the debuff |
| below `flame_shock` | +1.82 ±1.14 |
| below `searing_totem` | +1.71 ±1.14 |
| below the racial | +1.71 ±1.14 |
| **below `earth_shock`** | **+3.11 ±1.39** — the shock takes the debuff instead |
| the very bottom | +3.40 ±1.84 — inside the row above's interval |

The three middle rows are a **plateau**, and correctly so: all three entries are
rarely castable, so passing them changes nothing. The two steps that pay are the
two that change who gets the aura.

**AND THE BOLT DID NOT LOSE A CAST: 1.80 a fight → 1.90.** Maelstrom caps at five
stacks, so a bolt held too long would waste the procs that would have been its
sixth — the same shape as the Cat's Shifting Power. It does not happen here.

**THE MAELSTROM THRESHOLD IS CONFIRMED AT FIVE AND THE REASON IS SWING TIME, NOT
DAMAGE.** Four stacks measured **−2.27** and three **−6.24**: at five the bolt is
instant, and `castAbility` returns before the swing reset when `castTime <= 0`.
Below five it is a real cast that throws away a swing, on a build that is 60.7%
swings.

### Rage of the Farseer, and a figure that went stale inside its own round

Pre-casting it at a 0s lead measured **−4.79, noise** at the start of the round
and **+12.71 ±3.00 over 5000 iterations** at the end. Nothing about the ability
changed.

**IT IS THE GCD, AND THE GCD BECAME WORTH SOMETHING.** `abilities/shaman.ts`
deliberately leaves the racial ON the global cooldown — the capture says
"Instant" and says nothing about the GCD, and guessing it off would be free
uptime nobody granted — so a 0s lead claims the whole 25 second window for
nothing. At the start of the round the list made about 33 casts in a 60 second
fight and had cooldowns to spare, so a saved one bought nothing. Reverberation's
two extra shock charges took the list to about 36 and the spare went.

**WHICH IS `docs/profile-optimisation.md`'s RETRACTION POINTING THE OTHER WAY**:
"pre-casting is only worth the GCD it saves" cuts both ways, and whether a GCD is
worth anything is a property of the list rather than of the ability.

### The enchants were settled by arithmetic, and nine slots needed no fight

Off this build's own stat weights — 1500 paired iterations, baseline 765.9:

```
strength 0.3956   intellect 0.3296   agility 0.2845   spellPower 0.2227
attackPower 0.1798   1% crit 6.8802   1% haste 2.8835 ±2.3802
stamina / spirit / armor / defenseSkill / dodgeChance / manaPer5   ZERO
```

head `+8 Str` 3.16 beats `+8 Int` 2.64; neck `+5 Str` 1.98 beats `+6 SP` 1.34;
gloves `+15 Str` 5.93 beats `+20 SP` 4.45; chest, cloak and feet each have one
live option. **The two-hand slot is the one a weight table cannot settle**, and
Crusader wins it: at 1.1 procs a minute of +100 strength it reads **44.8% aura
uptime**, and the alternatives measure `+65 Spell Power` −0.10 ±3.86,
`Enchant Weapon - Spell Power` −8.50, `+25 Agility` −8.97, `Revelation` −11.65.

**THE WRISTS SLOT IS A GENUINE DEAD HEAT AND IS REPORTED RATHER THAN SHIPPED.**
`+9 Strength` is 3.560 by arithmetic and `+16 Spell Power` is 3.563, and the
measurement agrees to a tenth of a DPS: **−0.02 → +0.13 → +0.22** as the round
added spell power. It is real at the end (±0.02) and it is 0.026% of DPS on a
knife-edge that **flipped sign twice inside one round**, so it is a property of
the current spell power rather than of the slot. One line for the owner if they
want it.

### What every other dimension said, including the rows that did not move

**THE APL's EIGHT ENTRIES ARE ALL LOAD-BEARING** — removing each, on the build as
found: `stormstrike` **−142.4**, `fire_nova` **−70.8**, `flame_shock` −56.1,
`earth_shock` −49.5, `rage_of_the_farseer` −38.0, `lightning_bolt` −10.7,
`searing_totem` −3.9 (it is pre-cast, so its entry only refreshes), and Fire
Nova's position is noise. **Earth Shock additionally requiring the Stormstrike
debuff is −15.60**: it blocks the shock far more often than it improves it.

**THE CONSUMABLES: every alternative loses.** `food +28 Spell Power` −1.46,
`blasted lands +25 Intellect` −1.80, `food +20 Agility` −2.41, `school power
Nature` −3.16, `blasted lands +25 Agility` −3.18, the Dense Sharpening Stone
−5.13. The main-hand weapon effect's caster option is −0.63, noise, so the melee
crit stays.

**THE OWNER'S OPENER: all three lines priced, nothing changed.** Removing
`windfury_weapon` is −2.93 and `flame_shock` +1.50, both noise. Moving the
Windfury lead 3s → 0s runs **IDENTICAL FIGHTS**, because an hour-long imbue does
not care.

**AND `searing_totem` MEASURED +3.09 ±3.02 TO REMOVE, WHICH WAS PRICING AN
ENGINE BUG AND NOT A CHOICE** — +14.60 at a 240 second fight. See the section
below: the pre-combat rewind was costing that totem a whole application of
ticks, and with it fixed the owner's line is a gain to keep. **A figure on one
of their lines that is large enough to want a mechanism is one to explain before
reporting**, which is "isolate a loss, do not blame the obvious suspect" applied
to a gain.

**AND THE DEMONIC RUNE FIRES 0.00 TIMES, WHICH IS THE OWNER'S PARTITION AND NOT
A DEFECT.** It is gated at 10% mana and this build ends with 1,984 spare.
Substituting a Healthstone measures **−0.00 with a spread of 0.1** — both are
worth nothing — so the row stays where the owner's three-way rule puts it: "the
Demonic Rune at 10% mana for pure mana users."

### The engine bug the round found, and what made it visible

**A PRE-CAST AURA OUTLIVED ITS OWN WINDOW BY THE LEAD**, and the thing it cost
was a damage-over-time effect at an **identical uptime**:

| 240s fight | casts | uptime | **ticks** | damage |
| --- | --- | --- | --- | --- |
| with the owner's 1.5s pre-cast | 4.97 | **97.6%** | **117.08** | 11,872 |
| no pre-cast, cast in-fight | 4.92 | **97.0%** | **152.02** | 15,377 |

`rewindAuras` aged the window by writing `appliedAt` and `expiresAt` and left
the **expiration event scheduled against the old time**, so for 1.5 seconds
`remainingMs` read zero while `has` answered true. A periodic tick chains itself
and stops when the next would fall past `expiresAt`; `refresh` extends the
window **without restarting a chain that has already stopped**. So the list's
"recast when it has run out" fired inside the stale window, REFRESHED the
still-present aura rather than applying a new one, and got a window that ticked
**zero times** — one window lost, which is why the deficit is a constant ~36
ticks from 120s onward.

`AuraCollection.rewindWindow` is the fix: age the window through the class that
owns the scheduling. Ticks per fight:

| fight | buggy | **fixed** | in-fight control |
| --- | --- | --- | --- |
| 60s | 35.04 | **38.48** | 37.76 |
| 120s | **41.15** | **76.67** | 76.36 |
| 240s | **117.30** | **152.43** | 152.07 |

**THE GENERAL CASE IS STILL LATENT AND IS OUTSTANDING WORK.** A refresh on any
aura whose tick chain has already stopped gets a silent window, whatever stopped
it; the rewind was simply the only route that reached it reliably. The comment at
the chain asserts the behaviour that is missing — "a refresh that extends the
duration automatically gets more ticks" — which is true while the chain is alive
and false once it is not.

**AND IT IS WORTH +9.4 HERE AND +0.1 ON THE ELEMENTAL SHAMAN**, which carries
the identical opener line at the identical lead. Both lists hold the totem with
"if not active"; this one places it fourth among its damage entries and the
Elemental list first, and the totem is 7.2% of this profile against 18% of that
one. **Reported rather than explained** — isolating it is outside the named
scope and a guessed mechanism written down as a finding is what this file keeps
recording.

### What this round could not see

The four blind spots `docs/profile-optimisation.md` names were read by hand:

- **the clock.** Every figure is at `durationSeconds: 60`. The build's longest
  cooldown is the racial's 180s, so a longer fight reaches that entry a second
  time and the pre-cast's +13.30 is an opening-only gain that does not repeat.
  **Not measured at a longer duration** — the open `HANDOVER.md` question about
  fight length covers it.
- **the declarations.** `src/game/abilities/shaman.ts` contains no
  `triggersGcd` at all, and both of its cooldown-shaped abilities say in their
  own comments that paying a GCD is the DEFAULT rather than a decision. Left
  alone deliberately: see the question raised below.
- **the pre-combat/APL overlap.** Nothing is redundant. The Searing Totem entry
  refreshes a 55s aura once and the racial entry is a safety net for a fight
  longer than 180s.
- **the shape.** No two entries fire as a group, so there is no accidental
  sequence to write as a real one.

---

## The one thing to understand first

**THE DEEP DIVE IS DONE, AND WHAT IT FOUND WAS NOT A MISSING ENGINE.** The
previous version of this document opened with "TOTEMS ARE NOT ENTITIES, AND THAT
IS SIX OF THE SEVENTEEN LIVE GAPS", pointed at the mid-fight-summoning gap shared
with the Warlock and the Mage, and said it landed "hardest here". Every part of
that framing was wrong in a way worth keeping on the record:

| The claim | What was true |
| --- | --- |
| six talents blocked on totems-as-entities | **four.** Improved Fire Nova needed a COEFFICIENT, and Totemic Focus is a percentage mana cost on a totem SPELL -- `grantCastModifier`, no entity involved |
| "it lands on an Elemental profile whose figure is short by whatever they are worth" | **neither profile spends a point on any of the four.** Both are 0 in Restoration, and neither takes Earth's Grasp or Guardian Totems. The totem gap was worth exactly nothing to either build |
| the engine change was the blocker | **the owner answering four questions was.** Three numbers and three rulings, none of them requiring an engine change |

**ELEVEN OF THE SEVENTEEN LIVE GAPS WERE UNSPENT POINTS IN BOTH BUILDS.** That is
the reframing worth carrying to the other eight classes: a census counts all 50
talents and a profile spends 51 points on about eighteen of them, so the live-gap
column never said how much of a BUILD was inert. Six of the Shaman's seventeen
were in a build; one is left, and it works.

---

## The profiles

| Profile | Talents | DPS | was | List | Entries |
| --- | --- | --- | --- | --- | --- |
| Enh Shaman | 19/32/0 | **625.8** ±8.0 | 604.0 | `SHAMAN_ENHANCEMENT` | 8 |
| Ele Shaman | 32/11/8 | **375.0** ±3.8 | 295.4 | `SHAMAN_ELEMENTAL` | 4 |

**THE DPS COLUMN ABOVE IS THE DEEP DIVE'S AND IS LONG DEAD** -- raid buffs were
selected rather than assumed after it, which moved all 28 rows. The baseline of
record is `HANDOVER.md`'s table, where these two read **829.4** and **792.7**.
The SPREADS are current: Enhancement went 17/34/0 to 19/32/0 in the
optimisation round below.

**ELE SHAMAN +79.6, REAL. ENH SHAMAN +10.9, AND THAT ONE IS A LIE BY NET.** The
Enhancement figure is inside its interval and hides four separate real changes
that happen to offset — see the decomposition below, which is the only honest way
to report it.

**ELE SHAMAN STOPS BEING THE MOST UNDER-SERVED PROFILE IN THE PROJECT.** It was
second-lowest of 23; it is now fifth-lowest, above SM/DS and both Hunters, a
decimal under Bear. The mean across 23 moved 411.7 to **415.6** and the twenty-one
non-Shaman profiles are identical to the decimal.

### Flurry's trigger, ruled 2026-10-05, and the figures above predate it

**THIS CLASS IMPORTS THE WARRIOR'S FLURRY REACTION**, so a Warrior ruling reaches
it. The owner widened Flurry from "a melee critical strike" to **ANY non-DoT
critical strike**, and because an Enhancement Shaman crits with Lightning Bolt,
Flame Shock and Earth Shock, that is worth **+10.5 DPS here: Enh Shaman 593.5 to
604.0**. It is worth nothing to any Warrior profile.

Both tooltips still read "after dealing a MELEE critical strike", so the override
is deliberate in both classes. **The DPS table above is older than this and than
several other dives** -- the baseline of record is HANDOVER.md, and these figures
should be reprinted rather than quoted.

**THE TRANSFERABLE PART: a reaction two classes import carries a ruling across the
class boundary.** `SHAMAN_TALENT_REACTIONS.flurry` is the Warrior's builder, and a
change to it must be measured on BOTH -- this one would otherwise have landed as
an unexplained +10.5 on a class nobody was looking at.

### What each change was worth, measured one at a time

Each row is that change REMOVED from the finished build, so the figure is what it
contributes in the presence of the others. 30 batches of 10 per row.

| Change | Profile | Worth |
| --- | --- | --- |
| **Searing Totem in the Elemental list** | Ele | **+59.5** |
| **Fire Nova declared, and in the Enhancement list** | Enh | **+25.5** |
| **Elemental Focus** (Clearcasting) | Ele | **+12.5** |
| **Lightning Overload** | Ele | **+11.1** |
| **Maelstrom Weapon: flat 20% → 5 PPM** | Enh | **+6.6** |
| **Improved Stormstrike's mana regeneration** | Enh | **+3.4** |
| **Windfury imbue internal cooldown: 1.5s → 3s** | Enh | **−10.0** |

**THE ENHANCEMENT ROWS DO NOT ADD UP AND THAT IS THE FINDING.** −10.0 + 6.6 +
25.5 + 3.4 is +25.5 against a measured net of +10.9. The build is MANA-BOUND, so
four changes compete for one pool: removing Fire Nova's 520 mana a cast makes
everything above it more affordable, which is why its isolated value overstates
what it adds. Read the rows as "what this is worth here", never as a sum.

### Where the damage comes from

One batch of ten, so read the shape and not the decimals:

| Profile | Top sources |
| --- | --- |
| Ele Shaman | Lightning Bolt 48.1%, Searing Totem 18.2%, Flame Shock 16.1%, Lava Burst 15.1%, Lightning Bolt (Overload) 2.5% |
| Enh Shaman | Main Hand 36.4%, **Windfury Attack 15.9%**, Fire Nova 15.1%, Stormstrike 12.0%, Searing Totem 7.4%, Flame Shock 6.5%, Earth Shock 5.1%, Lightning Bolt 1.7% |

**THE ELEMENTAL'S TABLE WENT FROM THREE SOURCES TO FIVE**, which was the narrowest
in the project and is not any more. Lightning Bolt fell from 60.5% to 48.1%
without losing any damage: the table grew around it.

---

## The census

| Talents | Fully | Partly | Ruled out | Live gap |
| --- | --- | --- | --- | --- |
| 50 | 22 | 4 | 18 | **6** |
| *was* | *17* | *4* | *12* | ***17*** |

### The 6 live gaps, and not one of them is in a build except the first

| Talent | In a build? | Cause |
| --- | --- | --- |
| `elemental_weapons` | **Enh, 3/3** | **A CENSUS ARTEFACT. Its Windfury half WORKS.** See below |
| `elemental_warding` | no | the target. Nothing deals Fire, Frost or Nature damage to either Shaman |
| `improved_lightning_shield` | no | the target, and Lightning Shield is not in the book |
| `water_shield` | no | the target. **Mana return is in scope**, so this is a gap and not a ruling |
| `improved_reincarnation` | no | its **+4% maximum health** clause: `maxHealth` is computed once from a stats snapshot and no effect kind reaches the pool as a percentage |
| `nature_s_swiftness` | no | a one-shot cast-time modifier selecting by SCHOOL. **The Druid has the same gap — build it once** |

**`elemental_weapons` IS NOT A GAP AND THE CENSUS CANNOT TELL.** Its reason has
said "APPLIES" in capitals since it was written — `reactionsForClass` reads its
rank off the allocation and builds the Windfury proc with it — and the census
counts non-unmodelled EFFECT ROWS, of which this talent has none.
`appliedElsewhere` is the field for exactly this and is **not on `main` yet**: it
arrives with the Rogue's two poison talents, which fell into the same hole. When
that branch lands, **one line** in `shamanEffects.ts` takes the Shaman to 5 live
gaps and 5 partly — and `shamanAbilities.test.ts` fails until it is written,
deliberately, because a known-wrong classification that nothing enforces stays
wrong.

### Partly modelled (4)

| Talent | What is missing |
| --- | --- |
| `call_of_flame` | **Magma Totem only.** Its Fire Totem, Flame Shock, Fire Nova and Lava Burst clauses all apply |
| `elemental_fury` | **Magma Totem only.** Searing Totem and all three schools apply |
| `improved_stormstrike` | its dodge/parry cooldown reset. **Its mana clause is live** |
| `tidal_focus` | healing only, and neither profile heals |

**MAGMA TOTEM IS NOT THE TOTEM RULING AND MUST NOT BORROW IT.** It is a DAMAGE
totem, so the reading that reaches Searing Totem reaches it — what it lacks is a
spell power coefficient, the same thing Searing Totem and Fire Nova lacked until
the owner supplied 8% and 10%. It is the **one open data question left in this
class** and it is worth knowing that the answer would not get it cast: 73 every 2
seconds for 20 seconds is 36.5 a second for 650 mana against Searing Totem's 31.3
a second for 55 seconds and 170 mana, and only one fire totem stands at a time.

### Ruled out (18), including two rulings given for this class

Both are new `OutOfScope` members, given by the owner on 2026-09-30, and **both
were found the same way**: a reason that had been counted as work for the whole
project turned out to be blocked TWICE, so clearing either half left it inert.

| Ruling | Shaman talents | Reaches |
| --- | --- | --- |
| **`castPushback`** | `eye_of_the_storm` (Ele, 3/3), `healing_focus` | five more across four classes — see below |
| **`totemEntities`** | `earth_s_grasp`, `guardian_totems`, `restorative_totems`, `mana_tide_totem` | Shaman only. **Closes the project's last open scope question** |

**`castPushback` IS A PROJECT-WIDE RULING AND IT HAS BEEN SWEPT.** Five pure
pushback talents in four other classes carry it now — `mage.improved_channeling`,
`warlock.fel_concentration`, `warlock.intensity`, `priest.twilight_focus`,
`druid.nature_s_focus` — which takes one talent off each of those classes'
queues. Three others name pushback and keep a different reason: `burning_soul`
(threat) and `spiritual_focus` (healing) are already ruled out, and
`mage.ice_barrier`'s first clause is a 447-damage ABSORB, which is the target
rather than the ruling. `outOfScope.test.ts` matches the WORDING now, so a new
unscoped pushback reason fails.

---

## Never-fired entries

**None.** Every entry in both lists fires — reprint with
`USES=1 PROFILES=shaman npx vite-node tools/measure_profiles.ts`.

## In the book, in no list, never cast

`chain_lightning` and `frost_shock` for both; `earth_shock`, `fire_nova` and
`windfury_weapon` for the Elemental.

- **`chain_lightning` has no second target** — area damage against one enemy.
- **`frost_shock` is a snare**, out of scope by ruling.
- **`fire_nova` is DELIBERATELY out of the Elemental list and it was measured, not
  argued.** Below that list's unconditional Lightning Bolt it fired zero times and
  the figure was 375.0 to the decimal; above it, 332.0 — a 43-point loss, because
  520 mana on a six-second cycle starves the filler. The floor rule: nothing below
  an ungated entry can ever be the first castable one.

---

## Traps specific to this class

- **A TALENT POINT CAN BUY A CLAUSE THE ROTATION CANNOT REACH, AND NOTHING SAYS
  SO.** The Elemental build spends 3/3 on Call of Flame, whose first clause is
  "the damage done by your FIRE TOTEMS", and its list cast no totem for the whole
  project. The talent was correct, its effect was correct, and it was worth
  nothing — a working talent on an ability nobody casts reports exactly like a
  working talent. **Adding the totem was +59.5.**
- **WINDFURY WEAPON IS NOT WINDFURY TOTEM, AND FOR MOST OF THIS PROJECT IT WAS
  MODELLED AS THOUGH IT WERE.** The owner separated them on 2026-10-07. The imbue
  grants two extra **SPECIAL** attacks (`melee-special`: two rolls, **no glancing
  blow**) carrying the rank's attack power **in the hits**, it does **not** reset
  the auto-attack swing timer, and it reports under **its own row**. The totem
  still does the old thing -- a real extra SWING plus a 1.5-second attack power
  window -- because the owner stated that one directly, and **the two must not be
  made to match.** `buffs/windfury.ts` is a separate file for a separate effect.
  Worth **+21.8** to Enh Shaman; the special table alone is +15.8 and the folded
  attack power +18.8.
- **A ROW IS ONLY "ITS OWN" IF NOTHING ELSE SHARES ITS KEY.** `abilityBreakdown`
  builds one row per NAME and takes `uses` from cast events, so naming the hits
  "Windfury Weapon" -- the imbue's name -- gave one row reading ONE USE and nine
  ATTEMPTS. They are **"Windfury Attack"**, after Vis'kag's "Fatal Wound".
- **WINDFURY IS MAIN-HAND ONLY** and WEAPON-BOUND, so it fires only from a use of
  its own weapon. It spent its whole life refusing abilities and every figure was
  self-consistent and too low.
- **MAELSTROM WEAPON PROCS ON ALL THREE SOURCES AND THE RATE IS RIGHT**, which was
  asked and is worth not re-asking. `tools/maelstrom_probe.ts` prints the observed
  chance per source against the PPM chance the weapon's base speed implies:
  auto-attacks 31.2%, Windfury attacks 32.6%, Stormstrike 30.7%, expected 31.67%.
  **The bolt count is arithmetic, not a bug**: ~35 melee uses a minute at 31.67%
  is ~11 procs a minute, five stacks buy one bolt, so 1.7 casts in a 58-second
  fight is what 5 PPM means here.
- **AND `PPM` IS AN EQUATION VARIABLE, NOT A CEILING** — the owner's answer on
  2026-10-07 to exactly that question: `% chance to proc = PPM * baseweaponspeed
  / 60`. So **11 procs a minute at 5 PPM is the intended consequence** and not a
  figure to be explained away: every weapon use rolls, and only auto-attacks cost
  swing time, so Stormstrike and the two Windfury attacks per proc are free
  rolls. **The question is closed; do not re-raise it from the 11.** The equation
  is pinned in `procs.test.ts` in the owner's own form rather than described in a
  comment.
- **THE WINDFURY IMBUE'S INTERNAL COOLDOWN IS 3 SECONDS, THE OWNER'S, AND IT WAS
  1.5 BORROWED FROM THE TOTEM.** Twice too generous, worth −10.0 to fix, and the
  totem's 1.5 is still correct for the totem. A borrowed number can be wrong by a
  FACTOR, which is the whole argument for keeping a borrow visible.
  HANDOVER.md also claimed a Season of Discovery trinket tooltip read 2s; no such
  tooltip exists anywhere in the repository and the claim is gone.
- **MAELSTROM WEAPON IS 5 PPM, NOT A FLAT CHANCE**, and the SHAPE matters more
  than the number: a flat per-hit chance is worth more to a fast weapon and PPM
  removes exactly that. **A Rogue's poison is the opposite by ruling** — flat per
  strike, deliberately not normalised — and the two live side by side and must not
  be made to match.
- **A proc's reaction is built PER CHARACTER**, because an internal cooldown is
  per-character state. One shared closure silently stopped Windfury proccing after
  the first iteration of a batch.
- **Mana ticks twenty times a second**, "smooth" regeneration at 50ms, and
  **Improved Stormstrike is the only thing in this project that opens the five
  second rule for a window** rather than permanently.
- **Maelstrom Weapon is interpreted as PER STACK**, an interpretation recorded
  beside the aura, not a placeholder.
- **A REFRESH WINDOW CLIPS.** The Elemental's earlier +16.4 was replacing a
  two-second refresh window on Flame Shock with "if not active".
- **LIGHTNING OVERLOAD CARRIES THE SOURCE SPELL'S ID AND ITS OWN NAME**, and
  reversing either is silent. The ID is what Concussion and Call of Thunder key
  off, so its own id would strip every modifier; the NAME is what the damage
  analyzer groups by, so sharing the name would make it unmeasurable.
- **FIRE NOVA'S FIRE TOTEM REQUIREMENT IS `canCast` AND IS ASKED OF THE TARGET**,
  because the totem is modelled as a debuff there. That makes the Searing Totem
  entry above it in the Enhancement list load-bearing rather than independent —
  and it made the COEFFICIENT PROBE read `condition_failed`, which looks like a
  row rather than a hole. `tools/coefficient_probe.ts` has a `SETUP` entry for it
  now.

---

## What "done" looks like

Every item on the previous version of this list is closed.

1. ~~`elemental_focus` closed~~ — **done**, +12.5 to the Elemental.
2. ~~the six totem talents written up as ONE engine gap~~ — **better than done.**
   Two were never blocked on it, and the owner ruled the other four out of scope.
3. ~~Maelstrom Weapon's proc chance asked for~~ — **5 PPM**, the owner's.
4. ~~the Windfury 1.5s vs 2s discrepancy settled~~ — **3s**, the owner's, and the
   2s claim had no source.
5. **Nature's Swiftness** is the one item left, and it is **not a Shaman job**: a
   one-shot cast-time modifier selecting by SCHOOL, which the Druid wants too and
   `CastModifier.abilityIds` deliberately does not express. Neither Shaman profile
   spends a point on it. **Build it once, for both.**
6. ~~the Elemental list revisited last~~ — **done**, and it was the largest single
   thing in the class.

### What is actually left, in order

1. **`appliedElsewhere` lands with the Rogue's branch** → one line, and
   `elemental_weapons` stops reading as a gap. A test already fails until it is
   written.
2. **Magma Totem's spell power coefficient** — one question, and the answer will
   not get it cast. The only open data question in this class.
3. **Nature's Swiftness**, shared with the Druid.
4. **`improved_reincarnation`'s +4% maximum health** — a real missing declaration,
   in no build, and the cheapest of the three remaining.
