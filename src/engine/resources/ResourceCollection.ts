import { Resource } from './Resource';
import type { ResourceType } from './Resource';

/** A resource pool to create, as declared by a class or profile. */
export interface ResourceSpec {
  type: ResourceType;
  maximum: number;
  /** Starting value. Defaults to full. Rage-like resources start at 0. */
  initial?: number;
}

/**
 * The set of resource pools a combatant owns.
 *
 * A combatant may have several at once (a druid with mana, energy and combo
 * points), so abilities look their cost up by type rather than assuming a
 * single "the resource".
 */
export class ResourceCollection {
  private readonly pools = new Map<ResourceType, Resource>();

  constructor(specs: readonly ResourceSpec[] = []) {
    for (const spec of specs) {
      this.add(spec);
    }
  }

  add(spec: ResourceSpec): Resource {
    const resource = new Resource(spec.type, spec.maximum, spec.initial ?? spec.maximum);
    this.pools.set(spec.type, resource);
    return resource;
  }

  /** The pool of this type, or undefined if the combatant does not have one. */
  get(type: ResourceType): Resource | undefined {
    return this.pools.get(type);
  }

  /**
   * The pool of this type, throwing if absent. Use when a missing pool means a
   * content bug (an ability costing a resource its class does not have).
   */
  require(type: ResourceType): Resource {
    const resource = this.pools.get(type);
    if (!resource) {
      throw new Error(`Combatant has no "${type}" resource`);
    }
    return resource;
  }

  has(type: ResourceType): boolean {
    return this.pools.has(type);
  }

  /** True if the pool exists and holds at least `amount`. */
  canAfford(type: ResourceType, amount: number): boolean {
    const resource = this.pools.get(type);
    return resource !== undefined && resource.has(amount);
  }

  get all(): readonly Resource[] {
    return [...this.pools.values()];
  }

  get types(): readonly ResourceType[] {
    return [...this.pools.keys()];
  }
}
