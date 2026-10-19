/*
 * ==============================================================================
 * THE TIER SWEEP AS A PAGE: three line charts across the four benchmark gear
 * levels -- DPS for every non-tank profile, and threat and damage taken per
 * second for the tanks. Dark, in the app's own Forge colours, one line per
 * profile in its class colour, labels at the right end.
 *
 * Normally written by `tools/tier_sweep.ts` with `HTML=`. On its own it
 * re-renders a saved sweep without re-running it:
 *
 *   IN=sweep.json OUT=sweep.html npx vite-node tools/tier_sweep_chart.ts
 * ==============================================================================
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PRESETS_BY_ID } from '../src/profiles';

export interface TierSweepRow {
  readonly id: string;
  readonly name: string;
  readonly tank: boolean;
  readonly levels: Record<string, { dps: number; tps: number; dtps: number }>;
}

export interface TierSweep {
  readonly iterations: number;
  readonly rows: readonly TierSweepRow[];
}

/** The whole page, ready to publish. */
export function renderTierSweepPage(input: TierSweep): string {
  const rows = input.rows.map((row) => ({
    ...row,
    cls: PRESETS_BY_ID.get(row.id)!.build().character.characterClass,
  }));

  const data = JSON.stringify({ iterations: input.iterations, rows });

  const html = `<title>Gear Tier Sweep</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: one column of three full-width line charts, each with its own header strip. */
:root {
  color-scheme: dark;
  --floor: #050b0d;
  --panel: #132428;
  --panel-bar: #1d353b;
  --well: #0a1518;
  --rule: #2e4b54;
  --grid: #16282d;
  --text: #f2fafb;
  --muted: #879ca0;
  --copper: #d98a5f;
  --copper-bright: #f2a97d;
  --font-label: 'Barlow Condensed', 'Arial Narrow', system-ui, sans-serif;
  --font-data: 'IBM Plex Mono', ui-monospace, Consolas, monospace;
}
body { background: var(--floor); color: var(--text); font-family: var(--font-label); }
main {
  max-width: 1280px; margin: 0 auto; display: grid; gap: 24px;
  padding-block: 24px 48px;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
}
header.page { display: grid; gap: 4px; }
header.page h1 { margin: 0; font-size: 30px; font-weight: 700; letter-spacing: .04em; color: var(--copper-bright); text-wrap: balance; }
header.page p { margin: 0; font-size: 16px; color: var(--muted); }
section.chart { background: var(--panel); border: 1px solid var(--rule); border-radius: 8px; overflow: hidden; }
section.chart > h2 {
  margin: 0; padding: 10px 16px; background: var(--panel-bar); border-left: 3px solid var(--copper);
  font-size: 15px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--copper-bright);
}
section.chart > h2 span { color: var(--muted); font-weight: 500; text-transform: none; letter-spacing: .02em; margin-left: 8px; }
.plot { overflow-x: auto; background: var(--well); }
.plot svg { display: block; width: 100%; min-width: 760px; height: auto; }
.plot text { font-family: var(--font-label); }
.axis { fill: var(--muted); font-size: 13px; font-family: var(--font-data) !important; }
.tier { fill: var(--muted); font-size: 15px; font-weight: 600; }
.grid { stroke: var(--grid); stroke-width: 1; }
.line { fill: none; stroke-width: 2; transition: opacity .15s; }
.dot { stroke: var(--well); stroke-width: 1; }
.label { font-size: 14px; font-weight: 600; cursor: default; }
.leader { stroke-width: .8; fill: none; opacity: .7; }
.series { cursor: pointer; }
.plot.focus .series { opacity: .15; }
.plot.focus .series.on { opacity: 1; }
.series.on .line { stroke-width: 3.2; }
.value { font-family: var(--font-data) !important; font-size: 12px; fill: var(--text); paint-order: stroke; stroke: var(--well); stroke-width: 4px; }
.note { font-size: 13px; color: var(--muted); padding: 8px 16px 12px; margin: 0; font-family: var(--font-data); }
@media (prefers-reduced-motion: reduce) { .line { transition: none; } }
</style>

<main>
  <header class="page">
    <h1>Gear Tier Sweep</h1>
    <p id="meta"></p>
  </header>
  <section class="chart"><h2>DPS by gear tier <span>non-tank profiles</span></h2><div class="plot" id="c1"></div></section>
  <section class="chart"><h2>Threat per second <span>tank profiles</span></h2><div class="plot" id="c2"></div></section>
  <section class="chart"><h2>Damage taken per second <span>tank profiles</span></h2><div class="plot" id="c3"></div></section>
</main>

<script>
const DATA = ${data};
const TIERS = [['B55', 'Pre-BiS'], ['E65', 'Tier 1'], ['E75', 'Tier 2'], ['E85', 'Tier 3']];
const CLASS_COLOR = {
  warrior: '#c69b6d', paladin: '#f48cba', hunter: '#aad372', rogue: '#fff468', priest: '#ffffff',
  shaman: '#2f8ef0', mage: '#3fc7eb', warlock: '#8788ee', druid: '#ff7c0a',
};
const DASHES = ['', '7 4', '2 3', '10 3 2 3', '4 2', '1 2'];

document.getElementById('meta').textContent =
  DATA.rows.length + ' profiles at four benchmark gear levels, ' + DATA.iterations +
  ' fights each, 60-second fights. Hover a line to see its values.';

function chart(el, rows, metric, unit) {
  const W = 1240, H = 640, L = 64, R = 200, T = 24, B = 48;
  const vals = rows.flatMap((r) => TIERS.map(([t]) => r.levels[t][metric]));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || 1;
  const step = [10, 20, 25, 50, 100, 200, 250, 500, 1000].find((s) => span / s <= 10) || 1000;
  lo = Math.floor((lo - span * 0.03) / step) * step;
  hi = Math.ceil((hi + span * 0.03) / step) * step;
  const x = (i) => L + (i * (W - L - R)) / (TIERS.length - 1);
  const y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.setAttribute('role', 'img');
  const add = (parent, tag, attrs, text) => {
    const n = document.createElementNS(ns, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text !== undefined) n.textContent = text;
    parent.appendChild(n);
    return n;
  };
  for (let v = lo; v <= hi + 1e-9; v += step) {
    add(svg, 'line', { class: 'grid', x1: L, x2: W - R, y1: y(v), y2: y(v) });
    add(svg, 'text', { class: 'axis', x: L - 10, y: y(v) + 4, 'text-anchor': 'end' }, String(v));
  }
  TIERS.forEach(([, name], i) => {
    add(svg, 'line', { class: 'grid', x1: x(i), x2: x(i), y1: T, y2: H - B });
    add(svg, 'text', { class: 'tier', x: x(i), y: H - B + 28, 'text-anchor': 'middle' }, name);
  });

  const perClass = {};
  const series = rows.map((r) => {
    const n = (perClass[r.cls] = (perClass[r.cls] ?? -1) + 1);
    return { r, color: CLASS_COLOR[r.cls] || '#cccccc', dash: DASHES[n % DASHES.length], end: r.levels.E85[metric] };
  });
  // End labels, spaced so none overlap: sorted by value, pushed down then back up.
  const order = [...series].sort((a, b) => b.end - a.end);
  const gap = 19;
  let prev = -Infinity;
  for (const s of order) { s.ly = Math.max(y(s.end), prev + gap); prev = s.ly; }
  const overflow = prev - (H - B);
  if (overflow > 0) for (let i = order.length - 1, limit = H - B; i >= 0; i--) {
    order[i].ly = Math.min(order[i].ly, limit); limit = order[i].ly - gap;
  }

  for (const s of series) {
    const g = add(svg, 'g', { class: 'series' });
    const pts = TIERS.map(([t], i) => x(i) + ',' + y(s.r.levels[t][metric]));
    add(g, 'polyline', { class: 'line', points: pts.join(' '), stroke: s.color, 'stroke-dasharray': s.dash });
    TIERS.forEach(([t], i) => add(g, 'circle', { class: 'dot', cx: x(i), cy: y(s.r.levels[t][metric]), r: 3.5, fill: s.color }));
    const ex = x(TIERS.length - 1);
    add(g, 'path', { class: 'leader', d: 'M' + ex + ',' + y(s.end) + ' H' + (ex + 14) + ' L' + (ex + 24) + ',' + s.ly + ' H' + (ex + 32), stroke: s.color });
    add(g, 'text', { class: 'label', x: ex + 36, y: s.ly + 5, fill: s.color }, s.r.name);
    TIERS.forEach(([t], i) => {
      const v = s.r.levels[t][metric];
      add(g, 'text', { class: 'value', x: x(i), y: y(v) - 10, 'text-anchor': i === 0 ? 'start' : i === 3 ? 'end' : 'middle', visibility: 'hidden' }, v.toFixed(1));
    });
    g.addEventListener('mouseenter', () => {
      el.classList.add('focus'); g.classList.add('on');
      g.querySelectorAll('.value').forEach((v) => v.setAttribute('visibility', 'visible'));
      g.parentNode.appendChild(g);
    });
    g.addEventListener('mouseleave', () => {
      el.classList.remove('focus'); g.classList.remove('on');
      g.querySelectorAll('.value').forEach((v) => v.setAttribute('visibility', 'hidden'));
    });
  }
  add(svg, 'title', {}, unit + ' by gear tier');
  el.appendChild(svg);
}

const dps = DATA.rows.filter((r) => !r.tank);
const tanks = DATA.rows.filter((r) => r.tank);
chart(document.getElementById('c1'), dps, 'dps', 'DPS');
chart(document.getElementById('c2'), tanks, 'tps', 'Threat per second');
chart(document.getElementById('c3'), tanks, 'dtps', 'Damage taken per second');
</script>
`;
  return html;
}

if (process.env.IN && process.env.OUT) {
  const sweep = JSON.parse(readFileSync(process.env.IN, 'utf8')) as TierSweep;
  writeFileSync(process.env.OUT, renderTierSweepPage(sweep));
  console.log(`Wrote ${process.env.OUT} for ${sweep.rows.length} profiles`);
}
