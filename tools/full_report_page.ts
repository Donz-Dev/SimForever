/*
 * ==============================================================================
 * THE FULL REPORT'S PAGE (round 78): `tools/full_report.ts`'s JSON as one HTML
 * page, three sortable tables -- DPS, tank and healer profiles -- each cell a
 * figure, its interval, a bar against the column's best, and the change from
 * the figures before this round's optimisation when the JSON carries them.
 *
 *   IN=report.json HTML=report.html npx vite-node tools/full_report_page.ts
 *   IN=report.json HTML=report.html NOTES=notes.json npx vite-node tools/full_report_page.ts
 *
 * NOTES is optional: `{ "build": "...", "summary": ["..."], "classes": { "warrior": "..." } }`,
 * the round's write-up, printed under the tables.
 *
 * The look is the app's own Forge scheme: copper on a dark teal well, Barlow
 * Condensed for labels and IBM Plex Mono for figures, as the tier sweep page was.
 * ==============================================================================
 */
import { readFileSync, writeFileSync } from 'node:fs';
import type { Report } from './fullReportColumns';
import { COMBAT_COLUMNS, HEALER_COLUMNS } from './fullReportColumns';

export interface ReportNotes {
  readonly build?: string;
  readonly summary?: readonly string[];
  readonly classes?: Readonly<Record<string, string>>;
}

export function renderReportPage(report: Report, notes: ReportNotes = {}): string {
  const data = JSON.stringify({ report, notes, combat: COMBAT_COLUMNS, healer: HEALER_COLUMNS }).replace(
    /</g,
    '\\u003c',
  );
  return `<title>Forever Profile Report</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: a single column of three role sections, each one wide sortable table in its own scroll well. */
:root {
  color-scheme: dark;
  --floor: #050b0d;
  --panel: #132428;
  --panel-bar: #1d353b;
  --well: #0a1518;
  --rule: #2e4b54;
  --text: #f2fafb;
  --muted: #879ca0;
  --copper: #d98a5f;
  --copper-bright: #f2a97d;
  --bar: #2a4a52;
  --bar-best: #8a5a3e;
  --up: #7fd39a;
  --down: #f08a7e;
  --font-label: 'Barlow Condensed', 'Arial Narrow', system-ui, sans-serif;
  --font-body: 'Barlow', system-ui, sans-serif;
  --font-data: 'IBM Plex Mono', ui-monospace, Consolas, monospace;
}
body { background: var(--floor); color: var(--text); font-family: var(--font-body); }
main {
  max-width: 1180px; margin: 0 auto; display: grid; gap: 28px;
  padding-block: 28px 56px;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
}
header.page { display: grid; gap: 6px; }
header.page h1 { margin: 0; font-family: var(--font-label); font-size: 34px; font-weight: 700; letter-spacing: .04em; color: var(--copper-bright); text-wrap: balance; }
header.page p { margin: 0; font-size: 15px; color: var(--muted); max-width: 70ch; line-height: 1.5; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 18px; font-family: var(--font-data); font-size: 12px; color: var(--muted); }
.legend b { color: var(--text); font-weight: 500; }
section.role { background: var(--panel); border: 1px solid var(--rule); border-radius: 8px; overflow: hidden; min-width: 0; }
section.role > h2 {
  margin: 0; padding: 10px 16px; background: var(--panel-bar); border-left: 3px solid var(--copper);
  font-family: var(--font-label); font-size: 16px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--copper-bright);
}
section.role > h2 span { color: var(--muted); font-weight: 500; text-transform: none; letter-spacing: .02em; margin-left: 8px; }
.well { overflow-x: auto; background: var(--well); }
table { border-collapse: collapse; width: 100%; min-width: 720px; font-variant-numeric: tabular-nums; }
th, td { padding: 8px 12px; text-align: right; border-bottom: 1px solid var(--panel-bar); }
th { font-family: var(--font-label); font-size: 14px; font-weight: 600; letter-spacing: .04em; color: var(--muted); white-space: nowrap; }
th button { all: unset; cursor: pointer; display: inline-flex; gap: 4px; align-items: center; }
th button:focus-visible { outline: 2px solid var(--copper); outline-offset: 3px; }
th button[aria-sort] { color: var(--copper-bright); }
th:first-child, td:first-child { text-align: left; }
td.name { font-family: var(--font-label); font-size: 16px; font-weight: 600; white-space: nowrap; }
td.name i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 9px; vertical-align: 1px; }
td.name small { display: block; font-family: var(--font-data); font-size: 11px; font-weight: 400; color: var(--muted); margin-left: 18px; }
.cell { display: grid; gap: 3px; justify-items: end; min-width: 120px; }
.fig { font-family: var(--font-data); font-size: 14px; }
.fig .pm { color: var(--muted); font-size: 11px; margin-left: 4px; }
.track { width: 100%; height: 4px; background: var(--panel-bar); border-radius: 2px; overflow: hidden; }
.track span { display: block; height: 100%; background: var(--bar); }
.track span.best { background: var(--bar-best); }
.delta { font-family: var(--font-data); font-size: 11px; color: var(--muted); }
.delta.up { color: var(--up); }
.delta.down { color: var(--down); }
tr:hover td { background: #0e1c20; }
.notes { display: grid; gap: 14px; background: var(--panel); border: 1px solid var(--rule); border-radius: 8px; padding: 16px 18px; min-width: 0; }
.notes h2 { margin: 0; font-family: var(--font-label); font-size: 16px; letter-spacing: .08em; text-transform: uppercase; color: var(--copper-bright); }
.notes ul { margin: 0; padding-left: 18px; display: grid; gap: 6px; line-height: 1.5; max-width: 80ch; }
.notes dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; line-height: 1.5; }
.notes dt { font-family: var(--font-label); font-weight: 600; font-size: 15px; }
.notes dd { margin: 0; color: var(--muted); max-width: 80ch; }
@media (max-width: 560px) { .notes dl { grid-template-columns: 1fr; } .notes dd { margin-bottom: 8px; } }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>

<main>
  <header class="page">
    <h1>Forever Profile Report</h1>
    <p id="meta"></p>
    <div class="legend" id="legend"></div>
  </header>
  <section class="role" id="dps"><h2>DPS profiles <span>damage per second</span></h2><div class="well"></div></section>
  <section class="role" id="tank"><h2>Tank profiles <span>threat per second</span></h2><div class="well"></div></section>
  <section class="role" id="healer"><h2>Healer profiles <span>healing per second</span></h2><div class="well"></div></section>
  <section class="notes" id="notes" hidden></section>
</main>

<script>
const DATA = ${data};
const CLASS_COLOR = {
  warrior: '#c69b6d', paladin: '#f48cba', hunter: '#aad372', rogue: '#fff468', priest: '#ffffff',
  shaman: '#2f8ef0', mage: '#3fc7eb', warlock: '#8788ee', druid: '#ff7c0a',
};
const CLASS_NAME = { warrior: 'Warrior', paladin: 'Paladin', hunter: 'Hunter', rogue: 'Rogue', priest: 'Priest', shaman: 'Shaman', mage: 'Mage', warlock: 'Warlock', druid: 'Druid' };
const { report, notes } = DATA;
const hasBefore = report.rows.some((r) => Object.values(r.cells).some((c) => c.before !== undefined));

document.getElementById('meta').textContent =
  report.rows.length + ' profiles on their own E65 gear, raid buffs and consumables, each optimised for these encounters. ' +
  report.iterations + ' fights a cell, mean with a 95% interval. More than one target runs the profile\\'s Multi Target list; a tank\\'s adds swing for 500 every 2 seconds.' +
  (notes.build ? ' ' + notes.build : '');
document.getElementById('legend').innerHTML =
  '<span><b>bar</b> against the best in its column</span>' +
  (hasBefore ? '<span><b>+12.3</b> change from before this round\\'s optimisation</span>' : '') +
  '<span>click a column to sort</span>';

const fmt = (v) => v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function table(sectionId, rows, columns) {
  const host = document.querySelector('#' + sectionId + ' .well');
  if (rows.length === 0) { document.getElementById(sectionId).hidden = true; return; }
  const best = Object.fromEntries(columns.map((c) => [c.id, Math.max(...rows.map((r) => r.cells[c.id]?.mean ?? 0))]));
  let sortKey = columns[0].id;
  let sortDir = -1;
  const t = document.createElement('table');
  const head = document.createElement('thead');
  const body = document.createElement('tbody');
  t.append(head, body);
  host.appendChild(t);

  function drawHead() {
    head.innerHTML = '';
    const tr = document.createElement('tr');
    const cols = [{ id: 'name', label: 'Profile' }, ...columns];
    for (const c of cols) {
      const th = document.createElement('th');
      th.scope = 'col';
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = c.label + (sortKey === c.id ? (sortDir < 0 ? ' \\u25be' : ' \\u25b4') : '');
      if (sortKey === c.id) b.setAttribute('aria-sort', sortDir < 0 ? 'descending' : 'ascending');
      b.addEventListener('click', () => {
        if (sortKey === c.id) sortDir = -sortDir; else { sortKey = c.id; sortDir = c.id === 'name' ? 1 : -1; }
        drawHead(); drawBody();
      });
      th.appendChild(b);
      tr.appendChild(th);
    }
    head.appendChild(tr);
  }

  function drawBody() {
    body.innerHTML = '';
    const sorted = [...rows].sort((a, b) =>
      sortKey === 'name' ? sortDir * a.name.localeCompare(b.name) : sortDir * ((a.cells[sortKey]?.mean ?? 0) - (b.cells[sortKey]?.mean ?? 0)));
    for (const r of sorted) {
      const tr = document.createElement('tr');
      const name = document.createElement('td');
      name.className = 'name';
      const sw = document.createElement('i');
      sw.style.background = CLASS_COLOR[r.characterClass] || '#ccc';
      name.append(sw, document.createTextNode(r.name));
      const sub = document.createElement('small');
      sub.textContent = CLASS_NAME[r.characterClass] || r.characterClass;
      name.appendChild(sub);
      tr.appendChild(name);
      for (const c of columns) {
        const cell = r.cells[c.id];
        const td = document.createElement('td');
        if (!cell) { td.textContent = '\\u2013'; tr.appendChild(td); continue; }
        const box = document.createElement('div');
        box.className = 'cell';
        const fig = document.createElement('div');
        fig.className = 'fig';
        fig.innerHTML = fmt(cell.mean) + '<span class="pm">\\u00b1' + cell.interval.toFixed(1) + '</span>';
        const track = document.createElement('div');
        track.className = 'track';
        const fill = document.createElement('span');
        fill.style.width = (100 * cell.mean / (best[c.id] || 1)).toFixed(1) + '%';
        if (cell.mean === best[c.id]) fill.className = 'best';
        track.appendChild(fill);
        box.append(fig, track);
        if (cell.before !== undefined) {
          const d = cell.mean - cell.before;
          const delta = document.createElement('div');
          delta.className = 'delta' + (Math.abs(d) > cell.interval ? (d > 0 ? ' up' : ' down') : '');
          delta.textContent = (d >= 0 ? '+' : '') + d.toFixed(1) + ' (was ' + fmt(cell.before) + ')';
          box.appendChild(delta);
        }
        td.appendChild(box);
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }
  }
  drawHead();
  drawBody();
}

table('dps', report.rows.filter((r) => r.role === 'dps'), DATA.combat);
table('tank', report.rows.filter((r) => r.role === 'tank'), DATA.combat);
table('healer', report.rows.filter((r) => r.role === 'healer'), DATA.healer);

if ((notes.summary && notes.summary.length) || (notes.classes && Object.keys(notes.classes).length)) {
  const n = document.getElementById('notes');
  n.hidden = false;
  const h = document.createElement('h2');
  h.textContent = 'What the optimisation changed';
  n.appendChild(h);
  if (notes.summary && notes.summary.length) {
    const ul = document.createElement('ul');
    for (const line of notes.summary) { const li = document.createElement('li'); li.textContent = line; ul.appendChild(li); }
    n.appendChild(ul);
  }
  if (notes.classes) {
    const dl = document.createElement('dl');
    for (const [cls, text] of Object.entries(notes.classes)) {
      const dt = document.createElement('dt');
      dt.textContent = CLASS_NAME[cls] || cls;
      dt.style.color = CLASS_COLOR[cls] || 'inherit';
      const dd = document.createElement('dd');
      dd.textContent = text;
      dl.append(dt, dd);
    }
    n.appendChild(dl);
  }
}
</script>
`;
}

{
  const IN = process.env.IN;
  const HTML = process.env.HTML;
  if (IN && HTML) {
    const report = JSON.parse(readFileSync(IN, 'utf8')) as Report;
    const notes = process.env.NOTES ? (JSON.parse(readFileSync(process.env.NOTES, 'utf8')) as ReportNotes) : {};
    writeFileSync(HTML, renderReportPage(report, notes));
    console.log(`Wrote ${HTML}`);
  }
}
