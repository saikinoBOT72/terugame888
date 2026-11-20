// 仕掛けが多くて難しすぎるパーツから、仕掛けを1つずつ外す案を出す（data/pieces.js は書き換えない）。tools/ease.js の仕掛け版。
// 外す候補：回る棒 T・振り子 O・機雷 M・風車 W は1つ、筒 K k は壁に戻す、横の並び（X = Z B %）・縦の並び（Y |）・曲がるブロックの道すじ（J L）はまとめて。
// 到達チェックが OK のまま、いちばん難しさ D が下がるものを選び、目標以下になるまでくり返す。仕掛けは最低1つ残す。
// 使い方: node tools/lighten.js <id> <目標の D>
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
    const ok = rows => { pc.rows = rows; const r = K.checkPiece(id); return r.ok && !r.softlocks; };
    const D = rows => { pc.rows = rows; return window.__diff(id).D; };
    // 仕掛けのまとまり（同じ文字でつながったマス）
    const groups = rows => {
      const seen = new Set(), list = [];
      for (let r = 0; r < n; r++) for (let c = 0; c < 20; c++) {
        const ch = rows[r][c]; if (!'TOMWKkXYZB%=|JL'.includes(ch) || seen.has(r + ',' + c)) continue;
        const cells = [], q = [[r, c]]; seen.add(r + ',' + c);
        const link = 'XYZB%=|JL'.includes(ch);
        while (q.length) { const [a, bb] = q.pop(); cells.push([a, bb]); if (!link) continue;
          for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (a + dr) + ',' + (bb + dc); if (rows[a + dr] && rows[a + dr][bb + dc] === ch && !seen.has(k)) { seen.add(k); q.push([a + dr, bb + dc]); } } }
        list.push({ ch, cells });
      }
      return list;
    };
    const drop = (rows, g) => { rows = rows.slice(); for (const [r, c] of g.cells) rows[r] = rows[r].slice(0, c) + ('Kk'.includes(g.ch) ? '#' : '.') + rows[r].slice(c + 1); return rows; };
    let rows = orig.slice(), cur = D(rows), removed = [];
    for (let step = 0; step < 6 && cur > target; step++) {
      const gs = groups(rows); if (gs.length <= 1) break;
      let best = null, bestD = cur;
      for (const g of gs) { const t = drop(rows, g), d = D(t); if (d < bestD && ok(t)) { bestD = d; best = g; } }
      if (!best) break;
      rows = drop(rows, best); cur = bestD; removed.push(best.ch);
    }
    pc.rows = orig;
    return { D0: D(orig), D: cur, removed, art: rows.slice().reverse() };
  }, [id, +target]);
  console.log(JSON.stringify(out));
  await b.close();
})();
