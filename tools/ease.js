// 難しすぎるパーツからトゲを外す案を探す（data/pieces.js は書き換えない。案を出すだけ）。tools/harden.js の逆。
// トゲ（^）・出入りトゲ（p q）を1つずつ外してみて、到達チェックが OK のまま、いちばん難しさ D が下がるものを選ぶ。目標以下になるまでくり返す。
// 使い方: node tools/ease.js <id> <目標の D>
// 出力：外したマス（上から何行目・左から何列目）と、書き換えた絵
const { chromium } = require('playwright');
const path = require('path');
const { inject } = require('./diff_core');
(async () => {
  const [id, target] = process.argv.slice(2);
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.goto('file://' + path.resolve(__dirname, '../index.html')); await pg.waitForTimeout(300);
  await inject(pg);
  const out = await pg.evaluate(([id, target]) => {
    const K = window.__kabe, pc = K.PIECES[id], n = pc.rows.length, orig = pc.rows.slice();
    const set = (rows, list) => { rows = rows.slice(); for (const [r, c] of list) rows[r] = rows[r].slice(0, c) + '.' + rows[r].slice(c + 1); return rows; };
    const ok = rows => { pc.rows = rows; const r = K.checkPiece(id); return r.ok && !r.softlocks; };
    const D = rows => { pc.rows = rows; return window.__diff(id).D; };
    let rows = orig.slice(), cur = D(rows), removed = [];
    for (let step = 0; step < 24 && cur > target; step++) {
      const cands = [];
      for (let r = 0; r < n; r++) for (let c = 0; c < 20; c++) if ('^pq'.includes(rows[r][c])) {
        const ch = rows[r][c], nb = rows[r + 1] && rows[r + 1][c] === ch ? [[r, c], [r + 1, c]] : [[r, c]];   // 縦に並んだ2つはまとめて外す
        cands.push(nb);
      }
      if (!cands.length) break;
      for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
      let best = null, bestD = cur;
      for (const cd of cands.slice(0, 24)) { const t = set(rows, cd); const d = D(t); if (d < bestD && ok(t)) { bestD = d; best = cd; } }
      if (!best) break;
      rows = set(rows, best); cur = bestD; removed.push(...best);
    }
    pc.rows = orig;
    return { D0: D(orig), D: cur, removed: removed.map(([r, c]) => [n - 1 - r, c]), art: rows.slice().reverse() };
  }, [id, +target]);
  console.log(JSON.stringify(out));
  await b.close();
})();
