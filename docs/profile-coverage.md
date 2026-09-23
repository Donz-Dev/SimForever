# What each preset actually simulates

Every choice the three presets make — race, combat style, stance, whether the
target swings back, each talent, each item, each enchant, each raid buff, and
each entry in the priority list — in one of three buckets.

| | |
| --- | --- |
| **Full** | every part of it is simulated, and it changes a number in this build |
| **Partial** | some of it is simulated and some is not, and the row says which |
| **Inert** | nothing it does reaches a result **in this profile** |

**"Inert" is about the profile, not the engine.** Improved Cleave is fully
implemented — it takes three rage off Cleave, and a test proves it — but Cleave
is in no priority list and every encounter has one target, so those three
points change nothing for a 2H Arms warrior. A report that called it "full"
would be true about the code and useless to someone reading their own build.

## How this is produced

```bash
npx vite-node tools/profile_coverage.ts               # readable
npx vite-node tools/profile_coverage.ts --markdown    # this file
```

**Derived, not transcribed**, so it cannot drift from the code:

- **Full or partial** is read from the project's own `unmodelled` declarations
  — the same ones the Gear, Talent and Results panels print on screen.
- **Inert** is **measured**. The generator runs each preset for twelve fights
  and collects every ability and aura id the telemetry carries, then asks
  whether the thing a talent modifies ever appeared.

Measuring rather than reading the priority list is not fussiness. Improved Rend
modifies `rend` — the bleed's own id — while the list casts `rend_cast`. A
static check called that talent dead when it is doing its job every three
seconds. Twelve seeds, because a rarely-reached entry like Execute can miss a
single fight.

**An entry that is never cast is not automatically dead.** Battle Stance and
Battle Shout sit at the top of every list behind "if not already active", and
both are already up before the first global cooldown — the stance from the
character's opening aura, Battle Shout from the raid. The guard working is the
entry doing its job, so those rows read Full with the reason attached.

## 2H Arms

## 2H Arms

Orc, two-hander, Battle Stance, standing target

**56 full, 1 partial, 4 inert** across 61 choices.


### Character

| | | | |
| --- | --- | --- | --- |
| Race | orc | **Full** | Base stats come from the generated table; racials are not modelled for any race. |
| Combat style | two_hander | **Full** | Decides which equipment slots resolve, which attack tables apply, and which rotation runs. |
| Stance | battle | **Full** | Its aura is applied and its modifiers apply; it also selects the priority list. |
| Target attacks back | false | **Full** | Off, so the target never swings and nothing keyed to being hit can fire. |

### Talents

| | | | |
| --- | --- | --- | --- |
| Improved Heroic Strike | 3 points | **Full** |  |
| Improved Rend | 3 points | **Full** |  |
| Improved Charge | 1 point | **Inert** | Charge is in no priority list for this build. |
| Improved Tactical Mastery | 5 points | **Inert** | Retains rage through a stance change; this list never changes stance. |
| Improved Overpower | 2 points | **Full** |  |
| Anger Management | 1 point | **Full** |  |
| Deep Wounds | 3 points | **Full** |  |
| Spearing Strike | 1 point | **Full** |  |
| Two-Handed Weapon Specialization | 3 points | **Full** |  |
| Impale | 2 points | **Full** |  |
| Bloodthrill | 5 points | **Full** |  |
| Sweeping Strikes | 1 point | **Inert** | The ability is implemented and does nothing: its whole effect is that the next 5 melee attacks strike an ADDITIONAL opponent, and an encounter here has exactly one enemy. Not a missing number -- a missing second target. See engine/combat/targeting.ts. Sweeping Strikes is in no priority list for this build. |
| Weaponmaster | 5 points | **Partial** | Applies only with a particular weapon, and this character is not holding one. Not an error -- equip the right weapon and it works. The mace and staff clause ignores a percentage of the target armor, which the damage pipeline cannot express. The axe/polearm crit and the sword extra attack both work; the crit reads the MAIN HAND only, because crit chance has no per-slot form in this engine. |
| Improved Slam | 2 points | **Full** |  |
| Mortal Strike | 1 point | **Full** |  |
| Cruelty | 5 points | **Full** |  |
| Unbridled Wrath | 5 points | **Full** |  |
| Improved Cleave | 3 points | **Inert** | Cleave is in no priority list for this build. |

### Gear

| | | | |
| --- | --- | --- | --- |
| Striker's Mark | ranged | **Full** |  |
| Jaws of Might | head | **Full** |  |
| Onyxia Tooth Pendant | neck | **Full** |  |
| Pauldrons of Might | shoulders | **Full** |  |
| Cape of the Black Baron | cloak | **Full** |  |
| Hauberk of Might | chest | **Full** |  |
| Armguards of Might | wrists | **Full** |  |
| Hands of Might | gloves | **Full** |  |
| Sash of Might | waist | **Full** |  |
| Leggings of Might | legs | **Full** |  |
| Treads of Might | feet | **Full** |  |
| Don Julio's Band | ring1 | **Full** |  |
| Quick Strike Ring | ring2 | **Full** |  |
| Blackhand's Breadth | trinket1 | **Full** |  |
| Hand of Justice | trinket2 | **Full** |  |
| Obsidian Edged Blade | twoHand | **Full** |  |
| Enchant Weapon - Crusader (enchant) | twoHand | **Full** |  |

### Raid buffs

| | | | |
| --- | --- | --- | --- |
| Battle Shout | Warrior | **Full** |  |
| Thunder Clap | Warrior | **Full** |  |
| Sunder Armor | Warrior | **Full** |  |
| Power Word: Fortitude | Priest | **Full** |  |
| Divine Spirit | Priest | **Full** |  |
| Blessing of Kings | Paladin | **Full** |  |
| Blessing of Might | Paladin | **Full** |  |
| Faerie Fire | Druid | **Full** |  |
| Mark of the Wild | Druid | **Full** |  |
| Strength of Earth Totem | Shaman | **Full** |  |
| Windfury Totem | Shaman | **Full** |  |
| Leader of the Pack | Druid | **Full** |  |

### Rotation

| | | | |
| --- | --- | --- | --- |
| Battle Stance | battle_stance_cast | **Full** | Never cast in 12 fights, and never needed: its effect is already up. |
| Battle Shout | battle_shout_cast | **Full** | Never cast in 12 fights, and never needed: its effect is already up. |
| Overpower | overpower | **Full** |  |
| Sunder Armor | sunder_armor_cast | **Full** |  |
| Heroic Strike | heroic_strike | **Full** |  |
| Rend | rend_cast | **Full** |  |
| Mortal Strike | mortal_strike | **Full** |  |
| Execute | execute | **Full** |  |
| Spearing Strike | spearing_strike | **Full** |  |
| Slam | slam | **Full** |  |

## DW Fury

Orc, dual-wield, Berserker Stance, standing target

**55 full, 1 partial, 4 inert** across 60 choices.


### Character

| | | | |
| --- | --- | --- | --- |
| Race | orc | **Full** | Base stats come from the generated table; racials are not modelled for any race. |
| Combat style | dual_wield | **Full** | Decides which equipment slots resolve, which attack tables apply, and which rotation runs. |
| Stance | berserker | **Full** | Its aura is applied and its modifiers apply; it also selects the priority list. |
| Target attacks back | false | **Full** | Off, so the target never swings and nothing keyed to being hit can fire. |

### Talents

| | | | |
| --- | --- | --- | --- |
| Improved Heroic Strike | 3 points | **Full** |  |
| Improved Rend | 3 points | **Inert** | rend is in no priority list for this build. |
| Improved Tactical Mastery | 5 points | **Inert** | Retains rage through a stance change; this list never changes stance. |
| Anger Management | 1 point | **Full** |  |
| Deep Wounds | 3 points | **Full** |  |
| Spearing Strike | 1 point | **Inert** | Spearing Strike is in no priority list for this build. |
| Impale | 2 points | **Full** |  |
| Cruelty | 5 points | **Full** |  |
| Unbridled Wrath | 5 points | **Full** |  |
| Blood Craze | 3 points | **Partial** | The total and the six seconds come from the source; the TICK CADENCE does not. Nothing states it, so it uses the three ticks Classic has, as a flagged placeholder. The amount healed is unaffected -- what a wrong cadence moves is when inside those six seconds it arrives, which matters only when a fight is close. |
| Boundless Rage | 2 points | **Full** |  |
| Dual Wield Specialization | 5 points | **Full** |  |
| Raging Blows | 1 point | **Full** |  |
| Enrage | 5 points | **Inert** | Triggers off being hit, and the target never swings here. |
| Death Wish | 1 point | **Full** |  |
| Flurry | 5 points | **Full** |  |
| Bloodthirst | 1 point | **Full** |  |

### Gear

| | | | |
| --- | --- | --- | --- |
| Striker's Mark | ranged | **Full** |  |
| Jaws of Might | head | **Full** |  |
| Onyxia Tooth Pendant | neck | **Full** |  |
| Pauldrons of Might | shoulders | **Full** |  |
| Cape of the Black Baron | cloak | **Full** |  |
| Hauberk of Might | chest | **Full** |  |
| Armguards of Might | wrists | **Full** |  |
| Hands of Might | gloves | **Full** |  |
| Sash of Might | waist | **Full** |  |
| Leggings of Might | legs | **Full** |  |
| Treads of Might | feet | **Full** |  |
| Don Julio's Band | ring1 | **Full** |  |
| Quick Strike Ring | ring2 | **Full** |  |
| Blackhand's Breadth | trinket1 | **Full** |  |
| Hand of Justice | trinket2 | **Full** |  |
| Vis'kag the Bloodletter | mainHand | **Full** |  |
| Enchant Weapon - Crusader (enchant) | mainHand | **Full** |  |
| Brutality Blade | offHand | **Full** |  |
| Enchant Weapon - Crusader (enchant) | offHand | **Full** |  |

### Raid buffs

| | | | |
| --- | --- | --- | --- |
| Battle Shout | Warrior | **Full** |  |
| Thunder Clap | Warrior | **Full** |  |
| Sunder Armor | Warrior | **Full** |  |
| Power Word: Fortitude | Priest | **Full** |  |
| Divine Spirit | Priest | **Full** |  |
| Blessing of Kings | Paladin | **Full** |  |
| Blessing of Might | Paladin | **Full** |  |
| Faerie Fire | Druid | **Full** |  |
| Mark of the Wild | Druid | **Full** |  |
| Strength of Earth Totem | Shaman | **Full** |  |
| Windfury Totem | Shaman | **Full** |  |
| Leader of the Pack | Druid | **Full** |  |

### Rotation

| | | | |
| --- | --- | --- | --- |
| Battle Shout | battle_shout_cast | **Full** | Never cast in 12 fights, and never needed: its effect is already up. |
| Sunder Armor | sunder_armor_cast | **Full** |  |
| Death Wish | death_wish | **Full** |  |
| Execute | execute | **Full** |  |
| Heroic Strike | heroic_strike | **Full** |  |
| Bloodthirst | bloodthirst | **Full** |  |
| Whirlwind | whirlwind | **Full** |  |
| Bloodrage | bloodrage_cast | **Full** |  |

## Prot Warr

Tauren, shield, Defensive Stance, target swings back

**60 full, 2 partial, 4 inert** across 66 choices.


### Character

| | | | |
| --- | --- | --- | --- |
| Race | tauren | **Full** | Base stats come from the generated table; racials are not modelled for any race. |
| Combat style | one_hand_shield | **Full** | Decides which equipment slots resolve, which attack tables apply, and which rotation runs. |
| Stance | defensive | **Full** | Its aura is applied and its modifiers apply; it also selects the priority list. |
| Target attacks back | true | **Full** | Ramping damage, the assumed healer and deaths are all simulated. |

### Talents

| | | | |
| --- | --- | --- | --- |
| Improved Heroic Strike | 3 points | **Full** |  |
| Deflection | 5 points | **Full** |  |
| Improved Rend | 3 points | **Full** |  |
| Improved Charge | 1 point | **Inert** | Charge is in no priority list for this build. |
| Deep Wounds | 3 points | **Full** |  |
| Impale | 2 points | **Full** |  |
| Shield Specialization | 5 points | **Full** |  |
| Anticipation | 5 points | **Full** |  |
| Improved Bloodrage | 2 points | **Full** |  |
| Last Stand | 1 point | **Full** |  |
| Master of Defense | 2 points | **Partial** | The rage proc is implemented. Its "while a shield is equipped" condition is not -- a reaction cannot see the wearer gear -- so it would also fire for a Protection warrior holding two weapons. |
| Improved Revenge | 3 points | **Full** |  |
| Defiance | 3 points | **Inert** | Threat, which the engine does not track. |
| Vanguard | 1 point | **Inert** | Adds Defensive Stance to Charge, which no priority list casts and which cannot be used in combat -- and every fight here opens in it. |
| Improved Shield Wall | 2 points | **Full** |  |
| Concussion Blow | 1 point | **Inert** | Stuns the target for 5 sec. NOT TO BE IMPLEMENTED: the project owner classes stuns as non-combat, so this is out of scope rather than waiting on anything. The ability grant is still declared so the talent gates correctly. concussion_blow is in no priority list for this build. |
| Bastion | 5 points | **Full** |  |
| Focused Rage | 3 points | **Full** |  |
| Shield Slam | 1 point | **Full** |  |

### Gear

| | | | |
| --- | --- | --- | --- |
| Striker's Mark | ranged | **Full** |  |
| Jaws of Might | head | **Full** |  |
| Onyxia Tooth Pendant | neck | **Full** |  |
| Pauldrons of Might | shoulders | **Full** |  |
| Cape of the Black Baron | cloak | **Full** |  |
| Hauberk of Might | chest | **Full** |  |
| Armguards of Might | wrists | **Full** |  |
| Hands of Might | gloves | **Full** |  |
| Sash of Might | waist | **Full** |  |
| Leggings of Might | legs | **Full** |  |
| Treads of Might | feet | **Full** |  |
| Don Julio's Band | ring1 | **Full** |  |
| Quick Strike Ring | ring2 | **Full** |  |
| Blackhand's Breadth | trinket1 | **Full** |  |
| Hand of Justice | trinket2 | **Full** |  |
| Brutality Blade | mainHand | **Full** |  |
| Enchant Weapon - Crusader (enchant) | mainHand | **Full** |  |
| The Immovable Object | shield | **Full** |  |

### Raid buffs

| | | | |
| --- | --- | --- | --- |
| Battle Shout | Warrior | **Full** |  |
| Thunder Clap | Warrior | **Full** |  |
| Sunder Armor | Warrior | **Full** |  |
| Power Word: Fortitude | Priest | **Full** |  |
| Divine Spirit | Priest | **Full** |  |
| Blessing of Kings | Paladin | **Full** |  |
| Blessing of Might | Paladin | **Full** |  |
| Faerie Fire | Druid | **Full** |  |
| Mark of the Wild | Druid | **Full** |  |
| Strength of Earth Totem | Shaman | **Full** |  |
| Windfury Totem | Shaman | **Full** |  |
| Leader of the Pack | Druid | **Full** |  |

### Rotation

| | | | |
| --- | --- | --- | --- |
| Last Stand | last_stand | **Full** |  |
| Shield Wall | shield_wall_cast | **Full** |  |
| Bloodrage | bloodrage_cast | **Full** |  |
| Defensive Stance | defensive_stance_cast | **Full** | Never cast in 12 fights, and never needed: its effect is already up. |
| Battle Shout | battle_shout_cast | **Full** | Never cast in 12 fights, and never needed: its effect is already up. |
| Sunder Armor | sunder_armor_cast | **Full** |  |
| Demoralizing Shout | demoralizing_shout_cast | **Partial** | The -196 attack power lands, but the target has no attack power term: its swing damage is stated outright, not derived. Cast at full cost, for no reduction in damage taken. |
| Heroic Strike | heroic_strike | **Full** |  |
| Shield Block | shield_block_cast | **Full** |  |
| Shield Slam | shield_slam | **Full** |  |
| Revenge | revenge | **Full** |  |
| Thunder Clap | thunder_clap | **Full** |  |
| Rend | rend_cast | **Full** |  |
