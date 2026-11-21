// パーツの到達チェック（詰まないか）を全部、または1つだけ走らせる。
// 壁につく物（杭・跳ね橋・扇風機・突風・筒・トゲ・シャッター）が壁から浮いていないかも調べる。
// 使い方: node tools/check.js [パーツid]
const { chromium } = require('playwright');
const path = require('path');
// 壁につく物の置き場所：つけ根が壁でない＝浮いている。扇風機・突風は1マスより背が高いので、つけ根の上下も壁（か斜め）でないと角からはみ出す
function mounts(PIECES, only) {
  const W = ch => !!ch && '#SKk%EH'.includes(ch), WS = ch => W(ch) || ch === '/' || ch === '\\', out = [];
  for (const id of only ? [only] : Object.keys(PIECES)) {
    const R = PIECES[id].rows, n = R.length, at = (r, c) => R[r] && R[r][c];
    for (let r = 0; r < n; r++) for (let c = 0; c < 20; c++) {
      const ch = at(r, c), bad = msg => out.push(`${id} ${n - r}行目${c}列の ${ch}：${msg}`);
      if ((ch === 'Z' || ch === 'B') && at(r, c - 1) !== ch) { let e = c; while (at(r, e + 1) === ch) e++; if (!W(at(r, c - 1)) && !W(at(r, e + 1))) bad('どちらの端も壁についていない'); }
      if ('><}{'.includes(ch)) { const ac = ch === '>' || ch === '}' ? c - 1 : c + 1;
        if (!W(at(r, ac))) bad('うしろが壁でない'); else if (!WS(at(r + 1, ac)) || !WS(at(r - 1, ac))) bad('壁の角からはみ出す（つけ根の上下も壁にする）'); }
      if ('^pq'.includes(ch) && !W(at(r, c - 1)) && !W(at(r, c + 1)) && !W(at(r - 1, c)) && !W(at(r + 1, c))) bad('となりに壁がない');
      if ((ch === 'K' || ch === 'k') && !W(at(r, ch === 'K' ? c - 1 : c + 1))) bad('うしろが壁でない');
      if (ch === '=' && at(r, c - 1) !== '=') { let e = c; while (at(r, e + 1) === '=') e++; if (!W(at(r, c - 1)) || !W(at(r, e + 1))) bad('両はしが壁でない'); }
    }
  }
  return out;
}
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.resolve(__dirname, '../index.html'));
  await pg.waitForTimeout(300);
  if (errs.length) { console.log(errs.join('\n')); process.exit(1); }
  const res = await pg.evaluate(id => id ? [window.__kabe.checkPiece(id)].map(r => (delete r.points, r)) : window.__kabe.checkAll(), process.argv[2]);
  let bad = 0;
  for (const r of res) { if (!r.ok || r.softlocks) bad++; console.log(`${r.ok && !r.softlocks ? 'OK' : 'NG'} ${r.id.padEnd(18)} 入口 ${r.entryOk}/${r.entries} 痛い ${r.hurtSpots} 詰み ${r.softlocks}${r.ok ? '' : ' ' + JSON.stringify(r.badEntries)}`); }
  global.window = {}; require('../data/pieces.js'); const mt = mounts(window.KABE_DATA.PIECES, process.argv[2]);
  for (const m of mt) console.log('浮き ' + m);
  bad += mt.length;
  console.log(bad ? `NG ${bad}件` : 'すべてOK');
  await b.close(); process.exit(bad ? 1 : 0);
})();
