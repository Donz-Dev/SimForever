import { describe, expect, it } from 'vitest';
import { MutableSimulationClock, formatTimestamp, seconds, toSeconds } from '../../src/engine';

describe('MutableSimulationClock', () => {
  it('starts at zero', () => {
    expect(new MutableSimulationClock().now()).toBe(0);
  });

  it('jumps straight to a timestamp', () => {
    const clock = new MutableSimulationClock();
    clock.advanceTo(1500);
    expect(clock.now()).toBe(1500);
    clock.advanceTo(90_000);
    expect(clock.now()).toBe(90_000);
  });

  it('allows advancing to the current time', () => {
    const clock = new MutableSimulationClock();
    clock.advanceTo(1000);
    clock.advanceTo(1000);
    expect(clock.now()).toBe(1000);
  });

  it('refuses to move backwards', () => {
    // Silently accepting this would corrupt every duration in the fight, so it
    // throws rather than clamping.
    const clock = new MutableSimulationClock();
    clock.advanceTo(5000);
    expect(() => clock.advanceTo(4999)).toThrow(/backwards/);
  });

  it('resets to zero', () => {
    const clock = new MutableSimulationClock();
    clock.advanceTo(5000);
    clock.reset();
    expect(clock.now()).toBe(0);
  });
});

describe('time conversion', () => {
  it('converts seconds to whole milliseconds', () => {
    expect(seconds(1)).toBe(1000);
    expect(seconds(1.5)).toBe(1500);
    expect(seconds(0.001)).toBe(1);
  });

  it('round-trips', () => {
    expect(toSeconds(seconds(12.5))).toBe(12.5);
  });
});

describe('formatTimestamp', () => {
  it('formats as MM:SS.mmm', () => {
    expect(formatTimestamp(0)).toBe('00:00.000');
    expect(formatTimestamp(1500)).toBe('00:01.500');
    expect(formatTimestamp(65_250)).toBe('01:05.250');
    expect(formatTimestamp(600_000)).toBe('10:00.000');
  });
});
