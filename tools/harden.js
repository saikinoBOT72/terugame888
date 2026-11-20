// 易しすぎるパーツにトゲを足す案を探す（data/pieces.js は書き換えない。案を出すだけ）。
// 壁ぎわ・床の上の空きマスに2マス組のトゲを試し、到達チェックが OK・詰み0のまま、いちばん難しさ D が上がるものを選ぶ。目標に届くまでくり返す。
// 使い方: node tools/harden.js <id> <目標の D> [ceil]   （ceil をつけると天井のトゲも候補にする）
// 出力：足したトゲの位置（上から何行目・左から何列目）と、書き換えた絵
const { chromium } = require('playwright');
const path = require('path');
const { inject } = require('./diff_core');
(async () => {
  const [id, target, ceilArg] = process.argv.slice(2);
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.goto('file://' + path.resolve(__dirname, '../index.html')); await pg.waitForTimeout(300);
  await inject(pg);
  const out = await pg.evaluate(([id, target, ceil]) => {
    const K = window.__kabe, pc = K.PIECES[id], n = pc.rows.length, orig = pc.rows.slice();
    const at = (rows, r, c) => (rows[r] || '')[c] || '#';
    const solid = ch => ch === '#';
    const set = (rows, list) => { rows = rows.slice(); for (const [r, c] of list) rows[r] = rows[r].slice(0, c) + '^' + rows[r].slice(c + 1); return rows; };
    const ok = rows => { pc.rows = rows; const r = K.checkPiece(id); return r.ok && !r.softlocks; };
    const D = rows => { pc.rows = rows; return window.__diff(id).D; };
    let rows = orig.slice(), cur = D(rows), added = [];
    for (let step = 0; step < 8 && cur < target; step++) {
      // 候補：壁の横に縦2マス、床の上に横2マス（ceil なら天井の下に横2マス）。上下2行（つなぎ目）は使わない
      const cands = [];
      for (let r = 2; r < n - 3; r++) for (let c = 1; c < 19; c++) {
        const e = (rr, cc) => at(rows, rr, cc) === '.';
        if (!e(r, c)) continue;
        for (const dx of [-1, 1]) if (solid(at(rows, r, c + dx)) && e(r + 1, c) && solid(at(rows, r + 1, c + dx))) cands.push([[r, c], [r + 1, c]]);
        if (e(r, c + 1) && solid(at(rows, r - 1, c)) && solid(at(rows, r - 1, c + 1))) cands.push([[r, c], [r, c + 1]]);   // 床の上（下が壁）
        if (ceil && e(r, c + 1) && solid(at(rows, r + 1, c)) && solid(at(rows, r + 1, c + 1))) cands.push([[r, c], [r, c + 1]]);   // 天井の下
      }
      for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
      let best = null, bestD = cur;
      for (const cd of cands.slice(0, 28)) {
        const t = set(rows, cd); if (!ok(t)) continue;
        const d = D(t); if (d > bestD && d <= target + 0.9) { bestD = d; best = cd; }
      }
      if (!best) break;
      rows = set(rows, best); cur = bestD; added.push(...best);
    }
    pc.rows = orig;
    return { D0: D(orig), D: cur, added: added.map(([r, c]) => [n - 1 - r, c]), art: rows.slice().reverse() };
  }, [id, +target, ceilArg === 'ceil']);
  console.log(JSON.stringify(out));
  await b.close();
})();
