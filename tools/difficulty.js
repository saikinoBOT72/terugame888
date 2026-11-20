// パーツの難しさ D を出す。到達チェック（checkPiece）と同じ総当たりで、入口から出口までの最短の道すじをたどり、
// 各着地で「良い手（出口へ行ける着地か出口）の割合」の -log2 を足す（＝どれだけ正確に蹴る・押す必要があるか）。
// そこに、チェックで「無い」扱いの障害物の重み（DIFF_W）と、天井のトゲ（すぐ上が壁のトゲ）1本 0.4 を足す。
// 使い方: node tools/difficulty.js            → プールごとの一覧（目標から外れたものに印）
//         node tools/difficulty.js <id> ...    → そのパーツだけ
const { chromium } = require('playwright');
const path = require('path');
// プールの目標（中央値）。上のプールほど難しく。幅は 目標-1.2〜目標+1.6
const TARGET = { 0: 0.5, 100: 1.0, 200: 1.6, 300: 2.2, 400: 2.6, 500: 3.0, 600: 3.4, 700: 3.8 };
const LOW = 1.2, HIGH = 1.6;
const DIFF_W = { T: 2.0, O: 1.2, K: 1.0, k: 1.0, Y: 0.15, X: 0.15, Z: 0.3, B: 0.1, '%': 0.05, '=': 0.1 };   // T 回る棒・O 振り子は1本ずつ、ほかはマスの数
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.resolve(__dirname, '../index.html')); await pg.waitForTimeout(300);
  if (errs.length) { console.log(errs.join('\n')); process.exit(1); }
  const ids = process.argv.slice(2);
  const res = await pg.evaluate(([ids, W]) => {
    const K = window.__kabe, { newWorld, appendRows, newBody, kick, physStep, airJump, canAct, spikeHit } = K._dbg, CHECK = K.CHECK, PIECES = K.PIECES;
    const CELL = 18, HB = 10, DT = 1 / 120;
    function analyze(id) {
      const pc = PIECES[id], w = newWorld(), bottom = pc.rows[0], top = pc.rows[pc.rows.length - 1], rows = [];
      for (let i = 0; i < CHECK.padBelow; i++) rows.push(bottom); for (const r of pc.rows) rows.push(r); for (let i = 0; i < CHECK.padAbove; i++) rows.push(top);
      appendRows(w, rows);
      const goalY = -(CHECK.padBelow + pc.rows.length + 1) * CELL, fallY = -CELL;
      const slope = b => !b.side ? '' : b.wn.y > 0.3 ? 'd' : b.wn.y < -0.3 ? 'u' : 'v';
      const key = b => (b.side ? 'w' + b.side + slope(b) : 'f' + (b.face || 1)) + ',' + Math.round(b.x / 3) + ',' + Math.round(b.y / 3);
      const cl = bottom.indexOf('.'), cr = bottom.lastIndexOf('.'), entries = [];
      for (let y = -2 * CELL - HB; y > -CHECK.padBelow * CELL + HB; y -= 6) entries.push(newBody(cl * CELL + HB, y, -1), newBody((cr + 1) * CELL - HB, y, 1));
      const states = new Map(), outs = new Map(), queue = [];
      const add = b => { const k = key(b); if (!states.has(k)) { states.set(k, b); outs.set(k, []); queue.push(k); } return k; };
      const ek = entries.map(add);
      const dj = [null]; for (let t = CHECK.djStep; t <= CHECK.djMax; t += CHECK.djStep) dj.push(t);
      while (queue.length && states.size < 4000) {
        const k = queue.shift(), s = states.get(k), o = outs.get(k);
        for (const d of dj) {
          const bb = JSON.parse(JSON.stringify(s)); kick(w, bb); let t = 0, r = null;
          while (t < CHECK.maxT) {
            if (d !== null && bb.air > 0 && t >= d && !canAct(bb)) airJump(bb);
            const ev = physStep(w, bb, DT); t += DT;
            if (spikeHit(w, bb.x, bb.y, bb.grace > 0 ? bb.graceSide : null)) { r = 'hurt'; break; }
            if (bb.y > fallY) { r = 'fall'; break; } if (bb.y < goalY) { r = 'goal'; break; }
            if (ev === 'wall' || ev === 'floor') { for (let u = 0; u < CHECK.settle; u += DT) physStep(w, bb, DT); r = spikeHit(w, bb.x, bb.y, bb.grace > 0 ? bb.graceSide : null) ? 'hurt' : 'land'; break; }
          }
          o.push(r === 'land' ? add(bb) : (r || 'none'));
          if (d !== null && t < d) break;
        }
      }
      const dist = new Map(), q = [], rev = new Map();
      for (const [k, o] of outs) if (o.includes('goal')) { dist.set(k, 1); q.push(k); }
      for (const k of states.keys()) rev.set(k, []);
      for (const [k, o] of outs) for (const n of o) if (states.has(n) && n !== k) rev.get(n).push(k);
      while (q.length) { const k = q.shift(); for (const p of rev.get(k)) if (!dist.has(p)) { dist.set(p, dist.get(k) + 1); q.push(p); } }
      const goodFrac = k => { const o = outs.get(k); if (!o.length) return 0; let g = 0; for (const n of o) if (n === 'goal' || (dist.has(n) && n !== k)) g++; return g / o.length; };
      let tot = 0, n = 0;
      for (const e of ek) {
        if (!dist.has(e)) continue; let k = e, bits = 0, guard = 0;
        while (guard++ < 40) {
          bits += -Math.log2(Math.max(0.02, goodFrac(k)));
          const o = outs.get(k); if (o.includes('goal')) break;
          let best = null; for (const nx of o) if (states.has(nx) && dist.has(nx) && nx !== k && (best === null || dist.get(nx) < dist.get(best) || (dist.get(nx) === dist.get(best) && goodFrac(nx) > goodFrac(best)))) best = nx;
          if (!best) break; k = best;
        }
        tot += bits; n++;
      }
      const R = pc.rows; let spikes = 0, ceil = 0; const haz = {};
      for (let r = 0; r < R.length; r++) for (let c = 0; c < 20; c++) { const ch = R[r][c];
        if (ch === '^') { spikes++; if (R[r + 1] && R[r + 1][c] === '#') ceil++; }
        if (W[ch] !== undefined) haz[ch] = (haz[ch] || 0) + 1; }
      let h = 0; for (const c in haz) h += W[c] * haz[c];
      const bits = n ? tot / n : 99;
      return { id, D: +(bits + h + ceil * 0.4).toFixed(1), bits: +bits.toFixed(1), haz, spikes, ceil, diff: pc.diff };
    }
    const D = window.KABE_DATA;
    if (ids.length) return { one: ids.map(analyze) };
    const memo = {}; const get = id => memo[id] || (memo[id] = analyze(id));
    return { pools: D.POOLS.map(p => ({ from: p.from, name: p.name, list: p.pieces.map(get) })) };
  }, [ids, DIFF_W]);
  const fmt = r => `${r.id}:${r.D}${r.ceil ? ` 天井${r.ceil}` : ''}${Object.entries(r.haz).filter(([c]) => 'TOKk'.includes(c)).map(([c, n]) => ` ${c}${n}`).join('')}`;
  if (res.one) { for (const r of res.one) console.log(fmt(r), ` (精度 ${r.bits}・トゲ ${r.spikes}・diff ${r.diff})`); }
  else for (const p of res.pools) {
    const t = TARGET[p.from], ds = p.list.map(r => r.D).sort((a, b) => a - b), med = ds[Math.floor(ds.length / 2)];
    console.log(`\n== ${p.from}m ${p.name}（${p.list.length}個） 中央値 ${med}  目標 ${t}（${Math.max(0, t - LOW).toFixed(1)}〜${(t + HIGH).toFixed(1)}）`);
    const s = p.list.slice().sort((a, b) => a.D - b.D);
    console.log(s.map(r => (r.D > t + HIGH ? '▲' : r.D < t - LOW ? '▽' : '') + fmt(r)).join('  '));
  }
  await b.close();
})();
