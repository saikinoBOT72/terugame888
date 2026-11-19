/* 壁蹴りタワー 素材ライブラリ（window.Kabe）
   すべての素材をこのファイルの関数で描く。色は tokens.json（tokens.css の変数）から読む。
   単位はゲーム内の px（1マス = 18px）。 */
window.Kabe = (function () {
  'use strict';
  var CELL = 18;
  var ZONES = [
    { id: 'underground', name: '地下' },
    { id: 'surface', name: '地上' },
    { id: 'sky', name: '上空' },
    { id: 'space', name: '宇宙' }
  ];
  var KEYS = ['bg-top', 'bg-bottom', 'far', 'strata-a', 'strata-b', 'terrain', 'terrain-light', 'terrain-shade', 'terrain-deep',
    'terrain-line', 'terrain-grain', 'accent', 'accent-shade', 'glow', 'ink', 'metal', 'metal-shade', 'metal-light',
    'rise', 'rise-light', 'rise-top', 'ui-ink', 'ui-muted', 'ui-panel', 'player-body', 'player-shade', 'player-line',
    'player-cheek', 'scarf', 'scarf-shade', 'scarf-stripe', 'hazard', 'hazard-shade', 'hazard-light',
    'gem-mint', 'gem-mint-shade', 'gem-blue', 'gem-blue-shade', 'gem-gold', 'gem-gold-shade'];
  var cache = {};
  function camel(k) { return k.replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); }); }
  // ゾーンの色をまとめて読む（tokens.css の [data-theme="…"] から）
  function pal(id) {
    if (cache[id]) return cache[id];
    var probe = document.createElement('div');
    probe.setAttribute('data-theme', id); probe.style.display = 'none';
    document.documentElement.appendChild(probe);
    var cs = getComputedStyle(probe), P = { id: id };
    for (var i = 0; i < KEYS.length; i++) { var v = cs.getPropertyValue('--' + KEYS[i]).trim(); P[camel(KEYS[i])] = v || '#888888'; }
    probe.remove(); cache[id] = P; return P;
  }
  var hash = function (a, b, s) { var v = Math.sin(a * 127.1 + b * 311.7 + (s || 0) * 74.7) * 43758.5453; return v - Math.floor(v); };
  function hexToRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); var n = parseInt(h.slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, t) { var A = hexToRgb(a), B = hexToRgb(b); return 'rgb(' + A.map(function (v, i) { return Math.round(v + (B[i] - v) * t); }).join(',') + ')'; }
  function alpha(h, a) { var c = hexToRgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  /* ---------- 描く道具 ---------- */
  function rr(g, x, y, w, h, r) {
    var a, b, c, d; if (Array.isArray(r)) { a = r[0]; b = r[1]; c = r[2]; d = r[3]; } else { a = b = c = d = r; }
    g.beginPath(); g.moveTo(x + a, y); g.lineTo(x + w - b, y); g.quadraticCurveTo(x + w, y, x + w, y + b); g.lineTo(x + w, y + h - c);
    g.quadraticCurveTo(x + w, y + h, x + w - c, y + h); g.lineTo(x + d, y + h); g.quadraticCurveTo(x, y + h, x, y + h - d); g.lineTo(x, y + a); g.quadraticCurveTo(x, y, x + a, y); g.closePath();
  }
  function ell(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); }
  // 縁取り（外側 lw px）＋2段の影（光は左上。影は右下に off px ずらして残る）
  function solid(g, path, base, shade, ink, off, lw) {
    off = off == null ? 1.7 : off; lw = lw == null ? 1.15 : lw;
    path(); g.lineJoin = 'round'; g.lineCap = 'round';
    if (ink) { g.strokeStyle = ink; g.lineWidth = lw * 2; g.stroke(); }
    g.save(); path(); g.clip(); g.fillStyle = shade; g.fillRect(-400, -400, 800, 800);
    g.translate(-off, -off); path(); g.fillStyle = base; g.fill(); g.restore();
  }
  function shine(g, x, y, rx, ry, a, rot) { g.fillStyle = 'rgba(255,255,255,' + (a == null ? 0.55 : a) + ')'; ell(g, x, y, rx, ry, rot == null ? -0.5 : rot); g.fill(); }
  function spline(pts, n) {
    n = n || 6; var out = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (var s = 0; s < n; s++) {
        var t = s / n, t2 = t * t, t3 = t2 * t, o = [];
        for (var k = 0; k < 2; k++) o.push(0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3));
        out.push(o);
      }
    }
    out.push(pts[pts.length - 1]); return out;
  }

  /* ---------- マス目（地形の地図。上の行から書く） ---------- */
  function grid(map, outside) {
    outside = outside || '.';
    var rows = map.length, cols = map[0].length;
    var raw = function (c, r) { return (c < 0 || c >= cols || r < 0 || r >= rows) ? outside : map[r][c]; };
    var W_ = function (t) { return t === '#'; };
    var tile = function (c, r) {
      var t = raw(c, r);
      if (t === '/') return W_(raw(c + 1, r)) + W_(raw(c, r + 1)) >= W_(raw(c - 1, r)) + W_(raw(c, r - 1)) ? 'BR' : 'TL';
      if (t === '\\') return W_(raw(c - 1, r)) + W_(raw(c, r + 1)) >= W_(raw(c + 1, r)) + W_(raw(c, r - 1)) ? 'BL' : 'TR';
      return t;
    };
    var S = { '#': 'LRTB', BR: 'RB', BL: 'LB', TL: 'LT', TR: 'RT' }, has = function (t, s) { return (S[t] || '').indexOf(s) >= 0; };
    var exp = function (c, r) { var t = tile(c, r); return { t: has(t, 'T') && !has(tile(c, r - 1), 'B'), b: has(t, 'B') && !has(tile(c, r + 1), 'T'), l: has(t, 'L') && !has(tile(c - 1, r), 'R'), r: has(t, 'R') && !has(tile(c + 1, r), 'L') }; };
    var depth = function (c, r) {
      for (var d = 1; d <= 2; d++) for (var dy = -d; dy <= d; dy++) for (var dx = -d; dx <= d; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
        var cc = c + dx, r2 = r + dy;
        if (cc < 0 || cc >= cols || r2 < 0 || r2 >= rows) { if (outside !== '#') return d - 1; continue; }
        if (tile(cc, r2) !== '#') return d - 1;
      }
      return 2;
    };
    var spikeDir = function (c, r) { return W_(raw(c - 1, r)) ? 'L' : W_(raw(c + 1, r)) ? 'R' : W_(raw(c, r + 1)) ? 'B' : W_(raw(c, r - 1)) ? 'T' : 'L'; };
    return { rows: rows, cols: cols, raw: raw, tile: tile, exp: exp, depth: depth, spikeDir: spikeDir };
  }

  /* ---------- ゾーンの「しるし」：形は同じ決まり、モチーフだけ変える ---------- */
  var MOTIF = {
    underground: { grain: 'pebble', lip: 'moss', under: 'root', decor: 'mushroom', far: 'stalactite', rise: 'lava' },
    surface: { grain: 'stone', lip: 'grass', under: 'root', decor: 'flower', far: 'hill', rise: 'poison' },
    sky: { grain: 'puff', lip: 'cloud', under: 'mist', decor: 'sprout', far: 'cloud', rise: 'storm' },
    space: { grain: 'crater', lip: 'dust', under: 'crystal', decor: 'crystal', far: 'planet', rise: 'void' }
  };

  function motifOf(P) { return P.motif || MOTIF[P.id] || MOTIF.underground; }
  // ゾーンの中の段（100mごと）。同じゾーンのまま、色（col）と飾り（motif）を少しずつ変える。amb は明るさの倍率
  var STAGES = {
    underground: [
      { name: '地底の洞窟' },
      { name: '根っこの坑道', amb: 0.96, motif: { hangRate: 0.85 },
        col: { bgTop: '#2e2420', bgBottom: '#403026', far: '#271e1a', strataA: '#372a23', strataB: '#3f3028', terrain: '#c39572', terrainLight: '#e6c29d', terrainShade: '#a07658',
          terrainDeep: '#9c765b', terrainLine: '#b38664', terrainGrain: '#d8b18c', accent: '#a9d36e', accentShade: '#86b350', glow: '#c8ec8a' } },
      { name: '古い機械の縦穴', amb: 0.94, motif: { under: 'chain', decor: 'lamp', far: 'pipe', lip: 'plain', hangRate: 0.35 },
        col: { bgTop: '#1f2630', bgBottom: '#2b3542', far: '#1a2029', strataA: '#26303b', strataB: '#2c3743', terrain: '#a9a49c', terrainLight: '#d4cfc4', terrainShade: '#8a857e',
          terrainDeep: '#868079', terrainLine: '#9b958d', terrainGrain: '#c2bcb1', accent: '#7fb8d6', accentShade: '#5d97b5', glow: '#9ad8ff' } },
      { name: '地上へのさけ目', amb: 1.1, motif: { far: 'beam', lip: 'grass', hangRate: 0.5 },
        col: { bgTop: '#3a3f5c', bgBottom: '#4a4660', far: '#333654', strataA: '#413f5c', strataB: '#48456a', terrain: '#d6b48e', terrainLight: '#f2dcbc', terrainShade: '#b48f6d',
          terrainDeep: '#b0907a', terrainLine: '#c6a27f', terrainGrain: '#e6cdaa', accent: '#9cd67e', accentShade: '#78b65c', glow: '#fff0c2' } }
    ],
    surface: [
      { name: '草の崖', amb: 1.22, bloom: 0.35, lightK: 0.45 },
      { name: '風の岩場', amb: 1.22, bloom: 0.35, lightK: 0.45, motif: { decor: 'sprout', hangRate: 0.25 },
        col: { bgTop: '#a3cfe0', bgBottom: '#e3efe8', far: '#b4cfc0', strataA: '#c8e0da', strataB: '#d2e7df', terrain: '#cdb596', terrainLight: '#ecdcc0', terrainShade: '#a99274',
          terrainDeep: '#ae9779', terrainLine: '#bba283', terrainGrain: '#ddcbb0', accent: '#9cc46e', accentShade: '#7aa352' } },
      { name: '古い水路', amb: 1.2, bloom: 0.35, lightK: 0.5, motif: { hangRate: 0.55 },
        col: { bgTop: '#86c4e4', bgBottom: '#d3ecef', far: '#9fcfc4', strataA: '#b8dde0', strataB: '#c3e4e4', terrain: '#c9b9a0', terrainLight: '#e8dcc6', terrainShade: '#a8987f',
          terrainDeep: '#a99a84', terrainLine: '#b8a88f', terrainGrain: '#dbcdb6', accent: '#6fc79a', accentShade: '#4fa67a' } },
      { name: '夕焼けの峰', amb: 1.18, bloom: 0.4, lightK: 0.5, motif: { decor: 'sprout', hangRate: 0.3 },
        col: { bgTop: '#f0b48c', bgBottom: '#fbe3c2', far: '#e6b9a0', strataA: '#f3cfb4', strataB: '#f6d8bf', terrain: '#d9ad86', terrainLight: '#f4d8b4', terrainShade: '#b78a66',
          terrainDeep: '#ba9170', terrainLine: '#c89e78', terrainGrain: '#e8c49e', accent: '#a8c86a', accentShade: '#86a64e', glow: '#ffe08a' } }
    ]
  };
  var stageCache = {};
  function stagePal(id, i) {
    var list = STAGES[id] || [{}]; i = Math.max(0, Math.min(list.length - 1, i | 0));
    var key = id + '|' + i; if (stageCache[key]) return stageCache[key];
    var st = list[i], P = {}, base = pal(id), k;
    for (k in base) P[k] = base[k];
    for (k in (st.col || {})) P[k] = st.col[k];
    P.motif = {}; for (k in MOTIF[id] || MOTIF.underground) P.motif[k] = (MOTIF[id] || MOTIF.underground)[k];
    for (k in (st.motif || {})) P.motif[k] = st.motif[k];
    P.amb = st.amb || 1; P.bloom = st.bloom == null ? 1 : st.bloom; P.lightK = st.lightK == null ? 1 : st.lightK; P.stage = i; P.stageName = st.name || '';
    return (stageCache[key] = P);
  }
  function hex2(n) { n = Math.round(Math.max(0, Math.min(255, n))); return (n < 16 ? '0' : '') + n.toString(16); }
  function mixHex(a, b, t) { var A = hexToRgb(a), B = hexToRgb(b); return '#' + hex2(A[0] + (B[0] - A[0]) * t) + hex2(A[1] + (B[1] - A[1]) * t) + hex2(A[2] + (B[2] - A[2]) * t); }
  // 2つの段の色を混ぜる（飾りは半分を過ぎたら次の段のもの）
  function blendPal(A, B, t) {
    if (t <= 0) return A; if (t >= 1) return B;
    var P = {}, k; for (k in A) P[k] = A[k];
    for (k in A) if (typeof A[k] === 'string' && A[k][0] === '#' && typeof B[k] === 'string' && B[k][0] === '#') P[k] = mixHex(A[k], B[k], t);
    P.motif = t < 0.5 ? A.motif : B.motif; P.id = t < 0.5 ? A.id : B.id; P.amb = A.amb + (B.amb - A.amb) * t; P.bloom = A.bloom + (B.bloom - A.bloom) * t; P.lightK = A.lightK + (B.lightK - A.lightK) * t; P.stage = A.stage + t;
    return P;
  }

  /* ---------- 背景：帯2枚＋遠景＋ただよう粒 ---------- */
  var dustCache = {};
  function dustTable(n) {
    var D = [];
    for (var k = 0; k < n; k++) D.push({ h9: hash(k, 9), b: Math.min(31, Math.floor(hash(k, 9) * 32)), x: hash(k, 5), y: hash(k, 6), v: 1 + hash(k, 7), s: 0.7 + hash(k, 8) });
    return D.sort(function (p, q) { return p.b - q.b; });
  }
  // 地層の帯：s は奥の層の座標（画面の y ＋ スクロール×0.5）。s0〜s1 にかかる帯を yy ＝ oy ＋ i×46 に描く（帯の番号は世界で数える）
  function bgStrata(g, P, x, w, s0, s1, oy) {
    var m = motifOf(P), bh = 46;
    for (var i = Math.floor(s0 / bh) - 1; i * bh < s1 + bh; i++) {
      var yy = oy + i * bh; g.fillStyle = (i & 1) ? P.strataA : P.strataB;
      g.beginPath(); g.moveTo(x, yy + bh + 6);
      for (var xx = 0; xx <= w; xx += 24) g.lineTo(x + xx, yy + Math.sin(xx * 0.04 + i * 1.7) * (m.far === 'cloud' ? 6 : 4));
      g.lineTo(x + w, yy + bh + 6); g.closePath(); g.fill();
    }
  }
  // 遠景（画面に止まっている）
  function bgFar(g, P, x, y, w, h) {
    var m = motifOf(P);
    g.fillStyle = P.far;
    for (var j = 0; j < Math.ceil(w / 70) + 1; j++) {
      var sx = x + j * 70 + hash(j, 1) * 30, sw = 14 + hash(j, 2) * 18, sh = 26 + hash(j, 3) * 40;
      if (m.far === 'pipe') {   // 古い機械：縦の管とつなぎ目、ときどき横の管
        var pw = 6 + hash(j, 2) * 8; g.fillRect(sx - pw / 2, y, pw, h);
        for (var fy = y + hash(j, 3) * 60; fy < y + h; fy += 70 + hash(j, 4) * 50) g.fillRect(sx - pw / 2 - 2, fy, pw + 4, 5);
        if (hash(j, 5) > 0.55) { var hy = y + hash(j, 6) * h; g.fillRect(sx, hy, 40 + hash(j, 7) * 30, 5); }
        continue;
      }
      if (m.far === 'beam' && j === 0) {   // さけ目から差しこむ光の帯（先に描く）
        g.save(); g.fillStyle = alpha(P.glow, 0.06);
        for (var bj = 0; bj < 3; bj++) { var bx = x + w * (0.15 + bj * 0.32) + hash(bj, 11) * 30, bw = 18 + hash(bj, 12) * 26; g.beginPath(); g.moveTo(bx, y); g.lineTo(bx + bw, y); g.lineTo(bx + bw + h * 0.35, y + h); g.lineTo(bx + h * 0.35 - bw * 0.5, y + h); g.closePath(); g.fill(); }
        g.restore(); g.fillStyle = P.far;
      }
      if (m.far === 'stalactite' || m.far === 'beam') {
        var down = hash(j, 4) < 0.5, yb = down ? y : y + h, tip = down ? yb + sh : yb - sh;
        g.beginPath(); g.moveTo(sx - sw / 2, yb); g.quadraticCurveTo(sx - sw * 0.3, (yb + tip) / 2, sx - 1.5, tip + (down ? -2 : 2)); g.quadraticCurveTo(sx, tip, sx + 1.5, tip + (down ? -2 : 2)); g.quadraticCurveTo(sx + sw * 0.3, (yb + tip) / 2, sx + sw / 2, yb); g.closePath(); g.fill();
      } else if (m.far === 'hill') {
        ell(g, sx, y + h + 4, sw * 1.6, sh * 0.9); g.fill();
        if (hash(j, 5) > 0.5) { rr(g, sx + sw * 0.6 - 1.5, y + h - sh * 0.9 - 8, 3, 12, 1.5); g.fill(); ell(g, sx + sw * 0.6, y + h - sh * 0.9 - 12, 6, 7); g.fill(); }
      } else if (m.far === 'cloud') {
        var cy = y + hash(j, 6) * h; for (var q = 0; q < 3; q++) { ell(g, sx + q * 7 - 7, cy - (q === 1 ? 3 : 0), 8, 5.5); g.fill(); }
      } else if (m.far === 'planet') {
        if (hash(j, 7) > 0.6) { var py = y + hash(j, 8) * h, pr = 5 + hash(j, 9) * 9; ell(g, sx, py, pr, pr); g.fill(); g.strokeStyle = P.far; g.lineWidth = 1.2; ell(g, sx, py, pr * 1.7, pr * 0.45, -0.3); g.stroke(); }
      }
    }
  }
  // 細かい粒の一覧：[x, y, 半径, 濃さ] を4つずつ（WebGL で描くとき用）
  function bgDust(P, x, y, w, h, t) {
    var m = motifOf(P), n = Math.floor(w * h / 900), a0 = m.far === 'planet' ? 0.25 : 0.05, a1 = m.far === 'planet' ? 0.4 : 0.08, sp = m.far === 'planet' ? 0.2 : 1;
    var D = dustCache[n] || (dustCache[n] = dustTable(n)), out = new Float32Array(n * 4);
    for (var k = 0; k < n; k++) { var d = D[k]; out[k * 4] = x + d.x * w; out[k * 4 + 1] = y + ((d.y * h - t * 5 * d.v * sp) % h + h) % h; out[k * 4 + 2] = d.s; out[k * 4 + 3] = a0 + d.h9 * a1; }
    return out;
  }
  function background(g, P, x, y, w, h, t, scroll) {
    scroll = scroll || 0;
    var gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, P.bgTop); gr.addColorStop(1, P.bgBottom);
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    var m = motifOf(P), off = scroll * 0.5;
    bgStrata(g, P, x, w, off, off + h, y - off);
    bgFar(g, P, x, y, w, h);
    // 細かい粒：濃さを32段に分けて、同じ濃さの粒は1回で塗る（1粒ずつ塗るより速い。濃さの差は目に見えない）。粒ごとの乱数は先に作っておく
    g.fillStyle = P.uiInk;
    var n = Math.floor(w * h / 900), a0 = m.far === 'planet' ? 0.25 : 0.05, a1 = m.far === 'planet' ? 0.4 : 0.08, sp = m.far === 'planet' ? 0.2 : 1;
    var D = dustCache[n] || (dustCache[n] = dustTable(n)), b = -1;
    for (var k = 0; k < n; k++) {
      var d = D[k];
      if (d.b !== b) { if (b >= 0) { g.globalAlpha = a0 + (b + 0.5) / 32 * a1; g.fill(); } b = d.b; g.beginPath(); }
      var px = x + d.x * w, pyy = y + ((d.y * h - t * 5 * d.v * sp) % h + h) % h;
      g.moveTo(px + d.s, pyy); g.ellipse(px, pyy, d.s, d.s, 0, 0, Math.PI * 2);
    }
    if (b >= 0) { g.globalAlpha = a0 + (b + 0.5) / 32 * a1; g.fill(); }
    g.globalAlpha = 1;
  }

  /* ---------- 地形：面＋上の縁＋下の影＋奥の暗さ＋地層線1本＋粒（マス内3つまで） ---------- */
  function grain(g, P, kind, x, y, s, deep) {
    if (kind === 'pebble' || kind === 'stone') {
      g.fillStyle = deep ? 'rgba(0,0,0,.1)' : P.terrainShade; ell(g, x + 0.5, y + 0.6, s * 1.25, s * (kind === 'stone' ? 0.7 : 1)); g.fill();
      g.fillStyle = deep ? 'rgba(255,255,255,.1)' : P.terrainGrain; ell(g, x, y, s * 1.2, s * (kind === 'stone' ? 0.65 : 0.9)); g.fill();
    } else if (kind === 'puff') {
      g.fillStyle = deep ? 'rgba(255,255,255,.12)' : P.terrainGrain; for (var i = 0; i < 3; i++) { ell(g, x + i * 1.8 - 1.8, y - (i === 1 ? 1 : 0), s * 0.8, s * 0.7); g.fill(); }
    } else if (kind === 'crater') {
      g.fillStyle = deep ? 'rgba(0,0,0,.12)' : P.terrainShade; ell(g, x, y, s * 1.3, s); g.fill();
      g.strokeStyle = deep ? 'rgba(255,255,255,.08)' : P.terrainGrain; g.lineWidth = 0.8; g.beginPath(); g.ellipse(x, y, s * 1.3, s, 0, Math.PI * 0.95, Math.PI * 1.9); g.stroke();
    }
  }
  function block(g, P, G, c, r, x, y) {
    var e = G.exp(c, r), k = 6, rad = [e.t && e.l ? k : 0, e.t && e.r ? k : 0, e.b && e.r ? k : 0, e.b && e.l ? k : 0];
    var o0 = e.l ? 0 : 0.6, o1 = e.r ? 0 : 0.6, o2 = e.t ? 0 : 0.6, o3 = e.b ? 0 : 0.6, d = G.depth(c, r);
    var m = motifOf(P);
    g.save(); rr(g, x - o0, y - o2, CELL + o0 + o1, CELL + o2 + o3, rad);
    g.fillStyle = d === 0 ? P.terrain : d === 1 ? mix(P.terrain, P.terrainDeep, 0.55) : P.terrainDeep; g.fill(); g.clip();
    g.fillStyle = d ? 'rgba(0,0,0,.07)' : P.terrainLine; g.fillRect(x - 1, y + 4 + ((r * 7) % 9), CELL + 2, 1.4);
    if (hash(c, r, 1) > 0.55) grain(g, P, m.grain, x + 4 + hash(c, r, 2) * 10, y + 6 + hash(c, r, 3) * 8, 1.6 + hash(c, r, 4) * 1.4, d > 0);
    if (e.t) { g.fillStyle = P.terrainLight; g.fillRect(x - 1, y, CELL + 2, 4); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x - 1, y, CELL + 2, 1.2); }
    if (e.b) { g.fillStyle = P.terrainShade; g.fillRect(x - 1, y + CELL - 3, CELL + 2, 3); }
    if (e.l) { g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x, y, 2, CELL); }
    if (e.r) { g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(x + CELL - 2, y, 2, CELL); }
    g.restore();
  }
  function lip(g, P, x, y, c, r) {
    var m = motifOf(P), i;
    if (m.lip === 'cloud') {
      g.fillStyle = P.accentShade; for (i = 0; i < 4; i++) { ell(g, x + 2 + i * 4.7, y + 0.5, 3.2, 2.6); g.fill(); }
      g.fillStyle = P.accent; for (i = 0; i < 4; i++) { ell(g, x + 1.6 + i * 4.7, y - 0.3, 3, 2.4); g.fill(); }
      return;
    }
    g.fillStyle = P.accentShade; g.beginPath(); g.moveTo(x - 0.5, y + 1);
    for (i = 0; i <= 6; i++) g.lineTo(x + i * 3, y + 2.2 + (hash(c * 7 + i, r) > 0.5 ? 1.6 : 0.4));
    g.lineTo(x + CELL + 0.5, y - 0.6); g.lineTo(x - 0.5, y - 0.6); g.closePath(); g.fill();
    g.fillStyle = P.accent; g.fillRect(x - 0.5, y - 1, CELL + 1, 2);
    if (m.lip === 'moss' || m.lip === 'grass') {
      for (i = 0; i < 3; i++) if (hash(c, r, 20 + i) > (m.lip === 'grass' ? 0.3 : 0.55)) {
        var bx = x + 2 + i * 6 + hash(c, r, 30 + i) * 3; g.strokeStyle = P.accent; g.lineWidth = 1; g.lineCap = 'round';
        g.beginPath(); g.moveTo(bx, y - 0.5); g.quadraticCurveTo(bx - 1, y - 3, bx + 0.5, y - (m.lip === 'grass' ? 5.5 : 4.5)); g.stroke();
      }
    } else if (m.lip === 'dust') {
      for (i = 0; i < 2; i++) if (hash(c, r, 40 + i) > 0.6) { var sx2 = x + 4 + i * 8, sy2 = y - 3; g.fillStyle = P.glow; g.beginPath(); g.moveTo(sx2, sy2 - 2); g.lineTo(sx2 + 0.6, sy2); g.lineTo(sx2, sy2 + 2); g.lineTo(sx2 - 0.6, sy2); g.closePath(); g.fill(); }
    }
  }
  function slope(g, P, x, y, k) {
    var X = x + CELL, Y = y + CELL, pts = k === 'BR' ? [X, y, X, Y, x, Y] : k === 'BL' ? [x, y, X, Y, x, Y] : k === 'TL' ? [x, y, X, y, x, Y] : [x, y, X, y, X, Y];
    var tri = function () { g.beginPath(); g.moveTo(pts[0], pts[1]); g.lineTo(pts[2], pts[3]); g.lineTo(pts[4], pts[5]); g.closePath(); };
    tri(); g.fillStyle = P.terrain; g.fill();
    var a = (k === 'BR' || k === 'TL') ? [x, Y, X, y] : [x, y, X, Y], up = k === 'BR' || k === 'BL';
    g.save(); tri(); g.clip(); g.strokeStyle = up ? P.terrainLight : P.terrainShade; g.lineWidth = 6; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(a[2], a[3]); g.stroke(); g.restore();
    if (up) { g.strokeStyle = P.accent; g.lineWidth = 1.8; g.lineCap = 'round'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(a[2], a[3]); g.stroke(); }
  }
  function hang(g, P, x, y, len, s) {   // 下の面から垂れるもの（根・霧・結晶）
    var m = motifOf(P), sw = (hash(s, 1) - 0.5) * 6;
    if (m.under === 'root') {
      g.beginPath(); g.moveTo(x - 1.6, y); g.quadraticCurveTo(x + sw - 1, y + len * 0.5, x + sw * 0.4, y + len); g.quadraticCurveTo(x + sw + 1, y + len * 0.5, x + 1.6, y); g.closePath();
      g.fillStyle = P.terrainShade; g.fill();
      g.strokeStyle = P.terrainLine; g.lineWidth = 0.9; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + sw * 0.45, y + len * 0.45); g.quadraticCurveTo(x + sw * 0.5 + 3, y + len * 0.5, x + sw * 0.5 + 4.5, y + len * 0.68); g.stroke();
      if (hash(s, 2) > 0.5) { g.fillStyle = P.accent; ell(g, x + sw * 0.5 + 5, y + len * 0.7, 1.8, 1, 0.8); g.fill(); }
    } else if (m.under === 'chain') {   // 古い機械：さびた鎖と小さなかぎ
      var n2 = Math.max(2, Math.round(len / 4.5)), cx2 = x;
      g.lineWidth = 1.1; g.strokeStyle = P.metalShade;
      for (var li = 0; li < n2; li++) { var ly = y + 2 + li * 4.2; if (li % 2) { g.beginPath(); g.moveTo(cx2, ly - 2); g.lineTo(cx2, ly + 2); g.stroke(); } else { ell(g, cx2, ly, 1.4, 2.4); g.stroke(); } }
      g.strokeStyle = P.metal; g.lineWidth = 1.2; var hy2 = y + 2 + n2 * 4.2; g.beginPath(); g.moveTo(cx2, hy2 - 1.5); g.lineTo(cx2, hy2 + 1); g.arc(cx2 + 1.8, hy2 + 1, 1.8, Math.PI, Math.PI * 0.1, true); g.stroke();
    } else if (m.under === 'mist') {
      g.fillStyle = alpha('#ffffff', 0.35); for (var i = 0; i < 3; i++) { ell(g, x + sw * i * 0.2, y + 2 + i * len * 0.3, 3 - i * 0.6, 2 - i * 0.4); g.fill(); }
    } else if (m.under === 'crystal') {
      solid(g, function () { g.beginPath(); g.moveTo(x - 2, y); g.lineTo(x, y + len * 0.6); g.lineTo(x + 2, y); g.closePath(); }, P.accent, P.accentShade, null, 0.6);
    }
  }
  function decor(g, P, x, y, s, t, seed) {   // 上の面の飾り（光るもの）
    var m = motifOf(P), pulse = 0.85 + Math.sin(t * 2 + seed) * 0.15;
    var gl = g.createRadialGradient(x, y - 5 * s, 1, x, y - 5 * s, 15 * s); gl.addColorStop(0, alpha(P.glow, 0.32 * pulse)); gl.addColorStop(1, alpha(P.glow, 0));
    g.fillStyle = gl; ell(g, x, y - 5 * s, 15 * s, 15 * s); g.fill();
    if (m.decor === 'mushroom') {
      solid(g, function () { g.beginPath(); g.moveTo(x - 1.4 * s, y); g.quadraticCurveTo(x - 1.8 * s, y - 3 * s, x - 1 * s, y - 5 * s); g.lineTo(x + 1 * s, y - 5 * s); g.quadraticCurveTo(x + 1.8 * s, y - 3 * s, x + 1.4 * s, y); g.closePath(); }, P.terrainLight, P.terrainShade, null, 0.3 * s);
      solid(g, function () { g.beginPath(); g.moveTo(x - 5 * s, y - 4.4 * s); g.bezierCurveTo(x - 5 * s, y - 9.5 * s, x + 5 * s, y - 9.5 * s, x + 5 * s, y - 4.4 * s); g.quadraticCurveTo(x, y - 3.2 * s, x - 5 * s, y - 4.4 * s); g.closePath(); }, P.glow, mix(P.glow, '#000000', 0.25), null, 0.7 * s);
      g.fillStyle = 'rgba(255,255,255,.8)'; ell(g, x - 2 * s, y - 7 * s, 0.9 * s, 0.7 * s); g.fill();
    } else if (m.decor === 'lamp') {   // 古い機械：細い柱の上の小さな灯り
      solid(g, function () { rr(g, x - 0.9 * s, y - 7 * s, 1.8 * s, 7 * s, 0.6 * s); }, P.metal, P.metalShade, P.ink, 0.4, 0.8);
      solid(g, function () { rr(g, x - 2.4 * s, y - 1.2 * s, 4.8 * s, 1.4 * s, 0.6 * s); }, P.metal, P.metalShade, P.ink, 0.3, 0.8);
      g.fillStyle = P.glow; ell(g, x, y - 9 * s, 2.5 * s, 2.7 * s); g.fill();
      g.fillStyle = 'rgba(255,255,255,.85)'; ell(g, x - 0.7 * s, y - 9.8 * s, 0.9 * s, 0.9 * s); g.fill();
      g.strokeStyle = P.ink; g.lineWidth = 0.8; ell(g, x, y - 9 * s, 2.5 * s, 2.7 * s); g.stroke();
      g.beginPath(); g.moveTo(x - 2.5 * s, y - 9 * s); g.lineTo(x + 2.5 * s, y - 9 * s); g.moveTo(x, y - 11.7 * s); g.lineTo(x, y - 6.3 * s); g.stroke();
    } else if (m.decor === 'flower') {
      g.strokeStyle = P.accentShade; g.lineWidth = 1.1 * s; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - 1 * s, y - 3 * s, x, y - 6 * s); g.stroke();
      for (var i = 0; i < 5; i++) { var a = i / 5 * Math.PI * 2 + t * 0.2; g.fillStyle = P.glow; ell(g, x + Math.cos(a) * 2.2 * s, y - 7 * s + Math.sin(a) * 2.2 * s, 1.6 * s, 1.6 * s); g.fill(); }
      g.fillStyle = '#fff6d8'; ell(g, x, y - 7 * s, 1.2 * s, 1.2 * s); g.fill();
    } else if (m.decor === 'sprout') {
      g.fillStyle = P.glow; for (var q = 0; q < 3; q++) { ell(g, x - 2.5 * s + q * 2.5 * s, y - 3 * s - (q === 1 ? 2 * s : 0), 2.4 * s, 2 * s); g.fill(); }
    } else {
      var cr = function (cx, h, w, rot) { g.save(); g.translate(cx, y); g.rotate(rot); solid(g, function () { g.beginPath(); g.moveTo(-w, 0); g.lineTo(-w, -h * 0.7); g.lineTo(0, -h); g.lineTo(w, -h * 0.7); g.lineTo(w, 0); g.closePath(); }, P.glow, mix(P.glow, '#000000', 0.25), null, 0.6); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(-w * 0.5, -h * 0.65, w * 0.4, h * 0.4); g.restore(); };
      cr(x - 2.5 * s, 6 * s, 1.5 * s, -0.35); cr(x + 2.5 * s, 5 * s, 1.4 * s, 0.35); cr(x, 8.5 * s, 1.9 * s, 0);
    }
  }
  // トゲ：どのゾーンでも同じ。とがった結晶＋台座。危険の色はゾーンで変えない
  function spike(g, P, x, y, dir) {
    g.save(); g.translate(x + CELL / 2, y + CELL / 2); g.rotate({ L: 0, R: Math.PI, T: Math.PI / 2, B: -Math.PI / 2 }[dir] || 0); g.translate(-CELL / 2, -CELL / 2);
    solid(g, function () { rr(g, -1, 0.5, 4.5, 17, 2); }, P.terrainShade, mix(P.terrainShade, '#000000', 0.2), null, 0.4);
    [1, 9].forEach(function (ty) { spikeTooth(g, P, ty); });
    g.restore();
  }
  function spikeTooth(g, P, ty) {
    solid(g, function () { g.beginPath(); g.moveTo(2.5, ty); g.lineTo(14, ty + 3.6); g.quadraticCurveTo(15.2, ty + 4, 14, ty + 4.4); g.lineTo(2.5, ty + 8); g.closePath(); }, P.hazard, P.hazardShade, P.ink, 0.9, 0.85);
    g.fillStyle = P.hazardLight; g.beginPath(); g.moveTo(3.5, ty + 1.2); g.lineTo(12, ty + 3.6); g.lineTo(3.5, ty + 3.4); g.closePath(); g.fill();
  }
  function terrain(g, P, G, t, ox, oy) {
    ox = ox || 0; oy = oy || 0; var r, c, k;
    for (r = 0; r < G.rows; r++) for (c = 0; c < G.cols; c++) { k = G.tile(c, r); if (k === '#') block(g, P, G, c, r, ox + c * CELL, oy + r * CELL); else if (k.length === 2) slope(g, P, ox + c * CELL, oy + r * CELL, k); }
    for (r = 0; r < G.rows; r++) for (c = 0; c < G.cols; c++) {
      if (G.tile(c, r) !== '#') continue; var e = G.exp(c, r), x = ox + c * CELL, y = oy + r * CELL;
      if (e.t) { lip(g, P, x, y, c, r); if (hash(c, r, 12) < 0.25) decor(g, P, x + 5 + hash(c, r, 13) * 8, y - 0.5, 1, t, c + r); }
      if (e.b && hash(c, r, 17) < (motifOf(P).hangRate || 0.45)) hang(g, P, x + 4 + hash(c, r, 18) * 10, y + CELL - 1, 7 + hash(c, r, 19) * 12, c * 31 + r);
    }
    for (r = 0; r < G.rows; r++) for (c = 0; c < G.cols; c++) if (G.raw(c, r) === '^') spike(g, P, ox + c * CELL, oy + r * CELL, G.spikeDir(c, r));
  }

  /* ---------- 動く障害物：本体は鉄（metal）、痛い所は hazard、縁取りは ink。
     動きは時間 t だけで決まる（同じ t なら本編も到達チェックも同じ位置になる） ---------- */
  function phase(t, period, offset) { var p = ((t + (offset || 0)) % period + period) % period; return p / period; }
  function smooth(k) { k = Math.min(1, Math.max(0, k)); return k * k * (3 - 2 * k); }
  // 行って戻る 0→1→0。端で hold の割合だけ止まる
  function slide(t, period, offset, hold) {
    period = period || 3; hold = hold == null ? 0.12 : hold;
    var p = phase(t, period, offset) * 2, k = p < 1 ? p : 2 - p;
    return smooth((k - hold) / (1 - 2 * hold));
  }
  // 段階をくり返す。steps = [['名前', 秒], ...]。s いまの段階、k その中の進み 0〜1、e 経過秒、d その段階の長さ
  function cycleState(t, steps, offset) {
    var tot = 0, i; for (i = 0; i < steps.length; i++) tot += steps[i][1];
    var p = phase(t, tot, offset) * tot;
    for (i = 0; i < steps.length; i++) { if (p < steps[i][1] || i === steps.length - 1) return { s: steps[i][0], k: Math.min(1, p / steps[i][1]), e: p, d: steps[i][1] }; p -= steps[i][1]; }
  }
  function metalSolid(g, P, path, off) { solid(g, path, P.metal, P.metalShade, P.ink, off == null ? 1.1 : off, 1.0); }
  function bolt(g, P, x, y, r) { g.fillStyle = P.metalShade; ell(g, x + 0.3, y + 0.3, r, r); g.fill(); g.fillStyle = P.metalLight; ell(g, x, y, r * 0.7, r * 0.7); g.fill(); }
  function blade(g, P, path) { solid(g, path, P.hazard, P.hazardShade, P.ink, 0.8, 0.85); }

  // 出入りトゲ：引っ込む → 予告（先が少しのぞき、すき間が点滅）→ 出る。痛いのは hurt のときだけ
  function popState(t, o) {
    o = o || {}; var st = cycleState(t, [['in', o.in || 1.4], ['warn', o.warn || 0.6], ['out', o.out || 1.2]], o.offset), a = 0;
    if (st.s === 'warn') a = 0.3 + Math.sin(st.e * 40) * 0.04;
    if (st.s === 'out') a = Math.min(1, st.e / 0.08) * Math.min(1, (st.d - st.e) / 0.18);
    st.amount = a; st.hurt = st.s === 'out' && a > 0.5; return st;
  }
  // (x, y) はトゲのマスの左上。dir は spike と同じ（生える壁の側）
  function popSpike(g, P, x, y, dir, t, o) {
    var st = popState(t, o);
    g.save(); g.translate(x + CELL / 2, y + CELL / 2); g.rotate({ L: 0, R: Math.PI, T: Math.PI / 2, B: -Math.PI / 2 }[dir] || 0); g.translate(-CELL / 2, -CELL / 2);
    g.save(); g.beginPath(); g.rect(3.2, -4, 20, 26); g.clip(); g.translate(-(1 - st.amount) * 12, 0);
    spikeTooth(g, P, 1); spikeTooth(g, P, 9);
    g.restore();
    solid(g, function () { rr(g, -1, 0.5, 4.7, 17, 2); }, P.metal, P.metalShade, P.ink, 0.4, 0.9);
    var lit = st.s === 'warn' && st.e % 0.24 < 0.12;
    [5, 13].forEach(function (sy) { g.fillStyle = lit ? P.hazardLight : P.ink; rr(g, 2.3, sy - 1.2, 1.7, 2.4, 0.6); g.fill(); });
    g.restore(); return st;
  }

  // 鉄の箱：レールに沿って往復する。axis 'x' なら左右の面に、'y' なら上下の面にトゲ。(x, y) は左上
  function teethRow(g, P, len) {
    var k = Math.max(2, Math.round((len - 4) / 6)), step = (len - 4) / k;
    for (var i = 0; i < k; i++) (function (a) { blade(g, P, function () { g.beginPath(); g.moveTo(a, 1); g.lineTo(a + step / 2, -4.2); g.lineTo(a + step, 1); g.closePath(); }); })(2 + i * step);
  }
  function ironBox(g, P, x, y, w, h, axis) {
    var sides = axis === 'y' ? [[0, 0, 0, w], [w, h, Math.PI, w]] : [[0, h, -Math.PI / 2, h], [w, 0, Math.PI / 2, h]];
    sides.forEach(function (sd) { g.save(); g.translate(x + sd[0], y + sd[1]); g.rotate(sd[2]); teethRow(g, P, sd[3]); g.restore(); });
    metalSolid(g, P, function () { rr(g, x, y, w, h, 3); }, 1.6);
    shine(g, x + 4.5, y + 3.5, 2.6, 1.3, 0.35);
    [[3.4, 3.4], [w - 3.4, 3.4], [3.4, h - 3.4], [w - 3.4, h - 3.4]].forEach(function (b) { bolt(g, P, x + b[0], y + b[1], 1.2); });
  }
  // 箱の通り道（両端に留め金）
  function track(g, P, x0, y0, x1, y1) {
    g.strokeStyle = P.metalShade; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    [[x0, y0], [x1, y1]].forEach(function (p) { solid(g, function () { ell(g, p[0], p[1], 2.4, 2.4); }, P.metalShade, mix(P.metalShade, '#000000', 0.3), null, 0.5); });
  }

  // 回る棒：軸のまわりを刃の棒が回る。len は軸から先までの長さ。a は角度（spinAngle で出す）
  function spinAngle(t, speed, offset) { return (t + (offset || 0)) * (speed == null ? 1.6 : speed); }
  function spinner(g, P, x, y, len, a) {
    var c = Math.cos(a), s = Math.sin(a), T = function (u, v) { return [x + u * c - v * s, y + u * s + v * c]; };
    var pts = [[-len, 0], [-len + 6, -2.8], [len - 6, -2.8], [len, 0], [len - 6, 2.8], [-len + 6, 2.8]].map(function (p) { return T(p[0], p[1]); });
    blade(g, P, function () { g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); });
    var a1 = T(-len + 6, -1.2), b1 = T(len - 6, -1.2); g.strokeStyle = P.hazardLight; g.lineWidth = 0.7; g.beginPath(); g.moveTo(a1[0], a1[1]); g.lineTo(b1[0], b1[1]); g.stroke();
    metalSolid(g, P, function () { ell(g, x, y, 5, 5); }, 1);
    bolt(g, P, x - 0.4, y - 0.4, 1.7);
  }

  // シャッター：開く → 予告（ランプが点滅）→ 両側から閉じる → 開く。close 0〜1（1 で真ん中まで閉じる）
  function shutterState(t, o) {
    o = o || {}; var st = cycleState(t, [['open', o.open || 1.8], ['warn', o.warn || 0.8], ['closed', o.closed || 1.6]], o.offset), c = 0;
    if (st.s === 'closed') c = smooth(st.e / 0.3) * smooth((st.d - st.e) / 0.3);
    st.close = c; return st;
  }
  // x0, x1 は左右の壁の面、y は板の真ん中の高さ
  function shutter(g, P, x0, x1, y, t, o) {
    var st = shutterState(t, o), h = 9, len = ((x1 - x0) / 2 - 3) * st.close, lit = st.s === 'warn' && st.e % 0.3 < 0.15;
    [[x0, 1], [x1, -1]].forEach(function (sd) {
      var bx = sd[0], d = sd[1], px = d > 0 ? bx + 3 : bx - 3 - len;
      if (len > 0.5) {
        metalSolid(g, P, function () { rr(g, px, y - h / 2, len, h, d > 0 ? [0, 2.5, 2.5, 0] : [2.5, 0, 0, 2.5]); }, 1.2);
        g.strokeStyle = P.metalLight; g.lineWidth = 0.7; g.beginPath(); g.moveTo(px + 1, y - 1.5); g.lineTo(px + len - 1, y - 1.5); g.stroke();
      }
      metalSolid(g, P, function () { rr(g, d > 0 ? bx - 1 : bx - 4, y - 8, 5, 16, d > 0 ? [0, 2, 2, 0] : [2, 0, 0, 2]); }, 0.6);
      var lx = bx + d * 1.5, ly = y - 11;
      if (lit) { var gl = g.createRadialGradient(lx, ly, 0, lx, ly, 7); gl.addColorStop(0, alpha(P.hazardLight, 0.6)); gl.addColorStop(1, alpha(P.hazardLight, 0)); g.fillStyle = gl; g.fillRect(lx - 7, ly - 7, 14, 14); }
      solid(g, function () { ell(g, lx, ly, 1.8, 1.8); }, lit ? P.hazardLight : P.metalShade, lit ? P.hazard : mix(P.metalShade, '#000000', 0.3), P.ink, 0.4, 0.8);
    });
    return st;
  }

  // 扇風機：壁の面 (x, y) から dir（'R' 右へ・'L' 左へ・'T' 上へ・'B' 下へ）に風を出す。痛くない、押すだけ。reach 風の届く長さ
  var FAN_BAND = 12;   // 風の幅の半分
  function fanRot(dir) { return { R: 0, L: Math.PI, B: Math.PI / 2, T: -Math.PI / 2 }[dir] || 0; }
  // 風の筋：[x0, y0, x1, y1, 濃さ] を7本（白、太さ 1.4、端は丸）
  function fanStreaks(x, y, dir, reach, t) {
    var rot = fanRot(dir), c = Math.cos(rot), s = Math.sin(rot), out = [];
    for (var i = 0; i < 7; i++) {
      var q = (t * (0.9 + hash(i, 3, 1) * 0.5) + hash(i, 1, 2)) % 1, sx = 9 + q * (reach - 24), sy = (hash(i, 2, 3) * 2 - 1) * (FAN_BAND - 2), len = 8 + hash(i, 5, 4) * 8;
      out.push([x + c * sx - s * sy, y + s * sx + c * sy, x + c * (sx + len) - s * sy, y + s * (sx + len) + c * sy, +(Math.sin(q * Math.PI) * 0.6).toFixed(3)]);
    }
    return out;
  }
  // 箱と吹き出し口の線（動かない所）
  function fanBody(g, P, x, y, dir) {
    var rot = fanRot(dir), c = Math.cos(rot), s = Math.sin(rot);
    // 箱は回さずに描く（影はいつも右下）
    var hx = x + c * 3 - Math.abs(s) * 11 - Math.abs(c) * 4, hy = y + s * 3 - Math.abs(c) * 11 - Math.abs(s) * 4, hw = Math.abs(c) * 8 + Math.abs(s) * 22, hh = Math.abs(s) * 8 + Math.abs(c) * 22;
    metalSolid(g, P, function () { rr(g, hx, hy, hw, hh, 2.5); }, 1.2);
    var fx = x + c * 7.6, fy = y + s * 7.6;   // 吹き出し口の面
    g.strokeStyle = P.ink; g.lineWidth = 0.9; g.lineCap = 'round';
    [-5.5, 5.5].forEach(function (k) { g.beginPath(); g.moveTo(fx - s * k - c * 1.6, fy + c * k - s * 1.6); g.lineTo(fx - s * k, fy + c * k); g.stroke(); });
  }
  // 回る羽根の線：[x0, y0, x1, y1]（metalLight、太さ 1.5、端は丸）
  function fanBlade(x, y, dir, t, on) {
    var rot = fanRot(dir), c = Math.cos(rot), s = Math.sin(rot), fx = x + c * 7.6, fy = y + s * 7.6, sp = Math.sin(t * (on !== false ? 26 : 0)) * 6.5;
    return [fx + c * 1.2 - s * sp, fy + s * 1.2 + c * sp, fx + c * 1.2 + s * sp, fy + s * 1.2 - c * sp];
  }
  function fanBolt(g, P, x, y, dir) { var rot = fanRot(dir), c = Math.cos(rot), s = Math.sin(rot); bolt(g, P, x + c * 8.8, y + s * 8.8, 1.5); }
  function fan(g, P, x, y, dir, reach, t, on) {
    on = on !== false;
    if (on) {
      g.save(); g.lineCap = 'round'; g.lineWidth = 1.4;
      fanStreaks(x, y, dir, reach, t).forEach(function (l) { g.strokeStyle = 'rgba(255,255,255,' + l[4] + ')'; g.beginPath(); g.moveTo(l[0], l[1]); g.lineTo(l[2], l[3]); g.stroke(); });
      g.restore();
    }
    fanBody(g, P, x, y, dir);
    var b = fanBlade(x, y, dir, t, on);
    g.strokeStyle = P.metalLight; g.lineWidth = 1.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(b[2], b[3]); g.stroke();
    fanBolt(g, P, x, y, dir);
  }

  /* ---------- 地上の仕掛け（400m〜）：振り子・筒と鉄球・杭・跳ね橋・バネ・崩れる足場
     痛い所は hazard、本体は metal、縁取りは ink。動きは時間 t だけで決まる（崩れる足場だけは乗ると動き出す） ---------- */
  // 振り子：(x, y) は軸。a は角度（0＝真下）。鎖の先にトゲつきの鉄球
  function pendAngle(t, o) { o = o || {}; return (o.amp || 1.05) * Math.sin((t + (o.offset || 0)) / (o.period || 2.6) * Math.PI * 2); }
  function pendulum(g, P, x, y, len, a) {
    var bx = x + Math.sin(a) * len, by = y + Math.cos(a) * len, n = Math.max(3, Math.round(len / 5.5)), i;
    metalSolid(g, P, function () { rr(g, x - 6, y - 5, 12, 7, 2.5); }, 0.8);   // 軸の金具
    g.lineWidth = 1.3; g.strokeStyle = P.metalShade;
    for (i = 1; i < n; i++) { var k = i / n; g.save(); g.translate(x + (bx - x) * k, y + (by - y) * k); g.rotate(-a + (i % 2 ? Math.PI / 2 : 0)); ell(g, 0, 0, 1.5, 2.7); g.stroke(); g.restore(); }
    bolt(g, P, x, y - 1.5, 1.8);
    for (i = 0; i < 8; i++) { (function (an) { blade(g, P, function () { g.beginPath(); g.moveTo(bx + Math.cos(an - 0.32) * 8, by + Math.sin(an - 0.32) * 8); g.lineTo(bx + Math.cos(an) * 12.5, by + Math.sin(an) * 12.5); g.lineTo(bx + Math.cos(an + 0.32) * 8, by + Math.sin(an + 0.32) * 8); g.closePath(); }); })(i / 8 * Math.PI * 2 + a); }
    solid(g, function () { ell(g, bx, by, 9, 9); }, P.hazard, P.hazardShade, P.ink, 1.4, 1.1);
    shine(g, bx - 3, by - 3.2, 2.6, 1.5, 0.5);
  }
  // 筒：(x, y) は壁の面の真ん中、dir は撃つ向き（1＝右へ）。lit：撃つ前に口が光る
  function cannon(g, P, x, y, dir, lit) {
    g.save(); g.translate(x, y); g.scale(dir, 1);
    metalSolid(g, P, function () { g.beginPath(); g.arc(-4, 0, 9, -Math.PI / 2, Math.PI / 2); g.lineTo(-10, 9); g.lineTo(-10, -9); g.closePath(); }, 1);   // 壁にはまった台
    metalSolid(g, P, function () { rr(g, -2, -5.5, 10, 11, 2); }, 1);   // 筒
    metalSolid(g, P, function () { rr(g, 6, -7, 4, 14, 1.5); }, 0.6);   // 口の輪
    g.fillStyle = P.ink; ell(g, 9.6, 0, 1.4, 4.2); g.fill();
    if (lit) { var gl = g.createRadialGradient(10, 0, 0, 10, 0, 10); gl.addColorStop(0, alpha(P.hazardLight, 0.75)); gl.addColorStop(1, alpha(P.hazardLight, 0)); g.fillStyle = gl; ell(g, 10, 0, 10, 10); g.fill(); }
    bolt(g, P, -6, -5, 1.3); bolt(g, P, -6, 5, 1.3);
    g.restore();
  }
  function cannonBall(g, P, x, y) { solid(g, function () { ell(g, x, y, 5.5, 5.5); }, P.hazard, P.hazardShade, P.ink, 1, 1); shine(g, x - 1.8, y - 2, 1.6, 1, 0.55); }
  // 杭：壁の面 (x0, y) から dir の向きへ、長さ len の amount（0〜1）だけ突き出る。lit：出る前の点滅
  function stakeState(t, o) {
    o = o || {}; var st = cycleState(t, [['in', o.in || 2.0], ['warn', o.warn || 0.7], ['out', o.out || 1.3]], o.offset), a = 0;
    if (st.s === 'warn') a = 0.08 + Math.sin(st.e * 30) * 0.03;
    if (st.s === 'out') a = smooth(st.e / 0.12) * smooth((st.d - st.e) / 0.3);
    st.amount = a; st.hurt = st.s === 'out' && a > 0.5; return st;
  }
  function stake(g, P, x0, y, dir, len, amount, lit) {
    g.save(); g.translate(x0, y); g.scale(dir, 1);
    var L = Math.max(0, len * amount - 2);
    if (L > 0.5) {
      solid(g, function () { rr(g, -2, -4, L, 8, 1.5); }, P.hazard, P.hazardShade, P.ink, 1, 1);   // 太い軸
      g.strokeStyle = P.hazardLight; g.lineWidth = 0.9; g.beginPath(); g.moveTo(0, -1.6); g.lineTo(L - 2, -1.6); g.stroke();
      blade(g, P, function () { g.beginPath(); g.moveTo(L - 2.5, -6); g.lineTo(L + 8, 0); g.lineTo(L - 2.5, 6); g.closePath(); });   // 先
    }
    metalSolid(g, P, function () { rr(g, -3, -9, 5, 18, [0, 2, 2, 0]); }, 0.7);   // 壁の口
    [-5, 5].forEach(function (sy) { g.fillStyle = lit ? P.hazardLight : P.ink; rr(g, -1.4, sy - 1.2, 1.8, 2.4, 0.6); g.fill(); });
    g.restore();
  }
  // 跳ね橋：(x0, y) は壁の面の蝶番、dir は橋の伸びる向き、ang は上がった角度（0＝水平、π/2＝立つ）
  function bridgeState(t, o) {
    o = o || {}; var st = cycleState(t, [['down', o.down || 2.2], ['warn', o.warn || 0.7], ['rise', 0.35], ['up', o.up || 1.6], ['fall', 0.35]], o.offset), a = 0;
    if (st.s === 'rise') a = smooth(st.k); else if (st.s === 'up') a = 1; else if (st.s === 'fall') a = 1 - smooth(st.k);
    st.ang = a * Math.PI / 2 * 0.92; st.solid = a < 0.15; return st;
  }
  function bridge(g, P, x0, y, dir, len, ang, lit) {
    g.save(); g.translate(x0, y); g.scale(dir, 1);
    g.save(); g.rotate(-ang);
    metalSolid(g, P, function () { rr(g, 0, -4.5, len - 1, 9, [0, 3, 3, 0]); }, 1.2);
    g.strokeStyle = P.metalLight; g.lineWidth = 0.7; g.beginPath(); g.moveTo(2, -1.8); g.lineTo(len - 4, -1.8); g.stroke();
    for (var i = 8; i < len - 4; i += 12) bolt(g, P, i, 1.2, 1.1);
    g.restore();
    metalSolid(g, P, function () { rr(g, -4, -8, 6, 16, [0, 2, 2, 0]); }, 0.6);   // 蝶番の台
    bolt(g, P, 0, 0, 2.2);
    var lx = 1, ly = -12;
    if (lit) { var gl = g.createRadialGradient(lx, ly, 0, lx, ly, 7); gl.addColorStop(0, alpha(P.hazardLight, 0.6)); gl.addColorStop(1, alpha(P.hazardLight, 0)); g.fillStyle = gl; g.fillRect(lx - 7, ly - 7, 14, 14); }
    solid(g, function () { ell(g, lx, ly, 1.8, 1.8); }, lit ? P.hazardLight : P.metalShade, lit ? P.hazard : mix(P.metalShade, '#000000', 0.3), P.ink, 0.4, 0.8);
    g.restore();
  }
  // バネ：(x, y) はマスの左上（1マスがバネの箱）。k は縮み（0〜1、乗った瞬間に 1）
  function spring(g, P, x, y, k) {
    k = k || 0; var top = y + 2 + k * 4, i;
    metalSolid(g, P, function () { rr(g, x + 1, y + CELL - 6, CELL - 2, 6, 1.5); }, 0.8);   // 台
    g.strokeStyle = P.metalShade; g.lineWidth = 1.6; g.lineJoin = 'round'; g.beginPath();
    var y0 = y + CELL - 6, n = 4; g.moveTo(x + 4, y0);
    for (i = 1; i <= n; i++) g.lineTo(x + (i % 2 ? CELL - 4 : 4), y0 - (y0 - top - 3) * i / n);
    g.stroke();
    metalSolid(g, P, function () { rr(g, x, top, CELL, 4, 1.5); }, 0.6);   // 上の板
    g.fillStyle = P.glow; g.fillRect(x + 3, top + 1, CELL - 6, 1.2);
  }
  // 崩れる足場：(x, y) は左上、n マスぶん。shake（0〜1）でゆれてひびが増える
  function crumble(g, P, x, y, n, shake, t) {
    var dx = shake > 0 ? Math.sin(t * 60) * shake * 1.2 : 0;
    g.save(); g.translate(dx, 0);
    for (var i = 0; i < n; i++) {
      var cx = x + i * CELL;
      solid(g, function () { rr(g, cx + 0.5, y + 0.5, CELL - 1, CELL - 1, 2.5); }, P.terrainLight, P.terrainShade, P.ink, 1.4, 1.1);
      g.strokeStyle = alpha(P.ink, 0.55); g.lineWidth = 0.9; g.lineCap = 'round'; g.beginPath();
      g.moveTo(cx + 5 + hash(i, 1) * 4, y + 2); g.lineTo(cx + 8, y + 8); g.lineTo(cx + 6 + hash(i, 2) * 6, y + 14);
      if (shake > 0.3) { g.moveTo(cx + 8, y + 8); g.lineTo(cx + 14, y + 6); g.moveTo(cx + 3, y + 11); g.lineTo(cx + 8, y + 9); }
      g.stroke();
    }
    g.restore();
  }

  /* ---------- 迫ってくるもの（地下は溶岩。ほかのゾーンは仮） ---------- */
  // 溶岩の表面の下に浮かぶもの（かさぶた・稲妻・点）。riseCrusts で位置、riseCrust で1つ描く
  function riseCrusts(P, x, y, w, h, t) {
    var out = [];
    for (var i = 0; i < Math.ceil(w / 40); i++) out.push({ i: i, cx: x + ((hash(i, 1) * w + t * 6 * (i % 2 ? 1 : -1)) % w + w) % w, cy: y + 14 + hash(i, 2) * Math.max(4, h - 24), cw: 9 + hash(i, 3) * 8 });
    return out;
  }
  function riseCrust(g, P, c, t) {
    var m = motifOf(P), i = c.i, cx = c.cx, cy = c.cy, cw = c.cw;
    if (m.rise === 'lava' || m.rise === 'mud') { g.fillStyle = mix(P.rise, '#000000', 0.3); rr(g, cx - cw / 2, cy - 2, cw, 4, 2); g.fill(); if (m.rise === 'lava') { g.strokeStyle = P.riseTop; g.lineWidth = 0.8; g.beginPath(); g.moveTo(cx - cw * 0.2, cy - 1.5); g.lineTo(cx, cy + 0.2); g.lineTo(cx + cw * 0.25, cy - 1); g.stroke(); } }
    else if (m.rise === 'poison') {   // 毒の沼：ふくらんではじける泡と、暗いしみ
      var bk = ((t * 0.6 + hash(i, 4)) % 1), br = (0.15 + bk * 0.35) * cw;
      g.fillStyle = alpha(mix(P.rise, '#000000', 0.35), 0.6); ell(g, cx + cw * 0.3, cy + 3, cw * 0.35, 1.8); g.fill();
      if (bk < 0.92) { g.fillStyle = alpha(P.riseLight, 0.55); ell(g, cx, cy, br, br * 0.9); g.fill(); g.strokeStyle = P.riseTop; g.lineWidth = 0.9; ell(g, cx, cy, br, br * 0.9); g.stroke(); g.fillStyle = 'rgba(255,255,255,.6)'; ell(g, cx - br * 0.35, cy - br * 0.35, br * 0.22, br * 0.18); g.fill(); }
    }
    else if (m.rise === 'storm') { if ((t * 2 + i) % 3 < 0.15) { g.strokeStyle = P.riseTop; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx, cy - 6); g.lineTo(cx + 3, cy); g.lineTo(cx - 1, cy); g.lineTo(cx + 2, cy + 7); g.stroke(); } }
    else { g.fillStyle = alpha(P.riseTop, 0.6); ell(g, cx, cy, 1, 1); g.fill(); }
  }
  function rise(g, P, x, y, w, h, t) {
    var m = motifOf(P);
    var gl = g.createLinearGradient(0, y - 40, 0, y + 6); gl.addColorStop(0, alpha(P.riseLight, 0)); gl.addColorStop(1, alpha(P.riseLight, 0.4)); g.fillStyle = gl; g.fillRect(x, y - 40, w, 46);
    var surf = function (xx) { return y + 5 + Math.sin(xx * 0.045 + t * 2.2) * 3 + Math.sin(xx * 0.11 - t * 1.4) * 1.5; };
    var xx;
    g.fillStyle = P.riseLight; g.beginPath(); g.moveTo(x, y + h); for (xx = 0; xx <= w; xx += 4) g.lineTo(x + xx, surf(xx) - 3 + Math.sin(xx * 0.07 + t * 1.6) * 2); g.lineTo(x + w, y + h); g.closePath(); g.fill();
    g.fillStyle = P.rise; g.beginPath(); g.moveTo(x, y + h); for (xx = 0; xx <= w; xx += 4) g.lineTo(x + xx, surf(xx)); g.lineTo(x + w, y + h); g.closePath(); g.fill();
    riseCrusts(P, x, y, w, h, t).forEach(function (c) { riseCrust(g, P, c, t); });
    g.strokeStyle = P.riseTop; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); for (xx = 0; xx <= w; xx += 4) g.lineTo(x + xx, surf(xx)); g.stroke();
  }

  /* ---------- プレイヤー：白いおばけ・線の目・薄ピンクの頬・赤いマフラー ---------- */
  var POSES = {
    stand: { name: '立ち', tilt: 0, sq: 0, hands: [[-8.5, 4], [8.5, 4]], feet: [[-4, 12.5], [4.5, 12.5]], scarf: [[-4, -1], [-11, 2], [-15, 8], [-17, 15], [-16, 21]], expr: 'normal', look: [1, 0], hem: 0 },
    cling: { name: '壁に張り付き', tilt: -0.08, sq: 0, hands: [[-11.5, -5], [-11.5, 3]], feet: [[-10.5, 10], [-8, 12.5]], scarf: [[-4, -1], [-9, 5], [-10, 12], [-8, 19], [-9, 26]], expr: 'normal', look: [1, -0.5], wall: true, hem: -0.6 },
    jump: { name: 'ジャンプ', tilt: 0.18, sq: -0.1, hands: [[-9, -7], [9, -8]], feet: [[-6, 12], [2, 13.5]], scarf: [[-4, -1], [-12, 4], [-20, 8], [-28, 15], [-34, 23]], expr: 'brave', look: [1, -0.7], hem: -1.8 },
    air: { name: '2段ジャンプ', tilt: 0.5, sq: 0.08, hands: [[-6, 3], [6.5, 2]], feet: [[-3, 10], [5, 9]], scarf: [[-4, -1], [-11, -4], [-19, -4], [-26, 1], [-31, 8]], expr: 'happy', look: [1, 0], hem: -0.9 },
    hurt: { name: 'ダメージ', tilt: -0.32, sq: 0.06, hands: [[-11, -6], [10.5, -7]], feet: [[-7.5, 12], [6.5, 10]], scarf: [[-4, -1], [-8, -8], [-13, -14], [-14, -21], [-12, -28]], expr: 'hurt', look: [-1, 0], hem: 1.2 }
  };
  // 動きを増やすポーズ（本編で状態に合わせて切り替える）
  var MORE = {
    kick: { name: '蹴った瞬間', tilt: 0.32, sq: -0.16, hands: [[-12, 2], [-10, 7]], feet: [[-8, 11], [-2, 13]], scarf: [[-4, -1], [-13, 2], [-22, 5], [-31, 9], [-39, 14]], expr: 'brave', look: [1, -0.5], hem: -2.4 },
    fall: { name: '落ちる', tilt: -0.06, sq: -0.05, hands: [[-10.5, -9], [10.5, -10]], feet: [[-5, 13], [5, 13]], scarf: [[-4, -1], [-8, -7], [-11, -14], [-10, -21], [-12, -27]], expr: 'surprised', look: [0, 0.7], hem: 2.2 },
    land: { name: '着地', tilt: 0, sq: 0.13, hands: [[-11.5, 6], [11.5, 6]], feet: [[-6, 12.5], [6, 12.5]], scarf: [[-4, -1], [-10, 3], [-13, 9], [-14, 15], [-13, 20]], expr: 'squint', look: [1, 0.3], hem: 0.9 },
    wobble: { name: 'グラグラ', tilt: -0.1, sq: 0.02, hands: [[-11.5, -6], [-11.5, 2]], feet: [[-10.5, 10], [-8, 12.5]], scarf: [[-4, -1], [-9, 5], [-10, 12], [-8, 19], [-9, 26]], expr: 'worried', look: [1, 0.4], wall: true, hem: -0.6, sweat: true },
    slide: { name: '壁を滑る', tilt: -0.06, sq: -0.03, hands: [[-11.5, -8], [-11, -1]], feet: [[-10.5, 11], [-8, 13]], scarf: [[-4, -1], [-8, -6], [-9, -13], [-7, -19], [-8, -25]], expr: 'calm', look: [1, 0.6], wall: true, hem: 1.4 },
    hover: { name: 'ホバリング', tilt: 0.04, sq: 0.05, hands: [[-13, -2], [13, -3]], feet: [[-4, 11], [4, 11]], scarf: [[-4, -1], [-11, -3], [-18, -2], [-24, 2], [-29, 7]], expr: 'happy', look: [1, 0.2], hem: 1.6 },
    sleep: { name: 'うとうと', tilt: 0.12, sq: 0.06, hands: [[-8, 6.5], [8.5, 6.5]], feet: [[-4, 12.5], [4.5, 12.5]], scarf: [[-4, -1], [-10, 3], [-13, 9], [-14, 16], [-13, 22]], expr: 'sleep', look: [0.4, 0.6], hem: 0.3, zzz: true },
    cheer: { name: 'やったー', tilt: 0, sq: -0.08, hands: [[-10, -12], [10.5, -12]], feet: [[-5, 13], [5, 13]], scarf: [[-4, -1], [-11, 0], [-17, 4], [-21, 10], [-23, 16]], expr: 'happy', look: [0.6, -0.6], hem: -0.6 }
,
    // ここから：同じ場面の言い換え（本編がその場でどれかを選ぶ）と、つなぎの一瞬
    kick2: { name: '蹴った瞬間2', tilt: 0.4, sq: -0.18, hands: [[-11, 5], [12.5, -6]], feet: [[-8, 11], [-2, 13]], scarf: [[-4, -1], [-13, 1], [-23, 3], [-33, 6], [-41, 10]], expr: 'brave', look: [1, -0.4], hem: -2.6 },
    grab: { name: '壁に着いた', tilt: -0.16, sq: 0.12, hands: [[-12, -7], [-12, 4]], feet: [[-10.5, 10], [-8, 12.5]], scarf: [[-4, -1], [-9, -5], [-13, -10], [-15, -16], [-14, -22]], expr: 'squint', look: [1, -0.2], wall: true, hem: 1.2 },
    clingUp: { name: '壁で見上げる', tilt: -0.04, sq: -0.02, hands: [[-11.5, -9], [-11.5, 2]], feet: [[-10.5, 10], [-8, 12.5]], scarf: [[-4, -1], [-9, 5], [-10, 12], [-8, 19], [-9, 26]], expr: 'normal', look: [0.5, -1], wall: true, hem: -0.4 },
    apex: { name: 'てっぺん', tilt: 0.06, sq: 0.03, hands: [[-10.5, -1], [10.5, -2]], feet: [[-5, 12], [5, 12]], scarf: [[-4, -1], [-10, 1], [-15, 5], [-19, 10], [-21, 16]], expr: 'calm', look: [1, 0.5], hem: 0.4 },
    flip: { name: '宙返り', tilt: 0, sq: 0.08, hands: [[-4, 6], [5, 5.5]], feet: [[-3, 10], [3, 10]], scarf: [[-4, -1], [-10, -5], [-17, -7], [-24, -6], [-30, -3]], expr: 'squint', look: [1, 0.3], hem: -1.2 },
    twirl: { name: 'くるり', tilt: 0, sq: -0.05, hands: [[-13, -1], [13, -2]], feet: [[-4, 12], [4, 12]], scarf: [[-4, -1], [-11, -1], [-17, 2], [-22, 7], [-25, 13]], expr: 'happy', look: [0.4, -0.2], hem: -1.4 },
    panic: { name: 'わたわた', tilt: -0.1, sq: -0.07, hands: [[-11.5, -11], [11, -12]], feet: [[-5, 13], [5, 13]], scarf: [[-4, -1], [-7, -8], [-9, -16], [-8, -24], [-10, -31]], expr: 'worried', look: [0, 0.9], hem: 2.6, sweat: true },
    landHeavy: { name: 'どすん', tilt: 0, sq: -0.14, hands: [[-13.5, 3], [13.5, 3]], feet: [[-7, 12.5], [7, 12.5]], scarf: [[-4, -1], [-10, -4], [-15, -6], [-19, -4], [-22, 0]], expr: 'squint', look: [1, 0.7], hem: 1.8 },
    dizzy: { name: 'くらくら', tilt: -0.14, sq: 0.03, hands: [[-10, 2.5], [10, 3.5]], feet: [[-5, 12.5], [5, 12.5]], scarf: [[-4, -1], [-10, 3], [-13, 9], [-14, 15], [-13, 21]], expr: 'dizzy', look: [0, 0], hem: 0.6, dizzy: true },
    stretch: { name: 'のび', tilt: 0, sq: -0.13, hands: [[-6, -15.5], [6.5, -15.5]], feet: [[-4, 12.5], [4.5, 12.5]], scarf: [[-4, -1], [-10, 3], [-13, 9], [-14, 15], [-13, 21]], expr: 'calm', look: [0, -0.6], hem: -0.5 },
    wave: { name: '手をふる', tilt: -0.05, sq: 0, hands: [[-8.5, 4], [11.5, -10]], feet: [[-4, 12.5], [4.5, 12.5]], scarf: [[-4, -1], [-11, 2], [-15, 8], [-17, 15], [-16, 21]], expr: 'happy', look: [0, 0.1], hem: 0 },
    lookUp: { name: '見上げる', tilt: -0.12, sq: 0.02, hands: [[-9, 4], [8, -3.5]], feet: [[-4, 12.5], [4.5, 12.5]], scarf: [[-4, -1], [-11, 2], [-15, 8], [-17, 15], [-16, 21]], expr: 'normal', look: [0.4, -1], hem: 0.2 },
    fist: { name: 'ガッツポーズ', tilt: 0.06, sq: -0.07, hands: [[-9.5, 4], [10, -13.5]], feet: [[-5, 13], [5, 13]], scarf: [[-4, -1], [-12, 0], [-18, 3], [-23, 8], [-26, 14]], expr: 'brave', look: [1, -0.4], hem: -0.5 }
  };
  for (var mk in MORE) POSES[mk] = MORE[mk];
  var POSE_ORDER = ['stand', 'cling', 'jump', 'air', 'hurt'];
  var POSE_MORE = ['kick', 'fall', 'land', 'wobble', 'slide', 'hover', 'sleep', 'cheer',
    'kick2', 'grab', 'clingUp', 'apex', 'flip', 'twirl', 'panic', 'landHeavy', 'dizzy', 'stretch', 'wave', 'lookUp', 'fist'];
  // マフラーのはし：平たい布を2本（後ろの短い1本は影の色）。ポーズの点より短く縮めて描き、はしは内側へ切れ込む
  function scarfTail(g, P, pts, t, w0) {
    w0 = w0 || 3.4;
    var o = pts[0], k = 0.62;
    var front = pts.map(function (p, i) { return [o[0] + (p[0] - o[0]) * k + Math.sin(t * 6 + i * 1.3) * 0.15 * i, o[1] + (p[1] - o[1]) * k + Math.cos(t * 6 + i * 1.1) * 0.2 * i]; });
    var back = front.map(function (p, i) { var f = i / (front.length - 1); return [o[0] + (p[0] - o[0]) * 0.75 + f * 1.2, o[1] + (p[1] - o[1]) * 0.75 + f * 2.6]; });
    ribbon(g, P, back, w0 * 0.85, P.scarfShade, mix(P.scarfShade, '#000000', 0.18), false);
    ribbon(g, P, front, w0, P.scarf, P.scarfShade, true);
  }
  function ribbon(g, P, pts, w0, base, shade, stripes) {
    var s = spline(pts, 5), L = [], R = [], n = s.length;
    for (var i = 0; i < n; i++) {
      var a = s[Math.max(0, i - 1)], b = s[Math.min(n - 1, i + 1)], nx = -(b[1] - a[1]), ny = b[0] - a[0], d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
      var w = w0 * (1 - 0.2 * i / n); L.push([s[i][0] + nx * w, s[i][1] + ny * w]); R.push([s[i][0] - nx * w, s[i][1] - ny * w]);
    }
    var e = s[n - 1], f = s[n - 2], dx = e[0] - f[0], dy = e[1] - f[1], dl = Math.hypot(dx, dy) || 1;
    var shape = function () {
      g.beginPath(); g.moveTo(L[0][0], L[0][1]); L.forEach(function (p) { g.lineTo(p[0], p[1]); });
      g.lineTo(e[0] - dx / dl * 1.6, e[1] - dy / dl * 1.6);   // はしの切れ込み（内側へ）
      for (var j = n - 1; j >= 0; j--) g.lineTo(R[j][0], R[j][1]); g.closePath();
    };
    solid(g, shape, base, shade, P.playerLine, stripes ? 1.1 : 0.6, 1.0);
    if (!stripes) return;
    g.strokeStyle = P.scarfStripe; g.lineWidth = 0.8;
    [0.62, 0.78].forEach(function (q) { var k2 = Math.round(q * (n - 1)); g.beginPath(); g.moveTo(L[k2][0], L[k2][1]); g.lineTo(R[k2][0], R[k2][1]); g.stroke(); });
  }
  // 首に巻いた帯：体の丸みに沿って真ん中が少し下がる（まっすぐな帯にしない）
  function scarfWrap(g, P, cx, cy, w, h) {
    var x0 = cx - w / 2 + 0.5, x1 = cx + w / 2 - 0.5, sag = 1.8;
    var band = function () { g.beginPath(); g.moveTo(x0, cy - h / 2); g.quadraticCurveTo(cx, cy - h / 2 + sag * 2, x1, cy - h / 2 - 0.6);
      g.quadraticCurveTo(x1 + 1.2, cy, x1, cy + h / 2 - 0.4); g.quadraticCurveTo(cx, cy + h / 2 + sag * 2, x0, cy + h / 2); g.quadraticCurveTo(x0 - 1.2, cy, x0, cy - h / 2); g.closePath(); };
    solid(g, band, P.scarf, P.scarfShade, P.playerLine, 0.9, 1.0);
    g.strokeStyle = P.scarfStripe; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x0 + 2.5, cy + 0.6); g.quadraticCurveTo(cx, cy + sag * 2 + 0.2, x1 - 2.5, cy + 0.2); g.stroke();
    solid(g, function () { ell(g, x0 + 1.2, cy + 0.6, 2.3, 2.1); }, P.scarf, P.scarfShade, P.playerLine, 0.7, 1.0);
  }
  // 線の目（ふつう＝縦の短い線、喜び＝∧、ダメージ＝＞＜、まばたき＝横線、やる気＝少し傾いた線）
  function lineEyes(g, P, eyes, expr, look, t, blinkNow) {
    var blink = blinkNow != null ? blinkNow && /^(normal|brave|calm|worried|surprised)$/.test(expr) : expr === 'normal' && (t % 3.4) < 0.12;
    g.strokeStyle = P.playerLine; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 1.25;
    eyes.forEach(function (e, i) {
      var x = e[0] + look[0] * 0.6, y = e[1] + look[1] * 0.6;
      g.lineWidth = 1.25; g.beginPath();
      if (blink) { g.moveTo(x - 1.2, y + 0.4); g.lineTo(x + 1.2, y + 0.4); }
      else if (expr === 'hurt') { var s = i ? -1 : 1; g.moveTo(x - 1.2 * s, y - 1.5); g.lineTo(x + 1 * s, y); g.lineTo(x - 1.2 * s, y + 1.5); }
      else if (expr === 'happy') { g.moveTo(x - 1.4, y + 0.8); g.lineTo(x, y - 0.8); g.lineTo(x + 1.4, y + 0.8); }
      else if (expr === 'surprised') { g.arc(x, y, 1.25, 0, Math.PI * 2); }
      else if (expr === 'sleep') { g.moveTo(x - 1.5, y - 0.2); g.quadraticCurveTo(x, y + 1.4, x + 1.5, y - 0.2); }
      else if (expr === 'squint') { g.moveTo(x - 1.4, y); g.lineTo(x + 1.4, y); }
      else if (expr === 'calm') { g.moveTo(x - 1.4, y - 0.2); g.quadraticCurveTo(x, y - 1.2, x + 1.4, y - 0.2); }
      else if (expr === 'dizzy') { g.lineWidth = 0.9; for (var sa = 0; sa <= 1.001; sa += 0.1) { var ang = sa * Math.PI * 2.6 + t * 8 * (i ? -1 : 1), rad = 0.2 + sa * 1.55; if (sa === 0) g.moveTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad); else g.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad); } }
      else if (expr === 'worried') { g.moveTo(x, y - 0.9); g.lineTo(x, y + 1.5); var d = i ? 1 : -1; g.moveTo(x - 1.5 * d, y - 2.6); g.lineTo(x + 0.9 * d, y - 3.4); }
      else if (expr === 'brave') { g.moveTo(x - 0.4, y - 1.8); g.lineTo(x + 0.4, y + 1.6); }
      else { g.moveTo(x, y - 1.7); g.lineTo(x, y + 1.7); }
      g.stroke();
    });
  }
  function cheeks(g, P, list) { g.fillStyle = P.playerCheek; list.forEach(function (c) { ell(g, c[0], c[1], 1.9, 1.15); g.fill(); }); }
  function ghostLimb(g, P, x, y, r) { solid(g, function () { ell(g, x, y, r, r * 0.9); }, P.playerBody, P.playerShade, P.playerLine, 0.5, 1.0); }

  // すその形（頭は丸く、横はまっすぐ下りて、すそが丸い山で波打つ）。sw：すその流れ、wv：波のゆらぎ
  function sheetPath(g, o, sw, wv) {
    var h = o.half, f = o.flare, y = o.hemY, top = o.top, sh = top + o.shoulder;
    g.beginPath(); g.moveTo(0, top);
    g.bezierCurveTo(h * 0.8, top, h, sh - 5, h, sh);
    g.quadraticCurveTo(h + sw * 0.2, y - 3, h + f + sw * 0.7, y);
    var x0 = h + f + sw * 0.7, x1 = -(h + f) + sw * 0.25, n = o.waves;
    for (var i = 0; i < n; i++) {
      var a = x0 + (x1 - x0) * i / n, b = x0 + (x1 - x0) * (i + 1) / n, d = o.amp * 1.5 + (i % 2 ? -wv : wv) * 0.7, sx = sw * 0.3;
      // 丸い山（半円に近い形）。山と山のつなぎ目も少し丸める
      g.bezierCurveTo(a + (b - a) * 0.02 + sx, y + d, b - (b - a) * 0.02 + sx, y + d, b, y + (i < n - 1 ? 0.2 : 0));
    }
    g.quadraticCurveTo(-h + sw * 0.1, y - 3, -h, sh);
    g.bezierCurveTo(-h, sh - 5, -h * 0.8, top, 0, top); g.closePath();
  }
  function sleeve(g, P, x0, y0, x1, y1, w) {   // そで：肩から手先までの丸い筒
    var dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, nx = -dy / d * w, ny = dx / d * w, a = Math.atan2(ny, nx);
    solid(g, function () { g.beginPath(); g.moveTo(x0 + nx, y0 + ny); g.lineTo(x1 + nx, y1 + ny); g.arc(x1, y1, w, a, a + Math.PI); g.lineTo(x0 - nx, y0 - ny); g.arc(x0, y0, w, a + Math.PI, a + Math.PI * 2); g.closePath(); }, P.playerBody, P.playerShade, P.playerLine, 0.5, 1.0);
  }
  function sheetGhost(o) {
    return function (g, P, Q, t) {
      var sw = (Q.hem || 0) * o.swing, wv = Math.sin(t * 5) * o.wobble;
      if (o.hood) {   // 頭の先：丸い先が後ろへ垂れて揺れる
        var sway = Math.sin(t * 2.6) * 1.2 + (Q.hem || 0) * 1.4;
        solid(g, function () { g.beginPath(); g.moveTo(-7, o.top + 4); g.quadraticCurveTo(-7.5 + sway * 0.4, o.top - 2.5, -10.5 + sway, o.top - 5.5); g.quadraticCurveTo(-5 + sway * 0.4, o.top - 4.5, 4, o.top + 2); g.closePath(); }, P.playerBody, P.playerShade, P.playerLine, 0.8, 1.15);
        solid(g, function () { ell(g, -11 + sway, o.top - 5.4, 2.3, 2.3); }, P.playerBody, P.playerShade, P.playerLine, 0.5, 1.0);
      }
      var shoulder = function (hx) { return hx < 0 ? -o.half + 3 : o.half - 3; };   // そでは手と同じ側の肩から出す
      if (o.sleeves) sleeve(g, P, shoulder(Q.hands[0][0]), 0.5, Q.hands[0][0], Q.hands[0][1], 2.1);
      else ghostLimb(g, P, Q.hands[0][0], Q.hands[0][1], o.hand);
      var body = function () { sheetPath(g, o, sw, wv); };
      solid(g, body, P.playerBody, P.playerShade, P.playerLine, 1.9);
      // すその内側の影
      g.save(); body(); g.clip(); g.fillStyle = P.playerShade;
      g.beginPath(); g.moveTo(-20, o.hemY - 1.2); g.quadraticCurveTo(0, o.hemY - 3, 20, o.hemY - 1.2); g.lineTo(20, 30); g.lineTo(-20, 30); g.closePath(); g.fill(); g.restore();
      shine(g, -o.half * 0.5, o.top + 4.5, 2.4, 1.3, 0.9);
      lineEyes(g, P, o.eyes, Q.expr, Q.look, t, Q.blink); cheeks(g, P, o.cheeks);
      if (Q.sweat) {   // 汗：額の横に小さなしずく（揺れる）
        var sy = o.top + 5 + Math.sin(t * 6) * 0.6;
        solid(g, function () { g.beginPath(); g.moveTo(o.half - 0.5, sy - 3); g.quadraticCurveTo(o.half + 2.2, sy + 0.5, o.half + 0.8, sy + 1.6); g.quadraticCurveTo(o.half - 1.6, sy + 1.4, o.half - 0.5, sy - 3); g.closePath(); }, '#ffffff', P.playerShade, P.playerLine, 0.4, 0.8);
      }
      if (Q.zzz) {   // 寝息：小さな z が3つ、ゆっくり上へ
        g.strokeStyle = P.playerLine; g.lineWidth = 0.9; g.lineCap = 'round'; g.lineJoin = 'round';
        for (var zi = 0; zi < 3; zi++) {
          var zk = (t * 0.45 + zi / 3) % 1, zs = 1.4 + zk * 1.6, zx = 6 + zk * 7, zy = o.top - 2 - zk * 12;
          g.globalAlpha = Math.min(1, (1 - zk) * 2.2); g.beginPath(); g.moveTo(zx - zs, zy - zs); g.lineTo(zx + zs, zy - zs); g.lineTo(zx - zs, zy + zs); g.lineTo(zx + zs, zy + zs); g.stroke();
        }
        g.globalAlpha = 1;
      }
      if (Q.dizzy) {   // くらくら：頭の上を小さな星が3つ回る（player の色と線だけ）
        for (var di = 0; di < 3; di++) {
          var da = t * 5 + di * 2.09, dx = Math.cos(da) * 9, dy = o.top - 3 + Math.sin(da) * 2.6, ds = 1.9 + Math.sin(da) * 0.5;
          if (Math.sin(da) < -0.2) continue;   // 頭の向こう側は隠れる
          solid(g, function () { g.beginPath(); for (var k = 0; k < 10; k++) { var r5 = k % 2 ? ds * 0.45 : ds, a5 = -Math.PI / 2 + k * Math.PI / 5; g.lineTo(dx + Math.cos(a5) * r5, dy + Math.sin(a5) * r5); } g.closePath(); }, '#ffffff', P.playerShade, P.playerLine, 0.3, 0.7);
        }
      }
      scarfWrap(g, P, 0, o.scarfY, o.scarfW, 3.2);
      if (o.sleeves) sleeve(g, P, shoulder(Q.hands[1][0]), 0.5, Q.hands[1][0], Q.hands[1][1], 2.1);
      else ghostLimb(g, P, Q.hands[1][0], Q.hands[1][1], o.hand);
    };
  }
  var GHOSTS = {
    sheet: { letter: 'B1', name: 'ふんわり', note: 'プレイヤーに決定。すそが少し広がり、大きな丸い山が3つ。手は小さな丸。',
      draw: sheetGhost({ top: -12.5, half: 10, shoulder: 11.5, flare: 1.6, hemY: 10, waves: 3, amp: 2.4, swing: 1.6, wobble: 0.9, hand: 2.1,
        eyes: [[2.2, -4.2], [6.6, -4.4]], cheeks: [[0.2, -1], [8.8, -1.3]], scarfY: 1.6, scarfW: 19 }) }
  };
  function ghost(g, P, variant, poseId, x, y, t, face, scale) {
    var Q = POSES[poseId], G = GHOSTS[variant]; face = face || 1; scale = scale || 1;
    g.save(); g.translate(x, y); g.scale(face * scale, scale);
    g.rotate(Q.tilt + (poseId === 'air' ? Math.sin(t * 3) * 0.15 : 0)); g.scale(1 - Q.sq * 0.6, 1 + Q.sq);
    scarfTail(g, P, Q.scarf, t);
    G.draw(g, P, Q, t);
    g.restore();
  }

  /* ---------- エフェクト ---------- */
  function effects(g, P, x, y, t) {
    var p = (t % 1.6) / 1.6, i;
    for (i = 0; i < 6; i++) { var a = (1 - p); g.fillStyle = alpha(P.terrainLight, a * 0.85); ell(g, x - 34 - p * (10 + i * 4), y + (i - 3) * 3 - p * 8, (2 + hash(i, 1) * 2) * (1 + p), (2 + hash(i, 1) * 2) * (1 + p)); g.fill(); }
    // 2段ジャンプの輪は使わない
    for (i = 0; i < 8; i++) { var an = i / 8 * Math.PI * 2; g.fillStyle = alpha(P.hazard, 1 - p); ell(g, x + 40 + Math.cos(an) * p * 18, y + Math.sin(an) * p * 18, 2, 2); g.fill(); }
  }

  /* ---------- 画面の表示 ---------- */
  function heart(g, P, x, y, full, s) {
    s = s || 12; g.beginPath(); g.moveTo(x, y + s * 0.3);
    g.bezierCurveTo(x, y - s * 0.1, x - s * 0.55, y - s * 0.1, x - s * 0.55, y + s * 0.25);
    g.bezierCurveTo(x - s * 0.55, y + s * 0.55, x - s * 0.1, y + s * 0.7, x, y + s * 0.9);
    g.bezierCurveTo(x + s * 0.1, y + s * 0.7, x + s * 0.55, y + s * 0.55, x + s * 0.55, y + s * 0.25);
    g.bezierCurveTo(x + s * 0.55, y - s * 0.1, x, y - s * 0.1, x, y + s * 0.3); g.closePath();
    g.fillStyle = full ? P.scarf : alpha(P.uiInk, 0.25); g.fill();
    if (full) { g.fillStyle = 'rgba(255,255,255,.45)'; ell(g, x - s * 0.25, y + s * 0.2, s * 0.12, s * 0.08, -0.6); g.fill(); }
  }
  // opt.crystals：結晶の数（ハートの下）、opt.gems：装備 [{kind, star, lv, cool}]（右上に丸い枠2つ）、opt.t：時間
  function hud(g, P, w, h, meters, opt) {
    opt = opt || {}; var t = opt.t || 0, F = '"M PLUS Rounded 1c", system-ui, sans-serif';
    g.fillStyle = alpha(P.uiPanel, 0.85); rr(g, 8, 8, 64, 22, 11); g.fill();
    for (var i = 0; i < 3; i++) heart(g, P, 22 + i * 18, 13, i < (opt.hp == null ? 2 : opt.hp));
    var label = meters + 'm'; g.font = '800 15px ' + F;
    var tw = g.measureText(label).width; g.fillStyle = alpha(P.uiPanel, 0.85); rr(g, w / 2 - tw / 2 - 14, 8, tw + 28, 24, 12); g.fill();
    g.fillStyle = P.uiInk; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, w / 2, 20.5);
    if (opt.crystals != null) {
      g.fillStyle = alpha(P.uiPanel, 0.85); rr(g, 8, 34, 64, 22, 11); g.fill();
      mote(g, P, 21, 45, t, 0.7, 0);
      g.fillStyle = P.uiInk; g.font = '800 13px ' + F; g.textAlign = 'left'; g.fillText(String(opt.crystals), 33, 45.5);
    }
    if (opt.gems) for (var j = 0; j < 2; j++) { var q = opt.gems[j]; gemBadge(g, P, q ? q.kind : null, q ? q.star : 0, w - 22 - (1 - j) * 32, 22, t, q ? { lv: q.lv, cool: q.cool } : {}); }
  }

  /* ---------- ローグライク：結晶（お金）・水晶（装備）・ガチャ所 ----------
     結晶＝ゾーンの glow の光の粒（形のない光なので縁取らない）。
     水晶＝触れて何か起きるもの（装備するもの）なので ink で縁取る。色はレア度（gem-mint / gem-blue / gem-gold）で、どのゾーンでも同じ。
     先は短く丸めて、トゲ（危険）と区別する。真ん中に効き目の印（光る線）。 */
  var GEM_KINDS = {
    greed: { name: '欲ばり', star: 1 }, hover: { name: 'ホバリング', star: 1 }, slide: { name: 'かべすべり', star: 1 },
    triple: { name: '3段ジャンプ', star: 2 }, predict: { name: '予測線', star: 2 }, turn: { name: '振り向き', star: 3 }
  };
  var GEM_ORDER = ['greed', 'hover', 'slide', 'triple', 'predict', 'turn'];
  function gemTone(P, star) { return star >= 3 ? [P.gemGold, P.gemGoldShade] : star === 2 ? [P.gemBlue, P.gemBlueShade] : [P.gemMint, P.gemMintShade]; }

  // 結晶：ぼんやりした光＋十字のきらめき＋白い芯。s が 1 以上なら、まわりを小さな粒が回る
  function mote(g, P, x, y, t, s, seed) {
    s = s || 1; seed = seed || 0;
    var tw = 0.85 + Math.sin(t * 4 + seed * 2) * 0.15, i;
    var gl = g.createRadialGradient(x, y, 0, x, y, 11 * s); gl.addColorStop(0, alpha(P.glow, 0.55 * tw)); gl.addColorStop(0.45, alpha(P.glow, 0.18 * tw)); gl.addColorStop(1, alpha(P.glow, 0));
    g.fillStyle = gl; ell(g, x, y, 11 * s, 11 * s); g.fill();
    var L = (5 + tw * 2.5) * s, wd = 0.9 * s;
    g.fillStyle = 'rgba(255,255,255,' + (0.85 * tw) + ')'; g.beginPath();
    g.moveTo(x, y - L * 1.2); g.quadraticCurveTo(x + wd, y - wd, x + L, y); g.quadraticCurveTo(x + wd, y + wd, x, y + L * 1.2);
    g.quadraticCurveTo(x - wd, y + wd, x - L, y); g.quadraticCurveTo(x - wd, y - wd, x, y - L * 1.2); g.fill();
    g.fillStyle = P.glow; ell(g, x, y, 2.6 * s, 2.6 * s); g.fill();
    g.fillStyle = '#ffffff'; ell(g, x, y, 1.5 * s, 1.5 * s); g.fill();
    if (s >= 1) for (i = 0; i < 3; i++) {
      var a = t * (1.6 + i * 0.4) + seed + i * 2.1, r = (6 + i * 1.5) * s;
      g.fillStyle = alpha(P.glow, 0.5 + 0.4 * Math.sin(t * 4 + i + seed)); ell(g, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, 0.9 * s, 0.9 * s); g.fill();
    }
  }

  // 水晶（案A「ガラスの柱」）：六角の柱を半透明にして、面ごとに透け方を変える。印は中に沈んで見える
  function hexPath(g, w, h, tip) { g.beginPath(); g.moveTo(0, -h); g.lineTo(w, -h + tip); g.lineTo(w, h - tip); g.lineTo(0, h); g.lineTo(-w, h - tip); g.lineTo(-w, -h + tip); g.closePath(); }
  // 面ごとにグラデーションをかけた宝石の柱。中から光り、光の筋がゆっくり面をなでる。t：時間（光の筋）、ph：筋のずれ
  function prism(g, P, c, w, h, t, ph) {
    var tip = h * 0.42, iw = w * 0.36, ty = -h + tip * 1.2, by = h - tip * 0.8, light = mix(c[0], '#ffffff', 0.4), deep = mix(c[1], '#000000', 0.3);
    t = t || 0; ph = ph || 0;
    var face = function (pts, fill) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (var k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]); g.closePath(); g.fillStyle = fill; g.fill(); };
    var lin = function (x0, y0, x1, y1, stops) { var q = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(function (st) { q.addColorStop(st[0], st[1]); }); return q; };
    // 本体：上が明るく下が濃い
    hexPath(g, w, h, tip); g.fillStyle = lin(0, -h, 0, h, [[0, light], [0.4, c[0]], [0.75, c[1]], [1, deep]]); g.fill();
    g.save(); hexPath(g, w, h, tip); g.clip();
    face([[-w, -h + tip], [-iw, ty], [-iw, by], [-w, h - tip]], lin(-w, 0, -iw, 0, [[0, 'rgba(255,255,255,.45)'], [1, 'rgba(255,255,255,.08)']]));   // 左の面：光を受ける
    face([[iw, ty], [w, -h + tip], [w, h - tip], [iw, by]], lin(iw, 0, w, 0, [[0, alpha(c[1], 0.25)], [1, alpha(deep, 0.75)]]));   // 右の面：影
    face([[-iw, ty], [iw, ty], [iw, by], [-iw, by]], lin(0, ty, 0, by, [[0, 'rgba(255,255,255,.18)'], [0.6, 'rgba(255,255,255,0)'], [1, alpha(c[1], 0.35)]]));   // 正面
    face([[0, -h], [w, -h + tip], [iw, ty], [-iw, ty], [-w, -h + tip]], lin(0, -h, 0, ty, [[0, 'rgba(255,255,255,.85)'], [1, 'rgba(255,255,255,.35)']]));   // 上の面
    face([[-w, h - tip], [-iw, by], [iw, by], [w, h - tip], [0, h]], alpha(deep, 0.45));   // 下の面
    // 中の光（芯）
    g.globalCompositeOperation = 'lighter';
    var core = g.createRadialGradient(0, h * 0.1, 0, 0, h * 0.1, h * 0.9); core.addColorStop(0, alpha(light, 0.32)); core.addColorStop(1, alpha(c[0], 0)); g.fillStyle = core; g.fillRect(-w, -h, w * 2, h * 2);
    // 光の筋：ななめの帯が上から下へ流れる
    var sw = ((t * 0.45 + ph) % 1.6) / 1.6, sy = -h * 1.6 + sw * h * 3.6;
    g.fillStyle = lin(0, sy - h * 0.35, 0, sy + h * 0.35, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]);
    g.beginPath(); g.moveTo(-w, sy - h * 0.1 - w * 0.6); g.lineTo(w, sy - h * 0.1 + w * 0.6); g.lineTo(w, sy + h * 0.15 + w * 0.6); g.lineTo(-w, sy + h * 0.15 - w * 0.6); g.closePath(); g.fill();
    g.globalCompositeOperation = 'source-over';
    g.restore();
    // 面の稜線（明るい線）と、左上のふちの光
    g.strokeStyle = alpha(light, 0.9); g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(-iw, ty); g.lineTo(-iw, by); g.moveTo(iw, ty); g.lineTo(iw, by); g.moveTo(-w, -h + tip); g.lineTo(-iw, ty); g.lineTo(iw, ty); g.lineTo(w, -h + tip); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-w + 0.4, h - tip - 1); g.lineTo(-w + 0.4, -h + tip); g.lineTo(0, -h + 0.5); g.stroke();
    g.strokeStyle = mix(deep, P.ink, 0.55); g.lineWidth = 1; g.lineJoin = 'round'; hexPath(g, w, h, tip); g.stroke();
  }
  // 効き目の印（中心 0,1 のまわり 7px ほど）
  var SIGNS = {
    greed: function (g) { [[-2.2, 2.6], [2.2, 2.6], [0, -1.2]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 1.7, 0, Math.PI * 2); g.stroke(); }); },
    hover: function (g) { g.beginPath(); g.moveTo(-3.6, 0.6); g.quadraticCurveTo(-3.4, -3.4, 0, -3.4); g.quadraticCurveTo(3.4, -3.4, 3.6, 0.6); g.quadraticCurveTo(1.8, -0.4, 0, 0.6); g.quadraticCurveTo(-1.8, -0.4, -3.6, 0.6); g.moveTo(0, 0.6); g.lineTo(0, 4.4); g.quadraticCurveTo(0, 5.4, -1, 5); g.stroke(); },
    slide: function (g) { g.beginPath(); g.moveTo(-3, -3.6); g.lineTo(-3, 5); g.moveTo(1, -2.6); g.lineTo(1, 3); g.moveTo(-1.2, 1.4); g.lineTo(1, 3.6); g.lineTo(3.2, 1.4); g.stroke(); },
    triple: function (g) { [-3, 0, 3].forEach(function (dy) { g.beginPath(); g.moveTo(-2.8, dy + 1.8); g.lineTo(0, dy - 0.6); g.lineTo(2.8, dy + 1.8); g.stroke(); }); },
    predict: function (g) { g.fillStyle = g.strokeStyle; [[-3.4, 4.2], [-2.6, 0.8], [-0.9, -1.6]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 0.95, 0, Math.PI * 2); g.fill(); }); g.beginPath(); g.arc(2.4, -1.2, 1.9, 0, Math.PI * 2); g.stroke(); },
    turn: function (g) { g.beginPath(); g.moveTo(-3.6, 0.8); g.lineTo(3.6, 0.8); g.moveTo(-1.6, -1.4); g.lineTo(-3.8, 0.8); g.lineTo(-1.6, 3); g.moveTo(1.6, -1.4); g.lineTo(3.8, 0.8); g.lineTo(1.6, 3); g.stroke(); }
  };
  function twinkle(g, x, y, L, a) {
    g.fillStyle = 'rgba(255,255,255,' + a + ')'; g.beginPath();
    g.moveTo(x, y - L); g.quadraticCurveTo(x + 0.5, y - 0.5, x + L, y); g.quadraticCurveTo(x + 0.5, y + 0.5, x, y + L); g.quadraticCurveTo(x - 0.5, y + 0.5, x - L, y); g.quadraticCurveTo(x - 0.5, y - 0.5, x, y - L); g.fill();
  }
  // 水晶。star が 2 なら横に小さな柱1つ、3 なら2つ＋きらめき。高さはおよそ 19×s
  // まわりにやわらかい光、中に光る印（彫りこんだ線が光る）、角にきらめき
  function gem(g, P, kind, star, x, y, s, t) {
    s = s || 1; t = t || 0; var c = gemTone(P, star), light = mix(c[0], '#ffffff', 0.55);
    g.save(); g.translate(x, y); g.scale(s, s); g.lineJoin = 'round'; g.lineCap = 'round';
    g.globalCompositeOperation = 'lighter';
    var halo = g.createRadialGradient(0, 1, 1, 0, 1, 11); halo.addColorStop(0, alpha(c[0], 0.45)); halo.addColorStop(0.55, alpha(c[0], 0.14)); halo.addColorStop(1, alpha(c[0], 0));   // 枠（約 22×s）からはみ出さない
    g.fillStyle = halo; ell(g, 0, 1, 11, 11); g.fill();
    g.globalCompositeOperation = 'source-over';
    if (star >= 2) { g.save(); g.translate(6.4, 4.8); g.rotate(0.5); prism(g, P, c, 2.7, 5.4, t, 0.5); g.restore(); }
    if (star >= 3) { g.save(); g.translate(-6.6, 5.4); g.rotate(-0.55); prism(g, P, c, 2.3, 4.6, t, 1.1); g.restore(); }
    prism(g, P, c, 5.6, 9.8, t, 0);
    var sign = SIGNS[kind];
    if (sign) {   // 印：外側に色の光、内側に白い芯
      g.save(); g.translate(0, 0.4);
      g.globalCompositeOperation = 'lighter'; g.strokeStyle = alpha(light, 0.55); g.fillStyle = g.strokeStyle; g.lineWidth = 2.6; sign(g);
      g.globalCompositeOperation = 'source-over'; g.strokeStyle = 'rgba(255,255,255,.95)'; g.fillStyle = g.strokeStyle; g.lineWidth = 1.05; sign(g);
      g.restore();
    }
    var tw = Math.max(0, Math.sin(t * 2.2 + star));   // てっぺんのきらめき（ときどき光る）
    if (tw > 0.2) twinkle(g, -1.2, -8.6, (1.2 + tw * 2.4), 0.95 * tw);
    if (star >= 3) { twinkle(g, 7.4, -8.2, 2.2 + Math.sin(t * 3) * 1, 0.9); twinkle(g, -8.4, -2.6, 1.4 + Math.sin(t * 3.7 + 1) * 0.8, 0.8); }
    g.restore();
  }
  // 装備の枠（画面の表示）：丸い板に水晶、下にレベルの点3つ。cool（0〜1）はリチャージの残り、kind が null なら空き
  function gemBadge(g, P, kind, star, x, y, t, opt) {
    opt = opt || {}; var r = opt.r || 13, i;
    g.fillStyle = alpha(P.uiPanel, 0.85); ell(g, x, y, r, r); g.fill();
    if (!kind) {
      g.strokeStyle = alpha(P.uiInk, 0.3); g.lineWidth = 1.2; g.setLineDash([2.5, 2.5]); ell(g, x, y, r - 3, r - 3); g.stroke(); g.setLineDash([]);
      return;
    }
    var tone = gemTone(P, star);
    g.strokeStyle = tone[0]; g.lineWidth = 1.6; ell(g, x, y, r - 1.2, r - 1.2); g.stroke();
    gem(g, P, kind, star, x, y - 1, r / 15, t);
    if (opt.cool > 0) {   // リチャージ中：暗い扇形が時計回りに減っていく
      g.fillStyle = alpha(P.uiPanel, 0.72); g.beginPath(); g.moveTo(x, y); g.arc(x, y, r - 0.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * opt.cool); g.closePath(); g.fill();
    }
    var lv = opt.lv || 1;
    for (i = 0; i < 3; i++) { g.fillStyle = i < lv ? tone[0] : alpha(P.uiInk, 0.25); ell(g, x - 4.5 + i * 4.5, y + r + 3.2, 1.5, 1.5); g.fill(); }
  }

  function glowAt(g, P, x, y, r, a, color) { var gl = g.createRadialGradient(x, y, 1, x, y, r); gl.addColorStop(0, alpha(color || P.glow, a)); gl.addColorStop(1, alpha(color || P.glow, 0)); g.fillStyle = gl; ell(g, x, y, r, r); g.fill(); }
  // ガチャ所（案D「ランタン塔」）：細い土の塔のてっぺんがガラスの灯りで、中を結晶が回る。(x, y) は床の真ん中。lit=false で使ったあと（灯りが消える）
  function gachaHouse(g, P, x, y, t, lit) {
    var top = y - 30, i;
    g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
    if (lit) glowAt(g, P, x, top - 12, 38, 0.3 + Math.sin(t * 2) * 0.04);
    solid(g, function () { g.beginPath(); g.moveTo(x - 13, y); g.lineTo(x - 10, top); g.lineTo(x + 10, top); g.lineTo(x + 13, y); g.closePath(); }, P.terrainLight, P.terrainShade, P.ink, 1.4, 1.1);
    g.fillStyle = alpha(P.terrainShade, 0.55); for (i = 1; i < 4; i++) g.fillRect(x - 11.5 + i * 0.4, top + i * 7.5, 23 - i * 0.8, 1);   // 石の段
    solid(g, function () { g.beginPath(); g.moveTo(x - 4.5, y); g.lineTo(x - 4.5, y - 8); g.arc(x, y - 8, 4.5, Math.PI, 0); g.lineTo(x + 4.5, y); g.closePath(); }, P.metal, P.metalShade, P.ink, 0.6, 0.9);   // 扉
    g.fillStyle = lit ? P.glow : P.metalLight; ell(g, x + 2.4, y - 5, 0.8, 0.8); g.fill();
    solid(g, function () { rr(g, x - 14, top - 3, 28, 4, 2); }, P.metal, P.metalShade, P.ink, 0.6, 1);   // 手すり
    g.fillStyle = lit ? alpha(P.glow, 0.45) : alpha(P.uiPanel, 0.8); rr(g, x - 9, top - 17, 18, 14, 3); g.fill();   // ガラスの灯り
    if (lit) for (i = 0; i < 4; i++) { var a = t * 1.5 + i * 1.6; mote(g, P, x + Math.cos(a) * 5, top - 10 + Math.sin(a) * 2.5, t, 0.32, i); }
    g.strokeStyle = P.ink; g.lineWidth = 1.1; rr(g, x - 9, top - 17, 18, 14, 3); g.stroke(); g.beginPath(); g.moveTo(x, top - 17); g.lineTo(x, top - 3); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 6.5, top - 14); g.lineTo(x - 6.5, top - 7); g.stroke();
    solid(g, function () { g.beginPath(); g.moveTo(x - 12, top - 16); g.quadraticCurveTo(x, top - 31, x + 12, top - 16); g.closePath(); }, P.metal, P.metalShade, P.ink, 1.2, 1.1);   // 屋根
    solid(g, function () { ell(g, x, top - 27, 2, 2); }, P.metal, P.metalShade, P.ink, 0.4, 0.9);
    g.restore();
  }

  // ガチャの器（フラスコ）：まるいガラスのフラスコに光の液。台の下で小さな火がゆれる。
  // spin（0〜1）で液が波打ち、泡が増え、口から湯気が出て揺れる。liquid：液の色（省略で glow。演出でレア度の色に変える）
  // (x, y) はフラスコの体の真ん中あたり。口は y-46、台の下は y+42
  function gachaFlask(g, P, x, y, t, spin, liquid) {
    spin = spin || 0; var liq = liquid || P.glow, sh = spin > 0.3 ? Math.sin(t * 30) * spin * 1.2 : 0, i;
    g.save(); g.translate(x + sh, y); g.lineJoin = 'round'; g.lineCap = 'round';
    g.globalCompositeOperation = 'lighter'; glowAt(g, P, 0, -2, 60, 0.22 + spin * 0.3, liq); glowAt(g, P, 0, 26, 22, 0.35 + spin * 0.3, P.glow); g.globalCompositeOperation = 'source-over';
    for (i = 0; i < 3; i++) {   // 小さな火（光なので縁取らない）：外は色、芯は白
      var fk = Math.sin(t * (9 + spin * 8) + i * 2) * 1.5, fh = 18 - spin * 6 - (i === 1 ? 3 : 0) + Math.sin(t * 13 + i) * 1.2;
      var fg = g.createLinearGradient(0, 30, 0, fh); fg.addColorStop(0, alpha(P.glow, 0.9)); fg.addColorStop(1, alpha(P.glow, 0));
      g.fillStyle = fg; g.beginPath(); g.moveTo(-8.5 + i * 5, 30); g.quadraticCurveTo(-5 + i * 5 + fk, fh, -1.5 + i * 5, 30); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.moveTo(-6.6 + i * 5, 30); g.quadraticCurveTo(-5 + i * 5 + fk * 0.6, fh + 6, -3.4 + i * 5, 30); g.closePath(); g.fill();
    }
    solid(g, function () { rr(g, -22, 30, 44, 6, 3); }, P.metal, P.metalShade, P.ink, 0.8, 1.1);   // 台
    [-17, 17].forEach(function (dx) { solid(g, function () { rr(g, dx - 2, 30, 4, 12, 1.5); }, P.metal, P.metalShade, P.ink, 0.5, 1); });
    solid(g, function () { g.beginPath(); g.moveTo(-20, 14); g.lineTo(20, 14); g.lineTo(16, 18); g.lineTo(-16, 18); g.closePath(); }, P.metal, P.metalShade, P.ink, 0.5, 1);   // 受け皿
    var body = function () { g.beginPath(); g.moveTo(-6, -40); g.lineTo(-6, -24); g.bezierCurveTo(-28, -20, -30, 14, 0, 15); g.bezierCurveTo(30, 14, 28, -20, 6, -24); g.lineTo(6, -40); g.closePath(); };
    var gg = g.createRadialGradient(-6, -8, 2, 0, -2, 30); gg.addColorStop(0, alpha(mix(liq, '#ffffff', 0.7), 0.22)); gg.addColorStop(1, alpha(P.uiInk, 0.06));
    body(); g.fillStyle = gg; g.fill();   // ガラス（中の光が映る）
    g.save(); body(); g.clip();
    var lv = -6 - spin * 2, wv = function (xx) { return lv + Math.sin(xx * 0.25 + t * (3 + spin * 8)) * (1 + spin * 2.5); }, xx;
    g.beginPath(); g.moveTo(-32, 20); for (xx = -32; xx <= 32; xx += 2) g.lineTo(xx, wv(xx)); g.lineTo(32, 20); g.closePath();
    var lg = g.createLinearGradient(0, lv - 4, 0, 16); lg.addColorStop(0, alpha(mix(liq, '#ffffff', 0.35), 0.85)); lg.addColorStop(0.5, alpha(liq, 0.72)); lg.addColorStop(1, alpha(mix(liq, '#000000', 0.35), 0.85)); g.fillStyle = lg; g.fill();   // 光の液
    g.globalCompositeOperation = 'lighter'; glowAt(g, P, Math.sin(t * 1.3) * 4, 4, 16 + spin * 6, 0.35 + spin * 0.35, mix(liq, '#ffffff', 0.4)); g.globalCompositeOperation = 'source-over';
    g.fillStyle = alpha(mix(liq, '#000000', 0.5), 0.35); g.beginPath(); g.moveTo(10, 15); g.bezierCurveTo(28, 10, 30, -14, 16, -20); g.bezierCurveTo(24, -6, 22, 8, 8, 15); g.closePath(); g.fill();   // 右の奥の影
    g.beginPath(); for (xx = -32; xx <= 32; xx += 2) g.lineTo(xx, wv(xx)); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.2; g.stroke();
    for (i = 0; i < 6 + spin * 8; i++) { var k = (t * (0.6 + spin * 1.6) + i * 0.29) % 1; g.strokeStyle = 'rgba(255,255,255,' + (0.7 * (1 - k)) + ')'; g.lineWidth = 0.9; ell(g, -14 + ((i * 11) % 28), 12 - k * (18 + spin * 4), 1.2 + k, 1.2 + k); g.stroke(); }   // 泡
    for (i = 0; i < 3; i++) { var a2 = t * (0.8 + spin * 3) + i * 2.1; mote(g, P, Math.cos(a2) * 10, 2 + Math.sin(a2) * 5, t, 0.4, i); }   // 中の結晶
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2.2; g.beginPath(); g.arc(0, -4, 18, Math.PI * 1.08, Math.PI * 1.38); g.stroke();   // ガラスの光
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, -4, 15.5, Math.PI * 0.72, Math.PI * 0.9); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-3.6, -38); g.lineTo(-3.6, -27); g.stroke();   // 首の光
    g.fillStyle = 'rgba(255,255,255,.8)'; ell(g, 10, -12, 1.7, 1.7); g.fill(); twinkle(g, -11, -10, 2.6 + Math.sin(t * 2.5) * 1, 0.7);
    g.strokeStyle = alpha(mix(liq, '#ffffff', 0.5), 0.55); g.lineWidth = 3; body(); g.stroke();   // ふちに液の色が映る
    g.strokeStyle = P.ink; g.lineWidth = 1.5; body(); g.stroke();
    solid(g, function () { rr(g, -8, -46, 16, 7, 2); }, P.terrainShade, P.terrainDeep, P.ink, 0.6, 1);   // 栓
    if (spin > 0.2) for (i = 0; i < 3; i++) { var sk = (t * (0.5 + spin) + i / 3) % 1; g.fillStyle = alpha(P.uiInk, 0.3 * spin * (1 - sk)); ell(g, Math.sin(sk * 6 + i) * 4, -50 - sk * 30, 3 + sk * 6, 3 + sk * 6); g.fill(); }   // 湯気
    g.restore();
  }
  // 出た水晶のまわりの光（レア度の色。光なので縁取らない）。k は 0→1 で広がる
  // 細くとがった光の筋が長短交互にゆっくり回り、まわりに光の輪と粒。重ねがけ（lighter）で明るくする
  function gemBurst(g, P, star, x, y, t, k) {
    var tone = gemTone(P, star), light = mix(tone[0], '#ffffff', 0.5), n = 8 + star * 4, i, R = 30 + star * 7;
    g.save(); g.globalCompositeOperation = 'lighter';
    var gl = g.createRadialGradient(x, y, 1, x, y, R * (0.7 + k * 0.6)); gl.addColorStop(0, alpha(light, 0.6 * k)); gl.addColorStop(0.35, alpha(tone[0], 0.25 * k)); gl.addColorStop(1, alpha(tone[0], 0));
    g.fillStyle = gl; ell(g, x, y, R * 1.4, R * 1.4); g.fill();
    for (i = 0; i < n; i++) {
      var a = t * (i % 2 ? 0.35 : -0.22) + i / n * Math.PI * 2, L = R * (i % 2 ? 0.75 : 1.25) * (0.4 + k * 0.6) * (0.85 + 0.15 * Math.sin(t * 3 + i * 1.7)), wd = (i % 2 ? 0.05 : 0.075);
      var rg = g.createRadialGradient(x, y, 0, x, y, L); rg.addColorStop(0, alpha(light, 0.55 * k)); rg.addColorStop(0.4, alpha(tone[0], 0.3 * k)); rg.addColorStop(1, alpha(tone[0], 0));
      g.fillStyle = rg; g.beginPath(); g.moveTo(x, y); g.arc(x, y, L, a - wd, a + wd); g.closePath(); g.fill();
    }
    g.strokeStyle = alpha(light, 0.35 * k * (1 - k * 0.5)); g.lineWidth = 0.8; ell(g, x, y, R * (0.35 + k * 0.3), R * (0.35 + k * 0.3)); g.stroke();
    for (i = 0; i < 4 * star; i++) { var b = t * (0.6 + (i % 3) * 0.25) + i * 2.3, rr3 = 12 + ((i * 7) % 18) + Math.sin(t * 2 + i) * 2, tw = 0.5 + 0.5 * Math.sin(t * 5 + i * 1.3); g.fillStyle = alpha('#ffffff', tw * 0.9 * k); ell(g, x + Math.cos(b) * rr3, y + Math.sin(b) * rr3 * 0.8, 0.5 + tw * 0.9, 0.5 + tw * 0.9); g.fill(); }
    g.restore();
  }

  /* ---------- 見本ページ用：4ゾーンを横に並べて動かす ---------- */
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var loops = [];
  function canvas(w, h, zoom, label) {
    var c = document.createElement('canvas'); c.width = Math.round(w * zoom * dpr); c.height = Math.round(h * zoom * dpr);
    c.style.width = '100%'; c.style.maxWidth = (w * zoom) + 'px'; c.style.height = 'auto'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', label || '');
    var g = c.getContext('2d'); return { c: c, g: g, k: zoom * dpr, w: w, h: h };
  }
  function animate(fn) {
    loops.push(fn);
    if (loops.length === 1) {
      var t0 = performance.now();
      var tick = function (now) { var t = Math.max(0, now - t0) / 1000 + 0.6; for (var i = 0; i < loops.length; i++) loops[i](t); if (!reduce) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }
  }
  // root に4ゾーンぶんの絵を並べる。draw(g, P, t) は各ゾーンの色 P で描く
  function zoneRow(root, opt) {
    root.classList.add('kabe-row');
    ZONES.forEach(function (z) {
      var fig = document.createElement('figure'); fig.className = 'kabe-fig';
      var cv = canvas(opt.w, opt.h, opt.zoom || 2, (opt.label || '') + '（' + z.name + '）');
      var cap = document.createElement('figcaption'); cap.textContent = z.name;
      fig.appendChild(cv.c); fig.appendChild(cap); root.appendChild(fig);
      animate(function (t) { var P = pal(z.id), g = cv.g; g.setTransform(cv.k, 0, 0, cv.k, 0, 0); g.clearRect(0, 0, opt.w, opt.h); if (opt.bg !== false) background(g, P, 0, 0, opt.w, opt.h, t, t * 8); opt.draw(g, P, t); });
    });
  }
  // キャラ候補1案ぶん：拡大の5ポーズ＋4ゾーンで実寸
  function ghostSheet(root, variant) {
    root.classList.add('kabe-sheet');
    var top = canvas(430, 112, 2, GHOSTS[variant].name + 'の5つのポーズ');
    var cap = document.createElement('div'); cap.className = 'kabe-cap'; cap.textContent = '左から：立ち（大きく）／壁に張り付き／ジャンプ／2段ジャンプ／ダメージ';
    root.appendChild(top.c); root.appendChild(cap);
    animate(function (t) {
      var P = pal(ZONES[0].id), g = top.g; g.setTransform(top.k, 0, 0, top.k, 0, 0); g.clearRect(0, 0, 430, 112);
      g.fillStyle = P.uiPanel; rr(g, 0, 0, 430, 112, 10); g.fill();
      g.fillStyle = alpha(P.uiInk, 0.06); rr(g, 6, 6, 118, 100, 8); g.fill();
      g.fillStyle = P.terrain; rr(g, 136, 22, 12, 70, [0, 5, 5, 0]); g.fill(); g.fillStyle = P.terrainLight; g.fillRect(136, 22, 12, 3);
      var xs = [66, 171, 238, 306, 376], ys = [62, 56, 50, 52, 56], sc = [3.3, 2, 2, 2, 2];
      for (var i = POSE_ORDER.length - 1; i >= 0; i--) ghost(g, P, variant, POSE_ORDER[i], xs[i], ys[i], t, 1, sc[i]);
    });
    var row = document.createElement('div'); root.appendChild(row);
    var cap2 = document.createElement('div'); cap2.className = 'kabe-cap'; cap2.textContent = '4ゾーンで実寸（左の壁に張り付き、右へジャンプ）'; root.appendChild(cap2);
    var G = grid(['##......', '##......', '##..##..', '##......', '##.....^', '##......'], '#');
    zoneRow(row, { w: 8 * CELL, h: 6 * CELL, zoom: 2, label: GHOSTS[variant].name, draw: function (g, P, t) {
      terrain(g, P, G, t);
      ghost(g, P, variant, 'cling', 2 * CELL + 11, 4.5 * CELL, t, 1, 1);
      ghost(g, P, variant, 'jump', 5.2 * CELL, 1.6 * CELL + Math.sin(t * 2) * 3, t, 1, 1);
    } });
  }

  return {
    CELL: CELL, ZONES: ZONES, MOTIF: MOTIF, POSES: POSES, POSE_ORDER: POSE_ORDER, POSE_MORE: POSE_MORE, GHOSTS: GHOSTS,
    sheetPath: sheetPath,
    pal: pal, mix: mix, alpha: alpha, hash: hash, STAGES: STAGES, stagePal: stagePal, blendPal: blendPal, motifOf: motifOf,
    rr: rr, ell: ell, solid: solid, shine: shine, spline: spline,
    grid: grid, background: background, bgStrata: bgStrata, bgFar: bgFar, bgDust: bgDust, block: block, slope: slope, lip: lip, hang: hang, decor: decor, spike: spike, terrain: terrain,
    slide: slide, cycleState: cycleState, popState: popState, popSpike: popSpike, ironBox: ironBox, track: track,
    spinAngle: spinAngle, spinner: spinner, pendAngle: pendAngle, pendulum: pendulum, cannon: cannon, cannonBall: cannonBall, stakeState: stakeState, stake: stake,
    bridgeState: bridgeState, bridge: bridge, spring: spring, crumble: crumble, shutterState: shutterState, shutter: shutter, fan: fan, fanStreaks: fanStreaks, fanBody: fanBody, fanBlade: fanBlade, fanBolt: fanBolt, FAN_BAND: FAN_BAND,
    rise: rise, riseCrusts: riseCrusts, riseCrust: riseCrust, ghost: ghost, scarfTail: scarfTail, scarfWrap: scarfWrap, lineEyes: lineEyes,
    effects: effects, heart: heart, hud: hud,
    GEM_KINDS: GEM_KINDS, GEM_ORDER: GEM_ORDER, gemTone: gemTone, mote: mote, gem: gem, gemBadge: gemBadge, gachaHouse: gachaHouse, gachaFlask: gachaFlask, gemBurst: gemBurst, twinkle: twinkle,
    canvas: canvas, animate: animate, zoneRow: zoneRow, ghostSheet: ghostSheet
  };
})();
