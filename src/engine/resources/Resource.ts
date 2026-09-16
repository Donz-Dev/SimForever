/**
 * The resource types the engine can track.
 *
 * Health is deliberately a resource like any other: it has a current value, a
 * maximum, and the same spend/gain rules. Treating it separately would mean
 * writing clamping and overflow logic twice.
 */
export const RESOURCE_TYPES = [
  'health',
  'mana',
  'rage',
  'energy',
  'focus',
  'runicPower',
  'holyPower',
  'comboPoints',
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

/** The outcome of a gain, so callers can report the wasted portion. */
export interface ResourceGainResult {
  /** How much actually landed. */
  gained: number;
  /** How much was lost to the cap. */
  wasted: number;
}

/**
 * A single pool: current value, maximum, and the rules for changing it.
 *
 * Deliberately dumb. It knows nothing about regeneration rates, ability costs
 * or combat; those live in the systems that own them. This keeps one copy of
 * the clamping rules for every resource in the game.
 */
export class Resource {
  private currentValue: number;
  private maximumValue: number;

  constructor(
    public readonly type: ResourceType,
    maximum: number,
    initial: number = maximum,
  ) {
    this.maximumValue = Math.max(0, maximum);
    this.currentValue = clamp(initial, 0, this.maximumValue);
  }

  get current(): number {
    return this.currentValue;
  }

  get maximum(): number {
    return this.maximumValue;
  }

  /** How far below the cap this pool currently sits. */
  get deficit(): number {
    return this.maximumValue - this.currentValue;
  }

  /** Fraction of maximum, in [0, 1]. Returns 0 when maximum is 0. */
  get fraction(): number {
    return this.maximumValue === 0 ? 0 : this.currentValue / this.maximumValue;
  }

  get isEmpty(): boolean {
    return this.currentValue <= 0;
  }

  get isFull(): boolean {
    return this.currentValue >= this.maximumValue;
  }

  /** True if the pool holds at least `amount`. */
  has(amount: number): boolean {
    return this.currentValue >= amount;
  }

  /**
   * Remove `amount` if it is available. Returns false and changes nothing if
   * it is not: resources are all-or-nothing, since a half-paid ability cost is
   * never correct.
   */
  spend(amount: number): boolean {
    if (amount < 0) throw new RangeError(`Cannot spend a negative amount: ${amount}`);
    if (!this.has(amount)) return false;
    this.currentValue -= amount;
    return true;
  }

  /** Add `amount`, clamped to the maximum. Reports any overflow. */
  gain(amount: number): ResourceGainResult {
    if (amount < 0) throw new RangeError(`Cannot gain a negative amount: ${amount}`);
    const before = this.currentValue;
    this.currentValue = Math.min(this.maximumValue, before + amount);
    const gained = this.currentValue - before;
    return { gained, wasted: amount - gained };
  }

  /**
   * Subtract without the availability check, flooring at zero. This is how
   * damage reduces health: it is allowed to take a pool below what it holds,
   * and the excess is reported as overkill by the damage system.
   */
  drain(amount: number): number {
    const before = this.currentValue;
    this.currentValue = Math.max(0, before - amount);
    return before - this.currentValue;
  }

  set(value: number): void {
    this.currentValue = clamp(value, 0, this.maximumValue);
  }

  /** Change the cap, keeping the current value within it. */
  setMaximum(value: number): void {
    this.maximumValue = Math.max(0, value);
    this.currentValue = Math.min(this.currentValue, this.maximumValue);
  }

  fill(): void {
    this.currentValue = this.maximumValue;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
