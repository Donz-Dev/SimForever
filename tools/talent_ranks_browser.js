/*
 * Capture every rank's tooltip text from a Forever talent calculator.
 *
 * Paste this whole file into the browser console on
 * https://www.wowhead.com/forever/talent-calc/<class>, then run:
 *
 *     TalentRanks.run('warrior')          // starts; returns immediately
 *     TalentRanks.status()                // poll until it reports done
 *
 * It then shows a COPY button; click it (a real click, so the copy handler
 * fires) and save the clipboard, e.g.
 *
 *     Get-Clipboard -Raw | Set-Content -Encoding utf8 warrior-ranks.json
 *
 * Then feed that file to tools/derive_talent_values.js.
 *
 *
 * WHY THIS EXISTS
 *
 * The original scrape (src/data/talents/README.md) took `data-simple-tooltip`,
 * which holds the RANK ONE text only. 361 of the 470 talents have more than one
 * rank, so three quarters of the talent data had no values at all. The
 * calculator does expose the rest — the tooltip is regenerated as points go in,
 * so Improved Heroic Strike reads "by 1 Rage", "by 2 Rage", "by 3 Rage" as it
 * fills. Reading them just means driving the calculator.
 *
 *
 * THREE THINGS THAT WILL BITE ANYONE CHANGING THIS
 *
 * 1. The calculator updates its DOM ASYNCHRONOUSLY. Reading `data-points` in
 *    the same synchronous task as the click sees the old value, which reads as
 *    "the click did nothing" and makes a caller give up. `spend()` polls for
 *    the change instead of assuming it. Clicking in a tight synchronous loop
 *    also desynchronises the calculator's internal state badly enough that
 *    "Reset build" silently stops working.
 *
 * 2. ELEMENT REFERENCES GO STALE. The page re-renders talent cells, so a cell
 *    captured before a reset may be a detached node afterwards: it reports its
 *    old point count and clicking it does nothing. Everything here addresses a
 *    talent by (tree index, row, col) and re-queries, never by a saved node.
 *
 * 3. A run must START FROM AN EMPTY BOARD. An earlier extraction that left 51
 *    points spent makes the next one fail almost everywhere, and the failure is
 *    quiet: every talent still appears in the output, with nulls where the text
 *    should be. `stage()` refuses to hand over a capture that is not complete,
 *    because that output hashes and transfers perfectly while being worthless.
 */

globalThis.TalentRanks = (function () {
  const Q = () => [...document.querySelectorAll('.ctc-tree')].map((t) => [...t.querySelectorAll('.ctc-tree-talent')]);
  const tip = (c) => c.querySelector('a')?.getAttribute('data-simple-tooltip') || '';
  const nameOf = (c) => (tip(c).match(/whtt-name">([^<]*)</) || [])[1];
  const bodyOf = (c) => {
    const m = tip(c).match(/white-space: pre-wrap;">([\s\S]*?)<\/div>/);
    // The calculator hard-wraps long tooltips; the repo's own data does not.
    return m ? m[1].replace(/\s+/g, ' ').trim() : null;
  };
  const P = (c) => +c.getAttribute('data-points');
  const M = (c) => +c.getAttribute('data-max-points');
  const R = (c) => +c.getAttribute('data-row');
  const C = (c) => +c.getAttribute('data-col');
  const at = (ti, r, cl) => Q()[ti].find((c) => R(c) === r && C(c) === cl);
  const treePoints = (ti) => Q()[ti].reduce((s, c) => s + P(c), 0);
  const total = () => [...document.querySelectorAll('.ctc-tree-talent')].reduce((s, c) => s + P(c), 0);
  const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
  const fire = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

  /** Click a talent and wait for its point count to actually change. See note 1. */
  async function spend(ti, r, cl) {
    const before = P(at(ti, r, cl));
    fire(at(ti, r, cl).querySelector('a'));
    for (let i = 0; i < 25; i++) {
      await tick(2);
      if (P(at(ti, r, cl)) !== before) return true;
    }
    return false;
  }

  async function reset() {
    for (let i = 0; i < 10; i++) {
      if (total() === 0) return true;
      const b = [...document.querySelectorAll('a,button')].find((e) => /^Reset build$/i.test(e.textContent.trim()));
      if (!b) return false;
      fire(b);
      for (let j = 0; j < 20 && total() !== 0; j++) await tick(5);
    }
    return total() === 0;
  }

  /*
   * Walk one tree top-down, maxing each talent in row order and reading the
   * tooltip at every rank on the way up.
   *
   * Filling row N is what unlocks row N+1, so the sweep pays for its own tier
   * requirements as it descends and never needs a separate "spend 30 points to
   * unlock the capstone" step.
   *
   * It cannot finish a tree that holds more ranks than the point budget, and
   * the Warrior's Fury tree is exactly that: 57 ranks against 51 points, which
   * leaves Flurry and Bloodthirst unreachable. `captureOne` below picks those
   * up. (Arms holds 47 and Protection 50, so both complete in one sweep, which
   * is why this shortfall is easy to miss on two trees out of three.)
   */
  async function sweepTree(ti, treeName, recorded) {
    const plan = Q()[ti]
      .map((c) => ({ r: R(c), cl: C(c), name: nameOf(c), max: M(c) }))
      .sort((a, b) => a.r - b.r || a.cl - b.cl);
    const got = [];
    for (const t of plan) {
      const key = `${treeName}/${t.name}`;
      if (recorded.has(key)) continue;
      if (treePoints(ti) < t.r * 5) continue;
      const el = at(ti, t.r, t.cl);
      if (!el || P(el) >= M(el)) continue;
      const ranks = [];
      for (let r = 1; r <= t.max; r++) {
        if (!(await spend(ti, t.r, t.cl))) break;
        ranks.push(bodyOf(at(ti, t.r, t.cl)));
      }
      if (ranks.length === t.max && ranks.every((x) => x)) {
        recorded.add(key);
        got.push({ tree: treeName, name: t.name, row: t.r, col: t.cl, maxRanks: t.max, ranks });
      }
    }
    return got;
  }

  /*
   * Capture ONE talent the sweep could not afford.
   *
   * Buys the cheapest route to its tier — any talents in lower rows, whether or
   * not they have already been recorded — then satisfies a named prerequisite
   * if one still blocks it, then maxes the target. Slower per talent than the
   * sweep, which is why it is the fallback rather than the strategy.
   */
  async function captureOne(ti, treeName, t) {
    if (!(await reset())) throw new Error('Could not clear the board; reload the page and start again.');

    let guard = 0;
    while (treePoints(ti) < t.r * 5 && guard++ < 200) {
      const candidate = Q()[ti]
        .filter((c) => R(c) < t.r && P(c) < M(c))
        .sort((a, b) => R(a) - R(b))[0];
      if (!candidate) break;
      if (!(await spend(ti, R(candidate), C(candidate)))) break;
    }

    // "Requires 30 points in Arms Talents<br>Requires 1 point in Sweeping Strikes"
    const error = at(ti, t.r, t.cl).getAttribute('data-error-message') || '';
    const prerequisite = (error.match(/Requires \d+ points? in ([^<]+)$/) || [])[1];
    if (prerequisite) {
      const p = Q()[ti].find((c) => nameOf(c) === prerequisite.trim());
      if (p) {
        const co = { r: R(p), cl: C(p) };
        for (let i = 0; i < 10; i++) {
          const el = at(ti, co.r, co.cl);
          if (P(el) >= M(el)) break;
          if (!(await spend(ti, co.r, co.cl))) break;
        }
      }
    }

    const ranks = [];
    for (let r = 1; r <= t.max; r++) {
      if (!(await spend(ti, t.r, t.cl))) break;
      ranks.push(bodyOf(at(ti, t.r, t.cl)));
    }
    if (ranks.length !== t.max || !ranks.every((x) => x)) return null;
    return { tree: treeName, name: t.name, row: t.r, col: t.cl, maxRanks: t.max, ranks };
  }

  async function extract() {
    const treeNames = [...document.querySelectorAll('.ctc-tree')].map((t) =>
      (t.querySelector('.ctc-tree-header-name, .ctc-tree-title')?.textContent || '').trim(),
    );
    const expected = Q().reduce((s, cells) => s + cells.length, 0);
    if (!expected) throw new Error('No talents on this page. Did it finish loading?');
    const recorded = new Set();
    const out = [];
    for (let pass = 0; pass < 8 && out.length < expected; pass++) {
      let progressed = false;
      for (let ti = 0; ti < treeNames.length; ti++) {
        if (!(await reset())) throw new Error('Could not clear the board; reload the page and start again.');
        const got = await sweepTree(ti, treeNames[ti], recorded);
        if (got.length) progressed = true;
        out.push(...got);
      }
      if (!progressed) break;
    }

    // Anything the sweeps could not afford, one at a time.
    for (let ti = 0; ti < treeNames.length; ti++) {
      const plan = Q()[ti]
        .map((c) => ({ r: R(c), cl: C(c), name: nameOf(c), max: M(c) }))
        .sort((a, b) => a.r - b.r || a.cl - b.cl);
      for (const t of plan) {
        const key = `${treeNames[ti]}/${t.name}`;
        if (recorded.has(key)) continue;
        const got = await captureOne(ti, treeNames[ti], t);
        if (got) {
          recorded.add(key);
          out.push(got);
        }
      }
    }

    await reset();
    out.sort((a, b) => treeNames.indexOf(a.tree) - treeNames.indexOf(b.tree) || a.row - b.row || a.col - b.col);
    return { talents: out, expected };
  }

  async function stage(cls) {
    const res = await extract();
    // See note 3: an incomplete capture is worse than no capture, because it
    // looks exactly like a good one once it is a file on disk.
    if (res.talents.length !== res.expected) {
      throw new Error(
        `Incomplete: captured ${res.talents.length} of ${res.expected} talents. ` +
          'Reload the page and run again from an empty board.',
      );
    }
    const data = { class: cls, source: location.href, capturedRanks: res.talents };
    const json = JSON.stringify(data, null, 1);
    const buf = new TextEncoder().encode(json);
    const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    globalThis.__payload = json;
    let btn = document.getElementById('__copybtn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = '__copybtn';
      btn.style.cssText =
        'position:fixed;top:8px;left:8px;z-index:2147483647;padding:14px 28px;font-size:18px;background:#c00;color:#fff;border:0;cursor:pointer';
      btn.onclick = () => {
        const ta = document.createElement('textarea');
        ta.value = globalThis.__payload;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        btn.textContent = 'COPIED';
      };
      document.body.appendChild(btn);
    }
    btn.textContent = 'COPY';
    return { cls, talents: res.talents.length, bytes: buf.length, sha256 };
  }

  let state = { running: false, result: null, error: null };

  function run(cls) {
    if (!cls) throw new Error("Pass the class id, e.g. run('warrior')");
    state = { running: true, result: null, error: null };
    stage(cls).then(
      (r) => { state = { running: false, result: r, error: null }; },
      (e) => { state = { running: false, result: null, error: String((e && e.message) || e) }; },
    );
    return `started ${cls} — poll TalentRanks.status()`;
  }

  const status = () => state;

  return { run, status, extract, stage };
})();
