'use strict';
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = 'https://games.ermolaev.tech/nu-pogodi/gpt6-astra/';
const root = path.resolve(__dirname, '..');

(async () => {
  const files = ['index.html', ...fs.readdirSync(path.join(root, 'js')).map(f => `js/${f}`), ...fs.readdirSync(path.join(root, 'styles')).map(f => `styles/${f}`)];
  for (const file of files) {
    const response = await fetch(base + file);
    assert.equal(response.status, 200, file);
    const remoteHash = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
    const localHash = createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
    assert.equal(remoteHash, localHash, `${file}: deployed bytes match local source`);
    const expectedType = file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
    assert.ok(response.headers.get('content-type').startsWith(expectedType), `${file}: MIME type`);
  }
  const redirect = await fetch(base.replace('https:', 'http:') + 'index.html', { redirect: 'manual' });
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get('location'), base + 'index.html');
  assert.equal((await fetch(base + 'does-not-exist.js')).status, 404);
  console.log('PASS HTTPS, HTTP redirect, 11 asset hashes, MIME types and missing-file 404');

  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    const failed = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('requestfailed', r => failed.push(r.url()));
    const response = await page.goto(base + 'index.html');
    assert.equal(response.status(), 200);
    await page.locator('#start').click();
    const keys = ['q', 'a', 'p', 'l'];
    const deadline = Date.now() + 16000;
    while (Number(await page.locator('#best').textContent()) < 2 && Date.now() < deadline) {
      const lane = await page.locator('#eggs > use').evaluateAll(nodes => {
        if (!nodes.length) return null;
        const matrix = nodes[0].transform.baseVal.getItem(0).matrix;
        return (matrix.e < 450 ? 0 : 2) + (matrix.f > 280 ? 1 : 0);
      });
      if (lane !== null) await page.keyboard.press(keys[lane]);
      await page.waitForTimeout(100);
    }
    assert.ok(Number(await page.locator('#best').textContent()) >= 2);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#overlay-title').textContent(), 'Пауза');
    await page.keyboard.press('Escape');
    const artifacts = path.join(__dirname, 'artifacts');
    fs.mkdirSync(artifacts, { recursive: true });
    await page.screenshot({ path: path.join(artifacts, 'deployed-desktop.png') });
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    console.log('PASS public browser launch, egg animation, keyboard catches, score and pause; no runtime or network errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
