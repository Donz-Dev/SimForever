import { RATING_PER_PERCENT, percent } from '../../engine';
import type { RaceId } from '../character';
import type { RacialDefinition, RacialTrait } from './Racial';

/**
 * What every race does, trait by trait, with the client's own text beside it.
 *
 * ============================================================================
 * THE SOURCES, AND WHICH ONE WINS.
 *
 * `talentsforever.com/racials.js` is the beta client's own file -- forty traits
 * across the ten races, each with its name, its tooltip and an icon -- and is
 * the source of record for the text here. The RULESET OWNER separately stated
 * the subset that "registers as a combat advantage", with details the client
 * does not carry, and where the two differ the owner wins. They differed in
 * four places, every one of them recorded at the line it changed:
 *
 *   Blood Fury       the owner adds RANGED attack power; the client says only
 *                    "Attack Power and Spell Power". Four of the seven Orc
 *                    presets are Hunters, so this is most of what it is worth.
 *   the global       the owner states which four of the five actives are off
 *   cooldown         the GCD and that Stoneform is not. The client says only
 *                    "Instant" for all five.
 *   pet crit         the owner adds that a weapon specialization's crit reaches
 *                    the pet. Nothing in the client says so.
 *   Touch of the     the owner's version is far longer and carries eight
 *   Grave            exclusions; the CLIENT adds a 1 sec internal cooldown the
 *                    owner does not mention, which is a silence rather than a
 *                    disagreement, so both are taken.
 *
 * ============================================================================
 * THE OWNER'S LIST IS THE SCOPE, AND THE OTHER TWENTY-FIVE TRAITS SAY SO.
 *
 * Asked directly whether to build the traits their list omits -- Orc's Shatter
 * Curse carries a -15% magic damage clause, Troll's Regeneration a health one,
 * Skyborne's Read Ley Line a mana one -- the owner ruled: their list is the
 * scope. So every other trait is declared `unmodelled` with its own reason,
 * because an inert effect that SAYS it is inert is the honest failure mode and
 * because a trait nobody declared is indistinguishable from one nobody noticed.
 *
 * A `scope` MEANS THE OWNER HAS RULED THE EFFECT OUT AND IT IS PERMANENT;
 * nothing means it is a live gap that expires when the engine gains something.
 * The split here is 22 ruled out and 3 live, and the three live ones are
 * exactly the three raised above -- so if the owner ever revisits them, the
 * census is already pointing at them rather than at a sentence in a commit.
 *
 * WHAT IS NOT GIVEN A SCOPE AND IS NOT A GAP EITHER: nothing. Underwater
 * Breathing and Find Treasure have no combat effect at all, and rather than
 * invent an `outOfCombat` member of `OutOfScope` -- which is a scope DECISION
 * and needs the owner -- they are declared as live gaps whose reason says in as
 * many words that there is nothing to model. That is one honest line in a
 * census of three rather than a new permanent category chosen by me.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// The numbers the owner stated, named once each.
//
// DECLARED BEFORE THE TRAITS THAT READ THEM, which is a requirement rather
// than a style: the trait objects below are module-level `const`s evaluated at
// import, so a constant declared after one of them is in its temporal dead zone
// and throws on load. Grouping them here is what makes that impossible.
// ---------------------------------------------------------------------------

/** "Increases your spellcasting, melee, and ranged Haste by 1%" for a Skyborne. */
export const SKYBORNE_HASTE_PERCENT = 1;
/**
 * The same, in rating.
 *
 * Through `RATING_PER_PERCENT.haste` rather than written as 170, the idiom Seal
 * of the Crusader, Nature's Grace, Flurry and the "+1% Haste" enchant already
 * share: `hasteMultiplierFrom` divides by the same constant, so one percent in
 * is exactly 1.01 out and the placeholder conversion moving cannot change what
 * this trait is worth.
 */
const SKYBORNE_HASTE_RATING = SKYBORNE_HASTE_PERCENT * RATING_PER_PERCENT.haste;

/** "+5% Spirit" for a Human. */
export const HUMAN_SPIRIT_PERCENT = 0.05;
/** "+2% Global Crit Chance from all sources" while holding a sword. */
export const SWORD_SPECIALIZATION_CRIT = 2;
/** "+1% Global Crit Chance from all sources" while holding a mace. */
export const MACE_SPECIALIZATION_CRIT = 1;
/** "+1% Global Crit Chance from all sources" while holding an axe. */
export const AXE_SPECIALIZATION_CRIT = 1;
/** "+1% Chance to Dodge" for a Night Elf. */
export const QUICKNESS_DODGE = 1;
/** "Total Health increased by 5%" for a Tauren. */
export const ENDURANCE_HEALTH_PERCENT = 0.05;
/** "chance to hit for melee, ranged, and spells increased by 1%". */
export const ENDURANCE_HIT = 1;
/** "Maximum Mana, Rage or Energy increased by 5%" for a Gnome. */
export const EXPANSIVE_MIND_PERCENT = 0.05;

// ---------------------------------------------------------------------------
// Shared traits. Three races carry Walk on Air and Elemental Insight.
// ---------------------------------------------------------------------------

/**
 * The two Skyborne races have four traits and share three of them.
 *
 * ONE DECLARATION EACH RATHER THAN TWO COPIES, the arrangement Crusader already
 * uses for its three weapon slots and `foreverEnchants` for "+8 Strength" on a
 * helmet and legs. Two copies would be two places to drift.
 */
const WALK_ON_AIR: RacialTrait = {
  id: 'walk_on_air',
  name: 'Walk on Air',
  text:
    'Instant, 2 min cooldown. Glide downward through the air for 10 sec while ' +
    'controlling your direction of travel.',
  effects: [
    {
      kind: 'unmodelled',
      text: 'Glide downward through the air for 10 sec.',
      reason: 'Movement, and there is no position model.',
      scope: 'positioning',
    },
  ],
};

const ELEMENTAL_INSIGHT: RacialTrait = {
  id: 'elemental_insight',
  name: 'Elemental Insight',
  text: 'Damage dealt versus Elementals increased by 5%.',
  effects: [
    {
      kind: 'unmodelled',
      text: 'Damage dealt versus Elementals increased by 5%.',
      /*
       * THE TARGET'S CAUSE, and it is the creature TYPE rather than its timing
       * -- the one shape of that cause this project has not met before. The
       * encounter is a raid boss with no declared type at all, so this is not
       * "the boss is not an Elemental" but "nothing in the engine asks".
       * Expires if the encounter ever declares one.
       */
      reason:
        'The encounter target has no creature type, so nothing can ask whether ' +
        'it is an Elemental. Beast Slaying and Big Game Hunter are the same ' +
        'clause on two other races.',
    },
  ],
};

const WIND_BLESSED: RacialTrait = {
  id: 'wind_blessed',
  name: 'Wind Blessed',
  text: 'Increases your spellcasting, melee, and ranged Haste by 1%.',
  effects: [
    {
      kind: 'stat',
      /*
       * ONE POINT OF HASTE, AND IT REACHES ALL THREE THINGS THE TOOLTIP NAMES
       * WITHOUT ANY CODE SAYING SO.
       *
       * `hasteRating` through `RATING_PER_PERCENT.haste` is the idiom the "+1%
       * Haste" armour enchant already uses, and the owner's statement about
       * that enchant covers this word for word: haste here reaches cast speed,
       * melee auto-attack speed and ranged auto-attack speed, all three off the
       * one multiplier `applyHaste` reads. It does NOT reach the global
       * cooldown, which is the engine's rule rather than this trait's.
       */
      stats: { hasteRating: SKYBORNE_HASTE_RATING },
    },
  ],
};

/**
 * A weapon specialization's crit, as the two stats "all sources" means.
 *
 * ============================================================================
 * "GLOBAL CRIT CHANCE FROM ALL SOURCES" IS TWO STATS, which is the reading
 * sixty-two item lines saying "with all spells and attacks" already take:
 * `critChance` and `spellCritChance` are read by SEPARATE tables, so granting
 * only the first would be right for every melee build and silently worth
 * nothing to a caster. It matters here -- all three Human Paladin presets hold
 * Azuresong Mageblade, a sword, and the Shockadin's damage is almost entirely
 * Holy spells.
 *
 * AND THE PET COMES FOR FREE, WHICH IS WHY IT IS A STAT.
 *
 * The owner's clause -- "This includes +2% for pet crit chance if you're
 * holding a sword" -- needs no code: `createPet` reads
 * `owner.stats.effective.critChance` and inherits ONE HUNDRED PERCENT of it, so
 * a stat on the Hunter is already on its pet. That is the opposite of the bow
 * enchant's "+2% Crit Chance", which the owner ruled must NOT reach the pet and
 * which therefore had to be `attackTableModifiers` instead. The two clauses
 * point opposite ways and the engine already draws the line in the right
 * place -- so the thing to get right was choosing a STAT, and a test asserts
 * the pet's crit actually moves rather than trusting this paragraph.
 * ============================================================================
 */
function weaponSpecialization(
  id: string,
  name: string,
  text: string,
  crit: number,
  weaponTypes: readonly ('sword' | 'mace' | 'axe')[],
): RacialTrait {
  return {
    id,
    name,
    text,
    effects: [
      {
        kind: 'stat',
        stats: { critChance: crit, spellCritChance: crit },
        // Two-handed and one-handed are the same `WeaponType` here, which is
        // what makes "a sword or two-handed sword" one entry: `twoHanded` is a
        // separate field and this trait does not read it.
        requires: { weaponTypes },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Alliance
// ---------------------------------------------------------------------------

const HUMAN: RacialDefinition = {
  race: 'human',
  traits: [
    weaponSpecialization(
      'sword_specialization',
      'Sword Specialization',
      'Increases your critical strike chance with all spells and attacks by 2% ' +
        'while you have a sword or two-handed sword equipped.',
      SWORD_SPECIALIZATION_CRIT,
      ['sword'],
    ),
    {
      id: 'the_human_spirit',
      name: 'The Human Spirit',
      text: 'Spirit increased by 5%.',
      effects: [
        {
          kind: 'statPercent',
          /*
           * A MODIFIER RATHER THAN A FLAT NUMBER, for the reason every
           * percentage talent is one: stats are base plus modifiers and derived
           * values are a function over them, so a percentage folded into a flat
           * figure at build time freezes against the unbuffed stat. A Human
           * drinking an Elixir of Spirit should get 5% of the bigger number.
           */
          modifiers: [percent('spirit', HUMAN_SPIRIT_PERCENT)],
        },
      ],
    },
    {
      id: 'perception',
      name: 'Perception',
      text: 'Instant, 3 min cooldown. Dramatically increases stealth detection for 20 sec.',
      effects: [
        {
          kind: 'unmodelled',
          text: 'Dramatically increases stealth detection for 20 sec.',
          reason: 'Detecting stealth, which is the ruled-out concept from the other side.',
          scope: 'stealth',
        },
      ],
    },
    {
      id: 'will_to_survive',
      name: 'Will to Survive',
      text: 'Instant, 3 min cooldown. Instantly removes all Stun effects.',
      effects: [
        {
          kind: 'unmodelled',
          text: 'Instantly removes all Stun effects.',
          reason: 'Removing a stun, which `crowdControl` covers in its own words.',
          scope: 'crowdControl',
        },
      ],
    },
  ],
};

const DWARF: RacialDefinition = {
  race: 'dwarf',
  traits: [
    {
      id: 'find_treasure',
      name: 'Find Treasure',
      text:
        'Instant. Allows the dwarf to sense nearby treasure, making it appear on ' +
        'the minimap. Lasts until canceled.',
      effects: [
        {
          kind: 'unmodelled',
          text: 'Sense nearby treasure, making it appear on the minimap.',
          /*
           * NO SCOPE, AND NOT BECAUSE IT MIGHT ONE DAY WORK. There is no
           * `OutOfScope` member for "this is not a combat effect at all", and
           * adding one is a scope DECISION that needs the owner rather than a
           * judgement made while writing a race. So it is declared as a live
           * entry whose reason says plainly that there is nothing here -- one
           * honest line in a census, rather than a new permanent category.
           */
          reason:
            'Not a combat effect in any sense: it marks a minimap. There is no ' +
            'OutOfScope member for "not combat" and adding one needs the owner.',
        },
      ],
    },
    {
      id: 'stoneform',
      name: 'Stoneform',
      text:
        'Instant, 3 min cooldown. Instantly removes and grants immunity to all ' +
        'Bleed, Poison, and Disease effects, and reduces all Physical damage taken ' +
        'by 10% for 8 sec.',
      effects: [
        { kind: 'grantAbility', abilityId: 'stoneform' },
        {
          kind: 'unmodelled',
          text: 'Instantly removes and grants immunity to all Bleed, Poison, and Disease effects.',
          /*
           * THE EXPIRING CLAUSE IS THE ONE THAT IS MODELLED, so this entry
           * carries only the permanent half. Splitting a compound reason is
           * this project's own rule -- three Paladin talents carried "threat,
           * AND no profile casts Righteous Fury" and a reader checking the true
           * clause stopped there.
           */
          reason: 'Removing and resisting a poison or disease, from both sides of `dispel`.',
          scope: 'dispel',
        },
      ],
    },
    weaponSpecialization(
      'mace_specialization',
      'Mace Specialization',
      'Increases your critical strike chance with all spells and attacks by 1% ' +
        'while you have a mace or two-handed mace equipped.',
      MACE_SPECIALIZATION_CRIT,
      ['mace'],
    ),
    {
      id: 'big_game_hunter',
      name: 'Big Game Hunter',
      text: 'Damage dealt versus Beasts increased by 5%.',
      effects: [
        {
          kind: 'unmodelled',
          text: 'Damage dealt versus Beasts increased by 5%.',
          reason:
            'The encounter target has no creature type, so nothing can ask whether ' +
            'it is a Beast. Beast Slaying and Elemental Insight are the same clause.',
        },
      ],
    },
  ],
};

const NIGHT_ELF: RacialDefinition = {
  race: 'night_elf',
  traits: [
    {
      id: 'shadowmeld',
      name: 'Shadowmeld',
      text:
        'Instant, 10 sec cooldown. Activate to slip into the shadows, reducing the ' +
        'chance for enemies to detect your presence. Lasts until cancelled or upon ' +
        'moving. Using this ability in combat discourages enemies from attacking ' +
        'you, but increases the cooldown to 2 min.',
      effects: [
        {
          kind: 'unmodelled',
          text: 'Slip into the shadows, reducing the chance for enemies to detect you.',
          reason: 'Being stealthed, which is the ruled-out concept itself.',
          scope: 'stealth',
        },
        {
          kind: 'unmodelled',
          text: 'Using this ability in combat discourages enemies from attacking you.',
          reason: 'Threat, which is not tracked.',
          scope: 'threat',
        },
      ],
    },
    {
      id: 'quickness',
      name: 'Quickness',
      text:
        'Dodge chance increased by 1% and movement speed increased by 2%. Night Elf ' +
        'Rogues and Druids are harder to detect in Stealth as if they were 1 level higher.',
      effects: [
        { kind: 'stat', stats: { dodgeChance: QUICKNESS_DODGE } },
        {
          kind: 'unmodelled',
          text: 'Movement speed increased by 2%.',
          reason: 'Movement, and there is no position model.',
          scope: 'positioning',
        },
        {
          kind: 'unmodelled',
          text: 'Rogues and Druids are harder to detect in Stealth as if they were 1 level higher.',
          reason: 'Being detected while stealthed.',
          scope: 'stealth',
        },
      ],
    },
    {
      id: 'wisp_spirit',
      name: 'Wisp Spirit',
      text: 'Transform into a wisp upon death, increasing movement speed by 75%.',
      effects: [
        {
          kind: 'unmodelled',
          text: 'Transform into a wisp upon death, increasing movement speed by 75%.',
          reason: 'Movement speed, while dead. There is no position model either way.',
          scope: 'positioning',
        },
      ],
    },
    {
      id: 'elunes_light',
      name: "Elune's Light",
      text:
        'Instant, 3 min cooldown. Increases your critical strike chance with all ' +
        'spells and attacks by 10% for 15 sec.',
      effects: [{ kind: 'grantAbility', abilityId: 'elunes_light' }],
    },
  ],
};

const GNOME: RacialDefinition = {
  race: 'gnome',
  traits: [
    {
      id: 'escape_artist',
      name: 'Escape Artist',
      text:
        'Instant, 2 min cooldown. Instantly escape the effects of any movement ' +
        'impairing effect and gain immunity to those effects for 3 sec.',
      effects: [
        {
          kind: 'unmodelled',
          text: 'Escape any movement impairing effect and gain immunity for 3 sec.',
          reason: 'Escaping and resisting a snare, which `crowdControl` names.',
          scope: 'crowdControl',
        },
      ],
    },
    {
      id: 'expansive_mind',
      name: 'Expansive Mind',
      text: 'Maximum Mana, Rage or Energy increased by 5%, whichever your class uses.',
      effects: [
        {
          kind: 'resourceMaxPercent',
          /*
           * ALL THREE NAMED, AND COMBO POINTS AND SOUL SHARDS DELIBERATELY NOT.
           *
           * "Whichever your class uses" is satisfied by naming the three and
           * scaling whichever pools exist -- a Gnome Priest has mana, a Rogue
           * energy, a Warrior rage, and each gets the one it has. A Gnome
           * Warlock has mana AND soul shards and gets only the mana, which is
           * the point of listing rather than scaling every pool: a 5% bigger
           * shard pool is 10.5 shards, and a Rogue with a 5.25 combo point cap
           * would change what every finisher can spend.
           *
           * NO CLASS OWNS TWO OF THESE THREE except the Druid, which a Gnome
           * cannot be -- so "whichever" never has to choose. Said out loud
           * because if Forever ever gave Gnomes the Druid, this would silently
           * raise all three.
           */
          resources: ['mana', 'rage', 'energy'],
          percent: EXPANSIVE_MIND_PERCENT,
        },
      ],
    },
    {
      id: 'engineering_specialization',
      name: 'Engineering Specialization',
      text:
        'Your gnomish ingenuity reduces the rate of engineering devices failing or ' +
        'backfiring when you use them by 20%.',
      effects: [
        {
          kind: 'unmodelled',
          text: 'Reduces the rate of engineering devices failing or backfiring by 20%.',
          reason:
            'There are no engineering devices, and no profession model to put one in. ' +
            'Not a combat effect; see Find Treasure on why it carries no scope.',
        },
      ],
    },
    {
      id: 'eureka',
      name: 'Eureka!',
      text:
        'Instant, 2 min cooldown. Your next 3 non-periodic damaging abilities cost ' +
        '10% less (Mana, Rage or Energy) and deal 10% more damage. Periodic effects ' +
        'get nothing from it; a channeled spell is not periodic.',
      effects: [{ kind: 'grantAbility', abilityId: 'eureka' }],
    },
  ],
};

const HIGH_ORDER_SKYBORNE: RacialDefinition = {
  race: 'high_order_skyborne',
  traits: [
    WALK_ON_AIR,
    {
      id: 'read_ley_line',
      name: 'Read Ley Line',
      text:
        '2 sec cast, 2 min cooldown. Attempt to tap into the power of a nearby ley ' +
        'line, increasing your Health and Mana regeneration by 100%. Lasts 15 sec if ' +
        'no ley line is nearby, and 15 min if one is found.',
      effects: [
        {
          kind: 'unmodelled',
          text: 'Increasing your Health and Mana regeneration by 100% for 15 sec.',
          /*
           * A LIVE GAP AND NOT A RULING, and the distinction is this project's
           * own: mana RETURN is explicitly not out of scope, because it changes
           * a damage profile's sustain. `resourceRegenMultiplier` would express
           * it exactly -- all three regeneration rules go through
           * `regenMultiplierFor` now.
           *
           * It is here rather than built because the owner ruled their list is
           * the scope, so this entry is where the question lives. No preset is
           * Skyborne, so it is worth 0.0 either way today.
           */
          reason:
            'Mana return is not out of scope and `resourceRegenMultiplier` would ' +
            'express it. Omitted from the owner\'s list of combat-relevant racials, ' +
            'so it is a question for them rather than an engine gap.',
        },
      ],
    },
    ELEMENTAL_INSIGHT,
    WIND_BLESSED,
  ],
};

// ---------------------------------------------------------------------------
// Horde
// ---------------------------------------------------------------------------

const ORC: RacialDefinition = {
  race: 'orc',
  traits: [
    {
      id: 'blood_fury',
      name: 'Blood Fury',
      text:
        'Instant, 2 min cooldown. Increases Attack Power and Spell Power by 10% for 15 sec.',
      effects: [{ kind: 'grantAbility', abilityId: 'blood_fury' }],
    },
    {
      id: 'hardiness',
      name: 'Hardiness',
      text: 'Duration of Stun effects on you reduced by 20%.',
      effects: [
        {
          kind: 'unmodelled',
          text: 'Duration of Stun effects on you reduced by 20%.',
          reason: 'Stun duration, and nothing stuns the character.',
          scope: 'crowdControl',
        },
      ],
    },
    weaponSpecialization(
      'axe_specialization',
      'Axe Specialization',
      'Increases your critical strike chance with all spells and abilities by 1% ' +
        'while you have an axe or a two-handed axe equipped.',
      AXE_SPECIALIZATION_CRIT,
      ['axe'],
    ),
    {
      id: 'shatter_curse',
      name: 'Shatter Curse',
      text:
        'Instant, 3 min cooldown. Instantly removes and grants immunity to all Curses ' +
        'and Banes, and reduces all Magical damage taken by 15% for 8 sec.',
      effects: [
        {
          kind: 'unmodelled',
          text: 'Instantly removes and grants immunity to all Curses and Banes.',
          reason: 'Removing and resisting a curse, which is `dispel` from both sides.',
          scope: 'dispel',
        },
        {
          kind: 'unmodelled',
          text: 'Reduces all Magical damage taken by 15% for 8 sec.',
          /*
           * THE LIVE HALF, AND THE REASON SAYS WHOSE DECISION IT IS.
           *
           * This is Stoneform's clause pointing at the other four schools, and
           * Stoneform IS built -- `damageTakenBySchool` would express it with
           * no engine work at all. It is absent only because the owner ruled
           * their list is the scope, and it was raised by name when they ruled.
           *
           * Worth 0.0 to every preset today: the encounter deals physical
           * damage only, so even Stoneform's modelled half is measured on its
           * mechanism rather than on DPS.
           */
          reason:
            'Expressible today as `damageTakenBySchool` over the four magic schools, ' +
            'exactly as Stoneform does for physical. Omitted from the owner\'s list ' +
            'of combat-relevant racials, so it is a question for them.',
        },
      ],
    },
  ],
};

const UNDEAD: RacialDefinition = {
  race: 'undead',
  traits: [
    {
      id: 'underwater_breathing',
      name: 'Underwater Breathing',
      text: 'Underwater breath lasts 300% longer than normal.',
      effects: [
        {
          kind: 'unmodelled',
          text: 'Underwater breath lasts 300% longer than normal.',
          reason:
            'There is no water and no breath. Not a combat effect; see Find Treasure ' +
            'on why it carries no scope.',
        },
      ],
    },
    {
      id: 'will_of_the_forsaken',
      name: 'Will of the Forsaken',
      text: 'Instant, 2 min cooldown. Instantly removes all Charm, Fear and Sleep effects.',
      effects: [
        {
          kind: 'unmodelled',
          text: 'Instantly removes all Charm, Fear and Sleep effects.',
          reason: 'Removing a fear or a charm, which `crowdControl` covers in its own words.',
          scope: 'crowdControl',
        },
      ],
    },
    {
      id: 'cannibalize',
      name: 'Cannibalize',
      text:
        '5 yd range, Instant, 2 min cooldown. When activated, regenerates 7% of total ' +
        'Health and 7% of total Mana every 2 sec for 10 sec. Only works on Humanoid or ' +
        'Undead corpses within 5 yds. Any movement, action, or damage taken while ' +
        'Cannibalizing will cancel the effect.',
      effects: [
        {
          kind: 'unmodelled',
          text: 'Regenerates 7% of total Health and 7% of total Mana every 2 sec for 10 sec.',
          /*
           * BLOCKED TWICE, which is this project's own test for a ruling rather
           * than a gap: it needs a CORPSE within five yards, and it is
           * cancelled by any action or damage taken -- so a character in a
           * fight could never channel it even if the corpse existed. Clearing
           * either blocker alone leaves it inert.
           *
           * `healing` is the scope that fits the larger clause. Its mana half
           * would be a live gap on its own, which is why the reason says so.
           */
          reason:
            'Needs a corpse in range AND is cancelled by any action or damage taken, ' +
            'so nothing in a fight could ever channel it. Its mana half would ' +
            'otherwise be a live gap.',
          scope: 'healing',
        },
      ],
    },
    {
      id: 'touch_of_the_grave',
      name: 'Touch of the Grave',
      text:
        'Your spells and attacks with a damage part have a chance (10% for casters, ' +
        '5% for melee) to drain Health from the target, up to 5% of your maximum ' +
        'Health. 1 sec internal cooldown. Does not break crowd control.',
      effects: [
        { kind: 'reaction', reaction: 'touch_of_the_grave' },
        {
          kind: 'unmodelled',
          text: 'Does not break crowd control.',
          reason: 'Nothing is crowd controlled, so nothing can be broken.',
          scope: 'crowdControl',
        },
      ],
    },
  ],
};

const TAUREN: RacialDefinition = {
  race: 'tauren',
  traits: [
    {
      id: 'war_stomp',
      name: 'War Stomp',
      text: '0.5 sec cast, 2 min cooldown. Stuns up to 5 enemies within 8 yds for 2 sec.',
      effects: [
        {
          kind: 'unmodelled',
          text: 'Stuns up to 5 enemies within 8 yds for 2 sec.',
          reason: 'A stun, and in a radius. Either clause alone would rule it out.',
          scope: 'crowdControl',
        },
      ],
    },
    {
      id: 'endurance',
      name: 'Endurance',
      text: 'Total Health increased by 5% and chance to hit increased by 1%.',
      effects: [
        { kind: 'healthPercent', percent: ENDURANCE_HEALTH_PERCENT },
        {
          kind: 'stat',
          /*
           * ONE STAT FOR ALL THREE KINDS OF HIT, which is not a simplification.
           *
           * The owner's wording is "melee, ranged, and spells" and `hitChance`
           * is exactly that: `attackChances` folds the character-wide stat into
           * the melee, ranged AND spell branches, and the only hit this engine
           * scopes more narrowly is a SCHOOL-scoped `hitBonus` on a modifier
           * and an off-hand-only bonus per slot. Neither is what this is.
           *
           * AND IT IS WORTH NOTHING TO MOST TAUREN PRESETS, which is correct
           * rather than a bug. The usable melee and ranged hit cap is 8 and
           * there is no miss floor, so a build already at the cap collects
           * nothing -- and the Prot Warrior, the Cat and the Bear are all
           * there. Check hit against the cap before reading a 0.0 here as a
           * failure to apply.
           */
          stats: { hitChance: ENDURANCE_HIT },
        },
      ],
    },
    {
      id: 'cultivation',
      name: 'Cultivation',
      text:
        'Instant. Cultivate a nearby herb, growing a duplicate you can harvest without ' +
        'requiring Herbalism skill. Each herb may only be cultivated once. In play it ' +
        'goes on a 1 hour cooldown, though its tooltip shows none.',
      effects: [
        {
          kind: 'unmodelled',
          text: 'Cultivate a nearby herb, growing a duplicate you can harvest.',
          reason:
            'There are no herbs and no gathering. Not a combat effect; see Find ' +
            'Treasure on why it carries no scope.',
        },
      ],
    },
    {
      id: 'plainsrunning',
      name: 'Plainsrunning',
      text:
        'Gain 1% increased movement speed every 5 sec spent moving, up to a maximum of ' +
        '30% increase. Taking damage or standing still will reduce this effect.',
      effects: [
        {
          kind: 'unmodelled',
          text: 'Gain 1% increased movement speed every 5 sec spent moving, up to 30%.',
          reason: 'Movement, and there is no position model.',
          scope: 'positioning',
        },
      ],
    },
  ],
};

const TROLL: RacialDefinition = {
  race: 'troll',
  traits: [
    {
      id: 'berserking',
      name: 'Berserking',
      text:
        'Instant, 3 min cooldown. Increases your spellcasting and attack speed by 10% ' +
        'for 10 sec.',
      effects: [{ kind: 'grantAbility', abilityId: 'berserking' }],
    },
    {
      id: 'regeneration',
      name: 'Regeneration',
      text:
        'Health regeneration rate increased by 10%. In addition, 10% of total Health ' +
        'regeneration will continue during combat.',
      effects: [
        {
          kind: 'unmodelled',
          text:
            'Health regeneration rate increased by 10%, and 10% of it continues during ' +
            'combat.',
          /*
           * A LIVE GAP, NOT A RULING, and the difference is the same one mana
           * return turns on: health regeneration IN COMBAT changes how long a
           * tank survives, which this project measures as a death count. The
           * engine has no out-of-combat health regeneration at all, so the
           * first clause has nothing to scale and the second has no source.
           *
           * Omitted from the owner's list and raised by name when they ruled.
           * Worth 0.0 today whichever way: neither tank preset is a Troll.
           */
          reason:
            'Nothing regenerates health outside the assumed healer, so there is no ' +
            'rate to raise. Omitted from the owner\'s list of combat-relevant ' +
            'racials, so it is a question for them.',
        },
      ],
    },
    {
      id: 'beast_slaying',
      name: 'Beast Slaying',
      text: 'Damage dealt versus Beasts increased by 5%.',
      effects: [
        {
          kind: 'unmodelled',
          text: 'Damage dealt versus Beasts increased by 5%.',
          reason:
            'The encounter target has no creature type, so nothing can ask whether ' +
            'it is a Beast. Big Game Hunter and Elemental Insight are the same clause.',
        },
      ],
    },
    {
      id: 'rapid_regeneration',
      name: 'Rapid Regeneration',
      text:
        'Channeled, 3 min cooldown. Regenerate 50% of your maximum Health over 6 sec. ' +
        'Any movement, action, or damage taken will cancel the effect.',
      effects: [
        {
          kind: 'unmodelled',
          text: 'Regenerate 50% of your maximum Health over 6 sec.',
          reason:
            'Healing throughput, AND cancelled by any action or damage taken, so ' +
            'nothing in a fight could channel it.',
          scope: 'healing',
        },
      ],
    },
  ],
};

const WINDSHAPER_SKYBORNE: RacialDefinition = {
  race: 'windshaper_skyborne',
  traits: [
    WALK_ON_AIR,
    {
      id: 'skysight',
      name: 'Skysight',
      text:
        '0.5 sec cast, 2 min cooldown. Attempt to draw power from a convergence of ' +
        'elements and receive its blessing, increasing your movement and mounted ' +
        'movement speeds by 10%. Lasts 30 sec if no elemental convergence is nearby, ' +
        'and 15 min if one is found.',
      effects: [
        {
          kind: 'unmodelled',
          text: 'Increasing your movement and mounted movement speeds by 10%.',
          reason: 'Movement, and there is no position model.',
          scope: 'positioning',
        },
      ],
    },
    ELEMENTAL_INSIGHT,
    WIND_BLESSED,
  ],
};

/**
 * Every race's traits, by race id.
 *
 * ALL TEN ARE PRESENT, including the three no preset uses. A race absent here
 * would be a character with no racials at all and nothing to say so -- the
 * shape that let `lone_wolf` go the whole project unregistered -- so
 * `racials.test.ts` asserts this record covers `RACE_IDS` exactly.
 */
export const RACIALS: Readonly<Record<RaceId, RacialDefinition>> = {
  human: HUMAN,
  dwarf: DWARF,
  night_elf: NIGHT_ELF,
  gnome: GNOME,
  high_order_skyborne: HIGH_ORDER_SKYBORNE,
  orc: ORC,
  undead: UNDEAD,
  tauren: TAUREN,
  troll: TROLL,
  windshaper_skyborne: WINDSHAPER_SKYBORNE,
};

/** A race's traits, for the UI and for the census. */
export function racialsFor(race: RaceId): readonly RacialTrait[] {
  return RACIALS[race].traits;
}
