import type { CastReaction, Reaction } from '../../engine';
import { isWeaponUse } from '../../engine';
import { naturesGraceAura } from '../auras/druid';
import { awardComboPoint } from '../combat/comboPoints';
import type { TalentReactionBuilder } from './warriorTalents';

/**
 * Druid talent procs.
 *
 * ----------------------------------------------------------------------------
 * THE HEADER HERE USED TO SAY "one, so far", and gave as the reason that "most
 * of the Feral tree's reactive clauses need the target to swing back --
 * Natural Reaction's rage on dodge, Furor's rage on shifting -- and the three
 * profiles face a standing target."
 *
 * HALF OF THAT WAS NEVER TRUE AND THE OTHER HALF STILL IS. The Bear profile
 * sets `targetAttacks: true` -- it is the one Druid build that is hit back,
 * and the preset says so in its own comment -- so Natural Reaction's dodge
 * proc has had something to fire on for as long as that profile has existed.
 * Furor genuinely cannot fire, because it pays out ON THE SHIFT and a form is
 * fixed at creation.
 *
 * A reason that blames the ENCOUNTER is worth checking against the encounter.
 * ----------------------------------------------------------------------------
 */

/**
 * Blood Frenzy's RAGE half: "a 100% chance to gain an additional 5 Rage any time
 * you get a critical strike while in Bear Form or Dire Bear Form".
 *
 * ----------------------------------------------------------------------------
 * THE FORM CONDITION IS GATED AT THE BUILD, and the comment that used to sit
 * here said it did not need to be: "rage is the Bear's resource, and
 * `grantResource` finds no pool on a Cat or a Moonkin and ignores the grant.
 * The condition enforces itself."
 *
 * THAT WAS FALSE. Every Druid owns every pool in every form -- this project's
 * own test says so, "owns every pool in every form, so shifting conjures
 * nothing" -- so a Cat was gaining 100 rage a fight from this and wasting 62%
 * of it. Harmless to its damage, because a Cat has nothing to spend rage on,
 * and wrong on the resource panel, which is an APL tool somebody reads.
 *
 * The talent's effect entry carries `requires: { styles: ['bear'] }` now, which
 * is where a form condition belongs: knowable once, at build time.
 * ----------------------------------------------------------------------------
 */
export const BLOOD_FRENZY_RAGE = 5;

export const bloodFrenzy = (chancePercent: number): Reaction => ({
  id: 'blood_frenzy',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (context) => context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    context.grantResource(actor, 'rage', BLOOD_FRENZY_RAGE, {
      id: 'blood_frenzy',
      name: 'Blood Frenzy',
    });
  },
});

/**
 * Blood Frenzy's COMBO POINT half: "your non-periodic critical strikes from Cat
 * Form abilities that generate Combo Points have a 100% chance to add an
 * additional Combo Point."
 *
 * ----------------------------------------------------------------------------
 * THE ROGUE'S SEAL FATE WEARING A DRUID'S NAME, and deliberately the same
 * shape: it reads `comboPointsAwarded` off the caster's OWN BOOK rather than
 * carrying a list of ability ids that would drift from the abilities. Shred,
 * Claw and Rake declare it; Rip and Ferocious Bite spend points rather than
 * building them and are correctly untouched.
 *
 * "NON-PERIODIC" IS GUARANTEED BY THE ENGINE rather than by a condition here:
 * `dealDamage` offers an attack to reactions only when
 * `request.attackTable && !request.periodic`, so a Rake TICK is never shown to
 * one. That matters for this talent specifically -- every DoT in Forever can
 * crit, so a Cat holding Rake and Rip up produces a stream of periodic crits,
 * and a reaction that saw them would print combo points for a bleed ticking.
 * Rake's INITIAL hit is a `melee-special` crit and does count, which is what
 * the owner asked for.
 *
 * THE CAT FORM CONDITION IS GATED AT THE BUILD, by the talent's own
 * `requires: { styles: ['cat'] }` -- unlike the rage half above, nothing about
 * a combo point pool would have enforced it, because a Bear owns one too.
 * ----------------------------------------------------------------------------
 */
export const bloodFrenzyComboPoint: TalentReactionBuilder = (chancePercent) => ({
  id: 'blood_frenzy_combo_point',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (context, actor, attack) => {
    if (!attack.abilityId) return false;
    const ability = actor.abilities.get(attack.abilityId);
    if (!ability?.comboPointsAwarded) return false;
    return context.rng.rollChance(chancePercent / 100);
  },
  onTrigger: (context, actor, attack) => {
    awardComboPoint(context, actor, attack.defender, 'blood_frenzy', 'Blood Frenzy');
  },
});

/**
 * Nature's Grace: "All NON-PERIODIC spell criticals grace you with a blessing
 * of nature, increasing your spellcasting speed and reducing your global
 * cooldown by 10% for 3 sec."
 *
 * ----------------------------------------------------------------------------
 * "NON-PERIODIC" IS ALREADY GUARANTEED, AND BY THE ENGINE RATHER THAN BY THIS
 * CONDITION. `dealDamage` offers an attack to reactions only when
 * `request.attackTable && !request.periodic`, so a damage-over-time tick is
 * never shown to one at all.
 *
 * That is worth writing down rather than relying on: every DoT in Forever can
 * crit, so a Moonkin holding Moonfire and Insect Swarm up produces a stream of
 * periodic crits, and a reaction that DID see them would keep this buff up for
 * most of a fight off an effect the tooltip explicitly excludes. A test pins
 * the exclusion so the guarantee cannot quietly move.
 *
 * A SPELL CRIT, so weapon uses are out as well: the same shape Elemental
 * Devastation has on the Shaman, which is the other spell-crit-grants-an-aura
 * talent in the project.
 * ----------------------------------------------------------------------------
 */
export const naturesGrace: TalentReactionBuilder = (percentValue) => ({
  id: 'natures_grace',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (_context, _actor, attack) => !isWeaponUse(attack),
  onTrigger: (context, actor) => {
    context.applyAura(actor, naturesGraceAura(percentValue), actor.id);
  },
});

/**
 * Natural Reaction: "increases your dodge chance by 5%, and gives you a 100%
 * chance to gain 5 Rage each time you dodge."
 *
 * ----------------------------------------------------------------------------
 * ON ATTACKS TAKEN, so it needs something to be attacking the player -- and on
 * this class something is. The Bear profile is the project's second
 * `targetAttacks` build after the Protection Warrior, and the rage it earns
 * from being hit is most of what fills its bar.
 *
 * THE RAGE IS A CONSTANT AND THE CHANCE IS NOT. Every rank grants 5, and the
 * chance climbs 20/40/60/80/100 -- values index 2 and index 1 of the talent's
 * row, which is why the effect passes `valueIndex: 1`. Named here rather than
 * read, exactly as `MASTER_OF_DEFENSE_RAGE` is on the Warrior's equivalent.
 *
 * The dodge half is an ordinary `stat` effect and is not this.
 * ----------------------------------------------------------------------------
 */
export const NATURAL_REACTION_RAGE = 5;

export const naturalReaction: TalentReactionBuilder = (chancePercent) => ({
  id: 'natural_reaction',
  on: 'taken',
  outcomes: ['dodge'],
  canTrigger: (context) => context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    context.grantResource(actor, 'rage', NATURAL_REACTION_RAGE, {
      id: 'natural_reaction',
      name: 'Natural Reaction',
    });
  },
});

/*
 * KING OF THE JUNGLE WAS A CAST REACTION HERE AND IS GONE, with Tiger's Fury,
 * the one ability it named. Removed at client build 1.60.1.70170.
 *
 * ITS NOTE IS WORTH KEEPING EVEN THOUGH THE REACTION IS NOT, because the point
 * it made outlived it: `runCastReactions` skips any reaction whose `abilityId`
 * does not match, so a cast reaction NAMES its ability rather than checking for
 * it in the body -- a condition inside would do the same work later and be one
 * more thing to get wrong. The Mage and the Rogue both still rely on that.
 *
 * SHIFTING POWER, WHICH REPLACED IT, NEEDS NO REACTION AT ALL: the energy is the
 * ability's own effect rather than a talent's addition to somebody else's, so it
 * lives in `SHIFTING_POWER.onCast`. A talent that ADDS to an existing ability is
 * a cast reaction; a talent that GRANTS an ability is a grant.
 *
 * THE DRUID NOW HAS NO CAST REACTIONS, and `DRUID_CAST_REACTIONS` is kept as an
 * empty table rather than deleted: `talentBuild.ts` registers it by class, and
 * a class missing from that registry fails silently -- see CLAUDE.md, "A CLASS
 * IS REGISTERED IN FOUR PLACES AND MISSING ANY ONE IS SILENT".
 */

export const DRUID_TALENT_REACTIONS: Readonly<Record<string, TalentReactionBuilder>> = {
  blood_frenzy: bloodFrenzy,
  blood_frenzy_combo_point: bloodFrenzyComboPoint,
  nature_s_grace: naturesGrace,
  natural_reaction: naturalReaction,
};

export const DRUID_CAST_REACTIONS: Readonly<Record<string, (value: number) => CastReaction>> = {};
