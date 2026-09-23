'use strict';
// Runs the actual file application. No web server, request stubs, clock replacement or game hooks.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const artifactDir = path.join(__dirname, 'artifacts');
fs.mkdirSync(artifactDir, { recursive: true });
const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const keys = ['q', 'a', 'p', 'l'];

async function pose(page, lane) {
  await page.keyboard.down(keys[lane]);
  const transform = await page.locator('#basket').getAttribute('transform');
  assert.equal(transform, `translate(${lane < 2 ? 334 : 566} ${lane % 2 === 0 ? 256 : 394})`);
  await page.keyboard.up(keys[lane]);
}

async function firstEggLane(page) {
  return page.locator('#eggs > use').evaluateAll(nodes => {
    if (!nodes.length) return null;
    const position = nodes[0].transform.baseVal.getItem(0).matrix;
    return (position.e < 450 ? 0 : 2) + (position.f > 280 ? 1 : 0);
  });
}

async function playUntil(page, stop, catchEggs, limit = 30000, touch = false) {
  const deadline = Date.now() + limit;
  let previousLane = -1;
  while (Date.now() < deadline) {
    if (await stop()) return;
    const lane = await firstEggLane(page);
    if (lane !== null) {
      const target = catchEggs ? lane : (lane + 1) % 4;
      if (target !== previousLane) {
        if (touch) await page.locator(`[data-lane="${target}"]`).tap();
        else await page.keyboard.press(keys[target]);
        previousLane = target;
      }
    }
    await page.waitForTimeout(70);
  }
  throw new Error('Gameplay condition not reached within real-time deadline');
}

async function layout(page, label) {
  const result = await page.evaluate(() => {
    const device = document.querySelector('.device').getBoundingClientRect();
    const scene = document.querySelector('#game-scene').getBoundingClientRect();
    const buttons = [...document.querySelectorAll('.direction')].map(n => {
      const b = n.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom };
    });
    return { width: innerWidth, height: innerHeight, scroll: document.documentElement.scrollHeight, device: { x: device.x, y: device.y, right: device.right, bottom: device.bottom }, ratio: scene.width / scene.height, buttons };
  });
  console.log('LAYOUT', label, JSON.stringify(result));
  assert.ok(Math.abs(result.ratio - 900 / 520) < .01, `${label}: SVG proportions`);
  assert.ok(result.device.x >= -1 && result.device.right <= result.width + 1, `${label}: horizontal bounds`);
  if (await page.locator('body').evaluate(n => n.classList.contains('touch-device'))) {
    assert.ok(result.scroll <= result.height + 1, `${label}: no scroll`);
    assert.ok(result.device.y >= -1 && result.device.bottom <= result.height + 1, `${label}: vertical bounds`);
    for (const b of result.buttons) {
      assert.ok(b.w >= 44 && b.h >= 44, `${label}: touch target`);
      assert.ok(b.x >= 0 && b.right <= result.width && b.y >= 0 && b.bottom <= result.height, `${label}: button visible`);
    }
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || undefined });
  const errors = [];
  const external = [];
  function monitor(page) {
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
  }
  try {
    if (!process.env.MOBILE_ONLY) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(); monitor(page);
    await page.goto(url);
    await page.locator('#wolf').waitFor();
    assert.equal(await page.locator('canvas, iframe, image').count(), 0);
    await layout(page, 'desktop 1440×1000');
    await page.screenshot({ path: path.join(artifactDir, 'desktop-start.png') });
    await page.locator('#start').click();
    for (let lane = 0; lane < 4; lane++) await pose(page, lane);
    await page.locator('#eggs > use').first().waitFor();
    const before = await page.locator('#eggs > use').first().getAttribute('transform');
    await page.waitForTimeout(300);
    assert.notEqual(await page.locator('#eggs > use').first().getAttribute('transform'), before);
    await page.keyboard.press('Escape');
    const frozen = await page.locator('#eggs').innerHTML();
    await page.waitForTimeout(400);
    assert.equal(await page.locator('#eggs').innerHTML(), frozen);
    await page.keyboard.press('Escape');
    await playUntil(page, async () => Number(await page.locator('#best').textContent()) >= 4, true);
    console.log('PASS real movement, all keyboard positions, pause and four catches');
    await page.screenshot({ path: path.join(artifactDir, 'desktop-playing.png') });
    await playUntil(page, async () => await page.locator('#overlay-copy').textContent().then(t => t.includes('Игра окончена')), false);
    assert.match(await page.locator('#announcer').textContent(), /Игра окончена/);
    await page.screenshot({ path: path.join(artifactDir, 'desktop-game-over.png') });
    console.log('PASS real misses and game over');

    for (let cycle = 0; cycle < 2; cycle++) {
      await page.locator('#start').click();
      assert.equal(await page.locator('#digits').getAttribute('aria-label'), 'Счёт: 000');
      assert.equal(await page.locator('#penalties').getAttribute('aria-label'), 'Штрафы: 0 из 3');
      await page.waitForTimeout(750);
      assert.equal(await page.locator('#eggs > use').count(), 1);
      await playUntil(page, async () => await page.locator('#overlay-copy').textContent().then(t => t.includes('Игра окончена')) && await page.locator('#overlay').isVisible(), false);
      console.log(`PASS real restart ${cycle + 1} and subsequent game over`);
    }
    await page.locator('#sound').click();
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'false');
    const record = await page.locator('#best').textContent();
    await page.reload();
    assert.equal(await page.locator('#best').textContent(), record);
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'false');
    await page.setViewportSize({ width: 1024, height: 768 }); await layout(page, 'laptop 1024×768');
    await page.setViewportSize({ width: 600, height: 800 });
    assert.equal(await page.locator('#rotate').isVisible(), false);
    console.log('PASS persistence and narrow desktop stays keyboard-capable');
    await context.close();
    }

    const mobileContext = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const mobile = await mobileContext.newPage(); monitor(mobile);
    await mobile.goto(url);
    await mobile.screenshot({ path: path.join(artifactDir, 'mobile-start.png') });
    await layout(mobile, 'phone 844×390');
    await mobile.locator('#start').tap();
    for (let lane = 0; lane < 4; lane++) {
      await mobile.locator(`[data-lane="${lane}"]`).tap();
      assert.equal(await mobile.locator('#basket').getAttribute('transform'), `translate(${lane < 2 ? 334 : 566} ${lane % 2 === 0 ? 256 : 394})`);
    }
    const cdp = await mobileContext.newCDPSession(mobile);
    const left = await mobile.locator('[data-lane="0"]').boundingBox();
    const right = await mobile.locator('[data-lane="3"]').boundingBox();
    const point = (rect, id) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, id });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(left, 1)] });
    assert.ok(await mobile.locator('[data-lane="0"]').evaluate(n => n.classList.contains('pressed')));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(left, 1), point(right, 2)] });
    assert.equal(await mobile.locator('.direction.pressed').count(), 2);
    assert.equal(await mobile.locator('#basket').getAttribute('transform'), 'translate(566 394)');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await mobile.locator('.direction.pressed').count(), 0);
    await playUntil(mobile, async () => Number(await mobile.locator('#best').textContent()) >= 2, true, 20000, true);
    console.log('PASS real catches using touch controls');
    await mobile.waitForTimeout(850);
    await mobile.screenshot({ path: path.join(artifactDir, 'mobile-playing.png') });
    await mobile.setViewportSize({ width: 390, height: 844 });
    await mobile.locator('#rotate').waitFor({ state: 'visible' });
    const frozenMobile = await mobile.locator('#eggs').innerHTML();
    await mobile.waitForTimeout(400);
    assert.equal(await mobile.locator('#eggs').innerHTML(), frozenMobile);
    await mobile.screenshot({ path: path.join(artifactDir, 'mobile-portrait.png') });
    await mobile.setViewportSize({ width: 844, height: 390 });
    await mobile.locator('#rotate').waitFor({ state: 'hidden' });
    assert.equal(await mobile.locator('#overlay-title').textContent(), 'Пауза');
    await mobile.locator('#start').tap();
    for (const [width, height] of [[667, 375], [568, 320], [1024, 768], [1180, 820]]) {
      await mobile.setViewportSize({ width, height });
      await layout(mobile, `touch ${width}×${height}`);
      await mobile.screenshot({ path: path.join(artifactDir, `touch-${width}x${height}.png`) });
    }
    console.log('PASS touch input, simultaneous fingers, portrait pause and landscape resume');
    assert.deepEqual(errors, [], 'No browser runtime errors');
    assert.deepEqual(external, [], 'No external network requests');
    console.log('PASS no runtime errors or external requests');
    await mobileContext.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
