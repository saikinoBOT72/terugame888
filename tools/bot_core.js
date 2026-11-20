// 自動プレイヤー（ボット）：本物の update() でパーツ1つを遊ぶ。tools/bot.js と pools.html の再生が使う。
// index.html は全体が (() => {…})() で包まれているので、配るときに中（window.__kabe の手前）へ差し込んで window.__bot として動かす（serve）。
//  - 張り付く／床に立つたびに「何秒待って蹴るか × 2段ジャンプをいつ押すか」を、いまの状態を保存して本物で試す（2手先まで）。
//    2手先の着地点の良し悪しは、到達チェックと同じ「動く物なし」の地図で「ゴールまであと何手か」を見る。
//  - 当たったら失敗（ダメージは1回もだめ）。水晶なし・アドバンス・溶岩なし。
//  - 人らしさ：決めた押す時間に、ずれ（標準偏差 sigma 秒）を足して押す。
const BOT = {
  waits: [0, 0.12, 0.25, 0.4, 0.6, 0.85],   // 張り付いてから蹴るまで待つ秒
  djStep: 1 / 12, djMax: 1.6,               // 蹴ってから2段ジャンプを押すまでの秒
  maxT: 3.5, settle: 0.08,                  // 1手の長さの上限・着地後に待つ秒
  top: 6,                                   // 2手目まで読む1手目の数
  hold: 0.5,                                // 「押さずに待つ」手の秒（動く物のタイミング待ち）
  nearHurt: 40,                             // となりの押し方で当たるときの減点（1手=100）
  runT: 45, maxMoves: 40,                   // 1回の挑戦の上限
};
function botInPage(BOT) {
  let ROWS = null, goalY = 0, mapNodes = null;
  ensureAhead = function () {};   // パーツ1つの世界から先を作らない
  function rowsOf(id) { const pc = PIECES[id], b = pc.rows[0], t = pc.rows[pc.rows.length - 1], r = []; for (let i = 0; i < CHECK.padBelow; i++) r.push(b); for (const x of pc.rows) r.push(x); for (let i = 0; i < CHECK.padAbove; i++) r.push(t); return r; }
  // 動く物なしの地図（到達チェックと同じ総当たり）：着地点ごとに「ゴールまであと何手か」
  function buildMap(id) {
    const pc = PIECES[id], w = newWorld(); w.gustAlways = false; appendRows(w, rowsOf(id));
    const gy = -(CHECK.padBelow + pc.rows.length + 1) * CELL, key = b => (b.side ? 'w' + b.side : 'f') + ',' + Math.round(b.x / 3) + ',' + Math.round(b.y / 3);
    const bottom = pc.rows[0], cl = bottom.indexOf('.'), cr = bottom.lastIndexOf('.');
    const st = new Map(), outs = new Map(), q = [];
    const add = b => { const k = key(b); if (!st.has(k)) { st.set(k, b); outs.set(k, []); q.push(k); } return k; };
    for (let y = -2 * CELL - HB; y > -CHECK.padBelow * CELL + HB; y -= 6) { add(newBody(cl * CELL + HB, y, -1)); add(newBody((cr + 1) * CELL - HB, y, 1)); }
    const dj = [null]; for (let t = CHECK.djStep; t <= CHECK.djMax; t += CHECK.djStep) dj.push(t);
    while (q.length && st.size < 4000) {
      const k = q.shift(), s = st.get(k), o = outs.get(k);
      for (const d of dj) {
        const b = JSON.parse(JSON.stringify(s)); kick(w, b); let t = 0, r = null;
        while (t < CHECK.maxT) {
          if (d !== null && b.air > 0 && t >= d && !canAct(b)) airJump(b);
          const ev = physStep(w, b, DT); t += DT;
          if (spikeHit(w, b.x, b.y, b.grace > 0 ? b.graceSide : null)) { r = 'hurt'; break; }
          if (b.y < gy) { r = 'goal'; break; }
          if (ev === 'wall' || ev === 'floor') { for (let u = 0; u < CHECK.settle; u += DT) physStep(w, b, DT); r = 'land'; break; }
        }
        if (r === 'goal') o.push('goal'); else if (r === 'land') { const n = add(b); if (n !== k) o.push(n); }
        if (d !== null && t < d) break;
      }
    }
    const dist = new Map(), rev = new Map(), qq = [];
    for (const k of st.keys()) rev.set(k, []);
    for (const [k, o] of outs) for (const n of o) if (n === 'goal') { if (!dist.has(k)) { dist.set(k, 1); qq.push(k); } } else rev.get(n).push(k);
    while (qq.length) { const k = qq.shift(); for (const p of rev.get(k)) if (!dist.has(p)) { dist.set(p, dist.get(k) + 1); qq.push(p); } }
    return [...st.entries()].map(([k, b]) => ({ x: b.x, y: b.y, side: b.side || 0, d: dist.has(k) ? dist.get(k) : 30 }));
  }
  // 着地点の良さ（大きいほど良い）：地図でいちばん近い同じ向きの点の「あと何手」。地図に無い所は高さで見る
  function value() {
    let best = null, bd = 1e9;
    for (const n of mapNodes) { if (n.side !== (P.side || 0)) continue; const d = Math.hypot(n.x - P.x, n.y - P.y); if (d < bd) { bd = d; best = n; } }
    const steps = best && bd < 30 ? best.d + bd / 30 : 30;
    return -steps * 100 + (goalY - P.y) * 0.02;
  }
  // いまの状態を丸ごと保存／戻す（動く物・崩れる足場の中身も）
  const snap = () => structuredClone({ P, G, A, cam, inputBuf, inputDir, holding, w: { obs: world.obs, crumbleAt: world.crumbleAt, broken: world.broken, springHit: world.springHit, bounceHit: world.bounceHit || null, stakeAmt: world.stakeAmt, popOn: world.popOn, dynEdges: world.dynEdges, time: world.time } });
  function load(s0) {
    const s = structuredClone(s0); P = s.P; G = s.G; Object.assign(A, s.A); Object.assign(cam, s.cam); inputBuf = s.inputBuf; inputDir = s.inputDir; holding = s.holding;
    Object.assign(world, s.w); state = 'play'; particles = []; floaters = []; flyers = []; trail = [];
  }
  // 1手：w 秒待って押す（蹴る）。d 秒後にまだ空中なら2段ジャンプ。結果 hurt／goal／land／none と、かかった秒
  function step(a) {
    const hp0 = G.hp; let t = 0, pressed = false, rel = false, djDone = a.d == null, air = false, landT = -1;
    if (a.hold) {   // 押さずに待つ：待ったあと、離れて落ちていたら着くまで進める
      while (t < a.w + BOT.maxT) {
        update(DT); t += DT;
        if (G.hp < hp0 || state !== 'play') return { r: 'hurt', t, dj: true };
        if (t >= a.w && canAct(P)) return { r: 'land', t, dj: true };
      }
      return { r: 'none', t, dj: true };
    }
    while (t < a.w + BOT.maxT) {
      if (!pressed && t >= a.w - 1e-9) { press(); pressed = true; rel = true; }
      else if (rel) { release(); rel = false; }
      if (pressed && !djDone && t >= a.w + a.d - 1e-9 && !canAct(P)) { press(); release(); djDone = true; }
      update(DT); t += DT;
      if (G.hp < hp0 || state !== 'play') return { r: 'hurt', t, dj: djDone };
      if (P.y < goalY) return { r: 'goal', t, dj: djDone };
      if (pressed) {
        if (!canAct(P)) { air = true; landT = -1; }
        else if (air) { if (landT < 0) landT = t; if (t - landT >= BOT.settle) return { r: 'land', t, dj: djDone }; }
      }
    }
    return { r: 'none', t, dj: djDone };
  }
  const djList = (() => { const l = [null]; for (let t = BOT.djStep; t <= BOT.djMax + 1e-9; t += BOT.djStep) l.push(t); return l; })();
  // 1つの状態から全部の押し方を試す。返り値：[{a, r, t, v, s}]（s は着地後の状態）
  function tryAll(s0, keep, t0 = 0) {   // t0：ここまでにかかった秒（早いほど良い）
    const out = [];
    { load(s0); const res = step({ w: BOT.hold, hold: true }); const o = { a: { w: BOT.hold, d: null, wi: -9, di: 0, hold: true }, r: res.r, t: res.t, v: res.r === 'land' ? value() - 5 - (t0 + res.t) * 5 : res.r === 'hurt' ? -1e9 : -1e8 }; if (keep && res.r === 'land') o.s = snap(); out.push(o); }
    for (let wi = 0; wi < BOT.waits.length; wi++) for (let di = 0; di < djList.length; di++) {
      load(s0); const a = { w: BOT.waits[wi], d: djList[di], wi, di }, res = step(a);
      const o = { a, r: res.r, t: res.t, v: res.r === 'goal' ? 1e5 - (t0 + res.t) * 100 : res.r === 'land' ? value() - (t0 + res.t) * 5 : res.r === 'hurt' ? -1e9 : value() - 2000 };
      if (keep && res.r === 'land') o.s = snap();
      out.push(o);
      if (!res.dj) {   // 2段ジャンプを押す前に終わった＝これより遅い押し方も同じ
        for (let dj = di + 1; dj < djList.length; dj++) out.push(Object.assign({}, o, { a: { w: a.w, d: djList[dj], wi, di: dj }, dup: true }));
        break;
      }
    }
    return out;
  }
  // 2手先まで読んで、いちばん良い押し方を選ぶ
  function plan() {
    const s0 = snap(), first = tryAll(s0, true), grid = new Map(first.map(o => [o.a.wi + ',' + o.a.di, o]));
    const cands = first.filter(o => o.r === 'land' && !o.dup).sort((p, q) => q.v - p.v), seen = new Set(), deep = [];
    for (const o of cands) { const k = Math.round(o.s.P.x / 6) + ',' + Math.round(o.s.P.y / 6) + ',' + (o.s.P.side || 0); if (seen.has(k)) continue; seen.add(k); deep.push(o); if (deep.length >= BOT.top) break; }
    const v2 = new Map();
    for (const o of deep) { const sec = tryAll(o.s, false, o.t); let b = -1e9; for (const q of sec) if (q.v > b) b = q.v; v2.set(o.s, b > -1e8 ? Math.max(b, o.v - 100) : o.v - 5000); }   // 2手目がどれも当たる＝行き止まり
    let best = null, bs = -Infinity;
    for (const o of first) {
      if (o.r === 'hurt') continue;
      let sc = o.r === 'land' ? (v2.has(o.s) ? v2.get(o.s) : o.v - 150) : o.v;
      for (const [dw, dd] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const n = grid.get((o.a.wi + dw) + ',' + (o.a.di + dd)); if (n && n.r === 'hurt') sc -= BOT.nearHurt; }
      if (sc > bs) { bs = sc; best = o; }
    }
    load(s0);
    return best && { w: best.a.w, d: best.a.d, hold: !!best.a.hold, score: bs, kind: best.r };
  }
  const gauss = () => { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); };
  // 1回挑戦する。side: -1 左の壁から／1 右の壁から、t0: 始める時刻（動く物の位相）、sigma: 押す時間のずれ（秒）
  function run(id, { side = -1, t0 = 0, sigma = 0, trace = false } = {}) {
    MODE = 'advance'; newGame();
    ROWS = rowsOf(id); world = newWorld(); appendRows(world, ROWS);
    goalY = -(CHECK.padBelow + PIECES[id].rows.length + 1) * CELL;
    const bottom = ROWS[0], cl = bottom.indexOf('.'), cr = bottom.lastIndexOf('.');
    P = side < 0 ? newBody(cl * CELL + HB, -3 * CELL - HB, -1) : newBody((cr + 1) * CELL - HB, -3 * CELL - HB, 1);
    Object.assign(G, { time: t0, hp: 99, lavaY: 1e9, lavaDelay: 1e9, gems: {}, equip: [] }); world.time = t0;
    state = 'play'; particles = [];
    const T0 = performance.now(), path = trace ? [{ x: P.x, y: P.y, t: 0 }] : null, moves = [];
    let res = 'time', settleN = 0;
    for (let m = 0; m < BOT.maxMoves && G.time - t0 < BOT.runT; m++) {
      if (!canAct(P)) { update(DT); if (++settleN > 600) break; m--; continue; }   // 空中（はじかれた等）：降りるまで進める
      const p = plan();
      if (!p) { res = 'stuck'; break; }
      const a = p.hold ? p : { w: Math.max(0, p.w + sigma * gauss()), d: p.d == null ? null : Math.max(1 / 60, p.d + sigma * gauss()) };
      moves.push(p.hold ? ['待つ', p.w] : [+p.w.toFixed(2), p.d == null ? null : +p.d.toFixed(2)]);
      const r = trace ? stepTrace(a, path) : step(a);
      if (r.r === 'hurt') { res = 'hurt'; break; }
      if (r.r === 'goal') { res = 'goal'; break; }
    }
    const out = { id, side, t0: +t0.toFixed(2), sigma, res, time: +(G.time - t0).toFixed(2), moves: moves.length, ms: Math.round(performance.now() - T0), row: Math.floor(-P.y / CELL) - CHECK.padBelow };   // row：最後にいた行（パーツの下から 0、マイナスは下の足し分）
    if (trace) { out.path = path; out.plan = moves; }
    state = 'title';
    return out;
  }
  function stepTrace(a, path) { const u = update; let n = 0; update = dt => { u(dt); if (++n % 3 === 0) path.push({ x: +P.x.toFixed(1), y: +P.y.toFixed(1), t: +G.time.toFixed(3) }); }; try { return step(a); } finally { update = u; } }
  window.__bot = { BOT, run, setMap: id => { mapNodes = buildMap(id); return mapNodes.length; } };
}
// リポジトリを http で配る小さなサーバー。index.html だけ、ボットを差し込んだものを返す
function serve() {
  const http = require('http'), fs = require('fs'), path = require('path'), root = path.resolve(__dirname, '..');
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
  const html = () => { const s = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), at = s.lastIndexOf('window.__kabe = {'); return s.slice(0, at) + `(${botInPage.toString()})(${JSON.stringify(BOT)});\n` + s.slice(at); };
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]), f = path.join(root, u === '/' ? 'index.html' : u);
    if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
    if (f === path.join(root, 'index.html')) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(html()); }
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${srv.address().port}/index.html`, close: () => srv.close() })));
}
module.exports = { BOT, serve };
