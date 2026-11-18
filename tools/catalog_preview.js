// 統一カタログ（catalog/project）の見本を全部ローカルで表示し、エラーを出す。スクショは一時フォルダへ。
// 使い方: node tools/catalog_preview.js [見本名（例 GhostSheet）]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
(async () => {
  const proj = path.resolve(__dirname, '../catalog/project'), out = fs.mkdtempSync(path.join(os.tmpdir(), 'kabe-cat-'));
  const only = process.argv[2];
  const comps = fs.readdirSync(proj + '/components').filter(d => fs.existsSync(`${proj}/components/${d}/preview.html`) && (!only || d === only));
  const b = await chromium.launch();
  for (const c of comps) {
    const body = fs.readFileSync(`${proj}/components/${c}/preview.html`, 'utf8');
    const file = `${out}/${c}.html`;
    fs.writeFileSync(file, `<!doctype html><html data-theme="underground"><head><meta charset="utf-8"><link rel="stylesheet" href="file://${proj}/tokens.css"><link rel="stylesheet" href="file://${proj}/components/bundle.css"><script src="file://${proj}/components/bundle.js"></script></head><body style="width:${c === 'Cover' ? 960 : 760}px">${body}</body></html>`);
    const pg = await b.newPage({ viewport: { width: 980, height: 600 } });
    const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await pg.goto('file://' + file); await pg.waitForTimeout(800);
    await pg.screenshot({ path: `${out}/${c}.png`, fullPage: true });
    console.log(c, errs.length ? errs.join(' | ') : 'ok');
    await pg.close();
  }
  console.log('screenshots:', out);
  await b.close();
})();
