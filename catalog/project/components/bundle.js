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
    'terrain-line', 'terrain-grain', 'accent', 'accent-shade', 'glow', 'ink', 'enemy', 'enemy-shade', 'enemy-light',
    'rise', 'rise-light', 'rise-top', 'ui-ink', 'ui-muted', 'ui-panel', 'player-body', 'player-shade', 'player-line',
    'player-cheek', 'scarf', 'scarf-shade', 'scarf-stripe', 'hazard', 'hazard-shade', 'hazard-light'];
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
    underground: { grain: 'pebble', lip: 'moss', under: 'root', decor: 'mushroom', far: 'stalactite', enemy: 'machine', rise: 'lava' },
    surface: { grain: 'stone', lip: 'grass', under: 'root', decor: 'flower', far: 'hill', enemy: 'bird', rise: 'mud' },
    sky: { grain: 'puff', lip: 'cloud', under: 'mist', decor: 'sprout', far: 'cloud', enemy: 'thunder', rise: 'storm' },
    space: { grain: 'crater', lip: 'dust', under: 'crystal', decor: 'crystal', far: 'planet', enemy: 'jelly', rise: 'void' }
  };

  /* ---------- 背景：帯2枚＋遠景＋ただよう粒 ---------- */
  function background(g, P, x, y, w, h, t, scroll) {
    scroll = scroll || 0;
    var gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, P.bgTop); gr.addColorStop(1, P.bgBottom);
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    var m = MOTIF[P.id] || MOTIF.underground, bh = 46, off = scroll * 0.5;
    // 帯の番号は画面ではなく世界で数える（スクロールしても色と形が入れ替わらない）
    for (var i = Math.floor(off / bh) - 1; i * bh - off < h + bh; i++) {
      var yy = y + i * bh - off; g.fillStyle = (i & 1) ? P.strataA : P.strataB;
      g.beginPath(); g.moveTo(x, yy + bh + 6);
      for (var xx = 0; xx <= w; xx += 24) g.lineTo(x + xx, yy + Math.sin(xx * 0.04 + i * 1.7) * (m.far === 'cloud' ? 6 : 4));
      g.lineTo(x + w, yy + bh + 6); g.closePath(); g.fill();
    }
    g.fillStyle = P.far;
    for (var j = 0; j < Math.ceil(w / 70) + 1; j++) {
      var sx = x + j * 70 + hash(j, 1) * 30, sw = 14 + hash(j, 2) * 18, sh = 26 + hash(j, 3) * 40;
      if (m.far === 'stalactite') {
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
    g.fillStyle = P.uiInk;
    var n = Math.floor(w * h / 900);
    for (var k = 0; k < n; k++) {
      g.globalAlpha = (m.far === 'planet' ? 0.25 : 0.05) + hash(k, 9) * (m.far === 'planet' ? 0.4 : 0.08);
      var px = x + hash(k, 5) * w, pyy = y + ((hash(k, 6) * h - t * 5 * (1 + hash(k, 7)) * (m.far === 'planet' ? 0.2 : 1)) % h + h) % h, s = 0.7 + hash(k, 8);
      ell(g, px, pyy, s, s); g.fill();
    }
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
    var m = MOTIF[P.id] || MOTIF.underground;
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
    var m = MOTIF[P.id] || MOTIF.underground, i;
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
    var m = MOTIF[P.id] || MOTIF.underground, sw = (hash(s, 1) - 0.5) * 6;
    if (m.under === 'root') {
      g.beginPath(); g.moveTo(x - 1.6, y); g.quadraticCurveTo(x + sw - 1, y + len * 0.5, x + sw * 0.4, y + len); g.quadraticCurveTo(x + sw + 1, y + len * 0.5, x + 1.6, y); g.closePath();
      g.fillStyle = P.terrainShade; g.fill();
      g.strokeStyle = P.terrainLine; g.lineWidth = 0.9; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + sw * 0.45, y + len * 0.45); g.quadraticCurveTo(x + sw * 0.5 + 3, y + len * 0.5, x + sw * 0.5 + 4.5, y + len * 0.68); g.stroke();
      if (hash(s, 2) > 0.5) { g.fillStyle = P.accent; ell(g, x + sw * 0.5 + 5, y + len * 0.7, 1.8, 1, 0.8); g.fill(); }
    } else if (m.under === 'mist') {
      g.fillStyle = alpha('#ffffff', 0.35); for (var i = 0; i < 3; i++) { ell(g, x + sw * i * 0.2, y + 2 + i * len * 0.3, 3 - i * 0.6, 2 - i * 0.4); g.fill(); }
    } else if (m.under === 'crystal') {
      solid(g, function () { g.beginPath(); g.moveTo(x - 2, y); g.lineTo(x, y + len * 0.6); g.lineTo(x + 2, y); g.closePath(); }, P.accent, P.accentShade, null, 0.6);
    }
  }
  function decor(g, P, x, y, s, t, seed) {   // 上の面の飾り（光るもの）
    var m = MOTIF[P.id] || MOTIF.underground, pulse = 0.85 + Math.sin(t * 2 + seed) * 0.15;
    var gl = g.createRadialGradient(x, y - 5 * s, 1, x, y - 5 * s, 15 * s); gl.addColorStop(0, alpha(P.glow, 0.32 * pulse)); gl.addColorStop(1, alpha(P.glow, 0));
    g.fillStyle = gl; ell(g, x, y - 5 * s, 15 * s, 15 * s); g.fill();
    if (m.decor === 'mushroom') {
      solid(g, function () { g.beginPath(); g.moveTo(x - 1.4 * s, y); g.quadraticCurveTo(x - 1.8 * s, y - 3 * s, x - 1 * s, y - 5 * s); g.lineTo(x + 1 * s, y - 5 * s); g.quadraticCurveTo(x + 1.8 * s, y - 3 * s, x + 1.4 * s, y); g.closePath(); }, P.terrainLight, P.terrainShade, null, 0.3 * s);
      solid(g, function () { g.beginPath(); g.moveTo(x - 5 * s, y - 4.4 * s); g.bezierCurveTo(x - 5 * s, y - 9.5 * s, x + 5 * s, y - 9.5 * s, x + 5 * s, y - 4.4 * s); g.quadraticCurveTo(x, y - 3.2 * s, x - 5 * s, y - 4.4 * s); g.closePath(); }, P.glow, mix(P.glow, '#000000', 0.25), null, 0.7 * s);
      g.fillStyle = 'rgba(255,255,255,.8)'; ell(g, x - 2 * s, y - 7 * s, 0.9 * s, 0.7 * s); g.fill();
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
    [1, 9].forEach(function (ty) {
      solid(g, function () { g.beginPath(); g.moveTo(2.5, ty); g.lineTo(14, ty + 3.6); g.quadraticCurveTo(15.2, ty + 4, 14, ty + 4.4); g.lineTo(2.5, ty + 8); g.closePath(); }, P.hazard, P.hazardShade, P.ink, 0.9, 0.85);
      g.fillStyle = P.hazardLight; g.beginPath(); g.moveTo(3.5, ty + 1.2); g.lineTo(12, ty + 3.6); g.lineTo(3.5, ty + 3.4); g.closePath(); g.fill();
    });
    g.restore();
  }
  function terrain(g, P, G, t, ox, oy) {
    ox = ox || 0; oy = oy || 0; var r, c, k;
    for (r = 0; r < G.rows; r++) for (c = 0; c < G.cols; c++) { k = G.tile(c, r); if (k === '#') block(g, P, G, c, r, ox + c * CELL, oy + r * CELL); else if (k.length === 2) slope(g, P, ox + c * CELL, oy + r * CELL, k); }
    for (r = 0; r < G.rows; r++) for (c = 0; c < G.cols; c++) {
      if (G.tile(c, r) !== '#') continue; var e = G.exp(c, r), x = ox + c * CELL, y = oy + r * CELL;
      if (e.t) { lip(g, P, x, y, c, r); if (hash(c, r, 12) < 0.25) decor(g, P, x + 5 + hash(c, r, 13) * 8, y - 0.5, 1, t, c + r); }
      if (e.b && hash(c, r, 17) < 0.45) hang(g, P, x + 4 + hash(c, r, 18) * 10, y + CELL - 1, 7 + hash(c, r, 19) * 12, c * 31 + r);
    }
    for (r = 0; r < G.rows; r++) for (c = 0; c < G.cols; c++) if (G.raw(c, r) === '^') spike(g, P, ox + c * CELL, oy + r * CELL, G.spikeDir(c, r));
  }

  /* ---------- 敵：丸い体・縁取り・2段の影・白目と黒目（プレイヤーの線の目と区別） ----------
     地下＝顔のない4種類（トゲ鉄球・回転ノコ・掘削ドリル・火の玉）、地上＝ころ鳥、上空＝もくもく（雷雲）、宇宙＝かさクラゲ。
     生き物は羽が肩から回り、体は羽ばたきに合わせて上下する。尾・触手は少し遅れてついてくる。 */
  // 白目と黒目。目のふちは ink。blink 1 で閉じる
  function enemyEyes(g, P, x, y, look, s, gap, blink) {
    s = s || 1; gap = gap == null ? 2.4 : gap;
    [-gap, gap].forEach(function (ex) {
      var cx = x + ex;
      if (blink) { g.strokeStyle = P.ink; g.lineWidth = 0.9; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - 1.5 * s, y + 0.2 * s); g.quadraticCurveTo(cx, y + 1.2 * s, cx + 1.5 * s, y + 0.2 * s); g.stroke(); return; }
      g.fillStyle = P.ink; ell(g, cx, y, 2.15 * s, 2.35 * s); g.fill();
      g.fillStyle = '#ffffff'; ell(g, cx, y, 1.7 * s, 1.9 * s); g.fill();
      g.fillStyle = P.ink; ell(g, cx + look * 0.55 * s, y + 0.25 * s, 1 * s, 1.2 * s); g.fill();
      g.fillStyle = '#ffffff'; ell(g, cx + look * 0.55 * s - 0.35 * s, y - 0.25 * s, 0.38 * s, 0.38 * s); g.fill();
    });
  }
  function eBody(g, P, path, off) { solid(g, path, P.enemy, P.enemyShade, P.ink, off == null ? 1.2 : off, 1.0); }
  function eSoft(g, P, path, off) { solid(g, path, P.enemyLight, P.enemyShade, P.ink, off == null ? 0.7 : off, 0.9); }
  function eGlow(g, P, path) { solid(g, path, P.glow, mix(P.glow, '#000000', 0.25), P.ink, 0.5, 0.85); }
  function blinkAt(t, seed) { return ((t + seed) % 3.7 + 3.7) % 3.7 < 0.12; }
  function innerLine(g, color) { g.strokeStyle = color; g.lineWidth = 0.7; g.lineCap = 'round'; }
  // 部品の形を回して置く（左右は x を反転するだけ。影の向きは左上のまま）
  function xf(sx, ox, oy, a, k) { var c = Math.cos(a), s = Math.sin(a); k = k || 1; return function (p) { var x = p[0] * k, y = p[1]; return [ox + sx * (x * c - y * s), oy + x * s + y * c]; }; }
  function shapePath(g, cmds, T, open) {
    g.beginPath();
    cmds.forEach(function (c) { var a = T(c[1]); if (c[0] === 'M') g.moveTo(a[0], a[1]); else if (c[0] === 'L') g.lineTo(a[0], a[1]); else { var b = T(c[2]); g.quadraticCurveTo(a[0], a[1], b[0], b[1]); } });
    if (!open) g.closePath();
  }

  // 地下：顔のない4種類。本体は鉄（enemy の色）、触れると痛い所（トゲ・刃・ドリルの先）は hazard。火の玉は溶岩（rise）の色
  function metal(g, P, path, off) { solid(g, path, P.enemy, P.enemyShade, P.ink, off == null ? 1.1 : off, 1.0); }
  function hzPart(g, P, path, off) { solid(g, path, P.hazard, P.hazardShade, P.ink, off == null ? 0.6 : off, 0.9); }
  var UNDER = {
    ball: function (g, P, t, dir) {   // トゲ鉄球：転がりながら飛ぶ。トゲ8本が回る
      var rot = t * dir * 2.4, i, PI = Math.PI;
      for (i = 0; i < 8; i++) (function (a) {
        var cx = Math.cos(a), cy = Math.sin(a);
        hzPart(g, P, function () { g.beginPath(); g.moveTo(cx * 5.4 - cy * 1.8, cy * 5.4 + cx * 1.8); g.lineTo(cx * 10.2, cy * 10.2); g.lineTo(cx * 5.4 + cy * 1.8, cy * 5.4 - cx * 1.8); g.closePath(); }, 0.4);
      })(rot + i * PI / 4);
      var ball = function () { ell(g, 0, 0, 6.8, 6.8); };
      metal(g, P, ball, 1.3);
      g.save(); ball(); g.clip(); innerLine(g, P.enemyShade); g.beginPath(); g.ellipse(0, 0, 6.8, 2.4, rot, 0, PI * 2); g.stroke(); g.restore();
      [0, PI].forEach(function (o) {
        var x = Math.cos(rot + o) * 6.8, y = Math.sin(rot + o) * 2.4, c = Math.cos(rot), s = Math.sin(rot), px = x * c - y * s, py = x * s + y * c;
        if (Math.hypot(px, py) < 6) { g.fillStyle = P.enemyShade; ell(g, px + 0.3, py + 0.3, 1.1, 1.1); g.fill(); g.fillStyle = P.enemyLight; ell(g, px, py, 0.8, 0.8); g.fill(); }
      });
      shine(g, -2.8, -3, 2, 1.1, 0.6);
    },
    saw: function (g, P, t, dir) {   // 回転ノコ：レールに沿って行き来する。刃のふちが危険の色
      var rot = t * dir * 9, n = 12, st = Math.PI * 2 / n;
      hzPart(g, P, function () { g.beginPath(); for (var i = 0; i < n; i++) { var a = rot + i * st; g.lineTo(Math.cos(a) * 7.2, Math.sin(a) * 7.2); g.lineTo(Math.cos(a + st * 0.7) * 9.8, Math.sin(a + st * 0.7) * 9.8); } g.closePath(); }, 0.5);
      innerLine(g, P.hazardLight); g.beginPath(); g.arc(0, 0, 7.6, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
      metal(g, P, function () { ell(g, 0, 0, 5.6, 5.6); }, 0.9);
      for (var j = 0; j < 3; j++) { var a2 = rot + j * Math.PI * 2 / 3; g.fillStyle = P.enemyShade; ell(g, Math.cos(a2) * 3.4, Math.sin(a2) * 3.4, 1.1, 1.1); g.fill(); }
      solid(g, function () { ell(g, 0, 0, 1.7, 1.7); }, P.enemyLight, P.enemyShade, P.ink, 0.4, 0.8);
      shine(g, -2.4, -2.6, 1.5, 0.8, 0.6);
    },
    drill: function (g, P, t, dir) {   // 掘削ドリル：進む向きにドリルの先が回る。上に小さなランプ
      var L = function (x) { return x * dir; }, sp = (t * 10) % 3;
      [-1, 1].forEach(function (s) { metal(g, P, function () { g.beginPath(); g.moveTo(L(-6), s * 3.6); g.quadraticCurveTo(L(-9.6), s * 5.4, L(-10.4), s * 7.2); g.quadraticCurveTo(L(-7), s * 6.6, L(-3.6), s * 3.6); g.closePath(); }, 0.4); });
      metal(g, P, function () { rr(g, dir > 0 ? -9 : -2, -5, 11, 10, 4.5); }, 1.1);
      innerLine(g, P.enemyShade); g.beginPath(); g.moveTo(L(-5.6), -4.6); g.lineTo(L(-5.6), 4.6); g.stroke();
      shine(g, L(-5) - 1, -2.6, 1.8, 0.9, 0.6);
      var bit = function () { g.beginPath(); g.moveTo(L(3), -4.6); g.quadraticCurveTo(L(9), -2.4, L(12.6), 0); g.quadraticCurveTo(L(9), 2.4, L(3), 4.6); g.closePath(); };
      hzPart(g, P, bit, 0.6);
      g.save(); bit(); g.clip(); g.strokeStyle = P.hazardShade; g.lineWidth = 1.1;
      for (var x = -3; x < 12; x += 3) { var xx = x + sp; g.beginPath(); g.moveTo(L(xx), -5); g.lineTo(L(xx + 2.2), 5); g.stroke(); } g.restore();
      solid(g, function () { rr(g, dir > 0 ? 1.4 : -3.4, -5.4, 2, 10.8, 1); }, P.enemyLight, P.enemyShade, P.ink, 0.4, 0.8);
      var lx = L(-4), ly = -6.2, gl = g.createRadialGradient(lx, ly, 0.5, lx, ly, 6); gl.addColorStop(0, alpha(P.glow, 0.45 * (0.85 + Math.sin(t * 2) * 0.15))); gl.addColorStop(1, alpha(P.glow, 0));
      g.fillStyle = gl; ell(g, lx, ly, 6, 6); g.fill();
      solid(g, function () { g.beginPath(); g.arc(lx, ly + 0.8, 1.8, Math.PI, 0); g.closePath(); }, P.glow, mix(P.glow, '#000000', 0.25), P.ink, 0.3, 0.8);
    },
    fire: function (g, P, t, dir) {   // 火の玉：溶岩から飛び出した火のかたまり。炎のしっぽがゆらぐ
      var L = function (x) { return x * dir; }, f = function (k) { return Math.sin(t * 9 + k) * 1.2; }, PI = Math.PI;
      var gl = g.createRadialGradient(0, 0, 1, 0, 0, 15); gl.addColorStop(0, alpha(P.riseLight, 0.4)); gl.addColorStop(1, alpha(P.riseLight, 0)); g.fillStyle = gl; ell(g, 0, 0, 15, 15); g.fill();
      for (var i = 0; i < 3; i++) { var k = (t * 1.8 + i / 3) % 1; g.fillStyle = alpha(P.riseTop, 1 - k); ell(g, L(-8 - k * 12), (i - 1) * 3 + Math.sin(t * 5 + i) * 1.5, 1.2 * (1 - k * 0.5), 1.2 * (1 - k * 0.5)); g.fill(); }
      var flame = function () { g.beginPath(); g.moveTo(L(2), -6.4); g.quadraticCurveTo(L(-4), -7.8, L(-12) + f(0), -7.4 + f(1)); g.quadraticCurveTo(L(-8.4), -4.2, L(-6.6), -2.6); g.quadraticCurveTo(L(-11), -2.4, L(-16.5) + f(2), f(3) * 0.6); g.quadraticCurveTo(L(-11), 2.4, L(-6.6), 2.6); g.quadraticCurveTo(L(-8.4), 4.2, L(-12) + f(4), 7.4 + f(5)); g.quadraticCurveTo(L(-4), 7.8, L(2), 6.4); g.arc(L(1), 0, 6.5, PI / 2, -PI / 2, dir > 0); g.closePath(); };
      solid(g, flame, P.rise, mix(P.rise, '#000000', 0.22), P.ink, 1.1, 1.0);
      g.save(); g.translate(L(1.5), 0); g.scale(0.62, 0.62); g.fillStyle = P.riseLight; flame(); g.fill(); g.restore();
      g.fillStyle = P.riseTop; ell(g, L(1.6), 0.4, 2.8, 2.6); g.fill();
      shine(g, L(1) - 2.4, -3.2, 1.5, 0.8, 0.6);
    }
  };
  var UNDER_KINDS = ['ball', 'saw', 'drill', 'fire'];
  // 回転ノコのレール（x0〜x1 は壁の面）
  function rail(g, P, x0, x1, y) {
    g.fillStyle = alpha(P.terrainShade, 0.75); rr(g, x0, y - 0.8, x1 - x0, 1.6, 0.8); g.fill();
    [x0, x1].forEach(function (x, i) { solid(g, function () { rr(g, i ? x - 3 : x, y - 2.5, 3, 5, i ? [2, 0, 0, 2] : [0, 2, 2, 0]); }, P.terrainShade, P.terrainDeep, null, 0.4); });
  }

  // 地上：ころ鳥。ひよこのような丸い体、羽の先は丸い山3つ、頭の毛2本、ときどき鳴くくちばし、扇の尾
  var BIRD_WING = [['M', [0, -2.2]], ['Q', [5, -4.4], [8.6, -2.4]], ['Q', [10.6, -0.6], [9.2, 1.2]], ['Q', [8.6, 3], [6.4, 2.6]], ['Q', [5.4, 4.2], [3.4, 3.4]], ['Q', [1.4, 3.6], [0, 2.2]]];
  var FEATHER = [['M', [0, -1.4]], ['Q', [4, -2.4], [6.4, 0]], ['Q', [4, 2.4], [0, 1.4]]];
  function bird(g, P, t, look) {
    var p = t * 13, u = Math.sin(p), by = Math.cos(p) * 0.7, lag = Math.sin(p - 1.5), L = function (x) { return x * look; };
    [0.55, 0.15, -0.25].forEach(function (an) { eBody(g, P, function () { shapePath(g, FEATHER, xf(-look, L(-4.8), 2.8 + by, an + lag * 0.08)); }, 0.4); });
    [-1, 1].forEach(function (s) { eGlow(g, P, function () { ell(g, s * 2.3, 7.4 + by * 0.5, 1.6, 1); }); });
    [-1, 1].forEach(function (s) {
      var T = xf(s, s * 5.4, 0.6 + by, -u * 0.75 - 0.1);
      eSoft(g, P, function () { shapePath(g, BIRD_WING, T); });
      var a = T([2.2, 0.4]), b = T([7.4, 0.6]); innerLine(g, P.enemyShade); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    });
    var sw = lag * 0.6;
    [[-1.4, -11.2, -2.4], [2.2, -10.2, 0.6]].forEach(function (f) {
      eBody(g, P, function () { g.beginPath(); g.moveTo(L(-0.6), -5.6 + by); g.quadraticCurveTo(L(f[2]) + sw, -9 + by, L(f[0]) + sw, f[1] + by); g.quadraticCurveTo(L(f[0] + 2.4) + sw * 0.5, -8 + by, L(1.4), -5.6 + by); g.closePath(); }, 0.4);
    });
    var bodyP = function () { ell(g, 0, 0.5 + by, 7.3, 7); };
    eBody(g, P, bodyP);
    g.save(); bodyP(); g.clip(); g.fillStyle = P.enemyLight; ell(g, L(0.8), 4.6 + by, 4.6, 3.4); g.fill(); g.restore();
    shine(g, -3.5, -2.6 + by, 1.8, 1, 0.55);
    enemyEyes(g, P, L(-0.4), -1.4 + by, look, 1, 2.3, blinkAt(t, 1.1));
    var open = (t % 2.6) < 0.28 ? 1 : 0;
    eGlow(g, P, function () { g.beginPath(); g.moveTo(L(3.4), 2.8 + by); g.quadraticCurveTo(L(5.6), 3 + by + open, L(6.4), 3.4 + by + open * 1.2); g.quadraticCurveTo(L(4.8), 4.4 + by + open, L(3.4), 4 + by); g.closePath(); });
    eGlow(g, P, function () { g.beginPath(); g.moveTo(L(3.2), 1.4 + by); g.quadraticCurveTo(L(6.2), 1.4 + by, L(7.6), 2.8 + by); g.quadraticCurveTo(L(5.6), 3.4 + by, L(3.2), 3.2 + by); g.closePath(); });
  }

  // 上空：もくもく。丸い雲のかたまり、浮いた小さな手、ちらつく稲妻のしっぽ
  function cloud(g, P, t, look) {
    var b = Math.sin(t * 2) * 0.7, fl = (t * 2.6) % 1, L = function (x) { return x * look; };
    if (fl < 0.78) {
      var wx = Math.sin(t * 9) * 0.6;
      eGlow(g, P, function () { g.beginPath(); g.moveTo(-2, 4 + b); g.lineTo(2.4, 4 + b); g.lineTo(0.8, 8.2 + b); g.lineTo(3.2, 8.2 + b); g.lineTo(-1.4 + wx, 15.6 + b); g.lineTo(0, 11 + b); g.lineTo(-2.6, 11 + b); g.closePath(); });
      if (fl < 0.18) { g.fillStyle = P.glow; g.beginPath(); for (var i = 0; i < 8; i++) { var an = i / 8 * Math.PI * 2, d = i % 2 ? 0.8 : 2.2; g.lineTo(3.8 + Math.cos(an) * d, 13.4 + b + Math.sin(an) * d); } g.closePath(); g.fill(); }
    }
    [-1, 1].forEach(function (s) { eBody(g, P, function () { ell(g, s * 10.4, 2.6 + b + Math.sin(t * 2 - 0.8 + s) * 0.9, 2.3, 2.1); }, 0.5); });
    eBody(g, P, function () {
      g.beginPath();
      [[-5.2, 1.4, 4.4], [-1.2, -2.4, 5.4], [3.8, -0.8, 4.6], [6, 2.4, 3.4]].forEach(function (c) { g.moveTo(c[0] + c[2], c[1] + b); g.arc(c[0], c[1] + b, c[2], 0, Math.PI * 2); });
      g.moveTo(8.1, 3.4 + b); g.ellipse(-0.5, 3.4 + b, 8.6, 3.2, 0, 0, Math.PI * 2);
    });
    innerLine(g, P.enemyShade);
    g.beginPath(); g.arc(-5.2, 1.4 + b, 4.4, -0.42 * Math.PI, -0.12 * Math.PI); g.stroke();
    g.beginPath(); g.arc(3.8, -0.8 + b, 4.6, -0.95 * Math.PI, -0.7 * Math.PI); g.stroke();
    shine(g, -3.4, -4.6 + b, 1.8, 1, 0.55);
    enemyEyes(g, P, L(0.3), 0.4 + b, look, 1, 2.5, blinkAt(t, 2.2));
    g.fillStyle = P.ink; g.beginPath(); g.ellipse(L(0.5), 3.6 + b, 1.3, 0.9, 0, 0, Math.PI); g.fill();
  }

  // 宇宙：かさクラゲ。かさが脈打ち、ふちのひらひらと、細い触手4本・太い腕2本が遅れてゆれる
  function jelly(g, P, t, look) {
    var q = t * 3, sq = Math.sin(q), sx = 1 + sq * 0.06, sy = 1 - sq * 0.06, top = -7.6 * sy, rim = 3.2, st = 1 + Math.sin(q - 1) * 0.1;
    var line = function (x, len, ph, w0, w1) {
      var path = function () { g.beginPath(); g.moveTo(x, rim + 1); g.quadraticCurveTo(x + Math.sin(t * 3 + ph) * 1.8, rim + len * 0.5 * st, x + Math.sin(t * 3 + ph + 1.2) * 2.4, rim + len * st); };
      g.lineCap = 'round'; path(); g.strokeStyle = P.ink; g.lineWidth = w0; g.stroke(); path(); g.strokeStyle = P.enemyLight; g.lineWidth = w1; g.stroke();
    };
    [-5.4, -1.8, 1.8, 5.4].forEach(function (x, i) { line(x * sx, 8, i * 1.3, 2.4, 1); });
    [-1.3, 1.3].forEach(function (x, i) { line(x, 10.5, 0.6 + i * 2, 4, 2.4); });
    eSoft(g, P, function () { g.beginPath(); g.moveTo(-8.4 * sx, rim - 0.4); for (var i = 0; i < 5; i++) { var a = -8.4 + i * 3.36, b2 = a + 3.36; g.quadraticCurveTo((a + b2) / 2 * sx, rim + 3.6, b2 * sx, rim - 0.4); } g.closePath(); }, 0.5);
    eBody(g, P, function () { g.beginPath(); g.moveTo(-8.8 * sx, rim); g.bezierCurveTo(-9.2 * sx, top * 1.3, 9.2 * sx, top * 1.3, 8.8 * sx, rim); g.quadraticCurveTo(0, rim + 1.6, -8.8 * sx, rim); g.closePath(); });
    innerLine(g, P.enemyLight); g.beginPath(); g.moveTo(-6.6 * sx, rim - 1); g.bezierCurveTo(-7 * sx, top * 0.95, 7 * sx, top * 0.95, 6.6 * sx, rim - 1); g.stroke();
    g.fillStyle = P.enemyLight; [[1.6, -5.4, 1.1], [4.4, -3.4, 0.9], [-0.8, -6.4, 0.7]].forEach(function (d) { ell(g, d[0] * sx, d[1] * sy, d[2], d[2]); g.fill(); });
    shine(g, -4, -3.6 * sy, 1.9, 1, 0.6);
    enemyEyes(g, P, 0, -0.4, look, 0.95, 2.4, blinkAt(t, 0.7));
  }
  var ENEMIES = { bird: bird, thunder: cloud, jelly: jelly };
  // kind：地下では 'ball' | 'saw' | 'drill' | 'fire'（ほかのゾーンは1種類なので無視）
  function enemy(g, P, x, y, t, s, look, kind) {
    s = s || 1; look = look == null ? 1 : look;
    var m = MOTIF[P.id] || MOTIF.underground;
    g.save(); g.translate(x, y); g.scale(s, s); g.lineJoin = 'round'; g.lineCap = 'round';
    if (m.enemy === 'machine') (UNDER[kind] || UNDER.ball)(g, P, t, look); else ENEMIES[m.enemy](g, P, t, look);
    g.restore();
  }

  /* ---------- 光線：壁の発射口から向かいの壁へ。消える→予告の点滅→点く をくり返す ---------- */
  // いまの状態。s: 'off' | 'warn' | 'on'、k: その状態の中の進み（0〜1）
  function beamState(t, o) {
    o = o || {}; var on = o.on || 1.2, off = o.off || 1.4, warn = o.warn || 0.7, cyc = on + off + warn;
    var p = ((t + (o.offset || 0)) % cyc + cyc) % cyc;
    return p < off ? { s: 'off', k: p / off } : p < off + warn ? { s: 'warn', k: (p - off) / warn } : { s: 'on', k: (p - off - warn) / on };
  }
  function emitter(g, P, x, y, dir, lit, glowA) {   // 壁に付いた発射口（小さな部品。縁取りなし）
    var x0 = dir > 0 ? x : x - 6;
    solid(g, function () { rr(g, x0, y - 5.5, 6, 11, dir > 0 ? [0, 2, 2, 0] : [2, 0, 0, 2]); }, P.terrainShade, P.terrainDeep, null, 0.5);
    var lx = x + dir * 4.2;
    if (glowA > 0) { var gl = g.createRadialGradient(lx, y, 0.5, lx, y, 10); gl.addColorStop(0, alpha(P.hazard, 0.45 * glowA)); gl.addColorStop(1, alpha(P.hazard, 0)); g.fillStyle = gl; ell(g, lx, y, 10, 10); g.fill(); }
    g.fillStyle = lit ? P.hazard : mix(P.hazardShade, P.ink, 0.55); ell(g, lx, y, 2.1, 2.4); g.fill();
    if (lit) { g.fillStyle = P.hazardLight; ell(g, lx - 0.6, y - 0.8, 0.8, 0.8); g.fill(); }
  }
  // x0：左の壁の面、x1：右の壁の面、y：高さ。いまの状態を返す（当たるのは 'on' のときだけ）
  function beam(g, P, x0, x1, y, t, o) {
    var st = beamState(t, o), a = x0 + 6, b = x1 - 6;
    if (st.s === 'warn') {   // 予告：細い点線が点滅（終わりに近いほど速く）
      var vis = Math.floor(st.k * (3 + st.k * 7) * 2) % 2 === 0;
      if (vis) { g.strokeStyle = alpha(P.hazard, 0.85); g.lineWidth = 1; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(a, y); g.lineTo(b, y); g.stroke(); g.setLineDash([]); }
      emitter(g, P, x0, y, 1, vis, 0); emitter(g, P, x1, y, -1, vis, 0);
      return st.s;
    }
    if (st.s === 'on') {
      var grow = Math.min(1, st.k * 10), hh = 2.6 * grow, sh = (t * 40) % 6;
      g.fillStyle = alpha(P.hazard, 0.22); g.fillRect(a, y - 6 * grow, b - a, 12 * grow);
      // 光線の縁はギザギザ（危険なものはとがらせる）
      var path = function () {
        g.beginPath(); g.moveTo(a, y - hh);
        for (var xx = a + 3 - sh; xx < b; xx += 6) { if (xx > a) g.lineTo(xx, y - hh - 1.3 * grow); if (xx + 3 < b) g.lineTo(xx + 3, y - hh); }
        g.lineTo(b, y - hh); g.lineTo(b, y + hh);
        for (var x2 = b - 3 + sh; x2 > a; x2 -= 6) { if (x2 < b) g.lineTo(x2, y + hh + 1.3 * grow); if (x2 - 3 > a) g.lineTo(x2 - 3, y + hh); }
        g.lineTo(a, y + hh); g.closePath();
      };
      solid(g, path, P.hazard, P.hazardShade, P.ink, 0.6, 0.85);
      g.fillStyle = P.hazardLight; g.fillRect(a, y - 0.7, b - a, 1.2);
    }
    emitter(g, P, x0, y, 1, st.s === 'on', st.s === 'on' ? 1 : 0); emitter(g, P, x1, y, -1, st.s === 'on', st.s === 'on' ? 1 : 0);
    return st.s;
  }

  /* ---------- 動く壁：壁のすき間から、地形のブロックがゆっくり出入りする ---------- */
  // 出ている割合（0〜1）。端で少し止まる
  function wallOut(t, period, offset) {
    var p = ((t + (offset || 0)) / (period || 4)) % 1, s = 0.5 - 0.5 * Math.cos(p * Math.PI * 2);
    return Math.max(0, Math.min(1, s * 1.3 - 0.15));
  }
  // x：動かない壁の面、y：上端、rows：高さ（マス）、reach：出る長さ（マス）、dir：1 右へ出る / -1 左へ出る。
  // 先に描き、あとから動かない壁を上に描くと、壁から出てくるように見える。出ている長さ（px）を返す
  function movingWall(g, P, x, y, rows, reach, dir, t, period, offset) {
    var e = wallOut(t, period, offset) * reach * CELL, cols = reach + 1, map = [], r, c;
    for (r = 0; r < rows; r++) map.push(new Array(cols + 1).join('#'));
    var left = dir > 0 ? x - cols * CELL + e : x - e;
    // 出る先の目印：丸い点の列（どこまで出るか）
    var tip = x + dir * reach * CELL;
    g.fillStyle = alpha(P.terrainShade, 0.55);
    for (r = 0; r < rows * 2; r++) { ell(g, tip, y + 4.5 + r * CELL / 2, 1, 1); g.fill(); }
    terrain(g, P, grid(map, '.'), t, left, y);
    // 先の面にボルト（1マスおき、上の段は飾りがあるので除く）
    var bx = dir > 0 ? left + cols * CELL - 5 : left + 5;
    for (r = 1; r < rows - 1; r += 2) {
      var by = y + r * CELL + CELL / 2;
      g.fillStyle = P.terrainShade; ell(g, bx + 0.4, by + 0.5, 1.9, 1.9); g.fill();
      g.fillStyle = P.terrainLight; ell(g, bx - 0.2, by - 0.2, 1.4, 1.4); g.fill();
    }
    return e;
  }

  /* ---------- 迫ってくるもの（地下は溶岩。ほかのゾーンは仮） ---------- */
  function rise(g, P, x, y, w, h, t) {
    var m = MOTIF[P.id] || MOTIF.underground;
    var gl = g.createLinearGradient(0, y - 40, 0, y + 6); gl.addColorStop(0, alpha(P.riseLight, 0)); gl.addColorStop(1, alpha(P.riseLight, 0.4)); g.fillStyle = gl; g.fillRect(x, y - 40, w, 46);
    var surf = function (xx) { return y + 5 + Math.sin(xx * 0.045 + t * 2.2) * 3 + Math.sin(xx * 0.11 - t * 1.4) * 1.5; };
    var xx;
    g.fillStyle = P.riseLight; g.beginPath(); g.moveTo(x, y + h); for (xx = 0; xx <= w; xx += 4) g.lineTo(x + xx, surf(xx) - 3 + Math.sin(xx * 0.07 + t * 1.6) * 2); g.lineTo(x + w, y + h); g.closePath(); g.fill();
    g.fillStyle = P.rise; g.beginPath(); g.moveTo(x, y + h); for (xx = 0; xx <= w; xx += 4) g.lineTo(x + xx, surf(xx)); g.lineTo(x + w, y + h); g.closePath(); g.fill();
    for (var i = 0; i < Math.ceil(w / 40); i++) {
      var cx = x + ((hash(i, 1) * w + t * 6 * (i % 2 ? 1 : -1)) % w + w) % w, cy = y + 14 + hash(i, 2) * Math.max(4, h - 24), cw = 9 + hash(i, 3) * 8;
      if (m.rise === 'lava' || m.rise === 'mud') { g.fillStyle = mix(P.rise, '#000000', 0.3); rr(g, cx - cw / 2, cy - 2, cw, 4, 2); g.fill(); if (m.rise === 'lava') { g.strokeStyle = P.riseTop; g.lineWidth = 0.8; g.beginPath(); g.moveTo(cx - cw * 0.2, cy - 1.5); g.lineTo(cx, cy + 0.2); g.lineTo(cx + cw * 0.25, cy - 1); g.stroke(); } }
      else if (m.rise === 'storm') { if ((t * 2 + i) % 3 < 0.15) { g.strokeStyle = P.riseTop; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx, cy - 6); g.lineTo(cx + 3, cy); g.lineTo(cx - 1, cy); g.lineTo(cx + 2, cy + 7); g.stroke(); } }
      else { g.fillStyle = alpha(P.riseTop, 0.6); ell(g, cx, cy, 1, 1); g.fill(); }
    }
    g.strokeStyle = P.riseTop; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); for (xx = 0; xx <= w; xx += 4) g.lineTo(x + xx, surf(xx)); g.stroke();
  }

  /* ---------- プレイヤー：白いおばけ・線の目・薄ピンクの頬・赤いマフラー ---------- */
  var POSES = {
    stand: { name: '立ち', tilt: 0, sq: 0, hands: [[-8.5, 4], [8.5, 4]], feet: [[-4, 12.5], [4.5, 12.5]], scarf: [[-4, -1], [-11, 2], [-15, 8], [-17, 15], [-16, 21]], expr: 'normal', look: [1, 0], hem: 0 },
    cling: { name: '壁に張り付き', tilt: -0.08, sq: 0, hands: [[-11.5, -5], [-11.5, 3]], feet: [[-10.5, 10], [-8, 12.5]], scarf: [[-4, -1], [-9, 5], [-10, 12], [-8, 19], [-9, 26]], expr: 'normal', look: [1, -0.5], wall: true, hem: -0.6 },
    jump: { name: 'ジャンプ', tilt: 0.18, sq: -0.1, hands: [[-9, -7], [9, -8]], feet: [[-6, 12], [2, 13.5]], scarf: [[-4, -1], [-12, 4], [-20, 8], [-28, 15], [-34, 23]], expr: 'brave', look: [1, -0.7], hem: -1.8 },
    air: { name: '2段ジャンプ', tilt: 0.5, sq: 0.08, hands: [[-6, 3], [6.5, 2]], feet: [[-3, 10], [5, 9]], scarf: [[-4, -1], [-11, -4], [-19, -4], [-26, 1], [-31, 8]], expr: 'happy', look: [1, 0], ring: true, hem: -0.9 },
    hurt: { name: 'ダメージ', tilt: -0.32, sq: 0.06, hands: [[-11, -6], [10.5, -7]], feet: [[-7.5, 12], [6.5, 10]], scarf: [[-4, -1], [-8, -8], [-13, -14], [-14, -21], [-12, -28]], expr: 'hurt', look: [-1, 0], hem: 1.2 }
  };
  var POSE_ORDER = ['stand', 'cling', 'jump', 'air', 'hurt'];
  function scarfTail(g, P, pts, t, w0) {
    w0 = w0 || 3.3;
    var wav = pts.map(function (p, i) { return [p[0] + Math.sin(t * 7 + i * 1.3) * 0.25 * i, p[1] + Math.cos(t * 7 + i * 1.1) * 0.35 * i]; });
    var s = spline(wav, 7), L = [], R = [];
    for (var i = 0; i < s.length; i++) {
      var a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)], nx = -(b[1] - a[1]), ny = b[0] - a[0], d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
      var w = w0 * (1 - 0.45 * i / s.length); L.push([s[i][0] + nx * w, s[i][1] + ny * w]); R.push([s[i][0] - nx * w, s[i][1] - ny * w]);
    }
    var shape = function () {
      g.beginPath(); g.moveTo(L[0][0], L[0][1]); L.forEach(function (p) { g.lineTo(p[0], p[1]); });
      var e = s[s.length - 1], f = s[s.length - 3], dx = e[0] - f[0], dy = e[1] - f[1];
      g.lineTo(e[0] + dx * 0.9 + dy * 0.35, e[1] + dy * 0.9 - dx * 0.35); g.lineTo(e[0] + dx * 0.2, e[1] + dy * 0.2); g.lineTo(e[0] + dx * 0.9 - dy * 0.35, e[1] + dy * 0.9 + dx * 0.35);
      for (var j = R.length - 1; j >= 0; j--) g.lineTo(R[j][0], R[j][1]); g.closePath();
    };
    solid(g, shape, P.scarf, P.scarfShade, P.playerLine, 1.1, 1.0);
    g.strokeStyle = P.scarfStripe; g.lineWidth = 0.7;
    for (var k = 6; k < s.length - 4; k += 7) { g.beginPath(); g.moveTo(L[k][0], L[k][1]); g.lineTo(R[k][0], R[k][1]); g.stroke(); }
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
  function lineEyes(g, P, eyes, expr, look, t) {
    var blink = expr === 'normal' && (t % 3.4) < 0.12;
    g.strokeStyle = P.playerLine; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 1.25;
    eyes.forEach(function (e, i) {
      var x = e[0] + look[0] * 0.6, y = e[1] + look[1] * 0.6;
      g.beginPath();
      if (expr === 'hurt') { var s = i ? -1 : 1; g.moveTo(x - 1.2 * s, y - 1.5); g.lineTo(x + 1 * s, y); g.lineTo(x - 1.2 * s, y + 1.5); }
      else if (expr === 'happy') { g.moveTo(x - 1.4, y + 0.8); g.lineTo(x, y - 0.8); g.lineTo(x + 1.4, y + 0.8); }
      else if (blink) { g.moveTo(x - 1.2, y + 0.4); g.lineTo(x + 1.2, y + 0.4); }
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
      lineEyes(g, P, o.eyes, Q.expr, Q.look, t); cheeks(g, P, o.cheeks);
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
    if (Q.ring) { g.strokeStyle = alpha(P.playerShade, 0.95); g.lineWidth = 1.4; g.setLineDash([2.5, 2.5]); g.beginPath(); g.arc(0, 1, 18 + Math.sin(t * 6) * 1.5, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
    g.rotate(Q.tilt + (Q.ring ? Math.sin(t * 3) * 0.15 : 0)); g.scale(1 - Q.sq * 0.6, 1 + Q.sq);
    scarfTail(g, P, Q.scarf, t);
    G.draw(g, P, Q, t);
    g.restore();
  }

  /* ---------- エフェクト ---------- */
  function effects(g, P, x, y, t) {
    var p = (t % 1.6) / 1.6, i;
    for (i = 0; i < 6; i++) { var a = (1 - p); g.fillStyle = alpha(P.terrainLight, a * 0.85); ell(g, x - 34 - p * (10 + i * 4), y + (i - 3) * 3 - p * 8, (2 + hash(i, 1) * 2) * (1 + p), (2 + hash(i, 1) * 2) * (1 + p)); g.fill(); }
    g.strokeStyle = alpha(P.playerShade, 1 - p); g.lineWidth = 2; g.setLineDash([3, 3]); g.beginPath(); g.arc(x, y, 12 + p * 16, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
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
  function hud(g, P, w, h, meters) {
    g.fillStyle = alpha(P.uiPanel, 0.85); rr(g, 8, 8, 64, 22, 11); g.fill();
    for (var i = 0; i < 3; i++) heart(g, P, 22 + i * 18, 13, i < 2);
    var label = meters + 'm'; g.font = '800 15px "M PLUS Rounded 1c", system-ui, sans-serif';
    var tw = g.measureText(label).width; g.fillStyle = alpha(P.uiPanel, 0.85); rr(g, w / 2 - tw / 2 - 14, 8, tw + 28, 24, 12); g.fill();
    g.fillStyle = P.uiInk; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, w / 2, 20.5);
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
    CELL: CELL, ZONES: ZONES, MOTIF: MOTIF, POSES: POSES, POSE_ORDER: POSE_ORDER, GHOSTS: GHOSTS,
    sheetPath: sheetPath,
    pal: pal, mix: mix, alpha: alpha, hash: hash,
    rr: rr, ell: ell, solid: solid, shine: shine, spline: spline,
    grid: grid, background: background, block: block, slope: slope, lip: lip, hang: hang, decor: decor, spike: spike, terrain: terrain,
    beamState: beamState, beam: beam, wallOut: wallOut, movingWall: movingWall,
    enemy: enemy, UNDER_KINDS: UNDER_KINDS, rail: rail, rise: rise, ghost: ghost, scarfTail: scarfTail, scarfWrap: scarfWrap, lineEyes: lineEyes,
    effects: effects, heart: heart, hud: hud,
    canvas: canvas, animate: animate, zoneRow: zoneRow, ghostSheet: ghostSheet
  };
})();
