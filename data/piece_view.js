/* パーツの見本の描き方（window.KABE_VIEW）。プール一覧（pools.html）とパーツメーカー（maker.html）が使う。
   Kabe（bundle.js）は描くときだけ使うので、node からも読める（tools/check.js が mounts を使う）。 */
window.KABE_VIEW = (function () {
'use strict';
const K = window.Kabe, CELL = 18;   // Kabe は bundle.js（node では無いが、mounts は使わない）
const OB = { boxX: [26, 18], boxY: [20, 26], spin: 40, popOff: 1.6 };   // 本編の OB と同じ大きさ
const LOOKS = [['underground', 0], ['underground', 1], ['underground', 2], ['underground', 3], ['surface', 0], ['surface', 1], ['surface', 2], ['surface', 3], ['sky', 0], ['sky', 1], ['sky', 2], ['sky', 3], ['space', 0], ['space', 1], ['space', 2], ['space', 3]];   // 本編の LOOKS と同じ
const lookPal = m => { const L = LOOKS[Math.max(0, Math.min(LOOKS.length - 1, Math.floor(m / 100)))]; return K.stagePal(L[0], L[1]); };
const NAMES = { p: '出入りトゲ', q: '出入りトゲ', '>': '扇風機', '<': '扇風機', X: '往復ブロック', Y: '上下ブロック', T: '回る棒', '=': 'シャッター', '^': 'トゲ', '/': '斜め', '\\': '斜め',
  O: '振り子', K: '筒', k: '筒', Z: '杭', B: '跳ね橋', S: 'バネ', '%': '崩れる足場', '~': '雲の足場', M: '機雷', J: 'トゲブロック縦', L: 'トゲブロック横', '|': '雷の柱', '-': '雷の柱（横）', E: '雷の装置', H: 'ぽよんブロック', '{': '突風', '}': '突風', W: '風車',
  '@': '引力の星', '*': 'とげ星', C: '回る衛星', R: '浮き岩', U: '衝撃波の輪', F: '熱くなる壁', V: 'センサー機雷' };
const SPACE = { wellR: 81, sstarR: 63, satR: 40, satSpeed: 1.1, satBalls: 2, rockAmp: 12, rockPeriod: 4.2, ringPeriod: 3.4, ringWarn: 0.8, ringGrow: 1.1, ringMax: 81, ringGap: 0.5, heatPeriod: 3.6, heatOn: 1.2, heatWarn: 1.0 };   // 本編の SPACE と同じ
const SKY = { bendSpeed: 50, bendCorner: 0.25, bendEnd: 0.5 };   // 本編の SKY と同じ（曲がるトゲブロック）
const SURF = { pendLen: 54, pendAmp: 1.05, pendPeriod: 2.6, canPeriod: 2.8, canSpeed: 120, canWarn: 0.5 };   // 本編の SURF と同じ

// パーツ1つを描く。rows は上の行から
// タイミング（ずらし）は本編の addObstacles と同じ式。本編の行は下から数えたステージ全体の行なので、
// パーツのいちばん下を行 r0（ふつう 0）に置いたものとして数える（機雷・雷は置く高さで変わるので、r0 を変えると別の出方になる）
function prepare(pc, r0 = 0) {
  const rows = pc.rows.slice().reverse(), h = rows.length, at = (c, r) => (rows[r] || '')[c] || '.', R = r => r0 + h - 1 - r;
  const map = rows.map(r => r.replace(/[Kk]/g, '#').replace(/[^#.^/\\]/g, '.'));
  const grid = K.grid(map, '.'), obs = [], seen = new Set();
  // 曲がるトゲブロックの道すじ：同じ文字のつながりを端からたどって、角の点だけ残す
  // 曲がるトゲブロック：本編の railObstacle と同じ（行は下から数える。下の行・左の列から見つけ、同じ順にたどり、角と端で止まる）
  const B = (c, rb) => rb >= 0 && rb < h ? at(c, h - 1 - rb) : '.';
  const railOf = (c0, rb0, ch) => {
    const cells = [], q = [[c0, rb0]]; seen.add(c0 + ',' + rb0);
    while (q.length) { const [c, r] = q.pop(); cells.push([c, r]); for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (c + dc) + ',' + (r + dr); if (B(c + dc, r + dr) === ch && !seen.has(k)) { seen.add(k); q.push([c + dc, r + dr]); } } }
    const nb = ([c, r]) => cells.filter(([a, b]) => Math.abs(a - c) + Math.abs(b - r) === 1);
    let cur = cells.find(p => nb(p).length <= 1) || cells[0]; const order = [cur], used = new Set([cur.join()]);
    for (;;) { const nx = nb(cur).find(p => !used.has(p.join())); if (!nx) break; order.push(nx); used.add(nx.join()); cur = nx; }
    const pts = []; order.forEach((p, i) => { const a = order[i - 1], b = order[i + 1]; if (!a || !b || p[0] - a[0] !== b[0] - p[0] || p[1] - a[1] !== b[1] - p[1]) pts.push([(p[0] + 0.5) * CELL, (h - p[1] - 0.5) * CELL]); });
    const plan = [], go = list => { for (let i = 0; i < list.length - 1; i++) { const a = list[i], b = list[i + 1]; plan.push({ a, b, d: Math.hypot(b[0] - a[0], b[1] - a[1]) / SKY.bendSpeed }); plan.push({ a: b, b, d: i === list.length - 2 ? SKY.bendEnd : SKY.bendCorner }); } };
    go(pts); go(pts.slice().reverse());
    return { k: 'rail', pts, plan, period: plan.reduce((s2, p) => s2 + p.d, 0), off: c0 * 0.41 + (r0 + rb0) * 0.23, w: ch === 'J' ? 18 : 36, h: ch === 'J' ? 36 : 18 };
  };
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    const x = c * CELL, y = r * CELL;
    if (ch === 'p' || ch === 'q') obs.push({ k: 'pop', x, y, q: ch === 'q', dir: at(c - 1, r) === '#' ? 'L' : at(c + 1, r) === '#' ? 'R' : at(c, r + 1) === '#' ? 'B' : 'T' });
    if (ch === '>' || ch === '<') { const d = ch === '>' ? 1 : -1; let k = c; while (k + d >= 0 && k + d < 20 && at(k + d, r) !== '#') k += d; const fx = d > 0 ? x : x + CELL; obs.push({ k: 'fan', x: fx, y: y + CELL / 2, dir: d > 0 ? 'R' : 'L', reach: Math.abs((d > 0 ? (k + 1) * CELL : k * CELL) - fx) }); }
    if (ch === 'X' && at(c - 1, r) !== 'X') { let e = c; while (at(e + 1, r) === 'X') e++; obs.push({ k: 'x', x0: (c + 0.5) * CELL, x1: (e + 0.5) * CELL, y: y + CELL / 2, period: (e - c) * CELL / 45 + 1, off: c * 0.7 + R(r) * 0.3 }); }
    if (ch === 'Y' && at(c, r - 1) !== 'Y') { let e = r; while (at(c, e + 1) === 'Y') e++; obs.push({ k: 'y', x: (c + 0.5) * CELL, y0: (e + 0.5) * CELL, y1: (r + 0.5) * CELL, period: (e - r) * CELL / 45 + 1, off: c * 0.5 + R(e) * 0.3 }); }
    if (ch === 'T') obs.push({ k: 'spin', x: x + CELL / 2, y: y + CELL / 2, speed: c < 10 ? 1.5 : -1.5 });
    if (ch === '=' && at(c - 1, r) !== '=') { let e = c; while (at(e + 1, r) === '=') e++; obs.push({ k: 'shut', x0: x, x1: (e + 1) * CELL, y: y + CELL / 2, off: R(r) * 0.7 }); }
    const wall = cc => '#Kk'.includes(at(cc, r));
    if (ch === 'O') obs.push({ k: 'pend', x: x + CELL / 2, y, off: c * 0.31 + R(r) * 0.53 });
    if (ch === 'K' || ch === 'k') { const d = ch === 'K' ? 1 : -1; let k = c + d; while (k >= 0 && k < 20 && !wall(k)) k += d; const fx = d > 0 ? x + CELL : x; obs.push({ k: 'can', x: fx, y: y + CELL / 2, dir: d, reach: Math.abs((d > 0 ? k * CELL : (k + 1) * CELL) - fx), off: c * 0.9 + R(r) * 0.41 }); }
    if ((ch === 'Z' || ch === 'B') && at(c - 1, r) !== ch) { let e = c; while (at(e + 1, r) === ch) e++; const d = wall(c - 1) ? 1 : -1; obs.push({ k: ch === 'Z' ? 'stake' : 'bridge', x0: d > 0 ? x : (e + 1) * CELL, y: y + CELL / 2, dir: d, len: (e - c + 1) * CELL, off: c * 0.4 + R(r) * 0.37 }); }
    if (ch === 'S') obs.push({ k: 'spring', x, y });
    if (ch === '%' && at(c - 1, r) !== '%') { let e = c; while (at(e + 1, r) === '%') e++; obs.push({ k: 'crumble', x, y, n: e - c + 1 }); }
    // 上空の仕掛け
    if (ch === '~' && at(c - 1, r) !== '~') { let e = c; while (at(e + 1, r) === '~') e++; obs.push({ k: 'cloud', x, y, w: (e - c + 1) * CELL }); }
    if (ch === 'M') obs.push({ k: 'mine', x: x + CELL / 2, y: y + CELL / 2, off: K.hash(c, R(r), 13) * 4, per: 2.8 * (0.85 + K.hash(c, R(r), 15) * 0.3), amp: 12 * (0.75 + K.hash(c, R(r), 14) * 0.5) });   // 本編と同じずらし方
    if (ch === 'W') obs.push({ k: 'mill', x: x + CELL / 2, y: y + CELL / 2, speed: c < 10 ? 0.9 : -0.9 });
    if (ch === 'E') {   // 雷の装置：下へ | が続いて E があれば縦、右へ - が続いて E があれば横
      if (at(c, r + 1) === '|') { let e = r + 1; while (at(c, e) === '|') e++; if (at(c, e) === 'E') obs.push({ k: 'bolt', v: true, x: x + CELL / 2, a: (r + 1) * CELL, b: e * CELL, ends: [[x + CELL / 2, y + CELL / 2, 'down'], [x + CELL / 2, (e + 0.5) * CELL, 'up']], off: K.hash(c, R(r), 21) * 2.8 }); }
      if (at(c + 1, r) === '-') { let e = c + 1; while (at(e, r) === '-') e++; if (at(e, r) === 'E') obs.push({ k: 'bolt', v: false, y: y + CELL / 2, a: (c + 1) * CELL, b: e * CELL, ends: [[x + CELL / 2, y + CELL / 2, 'right'], [(e + 0.5) * CELL, y + CELL / 2, 'left']], off: K.hash(c, R(r), 22) * 2.8 }); }
    }
    if (ch === 'H') obs.push({ k: 'jelly', x, y });
    // 宇宙の仕掛け（ずらし方は本編の addObstacles と同じ）
    if (ch === '@') obs.push({ k: 'gstar', x: x + CELL / 2, y: y + CELL / 2 });
    if (ch === '*') obs.push({ k: 'sstar', x: x + CELL / 2, y: y + CELL / 2, spin: K.hash(c, R(r), 31) });
    if (ch === 'C') obs.push({ k: 'sat', x: x + CELL / 2, y: y + CELL / 2, speed: (c < 10 ? 1 : -1) * SPACE.satSpeed, phase: K.hash(c, R(r), 32) * 6.28 });
    if (ch === 'R' && at(c - 1, r) !== 'R') { let e = c; while (at(e + 1, r) === 'R') e++; obs.push({ k: 'rock', x, y, w: (e - c + 1) * CELL, off: K.hash(c, R(r), 33) * SPACE.rockPeriod }); }
    if (ch === 'U') obs.push({ k: 'ring', x: x + CELL / 2, y: y + CELL / 2, off: K.hash(c, R(r), 34) * SPACE.ringPeriod, gap0: K.hash(c, R(r), 35) * 6.28 });
    if (ch === 'V') obs.push({ k: 'sense', x: x + CELL / 2, y: y + CELL / 2 });
    if (ch === 'F' && at(c, r + 1) !== 'F') { let e = r; while (at(c, e - 1) === 'F') e--; obs.push({ k: 'heat', x, y0: e * CELL, y1: (r + 1) * CELL, off: K.hash(c, R(r), 36) * SPACE.heatPeriod }); }   // 本編と同じく下のはしから数える
    if (ch === '}' || ch === '{') { const d = ch === '}' ? 1 : -1; let k = c; while (k + d >= 0 && k + d < 20 && at(k + d, r) !== '#') k += d; const fx = d > 0 ? x : x + CELL; obs.push({ k: 'gust', x: fx, y: y + CELL / 2, dir: d, reach: Math.abs((d > 0 ? (k + 1) * CELL : k * CELL) - fx), off: R(r) * 0.47 }); }
  }));
  for (let rb = 0; rb < h; rb++) for (let c = 0; c < 20; c++) { const ch = B(c, rb); if ((ch === 'J' || ch === 'L') && !seen.has(c + ',' + rb)) obs.push(railOf(c, rb, ch)); }
  if (pc.station) obs.push({ k: 'house', x: (pc.station.c + 0.5) * CELL, y: (pc.rows.length - pc.station.r) * CELL });   // G のマスに家
  const kinds = [...new Set(rows.join('').split('').filter(ch => NAMES[ch]).map(ch => NAMES[ch]))];
  if (pc.lowg) kinds.push('ふわり帯');
  return { w: 20 * CELL, h: h * CELL, grid, obs, kinds };
}
function draw(g, P, d, t) {
  K.background(g, P, 0, 0, d.w, d.h, t, 0);
  K.terrain(g, P, d.grid, t);
  for (const o of d.obs) {
    if (o.k === 'pop') K.popSpike(g, P, o.x, o.y, o.dir, t, o.q ? { offset: OB.popOff } : undefined);
    else if (o.k === 'fan') K.fan(g, P, o.x, o.y, o.dir, o.reach, t);
    else if (o.k === 'x') { const [w, h] = OB.boxX, cx = o.x0 + (o.x1 - o.x0) * K.slide(t, o.period, o.off); K.track(g, P, o.x0 - w / 2, o.y, o.x1 + w / 2, o.y); K.ironBox(g, P, cx - w / 2, o.y - h / 2, w, h, 'x'); }
    else if (o.k === 'y') { const [w, h] = OB.boxY, cy = o.y0 + (o.y1 - o.y0) * K.slide(t, o.period, o.off); K.track(g, P, o.x, o.y0 + h / 2, o.x, o.y1 - h / 2); K.ironBox(g, P, o.x - w / 2, cy - h / 2, w, h, 'y'); }
    else if (o.k === 'spin') K.spinner(g, P, o.x, o.y, OB.spin, K.spinAngle(t, o.speed));
    else if (o.k === 'shut') K.shutter(g, P, o.x0, o.x1, o.y, t, { offset: o.off });
    else if (o.k === 'house') K.gachaHouse(g, P, o.x, o.y, t, true);
    else if (o.k === 'pend') K.pendulum(g, P, o.x, o.y, SURF.pendLen, K.pendAngle(t, { offset: o.off, amp: SURF.pendAmp, period: SURF.pendPeriod }));
    else if (o.k === 'can') {
      const ph = ((t + o.off) % SURF.canPeriod + SURF.canPeriod) % SURF.canPeriod;
      for (let age = ph; 6 + age * SURF.canSpeed < o.reach - 4; age += SURF.canPeriod) K.cannonBall(g, P, o.x + o.dir * (6 + age * SURF.canSpeed), o.y);
      K.cannon(g, P, o.x, o.y, o.dir, ph > SURF.canPeriod - SURF.canWarn && ph % 0.2 < 0.1);
    }
    else if (o.k === 'stake') { const st = K.stakeState(t, { offset: o.off }); K.stake(g, P, o.x0, o.y, o.dir, o.len, st.amount, st.s === 'warn' && st.e % 0.24 < 0.12); }
    else if (o.k === 'bridge') { const st = K.bridgeState(t, { offset: o.off }); K.bridge(g, P, o.x0, o.y, o.dir, o.len, st.ang, st.s === 'warn' && st.e % 0.3 < 0.15); }
    else if (o.k === 'spring') K.spring(g, P, o.x, o.y, 0);
    else if (o.k === 'crumble') K.crumble(g, P, o.x, o.y, o.n, 0, t);
    else if (o.k === 'cloud') K.cloudPlat(g, P, o.x, o.y, o.w, t);
    else if (o.k === 'mine') K.mine(g, P, o.x, o.y + Math.sin((t + o.off) * Math.PI * 2 / o.per) * o.amp);
    else if (o.k === 'mill') K.windmill(g, P, o.x, o.y, 22, K.spinAngle(t, o.speed * 0.6 / 0.9), 3);
    else if (o.k === 'bolt') {
      const ph = ((t + o.off) % 2.8 + 2.8) % 2.8;
      if (ph > 2.35) { if (o.v) K.lightningBolt(g, o.x, o.a, o.b, 1, Math.floor(t * 18)); else { g.save(); g.translate(o.a, o.y); g.rotate(-Math.PI / 2); K.lightningBolt(g, 0, 0, o.b - o.a, 1, Math.floor(t * 18)); g.restore(); } }
      for (const [ex, ey, dir] of o.ends) K.electrode(g, P, ex, ey, dir, ph > 1.65);
    }
    else if (o.k === 'jelly') K.jellyBlock(g, P, o.x, o.y, 0);
    else if (o.k === 'gust') { const ph = ((t + o.off) % 3.4 + 3.4) % 3.4, on = ph > 1.8; if (on) K.fan(g, P, o.x, o.y, o.dir > 0 ? 'R' : 'L', o.reach, t * 2); K.gustVent(g, P, o.x, o.y, o.dir, ph > 1.1 && !on && ph % 0.24 < 0.12); }
    else if (o.k === 'gstar') K.gravStar(g, P, o.x, o.y, SPACE.wellR);
    else if (o.k === 'sstar') { g.save(); g.translate(o.x, o.y); g.rotate(t * 0.6 + o.spin * 6); K.spikeStar(g, P, 0, 0, SPACE.sstarR, 0); g.restore(); }
    else if (o.k === 'sat') { K.satellite(g, P, o.x, o.y, SPACE.satR); for (let k = 0; k < SPACE.satBalls; k++) { const a = o.phase + t * o.speed + k * Math.PI * 2 / SPACE.satBalls; K.mine(g, P, o.x + Math.cos(a) * SPACE.satR, o.y + Math.sin(a) * SPACE.satR, 6); } }
    else if (o.k === 'rock') K.floatRock(g, P, o.x, o.y + Math.sin((t + o.off) * Math.PI * 2 / SPACE.rockPeriod) * SPACE.rockAmp, o.w, t);
    else if (o.k === 'heat') { const ph = ((t + o.off) % SPACE.heatPeriod + SPACE.heatPeriod) % SPACE.heatPeriod, s0 = SPACE.heatPeriod - SPACE.heatOn, k = ph >= s0 ? 1 : ph >= s0 - SPACE.heatWarn ? (ph - s0 + SPACE.heatWarn) / SPACE.heatWarn : 0;
      for (let yy = o.y0; yy < o.y1; yy += CELL) K.heatPanel(g, P, o.x, yy, k); }
    else if (o.k === 'sense') K.senseMine(g, P, o.x, o.y, 'idle', false);
    else if (o.k === 'ring') {
      const u = t + o.off, n = Math.floor(u / SPACE.ringPeriod), ph = u - n * SPACE.ringPeriod, gap = o.gap0 + n * Math.PI / 4;
      if (ph < SPACE.ringGrow) { const e = ph / SPACE.ringGrow, r = 9 + (SPACE.ringMax - 9) * (1 - (1 - e) * (1 - e)), fade = 1 - Math.max(0, e - 0.75) / 0.25;
        g.save(); g.strokeStyle = 'rgba(255,255,255,' + 0.95 * fade + ')'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.arc(o.x, o.y, r, gap + SPACE.ringGap, gap + Math.PI * 2 - SPACE.ringGap); g.stroke(); g.restore(); }
      K.pulseEmitter(g, P, o.x, o.y, ph > SPACE.ringPeriod - SPACE.ringWarn ? (ph - SPACE.ringPeriod + SPACE.ringWarn) / SPACE.ringWarn : 0);
    }
    else if (o.k === 'rail') {   // 本編の railPos と同じ（角と端で止まり、なめらかに動き出す）
      K.railPath(g, P, o.pts); let u = ((t + o.off) % o.period + o.period) % o.period, x = o.pts[0][0], y = o.pts[0][1];
      for (const p of o.plan) { if (u <= p.d) { const k = p.d ? u / p.d : 1, e = k * k * (3 - 2 * k); x = p.a[0] + (p.b[0] - p.a[0]) * e; y = p.a[1] + (p.b[1] - p.a[1]) * e; break; } u -= p.d; }
      K.spikeBlock(g, P, x - o.w / 2, y - o.h / 2, o.w, o.h);
    }
  }
}

// 壁につく物の置き場所：つけ根が壁でない＝浮いている。扇風機・突風は1マスより背が高いので、つけ根の上下も壁（か斜め）でないと角からはみ出す
function mounts(PIECES, only) {
  const W = ch => !!ch && '#SKk%EH@UF'.includes(ch), WS = ch => W(ch) || ch === '/' || ch === '\\', out = [];
  for (const id of only ? [only] : Object.keys(PIECES)) {
    const R = PIECES[id].rows, n = R.length, at = (r, c) => R[r] && R[r][c];
    // 雷：E から下へ | が続いて E、右へ - が続いて E のときだけ組になる（本編の addObstacles と同じ）。組にならない E は見えない壁になる
    const pair = new Set();
    for (let r = 0; r < n; r++) for (let c = 0; c < 20; c++) if (at(r, c) === 'E') {
      if (at(r - 1, c) === '|') { let e = r - 1; while (at(e - 1, c) === '|') e--; if (at(e - 1, c) === 'E') for (let k = e - 1; k <= r; k++) pair.add(k + ',' + c); }
      if (at(r, c + 1) === '-') { let e = c + 1; while (at(r, e + 1) === '-') e++; if (at(r, e + 1) === 'E') for (let k = c; k <= e + 1; k++) pair.add(r + ',' + k); }
    }
    for (let r = 0; r < n; r++) for (let c = 0; c < 20; c++) {
      const ch = at(r, c), bad = msg => out.push(`${id} ${n - r}行目${c}列の ${ch}：${msg}`);
      if ((ch === 'Z' || ch === 'B') && at(r, c - 1) !== ch) { let e = c; while (at(r, e + 1) === ch) e++; if (!W(at(r, c - 1)) && !W(at(r, e + 1))) bad('どちらの端も壁についていない'); }
      if ('><}{'.includes(ch)) { const ac = ch === '>' || ch === '}' ? c - 1 : c + 1;
        if (!W(at(r, ac))) bad('うしろが壁でない'); else if (!WS(at(r + 1, ac)) || !WS(at(r - 1, ac))) bad('壁の角からはみ出す（つけ根の上下も壁にする）'); }
      if ('^pq'.includes(ch) && !W(at(r, c - 1)) && !W(at(r, c + 1)) && !W(at(r - 1, c)) && !W(at(r + 1, c))) bad('となりに壁がない');
      if ((ch === 'K' || ch === 'k') && !W(at(r, ch === 'K' ? c - 1 : c + 1))) bad('うしろが壁でない');
      if ('E|-'.includes(ch) && !pair.has(r + ',' + c)) bad(ch === 'E' ? '相手の E とつながっていない（見えない壁になる）' : 'E と E の間にない');
      if (ch === '=' && at(r, c - 1) !== '=') { let e = c; while (at(r, e + 1) === '=') e++; if (!W(at(r, c - 1)) || !W(at(r, e + 1))) bad('両はしが壁でない'); }
    }
  }
  return out;
}

return { CELL, OB, SURF, LOOKS, lookPal, NAMES, prepare, draw, mounts };
})();
