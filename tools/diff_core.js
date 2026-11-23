// 難しさの計算（tools/difficulty.js と、パーツ作りの道具が共通で使う）。ページの中で window.__diff(id) として動く
// プールの目標（中央値）。0〜700m で 2.4 まで上げ、上空（800m〜）はほぼ平ら（動く仕掛けは数字より難しく感じるので）
const TARGET = { 0: 0.5, 100: 0.75, 200: 1.0, 300: 1.3, 400: 1.6, 500: 1.9, 600: 2.2, 700: 2.4, 800: 2.4, 900: 2.43, 1000: 2.47, 1100: 2.5, 1200: 2.6, 1300: 2.7, 1400: 2.8, 1500: 2.9 };   // 800m からはゆるやかに（1100m で 2.5 まで）
const LOW = 1.0, HIGH = 1.2;   // 幅は 目標-1.0〜目標+1.2
const DIFF_W = { T: 2.0, O: 1.2, K: 1.0, k: 1.0, Y: 0.9, X: 0.9, Z: 0.8, B: 0.4, '%': 0.3, '=': 0.8, M: 0.8, W: 1.6, J: 1.2, L: 1.2, '|': 1.0, '-': 1.0, H: 0.4, '{': 0.6, '}': 0.6, '*': 0.8, F: 0.5, '(': 1.4, ')': 1.4 };   // 1つずつ（X = Z B % は横の並び、Y は縦の並びで1つ）
function inPage(W) {
  const K = window.__kabe, { newWorld, appendRows, newBody, kick, physStep, airJump, canAct, spikeHit } = K._dbg, CHECK = K.CHECK, PIECES = K.PIECES;
  const CELL = 18, HB = 10, DT = 1 / 120;
    function analyze(id) {
    const pc = PIECES[id], w = Object.assign(newWorld(), { gustAlways: true }), bottom = pc.rows[0], top = pc.rows[pc.rows.length - 1], rows = [];
    for (let i = 0; i < CHECK.padBelow; i++) rows.push(bottom); for (const r of pc.rows) rows.push(r); for (let i = 0; i < CHECK.padAbove; i++) rows.push(top);
    appendRows(w, rows); if (pc.lowg) w.lowg.push([CHECK.padBelow, CHECK.padBelow + pc.rows.length - 1]);
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
      if (W[ch] === undefined) continue;
      if (ch === 'J' || ch === 'L') {   // 曲がるトゲブロック：道すじの端（となりが1つ）2つで1つ
        const nb = [[0, 1], [0, -1], [1, 0], [-1, 0]].filter(([dr, dc]) => R[r + dr] && R[r + dr][c + dc] === ch).length;
        if (nb <= 1) haz[ch] = (haz[ch] || 0) + 0.5; continue; }
      const run = ch === 'Y' || ch === '|' || ch === 'F' || ch === '(' || ch === ')' ? (R[r - 1] && R[r - 1][c] === ch) : 'X=ZB%-'.includes(ch) ? R[r][c - 1] === ch : false;   // 並びのはじめだけ数える
      if (!run) haz[ch] = (haz[ch] || 0) + 1; }
    let h = 0; for (const c in haz) h += W[c] * haz[c];
    const bits = n ? tot / n : 99;
    return { id, D: +(bits + h + ceil * 0.4 + (pc.rain ? 0.6 : 0)).toFixed(1), rain: pc.rain, bits: +bits.toFixed(1), haz, spikes, ceil, diff: pc.diff };
  }
  window.__diff = analyze;
}
async function inject(page) { await page.evaluate(`(${inPage.toString()})(${JSON.stringify(DIFF_W)})`); }
module.exports = { TARGET, LOW, HIGH, DIFF_W, inject };
