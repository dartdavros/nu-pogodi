/*
 * Проверка игровой механики без браузера:  node tests/engine.test.js
 */
'use strict';

const assert = require('assert');
const path = require('path');

global.window = {};
require(path.join(__dirname, '..', 'js', 'engine.js'));
const { Engine, rules } = window.NuPogodi;

function seeded(seed) {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

/** Прогоняет игру кадрами по 16 мс; policy(state) возвращает положение Волка или -1. */
function run(engine, ms, policy) {
  const all = [];
  for (let t = 0; t < ms; t += 16) {
    if (policy) {
      const pos = policy(engine.state);
      if (pos >= 0) engine.setWolf(pos);
    }
    all.push(...engine.update(16));
  }
  return all;
}

const leadLane = (s) => (s.eggs.length ? s.eggs[0].lane : -1);
const wrongLane = (s) => (s.eggs.length ? (s.eggs[0].lane + 1) % 4 : -1);

const tests = {
  'идеальная игра: только очки, без штрафов'() {
    const e = new Engine(seeded(1));
    e.start();
    const ev = run(e, 60000, leadLane);
    assert.strictEqual(e.state.phase, 'playing');
    assert.strictEqual(e.state.penaltyHalves, 0);
    assert.ok(e.state.total > 30, 'поймано ' + e.state.total);
    assert.strictEqual(ev.filter((x) => x.type === 'miss').length, 0);
  },

  'за один такт решается не больше одного яйца'() {
    const e = new Engine(seeded(2));
    e.start();
    e.state.total = 700;
    for (let t = 0; t < 30000; t += 16) {
      const ev = e.update(16);
      const resolved = ev.filter((x) => x.type === 'catch' || x.type === 'miss');
      assert.ok(resolved.length <= 1);
      const steps = e.state.eggs.map((x) => x.step);
      assert.strictEqual(new Set(steps).size, steps.length, 'яйца на одном шаге');
      if (e.state.phase === 'over') break;
    }
  },

  'три промаха без Зайца — конец игры'() {
    const e = new Engine(seeded(3));
    e.start();
    e._hareTimer = 1e12;
    const ev = run(e, 60000, wrongLane);
    const misses = ev.filter((x) => x.type === 'miss');
    assert.strictEqual(e.state.phase, 'over');
    assert.strictEqual(misses.length, 3);
    assert.ok(misses.every((m) => m.halves === 2));
    assert.strictEqual(ev.filter((x) => x.type === 'gameover').length, 1);
  },

  'промах при Зайце — половина штрафа'() {
    const e = new Engine(seeded(4));
    e.start();
    e.state.hareVisible = true;
    e._hareTimer = 1e12;
    const ev = run(e, 120000, wrongLane);
    const misses = ev.filter((x) => x.type === 'miss');
    assert.strictEqual(misses.length, 6);
    assert.ok(misses.every((m) => m.halves === 1 && m.hare));
    assert.strictEqual(e.state.phase, 'over');
  },

  'после Game Over время игры не идёт и яйца не двигаются'() {
    const e = new Engine(seeded(5));
    e.start();
    e._hareTimer = 1e12;
    run(e, 60000, wrongLane);
    const snapshot = JSON.stringify(e.state.eggs);
    const ev = run(e, 5000, leadLane);
    assert.strictEqual(ev.length, 0);
    assert.strictEqual(JSON.stringify(e.state.eggs), snapshot);
  },

  'на 200 и 500 штрафы сбрасываются'() {
    for (const target of [200, 500]) {
      const e = new Engine(seeded(6));
      e.start();
      e.state.total = target - 1;
      e.state.score = target - 1;
      e.state.penaltyHalves = 3;
      const ev = run(e, 20000, leadLane);
      assert.ok(e.state.total >= target);
      assert.strictEqual(e.state.penaltyHalves, 0);
      assert.strictEqual(ev.filter((x) => x.type === 'penaltyReset').length, 1);
    }
  },

  'после 999 счёт продолжается с 000'() {
    const e = new Engine(seeded(7));
    e.start();
    e.state.total = 998;
    e.state.score = 998;
    const ev = run(e, 20000, leadLane);
    const scores = ev.filter((x) => x.type === 'catch').map((x) => x.score);
    assert.deepStrictEqual(scores.slice(0, 3), [999, 0, 1]);
    assert.strictEqual(e.state.phase, 'playing');
  },

  'темп растёт, но после каждой сотни ненадолго снижается'() {
    const iv = rules.stepInterval;
    assert.ok(iv(0) > 550, 'стартовый шаг ' + iv(0));
    assert.ok(iv(30) > 500, 'на 30 очках шаг ' + iv(30));
    for (let h = 1; h <= 9; h++) {
      assert.ok(iv(h * 100) > iv(h * 100 - 1), 'нет отката на ' + h * 100);
      assert.ok(iv(h * 100) < iv((h - 1) * 100), 'нет общего роста к ' + h * 100);
    }
    assert.ok(iv(5000) >= 200);
    assert.ok(rules.spawnGap(0) > rules.spawnGap(400));
  },

  'пауза останавливает время, Волк на паузе не двигается'() {
    const e = new Engine(seeded(8));
    e.start();
    run(e, 3000, null);
    e.pause();
    const t = e.state.time;
    const eggs = JSON.stringify(e.state.eggs);
    run(e, 5000, null);
    assert.strictEqual(e.state.time, t);
    assert.strictEqual(JSON.stringify(e.state.eggs), eggs);
    assert.strictEqual(e.setWolf((e.state.wolf + 1) % 4), false);
    e.resume();
    run(e, 1000, null);
    assert.ok(e.state.time > t);
  },

  'большой dt не проматывает игру'() {
    const e = new Engine(seeded(9));
    e.start();
    const ev = e.update(10000);
    assert.ok(ev.filter((x) => x.type === 'step').length <= 2);
  },

  'рестарт полностью обнуляет партию'() {
    const e = new Engine(seeded(10));
    for (let i = 0; i < 5; i++) {
      e.start();
      assert.strictEqual(e.state.phase, 'playing');
      assert.strictEqual(e.state.score, 0);
      assert.strictEqual(e.state.penaltyHalves, 0);
      assert.strictEqual(e.state.eggs.length, 0);
      run(e, 60000, wrongLane);
      assert.strictEqual(e.state.phase, 'over');
    }
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try {
    fn();
    console.log('ok   ' + name);
  } catch (err) {
    failed++;
    console.log('FAIL ' + name + '\n     ' + err.message);
  }
}
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
