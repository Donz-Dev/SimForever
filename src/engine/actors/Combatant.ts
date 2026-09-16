import type { Ability } from '../abilities/Ability';
import { AbilityBook } from '../abilities/AbilityBook';
import type { DamageSchool } from '../combat/DamageSchool';
import { AuraCollection } from '../effects';
import type { ResourceSpec, ResourceType } from '../resources';
import { Resource, ResourceCollection } from '../resources';
import type { Rotation } from '../rotation/Rotation';
import type { PartialStats, StatDerivation } from '../stats';
import { StatBlock } from '../stats';
import type { Milliseconds } from '../time';

/**
 * What kind of thing this combatant is.
 *
 * The simulation loop treats all of them identically; the kind exists so that
 * analysis can separate player output from pet output, and so that targeting
 * rules can eventually distinguish "an enemy" from "an add".
 */
export type CombatantKind = 'player' | 'enemy' | 'pet' | 'summon';

/** Who this combatant fights. Targeting uses this, not the kind. */
export type Faction = 'friendly' | 'hostile';

/** Where a weapon sits. Which of these swing is decided by the auto-attack mode. */
export type WeaponSlot = 'mainHand' | 'offHand' | 'ranged';

/**
 * Which weapons auto-attack.
 *
 * - `none`       nothing swings (casters)
 * - `main-hand`  the main hand only (two-handers, sword and board, bear, cat)
 * - `dual-wield` both hands, on independent timers
 * - `ranged`     the ranged weapon only
 */
export type AutoAttackMode = 'none' | 'main-hand' | 'dual-wield' | 'ranged';

/**
 * A weapon's auto-attack behaviour.
 *
 * Auto attacks are off the global cooldown and repeat on their own timer, so
 * they are not modelled as abilities. The numbers are content; the swing timer
 * scheduling is in `engine/combat/autoAttack.ts`.
 */
export interface WeaponProfile {
  readonly name: string;
  /** Unhasted time between swings. */
  readonly swingTimerMs: Milliseconds;
  /** Average damage per swing before attack power. */
  readonly baseDamage: number;
  /** Damage rolls uniformly within this fraction of base. 0.15 is +/-15%. */
  readonly damageVariance?: number;
  /** Attack power contribution per swing. */
  readonly powerCoefficient?: number;
  /**
   * Multiplies this weapon's entire auto-attack, base damage and attack power
   * contribution alike. Defaults to 1.
   *
   * Exists for the dual-wield off-hand penalty, which is a property of the hand
   * rather than of the weapon in it. Talents that change that penalty adjust
   * this value when the character is built.
   */
  readonly damageMultiplier?: number;
  readonly school?: DamageSchool;
  /** Resource generated per landed swing, if any. */
  readonly generates?: { resource: ResourceType; amount: number };
}

export interface CombatantOptions {
  readonly id: string;
  readonly name: string;
  readonly kind: CombatantKind;
  readonly faction: Faction;
  readonly maxHealth: number;
  readonly stats?: PartialStats;
  readonly resources?: readonly ResourceSpec[];
  readonly abilities?: readonly Ability[];
  readonly rotation?: Rotation;
  /** Weapons by slot. Which ones swing is decided by `autoAttack`. */
  readonly weapons?: Partial<Record<WeaponSlot, WeaponProfile>>;
  /** Defaults to `none`: a combatant with no declared mode does not swing. */
  readonly autoAttack?: AutoAttackMode;
  /**
   * Turns primary stats into the secondary stats they produce, re-run whenever
   * a buff changes a primary stat. The conversion numbers are class content, so
   * the engine takes a function rather than knowing them.
   */
  readonly statDerivation?: StatDerivation;
  /** For pets and summons: the id of the combatant that owns them. */
  readonly ownerId?: string;
}

/**
 * Anything that participates in combat: a player, a boss, a pet, an add.
 *
 * There is one class rather than a Player/Enemy hierarchy, because every
 * difference between them turned out to be data (a rotation, a weapon, a
 * faction) rather than behaviour. The simulation holds a flat collection of
 * these, which is what lets the same engine run 1v1 and a 20-player raid
 * without a second code path.
 */
export class Combatant {
  readonly id: string;
  readonly name: string;
  readonly kind: CombatantKind;
  readonly faction: Faction;
  readonly ownerId: string | undefined;

  readonly stats: StatBlock;
  readonly health: Resource;
  readonly resources: ResourceCollection;
  readonly auras: AuraCollection;
  readonly abilities: AbilityBook;
  readonly rotation: Rotation | undefined;
  readonly weapons: Partial<Record<WeaponSlot, WeaponProfile>>;
  readonly autoAttack: AutoAttackMode;

  /**
   * When this combatant's global cooldown ends. Shared across abilities, which
   * is why it lives here rather than on any one of them.
   */
  gcdReadyAt: Milliseconds = 0;

  /** When the current cast finishes, or 0 when not casting. */
  castEndsAt: Milliseconds = 0;

  private alive = true;

  constructor(options: CombatantOptions) {
    this.id = options.id;
    this.name = options.name;
    this.kind = options.kind;
    this.faction = options.faction;
    this.ownerId = options.ownerId;

    this.stats = new StatBlock(options.stats, options.statDerivation);
    this.health = new Resource('health', options.maxHealth);
    this.resources = new ResourceCollection(options.resources ?? []);
    this.auras = new AuraCollection(this);
    this.abilities = new AbilityBook(options.abilities ?? []);
    this.rotation = options.rotation;
    this.weapons = options.weapons ?? {};
    this.autoAttack = options.autoAttack ?? 'none';
  }

  get isAlive(): boolean {
    return this.alive && !this.health.isEmpty;
  }

  /**
   * True once the simulation has run this combatant's death handling.
   *
   * Distinct from `!isAlive`, which is also true in the instant between health
   * hitting zero and the death being processed. The simulation uses this to
   * make killing idempotent.
   */
  get isDeathProcessed(): boolean {
    return !this.alive;
  }

  get isPlayerControlled(): boolean {
    return this.kind === 'player' || this.kind === 'pet' || this.kind === 'summon';
  }

  isHostileTo(other: Combatant): boolean {
    return this.faction !== other.faction;
  }

  isCasting(now: Milliseconds): boolean {
    return this.castEndsAt > now;
  }

  isOnGcd(now: Milliseconds): boolean {
    return this.gcdReadyAt > now;
  }

  /**
   * Multiplies damage this combatant deals. The product of every active aura
   * that declares one.
   *
   * Recomputed on each hit rather than cached: aura sets are small, and a stale
   * cached multiplier is a far nastier bug than a few extra multiplications.
   */
  get damageDoneMultiplier(): number {
    return this.auraMultiplier('damageDoneMultiplier');
  }

  /** Multiplies damage this combatant takes. */
  get damageTakenMultiplier(): number {
    return this.auraMultiplier('damageTakenMultiplier');
  }

  /** Multiplies healing this combatant does. */
  get healingDoneMultiplier(): number {
    return this.auraMultiplier('healingDoneMultiplier');
  }

  /** Mark as dead. Called by the simulation, not directly by content. */
  markDead(): void {
    this.alive = false;
    this.health.set(0);
  }

  private auraMultiplier(
    key: 'damageDoneMultiplier' | 'damageTakenMultiplier' | 'healingDoneMultiplier',
  ): number {
    let product = 1;
    for (const aura of this.auras.active) {
      const value = aura.definition[key];
      if (value !== undefined) {
        product *= value ** (aura.definition.modifiersScaleWithStacks ? aura.stacks : 1);
      }
    }
    return product;
  }
}
