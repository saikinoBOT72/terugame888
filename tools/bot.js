// ボットが本物の動き（動く物も時間どおり）でパーツを遊んで、クリアできるか・どれくらい難しいかを出す。中身は tools/bot_core.js
// 使い方: node tools/bot.js <パーツid | プール番号 | プール名 | all> [-n 回数=12] [-j 並べる数=4]
//   ずれ0  : ずれなしで 左右の壁 × 3つの時刻 = 6回。ノーダメで1回も抜けられないと NG（上手な人でも無理）。一部だけなら ▲
//   上手/ふつう/初心者 : 押す時間に ±15/40/80ms のずれ。始める時刻と左右はばらばらに n 回。ノーダメで抜けた割合
//   ボD    : 3つの成功率の -log2 の平均（0 = だれでも抜ける、大きいほど難しい）。D は今の難しさ（tools/diff_core.js）
//   当たり : ふつうで当たった行（パーツの下から数えて）の多い順
// 結果は JSON で OS の一時フォルダの kabe-bot.json にも書く
const { chromium } = require('playwright');
const path = require('path'), os = require('os'), fs = require('fs');
const core = require('./bot_core.js'), diff = require('./diff_core.js');
const LEVELS = [['上手', 0.015], ['ふつう', 0.04], ['初心者', 0.08]];
const args = process.argv.slice(2), opt = { n: 12, j: 4 };
for (let i = 0; i < args.length; i++) if (args[i] === '-n' || args[i] === '-j') { opt[args[i].slice(1)] = +args[i + 1]; args.splice(i, 2); i--; }
const target = args[0];
if (!target) { console.log('使い方: node tools/bot.js <パーツid | プール番号 | プール名 | all> [-n 12] [-j 4]'); process.exit(1); }
const bits = (k, n) => -Math.log2((k + 0.5) / (n + 1));
(async () => {
  const sv = await core.serve(), b = await chromium.launch(), errs = [];
  const open = async () => { const pg = await b.newPage(); pg.on('pageerror', e => errs.push(e.message)); await pg.goto(sv.url); await pg.waitForTimeout(300); await diff.inject(pg); return pg; };
  const pages = [await open()];
  const info = await pages[0].evaluate(() => ({ pools: window.__kabe.PIECES && window.KABE_DATA.POOLS.map(p => ({ name: p.name, from: p.from, pieces: p.pieces })), ids: Object.keys(window.__kabe.PIECES) }));
  let ids, pool = null;
  if (target === 'all') ids = info.ids;
  else if (info.ids.includes(target)) ids = [target];
  else { pool = /^\d+$/.test(target) ? info.pools[+target] : info.pools.find(p => p.name === target); if (!pool) { console.log('見つからない: ' + target); process.exit(1); } ids = pool.pieces; }
  const nJ = Math.min(opt.j, ids.length); while (pages.length < nJ) pages.push(await open());
  console.log(`${ids.length}個 × (ずれ0 6回 + ${LEVELS.length}段階 × ${opt.n}回)、${nJ}つ並べて`);
  const t0 = Date.now(), res = [];
  let next = 0;
  const one = async (pg, id) => {
    return pg.evaluate(([id, n, LEVELS]) => {
      __bot.setMap(id);
      const r = { id, perfect: 0, lv: {}, hurtRows: {}, D: window.__diff(id).D, diff: window.__kabe.PIECES[id].diff, res: {} };
      for (const side of [-1, 1]) for (const t0 of [0, 1.7, 3.4]) { const o = __bot.run(id, { side, t0 }); if (o.res === 'goal') r.perfect++; else r.res['ずれ0:' + o.res] = (r.res['ずれ0:' + o.res] || 0) + 1; }
      for (const [name, sigma] of LEVELS) {
        let k = 0, tm = 0;
        for (let i = 0; i < n; i++) {
          const o = __bot.run(id, { side: Math.random() < 0.5 ? -1 : 1, t0: Math.random() * 8, sigma });
          if (o.res === 'goal') { k++; tm += o.time; } else r.res[name + ':' + o.res] = (r.res[name + ':' + o.res] || 0) + 1;
          if (o.res === 'hurt' && name === 'ふつう') r.hurtRows[o.row] = (r.hurtRows[o.row] || 0) + 1;
        }
        r.lv[name] = { k, n, time: k ? +(tm / k).toFixed(1) : null };
      }
      return r;
    }, [id, opt.n, LEVELS]);
  };
  await Promise.all(pages.map(async pg => { while (next < ids.length) { const id = ids[next++], s = Date.now(); const r = await one(pg, id); r.sec = Math.round((Date.now() - s) / 1000); r.botD = +(LEVELS.reduce((a, [nm]) => a + bits(r.lv[nm].k, r.lv[nm].n), 0) / LEVELS.length).toFixed(1); res.push(r); print(r); } }));
  function print(r) {
    const mark = r.perfect === 0 ? 'NG' : r.perfect < 6 ? '▲ ' : 'OK';
    const pct = nm => (Math.round(100 * r.lv[nm].k / r.lv[nm].n) + '%').padStart(5);
    const hr = Object.entries(r.hurtRows).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([row, c]) => `${row}行×${c}`).join(' ');
    console.log(`${mark} ${r.id.padEnd(18)} ずれ0 ${r.perfect}/6 ${LEVELS.map(([nm]) => nm + pct(nm)).join(' ')}  ボD ${r.botD.toFixed(1).padStart(4)}  D ${String(r.D).padStart(4)}  ${hr ? '当たり ' + hr : ''} (${r.sec}秒)`);
  }
  // まとめ：プールごとのボD の中央値。NG・▲ の一覧
  const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  console.log('---');
  for (const p of info.pools) { const rs = res.filter(r => p.pieces.includes(r.id)); if (rs.length > 1) console.log(`${String(p.from).padStart(5)}m ${p.name.padEnd(10)} ${rs.length}個  ボD 中央値 ${med(rs.map(r => r.botD)).toFixed(1)}  D 中央値 ${med(rs.map(r => r.D)).toFixed(1)}`); }
  const ng = res.filter(r => r.perfect === 0), part = res.filter(r => r.perfect > 0 && r.perfect < 6);
  console.log(ng.length ? `NG ${ng.length}個: ${ng.map(r => r.id).join(' ')}` : 'NG なし（どれも ずれ0 ならノーダメで抜けられる）');
  if (part.length) console.log(`▲ ${part.length}個（時刻・左右によっては ずれ0 でも当たる）: ${part.map(r => r.id).join(' ')}`);
  const out = path.join(os.tmpdir(), 'kabe-bot.json'); fs.writeFileSync(out, JSON.stringify(res, null, 1));
  console.log(`${Math.round((Date.now() - t0) / 1000)}秒  結果: ${out}`);
  if (errs.length) console.log(errs.slice(0, 5).join('\n'));
  await b.close(); sv.close(); process.exit(ng.length ? 1 : 0);
})();
