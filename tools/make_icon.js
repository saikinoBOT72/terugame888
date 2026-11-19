// アプリアイコンを作る：カタログの絵（Kabe）で描いて icons/ に PNG を書き出す。
// 使い方: node tools/make_icon.js
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'icons');
(async () => {
  const b = await chromium.launch(), pg = await b.newPage();
  await pg.goto('file://' + path.join(root, 'index.html').replace('index.html', 'catalog/project/components/Gems/preview.html'));
  await pg.setContent(`<html><head><link rel="stylesheet" href="file://${root}/catalog/project/tokens.css"></head><body></body></html>`);
  await pg.addScriptTag({ path: path.join(root, 'catalog/project/components/bundle.js') });
  await pg.waitForTimeout(200);
  const draw = async (size, opt) => pg.evaluate(([size, opt]) => {
    const P = Kabe.pal('underground'), c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), S = size / 144;   // 144×144 の絵として描く
    g.scale(S, S);
    // 背景：地下の暗がり＋下から溶岩の照り返し
    let gr = g.createLinearGradient(0, 0, 0, 144); gr.addColorStop(0, Kabe.mix(P.bgTop, '#000000', 0.25)); gr.addColorStop(0.7, P.bgBottom); gr.addColorStop(1, Kabe.mix(P.rise, P.bgBottom, 0.35));
    g.fillStyle = gr; g.fillRect(0, 0, 144, 144);
    gr = g.createRadialGradient(72, 170, 10, 72, 170, 120); gr.addColorStop(0, Kabe.alpha(P.riseLight, 0.55)); gr.addColorStop(1, Kabe.alpha(P.riseLight, 0)); g.fillStyle = gr; g.fillRect(0, 0, 144, 144);
    // 両側の壁（地形の絵）
    const m = opt.mask ? 1 : 0, rows = 9, map = [];
    for (let r = 0; r < rows; r++) { let s = ''; for (let col = 0; col < 8; col++) s += (col < 1 || col > 6 || (col === 1 && r > 6) || (col === 6 && r < 2)) ? '#' : '.'; map.push(s); }
    g.save(); g.translate(-5 - m * 4, 0); Kabe.terrain(g, P, Kabe.grid(map, '#'), 0, 0, -12); g.restore();
    gr = g.createRadialGradient(72, 72, 40, 72, 72, 104); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(10,6,20,.55)'); g.fillStyle = gr; g.fillRect(0, 0, 144, 144);   // ふちを暗く
    // 溶岩のふち
    g.save(); g.translate(0, 0); Kabe.rise(g, P, 0, 132, 144, 20, 0.6); g.restore();
    // 光の粒
    [[46, 34, 0.9, 0], [104, 60, 0.7, 1], [58, 104, 0.6, 2], [96, 112, 0.5, 3]].forEach(([x, y, s, i]) => Kabe.mote(g, P, x, y, 0.4 + i, s, i));
    // ふわっと光る輪郭
    gr = g.createRadialGradient(72, 70, 8, 72, 70, 52); gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 144, 144);
    // おばけ（蹴って跳び上がるところ）
    Kabe.ghost(g, P, 'sheet', 'jump', opt.mask ? 78 : 80, 70, 0.25, 1, opt.mask ? 1.95 : 2.3);
    if (opt.round) { g.globalCompositeOperation = 'destination-in'; Kabe.rr(g, 0, 0, 144, 144, 32); g.fill(); }
    return c.toDataURL('image/png').split(',')[1];
  }, [size, opt]);
  const list = [['icon-180.png', 180, {}], ['icon-192.png', 192, {}], ['icon-512.png', 512, {}], ['icon-512-maskable.png', 512, { mask: true }], ['favicon-64.png', 64, { round: true }]];
  for (const [name, size, opt] of list) { fs.writeFileSync(path.join(out, name), Buffer.from(await draw(size, opt), 'base64')); console.log('wrote icons/' + name); }
  await b.close();
})();
