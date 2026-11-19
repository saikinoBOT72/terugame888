// 本編をダメージ・溶岩なしの自動プレイで動かし、エラーと到達した高さを出す。スクショを1枚保存。
// 使い方: node tools/smoke.js [秒数=30] [スクショの保存先=OSの一時フォルダ]
const { chromium } = require('playwright');
const path = require('path'), os = require('os');
(async () => {
  const secs = +(process.argv[2] || 30), shot = process.argv[3] || path.join(os.tmpdir(), 'kabe-smoke.png');
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 400, height: 720 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto('file://' + path.resolve(__dirname, '../index.html'));
  await pg.waitForTimeout(500); await pg.click('#btnStart');
  const t0 = Date.now();
  while (Date.now() - t0 < secs * 1000) {
    const st = await pg.evaluate(() => { const k = window.__kabe; if (k.state === 'gacha') k.leaveGacha(); if (k.state === 'play') { k.G.hp = 3; k.G.lavaY = Math.max(k.G.lavaY, k.P.y + 400); } return k.state; });
    if (st !== 'play') break;
    await pg.evaluate(() => window.__kabe.press()); await pg.waitForTimeout(300 + Math.random() * 400);
    if (Math.random() < 0.6) await pg.evaluate(() => window.__kabe.press()); await pg.waitForTimeout(300 + Math.random() * 400);
  }
  await pg.screenshot({ path: shot });
  const info = await pg.evaluate(() => ({ state: window.__kabe.state, best: Math.round(window.__kabe.G.best), pieces: window.__kabe.world.placed.length }));
  console.log(JSON.stringify(info), 'screenshot:', shot);
  console.log(errs.length ? errs.join('\n') : 'エラーなし');
  await b.close();
})();
