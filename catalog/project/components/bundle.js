/* おばけじゃんぴんぐ 素材ライブラリ（window.Kabe）
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
      { name: '草の崖', amb: 1.22, bloom: 0.35, lightK: 0.45, weather: { wind: 0.35, petals: 1 } },
      { name: '風の岩場', amb: 1.22, bloom: 0.35, lightK: 0.45, weather: { wind: 1, sand: 1 }, motif: { decor: 'sprout', hangRate: 0.25 },
        col: { bgTop: '#a3cfe0', bgBottom: '#e3efe8', far: '#b4cfc0', strataA: '#c8e0da', strataB: '#d2e7df', terrain: '#cdb596', terrainLight: '#ecdcc0', terrainShade: '#a99274',
          terrainDeep: '#ae9779', terrainLine: '#bba283', terrainGrain: '#ddcbb0', accent: '#9cc46e', accentShade: '#7aa352' } },
      { name: '古い水路', amb: 1.2, bloom: 0.35, lightK: 0.5, weather: { wind: 0.3 }, motif: { hangRate: 0.55 },
        col: { bgTop: '#86c4e4', bgBottom: '#d3ecef', far: '#9fcfc4', strataA: '#b8dde0', strataB: '#c3e4e4', terrain: '#c9b9a0', terrainLight: '#e8dcc6', terrainShade: '#a8987f',
          terrainDeep: '#a99a84', terrainLine: '#b8a88f', terrainGrain: '#dbcdb6', accent: '#6fc79a', accentShade: '#4fa67a' } },
      { name: '夕焼けの峰', amb: 1.18, bloom: 0.4, lightK: 0.5, weather: { wind: 0.2, motes: 1 }, motif: { decor: 'sprout', hangRate: 0.3 },
        col: { bgTop: '#f0b48c', bgBottom: '#fbe3c2', far: '#e6b9a0', strataA: '#f3cfb4', strataB: '#f6d8bf', terrain: '#d9ad86', terrainLight: '#f4d8b4', terrainShade: '#b78a66',
          terrainDeep: '#ba9170', terrainLine: '#c89e78', terrainGrain: '#e8c49e', accent: '#a8c86a', accentShade: '#86a64e', glow: '#ffe08a' } }
    ],
    // 上空（800〜1200m）：だんだん雲が厚く、暗くなって嵐へ。雨は雨のパーツだけで降る
    sky: [
      { name: '雲の入り口', amb: 1.2, bloom: 0.4, lightK: 0.45, weather: { wind: 0.3 } },
      { name: '風の回廊', amb: 1.15, bloom: 0.4, lightK: 0.45, weather: { wind: 0.8 },
        col: { bgTop: '#5f8fd6', bgBottom: '#bcd6fb', far: '#d8e6fd' } },
      { name: '雷の通り道', amb: 1.0, bloom: 0.45, lightK: 0.55, weather: { wind: 0.4 },
        col: { bgTop: '#4a5f8f', bgBottom: '#98abd0', far: '#c2cde6', strataA: '#8fa5cc', strataB: '#9db1d6' } },
      { name: '嵐の前', amb: 0.92, bloom: 0.45, lightK: 0.6, weather: { wind: 0.6 },
        col: { bgTop: '#3d4a74', bgBottom: '#7f8fb8', far: '#a8b4d4', strataA: '#7a8db6', strataB: '#8798c0' } }
    ],
    // 宇宙（1200〜1600m）：上へ行くほど暗く、星が多く。地形は星くずのふちとクレーター
    space: [
      { name: '大気のはて', amb: 1.0, bloom: 0.6, lightK: 0.7,
        col: { bgTop: '#151a4c', bgBottom: '#34448a', far: '#4a5aa0', strataA: '#26306e', strataB: '#2c3878', terrain: '#9690c0', terrainLight: '#c6c0ea', terrainShade: '#7068a0',
          terrainDeep: '#746ca2', terrainLine: '#837bb2', terrainGrain: '#aba4d2', accent: '#9fe8ff', accentShade: '#6ab8d8', glow: '#cfe6ff' } },
      { name: '月の岩場', amb: 0.98, bloom: 0.6, lightK: 0.75,
        col: { bgTop: '#100e2c', bgBottom: '#272452', far: '#3a3670', strataA: '#1b1840', strataB: '#211d4a', terrain: '#a19eb6', terrainLight: '#d0cede', terrainShade: '#7c7894',
          terrainDeep: '#7d7a94', terrainLine: '#8c88a4', terrainGrain: '#b6b3c8', accent: '#d8d4f0', accentShade: '#a9a4c8', glow: '#f2eccb' } },
      { name: '衛星の輪', amb: 0.96, bloom: 0.65, lightK: 0.75 },
      { name: '星の海', amb: 0.94, bloom: 0.75, lightK: 0.8,
        col: { bgTop: '#07051a', bgBottom: '#170f38', far: '#2a1d5a', strataA: '#100a2a', strataB: '#140d32', glow: '#e3d6ff', accent: '#ffd9f4', accentShade: '#d6a8cc' } }
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
    P.weather = st.weather || {};
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
    P.weather = {}; ['wind', 'petals', 'sand', 'rain', 'motes'].forEach(function (w) { var a = (A.weather || {})[w] || 0, b = (B.weather || {})[w] || 0; if (a || b) P.weather[w] = a + (b - a) * t; });
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
  /* ---------- 奥の縦穴の壁（帯より手前・地形より奥、スクロールの 0.7）と、昔の人が残した物 ----------
     左右のはしのシルエットだけ。平らな色2つ（haze＝奥の色、hazeLit＝灯りや水の少し明るい色）で、縁取りも細かい形も入れない。
     s は奥の層の座標（画面の y ＋ スクロール×0.7）。物は MID_SLOT ごとに1つまで、段ごとに決まった種類から選ぶ */
  var MID_SLOT = 260, MID_K = 0.7;
  var MID_KINDS = {
    underground: [['crystals', 'column', 'rope'], ['beam', 'cart', 'ladder', 'rope'], ['gear', 'girder', 'pipes', 'sign', 'lamp'], ['ladder', 'sign', 'rope', 'crystals']],
    surface: [['ruins', 'steps', 'flag'], ['windmill', 'vane', 'arch'], ['aqueduct', 'wheel', 'ruins'], ['tower', 'cairn', 'flag']],
    space: [['dish', 'girder', 'lamp'], ['flag', 'dish', 'crystals'], ['satellite', 'girder', 'pipes'], ['satellite', 'dish', 'tower']]
  };
  function midHaze(P) { return mixHex(mixHex(P.far, P.strataB, 0.5), P.terrainDeep, 0.26); }   // 背景より少し明るく、地形よりずっと暗い
  function midLit(P) { return mixHex(midHaze(P), P.glow, 0.4); }
  function midWall(s, side) { var p = side ? 2.1 : 0.4; return 40 + 18 * (0.5 + 0.5 * Math.sin(s * 0.011 + p)) + 9 * Math.sin(s * 0.029 + p * 3) + 4 * Math.sin(s * 0.083 + p * 5); }   // 手前の壁（2マス）から少しのぞく
  // s0〜s1 にかかる物の一覧（x、s、種類、左右、大きさ）
  function midProps(P, w, s0, s1) {
    var list = MID_KINDS[P.id] ? MID_KINDS[P.id][Math.max(0, Math.min(3, Math.round(P.stage || 0)))] : null, out = [];
    if (!list) return out;
    for (var i = Math.floor(s0 / MID_SLOT) - 1; i * MID_SLOT < s1 + MID_SLOT; i++) {
      if (hash(i, 71) < 0.3) continue;
      var right = hash(i, 72) < 0.5, kind = list[Math.floor(hash(i, 74) * list.length)], sc = 0.8 + hash(i, 75) * 0.45;
      out.push({ i: i, kind: kind, right: right, x: right ? w - 64 - hash(i, 73) * 50 : 64 + hash(i, 73) * 50, s: i * MID_SLOT + 40 + hash(i, 76) * (MID_SLOT - 80), sc: sc });
    }
    return out;
  }
  // 回る物（風車・水車）の中心と羽の数：本編は羽だけ毎フレーム描く
  function midSpins(P, w, s0, s1) {
    return midProps(P, w, s0, s1).filter(function (o) { return o.kind === 'windmill' || o.kind === 'wheel'; }).map(function (o) {
      return o.kind === 'windmill' ? { x: o.x, s: o.s - 46 * o.sc, r: 24 * o.sc, n: 4, speed: 0.9 + hash(o.i, 77), w: 3.2 * o.sc } : { x: o.x + (o.right ? 6 : -6) * o.sc, s: o.s - 14 * o.sc, r: 17 * o.sc, n: 8, speed: 0.6, w: 1.6 * o.sc, rim: true };
    });
  }
  function midBlades(g, P, sp, oy, t) {
    var c = midHaze(P); g.strokeStyle = c; g.lineCap = 'round';
    sp.forEach(function (o) {
      var a0 = t * o.speed; g.lineWidth = o.w;
      for (var k = 0; k < o.n; k++) { var a = a0 + k * Math.PI * 2 / o.n; g.beginPath(); g.moveTo(o.x, oy + o.s); g.lineTo(o.x + Math.cos(a) * o.r, oy + o.s + Math.sin(a) * o.r); g.stroke(); }
      if (o.rim) { g.lineWidth = 2; g.beginPath(); g.arc(o.x, oy + o.s, o.r, 0, Math.PI * 2); g.stroke(); }
    });
  }
  function midProp(g, P, o, y) {
    var H = midHaze(P), L = midLit(P), k = o.sc, d = o.right ? -1 : 1, x = o.x, i;   // d：壁から離れる向き
    g.fillStyle = H; g.strokeStyle = H; g.lineCap = 'round'; g.lineJoin = 'round';
    var R = function (x0, y0, w0, h0) { g.fillRect(x0, y0, w0, h0); };
    switch (o.kind) {
      case 'crystals': for (i = 0; i < 3; i++) { var cx = x + (i - 1) * 7 * k, ch = (18 + i % 2 * 12) * k, cw = 4 * k; g.beginPath(); g.moveTo(cx - cw, y); g.lineTo(cx - cw, y - ch); g.lineTo(cx, y - ch - 6 * k); g.lineTo(cx + cw, y - ch); g.lineTo(cx + cw, y); g.closePath(); g.fill(); } break;
      case 'column': g.beginPath(); g.moveTo(x - 9 * k, y - 90 * k); g.quadraticCurveTo(x - 1.5 * k, y - 45 * k, x - 9 * k, y); g.lineTo(x + 9 * k, y); g.quadraticCurveTo(x + 1.5 * k, y - 45 * k, x + 9 * k, y - 90 * k); g.closePath(); g.fill(); break;
      case 'rope': g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y - 110 * k); g.quadraticCurveTo(x + d * 4, y - 50 * k, x + d * 1, y); g.stroke(); g.beginPath(); g.arc(x + d, y, 2.4 * k, 0, Math.PI * 2); g.fill(); break;
      case 'ladder': g.lineWidth = 1.8; for (i = -1; i <= 1; i += 2) { g.beginPath(); g.moveTo(x + i * 6 * k, y - 120 * k); g.lineTo(x + i * 6 * k, y); g.stroke(); } g.lineWidth = 1.4; for (i = 0; i < 11; i++) { if (hash(o.i, 80 + i) < 0.15) continue; var ry = y - 6 * k - i * 10.5 * k; g.beginPath(); g.moveTo(x - 6 * k, ry); g.lineTo(x + 6 * k, ry); g.stroke(); } break;
      case 'beam': R(x - 16 * k, y - 50 * k, 4 * k, 50 * k); R(x + 12 * k, y - 50 * k, 4 * k, 50 * k); R(x - 20 * k, y - 54 * k, 40 * k, 5 * k); g.lineWidth = 1; g.beginPath(); g.moveTo(x, y - 49 * k); g.lineTo(x, y - 40 * k); g.stroke(); g.fillStyle = L; g.beginPath(); g.arc(x, y - 37 * k, 3 * k, 0, Math.PI * 2); g.fill(); break;
      case 'cart': R(x - 22 * k, y - 1.5 * k, 44 * k, 2 * k); g.beginPath(); g.moveTo(x - 13 * k, y - 18 * k); g.lineTo(x + 13 * k, y - 18 * k); g.lineTo(x + 10 * k, y - 5 * k); g.lineTo(x - 10 * k, y - 5 * k); g.closePath(); g.fill(); [-6, 6].forEach(function (wx) { g.beginPath(); g.arc(x + wx * k, y - 4 * k, 3.4 * k, 0, Math.PI * 2); g.fill(); }); break;
      case 'gear': g.save(); g.translate(x, y - 24 * k); g.rotate(hash(o.i, 81) * 3); g.beginPath(); for (i = 0; i < 20; i++) { var ga = i / 20 * Math.PI * 2, gr = (i % 2 ? 19 : 23) * k; g.lineTo(Math.cos(ga) * gr, Math.sin(ga) * gr); } g.closePath(); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(0, 0, 6 * k, 0, Math.PI * 2); g.fill(); g.restore(); break;
      case 'girder': g.lineWidth = 2.2; g.beginPath(); g.moveTo(x - 7 * k, y); g.lineTo(x - 7 * k, y - 120 * k); g.moveTo(x + 7 * k, y); g.lineTo(x + 7 * k, y - 120 * k); for (i = 0; i < 6; i++) { g.moveTo(x - 7 * k, y - i * 20 * k); g.lineTo(x + 7 * k, y - (i + 1) * 20 * k); } g.stroke(); break;
      case 'pipes': R(x - 4 * k, y - 130 * k, 8 * k, 130 * k); R(x - 6 * k, y - 70 * k, 12 * k, 5 * k); g.lineWidth = 1.6; g.beginPath(); g.arc(x + d * 12 * k, y - 68 * k, 6 * k, 0, Math.PI * 2); g.moveTo(x + d * 12 * k - 6 * k, y - 68 * k); g.lineTo(x + d * 12 * k + 6 * k, y - 68 * k); g.moveTo(x + d * 12 * k, y - 74 * k); g.lineTo(x + d * 12 * k, y - 62 * k); g.moveTo(x, y - 68 * k); g.lineTo(x + d * 6 * k, y - 68 * k); g.stroke(); break;
      case 'sign': R(x - 1.5 * k, y - 34 * k, 3 * k, 34 * k); R(x - 13 * k, y - 46 * k, 26 * k, 16 * k); g.fillStyle = L; g.beginPath(); g.moveTo(x, y - 44 * k); g.lineTo(x + 6 * k, y - 38 * k); g.lineTo(x + 2.2 * k, y - 38 * k); g.lineTo(x + 2.2 * k, y - 32 * k); g.lineTo(x - 2.2 * k, y - 32 * k); g.lineTo(x - 2.2 * k, y - 38 * k); g.lineTo(x - 6 * k, y - 38 * k); g.closePath(); g.fill(); break;   // ↑ 地上はこっち
      case 'lamp': R(x - d * 2 * k - (d < 0 ? 12 * k : 0) + (d < 0 ? 2 * k : 0), y - 40 * k, 12 * k, 2.4 * k); g.lineWidth = 1; g.beginPath(); g.moveTo(x + d * 8 * k, y - 38 * k); g.lineTo(x + d * 8 * k, y - 32 * k); g.stroke(); g.fillStyle = L; g.beginPath(); g.arc(x + d * 8 * k, y - 28 * k, 3.6 * k, 0, Math.PI * 2); g.fill(); break;
      case 'ruins': R(x - 16 * k, y - 46 * k, 8 * k, 46 * k); R(x + 6 * k, y - 30 * k, 8 * k, 30 * k); g.beginPath(); g.moveTo(x - 19 * k, y - 46 * k); g.lineTo(x + 2 * k, y - 50 * k); g.lineTo(x + 5 * k, y - 44 * k); g.lineTo(x - 19 * k, y - 42 * k); g.closePath(); g.fill(); R(x + 4 * k, y - 34 * k, 12 * k, 4 * k); break;
      case 'steps': for (i = 0; i < 5; i++) R(x - d * (12 - i * 6) * k - 6 * k, y - (i + 1) * 6 * k, 12 * k + (4 - i) * 6 * k, 6 * k); break;
      case 'flag': g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 52 * k); g.stroke(); g.fillStyle = L; g.beginPath(); g.moveTo(x, y - 51 * k); g.lineTo(x + d * 18 * k, y - 46 * k); g.lineTo(x + d * 14 * k, y - 43 * k); g.lineTo(x + d * 17 * k, y - 39 * k); g.lineTo(x, y - 38 * k); g.closePath(); g.fill(); break;
      case 'windmill': g.beginPath(); g.moveTo(x - 9 * k, y); g.lineTo(x - 4 * k, y - 46 * k); g.lineTo(x + 4 * k, y - 46 * k); g.lineTo(x + 9 * k, y); g.closePath(); g.fill(); g.beginPath(); g.moveTo(x - 6 * k, y - 46 * k); g.lineTo(x, y - 54 * k); g.lineTo(x + 6 * k, y - 46 * k); g.closePath(); g.fill(); break;
      case 'vane': g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 40 * k); g.moveTo(x - 10 * k, y - 40 * k); g.lineTo(x + 10 * k, y - 40 * k); g.stroke(); g.beginPath(); g.moveTo(x + 13 * k, y - 40 * k); g.lineTo(x + 8 * k, y - 43.5 * k); g.lineTo(x + 8 * k, y - 36.5 * k); g.closePath(); g.fill(); break;
      case 'arch': g.beginPath(); g.moveTo(x - 24 * k, y); g.lineTo(x - 22 * k, y - 40 * k); g.quadraticCurveTo(x, y - 58 * k, x + 22 * k, y - 40 * k); g.lineTo(x + 24 * k, y); g.lineTo(x + 12 * k, y); g.quadraticCurveTo(x + 10 * k, y - 34 * k, x, y - 36 * k); g.quadraticCurveTo(x - 10 * k, y - 34 * k, x - 12 * k, y); g.closePath(); g.fill(); break;
      case 'aqueduct': R(x - 30 * k, y - 46 * k, 60 * k, 8 * k); for (i = -1; i <= 1; i++) { var axx = x + i * 20 * k; g.beginPath(); g.moveTo(axx - 10 * k, y - 38 * k); g.lineTo(axx - 10 * k, y); g.lineTo(axx - 6 * k, y); g.quadraticCurveTo(axx - 6 * k, y - 24 * k, axx, y - 26 * k); g.quadraticCurveTo(axx + 6 * k, y - 24 * k, axx + 6 * k, y); g.lineTo(axx + 10 * k, y); g.lineTo(axx + 10 * k, y - 38 * k); g.closePath(); g.fill(); }
        g.fillStyle = L; R(x + d * 30 * k - (d < 0 ? 3 * k : 0), y - 40 * k, 3 * k, 52 * k); break;   // こわれた端から落ちる水
      case 'wheel': R(x - 2 * k, y - 16 * k, 4 * k, 16 * k); break;
      case 'tower': R(x - 7 * k, y - 80 * k, 14 * k, 80 * k); g.beginPath(); g.moveTo(x - 10 * k, y - 80 * k); g.lineTo(x, y - 94 * k); g.lineTo(x + 10 * k, y - 80 * k); g.closePath(); g.fill(); g.fillStyle = L; g.beginPath(); g.arc(x, y - 70 * k, 3.4 * k, Math.PI, 0); g.lineTo(x + 3.4 * k, y - 66 * k); g.lineTo(x - 3.4 * k, y - 66 * k); g.closePath(); g.fill(); break;
      case 'dish': R(x - 2 * k, y - 34 * k, 4 * k, 34 * k); R(x - 9 * k, y - 4 * k, 18 * k, 4 * k); g.save(); g.translate(x, y - 40 * k); g.rotate(d * -0.5); g.beginPath(); g.ellipse(0, 0, 16 * k, 7 * k, 0, 0, Math.PI); g.closePath(); g.fill();
        g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -12 * k); g.stroke(); g.fillStyle = L; g.beginPath(); g.arc(0, -13 * k, 2.2 * k, 0, Math.PI * 2); g.fill(); g.restore(); break;   // パラボラアンテナ
      case 'satellite': { var sy = y - 70 * k - hash(o.i, 83) * 30 * k; R(x - 7 * k, sy - 6 * k, 14 * k, 12 * k); R(x - 34 * k, sy - 4 * k, 22 * k, 8 * k); R(x + 12 * k, sy - 4 * k, 22 * k, 8 * k);
        g.lineWidth = 1; g.beginPath(); g.moveTo(x - 12 * k, sy); g.lineTo(x - 7 * k, sy); g.moveTo(x + 7 * k, sy); g.lineTo(x + 12 * k, sy); g.moveTo(x, sy - 6 * k); g.lineTo(x + d * 4 * k, sy - 14 * k); g.stroke();
        g.fillStyle = L; g.beginPath(); g.arc(x + d * 4 * k, sy - 15 * k, 1.8 * k, 0, Math.PI * 2); g.fill(); break; }   // 古い人工衛星（宙に浮いている）
      case 'cairn': for (i = 0; i < 4; i++) { var cw2 = (11 - i * 2.4) * k; g.beginPath(); g.ellipse(x + (hash(o.i, 90 + i) - 0.5) * 3, y - 4 * k - i * 7.4 * k, cw2, 4 * k, 0, 0, Math.PI * 2); g.fill(); } break;
    }
  }
  function bgMid(g, P, x, w, s0, s1, oy, t) {
    var H = midHaze(P), j, side;
    g.fillStyle = H;
    for (side = 0; side < 2; side++) {   // 左右の奥の壁
      g.beginPath(); g.moveTo(side ? x + w : x, oy + s0 - 20);
      for (j = Math.floor((s0 - 20) / 12) * 12; j <= s1 + 24; j += 12) { var ww = midWall(j, side); g.lineTo(side ? x + w - ww : x + ww, oy + j); }
      g.lineTo(side ? x + w : x, oy + s1 + 24); g.closePath(); g.fill();
    }
    midProps(P, w, s0, s1).forEach(function (o) { var wx = midWall(o.s, o.right ? 1 : 0); o.x = o.right ? Math.min(o.x, x + w - wx - 4) : Math.max(o.x, x + wx + 4); midProp(g, P, o, oy + o.s); });
    if (t != null) midBlades(g, P, midSpins(P, w, s0, s1), oy, t);
  }
  function background(g, P, x, y, w, h, t, scroll) {
    scroll = scroll || 0;
    var gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, P.bgTop); gr.addColorStop(1, P.bgBottom);
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    var m = motifOf(P), off = scroll * 0.5;
    bgStrata(g, P, x, w, off, off + h, y - off);
    bgFar(g, P, x, y, w, h);
    var mo = scroll * MID_K; bgMid(g, P, x, w, mo, mo + h, y - mo, t);
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
    var m = motifOf(P), base = d === 0 ? P.terrain : d === 1 ? mix(P.terrain, P.terrainDeep, 0.55) : P.terrainDeep, i, n;
    g.save(); rr(g, x - o0, y - o2, CELL + o0 + o1, CELL + o2 + o3, rad);
    g.fillStyle = base; g.fill(); g.clip();
    // 色むら：マスごとに少しだけ明るさを変え、大きなまだらを重ねる
    var mv = hash(c, r, 50) - 0.5; g.fillStyle = mv > 0 ? 'rgba(255,255,255,' + (mv * 0.09) + ')' : 'rgba(0,0,0,' + (-mv * 0.08) + ')'; g.fillRect(x - 1, y - 1, CELL + 2, CELL + 2);
    if (hash(c >> 1, r >> 1, 51) > 0.6) { g.fillStyle = alpha(P.terrainDeep, 0.18); ell(g, x + hash(c, r, 52) * CELL, y + hash(c, r, 53) * CELL, 7, 5); g.fill(); }
    // 大きな岩：マスをまたいで続く（世界の座標で決める）。影の三日月・本体・上のふちの光
    var BS = 54, gx = Math.floor(x / BS), gy = Math.floor(y / BS), ix, iy;
    for (ix = gx - 1; ix <= gx + 1; ix++) for (iy = gy - 1; iy <= gy + 1; iy++) {
      if (hash(ix, iy, 120) < 0.4) continue;
      var bx2 = ix * BS + hash(ix, iy, 121) * BS, by2 = iy * BS + hash(ix, iy, 122) * BS, rx = 9 + hash(ix, iy, 123) * 13, ry = rx * (0.55 + hash(ix, iy, 124) * 0.3);
      if (bx2 + rx + 2 < x || bx2 - rx > x + CELL || by2 + ry + 3 < y || by2 - ry > y + CELL) continue;
      g.fillStyle = 'rgba(0,0,0,.11)'; ell(g, bx2 + 1.4, by2 + 2.2, rx, ry); g.fill();
      g.fillStyle = 'rgba(255,255,255,.09)'; ell(g, bx2, by2, rx, ry); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1; g.beginPath(); g.ellipse(bx2, by2, rx - 1, ry - 1, 0, Math.PI * 1.05, Math.PI * 1.7); g.stroke();
    }
    // 地層の線：となりのマスとつながる、ゆるい波
    var ly = y + 5 + ((r * 7) % 9), wv = function (xx) { return ly + Math.sin((xx + r * 13) * 0.16) * 1.3; };
    g.strokeStyle = d ? 'rgba(0,0,0,.08)' : P.terrainLine; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x - 1, wv(x - 1)); g.quadraticCurveTo(x + CELL / 2, wv(x + CELL / 2) + 0.6, x + CELL + 1, wv(x + CELL + 1)); g.stroke();
    g.strokeStyle = d ? 'rgba(255,255,255,.04)' : alpha(P.terrainGrain, 0.6); g.lineWidth = 0.7; g.beginPath(); g.moveTo(x - 1, wv(x - 1) + 1.4); g.lineTo(x + CELL + 1, wv(x + CELL + 1) + 1.4); g.stroke();
    // 細かい粒（明るいのと暗いの）
    for (i = 0; i < 6; i++) { var px = x + 1 + hash(c, r, 60 + i) * 16, py = y + 1 + hash(c, r, 70 + i) * 16, pr = 0.45 + hash(c, r, 80 + i) * 0.55;
      g.fillStyle = i % 2 ? alpha(P.terrainShade, d ? 0.25 : 0.55) : alpha(P.terrainGrain, d ? 0.15 : 0.7); ell(g, px, py, pr, pr); g.fill(); }
    // 埋まった石
    if (hash(c, r, 1) > 0.55) grain(g, P, m.grain, x + 4 + hash(c, r, 2) * 10, y + 6 + hash(c, r, 3) * 8, 1.6 + hash(c, r, 4) * 1.4, d > 0);
    if (!d && hash(c, r, 90) > 0.86) {
      var sx = x + 5 + hash(c, r, 91) * 8, sy = y + 7 + hash(c, r, 92) * 6, sr = 2.4 + hash(c, r, 93) * 1.6;
      g.fillStyle = P.terrainShade; ell(g, sx + 0.6, sy + 0.8, sr, sr * 0.8); g.fill();
      g.fillStyle = P.terrainGrain; ell(g, sx, sy, sr, sr * 0.78); g.fill();
      g.fillStyle = 'rgba(255,255,255,.45)'; ell(g, sx - sr * 0.35, sy - sr * 0.3, sr * 0.35, sr * 0.22); g.fill();
    }
    // ひび（外に出ている面のそばにときどき）
    if (!d && (e.l || e.r || e.b) && hash(c, r, 95) > 0.8) {
      var cx = e.l ? x + 1 : e.r ? x + CELL - 1 : x + 4 + hash(c, r, 96) * 10, cy = e.b ? y + CELL - 1 : y + 5 + hash(c, r, 97) * 8, dx = e.l ? 1 : e.r ? -1 : 0, dy = e.b ? -1 : 0;
      g.strokeStyle = alpha(P.terrainShade, 0.9); g.lineWidth = 0.8; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, cy);
      g.lineTo(cx + dx * 3 + (dy ? 1.5 : 0), cy + dy * 3 + (dx ? 1.5 : 0)); g.lineTo(cx + dx * 5 - (dy ? 1 : 0), cy + dy * 5 + (dx ? 3.5 : 0)); g.stroke();
    }
    // 外に出た面：上は光と縁、下は影、左は光、右は影（幅を持たせてやわらかく）
    if (e.t) {
      g.fillStyle = P.terrainLight; g.fillRect(x - 1, y, CELL + 2, 4);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x - 1, y, CELL + 2, 1.2);
      g.fillStyle = alpha(P.terrainShade, 0.35); for (i = 0; i < 3; i++) { var bx = x + 1 + hash(c, r, 100 + i) * 15; ell(g, bx, y + 4.4, 1.6, 0.8); g.fill(); }
    }
    if (e.b) {
      g.fillStyle = P.terrainShade; g.fillRect(x - 1, y + CELL - 3, CELL + 2, 3);
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x - 1, y + CELL - 5, CELL + 2, 2);
    }
    if (e.l) { var gl = g.createLinearGradient(x, 0, x + 4, 0); gl.addColorStop(0, 'rgba(255,255,255,.22)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.fillRect(x, y, 4, CELL); }
    if (e.r) { var gr = g.createLinearGradient(x + CELL - 5, 0, x + CELL, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.16)'); g.fillStyle = gr; g.fillRect(x + CELL - 5, y, 5, CELL); }
    g.restore();
    // 外に出た面のふちに、うすい濃い線（形がしまって見える）
    g.strokeStyle = alpha(mixHex(P.terrainShade, '#000000', 0.35), 0.45); g.lineWidth = 0.8; g.beginPath();
    if (e.l) { g.moveTo(x + 0.4, y + (e.t ? k : 0)); g.lineTo(x + 0.4, y + CELL - (e.b ? k : 0)); }
    if (e.r) { g.moveTo(x + CELL - 0.4, y + (e.t ? k : 0)); g.lineTo(x + CELL - 0.4, y + CELL - (e.b ? k : 0)); }
    if (e.b) { g.moveTo(x + (e.l ? k : 0), y + CELL - 0.4); g.lineTo(x + CELL - (e.r ? k : 0), y + CELL - 0.4); }
    g.stroke();
  }
  // 上の面の葉（苔・草）：根元 (x, y)、高さ h、傾き lean。奥の暗い葉 → 手前の明るい葉の順
  var LIVE = { grass: false };
  function grassBlades(P, c, r, x, y) {
    var m = motifOf(P), grass = m.lip === 'grass', nb = grass ? 7 : 5, out = [];
    if (m.lip !== 'moss' && !grass) return out;
    for (var i = 0; i < nb; i++) if (hash(c, r, 20 + i) > (grass ? 0.25 : 0.45))
      out.push({ x: x + 1 + i * (CELL / nb) + hash(c, r, 30 + i) * 2, y: y - 0.5, h: (grass ? 3.5 : 2.5) + hash(c, r, 40 + i) * (grass ? 3.5 : 2.5), lean: (hash(c, r, 45 + i) - 0.5) * 3, col: i % 2 ? P.accentShade : P.accent, lw: i % 2 ? 1.2 : 1 });
    return out;
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
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x - 0.5, y - 1, CELL + 1, 0.7);   // 縁の光
    if (m.lip === 'moss' || m.lip === 'grass') {
      if (!LIVE.grass) {   // 本編は葉を風で揺らすので、地形の絵には入れず毎フレーム描く（grassBlades）
        g.lineCap = 'round';
        grassBlades(P, c, r, x, y).forEach(function (b) {
          g.strokeStyle = b.col; g.lineWidth = b.lw;
          g.beginPath(); g.moveTo(b.x, b.y); g.quadraticCurveTo(b.x + b.lean * 0.3, b.y - b.h * 0.6, b.x + b.lean, b.y - b.h); g.stroke();
        });
      }
      if (hash(c, r, 48) > 0.85) { g.fillStyle = P.terrainGrain; ell(g, x + 4 + hash(c, r, 49) * 10, y - 1.2, 1.6, 1.1); g.fill(); g.fillStyle = P.terrainShade; ell(g, x + 4.4 + hash(c, r, 49) * 10, y - 0.6, 1.2, 0.5); g.fill(); }   // 小石
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
    g.save(); tri(); g.clip();
    for (var i = 0; i < 4; i++) { var px = x + 2 + hash(x, y, 60 + i) * 14, py = y + 2 + hash(x, y, 70 + i) * 14; g.fillStyle = i % 2 ? alpha(P.terrainShade, 0.5) : alpha(P.terrainGrain, 0.7); ell(g, px, py, 0.6, 0.6); g.fill(); }
    g.restore();
    if (up) { g.strokeStyle = P.accent; g.lineWidth = 1.8; g.lineCap = 'round'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(a[2], a[3]); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(a[0], a[1] - 1); g.lineTo(a[2], a[3] - 1); g.stroke(); }
    else { g.strokeStyle = alpha(mixHex(P.terrainShade, '#000000', 0.35), 0.45); g.lineWidth = 0.8; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(a[2], a[3]); g.stroke(); }
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
    g.strokeStyle = alpha(P.hazardShade, 0.9); g.lineWidth = 0.6; g.beginPath(); g.moveTo(3.4, ty + 4.6); g.lineTo(12.5, ty + 4.1); g.stroke();   // 稜線
    g.fillStyle = 'rgba(255,255,255,.85)'; ell(g, 12.6, ty + 3.7, 0.7, 0.5); g.fill();   // 先の光
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
  function backOut(k) { k = Math.min(1, Math.max(0, k)); var c = 2.2; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); }   // 少し行きすぎて戻る
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
  // 鉄：面取りの光（左上）と影（右下）、細いヘアラインの模様を重ねる
  var hairCache = {};
  function hairline(g, P) {
    var key = P.metalLight + P.metalShade; if (hairCache[key]) return hairCache[key];
    var c = document.createElement('canvas'); c.width = 24; c.height = 24; var q = c.getContext('2d');
    q.strokeStyle = alpha(P.metalLight, 0.22); q.lineWidth = 0.6;
    for (var i = -24; i < 48; i += 3.4) { q.beginPath(); q.moveTo(i, 0); q.lineTo(i + 10, 24); q.stroke(); }
    q.strokeStyle = alpha(P.metalShade, 0.25); for (var j = -22; j < 48; j += 7.3) { q.beginPath(); q.moveTo(j, 0); q.lineTo(j + 10, 24); q.stroke(); }
    return (hairCache[key] = g.createPattern(c, 'repeat'));
  }
  function metalSolid(g, P, path, off) {
    solid(g, path, P.metal, P.metalShade, P.ink, off == null ? 1.1 : off, 1.0);
    g.save(); path(); g.clip();
    var pat = hairline(g, P); if (pat) { g.fillStyle = pat; g.fillRect(-400, -400, 800, 800); }
    g.lineJoin = 'round';
    g.translate(0.9, 0.9); path(); g.strokeStyle = alpha(P.metalLight, 0.75); g.lineWidth = 1.3; g.stroke();
    g.translate(-1.8, -1.8); path(); g.strokeStyle = alpha(mixHex(P.metalShade, '#000000', 0.25), 0.6); g.lineWidth = 1.3; g.stroke();
    g.restore();
  }
  function bolt(g, P, x, y, r) { g.fillStyle = mix(P.metalShade, '#000000', 0.3); ell(g, x + 0.35, y + 0.4, r, r); g.fill(); g.fillStyle = P.metalLight; ell(g, x, y, r * 0.75, r * 0.75); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; ell(g, x - r * 0.25, y - r * 0.25, r * 0.28, r * 0.28); g.fill(); }
  function blade(g, P, path) {
    solid(g, path, P.hazard, P.hazardShade, P.ink, 0.8, 0.85);
    g.save(); path(); g.clip(); g.translate(0.7, 0.7); path(); g.strokeStyle = alpha(P.hazardLight, 0.8); g.lineWidth = 1; g.stroke(); g.restore();   // 刃のふちの光
  }

  // 出入りトゲ：引っ込む → 予告（先が少しのぞき、すき間が点滅）→ 出る。痛いのは hurt のときだけ
  function popState(t, o) {
    o = o || {}; var st = cycleState(t, [['in', o.in || 1.4], ['warn', o.warn || 0.6], ['out', o.out || 1.2]], o.offset), a = 0;
    if (st.s === 'warn') a = 0.3 + Math.sin(st.e * 40) * 0.04;
    if (st.s === 'out') a = backOut(st.e / 0.16) * Math.min(1, (st.d - st.e) / 0.18);   // 勢いよく出て、少し行きすぎて戻る
    st.amount = a; st.hurt = st.s === 'out' && a > 0.5; return st;
  }
  // (x, y) はトゲのマスの左上。dir は spike と同じ（生える壁の側）
  function popSpike(g, P, x, y, dir, t, o, stOver) {   // stOver：状態を渡す（本編は出る量を段階に分けて絵を使い回す）
    var st = stOver || popState(t, o);
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
    g.strokeStyle = alpha(P.metalShade, 0.9); g.lineWidth = 0.8; rr(g, x + 3, y + 3, w - 6, h - 6, 1.5); g.stroke();   // 補強の板
    g.strokeStyle = alpha(P.metalLight, 0.5); g.beginPath(); g.moveTo(x + 3.5, y + h - 3.5); g.lineTo(x + w - 3.5, y + 3.5); g.stroke();
    shine(g, x + 4.5, y + 3.5, 2.6, 1.3, 0.35);
    [[3.4, 3.4], [w - 3.4, 3.4], [3.4, h - 3.4], [w - 3.4, h - 3.4]].forEach(function (b) { bolt(g, P, x + b[0], y + b[1], 1.2); });
  }
  /* ---------- 上空の仕掛け ---------- */
  // 雲の足場（下からすり抜けて、上に乗れる。痛くないので縁取らない）。x〜x+w、y は上の面
  function cloudPlat(g, P, x, y, w, t) {
    var n = Math.max(2, Math.round(w / 9)), i, bx, r;
    g.fillStyle = 'rgba(205,216,236,0.95)';
    for (i = 0; i < n; i++) { bx = x + (i + 0.5) * w / n; r = 5.5 + hash(i, w, 3) * 2.5; ell(g, bx, y + 6.5, r + 1, r * 0.75); g.fill(); }   // 下の影
    g.fillStyle = '#f4f7ff';
    for (i = 0; i < n; i++) { bx = x + (i + 0.5) * w / n; r = 5 + hash(i, w, 2) * 3 + Math.sin((t || 0) * 1.5 + i) * 0.4; ell(g, bx, y + 4, r + 1.5, r * 0.8); g.fill(); }
    g.fillStyle = '#ffffff'; g.fillRect(x + 2, y, w - 4, 3);   // 乗る面
    g.fillStyle = 'rgba(255,255,255,0.8)'; for (i = 0; i < n; i += 2) { ell(g, x + (i + 0.4) * w / n, y + 2, 2.4, 1.2); g.fill(); }
  }
  // ただよう機雷：トゲのついた金属の玉
  function mine(g, P, x, y, r) {
    r = r || 8; var i, a;
    blade(g, P, function () { g.beginPath(); for (i = 0; i < 16; i++) { a = i / 16 * Math.PI * 2; var rr2 = i % 2 ? r - 0.3 : r + r * 0.32; g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } g.closePath(); });   // トゲは鈍角（先の角度 100 度くらい）
    metalSolid(g, P, function () { ell(g, x, y, r, r); }, 1.3);
    shine(g, x - r * 0.35, y - r * 0.4, r * 0.32, r * 0.18, 0.5);
    g.strokeStyle = alpha(P.metalShade, 0.9); g.lineWidth = 0.8; g.beginPath(); g.arc(x, y, r * 0.55, 0.3, 2.6); g.stroke();
  }
  // 曲がるトゲブロック：四つの面ぜんぶにトゲ（縦長・横長）
  function spikeBlock(g, P, x, y, w, h) {
    [[0, h, -Math.PI / 2, h], [w, 0, Math.PI / 2, h], [0, 0, 0, w], [w, h, Math.PI, w]].forEach(function (sd) { g.save(); g.translate(x + sd[0], y + sd[1]); g.rotate(sd[2]); teethRow(g, P, sd[3]); g.restore(); });
    metalSolid(g, P, function () { rr(g, x, y, w, h, 3); }, 1.6);
    g.strokeStyle = alpha(P.metalShade, 0.9); g.lineWidth = 0.8; rr(g, x + 3, y + 3, w - 6, h - 6, 1.5); g.stroke();
    shine(g, x + 4.5, y + 3.5, 2.6, 1.3, 0.35);
    [[3.4, 3.4], [w - 3.4, 3.4], [3.4, h - 3.4], [w - 3.4, h - 3.4]].forEach(function (b) { bolt(g, P, x + b[0], y + b[1], 1.2); });
  }
  // 曲がるトゲブロックの道すじ（点の並び）
  function railPath(g, P, pts) {
    g.strokeStyle = alpha(P.metalShade, 0.75); g.lineWidth = 2; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
    pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.stroke();
    pts.forEach(function (p, i) { solid(g, function () { ell(g, p[0], p[1], i === 0 || i === pts.length - 1 ? 2.6 : 2, i === 0 || i === pts.length - 1 ? 2.6 : 2); }, P.metalShade, mix(P.metalShade, '#000000', 0.3), null, 0.5); });
  }
  // 風車：短い羽が3枚（羽の間をくぐれる）。a は回った角度
  function windmill(g, P, x, y, len, a, n) {   // n：羽の枚数（本編は3）
    n = n || 3;
    for (var i = 0; i < n; i++) {
      var aa = a + i * Math.PI * 2 / n, c = Math.cos(aa), sn = Math.sin(aa), T = function (u, v) { return [x + u * c - v * sn, y + u * sn + v * c]; };
      var pts = [[4, -2], [len - 5, -4.2], [len, 0], [len - 5, 4.2], [4, 2]].map(function (p) { return T(p[0], p[1]); });
      blade(g, P, function () { g.beginPath(); pts.forEach(function (p, j) { if (j) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); });
    }
    metalSolid(g, P, function () { ell(g, x, y, 5.5, 5.5); }, 1.1);
    bolt(g, P, x - 0.4, y - 0.4, 1.8);
  }
  // 避雷針（雷の柱の両はし）。dir 1＝下向き（上の針）、-1＝上向き（下の針）。lit：光っている
  function lightningRod(g, P, x, y, dir, lit) {
    metalSolid(g, P, function () { rr(g, x - 6, y - 3.5, 12, 7, 2); }, 1.1);
    solid(g, function () { g.beginPath(); g.moveTo(x - 2.2, y + 3 * dir); g.lineTo(x, y + 10 * dir); g.lineTo(x + 2.2, y + 3 * dir); g.closePath(); }, P.metal, P.metalShade, P.ink, 0.6, 1);
    if (lit) { g.fillStyle = 'rgba(255,255,255,0.9)'; ell(g, x, y + 10 * dir, 2.4, 2.4); g.fill(); }
    bolt(g, P, x - 3.2, y, 1); bolt(g, P, x + 3.2, y, 1);
  }
  // 雷の装置（1マスの硬いブロック。乗れる・張り付ける）。dir：雷が出る向き（up down left right）。lit：光っている
  function electrode(g, P, cx, cy, dir, lit) {
    var a = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[dir] || 0, h = 9;
    metalSolid(g, P, function () { rr(g, cx - h, cy - h, h * 2, h * 2, 3); }, 1.4);
    g.strokeStyle = alpha(P.metalShade, 0.9); g.lineWidth = 1;   // コイルの筋
    for (var i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(cx - h + 3, cy + i * 4.5); g.lineTo(cx + h - 3, cy + i * 4.5); g.stroke(); }
    g.save(); g.translate(cx, cy); g.rotate(a);   // 雷の出る先（とがった金具）
    solid(g, function () { g.beginPath(); g.moveTo(h - 1, -3.2); g.lineTo(h + 4, 0); g.lineTo(h - 1, 3.2); g.closePath(); }, P.metal, P.metalShade, P.ink, 0.6, 1);
    if (lit) { g.fillStyle = 'rgba(255,255,255,0.95)'; ell(g, h + 4, 0, 2.6, 2.6); g.fill(); g.fillStyle = 'rgba(220,235,255,0.45)'; ell(g, h + 4, 0, 6, 6); g.fill(); }
    g.restore();
    shine(g, cx - h + 3.5, cy - h + 3, 2.4, 1.2, 0.35);
    bolt(g, P, cx - h + 3, cy + h - 3, 1); bolt(g, P, cx + h - 3, cy + h - 3, 1);
  }
  // ぽよんブロック（1マス）：乗る・張り付くと、ぷるぷるしてから横へはじく。k：-1.5〜1（正＝ぷるぷる、負＝へこむ）。痛くないのでトゲなし、縁取りあり
  function jellyBlock(g, P, x, y, k) {
    k = k || 0; var cx = x + 9, cy = y + 9, sx = 1 + (k < 0 ? -k * 0.12 : k * 0.06), sy = 1 + (k < 0 ? k * 0.14 : -k * 0.05), wob = k > 0 ? k * 1.2 : 0;
    var base = '#cdbdf6', shade = '#a995e2', light = '#f1ebff';   // 淡い紫
    g.save(); g.translate(cx + wob, cy); g.scale(sx, sy);
    solid(g, function () { rr(g, -9, -9, 18, 18, 6); }, base, shade, P.ink, 1.4, 1.1);
    g.fillStyle = alpha(light, 0.8); ell(g, -3.5, -4.5, 3.6, 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)'; ell(g, -4.5, -5, 1.3, 0.8); g.fill();
    g.strokeStyle = alpha(shade, 0.9); g.lineWidth = 1.1; g.beginPath(); g.moveTo(-4, 3); g.quadraticCurveTo(0, 6, 4, 3); g.stroke();   // ぷにっとした線
    g.restore();
  }
  /* ---------- 宇宙の仕掛け ---------- */
  // 届く範囲の点線の輪（引力の星・とげ星・回る衛星の通り道）
  function dashRing(g, x, y, r, col, a, dash) {
    g.save(); g.strokeStyle = alpha(col, a); g.lineWidth = 1.1; g.setLineDash(dash || [2, 5]); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); g.restore();
  }
  // 引力の星（1マスの硬いブロック。乗れる・張り付ける）：金属の枠の中に光る星。R：引く範囲（うすい点線）
  function gravStar(g, P, cx, cy, R) {
    if (R) { dashRing(g, cx, cy, R, P.glow, 0.28, [2, 6]); dashRing(g, cx, cy, R * 0.55, P.glow, 0.18, [2, 6]); }
    metalSolid(g, P, function () { rr(g, cx - 9, cy - 9, 18, 18, 5); }, 1.2);
    g.fillStyle = alpha(P.glow, 0.35); ell(g, cx, cy, 7, 7); g.fill();
    g.fillStyle = '#fffaf0'; g.beginPath();
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2.2 : 5.4; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    g.closePath(); g.fill(); g.strokeStyle = alpha(P.glow, 0.9); g.lineWidth = 0.8; g.stroke();
    shine(g, cx - 5, cy - 5.5, 2.2, 1.1, 0.35);
  }
  // とげ星（痛い。まわりを引っぱる）：トゲの金属の星。R：引く範囲
  function spikeStar(g, P, cx, cy, R, a) {
    if (R) dashRing(g, cx, cy, R, P.hazardLight, 0.3, [3, 4]);
    a = a || 0; var i;
    blade(g, P, function () { g.beginPath(); for (i = 0; i < 16; i++) { var aa = a + i * Math.PI / 8, rr2 = i % 2 ? 6.8 : 9.6; g.lineTo(cx + Math.cos(aa) * rr2, cy + Math.sin(aa) * rr2); } g.closePath(); });
    metalSolid(g, P, function () { ell(g, cx, cy, 6.5, 6.5); }, 1.1);
    g.strokeStyle = alpha(P.metalShade, 0.9); g.lineWidth = 0.8; g.beginPath(); g.arc(cx, cy, 3.4, 0.4, 2.7); g.stroke();
    shine(g, cx - 2.4, cy - 2.6, 1.8, 1, 0.5);
  }
  // 回る衛星の真ん中（痛くない小さな核とアンテナ）と通り道。R：輪の半径
  function satellite(g, P, cx, cy, R) {
    if (R) dashRing(g, cx, cy, R, P.metalLight, 0.35, [1.5, 4.5]);
    g.strokeStyle = P.metalShade; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx, cy - 5); g.lineTo(cx + 3, cy - 10); g.stroke();
    g.fillStyle = P.glow; ell(g, cx + 3, cy - 10.5, 1.4, 1.4); g.fill();
    solid(g, function () { rr(g, cx - 12, cy - 2.5, 7, 5, 1); }, '#7f9fd6', '#5d7bb2', P.ink, 0.8, 0.8);   // 太陽の板（青）
    solid(g, function () { rr(g, cx + 5, cy - 2.5, 7, 5, 1); }, '#7f9fd6', '#5d7bb2', P.ink, 0.8, 0.8);
    metalSolid(g, P, function () { ell(g, cx, cy, 5, 5); }, 1);
    bolt(g, P, cx - 0.4, cy - 0.4, 1.4);
  }
  // 浮き岩（乗れる・張り付ける足場）。x〜x+w、y は上の面、高さ1マス
  function floatRock(g, P, x, y, w, t) {
    var i, n = Math.max(1, Math.round(w / 18));
    g.fillStyle = alpha(P.glow, 0.18 + 0.06 * Math.sin((t || 0) * 3)); ell(g, x + w / 2, y + 23, w * 0.42, 3.2); g.fill();   // 下のかすかな光（浮いている）
    solid(g, function () { g.beginPath(); g.moveTo(x + 2, y); g.lineTo(x + w - 2, y); g.quadraticCurveTo(x + w, y, x + w, y + 3); g.lineTo(x + w - 1, y + 12);
      g.quadraticCurveTo(x + w * 0.5, y + 21, x + 1, y + 12); g.lineTo(x, y + 3); g.quadraticCurveTo(x, y, x + 2, y); g.closePath(); }, P.terrain, P.terrainShade, P.ink, 1.6, 1.1);
    g.fillStyle = P.terrainLight; g.fillRect(x + 2, y + 0.6, w - 4, 2.2);
    for (i = 0; i < n; i++) { var cx = x + (i + 0.5) * w / n + (hash(i, w, 5) - 0.5) * 5, cy = y + 7 + hash(i, w, 6) * 4, cr = 1.6 + hash(i, w, 7) * 1.6;
      g.fillStyle = alpha(P.terrainShade, 0.9); ell(g, cx, cy, cr, cr * 0.7); g.fill(); g.fillStyle = alpha(P.terrainLight, 0.7); ell(g, cx + 0.5, cy + 0.6, cr * 0.6, cr * 0.35); g.fill(); }   // クレーター
  }
  // 衝撃波の装置（1マスの硬いブロック）。k：0〜1 の予告の明るさ
  function pulseEmitter(g, P, cx, cy, k) {
    k = k || 0;
    metalSolid(g, P, function () { rr(g, cx - 9, cy - 9, 18, 18, 3); }, 1.3);
    g.fillStyle = mix(P.metalShade, '#000000', 0.35); ell(g, cx, cy, 5.6, 5.6); g.fill();
    g.fillStyle = mix(P.metalLight, '#ffffff', k); ell(g, cx, cy, 3.6, 3.6); g.fill();
    if (k > 0) { g.fillStyle = 'rgba(255,255,255,' + (0.35 * k) + ')'; ell(g, cx, cy, 7.5, 7.5); g.fill(); }
    g.strokeStyle = alpha(P.metalLight, 0.8); g.lineWidth = 0.8; ell(g, cx, cy, 7, 7); g.stroke();
    bolt(g, P, cx - 6, cy - 6, 0.9); bolt(g, P, cx + 6, cy - 6, 0.9); bolt(g, P, cx - 6, cy + 6, 0.9); bolt(g, P, cx + 6, cy + 6, 0.9);
  }
  // 熱くなる壁の板（1マス）。k：0〜1 の熱さ（1＝熱い）。赤は使わず、灰色の金属がこはく色〜白に光る
  function heatPanel(g, P, x, y, k) {
    k = k || 0;
    var base = mixHex(P.metal, '#ffc46b', k * 0.75), shade = mixHex(P.metalShade, '#e89a3c', k * 0.6);
    solid(g, function () { rr(g, x + 0.5, y + 0.5, 17, 17, 2); }, base, shade, P.ink, 1, 0.9);
    g.strokeStyle = mixHex(P.metalShade, '#fff1c8', k); g.lineWidth = 1.4; g.lineCap = 'round';
    for (var i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x + 4, y + 4.5 + i * 4.5); g.lineTo(x + 14, y + 4.5 + i * 4.5); g.stroke(); }   // 放熱のすじ
    if (k >= 1) { g.fillStyle = 'rgba(255,248,225,0.55)'; g.fillRect(x + 1.5, y + 1.5, 15, 15); }
    bolt(g, P, x + 2.6, y + 2.6, 0.8); bolt(g, P, x + 15.4, y + 15.4, 0.8);
  }
  // センサー機雷：アンテナのついたトゲの玉。st：'idle' 'arm'（点滅中・lit で光る）'off'（戻る途中・うすい）
  function senseMine(g, P, cx, cy, st, lit) {
    if (st === 'off') { g.globalAlpha *= 0.3; }
    var i, a;
    blade(g, P, function () { g.beginPath(); for (i = 0; i < 12; i++) { a = i / 12 * Math.PI * 2; var rr2 = i % 2 ? 7.2 : 10.2; g.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); } g.closePath(); });
    metalSolid(g, P, function () { ell(g, cx, cy, 7.5, 7.5); }, 1.2);
    g.fillStyle = mix(P.metalShade, '#000000', 0.4); ell(g, cx, cy, 3.6, 3.6); g.fill();   // センサーの目
    g.fillStyle = st === 'arm' ? (lit ? '#ffffff' : '#ffd27a') : st === 'off' ? P.metalShade : '#9ff0d8'; ell(g, cx, cy, 2.3, 2.3); g.fill();
    if (st === 'arm' && lit) { g.fillStyle = 'rgba(255,240,200,0.45)'; ell(g, cx, cy, 6, 6); g.fill(); }
    shine(g, cx - 3, cy - 3.6, 1.8, 1, 0.45);
  }
  // 雷（白い光の折れ線）。k：0〜1 の強さ、seed で形が変わる
  function lightningBolt(g, x, y0, y1, k, seed) {
    var pts = [[x, y0]], n = Math.max(3, Math.round((y1 - y0) / 12)), i;
    for (i = 1; i < n; i++) pts.push([x + (hash(i, seed, 7) - 0.5) * 10, y0 + (y1 - y0) * i / n]);
    pts.push([x, y1]);
    var line = function (w, col) { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(function (p, j) { if (j) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.stroke(); };
    line(9, 'rgba(220,235,255,' + (0.25 * k) + ')'); line(4, 'rgba(235,245,255,' + (0.7 * k) + ')'); line(1.6, 'rgba(255,255,255,' + k + ')');
  }
  // 突風の口（壁につく金属の通気口）。warn：もうすぐ吹く（ふちが光る）
  function gustVent(g, P, x, y, dir, warn) {
    var w = 7, h = 26, x0 = dir > 0 ? x : x - w;
    metalSolid(g, P, function () { rr(g, x0, y - h / 2, w, h, 2); }, 1.2);
    g.strokeStyle = P.metalShade; g.lineWidth = 1.2;
    for (var i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(x0 + 1.5, y + i * 4.5); g.lineTo(x0 + w - 1.5, y + i * 4.5 + 1.5); g.stroke(); }
    if (warn) { g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.2; rr(g, x0 - 0.5, y - h / 2 - 0.5, w + 1, h + 1, 2.4); g.stroke(); }
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
  function shutter(g, P, x0, x1, y, t, o, stOver) {   // stOver：状態を渡す（本編は閉じる量を段階に分けて絵を使い回す）
    var st = stOver || shutterState(t, o), h = 9, len = ((x1 - x0) / 2 - 3) * st.close, lit = st.s === 'warn' && st.e % 0.3 < 0.15;
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
  // part：'mount'＝軸の金具だけ、'arm'＝鎖と鉄球だけ（本編は a＝0 で1回描いて GPU で回す）
  function pendulum(g, P, x, y, len, a, part) {
    var bx = x + Math.sin(a) * len, by = y + Math.cos(a) * len, n = Math.max(3, Math.round(len / 5.5)), i;
    if (part !== 'arm') metalSolid(g, P, function () { rr(g, x - 6, y - 5, 12, 7, 2.5); }, 0.8);   // 軸の金具
    if (part === 'mount') return;
    g.lineWidth = 1.3; g.strokeStyle = P.metalShade;
    for (i = 1; i < n; i++) { var k = i / n; g.save(); g.translate(x + (bx - x) * k, y + (by - y) * k); g.rotate(-a + (i % 2 ? Math.PI / 2 : 0)); ell(g, 0, 0, 1.5, 2.7); g.stroke(); g.restore(); }
    bolt(g, P, x, y - 1.5, 1.8);
    for (i = 0; i < 8; i++) { (function (an) { blade(g, P, function () { g.beginPath(); g.moveTo(bx + Math.cos(an - 0.32) * 8, by + Math.sin(an - 0.32) * 8); g.lineTo(bx + Math.cos(an) * 12.5, by + Math.sin(an) * 12.5); g.lineTo(bx + Math.cos(an + 0.32) * 8, by + Math.sin(an + 0.32) * 8); g.closePath(); }); })(i / 8 * Math.PI * 2 + a); }
    solid(g, function () { ell(g, bx, by, 9, 9); }, P.hazard, P.hazardShade, P.ink, 1.4, 1.1);
    shine(g, bx - 3, by - 3.2, 2.6, 1.5, 0.5);
  }
  // 筒：(x, y) は壁の面の真ん中、dir は撃つ向き（1＝右へ）。lit：撃つ前に口が光る
  function cannon(g, P, x, y, dir, lit, recoil) {
    g.save(); g.translate(x, y); g.scale(dir, 1);
    var rc = (recoil || 0) * 3.5;
    metalSolid(g, P, function () { g.beginPath(); g.arc(-4, 0, 9, -Math.PI / 2, Math.PI / 2); g.lineTo(-10, 9); g.lineTo(-10, -9); g.closePath(); }, 1);   // 壁にはまった台
    g.save(); g.translate(-rc, 0);   // 撃った反動で筒が下がる
    metalSolid(g, P, function () { rr(g, -2, -5.5, 10, 11, 2); }, 1);   // 筒
    metalSolid(g, P, function () { rr(g, 6, -7, 4, 14, 1.5); }, 0.6);   // 口の輪
    g.fillStyle = P.ink; ell(g, 9.6, 0, 1.4, 4.2); g.fill();
    g.restore();
    if (lit) { var gl = g.createRadialGradient(10, 0, 0, 10, 0, 10); gl.addColorStop(0, alpha(P.hazardLight, 0.75)); gl.addColorStop(1, alpha(P.hazardLight, 0)); g.fillStyle = gl; ell(g, 10, 0, 10, 10); g.fill(); }
    bolt(g, P, -6, -5, 1.3); bolt(g, P, -6, 5, 1.3);
    g.restore();
  }
  function cannonBall(g, P, x, y) { solid(g, function () { ell(g, x, y, 5.5, 5.5); }, P.hazard, P.hazardShade, P.ink, 1, 1); shine(g, x - 1.8, y - 2, 1.6, 1, 0.55); }
  // 杭：壁の面 (x0, y) から dir の向きへ、長さ len の amount（0〜1）だけ突き出る。lit：出る前の点滅
  function stakeState(t, o) {
    o = o || {}; var st = cycleState(t, [['in', o.in || 2.0], ['warn', o.warn || 0.7], ['out', o.out || 1.3]], o.offset), a = 0;
    if (st.s === 'warn') a = 0.08 + Math.sin(st.e * 30) * 0.03 + Math.max(0, st.e - st.d + 0.2) * -0.3;   // 出る直前に少し引いて溜める
    if (st.s === 'out') a = backOut(st.e / 0.22) * smooth((st.d - st.e) / 0.3);
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
    st.ang = a * Math.PI / 2; st.solid = a === 0; return st;   // 上がりきるとまっすぐ立つ（本編では壁の手前の面になる）   // 乗れるのは下りきっている間だけ（動いている板は本編で体を押す）
  }
  // part：'plank'＝回る板だけ、'base'＝蝶番の台とランプだけ（本編は板を ang＝0 で1回描いて GPU で回す）
  function bridge(g, P, x0, y, dir, len, ang, lit, part) {
    g.save(); g.translate(x0, y); g.scale(dir, 1);
    if (part === 'base') g.save(); else g.save(), g.rotate(-ang);
    if (part !== 'base') {
    metalSolid(g, P, function () { rr(g, 0, -4.5, len - 1, 9, [0, 3, 3, 0]); }, 1.2);
    g.strokeStyle = P.metalLight; g.lineWidth = 0.7; g.beginPath(); g.moveTo(2, -1.8); g.lineTo(len - 4, -1.8); g.stroke();
    for (var i = 8; i < len - 4; i += 12) bolt(g, P, i, 1.2, 1.1);
    }
    g.restore();
    if (part === 'plank') { g.restore(); return; }
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
  // 崩れる足場：1マスの石のブロック。地形と同じ土の色で、もとからうっすらひびがある。
  // k（0〜1）：崩れかけ（ひびが伸び、ゆれて少し沈む）。grow（0〜1）：戻るとき下から組み上がる。seed でひびの形を変える
  function crumbleCell(g, P, x, y, k, t, seed, grow) {
    k = k || 0; seed = seed || 0; grow = grow == null ? 1 : grow;
    var sh = k > 0 ? Math.sin(t * 55 + seed * 3) * (0.4 + k * 1.3) : 0, sag = k * k * 1.6, rot = k > 0 ? Math.sin(t * 38 + seed) * k * 0.05 : 0;
    g.save(); g.translate(x + CELL / 2 + sh, y + CELL / 2 + sag); g.rotate(rot);
    if (grow < 1) { var gs = 0.55 + 0.45 * smooth(grow); g.globalAlpha *= Math.min(1, grow * 1.6); g.translate(0, (1 - grow) * 6); g.scale(gs, gs); }
    var h = CELL / 2 - 0.6, path = function () { g.beginPath(); g.moveTo(-h + 1.5, -h); g.lineTo(h - 2.5, -h); g.lineTo(h, -h + 2.5); g.lineTo(h, h - 1.5); g.lineTo(h - 1.5, h); g.lineTo(-h + 2, h); g.lineTo(-h, h - 2); g.lineTo(-h, -h + 1.5); g.closePath(); };   // 角が少し欠けた四角
    solid(g, path, P.terrain, P.terrainShade, P.ink, 1.8, 1.05);
    g.fillStyle = P.terrainGrain; ell(g, -3 + hash(seed, 1) * 6, 2 + hash(seed, 2) * 3, 1.6, 1.2); g.fill();
    g.fillStyle = alpha(P.terrainLight, 0.9); g.fillRect(-h + 1.5, -h + 0.8, CELL - 5, 1.6);   // 上の面の明るい縁
    g.fillStyle = P.accent; g.fillRect(-h + 1, -h - 0.6, CELL - 4, 1.6);   // 上の苔
    // ひび：もとから短く入っていて、崩れかけると枝分かれしながら伸びる
    var L = 0.35 + k * 0.65, x0 = -2 + hash(seed, 3) * 4;
    g.strokeStyle = alpha(P.ink, 0.45 + k * 0.4); g.lineWidth = 0.8 + k * 0.5; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(x0, -h); g.lineTo(x0 + 2 * L, -h + 5 * L); g.lineTo(x0 - 1 * L, -h + 10 * L); g.lineTo(x0 + 2.5 * L, -h + 15 * L);
    if (k > 0.25) { g.moveTo(x0 + 2 * L, -h + 5 * L); g.lineTo(x0 + 7 * k, -h + 3 + 3 * k); }
    if (k > 0.55) { g.moveTo(x0 - 1 * L, -h + 10 * L); g.lineTo(x0 - 6 * k, -h + 9 + 4 * k); }
    g.stroke();
    g.restore();
  }
  function crumble(g, P, x, y, n, shake, t) { for (var i = 0; i < n; i++) crumbleCell(g, P, x + i * CELL, y, shake, t, i); }

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
      g.fillStyle = alpha(mixHex(P.rise, '#000000', 0.35), 0.6); ell(g, cx + cw * 0.3, cy + 3, cw * 0.35, 1.8); g.fill();
      if (bk < 0.92) { g.fillStyle = alpha(P.riseLight, 0.55); ell(g, cx, cy, br, br * 0.9); g.fill(); g.strokeStyle = P.riseTop; g.lineWidth = 0.9; ell(g, cx, cy, br, br * 0.9); g.stroke(); g.fillStyle = 'rgba(255,255,255,.6)'; ell(g, cx - br * 0.35, cy - br * 0.35, br * 0.22, br * 0.18); g.fill(); }
    }
    else if (m.rise === 'storm') { if ((t * 2 + i) % 3 < 0.15) { g.strokeStyle = P.riseTop; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx, cy - 6); g.lineTo(cx + 3, cy); g.lineTo(cx - 1, cy); g.lineTo(cx + 2, cy + 7); g.stroke(); } }
    else if (m.rise === 'void') {   // 虚空：吸いこまれていく小さな星（下へ細くのびて消える）
      var vk = (t * 0.5 + hash(i, 4)) % 1; g.strokeStyle = alpha(P.riseTop, 0.7 * (1 - vk)); g.lineWidth = 1; g.beginPath(); g.moveTo(cx, cy + vk * 14); g.lineTo(cx, cy + vk * 14 + 3 + vk * 8); g.stroke();
      g.fillStyle = alpha('#ffffff', 0.8 * (1 - vk)); ell(g, cx, cy + vk * 14, 1.2, 1.2); g.fill();
    }
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
  // マフラーの決まり（chara.html でいじって決める）。はじめの値がいまの見た目
  var SCARF_DEF = { wrapY: 0.8, wrapW: 21, wrapH: 3.6, sag: 2.2, wrapStripes: 5, stripeW: 0.9, knotX: -9.6, knotY: 0.9, knotR: 2.5,
    tailX: -8.5, tailY: 1.4, len: 0.62, tailW: 3.4, taper: 0.2, back: 0.75, notch: 1.6, stripes: 2, front: 0 };
  var SCARF = {}; for (var sk in SCARF_DEF) SCARF[sk] = SCARF_DEF[sk];
  // マフラーの色（着せ替え）。red は tokens.css の scarf のまま。ハートの赤は変えない
  var SCARF_COLORS = [
    { id: 'red', name: 'あか', star: 1 },
    { id: 'ao', name: 'あお', scarf: '#3f63c8', shade: '#2c4590', stripe: '#dfe8ff' , star: 1 },
    { id: 'midori', name: 'みどり', scarf: '#3a9d5d', shade: '#28703f', stripe: '#e2f7e6' , star: 1 },
    { id: 'karashi', name: 'からし', scarf: '#e3a52c', shade: '#ad7716', stripe: '#fff3d6' , star: 1 },
    { id: 'sakura', name: 'さくら', scarf: '#ef88ae', shade: '#c25f88', stripe: '#fff0f5' , star: 2 },
    { id: 'murasaki', name: 'むらさき', scarf: '#8a5cc9', shade: '#623d97', stripe: '#efe6ff' , star: 2 },
    { id: 'sumi', name: 'すみ', scarf: '#3b3b4a', shade: '#25252f', stripe: '#f0ece4' , star: 2 },
    { id: 'yuki', name: 'ゆき', scarf: '#f6f2ea', shade: '#cfc7ba', stripe: '#e5463f' , star: 3 }
  ];
  SCARF_DEF.color = 'red'; SCARF.color = 'red';
  var scarfPalCache = {};
  function scarfPal(P) {   // マフラーの色だけ差し替えた P（red ならそのまま）
    var c = null; for (var i = 0; i < SCARF_COLORS.length; i++) if (SCARF_COLORS[i].id === SCARF.color) c = SCARF_COLORS[i];
    if (!c || !c.scarf) return P;
    var key = (P.id || '') + '|' + c.id, Q = scarfPalCache[key];
    if (!Q || Q.base !== P) { Q = Object.create(P); Q.scarf = c.scarf; Q.scarfShade = c.shade; Q.scarfStripe = c.stripe; Q.base = P; scarfPalCache[key] = Q; }
    return Q;
  }
  // マフラーのはし：平たい布を2本（後ろの短い1本は影の色）。ポーズの点より短く縮めて描き、はしは内側へ切れ込む
  // ポーズの点の根元は [-4, -1]。SCARF.tailX/Y で根元ごとずらす
  function scarfTail(g, P, pts, t, w0) {
    var S = SCARF; w0 = w0 || S.tailW;
    var sx = S.tailX - pts[0][0], sy = S.tailY - pts[0][1];
    var o = [pts[0][0] + sx, pts[0][1] + sy], k = S.len;
    var front = pts.map(function (p, i) { return [o[0] + (p[0] + sx - o[0]) * k + Math.sin(t * 6 + i * 1.3) * 0.15 * i, o[1] + (p[1] + sy - o[1]) * k + Math.cos(t * 6 + i * 1.1) * 0.2 * i]; });
    var back = front.map(function (p, i) { var f = i / (front.length - 1); return [o[0] + (p[0] - o[0]) * S.back + f * 1.2, o[1] + (p[1] - o[1]) * S.back + f * 2.6]; });
    if (S.back > 0) ribbon(g, P, back, w0 * 0.85, P.scarfShade, mix(P.scarfShade, '#000000', 0.18), false);
    ribbon(g, P, front, w0, P.scarf, P.scarfShade, true);
  }
  function ribbon(g, P, pts, w0, base, shade, stripes) {
    var s = spline(pts, 5), L = [], R = [], n = s.length;
    for (var i = 0; i < n; i++) {
      var a = s[Math.max(0, i - 1)], b = s[Math.min(n - 1, i + 1)], nx = -(b[1] - a[1]), ny = b[0] - a[0], d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
      var w = w0 * (1 - SCARF.taper * i / n); L.push([s[i][0] + nx * w, s[i][1] + ny * w]); R.push([s[i][0] - nx * w, s[i][1] - ny * w]);
    }
    var e = s[n - 1], f = s[n - 2], dx = e[0] - f[0], dy = e[1] - f[1], dl = Math.hypot(dx, dy) || 1;
    var shape = function () {
      g.beginPath(); g.moveTo(L[0][0], L[0][1]); L.forEach(function (p) { g.lineTo(p[0], p[1]); });
      g.lineTo(e[0] - dx / dl * SCARF.notch, e[1] - dy / dl * SCARF.notch);   // はしの切れ込み（内側へ）
      for (var j = n - 1; j >= 0; j--) g.lineTo(R[j][0], R[j][1]); g.closePath();
    };
    solid(g, shape, base, shade, P.playerLine, stripes ? 1.1 : 0.6, 1.0);
    if (!stripes) return;
    g.strokeStyle = P.scarfStripe; g.lineWidth = 0.8;
    [0.62, 0.78].slice(0, SCARF.stripes).forEach(function (q) { var k2 = Math.round(q * (n - 1)); g.beginPath(); g.moveTo(L[k2][0], L[k2][1]); g.lineTo(R[k2][0], R[k2][1]); g.stroke(); });
  }
  // 首に巻いた帯：体を輪切りにした丸い筒に巻きつける（少し上から見た形）。
  // 前ほど下がり、両はしは体の線より少し外へふくらんで後ろへ回りこむ。縦じまは筒の丸みで、はしほど間がつまって細くなる
  function scarfWrap(g, P, cx, cy, w, h) {
    var S = SCARF; cy = cy == null ? S.wrapY : cy; w = w || S.wrapW; h = h || S.wrapH;
    var R = w / 2, sag = S.sag, N = 14, top = [], bot = [], i, th;
    var yc = function (t) { return cy + sag * Math.cos(t); };                       // 帯の真ん中の高さ（前ほど下）
    var hh = function (t) { return h / 2 * (0.82 + 0.18 * Math.cos(t)); };        // 前は少しふっくら、横はうすい
    for (i = 0; i <= N; i++) { th = -Math.PI / 2 + Math.PI * i / N; top.push([cx + R * Math.sin(th), yc(th) - hh(th)]); bot.push([cx + R * Math.sin(th), yc(th) + hh(th) + Math.sin(th * 7) * 0.12]); }
    var band = function () {
      g.beginPath(); g.moveTo(top[0][0], top[0][1]);
      for (var j = 1; j <= N; j++) g.lineTo(top[j][0], top[j][1]);
      g.quadraticCurveTo(cx + R + 1.3, cy, bot[N][0], bot[N][1]);                  // 右はし：後ろへ回りこむ丸み
      for (j = N - 1; j >= 0; j--) g.lineTo(bot[j][0], bot[j][1]);
      g.quadraticCurveTo(cx - R - 1.3, cy, top[0][0], top[0][1]); g.closePath();
    };
    solid(g, band, P.scarf, P.scarfShade, P.playerLine, 0.9, 1.0);
    g.save(); band(); g.clip();
    // 横へ回りこむほど暗く
    var gr = g.createLinearGradient(cx - R - 1.3, 0, cx + R + 1.3, 0);
    gr.addColorStop(0, alpha(P.scarfShade, 0.85)); gr.addColorStop(0.3, alpha(P.scarfShade, 0)); gr.addColorStop(0.7, alpha(P.scarfShade, 0)); gr.addColorStop(1, alpha(P.scarfShade, 0.95));
    g.fillStyle = gr; g.fillRect(cx - R - 2, cy - h - 2, w + 4, h * 2 + sag + 4);
    // 縦じま：角度で等しく並べる（はしほど間がつまる）
    var n = Math.round(S.wrapStripes);
    g.strokeStyle = P.scarfStripe; g.lineCap = 'butt';
    for (i = 0; i < n; i++) {
      th = -Math.PI / 2 + Math.PI * (i + 0.5) / n; var c = Math.cos(th), x = cx + R * Math.sin(th);
      g.globalAlpha = 0.55 + 0.45 * c; g.lineWidth = S.stripeW * (0.25 + 0.75 * c);
      g.beginPath(); g.moveTo(x, yc(th) - hh(th) - 0.5); g.lineTo(x, yc(th) + hh(th) + 0.5); g.stroke();
    }
    g.globalAlpha = 1;
    // 上のふちの光：前だけ細く光る（丸く見せる）
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.7; g.lineCap = 'round'; g.beginPath();
    for (i = 4; i <= N - 4; i++) { th = -Math.PI / 2 + Math.PI * i / N; var tx = cx + R * Math.sin(th), ty = yc(th) - hh(th) + 0.7; if (i === 4) g.moveTo(tx, ty); else g.lineTo(tx, ty); }
    g.stroke(); g.restore();
    // 結び目：帯の上にひと巻きかぶさる。ここにも縦じまを1本、しわを1本
    if (S.knotR > 0) {
      var kx = S.knotX, ky = cy + S.knotY, kr = S.knotR;
      var knot = function () { g.beginPath(); g.moveTo(kx - kr, ky - kr * 0.55); g.quadraticCurveTo(kx, ky - kr * 1.25, kx + kr, ky - kr * 0.6);
        g.quadraticCurveTo(kx + kr * 1.25, ky + kr * 0.2, kx + kr * 0.7, ky + kr * 0.95); g.quadraticCurveTo(kx - kr * 0.2, ky + kr * 1.2, kx - kr * 0.9, ky + kr * 0.7);
        g.quadraticCurveTo(kx - kr * 1.3, ky, kx - kr, ky - kr * 0.55); g.closePath(); };
      solid(g, knot, P.scarf, P.scarfShade, P.playerLine, 0.7, 1.0);
      g.save(); knot(); g.clip();
      if (n > 0) { g.strokeStyle = P.scarfStripe; g.lineWidth = S.stripeW * 0.8; g.beginPath(); g.moveTo(kx + kr * 0.15, ky - kr * 1.3); g.lineTo(kx - kr * 0.05, ky + kr * 1.3); g.stroke(); }
      g.restore();
      g.strokeStyle = P.scarfShade; g.lineWidth = 0.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(kx - kr * 0.55, ky + kr * 0.15); g.quadraticCurveTo(kx - kr * 0.1, ky + kr * 0.55, kx + kr * 0.5, ky + kr * 0.4); g.stroke();
    }
  }
  /* ---------- 着せ替え（OUTFIT）：着る（wear：首まわり）とかぶる（hat：頭） ----------
     着るものの色は SCARF.color（scarfPal で P.scarf・scarfShade に入る）。かぶるものの色は OUTFIT.hatColor（hatPal で P.hat・hatShade・hatAccent）。
     色はどれもマフラーと同じ8色（赤はプレイヤーの着せ替えとハートだけ）。どれもプレイヤーの縁取り（player-line）・2段の影・光は左上・丸い形だけ。
     動きはマフラーのひもの点（Q.scarf）を使う：体に遅れてついてくる・跳ぶと後ろへ流れる・風に流れる・2段ジャンプを使い切るとしおれる */
  var OUTFIT = { wear: 'stripe', hat: null, hatColor: 'ao' };
  var OUTFIT_COLORS = SCARF_COLORS.map(function (c) {   // マフラーと同じ8色（あかは tokens.css の scarf のまま）
    return c.id === 'yuki' ? { id: c.id, name: c.name, scarf: c.scarf, shade: c.shade, stripe: '#dfe4ec', star: c.star } : c;   // ゆきの赤いしまは使わない
  });
  var OUTFIT_ITEMS = {
    wear: [{ id: 'stripe', name: 'しましまマフラー' }, { id: 'cape', name: 'マント' }, { id: 'ribbon', name: 'おおきなリボン' }, { id: 'bell', name: 'すずのくびわ' }],
    hat: [{ id: 'knit', name: 'ニットぼう' }, { id: 'wizard', name: 'まほうのぼうし' }, { id: 'straw', name: 'むぎわらぼうし' }, { id: 'crown', name: 'おうかん' }]
  };
  var GOLD = { base: '#f2c94c', shade: '#c39028', light: '#fff2bf' }, STRAW = { base: '#ecd08a', shade: '#c9a256', line: '#ad8642' }, PEARL = { base: '#f7f3ea', shade: '#d6cfc2' };
  var hatPalCache = {};
  function outfitColor(id) { for (var i = 0; i < OUTFIT_COLORS.length; i++) if (OUTFIT_COLORS[i].id === id) return OUTFIT_COLORS[i]; return OUTFIT_COLORS[0]; }
  function hatPal(P) {
    var c = outfitColor(OUTFIT.hatColor), key = (P.id || '') + '|' + c.id, Q = hatPalCache[key];
    var R = P.base && P.base.scarf ? P.base : P;   // あかは元の scarf の色（着るものの色に変わった P からは取らない）
    if (!Q || Q.base !== P) { Q = Object.create(P); Q.hat = c.scarf || R.scarf; Q.hatShade = c.shade || R.scarfShade; Q.hatAccent = c.stripe || R.scarfStripe; Q.base = P; hatPalCache[key] = Q; }
    return Q;
  }
  // ひもの流れ：立っているとき（ひもが後ろ下へたれる）からのずれ [横, 縦] と、ひもの長さ（しおれると短い）
  function flowOf(Q) { var p = Q.scarf, a = p[0], b = p[p.length - 1], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1; return [dx / d + 0.48, dy / d - 0.88, d]; }
  // 首の細い帯（しましまマフラーの巻き方と同じ筒の形。しまと結び目なし）
  function neckBand(g, P, h, cy) {
    var S = SCARF, k0 = S.wrapH, k1 = S.wrapStripes, k2 = S.knotR;
    S.wrapH = h; S.wrapStripes = 0; S.knotR = 0;
    try { scarfWrap(g, P, 0, cy); } finally { S.wrapH = k0; S.wrapStripes = k1; S.knotR = k2; }
  }
  // 首の帯の前の点（角 th：0 が真ん前、+ が右（顔の側））
  function bandPoint(th, cy) { var S = SCARF; cy = cy == null ? S.wrapY : cy; return [S.wrapW / 2 * Math.sin(th), cy + S.sag * Math.cos(th)]; }
  // 平たい布（中心の線にそって幅 w(i) の帯。はしは丸い山）
  function clothPath(g, s, wOf, scallops) {
    var n = s.length, L = [], R = [];
    for (var i = 0; i < n; i++) {
      var a = s[Math.max(0, i - 1)], b = s[Math.min(n - 1, i + 1)], nx = -(b[1] - a[1]), ny = b[0] - a[0], d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
      var w = wOf(i / (n - 1)); L.push([s[i][0] + nx * w, s[i][1] + ny * w]); R.push([s[i][0] - nx * w, s[i][1] - ny * w]);
    }
    var e = s[n - 1], f = s[n - 2], tx = e[0] - f[0], ty = e[1] - f[1], tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    return function () {
      g.beginPath(); g.moveTo(R[0][0], R[0][1]); g.lineTo(L[0][0], L[0][1]);
      for (var j = 1; j < n; j++) g.lineTo(L[j][0], L[j][1]);
      var A = L[n - 1], B = R[n - 1];
      for (var k = 0; k < scallops; k++) {   // すその丸い山（とがらせない）
        var p0 = [A[0] + (B[0] - A[0]) * k / scallops, A[1] + (B[1] - A[1]) * k / scallops], p1 = [A[0] + (B[0] - A[0]) * (k + 1) / scallops, A[1] + (B[1] - A[1]) * (k + 1) / scallops], bump = CAPE.bump;
        g.bezierCurveTo(p0[0] + tx * bump, p0[1] + ty * bump, p1[0] + tx * bump, p1[1] + ty * bump, p1[0], p1[1]);
      }
      for (j = n - 2; j >= 0; j--) g.lineTo(R[j][0], R[j][1]);
      g.closePath();
    };
  }
  // ひもの点を、根元 o から k 倍の長さに写す（布が少しはためく）
  function ropeFrom(pts, o, k, t, flap) {
    return pts.map(function (p, i) { return [o[0] + (p[0] - pts[0][0]) * k + Math.sin(t * 3.2 + i * 1.1) * flap * i, o[1] + (p[1] - pts[0][1]) * k + Math.cos(t * 2.7 + i * 1.3) * flap * 0.8 * i]; });
  }

  /* マント：首の後ろから背中へたれる、すそまでの長さの布。すそは丸い山3つ。裏地は1段暗く、前は金の留め具。
     マフラーより重い布なので、ひもの動きは半分だけ（CAPE.follow）：止まると背中にそってたれ、跳ぶと少し後ろへ持ち上がる。体から大きくはみ出さない */
  var CAPE = { rest: [[-4, -1], [-6.6, 4.2], [-8.0, 9.4], [-8.7, 14.6], [-9.0, 19.6]], follow: 0.5, w0: 3.6, w1: 2.4, flap: 0.12, bump: 1.5 };
  function capeRope(Q) {   // 立っているときのひも（POSES.stand）からのずれを、半分だけ足す
    var st = POSES.stand.scarf;
    return CAPE.rest.map(function (r, i) { var p = Q.scarf[i] || Q.scarf[Q.scarf.length - 1]; return [r[0] + (p[0] - st[i][0]) * CAPE.follow, r[1] + (p[1] - st[i][1]) * CAPE.follow]; });
  }
  function capeBack(g, P, Q, t) {
    var s = spline(ropeFrom(capeRope(Q), [-4.6, -0.8], 1, t, CAPE.flap), 5);
    var lining = clothPath(g, s.map(function (p, i) { return [p[0] + 0.9, p[1] + 1.1 + i * 0.02]; }), function (f) { return CAPE.w0 - 0.3 + CAPE.w1 * 0.9 * f; }, 3);
    solid(g, lining, mix(P.scarfShade, '#000000', 0.22), mix(P.scarfShade, '#000000', 0.38), P.playerLine, 0.6, 1.0);
    var cloth = clothPath(g, s, function (f) { return CAPE.w0 + CAPE.w1 * f; }, 3);
    solid(g, cloth, P.scarf, P.scarfShade, P.playerLine, 1.1, 1.0);
    g.save(); cloth(); g.clip();   // ひだ1本（内側の細い線）と、上のふちの光
    g.strokeStyle = alpha(P.scarfShade, 0.9); g.lineWidth = 0.7; g.lineCap = 'round'; g.beginPath();
    var n = s.length; for (var i = Math.round(n * 0.3); i < Math.round(n * 0.9); i++) { var q = s[i]; if (i === Math.round(n * 0.3)) g.moveTo(q[0], q[1]); else g.lineTo(q[0], q[1]); }
    g.stroke(); g.restore();
  }
  function capeFront(g, P, Q, t) {
    neckBand(g, P, 2.6);
    var c = bandPoint(0.62);
    solid(g, function () { ell(g, c[0], c[1], 1.75, 1.75); }, GOLD.base, GOLD.shade, P.playerLine, 0.5, 1.0);
    g.strokeStyle = GOLD.shade; g.lineWidth = 0.6; ell(g, c[0] + 0.15, c[1] + 0.15, 0.8, 0.8); g.stroke();
    shine(g, c[0] - 0.6, c[1] - 0.7, 0.55, 0.35, 0.85);
  }

  /* おおきなリボン：首の後ろに大きな蝶結び（横から見るので輪が上と下）。はしの2本はひもと同じに流れる */
  // 蝶結び：ang の向きに輪が2つ。fan だけ輪を開く（横から見るときは後ろへ開いて「＜」の形、正面から見るときは少したれる）
  function bowShape(g, P, cx, cy, ang, sc, t, fan) {
    fan = fan == null ? 0.18 : fan;
    var wob = Math.sin(t * 2.4) * 0.06;
    [1, -1].forEach(function (sd) {
      var rot = ang + sd * fan + wob * sd, dx = Math.cos(rot), dy = Math.sin(rot);
      var lx = cx + dx * 3.1 * sd * sc, ly = cy + dy * 3.1 * sd * sc;
      var loop = function () { g.beginPath(); g.ellipse(lx, ly, 3.4 * sc, 2.35 * sc, rot, 0, Math.PI * 2); };
      solid(g, loop, P.scarf, P.scarfShade, P.playerLine, 0.8, 1.0);
      g.fillStyle = mix(P.scarfShade, '#000000', 0.12);   // 輪の中のくぼみ（結び目の近く）
      g.beginPath(); g.ellipse(cx + dx * 2.0 * sd * sc, cy + dy * 2.0 * sd * sc, 1.35 * sc, 0.8 * sc, rot, 0, Math.PI * 2); g.fill();
      shine(g, lx - 0.9 * sc, ly - 0.8 * sc, 0.8 * sc, 0.45 * sc, 0.6);
    });
    solid(g, function () { rr(g, cx - 1.55 * sc, cy - 1.75 * sc, 3.1 * sc, 3.5 * sc, 1.3 * sc); }, P.scarf, P.scarfShade, P.playerLine, 0.6, 1.0);
    g.strokeStyle = alpha(P.scarfShade, 0.9); g.lineWidth = 0.6; g.beginPath(); g.moveTo(cx - 0.9 * sc, cy - 0.6 * sc); g.quadraticCurveTo(cx, cy + 0.2 * sc, cx + 0.9 * sc, cy - 0.5 * sc); g.stroke();
  }
  function ribbonTails(g, P, Q, t, o) {
    o = o || [-9.6, 2.2];
    var a = ropeFrom(Q.scarf, o, 0.58, t, 0.12), b = ropeFrom(Q.scarf, [o[0] + 0.8, o[1] + 0.6], 0.46, t + 0.7, 0.12).map(function (p, i) { return [p[0] + i * 0.9, p[1] + i * 0.5]; });
    ribbon(g, P, b, 1.7, P.scarfShade, mix(P.scarfShade, '#000000', 0.18), false);
    ribbon(g, P, a, 1.9, P.scarf, P.scarfShade, false);
  }
  function ribbonBack(g, P, Q, t) { ribbonTails(g, P, Q, t); }
  function ribbonFront(g, P, Q, t) {
    neckBand(g, P, 2.2);
    var fl = flowOf(Q);
    bowShape(g, P, -10.4, 1.0, Math.PI / 2 + fl[0] * 0.35, 1.25, t, 0.62);   // 大きな輪が後ろへ開く（上と下）。跳ぶと少し後ろへ倒れる
  }

  /* すずのくびわ：細い首輪と、前にさがる金の鈴。鈴はひもの流れと反対に振れて、少しゆれる */
  function bellDraw(g, P, x, y, a, t) {
    g.save(); g.translate(x, y); g.rotate(a);
    g.strokeStyle = P.playerLine; g.lineWidth = 0.9; ell(g, 0, 0.2, 0.85, 0.85); g.stroke();   // 首輪につなぐ小さな輪
    var body = function () { g.beginPath(); g.arc(0, 2.9, 2.35, Math.PI * 1.02, Math.PI * 1.98); g.quadraticCurveTo(2.7, 4.9, 1.9, 5.0); g.lineTo(-1.9, 5.0); g.quadraticCurveTo(-2.7, 4.9, -2.3, 2.6); g.closePath(); };
    solid(g, body, GOLD.base, GOLD.shade, P.playerLine, 0.6, 1.0);
    g.strokeStyle = GOLD.shade; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-2.2, 3.4); g.quadraticCurveTo(0, 3.9, 2.2, 3.4); g.stroke();   // 帯の線（内側の細い線1本）
    g.fillStyle = mix(GOLD.shade, '#000000', 0.45); ell(g, 0, 4.55, 0.9, 0.42); g.fill();   // 下のすき間
    shine(g, -0.9, 1.6, 0.7, 0.45, 0.9);
    g.restore();
  }
  function bellFront(g, P, Q, t) {
    neckBand(g, P, 2.8);
    var fl = flowOf(Q), c = bandPoint(0.5), a = Math.max(-0.9, Math.min(0.9, -fl[0] * 1.2 + Math.sin(t * 2.4) * 0.07));
    bellDraw(g, P, c[0], c[1] + 1.2, a, t);
  }

  /* ---- かぶるもの（頭のてっぺん：体の点で y = -12.5。目は y = -6〜-2.5 なので、ふちは -7 より上） ---- */
  // ニットぼう：まるいドームと折り返し（うねの縦じま）、てっぺんのぽんぽんはひもの流れでゆれる
  function hatKnit(g, P, Q, t) {
    var H = hatPal(P), fl = flowOf(Q);
    var px = -2.2 + fl[0] * 3.6 + Math.sin(t * 2.6) * 0.3, py = -17.4 + fl[1] * 1.8 - Math.abs(Math.sin(t * 2.6)) * 0.35;
    var ball = function () {   // ふわふわ：小さな丸い山を10こつないだ玉
      g.beginPath();
      for (var k = 0; k <= 10; k++) { var a0 = k / 10 * Math.PI * 2, a1 = (k + 0.5) / 10 * Math.PI * 2, x0 = px + Math.cos(a0) * 3.0, y0 = py + Math.sin(a0) * 3.0;
        if (k === 0) g.moveTo(x0, y0); else g.quadraticCurveTo(px + Math.cos(a1 - Math.PI / 10) * 3.7, py + Math.sin(a1 - Math.PI / 10) * 3.7, x0, y0); }
      g.closePath();
    };
    solid(g, ball, H.hatAccent, mix(H.hatAccent, H.hatShade, 0.45), P.playerLine, 0.7, 1.0);
    var dome = function () { g.beginPath(); g.moveTo(-10.9, -8.3); g.bezierCurveTo(-10.9, -14.1, -5.9, -16.3, 0, -16.3); g.bezierCurveTo(5.9, -16.3, 10.9, -14.1, 10.9, -8.3); g.quadraticCurveTo(0, -7.6, -10.9, -8.3); g.closePath(); };
    solid(g, dome, H.hat, H.hatShade, P.playerLine, 1.5, 1.15);
    g.save(); dome(); g.clip(); g.strokeStyle = alpha(H.hatShade, 0.75); g.lineWidth = 0.7; g.lineCap = 'round';   // 編み目のすじ2本
    [-3.6, 3.4].forEach(function (x) { g.beginPath(); g.moveTo(x * 0.55, -16); g.quadraticCurveTo(x * 1.15, -12.5, x * 1.05, -9.6); g.stroke(); });
    g.restore();
    shine(g, -5.2, -13.4, 2.1, 1.1, 0.75);
    var cuff = function () { g.beginPath(); g.moveTo(-11.4, -10.6); g.quadraticCurveTo(0, -9.7, 11.4, -10.6); g.quadraticCurveTo(11.9, -9.2, 11.3, -7.8); g.quadraticCurveTo(0, -6.8, -11.3, -7.8); g.quadraticCurveTo(-11.9, -9.2, -11.4, -10.6); g.closePath(); };
    solid(g, cuff, mix(H.hat, '#ffffff', 0.1), H.hatShade, P.playerLine, 0.9, 1.0);
    g.save(); cuff(); g.clip(); g.strokeStyle = H.hatShade; g.lineCap = 'butt';   // うね：角度で並べる（はしほど細く）
    for (var i = 0; i < 7; i++) { var th = -Math.PI / 2 + Math.PI * (i + 0.5) / 7, c = Math.cos(th), x = 11.3 * Math.sin(th); g.globalAlpha = 0.45 + 0.4 * c; g.lineWidth = 0.4 + 0.5 * c; g.beginPath(); g.moveTo(x, -11); g.lineTo(x, -6.5); g.stroke(); }
    g.globalAlpha = 1; g.restore();
  }
  // まほうのぼうし：広いつばと、やわらかく後ろへ曲がる三角（先は丸い玉）。先はひもの流れでゆれる
  function hatWizard(g, P, Q, t) {
    var H = hatPal(P), fl = flowOf(Q);
    var brim = function () { g.beginPath(); g.ellipse(0, -9.1, 13.4, 2.8, 0, 0, Math.PI * 2); };
    solid(g, brim, H.hat, H.hatShade, P.playerLine, 0.9, 1.15);
    var tx = -6.2 + fl[0] * 5 + Math.sin(t * 2.1) * 0.6, ty = -25.2 + fl[1] * 2.4 + Math.cos(t * 2.1) * 0.3;
    var cone = function () {
      g.beginPath(); g.moveTo(-7.4, -9.6);
      g.bezierCurveTo(-6.6, -15, -4.5, -19.5, tx - 1.2, ty + 1.2);
      g.quadraticCurveTo(tx, ty - 0.6, tx + 1.3, ty + 0.9);
      g.bezierCurveTo(0.6, -19.4, 6.4, -15.5, 7.4, -9.6);
      g.quadraticCurveTo(0, -8.4, -7.4, -9.6); g.closePath();
    };
    solid(g, cone, H.hat, H.hatShade, P.playerLine, 1.4, 1.15);
    g.save(); cone(); g.clip();
    g.fillStyle = mix(H.hatShade, '#000000', 0.2); g.beginPath(); g.moveTo(-8, -12.6); g.quadraticCurveTo(0, -11.6, 8, -12.6); g.lineTo(8, -9); g.lineTo(-8, -9); g.closePath(); g.fill();   // 帯
    shine(g, -3.8, -14.8, 1.1, 2.4, 0.6, -0.25);
    g.restore();
    solid(g, function () { rr(g, 0.8, -12.4, 3.2, 2.9, 0.9); }, GOLD.base, GOLD.shade, P.playerLine, 0.4, 1.0);   // 金の留め具
    solid(g, function () { ell(g, tx, ty, 1.8, 1.8); }, GOLD.light, GOLD.base, P.playerLine, 0.5, 1.0);   // 先の丸い玉
  }
  // むぎわらぼうし：麦わら色のつばと山、色のリボン（後ろに短いはし2本がなびく）
  function hatStraw(g, P, Q, t) {
    var H = hatPal(P), fl = flowOf(Q);
    var o = [-6.4, -10.6], a = ropeFrom(Q.scarf, o, 0.32, t, 0.08), b = ropeFrom(Q.scarf, [o[0] + 0.5, o[1] + 0.4], 0.26, t + 0.6, 0.08).map(function (p, i) { return [p[0] + i * 0.6, p[1] + i * 0.3]; });
    var Hp = Object.create(P); Hp.scarf = H.hat; Hp.scarfShade = H.hatShade;
    ribbon(g, Hp, b, 1.15, H.hatShade, mix(H.hatShade, '#000000', 0.2), false);
    ribbon(g, Hp, a, 1.3, H.hat, H.hatShade, false);
    var brim = function () { g.beginPath(); g.ellipse(0, -9.1, 14.6, 3.2, 0, 0, Math.PI * 2); };
    solid(g, brim, STRAW.base, STRAW.shade, P.playerLine, 1.0, 1.15);
    g.strokeStyle = alpha(STRAW.line, 0.7); g.lineWidth = 0.7; g.beginPath(); g.ellipse(0, -8.9, 11.6, 2.35, 0, 0.15, Math.PI - 0.15); g.stroke();   // 編み目の線1本
    var crown = function () { g.beginPath(); g.moveTo(-7.3, -9.4); g.bezierCurveTo(-7.6, -15.2, -3.6, -15.9, 0, -15.9); g.bezierCurveTo(3.6, -15.9, 7.6, -15.2, 7.3, -9.4); g.quadraticCurveTo(0, -8.3, -7.3, -9.4); g.closePath(); };
    solid(g, crown, STRAW.base, STRAW.shade, P.playerLine, 1.3, 1.15);
    g.save(); crown(); g.clip();
    g.fillStyle = H.hat; g.beginPath(); g.moveTo(-8, -12.3); g.quadraticCurveTo(0, -11.3, 8, -12.3); g.lineTo(8, -9); g.lineTo(-8, -9); g.closePath(); g.fill();   // リボン
    g.fillStyle = H.hatShade; g.beginPath(); g.moveTo(-8, -10.2); g.quadraticCurveTo(0, -9.2, 8, -10.2); g.lineTo(8, -8.6); g.lineTo(-8, -8.6); g.closePath(); g.fill();
    g.strokeStyle = alpha(STRAW.line, 0.7); g.lineWidth = 0.7; g.beginPath(); g.moveTo(-5.6, -13.8); g.quadraticCurveTo(0, -12.9, 5.6, -13.8); g.stroke();   // 編み目の線1本
    g.restore();
    shine(g, -3.6, -14.3, 1.8, 0.8, 0.7);
  }
  // おうかん：金の冠。3つの山の先は丸い真珠、前に色の宝石。少し傾けてのせる
  function hatCrown(g, P, Q, t) {
    var H = hatPal(P), fl = flowOf(Q);
    g.save(); g.translate(-0.6, -11.4); g.rotate(-0.12 - fl[0] * 0.08); g.translate(0, 11.4);
    var pts = [[-6.9, -9.9], [-7.4, -15.4], [-3.4, -12.6], [0, -16.7], [3.4, -12.6], [7.4, -15.4], [6.9, -9.9]];
    var body = function () {   // 角を丸めた形（山の先も谷も丸い）
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length - 1; i++) { var m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
      g.lineTo(pts[6][0], pts[6][1]); g.quadraticCurveTo(0, -9.1, pts[0][0], pts[0][1]); g.closePath();
    };
    solid(g, body, GOLD.base, GOLD.shade, P.playerLine, 1.1, 1.15);
    g.strokeStyle = GOLD.shade; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-6.9, -11.6); g.quadraticCurveTo(0, -10.7, 6.9, -11.6); g.stroke();   // 帯の線1本
    [[-7.2, -15.6], [0, -17.0], [7.2, -15.6]].forEach(function (q) { solid(g, function () { ell(g, q[0], q[1], 1.25, 1.25); }, PEARL.base, PEARL.shade, P.playerLine, 0.4, 1.0); });
    solid(g, function () { ell(g, 0.4, -12.9, 1.85, 1.5); }, H.hat, H.hatShade, P.playerLine, 0.5, 1.0);   // 宝石
    shine(g, -0.2, -13.4, 0.6, 0.35, 0.9);
    shine(g, -4.6, -13.6, 0.7, 1.4, 0.55, -0.2);
    g.restore();
  }
  var HATS = { knit: hatKnit, wizard: hatWizard, straw: hatStraw, crown: hatCrown };
  var HAT_TOP = { knit: -21, wizard: -28, straw: -16.5, crown: -18.5 };   // いちばん上（絵の大きさを決めるとき用）

  // ghost から呼ぶ：体の後ろ（しっぽ・マントなど）・体の前（首の帯など）・頭
  function wearBack(g, P, Q, t) {
    var w = OUTFIT.wear;
    if (w === 'stripe') { if (!SCARF.front) scarfTail(g, P, Q.scarf, t); }
    else if (w === 'cape') capeBack(g, P, Q, t);
    else if (w === 'ribbon') ribbonBack(g, P, Q, t);
  }
  function wearFront(g, P, Q, t, b) {   // b：体の形（{ o, sw, wv }）。服（GARMENT）は体の線から切り出す
    var w = OUTFIT.wear;
    if (GARMENT[w]) { GARMENT[w](g, P, Q, t, b || { o: SHEET_O, sw: 0, wv: 0 }); return; }
    if (w === 'stripe') { scarfWrap(g, P, 0); if (SCARF.front) scarfTail(g, P, Q.scarf, t); }
    else if (w === 'cape') capeFront(g, P, Q, t);
    else if (w === 'ribbon') ribbonFront(g, P, Q, t);
    else if (w === 'bell') bellFront(g, P, Q, t);
  }
  function hatDraw(g, P, Q, t) { var f = OUTFIT.hat && HATS[OUTFIT.hat]; if (f) f(g, P, Q, t); }

  // 着せ替えの品物アイコン（着せ替えの一覧・ろうそくガチャ）。x, y が絵のまん中。体が無いので、首の輪は後ろ側も描く
  var ICON_REST = [[-4, -1], [-5, 5], [-5.5, 11], [-5, 17], [-4, 23]];   // しっぽは下へたれる
  function iconRing(g, Q, cy) {
    g.lineCap = 'round';
    g.strokeStyle = Q.playerLine; g.lineWidth = SCARF.wrapH + 2; g.beginPath(); g.ellipse(0, cy, SCARF.wrapW / 2, SCARF.sag, 0, Math.PI, Math.PI * 2); g.stroke();
    g.strokeStyle = Q.scarfShade; g.lineWidth = SCARF.wrapH; g.beginPath(); g.ellipse(0, cy, SCARF.wrapW / 2, SCARF.sag, 0, Math.PI, Math.PI * 2); g.stroke();
  }
  function outfitIcon(g, P, id, x, y, s, t, colorId) {
    if (id === 'stripe') { scarfItem(g, P, x, y - 6 * s, s, t, colorId); return; }
    if (PROPS[id]) {   // 小物：くわえる物は口の位置をまん中へ、ステッキは手をまん中の下へ
      var keepP = OUTFIT.propColor; if (colorId) OUTFIT.propColor = colorId;
      g.save(); g.translate(x, y); g.scale(s, s);
      try {
        if (id === 'wand') { g.scale(0.82, 0.82); g.translate(-2.4, 8.5); PROPS.wand(g, P, { hands: [[0, 0], [0, 0]] }, t, [0, 0]); }
        else { g.scale(1.25, 1.25); var oc = { lolly: [9.6, 4.0], cane: [7.4, 3.8], rose: [9.2, 2.0] }[id]; g.translate(-oc[0], -oc[1]); PROPS[id](g, P, { scarf: ICON_REST }, t); }
      } finally { g.restore(); OUTFIT.propColor = keepP; }
      return;
    }
    if (GARMENT[id]) {   // 服：体なしで服の形だけ
      var keepW = SCARF.color; if (colorId) SCARF.color = colorId;
      g.save(); g.translate(x, y); g.scale(s * 1.05, s * 1.05); g.translate(0, -2.6);
      try { GARMENT[id](g, scarfPal(P), { scarf: ICON_REST }, t, { o: SHEET_O, sw: 0, wv: 0 }); } finally { g.restore(); SCARF.color = keepW; }
      return;
    }
    var hat = !!HATS[id], keepC = SCARF.color, keepH = OUTFIT.hatColor, sag0 = SCARF.sag, wh0 = SCARF.wrapH;
    if (colorId) { if (hat) OUTFIT.hatColor = colorId; else SCARF.color = colorId; }
    var Q = { scarf: ICON_REST, hem: 0 };
    g.save(); g.translate(x, y);
    try {
      if (hat) {
        var k = { knit: 1.12, wizard: 0.82, straw: 0.98, crown: 1.45, santahat: 1.0, hairbow: 1.5, halo: 1.35 }[id], cy = { knit: -12.4, wizard: -17, straw: -11.6, crown: -13.4, santahat: -13.2, hairbow: -12.2, halo: -19.2 }[id];
        g.scale(s * k, s * k); g.translate(0, -cy); HATS[id](g, P, Q, t);
      } else {
        var C = scarfPal(P); g.scale(s, s); SCARF.sag = 3.6;
        if (id === 'cape') {
          g.translate(0, -4); SCARF.wrapH = 2.6; iconRing(g, C, -6.4); SCARF.wrapH = wh0;
          g.save(); g.translate(7.6, -6.2); capeBack(g, C, { scarf: POSES.stand.scarf }, t); g.restore();
          neckBand(g, C, 2.6, -6.4);
          var c = bandPoint(0.0, -6.4); solid(g, function () { ell(g, c[0], c[1], 1.75, 1.75); }, GOLD.base, GOLD.shade, C.playerLine, 0.5, 1.0); shine(g, c[0] - 0.6, c[1] - 0.7, 0.55, 0.35, 0.85);
        } else if (id === 'ribbon') {
          g.translate(0, -3); SCARF.wrapH = 2.2; iconRing(g, C, -4.5); SCARF.wrapH = wh0;
          ribbonTails(g, C, { scarf: ICON_REST }, t, [0.2, -1.2]);
          neckBand(g, C, 2.2, -4.5);
          bowShape(g, C, 0, -1.6, 0, 1.05, t);
        } else if (id === 'bell') {
          g.translate(0, -2.5); SCARF.wrapH = 2.8; iconRing(g, C, -3); SCARF.wrapH = wh0;
          neckBand(g, C, 2.8, -3);
          bellDraw(g, C, 0, -3 + SCARF.sag + 1.2, Math.sin(t * 2.4) * 0.12, t);
        }
      }
    } finally { g.restore(); SCARF.color = keepC; OUTFIT.hatColor = keepH; SCARF.sag = sag0; SCARF.wrapH = wh0; }
  }
  // 着ているもの（色も）をまとめて取り出す・入れる（2人対戦の相手を描くとき、結果の絵など）
  function outfitGet() { return { wear: OUTFIT.wear, color: SCARF.color, hat: OUTFIT.hat, hatColor: OUTFIT.hatColor, prop: OUTFIT.prop, propColor: OUTFIT.propColor }; }
  function withOutfit(look, fn) {
    if (!look) return fn();
    var keep = outfitGet();
    OUTFIT.wear = look.wear || 'stripe'; SCARF.color = look.color || 'red'; OUTFIT.hat = look.hat || null; OUTFIT.hatColor = look.hatColor || 'ao'; OUTFIT.prop = look.prop || null; OUTFIT.propColor = look.propColor || 'red';
    try { return fn(); } finally { OUTFIT.wear = keep.wear; SCARF.color = keep.color; OUTFIT.hat = keep.hat; OUTFIT.hatColor = keep.hatColor; OUTFIT.prop = keep.prop; OUTFIT.propColor = keep.propColor; }
  }
  /* ---------- 着る：体に着る服（ポンチョ・サンタのふく・コート）。体の線（sheetPath）を少し太らせて、上（首）と下（すそ）で切る ----------
     おばけのすその波は服の下から見える。服は体の前の層（目より下）。前の手は服の上に来る */
  var SHEET_O = { top: -12.5, half: 10, shoulder: 11.5, flare: 1.6, hemY: 10, waves: 3, amp: 2.4, swing: 1.6, wobble: 0.9, hand: 2.1, handGap: 2.3,
    eyes: [[2.2, -4.2], [6.6, -4.4]], cheeks: [[0.2, -1], [8.8, -1.3]] };
  var FUR = { base: '#fbf8f2', shade: '#d9d2c6' }, BELT = { base: '#3b3442', shade: '#28222e' };
  // spec：sx 横の太らせ、top 上の高さ、topSag 上の線の前の下がり、hem すその高さ、bumps すその山の数（0 ならまっすぐ）、bump 山の高さ
  function garment(g, P, b, spec, base, shade, details) {
    var o = b.o, sw = b.sw || 0, wv = b.wv || 0, sx = spec.sx, hs = sw * 0.35;
    var body = function () { g.save(); g.translate(0, -1); g.scale(sx, 1.02); g.translate(0, 1); sheetPath(g, o, sw, wv); g.restore(); };
    var hemLine = function (close) {   // すその線（左の外 → 右の外）。close なら上を回って閉じた形（服の範囲）
      var y = spec.hem, n = spec.bumps, x0 = -16 + hs, x1 = 16 + hs;
      if (close) { g.beginPath(); g.moveTo(-30, spec.top); g.quadraticCurveTo(0, spec.top + spec.topSag, 30, spec.top); g.lineTo(30, y); g.lineTo(x1, y); }
      else { g.beginPath(); g.moveTo(x1, y); }
      if (n) for (var k = 0; k < n; k++) { var a = x1 + (x0 - x1) * k / n, c = x1 + (x0 - x1) * (k + 1) / n; g.bezierCurveTo(a, y + spec.bump, c, y + spec.bump, c, y); }
      else g.quadraticCurveTo(hs, y + spec.bump, x0, y);
      if (close) { g.lineTo(-30, y); g.closePath(); }
    };
    var topLine = function () { g.beginPath(); g.moveTo(-16, spec.top); g.quadraticCurveTo(0, spec.top + spec.topSag, 16, spec.top); };
    g.save(); hemLine(true); g.clip();
    solid(g, body, base, shade, P.playerLine, 1.4, 1.15);
    g.save(); body(); g.clip();   // すその上の影の帯（布の厚み）
    g.strokeStyle = alpha(shade, 0.85); g.lineWidth = 1.6; g.translate(0, -1.1); hemLine(false); g.stroke(); g.restore();
    if (details) { g.save(); body(); g.clip(); details(hemLine, topLine, body); g.restore(); }
    g.restore();
    // 上とすその縁取り（体の線の中だけ）
    g.save(); body(); g.clip(); g.strokeStyle = P.playerLine; g.lineWidth = 2.3; g.lineCap = 'round';
    hemLine(false); g.stroke(); if (!spec.noTopLine) { topLine(); g.stroke(); } g.restore();
  }
  var GARMENT = {
    // ポンチョ：肩からすっぽり。広くて、すそは丸い山4つ。すその近くに しま2本
    poncho: function (g, P, Q, t, b) {
      var spec = { sx: 1.13, top: -2.4, topSag: 1.6, hem: 5.4, bumps: 4, bump: 2.0 };
      garment(g, P, b, spec, P.scarf, P.scarfShade, function () {
        g.lineCap = 'butt';
        [[2.6, P.scarfStripe], [3.6, mix(P.scarfShade, '#000000', 0.15)]].forEach(function (s2) {
          g.strokeStyle = s2[1]; g.lineWidth = 0.75; g.beginPath(); g.moveTo(-16, s2[0]); g.quadraticCurveTo(0, s2[0] + 0.9, 16, s2[0]); g.stroke();
        });
        shine(g, -5.5, -0.6, 2.2, 0.9, 0.55);
      });
      // 首まわりの小さな折り返し
      var Hp = P; neckBand(g, Hp, 2.2, -1.2);
    },
    // サンタのふく：上着（色）・白いふわふわのすそ・黒いベルトと金のバックル・白いえり
    santa: function (g, P, Q, t, b) {
      var spec = { sx: 1.06, top: -0.4, topSag: 1.4, hem: 8.4, bumps: 0, bump: 0.8, noTopLine: true };   // 上着はすその波の上まで
      garment(g, P, b, spec, P.scarf, P.scarfShade, function () {
        g.fillStyle = BELT.base; g.beginPath(); g.moveTo(-16, 3.7); g.quadraticCurveTo(0, 4.6, 16, 3.7); g.lineTo(16, 4.4); g.quadraticCurveTo(0, 5.3, -16, 4.4); g.closePath(); g.fill();   // 細いベルト
        shine(g, -5.6, 0.8, 2.0, 0.9, 0.5);
      });
      // すその白いふわふわ（丸い山をつないだ帯。体の線の中だけ）
      g.save(); g.save(); g.translate(0, -1); g.scale(1.1, 1.02); g.translate(0, 1); sheetPath(g, b.o, b.sw || 0, b.wv || 0); g.restore(); g.clip();
      var fur = function () {
        var y = spec.hem, x0 = -14, x1 = 14, n = 9; g.beginPath(); g.moveTo(x0, y - 1.0);   // 細いふわふわの帯（山を小さく）
        for (var k = 0; k < n; k++) { var a = x0 + (x1 - x0) * k / n, c = x0 + (x1 - x0) * (k + 1) / n; g.quadraticCurveTo((a + c) / 2, y - 1.8, c, y - 1.0); }
        g.lineTo(x1, y + 0.5); for (k = n; k > 0; k--) { a = x0 + (x1 - x0) * k / n; c = x0 + (x1 - x0) * (k - 1) / n; g.quadraticCurveTo((a + c) / 2, y + 1.4, c, y + 0.5); }
        g.closePath();
      };
      solid(g, fur, FUR.base, FUR.shade, P.playerLine, 0.7, 1.0); g.restore();
      // バックル（金の角丸）
      var bx = 4.6; solid(g, function () { rr(g, bx - 1.1, 3.55, 2.2, 1.6, 0.5); }, GOLD.base, GOLD.shade, P.playerLine, 0.3, 0.9);
      g.fillStyle = BELT.base; g.fillRect(bx - 0.4, 4.05, 0.8, 0.6);
      // 白いえり
      var Fp = Object.create(P); Fp.scarf = FUR.base; Fp.scarfShade = FUR.shade; neckBand(g, Fp, 2.2, -0.2);
    },
    // コート：すそまでの上着。えりは丸い折り返し2枚、前に金のボタン2つ
    coat: function (g, P, Q, t, b) {
      var spec = { sx: 1.07, top: -0.6, topSag: 1.2, hem: 7.6, bumps: 0, bump: 1.0 };
      garment(g, P, b, spec, P.scarf, P.scarfShade, function () {
        g.strokeStyle = alpha(P.scarfShade, 0.9); g.lineWidth = 0.7; g.beginPath(); g.moveTo(4.8, 1.6); g.quadraticCurveTo(5.3, 4.6, 5.0, 8); g.stroke();   // 前あわせ（内側の細い線1本）
        shine(g, -5.6, 1.0, 2.0, 1.0, 0.5);
      });
      [[1.0, -0.2, 4.6, 3.4, 6.2, -0.4], [7.2, -0.6, 5.6, 3.2, 9.6, 0.4]].forEach(function (L) {   // えり（丸い折り返し）
        solid(g, function () { g.beginPath(); g.moveTo(L[0], L[1]); g.quadraticCurveTo((L[0] + L[2]) / 2 - 0.6, (L[1] + L[3]) / 2 + 0.8, L[2], L[3]); g.quadraticCurveTo((L[2] + L[4]) / 2 + 0.9, (L[3] + L[5]) / 2 + 0.2, L[4], L[5]); g.quadraticCurveTo((L[0] + L[4]) / 2, L[1] - 0.8, L[0], L[1]); g.closePath(); },
          mix(P.scarf, '#ffffff', 0.12), P.scarfShade, P.playerLine, 0.5, 1.0);
      });
      [4.9, 6.6].forEach(function (y) { solid(g, function () { ell(g, 5.6, y, 0.8, 0.8); }, GOLD.base, GOLD.shade, P.playerLine, 0.3, 0.9); });
    }
  };

  /* ---------- かぶる：サンタぼうし・リボン・天使のわっか ---------- */
  // サンタぼうし：白いふちと、後ろへたれる先に白いぽんぽん。先はひもの流れでゆれる
  function hatSanta(g, P, Q, t) {
    var H = hatPal(P), fl = flowOf(Q);
    var tx = -12.2 + fl[0] * 3.4 + Math.sin(t * 2.4) * 0.4, ty = -12.6 + fl[1] * 2.2 + Math.abs(Math.sin(t * 2.4)) * 0.4;
    var cap = function () {   // 1つの線で囲んだ形（線が交わらない）：前のふち → 頭の上の丸み → 後ろへたれる先 → 先の下 → 後ろのふち
      g.beginPath(); g.moveTo(10.4, -9.4);
      g.bezierCurveTo(10.2, -15.2, 5.2, -18.4, -0.6, -18.2);
      g.bezierCurveTo(-6.4, -18.0, tx + 3.4, ty - 3.6, tx + 0.8, ty - 1.0);
      g.quadraticCurveTo(tx - 0.2, ty + 0.4, tx + 0.6, ty + 1.0);
      g.bezierCurveTo(tx + 2.6, ty + 1.2, -8.8, -13.6, -10.0, -11.6);
      g.quadraticCurveTo(-10.5, -10.6, -10.4, -9.4);
      g.closePath();
    };
    solid(g, cap, H.hat, H.hatShade, P.playerLine, 1.5, 1.15);
    shine(g, 2.0, -15.8, 2.0, 0.9, 0.6, -0.2);
    var furBand = function () {   // ふち：丸い山をつないだ白いふわふわ
      var x0 = -11.6, x1 = 11.6, n = 8; g.beginPath(); g.moveTo(x0, -10.4);
      for (var k = 0; k < n; k++) { var a = x0 + (x1 - x0) * k / n, c = x0 + (x1 - x0) * (k + 1) / n; g.quadraticCurveTo((a + c) / 2, -12.0 + Math.abs((a + c) / 2) * 0.03, c, -10.6 + Math.pow(c / 11.6, 2) * 0.4); }
      g.quadraticCurveTo(12.6, -9, 11.4, -7.8);
      for (k = n; k > 0; k--) { a = x0 + (x1 - x0) * k / n; c = x0 + (x1 - x0) * (k - 1) / n; g.quadraticCurveTo((a + c) / 2, -6.6, c, -7.6); }
      g.quadraticCurveTo(-12.6, -9, x0, -10.4); g.closePath();
    };
    solid(g, furBand, FUR.base, FUR.shade, P.playerLine, 0.8, 1.0);
    fluffBall(g, P, tx - 0.2, ty + 0.6, 2.5, FUR.base, FUR.shade);
  }
  function fluffBall(g, P, px, py, r, base, shade) {   // ふわふわの玉：小さな丸い山を10こつないだ形
    solid(g, function () {
      g.beginPath();
      for (var k = 0; k <= 10; k++) { var a0 = k / 10 * Math.PI * 2, a1 = (k + 0.5) / 10 * Math.PI * 2, x0 = px + Math.cos(a0) * r, y0 = py + Math.sin(a0) * r;
        if (k === 0) g.moveTo(x0, y0); else g.quadraticCurveTo(px + Math.cos(a1 - Math.PI / 10) * r * 1.22, py + Math.sin(a1 - Math.PI / 10) * r * 1.22, x0, y0); }
      g.closePath();
    }, base, shade, P.playerLine, 0.6, 1.0);
  }
  // リボン：頭のてっぺんの少し後ろに、正面向きの蝶結び（少し傾ける）
  function hatBow(g, P, Q, t) {
    var H = hatPal(P), fl = flowOf(Q), Hp = Object.create(P); Hp.scarf = H.hat; Hp.scarfShade = H.hatShade;
    g.save(); g.translate(-3.2, -12.2); g.rotate(-0.28 - fl[0] * 0.12); bowShape(g, Hp, 0, 0, 0, 1.1, t); g.restore();
  }
  // 天使のわっか：頭の上にうかんで、ゆっくり上下する輪（まわりに淡い光）
  function hatHalo(g, P, Q, t) {
    var H = hatPal(P), y = -19.2 + Math.sin(t * 2.2) * 0.8, rx = 7.4, ry = 2.2;
    var gl = g.createRadialGradient(0, y, 1, 0, y, 11); gl.addColorStop(0, alpha(mixHex(H.hat, '#ffffff', 0.5), 0.28)); gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl; ell(g, 0, y, 11, 5.4); g.fill();
    g.lineCap = 'round';
    g.strokeStyle = P.playerLine; g.lineWidth = 3.9; ell(g, 0, y, rx, ry); g.stroke();
    g.strokeStyle = H.hatShade; g.lineWidth = 1.9; ell(g, 0, y, rx, ry); g.stroke();
    g.strokeStyle = H.hat; g.lineWidth = 1.9; g.beginPath(); g.ellipse(-0.5, y - 0.35, rx, ry, 0, Math.PI * 0.95, Math.PI * 2.05); g.stroke();   // 上の半分は明るい（2段の影）
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 0.6; g.beginPath(); g.ellipse(-0.5, y - 0.6, rx - 0.6, ry - 0.4, 0, Math.PI * 1.15, Math.PI * 1.55); g.stroke();
  }
  HATS.santahat = hatSanta; HATS.hairbow = hatBow; HATS.halo = hatHalo;
  HAT_TOP.santahat = -21; HAT_TOP.hairbow = -19; HAT_TOP.halo = -24;

  /* ---------- 小物：口にくわえる（飴・クリスマスキャンディ・バラ）・手に持つ（星のステッキ） ----------
     口は両目のまん中より少し前の下・マフラーのすぐ上（体の点で [4.6, -0.3]）。口は物のうしろに描く（物を口にくわえて見える）。
     止まっているときに目にかからない位置と大きさにしてある（動いている間は少しかかってもよい）。ステッキは前の手（Q.hands[1]）で持つ */
  var MOUTH = [4.6, -0.3], STICK = { base: '#fbf8f2', shade: '#d6cfc2' }, LEAF = { base: '#4f9a58', shade: '#3a7442' };
  var propPalCache = {};
  function propPal(P) {
    var c = outfitColor(OUTFIT.propColor), key = (P.id || '') + '|' + c.id, Q = propPalCache[key];
    var R = P.base && P.base.scarf ? P.base : P;   // あかは元の scarf の色
    if (!Q || Q.base !== P) { Q = Object.create(P); Q.prop = c.scarf || R.scarf; Q.propShade = c.shade || R.scarfShade; Q.propAccent = c.stripe || R.scarfStripe; Q.base = P; propPalCache[key] = Q; }
    return Q;
  }
  function mouthDot(g, P) { g.fillStyle = P.playerLine; ell(g, MOUTH[0], MOUTH[1], 1.05, 0.85); g.fill(); g.fillStyle = mix(P.playerCheek, P.playerLine, 0.35); ell(g, MOUTH[0] + 0.1, MOUTH[1] + 0.3, 0.55, 0.35); g.fill(); }   // くわえている口（小さく開いた丸）
  function rod(g, P, pts, w, base) {   // 棒：外へ縁取ってから、ベース色の線
    g.lineCap = 'round'; g.lineJoin = 'round';
    var path = function () { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); };
    path(); g.strokeStyle = P.playerLine; g.lineWidth = w + 2; g.stroke();
    path(); g.strokeStyle = base; g.lineWidth = w; g.stroke();
  }
  // くわえる向き（MOUTH_AIM.ang：0 は顔の前へまっすぐ、＋で下向き）。u は向き、n はそれに直角（下側）
  var MOUTH_AIM = { ang: 0.64 };
  function aim() { var a = MOUTH_AIM.ang; return { u: [Math.cos(a), Math.sin(a)], n: [-Math.sin(a), Math.cos(a)] }; }
  function at(k, m) { return [MOUTH[0] + k.u[0] * m[0] + k.n[0] * (m[1] || 0), MOUTH[1] + k.u[1] * m[0] + k.n[1] * (m[1] || 0)]; }   // 口から u に m[0]、n に m[1]
  // 飴（ぐるぐるの棒つきキャンディ）：食べる方（飴の玉）を口にくわえて、棒が向きの先へ出る
  function propLolly(g, P, Q, t) {
    var C = propPal(P), k = aim(), b = Math.sin(t * 2.2) * 0.2, c = at(k, [1.5, 0.6]), cx = c[0], cy = c[1], R = 2.6;
    mouthDot(g, P);
    rod(g, P, [at(k, [3.4, 0.6]), at(k, [11.4, 0.6 + b])], 1.1, STICK.base);
    solid(g, function () { ell(g, cx, cy, R, R); }, C.prop, C.propShade, P.playerLine, 0.8, 1.0);
    g.save(); ell(g, cx, cy, R, R); g.clip(); g.strokeStyle = C.propAccent; g.lineWidth = 0.8; g.lineCap = 'round'; g.beginPath();   // うずまき
    for (var a = 0; a <= Math.PI * 3.6; a += 0.2) { var r = 0.25 + a * 0.22, x = cx + Math.cos(a + t * 0.6) * r, y = cy + Math.sin(a + t * 0.6) * r; if (a === 0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke(); g.restore();
    shine(g, cx - 1.0, cy - 1.1, 0.75, 0.45, 0.85);
  }
  // クリスマスキャンディ：曲がった方を口に引っかけて、まっすぐな方が前下へたれる（しまの杖）
  // 口の点から：上へ半周まわって前へ、そこから まっすぐ前下へ（口から見て u が前、n が下）
  function propCane(g, P, Q, t) {
    var C = propPal(P), k = aim(), b = Math.sin(t * 2.2) * 0.25, rx = 2.0, ry = 1.2, pts = [], i;   // 曲がりは小さく横長（目にかからない）
    mouthDot(g, P);
    for (i = 0; i <= 10; i++) { var th = Math.PI + i / 10 * Math.PI; pts.push(at(k, [rx + Math.cos(th) * rx, Math.sin(th) * ry])); }   // 曲がり（口 → 上 → 前）
    for (i = 1; i <= 9; i++) pts.push(at(k, [2 * rx + i * 0.3 + b * i / 18, i * 0.9]));   // まっすぐ前下へ
    rod(g, P, pts, 2.2, STICK.base);
    g.save(); g.setLineDash([1.3, 1.5]); g.lineCap = 'butt';
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.strokeStyle = C.prop; g.lineWidth = 2.2; g.stroke(); g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 0.55; g.lineCap = 'round'; g.beginPath(); g.moveTo(pts[3][0] - 0.3, pts[3][1] - 0.5); g.quadraticCurveTo(pts[5][0], pts[5][1] - 0.7, pts[7][0] + 0.3, pts[7][1] - 0.5); g.stroke();   // 曲がりの上の光
  }
  // バラ（くきを口で横にくわえて、花は向きの先。葉が1枚）
  function propRose(g, P, Q, t) {
    var C = propPal(P), k = aim(), b = Math.sin(t * 2.2) * 0.25, f = at(k, [9.6, b]), fx = f[0], fy = f[1];
    mouthDot(g, P);
    rod(g, P, [at(k, [-2.6, 0.3]), at(k, [3, 0]), at(k, [7.4, b * 0.6])], 0.9, LEAF.base);
    var l0 = at(k, [4.4, 0]), l1 = at(k, [5.0, 2.6]), l2 = at(k, [7.0, 2.4]);
    solid(g, function () { g.beginPath(); g.moveTo(l0[0], l0[1]); g.quadraticCurveTo(l1[0], l1[1], l2[0], l2[1]); g.quadraticCurveTo(l1[0] + (l2[0] - l1[0]) * 0.2 + 1, l0[1] + 0.2, l0[0], l0[1]); g.closePath(); }, LEAF.base, LEAF.shade, P.playerLine, 0.4, 1.0);
    var bloom = function () { g.beginPath(); g.moveTo(fx - 3.2, fy + 0.6); g.bezierCurveTo(fx - 3.6, fy - 3.6, fx + 3.6, fy - 3.8, fx + 3.2, fy + 0.4); g.quadraticCurveTo(fx + 2.4, fy + 3.2, fx, fy + 3.1); g.quadraticCurveTo(fx - 2.6, fy + 3.1, fx - 3.2, fy + 0.6); g.closePath(); };
    solid(g, bloom, C.prop, C.propShade, P.playerLine, 1.0, 1.0);
    g.strokeStyle = C.propShade; g.lineWidth = 0.7; g.lineCap = 'round';   // 花びらの巻き（内側の線2本）
    g.beginPath(); g.moveTo(fx - 1.6, fy - 0.6); g.quadraticCurveTo(fx, fy - 2.2, fx + 1.6, fy - 0.8); g.quadraticCurveTo(fx + 0.6, fy + 0.6, fx - 0.4, fy - 0.2); g.stroke();
    g.beginPath(); g.moveTo(fx - 2.6, fy + 1.2); g.quadraticCurveTo(fx, fy + 2.4, fx + 2.5, fy + 0.9); g.stroke();
    shine(g, fx - 1.6, fy - 1.9, 0.8, 0.45, 0.7);
  }
  // 星のステッキ（前の手で持つ。棒は手から外へ、先に角の丸い星。星のまわりに小さな光の粒）
  function softStar(g, x, y, R, r, rot) {   // 5つの角の星。外の先だけ丸める（へこみはそのまま）
    var O = [], I = [], k;
    for (k = 0; k < 5; k++) { var a = rot - Math.PI / 2 + k * Math.PI * 2 / 5; O.push([x + Math.cos(a) * R, y + Math.sin(a) * R]); I.push([x + Math.cos(a + Math.PI / 5) * r, y + Math.sin(a + Math.PI / 5) * r]); }
    var lerp = function (p, q, f) { return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]; };
    g.beginPath(); g.moveTo(I[4][0], I[4][1]);
    for (k = 0; k < 5; k++) {
      var A = lerp(I[(k + 4) % 5], O[k], 0.74), B = lerp(O[k], I[k], 0.26);
      g.lineTo(A[0], A[1]); g.quadraticCurveTo(O[k][0], O[k][1], B[0], B[1]); g.lineTo(I[k][0], I[k][1]);
    }
    g.closePath();
  }

  // ほしのステッキ：前の手で、ほぼまっすぐ上へ持つ。長めの棒に しまがらせんに巻き、先に大きな星（角は丸い）。星のまわりに小さな光の粒
  function propWand(g, P, Q, t, hand) {
    var C = propPal(P), h = hand || Q.hands[1], ox = h[0], oy = h[1] + 0.6;
    var dx = 0.2 + h[0] * 0.012, dy = -1, d = Math.hypot(dx, dy); dx /= d; dy /= d;   // ほぼ上、少し前へ
    var sw = Math.sin(t * 2) * 0.05, L = 13, cs = Math.cos(sw), sn = Math.sin(sw), ux = dx * cs - dy * sn, uy = dx * sn + dy * cs;
    var bx = ox - ux * 2.4, by = oy - uy * 2.4, tx = ox + ux * L, ty = oy + uy * L;
    rod(g, P, [[bx, by], [tx, ty]], 1.5, STICK.base);
    g.save(); g.lineCap = 'butt'; g.strokeStyle = C.prop; g.lineWidth = 1.5;   // らせんのしま（ななめの短い帯）
    for (var k = 0.1; k < 0.95; k += 0.14) { var px = bx + (tx - bx) * k, py = by + (ty - by) * k, nx = -uy * 0.75, ny = ux * 0.75; g.beginPath(); g.moveTo(px + nx + ux * 0.5, py + ny + uy * 0.5); g.lineTo(px - nx - ux * 0.5, py - ny - uy * 0.5); g.stroke(); }
    g.restore();
    solid(g, function () { ell(g, bx, by, 1.2, 1.2); }, C.prop, C.propShade, P.playerLine, 0.3, 0.9);   // 下の玉
    var sx = tx + ux * 3.2, sy = ty + uy * 3.2, tw = 0.5 + 0.5 * Math.sin(t * 4), rot = -0.25 + sw * 2;
    g.fillStyle = alpha(mixHex(C.prop, '#ffffff', 0.6), 0.08 + 0.08 * tw); ell(g, sx, sy, 7, 7); g.fill();   // 淡い光
    solid(g, function () { softStar(g, sx, sy, 5.6, 2.5, rot); }, C.prop, C.propShade, P.playerLine, 1.0, 1.0);
    shine(g, sx - 1.4, sy - 1.8, 1.1, 0.6, 0.85);
    for (var i = 0; i < 4; i++) { var a2 = t * 1.2 + i * 1.57, rr2 = 8.2 + Math.sin(t * 2 + i) * 0.8, k2 = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7); g.fillStyle = 'rgba(255,255,255,' + (0.4 + 0.5 * k2) + ')'; ell(g, sx + Math.cos(a2) * rr2, sy + Math.sin(a2) * rr2, 0.5 + 0.45 * k2, 0.5 + 0.45 * k2); g.fill(); }
  }
  var PROPS = { lolly: propLolly, wand: propWand, cane: propCane, rose: propRose };
  OUTFIT.prop = null; OUTFIT.propColor = 'red';
  OUTFIT_ITEMS.wear.push({ id: 'poncho', name: 'ポンチョ' }, { id: 'santa', name: 'サンタのふく' }, { id: 'coat', name: 'コート' });
  OUTFIT_ITEMS.hat.push({ id: 'santahat', name: 'サンタぼうし' }, { id: 'hairbow', name: 'リボン' }, { id: 'halo', name: 'てんしのわっか' });
  OUTFIT_ITEMS.prop = [{ id: 'lolly', name: 'あめ' }, { id: 'wand', name: 'ほしのステッキ' }, { id: 'cane', name: 'クリスマスキャンディ' }, { id: 'rose', name: 'バラ' }];
  function propDraw(g, P, Q, t) { var f = OUTFIT.prop && PROPS[OUTFIT.prop]; if (f) f(g, P, Q, t); }
  // 線の目（ふつう＝縦の短い線、喜び＝∧、ダメージ＝＞＜、まばたき＝横線、やる気＝少し傾いた線）
  function lineEyes(g, P, eyes, expr, look, t, blinkNow) {
    var blink = blinkNow != null ? blinkNow && /^(normal|brave|calm|surprised)$/.test(expr) : expr === 'normal' && (t % 3.4) < 0.12;
    g.strokeStyle = P.playerLine; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 1.25;
    eyes.forEach(function (e, i) {
      var x = e[0] + look[0] * 0.6, y = e[1] + look[1] * 0.6;
      g.lineWidth = 1.25; g.beginPath();
      if (blink) { g.moveTo(x - 1.2, y + 0.4); g.lineTo(x + 1.2, y + 0.4); }
      else if (expr === 'hurt' || expr === 'worried') {   // 困り顔も「いたい」と同じ ＞＜ の目
        var s = i ? -1 : 1; g.moveTo(x - 1.2 * s, y - 1.5); g.lineTo(x + 1 * s, y); g.lineTo(x - 1.2 * s, y + 1.5); }
      else if (expr === 'happy') { g.moveTo(x - 1.4, y + 0.8); g.lineTo(x, y - 0.8); g.lineTo(x + 1.4, y + 0.8); }
      else if (expr === 'surprised') { g.arc(x, y, 1.25, 0, Math.PI * 2); }
      else if (expr === 'sleep') { g.moveTo(x - 1.5, y - 0.2); g.quadraticCurveTo(x, y + 1.4, x + 1.5, y - 0.2); }
      else if (expr === 'squint') { g.moveTo(x - 1.4, y); g.lineTo(x + 1.4, y); }
      else if (expr === 'calm') { g.moveTo(x - 1.4, y - 0.2); g.quadraticCurveTo(x, y - 1.2, x + 1.4, y - 0.2); }
      else if (expr === 'dizzy') { g.lineWidth = 0.9; for (var sa = 0; sa <= 1.001; sa += 0.1) { var ang = sa * Math.PI * 2.6 + t * 8 * (i ? -1 : 1), rad = 0.2 + sa * 1.55; if (sa === 0) g.moveTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad); else g.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad); } }
      
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
    // 体の線の点（頭の丸み＋横）。手が体から離れすぎないように、ここまでに寄せる
    var edge = [], sh0 = o.top + o.shoulder;
    for (var ei = 0; ei <= 40; ei++) { var et = ei / 40, eu = 1 - et;
      var ex = 3 * eu * eu * et * o.half * 0.8 + 3 * eu * et * et * o.half + et * et * et * o.half, ey = eu * eu * eu * o.top + 3 * eu * eu * et * o.top + 3 * eu * et * et * (sh0 - 5) + et * et * et * sh0;
      edge.push([ex, ey], [-ex, ey]); }
    for (var yy = sh0; yy <= o.hemY; yy += 0.5) { var sx0 = o.half + (yy - sh0) / (o.hemY - sh0) * o.flare; edge.push([sx0, yy], [-sx0, yy]); }
    var reach = function (x, y) {   // 体の外にある手は、体の線から o.handGap までに寄せる
      var best = null, bd = 1e9;
      for (var i = 0; i < edge.length; i++) { var d = Math.hypot(edge[i][0] - x, edge[i][1] - y); if (d < bd) { bd = d; best = edge[i]; } }
      var out = Math.abs(x) > Math.abs(best[0]) - 0.01 || y < o.top;
      if (!out || bd <= o.handGap) return [x, y];
      return [best[0] + (x - best[0]) / bd * o.handGap, best[1] + (y - best[1]) / bd * o.handGap];
    };
    return function (g, P, Q, t) {
      Q = Object.assign({}, Q, { hands: Q.hands.map(function (h) { return reach(h[0], h[1]); }) });
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
          var da = t * 5 + di * 2.09, dx = Math.cos(da) * 9, dy = o.top - 3 - (OUTFIT.hat ? 6 : 0) + Math.sin(da) * 2.6, ds = 1.9 + Math.sin(da) * 0.5;
          if (Math.sin(da) < -0.2) continue;   // 頭の向こう側は隠れる
          solid(g, function () { g.beginPath(); for (var k = 0; k < 10; k++) { var r5 = k % 2 ? ds * 0.45 : ds, a5 = -Math.PI / 2 + k * Math.PI / 5; g.lineTo(dx + Math.cos(a5) * r5, dy + Math.sin(a5) * r5); } g.closePath(); }, '#ffffff', P.playerShade, P.playerLine, 0.3, 0.7);
        }
      }
      wearFront(g, P, Q, t, { o: o, sw: sw, wv: wv });   // 着るもの（しましまマフラーは帯と結び目。服は体の線から切り出す）
      hatDraw(g, P, Q, t);     // 頭
      propDraw(g, P, Q, t);    // 小物（口にくわえる・前の手で持つ。前の手は このあとに描くので、持った棒にかぶさる）
      if (o.sleeves) sleeve(g, P, shoulder(Q.hands[1][0]), 0.5, Q.hands[1][0], Q.hands[1][1], 2.1);
      else ghostLimb(g, P, Q.hands[1][0], Q.hands[1][1], o.hand);
    };
  }
  var GHOSTS = {
    sheet: { letter: 'B1', name: 'ふんわり', note: 'プレイヤーに決定。すそが少し広がり、大きな丸い山が3つ。手は小さな丸。',
      draw: sheetGhost(SHEET_O) }   // 形の数値は SHEET_O（服を切り出すときも使う）
  };
  function ghost(g, P, variant, poseId, x, y, t, face, scale) {
    var Q = POSES[poseId], G = GHOSTS[variant]; face = face || 1; scale = scale || 1;
    P = scarfPal(P);
    g.save(); g.translate(x, y); g.scale(face * scale, scale);
    g.rotate(Q.tilt + (poseId === 'air' ? Math.sin(t * 3) * 0.15 : 0)); g.scale(1 - Q.sq * 0.6, 1 + Q.sq);
    wearBack(g, P, Q, t);   // 体の後ろ（マフラーのしっぽ・マント・リボンのはし）
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
  // fuda：操作の札（同じ札の水晶は同時に1つまで。なしは何個でも）
  var GEM_KINDS = {
    greed: { name: '欲ばり', star: 1 }, hover: { name: 'ホバリング', star: 1, fuda: '長押し' }, slide: { name: 'かべすべり', star: 1 },
    bigjump: { name: '大ジャンプ', star: 1 }, fastkick: { name: '速蹴り', star: 1 }, highair: { name: '高い2段ジャンプ', star: 1 },
    dive: { name: '急降下', star: 1, fuda: '下' }, grip: { name: 'ねばり', star: 1 }, longinv: { name: 'ながい無敵', star: 1 }, magnet: { name: '磁石', star: 1 },
    triple: { name: '3段ジャンプ', star: 2 }, predict: { name: '予測線', star: 2 }, charge: { name: '溜め蹴り', star: 2, fuda: '長押し' },
    landjump: { name: '着地ジャンプ', star: 2 }, dash: { name: '横っ飛び', star: 2, fuda: '下' }, interest: { name: '利子', star: 2 },
    turn: { name: '振り向き', star: 3, fuda: '左右' }, brake: { name: 'ブレーキ', star: 3 }
  };
  var GEM_ORDER = ['greed', 'magnet', 'interest', 'hover', 'slide', 'grip', 'bigjump', 'fastkick', 'highair', 'dive', 'longinv', 'triple', 'predict', 'charge', 'landjump', 'dash', 'turn', 'brake'];
  // 操作の札：色（レア度のミント・青・金、赤とはかぶらない）と印。画面は 左・右・下 の3つで、下の帯が特殊ゾーン
  var FUDA = {
    'なし': { color: '#a99fb0', mark: '・', how: '操作しない（いつも効く）' }, '長押し': { color: '#f39bc8', mark: '長', how: '押し続ける' },
    '下': { color: '#f5a56b', mark: '下', how: '画面の下（特殊ゾーン）を押す' },
    '2本指': { color: '#c9e36a', mark: '2', how: '2本の指で押す' }, '左右': { color: '#d9b48c', mark: '◐', how: '画面の左右を押す' }
  };
  function fudaOf(kind) { return (GEM_KINDS[kind] && GEM_KINDS[kind].fuda) || 'なし'; }
  function gemTone(P, star) { return star >= 3 ? [P.gemGold, P.gemGoldShade] : star === 2 ? [P.gemBlue, P.gemBlueShade] : [P.gemMint, P.gemMintShade]; }

  // 結晶：ぼんやりした光＋十字のきらめき＋白い芯。s が 1 以上なら、まわりを小さな粒が回る
  // opt.tw：明るさのゆらぎを決める（本編は段階に分けて絵を使い回す）、opt.noDots：まわりを回る粒を描かない（本編は GPU の点で描く）
  function moteDots(t, s, seed) { var out = []; for (var i = 0; i < 3; i++) { var a = t * (1.6 + i * 0.4) + seed + i * 2.1, r = (6 + i * 1.5) * s; out.push([Math.cos(a) * r, Math.sin(a) * r * 0.7, 0.9 * s, 0.5 + 0.4 * Math.sin(t * 4 + i + seed)]); } return out; }
  function mote(g, P, x, y, t, s, seed, opt) {
    s = s || 1; seed = seed || 0; opt = opt || {};
    var tw = opt.tw != null ? opt.tw : 0.85 + Math.sin(t * 4 + seed * 2) * 0.15, i;
    var gl = g.createRadialGradient(x, y, 0, x, y, 11 * s); gl.addColorStop(0, alpha(P.glow, 0.55 * tw)); gl.addColorStop(0.45, alpha(P.glow, 0.18 * tw)); gl.addColorStop(1, alpha(P.glow, 0));
    g.fillStyle = gl; ell(g, x, y, 11 * s, 11 * s); g.fill();
    var L = (5 + tw * 2.5) * s, wd = 0.9 * s;
    g.fillStyle = 'rgba(255,255,255,' + (0.85 * tw) + ')'; g.beginPath();
    g.moveTo(x, y - L * 1.2); g.quadraticCurveTo(x + wd, y - wd, x + L, y); g.quadraticCurveTo(x + wd, y + wd, x, y + L * 1.2);
    g.quadraticCurveTo(x - wd, y + wd, x - L, y); g.quadraticCurveTo(x - wd, y - wd, x, y - L * 1.2); g.fill();
    g.fillStyle = P.glow; ell(g, x, y, 2.6 * s, 2.6 * s); g.fill();
    g.fillStyle = '#ffffff'; ell(g, x, y, 1.5 * s, 1.5 * s); g.fill();
    if (s >= 1 && !opt.noDots) moteDots(t, s, seed).forEach(function (d) { g.fillStyle = alpha(P.glow, d[3]); ell(g, x + d[0], y + d[1], d[2], d[2]); g.fill(); });
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
    bigjump: function (g) { g.beginPath(); g.moveTo(0, 5); g.lineTo(0, -4.4); g.moveTo(-3.4, -1); g.lineTo(0, -4.6); g.lineTo(3.4, -1); g.stroke(); g.beginPath(); g.moveTo(-3.6, 5); g.lineTo(3.6, 5); g.stroke(); },
    fastkick: function (g) { [-2.6, 1.4].forEach(function (dx) { g.beginPath(); g.moveTo(dx, -3); g.lineTo(dx + 2.8, 0.6); g.lineTo(dx, 4.2); g.stroke(); }); },
    highair: function (g) { g.beginPath(); g.moveTo(-3, -0.6); g.lineTo(0, -3.8); g.lineTo(3, -0.6); g.stroke(); g.beginPath(); g.moveTo(-3.6, 4.4); g.quadraticCurveTo(-3.6, 2, -1.4, 2.4); g.quadraticCurveTo(0, 0.8, 1.6, 2.4); g.quadraticCurveTo(3.8, 2.2, 3.6, 4.4); g.stroke(); },
    dive: function (g) { g.beginPath(); g.moveTo(0, -4.4); g.lineTo(0, 4.4); g.moveTo(-3.4, 1); g.lineTo(0, 4.6); g.lineTo(3.4, 1); g.stroke(); },
    grip: function (g) { g.beginPath(); g.moveTo(-3.4, -4.4); g.lineTo(-3.4, 5); g.stroke(); g.beginPath(); g.arc(-1.2, 0.4, 3.4, -Math.PI / 2, Math.PI / 2); g.stroke(); },
    longinv: function (g) { g.beginPath(); g.moveTo(0, -4.4); g.lineTo(3.6, -2.8); g.quadraticCurveTo(3.6, 3, 0, 5); g.quadraticCurveTo(-3.6, 3, -3.6, -2.8); g.closePath(); g.stroke(); },
    magnet: function (g) { g.beginPath(); g.moveTo(-3.2, -4); g.lineTo(-3.2, 1); g.arc(0, 1, 3.2, Math.PI, 0, true); g.lineTo(3.2, -4); g.stroke(); g.beginPath(); g.moveTo(-4.6, -2.2); g.lineTo(-1.8, -2.2); g.moveTo(1.8, -2.2); g.lineTo(4.6, -2.2); g.stroke(); },
    charge: function (g) { g.beginPath(); g.moveTo(-2.6, 5); g.lineTo(2.6, 3.6); g.lineTo(-2.6, 2.2); g.lineTo(2.6, 0.8); g.stroke(); g.beginPath(); g.moveTo(0, 0.6); g.lineTo(0, -4.4); g.moveTo(-2.6, -2); g.lineTo(0, -4.6); g.lineTo(2.6, -2); g.stroke(); },
    landjump: function (g) { g.beginPath(); g.moveTo(-4, 4.8); g.lineTo(4, 4.8); g.stroke(); g.beginPath(); g.moveTo(-3, 1.2); g.lineTo(0, -1.8); g.lineTo(3, 1.2); g.moveTo(-3, -1.8); g.lineTo(0, -4.8); g.lineTo(3, -1.8); g.stroke(); },
    dash: function (g) { g.beginPath(); g.moveTo(-1.6, 0.6); g.lineTo(4.4, 0.6); g.moveTo(1.4, -2.4); g.lineTo(4.6, 0.6); g.lineTo(1.4, 3.6); g.moveTo(-4.4, -2); g.lineTo(-2.4, -2); g.moveTo(-4.4, 3.2); g.lineTo(-2.4, 3.2); g.stroke(); },
    interest: function (g) { g.beginPath(); g.arc(-0.8, 1.2, 3.4, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(2.6, -4.6); g.lineTo(2.6, -1.4); g.moveTo(1, -3); g.lineTo(4.2, -3); g.stroke(); },
    brake: function (g) { g.beginPath(); g.moveTo(-4.2, 4.4); g.quadraticCurveTo(-2.1, 2.6, 0, 4.4); g.quadraticCurveTo(2.1, 6.2, 4.2, 4.4); g.stroke(); g.beginPath(); g.moveTo(-1.6, -4); g.lineTo(-1.6, 1); g.moveTo(1.6, -4); g.lineTo(1.6, 1); g.stroke(); },
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
    var fu = fudaOf(kind);
    if (fu !== 'なし' && opt.fuda !== false) {   // 操作の札：右上に札の色の丸と印
      var fx = x + r * 0.74, fy = y - r * 0.74;
      g.fillStyle = FUDA[fu].color; ell(g, fx, fy, 4.6, 4.6); g.fill(); g.strokeStyle = alpha(P.uiPanel, 0.9); g.lineWidth = 1; g.stroke();
      g.fillStyle = '#2b2235'; g.font = '800 6.4px ' + (P.font || 'system-ui, sans-serif'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(FUDA[fu].mark, fx, fy + 0.3);
    }
  }

  function glowAt(g, P, x, y, r, a, color) { var gl = g.createRadialGradient(x, y, 1, x, y, r); gl.addColorStop(0, alpha(color || P.glow, a)); gl.addColorStop(1, alpha(color || P.glow, 0)); g.fillStyle = gl; ell(g, x, y, r, r); g.fill(); }
  // ガチャ所（案D「ランタン塔」）：細い土の塔のてっぺんがガラスの灯りで、中を結晶が回る。(x, y) は床の真ん中。lit=false で使ったあと（灯りが消える）
  // noMotes：ガラスの中の4つの粒を描かない（本編は GPU の点で描く。houseMotes で位置）
  function houseMotes(x, y, t) { var out = []; for (var i = 0; i < 4; i++) { var a = t * 1.5 + i * 1.6; out.push([x + Math.cos(a) * 5, y - 40 + Math.sin(a) * 2.5]); } return out; }
  function gachaHouse(g, P, x, y, t, lit, noMotes) {
    var top = y - 30, i;
    g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
    if (lit) glowAt(g, P, x, top - 12, 38, 0.3 + Math.sin(t * 2) * 0.04);
    solid(g, function () { g.beginPath(); g.moveTo(x - 13, y); g.lineTo(x - 10, top); g.lineTo(x + 10, top); g.lineTo(x + 13, y); g.closePath(); }, P.terrainLight, P.terrainShade, P.ink, 1.4, 1.1);
    g.fillStyle = alpha(P.terrainShade, 0.55); for (i = 1; i < 4; i++) g.fillRect(x - 11.5 + i * 0.4, top + i * 7.5, 23 - i * 0.8, 1);   // 石の段
    solid(g, function () { g.beginPath(); g.moveTo(x - 4.5, y); g.lineTo(x - 4.5, y - 8); g.arc(x, y - 8, 4.5, Math.PI, 0); g.lineTo(x + 4.5, y); g.closePath(); }, P.metal, P.metalShade, P.ink, 0.6, 0.9);   // 扉
    g.fillStyle = lit ? P.glow : P.metalLight; ell(g, x + 2.4, y - 5, 0.8, 0.8); g.fill();
    solid(g, function () { rr(g, x - 14, top - 3, 28, 4, 2); }, P.metal, P.metalShade, P.ink, 0.6, 1);   // 手すり
    g.fillStyle = lit ? alpha(P.glow, 0.45) : alpha(P.uiPanel, 0.8); rr(g, x - 9, top - 17, 18, 14, 3); g.fill();   // ガラスの灯り
    if (lit && !noMotes) houseMotes(x, y, t).forEach(function (m, j) { mote(g, P, m[0], m[1], t, 0.32, j); });
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
    var gg = g.createRadialGradient(-6, -8, 2, 0, -2, 30); gg.addColorStop(0, alpha(mixHex(liq, '#ffffff', 0.7), 0.22)); gg.addColorStop(1, alpha(P.uiInk, 0.06));
    body(); g.fillStyle = gg; g.fill();   // ガラス（中の光が映る）
    g.save(); body(); g.clip();
    var lv = -6 - spin * 2, wv = function (xx) { return lv + Math.sin(xx * 0.25 + t * (3 + spin * 8)) * (1 + spin * 2.5); }, xx;
    g.beginPath(); g.moveTo(-32, 20); for (xx = -32; xx <= 32; xx += 2) g.lineTo(xx, wv(xx)); g.lineTo(32, 20); g.closePath();
    var lg = g.createLinearGradient(0, lv - 4, 0, 16); lg.addColorStop(0, alpha(mixHex(liq, '#ffffff', 0.35), 0.85)); lg.addColorStop(0.5, alpha(liq, 0.72)); lg.addColorStop(1, alpha(mixHex(liq, '#000000', 0.35), 0.85)); g.fillStyle = lg; g.fill();   // 光の液
    g.globalCompositeOperation = 'lighter'; glowAt(g, P, Math.sin(t * 1.3) * 4, 4, 16 + spin * 6, 0.35 + spin * 0.35, mix(liq, '#ffffff', 0.4)); g.globalCompositeOperation = 'source-over';
    g.fillStyle = alpha(mixHex(liq, '#000000', 0.5), 0.35); g.beginPath(); g.moveTo(10, 15); g.bezierCurveTo(28, 10, 30, -14, 16, -20); g.bezierCurveTo(24, -6, 22, 8, 8, 15); g.closePath(); g.fill();   // 右の奥の影
    g.beginPath(); for (xx = -32; xx <= 32; xx += 2) g.lineTo(xx, wv(xx)); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.2; g.stroke();
    for (i = 0; i < 6 + spin * 8; i++) { var k = (t * (0.6 + spin * 1.6) + i * 0.29) % 1; g.strokeStyle = 'rgba(255,255,255,' + (0.7 * (1 - k)) + ')'; g.lineWidth = 0.9; ell(g, -14 + ((i * 11) % 28), 12 - k * (18 + spin * 4), 1.2 + k, 1.2 + k); g.stroke(); }   // 泡
    for (i = 0; i < 3; i++) { var a2 = t * (0.8 + spin * 3) + i * 2.1; mote(g, P, Math.cos(a2) * 10, 2 + Math.sin(a2) * 5, t, 0.4, i); }   // 中の結晶
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2.2; g.beginPath(); g.arc(0, -4, 18, Math.PI * 1.08, Math.PI * 1.38); g.stroke();   // ガラスの光
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, -4, 15.5, Math.PI * 0.72, Math.PI * 0.9); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-3.6, -38); g.lineTo(-3.6, -27); g.stroke();   // 首の光
    g.fillStyle = 'rgba(255,255,255,.8)'; ell(g, 10, -12, 1.7, 1.7); g.fill(); twinkle(g, -11, -10, 2.6 + Math.sin(t * 2.5) * 1, 0.7);
    g.strokeStyle = alpha(mixHex(liq, '#ffffff', 0.5), 0.55); g.lineWidth = 3; body(); g.stroke();   // ふちに液の色が映る
    g.strokeStyle = P.ink; g.lineWidth = 1.5; body(); g.stroke();
    solid(g, function () { rr(g, -8, -46, 16, 7, 2); }, P.terrainShade, P.terrainDeep, P.ink, 0.6, 1);   // 栓
    if (spin > 0.2) for (i = 0; i < 3; i++) { var sk = (t * (0.5 + spin) + i / 3) % 1; g.fillStyle = alpha(P.uiInk, 0.3 * spin * (1 - sk)); ell(g, Math.sin(sk * 6 + i) * 4, -50 - sk * 30, 3 + sk * 6, 3 + sk * 6); g.fill(); }   // 湯気
    g.restore();
  }
  // 出た水晶のまわりの光（レア度の色。光なので縁取らない）。k は 0→1 で広がる
  // 細くとがった光の筋が長短交互にゆっくり回り、まわりに光の輪と粒。重ねがけ（lighter）で明るくする
  /* ---------- ろうそく（着せ替えガチャの通貨）：白いろうに、たれ・芯・あたたかい火 ---------- */
  var CANDLE = { wax: '#fff3df', waxShade: '#e4cba6', flame: '#ffcb52', flameOut: '#ff9d3a' };
  function candle(g, P, x, y, s, t, lit) {
    s = s || 1; g.save(); g.translate(x, y); g.scale(s, s); g.lineJoin = 'round'; g.lineCap = 'round';
    if (lit !== false) {   // 火：外はだいだい、芯は白。ゆらゆら
      var fk = Math.sin(t * 9) * 0.6 + Math.sin(t * 23) * 0.3, fh = -15 - Math.sin(t * 7) * 1.2;
      g.globalCompositeOperation = 'lighter'; var gg = g.createRadialGradient(0, -11, 0, 0, -11, 9); gg.addColorStop(0, alpha(CANDLE.flame, 0.5)); gg.addColorStop(1, alpha(CANDLE.flame, 0));
      g.fillStyle = gg; g.fillRect(-10, -21, 20, 20); g.globalCompositeOperation = 'source-over';
      g.fillStyle = CANDLE.flameOut; g.beginPath(); g.moveTo(-2.6, -7.5); g.quadraticCurveTo(-2.8 + fk * 0.4, -12, fk, fh); g.quadraticCurveTo(2.9 + fk * 0.4, -12, 2.6, -7.5); g.quadraticCurveTo(0, -5.6, -2.6, -7.5); g.fill();
      g.fillStyle = CANDLE.flame; g.beginPath(); g.moveTo(-1.6, -7.6); g.quadraticCurveTo(-1.6 + fk * 0.3, -10.5, fk * 0.7, fh + 3); g.quadraticCurveTo(1.7 + fk * 0.3, -10.5, 1.6, -7.6); g.quadraticCurveTo(0, -6.6, -1.6, -7.6); g.fill();
      g.fillStyle = 'rgba(255,255,255,.9)'; ell(g, fk * 0.25, -8.6, 0.8, 1.4); g.fill();
    }
    g.strokeStyle = P.ink; g.lineWidth = 0.9; g.beginPath(); g.moveTo(0, -4.6); g.lineTo(0, -7); g.stroke();   // 芯
    var body = function () { g.beginPath(); g.moveTo(-4, -4); g.quadraticCurveTo(0, -5.4, 4, -4); g.lineTo(4, 8); g.quadraticCurveTo(0, 9.2, -4, 8); g.closePath(); };
    solid(g, body, CANDLE.wax, CANDLE.waxShade, P.ink, 1.3, 0.9);
    solid(g, function () { g.beginPath(); g.moveTo(-4, -4); g.quadraticCurveTo(0, -5.4, 4, -4); g.lineTo(4, -2.4); g.quadraticCurveTo(3.2, 1.6, 2.4, -1.6); g.quadraticCurveTo(0.6, -2.6, -0.8, -1.8); g.quadraticCurveTo(-1.6, 2.4, -2.6, -1.4); g.quadraticCurveTo(-3.4, -2, -4, -2.2); g.closePath(); }, '#ffffff', CANDLE.wax, null, 0.6);   // たれ
    g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(-2.6, 0, 1, 6);
    g.restore();
  }
  /* ---------- 着せ替えガチャの石灯籠：ろうそくを入れると窓の火が光り、色がレア度を予告する（spin：0〜1 の盛り上がり、liquid：火の色） ---------- */
  function gachaLantern(g, P, x, y, t, spin, liquid, noGlow) {   // noGlow：まわりの光のぼかしを描かない（小さなアイコン用）
    spin = spin || 0; var liq = liquid || CANDLE.flame, sh = spin > 0.3 ? Math.sin(t * 30) * spin * 1.1 : 0;
    var stone = P.metal, stoneS = P.metalShade, ink = P.ink;
    g.save(); g.translate(x + sh, y); g.lineJoin = 'round'; g.lineCap = 'round';
    if (!noGlow) { g.globalCompositeOperation = 'lighter'; glowAt(g, P, 0, -8, 70, 0.25 + spin * 0.35, liq); g.globalCompositeOperation = 'source-over'; }
    solid(g, function () { rr(g, -24, 34, 48, 8, 3); }, stone, stoneS, ink, 0.9, 1.1);   // 台
    solid(g, function () { g.beginPath(); g.moveTo(-8, 34); g.lineTo(-6, 16); g.lineTo(6, 16); g.lineTo(8, 34); g.closePath(); }, stone, stoneS, ink, 0.9, 1.1);   // 柱
    solid(g, function () { rr(g, -20, 10, 40, 7, 2.5); }, stone, stoneS, ink, 0.9, 1.1);   // 受け
    // 火袋：四角い箱。窓から中の火が見える
    solid(g, function () { rr(g, -16, -20, 32, 31, 2); }, stone, stoneS, ink, 0.9, 1.1);
    var win = function () { rr(g, -10, -15, 20, 21, 1.5); };
    g.save(); win(); g.clip();
    var wg = g.createLinearGradient(0, -15, 0, 6); wg.addColorStop(0, mixHex(liq, '#ffffff', 0.55)); wg.addColorStop(1, mixHex(liq, '#000000', 0.25));
    g.fillStyle = wg; g.fillRect(-10, -15, 20, 21);
    for (var i = 0; i < 3; i++) {   // 中のろうそくの火
      var fx = -5 + i * 5, fk = Math.sin(t * (9 + spin * 10) + i * 2) * (0.8 + spin), fh = -6 - spin * 4 - (i === 1 ? 2 : 0) + Math.sin(t * 13 + i) * 1.2;
      g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.moveTo(fx - 1.6, 4); g.quadraticCurveTo(fx + fk, fh, fx + 1.6, 4); g.closePath(); g.fill();
    }
    g.globalCompositeOperation = 'lighter'; glowAt(g, P, 0, -2, 16 + spin * 8, 0.4 + spin * 0.4, mix(liq, '#ffffff', 0.5)); g.globalCompositeOperation = 'source-over';
    g.restore();
    g.strokeStyle = ink; g.lineWidth = 1.6; win(); g.stroke();
    g.strokeStyle = alpha(stoneS, 0.9); g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, -15); g.lineTo(0, 6); g.moveTo(-10, -4.5); g.lineTo(10, -4.5); g.stroke();   // 窓の格子
    // 屋根：反った笠と宝珠
    solid(g, function () { g.beginPath(); g.moveTo(-27, -20); g.quadraticCurveTo(-18, -24, -10, -33); g.lineTo(10, -33); g.quadraticCurveTo(18, -24, 27, -20); g.quadraticCurveTo(0, -17, -27, -20); g.closePath(); }, stone, stoneS, ink, 1, 1.1);
    solid(g, function () { ell(g, 0, -37, 4.5, 4.8); }, stone, stoneS, ink, 0.7, 1);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(-14, -18, 3, 27); g.fillRect(-22, 35.5, 30, 2);
    g.restore();
  }
  /* ---------- マフラーの品物アイコン（着せ替え・ガチャ）：首の帯としっぽ。colorId の色で描く ---------- */
  function scarfItem(g, P, x, y, s, t, colorId) {
    var keep = SCARF.color, sag0 = SCARF.sag; if (colorId) SCARF.color = colorId;
    SCARF.sag = 3.6;   // 体が無いので、輪を少し上から見た形にする
    var Q = scarfPal(P), R = SCARF.wrapW / 2, cy = SCARF.wrapY - 2;
    g.save(); g.translate(x, y); g.scale(s, s); g.lineCap = 'round';
    // 輪の後ろ側（裏の色）
    g.strokeStyle = P.playerLine; g.lineWidth = SCARF.wrapH + 2; g.beginPath(); g.ellipse(0, cy, R, SCARF.sag, 0, Math.PI, Math.PI * 2); g.stroke();
    g.strokeStyle = Q.scarfShade; g.lineWidth = SCARF.wrapH; g.beginPath(); g.ellipse(0, cy, R, SCARF.sag, 0, Math.PI, Math.PI * 2); g.stroke();
    scarfTail(g, Q, [[-4, -1], [-5, 5], [-5.5, 11], [-5, 17], [-4, 23]], t);   // しっぽは下へたれる
    scarfWrap(g, Q, 0, cy); g.restore();
    SCARF.color = keep; SCARF.sag = sag0;
  }
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
    pal: pal, mix: mix, alpha: alpha, hash: hash, mixHex: mixHex, moteDots: moteDots, houseMotes: houseMotes, STAGES: STAGES, stagePal: stagePal, blendPal: blendPal, motifOf: motifOf,
    rr: rr, ell: ell, solid: solid, shine: shine, spline: spline,
    grid: grid, background: background, bgStrata: bgStrata, bgFar: bgFar, bgMid: bgMid, midHaze: midHaze, midProps: midProps, midSpins: midSpins, midBlades: midBlades, MID_K: MID_K, bgDust: bgDust, grassBlades: grassBlades, LIVE: LIVE, smooth: smooth, block: block, slope: slope, lip: lip, hang: hang, decor: decor, spike: spike, terrain: terrain,
    slide: slide, cycleState: cycleState, popState: popState, popSpike: popSpike, ironBox: ironBox, track: track,
    spinAngle: spinAngle, spinner: spinner, pendAngle: pendAngle, pendulum: pendulum, cannon: cannon, cannonBall: cannonBall, stakeState: stakeState, stake: stake,
    bridgeState: bridgeState, bridge: bridge, spring: spring, crumble: crumble, crumbleCell: crumbleCell, shutterState: shutterState, shutter: shutter, fan: fan, fanStreaks: fanStreaks, fanBody: fanBody, fanBlade: fanBlade, fanBolt: fanBolt, FAN_BAND: FAN_BAND,
    rise: rise, riseCrusts: riseCrusts, riseCrust: riseCrust, ghost: ghost, SCARF: SCARF, SCARF_DEF: SCARF_DEF, SCARF_COLORS: SCARF_COLORS, scarfPal: scarfPal, scarfTail: scarfTail, scarfWrap: scarfWrap, lineEyes: lineEyes,
    OUTFIT: OUTFIT, OUTFIT_COLORS: OUTFIT_COLORS, OUTFIT_ITEMS: OUTFIT_ITEMS, HAT_TOP: HAT_TOP, hatPal: hatPal, wearBack: wearBack, wearFront: wearFront, hatDraw: hatDraw, propDraw: propDraw, MOUTH_AIM: MOUTH_AIM, outfitIcon: outfitIcon, outfitGet: outfitGet, withOutfit: withOutfit,
    effects: effects, heart: heart, hud: hud,
    GEM_KINDS: GEM_KINDS, GEM_ORDER: GEM_ORDER, FUDA: FUDA, fudaOf: fudaOf, gemTone: gemTone, mote: mote, gem: gem, gemBadge: gemBadge, gachaHouse: gachaHouse, gachaFlask: gachaFlask, cloudPlat: cloudPlat, mine: mine, spikeBlock: spikeBlock, railPath: railPath, windmill: windmill, lightningRod: lightningRod, electrode: electrode, jellyBlock: jellyBlock, gravStar: gravStar, spikeStar: spikeStar, satellite: satellite, floatRock: floatRock, pulseEmitter: pulseEmitter, heatPanel: heatPanel, senseMine: senseMine, dashRing: dashRing, lightningBolt: lightningBolt, gustVent: gustVent, gachaLantern: gachaLantern, candle: candle, CANDLE: CANDLE, scarfItem: scarfItem, gemBurst: gemBurst, twinkle: twinkle,
    canvas: canvas, animate: animate, zoneRow: zoneRow, ghostSheet: ghostSheet
  };
})();
