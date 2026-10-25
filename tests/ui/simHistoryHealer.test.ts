import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { BatchResult } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import type { SimHistoryEntry } from '../../src/ui/simHistory';
import { historyFigure } from '../../src/ui/simHistory';
import { SimHistoryPanel } from '../../src/ui/panels/SimHistoryPanel';

/*
 * A HEALER RUN'S ROW SHOWS ITS TWO HPS (round 74), the owner's "[Tank Healing
 * HPS] | [Raid Healing HPS] in green text". A healer deals no damage, so the
 * DPS it used to show was always 0.0.
 */
const batch = (dps: number, hps: number) =>
  ({ dps: { mean: dps }, hps: { mean: hps }, tps: { mean: 100 }, iterations: 50 }) as unknown as BatchResult;

function entry(healer: boolean): SimHistoryEntry {
  return {
    id: 1,
    finishedAt: 0,
    profile: PRESETS_BY_ID.get(healer ? 'priest_disc' : 'two_hand_arms')!.build(),
    batch: batch(healer ? 0 : 868.6, 578.8),
    ...(healer ? { healer: { tank: batch(0, 578.84), raid: batch(0, 1110.61) } } : {}),
  };
}

describe('Sim History', () => {
  it('shows a healer run as tank healer HPS | raid healer HPS', () => {
    expect(historyFigure(entry(true))).toEqual({ text: '578.8 | 1110.6', healing: true });
  });

  it('shows a damage run as its DPS, as before', () => {
    expect(historyFigure(entry(false))).toEqual({ text: '868.6', healing: false });
  });

  it('draws the healer figure with the green class and the damage figure without it', () => {
    const healer = renderToStaticMarkup(createElement(SimHistoryPanel, { history: [entry(true)], onRestore: () => undefined }));
    expect(healer).toContain('sim-history-dps sim-history-hps');
    expect(healer).toContain('578.8 | 1110.6');
    const damage = renderToStaticMarkup(createElement(SimHistoryPanel, { history: [entry(false)], onRestore: () => undefined }));
    expect(damage).not.toContain('sim-history-hps');
    expect(damage).toContain('868.6');
  });
});
