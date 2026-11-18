// パーツの到達チェック（詰まないか）を全部、または1つだけ走らせる。
// 使い方: node tools/check.js [パーツid]
const { chromium } = require('playwright');
const path = require('path');
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
  console.log(bad ? `NG ${bad}件` : 'すべてOK');
  await b.close(); process.exit(bad ? 1 : 0);
})();
