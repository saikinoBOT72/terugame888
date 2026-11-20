// パーツの難しさ D を出す。到達チェック（checkPiece）と同じ総当たりで、入口から出口までの最短の道すじをたどり、
// 各着地で「良い手（出口へ行ける着地か出口）の割合」の -log2 を足す（＝どれだけ正確に蹴る・押す必要があるか）。
// そこに、チェックで「無い」扱いの障害物の重み（DIFF_W）と、天井のトゲ（すぐ上が壁のトゲ）1本 0.4 を足す。
// 使い方: node tools/difficulty.js            → プールごとの一覧（目標から外れたものに印）
//         node tools/difficulty.js <id> ...    → そのパーツだけ
const { chromium } = require('playwright');
const path = require('path');
const { TARGET, LOW, HIGH, inject } = require('./diff_core');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.resolve(__dirname, '../index.html')); await pg.waitForTimeout(300);
  if (errs.length) { console.log(errs.join('\n')); process.exit(1); }
  const ids = process.argv.slice(2);
  await inject(pg);
  const res = await pg.evaluate((ids) => {
    const analyze = window.__diff;
    const D = window.KABE_DATA;
    if (ids.length) return { one: ids.map(analyze) };
    const memo = {}; const get = id => memo[id] || (memo[id] = analyze(id));
    return { pools: D.POOLS.map(p => ({ from: p.from, name: p.name, list: p.pieces.map(get) })) };
  }, ids);
  const fmt = r => `${r.id}:${r.D}${r.ceil ? ` 天井${r.ceil}` : ''}${Object.entries(r.haz).map(([c, n]) => ` ${c}${n}`).join('')}`;
  if (res.one) { for (const r of res.one) console.log(fmt(r), ` (精度 ${r.bits}・トゲ ${r.spikes}・diff ${r.diff})`); }
  else for (const p of res.pools) {
    const t = TARGET[p.from], ds = p.list.map(r => r.D).sort((a, b) => a - b), med = ds[Math.floor(ds.length / 2)];
    console.log(`\n== ${p.from}m ${p.name}（${p.list.length}個） 中央値 ${med}  目標 ${t}（${Math.max(0, t - LOW).toFixed(1)}〜${(t + HIGH).toFixed(1)}）`);
    const s = p.list.slice().sort((a, b) => a.D - b.D);
    console.log(s.map(r => (r.D > t + HIGH ? '▲' : r.D < t - LOW ? '▽' : '') + fmt(r)).join('  '));
  }
  await b.close();
})();
