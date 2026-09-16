/*
 * GENERATED FILE - do not edit by hand.
 *
 * Produced by tools/import_base_stats.py from WoWForeverBaseStats.xlsx.
 * Re-run the generator when the spreadsheet changes; editing this file
 * directly guarantees it drifts from the source of truth.
 */

import type { BaseStatVariant } from './baseStatTypes';
import type { ClassId, RaceId } from './ids';

export const BASE_STATS: Record<RaceId, Partial<Record<ClassId, readonly BaseStatVariant[]>>> = {
  human: {
    hunter: [
      { form: null, stats: { hitPoints: 1287, mana: 1440, strength: 57, agility: 121, stamina: 93, intellect: 64, spirit: 69, attackPower: 100, rangedAttackPower: 110, critChance: -1.53, spellCritChance: 4.66 } },
    ],
    mage: [
      { form: null, stats: { hitPoints: 1190, mana: 933, strength: 30, agility: 35, stamina: 45, intellect: 125, spirit: 132, attackPower: 0, rangedAttackPower: 0, critChance: 0, spellCritChance: 0.2 } },
    ],
    paladin: [
      { form: null, stats: { hitPoints: 1201, mana: 1232, strength: 105, agility: 65, stamina: 100, intellect: 70, spirit: 81, attackPower: 160, rangedAttackPower: 0, critChance: 0.65, spellCritChance: 3.37 } },
    ],
    priest: [
      { form: null, stats: { hitPoints: 1217, mana: 1096, strength: 35, agility: 40, stamina: 50, intellect: 120, spirit: 137, attackPower: 0, rangedAttackPower: 0, critChance: 0, spellCritChance: 0.8 } },
    ],
    rogue: [
      { form: null, stats: { hitPoints: 1343, mana: 0, strength: 80, agility: 130, stamina: 75, intellect: 35, spirit: 54, attackPower: 100, rangedAttackPower: 0, critChance: -0.29, spellCritChance: 0 } },
    ],
    warlock: [
      { form: null, stats: { hitPoints: 1234, mana: 1093, strength: 45, agility: 50, stamina: 65, intellect: 110, spirit: 126, attackPower: 0, rangedAttackPower: 0, critChance: 0, spellCritChance: 1.7 } },
    ],
    warrior: [
      { form: null, stats: { hitPoints: 1509, mana: 0, strength: 120, agility: 80, stamina: 110, intellect: 30, spirit: 49, attackPower: 160, rangedAttackPower: 0, critChance: 1.14, spellCritChance: 0 } },
    ],
  },
  dwarf: {
    hunter: [
      { form: null, stats: { hitPoints: 1287, mana: 1440, strength: 57, agility: 121, stamina: 93, intellect: 64, spirit: 69, attackPower: 100, rangedAttackPower: 110, critChance: -1.53, spellCritChance: 4.66 } },
    ],
    paladin: [
      { form: null, stats: { hitPoints: 1201, mana: 1232, strength: 107, agility: 61, stamina: 103, intellect: 69, spirit: 74, attackPower: 160, rangedAttackPower: 0, critChance: 0.65, spellCritChance: 3.37 } },
    ],
    priest: [
      { form: null, stats: { hitPoints: 1217, mana: 1096, strength: 37, agility: 36, stamina: 53, intellect: 119, spirit: 124, attackPower: 0, rangedAttackPower: 0, critChance: 0, spellCritChance: 0.8 } },
    ],
    rogue: [
      { form: null, stats: { hitPoints: 1343, mana: 0, strength: 82, agility: 126, stamina: 78, intellect: 34, spirit: 49, attackPower: 100, rangedAttackPower: 0, critChance: -0.29, spellCritChance: 0 } },
    ],
    shaman: [
      { form: null, stats: { hitPoints: 1100, mana: 1240, strength: 88, agility: 52, stamina: 97, intellect: 87, spirit: 103, attackPower: 100, rangedAttackPower: 0, critChance: 1.68, spellCritChance: 2.3 } },
    ],
    warrior: [
      { form: null, stats: { hitPoints: 1509, mana: 0, strength: 122, agility: 76, stamina: 113, intellect: 29, spirit: 44, attackPower: 160, rangedAttackPower: 0, critChance: 1.14, spellCritChance: 0 } },
    ],
  },
  night_elf: {
    druid: [
      { form: 'caster', stats: { hitPoints: 1303, mana: 964, strength: 62, agility: 65, stamina: 69, intellect: 100, spirit: 110, attackPower: -20, rangedAttackPower: 0, critChance: 0.96, spellCritChance: 1.85 } },
      { form: 'bear', stats: { hitPoints: 2543, mana: 0, strength: 62, agility: 65, stamina: 69, intellect: 100, spirit: 110, attackPower: 160, rangedAttackPower: 0, critChance: 0.96, spellCritChance: 1.85 } },
      { form: 'cat', stats: { hitPoints: 1303, mana: 0, strength: 62, agility: 65, stamina: 69, intellect: 100, spirit: 110, attackPower: 100, rangedAttackPower: 0, critChance: 0.96, spellCritChance: 1.85 } },
    ],
    hunter: [
      { form: null, stats: { hitPoints: 1287, mana: 1440, strength: 52, agility: 130, stamina: 89, intellect: 65, spirit: 70, attackPower: 100, rangedAttackPower: 110, critChance: -1.53, spellCritChance: 4.66 } },
    ],
    priest: [
      { form: null, stats: { hitPoints: 1217, mana: 1096, strength: 32, agility: 45, stamina: 49, intellect: 120, spirit: 125, attackPower: 0, rangedAttackPower: 0, critChance: 0, spellCritChance: 0.8 } },
    ],
    rogue: [
      { form: null, stats: { hitPoints: 1343, mana: 0, strength: 77, agility: 135, stamina: 74, intellect: 35, spirit: 50, attackPower: 100, rangedAttackPower: 0, critChance: -0.29, spellCritChance: 0 } },
    ],
    warrior: [
      { form: null, stats: { hitPoints: 1509, mana: 0, strength: 117, agility: 85, stamina: 109, intellect: 30, spirit: 45, attackPower: 160, rangedAttackPower: 0, critChance: 1.14, spellCritChance: 0 } },
    ],
  },
  gnome: {
    mage: [
      { form: null, stats: { hitPoints: 1190, mana: 933, strength: 25, agility: 38, stamina: 44, intellect: 139, spirit: 120, attackPower: 0, rangedAttackPower: 0, critChance: 0, spellCritChance: 0.2 } },
    ],
    priest: [
      { form: null, stats: { hitPoints: 1217, mana: 1096, strength: 35, agility: 40, stamina: 50, intellect: 120, spirit: 137, attackPower: 0, rangedAttackPower: 0, critChance: 0, spellCritChance: 0.8 } },
    ],
    rogue: [
      { form: null, stats: { hitPoints: 1343, mana: 0, strength: 75, agility: 133, stamina: 74, intellect: 42, spirit: 50, attackPower: 100, rangedAttackPower: 0, critChance: -0.29, spellCritChance: 0 } },
    ],
    warlock: [
      { form: null, stats: { hitPoints: 1234, mana: 1093, strength: 40, agility: 53, stamina: 64, intellect: 124, spirit: 115, attackPower: 0, rangedAttackPower: 0, critChance: 0, spellCritChance: 1.7 } },
    ],
    warrior: [
      { form: null, stats: { hitPoints: 1509, mana: 0, strength: 115, agility: 83, stamina: 109, intellect: 36, spirit: 45, attackPower: 160, rangedAttackPower: 0, critChance: 1.14, spellCritChance: 0 } },
    ],
  },
  high_order_skyborne: {
    druid: [
      { form: 'caster', stats: { hitPoints: 1303, mana: 964, strength: 62, agility: 65, stamina: 69, intellect: 100, spirit: 110, attackPower: -20, rangedAttackPower: 0, critChance: 0.96, spellCritChance: 1.85 } },
      { form: 'bear', stats: { hitPoints: 2543, mana: 0, strength: 62, agility: 65, stamina: 69, intellect: 100, spirit: 110, attackPower: 160, rangedAttackPower: 0, critChance: 0.96, spellCritChance: 1.85 } },
      { form: 'cat', stats: { hitPoints: 1303, mana: 0, strength: 62, agility: 65, stamina: 69, intellect: 100, spirit: 110, attackPower: 100, rangedAttackPower: 0, critChance: 0.96, spellCritChance: 1.85 } },
    ],
    hunter: [
      { form: null, stats: { hitPoints: 1287, mana: 1440, strength: 52, agility: 130, stamina: 89, intellect: 65, spirit: 70, attackPower: 100, rangedAttackPower: 110, critChance: -1.53, spellCritChance: 4.66 } },
    ],
    mage: [
      { form: null, stats: { hitPoints: 1190, mana: 933, strength: 30, agility: 35, stamina: 45, intellect: 125, spirit: 132, attackPower: 0, rangedAttackPower: 0, critChance: 0, spellCritChance: 0.2 } },
    ],
    rogue: [
      { form: null, stats: { hitPoints: 1343, mana: 0, strength: 80, agility: 130, stamina: 75, intellect: 35, spirit: 54, attackPower: 100, rangedAttackPower: 0, critChance: -0.29, spellCritChance: 0 } },
    ],
    warrior: [
      { form: null, stats: { hitPoints: 1509, mana: 0, strength: 120, agility: 80, stamina: 110, intellect: 30, spirit: 49, attackPower: 160, rangedAttackPower: 0, critChance: 1.14, spellCritChance: 0 } },
    ],
  },
  orc: {
    hunter: [
      { form: null, stats: { hitPoints: 1287, mana: 1440, strength: 58, agility: 122, stamina: 92, intellect: 62, spirit: 73, attackPower: 100, rangedAttackPower: 110, critChance: -1.53, spellCritChance: 4.66 } },
    ],
    mage: [
      { form: null, stats: { hitPoints: 1190, mana: 933, strength: 29, agility: 33, stamina: 46, intellect: 123, spirit: 125, attackPower: 0, rangedAttackPower: 0, critChance: 0, spellCritChance: 0.2 } },
    ],
    rogue: [
      { form: null, stats: { hitPoints: 1343, mana: 0, strength: 83, agility: 127, stamina: 77, intellect: 32, spirit: 53, attackPower: 100, rangedAttackPower: 0, critChance: -0.29, spellCritChance: 0 } },
    ],
    shaman: [
      { form: null, stats: { hitPoints: 1100, mana: 1240, strength: 88, agility: 52, stamina: 97, intellect: 87, spirit: 103, attackPower: 100, rangedAttackPower: 0, critChance: 1.68, spellCritChance: 2.3 } },
    ],
    warlock: [
      { form: null, stats: { hitPoints: 1234, mana: 1093, strength: 48, agility: 47, stamina: 66, intellect: 107, spirit: 118, attackPower: 0, rangedAttackPower: 0, critChance: 0, spellCritChance: 1.7 } },
    ],
    warrior: [
      { form: null, stats: { hitPoints: 1509, mana: 0, strength: 123, agility: 77, stamina: 112, intellect: 27, spirit: 48, attackPower: 160, rangedAttackPower: 0, critChance: 1.14, spellCritChance: 0 } },
    ],
  },
  undead: {
    mage: [
      { form: null, stats: { hitPoints: 1190, mana: 933, strength: 29, agility: 33, stamina: 46, intellect: 123, spirit: 125, attackPower: 0, rangedAttackPower: 0, critChance: 0, spellCritChance: 0.2 } },
    ],
    paladin: [
      { form: null, stats: { hitPoints: 1201, mana: 1232, strength: 105, agility: 65, stamina: 100, intellect: 70, spirit: 81, attackPower: 160, rangedAttackPower: 0, critChance: 0.65, spellCritChance: 3.37 } },
    ],
    priest: [
      { form: null, stats: { hitPoints: 1217, mana: 1096, strength: 34, agility: 38, stamina: 51, intellect: 118, spirit: 130, attackPower: 0, rangedAttackPower: 0, critChance: 0, spellCritChance: 0.8 } },
    ],
    rogue: [
      { form: null, stats: { hitPoints: 1343, mana: 0, strength: 79, agility: 128, stamina: 76, intellect: 33, spirit: 55, attackPower: 100, rangedAttackPower: 0, critChance: -0.29, spellCritChance: 0 } },
    ],
    warlock: [
      { form: null, stats: { hitPoints: 1234, mana: 1093, strength: 44, agility: 48, stamina: 66, intellect: 108, spirit: 120, attackPower: 0, rangedAttackPower: 0, critChance: 0, spellCritChance: 1.7 } },
    ],
    warrior: [
      { form: null, stats: { hitPoints: 1509, mana: 0, strength: 119, agility: 78, stamina: 111, intellect: 28, spirit: 50, attackPower: 160, rangedAttackPower: 0, critChance: 1.14, spellCritChance: 0 } },
    ],
  },
  tauren: {
    druid: [
      { form: 'caster', stats: { hitPoints: 1303, mana: 964, strength: 70, agility: 55, stamina: 72, intellect: 95, spirit: 112, attackPower: -36, rangedAttackPower: 0, critChance: 0.96, spellCritChance: 1.85 } },
      { form: 'bear', stats: { hitPoints: 2543, mana: 0, strength: 70, agility: 55, stamina: 72, intellect: 95, spirit: 112, attackPower: 160, rangedAttackPower: 0, critChance: 0.96, spellCritChance: 1.85 } },
      { form: 'cat', stats: { hitPoints: 1303, mana: 0, strength: 70, agility: 55, stamina: 72, intellect: 95, spirit: 112, attackPower: 100, rangedAttackPower: 0, critChance: 0.96, spellCritChance: 1.85 } },
    ],
    hunter: [
      { form: null, stats: { hitPoints: 1287, mana: 1440, strength: 60, agility: 120, stamina: 92, intellect: 60, spirit: 72, attackPower: 100, rangedAttackPower: 110, critChance: -1.53, spellCritChance: 4.66 } },
    ],
    shaman: [
      { form: null, stats: { hitPoints: 1100, mana: 1240, strength: 90, agility: 50, stamina: 97, intellect: 85, spirit: 102, attackPower: 100, rangedAttackPower: 0, critChance: 1.68, spellCritChance: 2.3 } },
    ],
    warrior: [
      { form: null, stats: { hitPoints: 1509, mana: 0, strength: 125, agility: 75, stamina: 112, intellect: 25, spirit: 47, attackPower: 160, rangedAttackPower: 0, critChance: 1.14, spellCritChance: 0 } },
    ],
  },
  troll: {
    hunter: [
      { form: null, stats: { hitPoints: 1287, mana: 1440, strength: 56, agility: 127, stamina: 91, intellect: 61, spirit: 71, attackPower: 100, rangedAttackPower: 110, critChance: -1.53, spellCritChance: 4.66 } },
    ],
    mage: [
      { form: null, stats: { hitPoints: 1190, mana: 933, strength: 31, agility: 37, stamina: 46, intellect: 121, spirit: 121, attackPower: 0, rangedAttackPower: 0, critChance: 0, spellCritChance: 0.2 } },
    ],
    priest: [
      { form: null, stats: { hitPoints: 1217, mana: 1096, strength: 36, agility: 42, stamina: 51, intellect: 116, spirit: 126, attackPower: 0, rangedAttackPower: 0, critChance: 0, spellCritChance: 0.8 } },
    ],
    rogue: [
      { form: null, stats: { hitPoints: 1343, mana: 0, strength: 81, agility: 132, stamina: 76, intellect: 31, spirit: 51, attackPower: 100, rangedAttackPower: 0, critChance: -0.29, spellCritChance: 0 } },
    ],
    shaman: [
      { form: null, stats: { hitPoints: 1100, mana: 1240, strength: 86, agility: 57, stamina: 96, intellect: 86, spirit: 101, attackPower: 100, rangedAttackPower: 0, critChance: 1.68, spellCritChance: 2.3 } },
    ],
    warlock: [
      { form: null, stats: { hitPoints: 1234, mana: 1093, strength: 48, agility: 47, stamina: 66, intellect: 107, spirit: 118, attackPower: 0, rangedAttackPower: 0, critChance: 0, spellCritChance: 1.7 } },
    ],
    warrior: [
      { form: null, stats: { hitPoints: 1509, mana: 0, strength: 121, agility: 82, stamina: 111, intellect: 26, spirit: 46, attackPower: 160, rangedAttackPower: 0, critChance: 1.14, spellCritChance: 0 } },
    ],
  },
  windshaper_skyborne: {
    druid: [
      { form: 'caster', stats: { hitPoints: 1303, mana: 964, strength: 62, agility: 65, stamina: 69, intellect: 100, spirit: 110, attackPower: -20, rangedAttackPower: 0, critChance: 0.96, spellCritChance: 1.85 } },
      { form: 'bear', stats: { hitPoints: 2543, mana: 0, strength: 62, agility: 65, stamina: 69, intellect: 100, spirit: 110, attackPower: 160, rangedAttackPower: 0, critChance: 0.96, spellCritChance: 1.85 } },
      { form: 'cat', stats: { hitPoints: 1303, mana: 0, strength: 62, agility: 65, stamina: 69, intellect: 100, spirit: 110, attackPower: 100, rangedAttackPower: 0, critChance: 0.96, spellCritChance: 1.85 } },
    ],
    hunter: [
      { form: null, stats: { hitPoints: 1287, mana: 1440, strength: 56, agility: 127, stamina: 91, intellect: 61, spirit: 71, attackPower: 100, rangedAttackPower: 110, critChance: -1.53, spellCritChance: 4.66 } },
    ],
    mage: [
      { form: null, stats: { hitPoints: 1190, mana: 933, strength: 29, agility: 33, stamina: 46, intellect: 123, spirit: 125, attackPower: 0, rangedAttackPower: 0, critChance: 0, spellCritChance: 0.2 } },
    ],
    rogue: [
      { form: null, stats: { hitPoints: 1343, mana: 0, strength: 83, agility: 127, stamina: 77, intellect: 32, spirit: 53, attackPower: 100, rangedAttackPower: 0, critChance: -0.29, spellCritChance: 0 } },
    ],
    shaman: [
      { form: null, stats: { hitPoints: 1100, mana: 1240, strength: 86, agility: 57, stamina: 96, intellect: 86, spirit: 101, attackPower: 100, rangedAttackPower: 0, critChance: 1.68, spellCritChance: 2.3 } },
    ],
    warrior: [
      { form: null, stats: { hitPoints: 1509, mana: 0, strength: 123, agility: 77, stamina: 112, intellect: 27, spirit: 48, attackPower: 160, rangedAttackPower: 0, critChance: 1.14, spellCritChance: 0 } },
    ],
  },
};
