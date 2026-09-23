'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, tempo } = require('../js/mechanics.js');

function landing(game, lane) {
  game.nextSpawn = Infinity;
  game.eggs = [{ id: 1, lane, born: game.time - 499, duration: 500, step: 4 }];
  return game.update(1);
}

test('starts ready; reset creates a clean playable state', () => {
  const game = new Game();
  assert.equal(game.status, 'ready');
  game.reset();
  assert.equal(game.status, 'running');
  assert.equal(game.score, 0);
  assert.equal(game.penalty, 0);
  assert.equal(game.eggs.length, 0);
});

test('all four positions catch exactly one point and remove the egg', () => {
  for (let lane = 0; lane < 4; lane++) {
    const game = new Game();
    game.reset();
    game.move(lane);
    assert.ok(landing(game, lane).some(event => event.type === 'catch'));
    assert.equal(game.score, 1);
    assert.equal(game.eggs.length, 0);
    assert.equal(game.penalty, 0);
  }
});

test('three ordinary misses end the game; game over does not advance', () => {
  const game = new Game(); game.reset();
  for (let i = 0; i < 3; i++) landing(game, 1);
  assert.equal(game.penalty, 6);
  assert.equal(game.status, 'over');
  const time = game.time;
  assert.deepEqual(game.update(100), []);
  assert.equal(game.time, time);
});

test('bunny appears periodically, makes six half misses fatal, then disappears', () => {
  const game = new Game(); game.reset(); game.time = 9000;
  for (let i = 0; i < 5; i++) landing(game, 1);
  assert.equal(game.bunny, true);
  assert.equal(game.penalty, 5);
  assert.equal(game.status, 'running');
  landing(game, 1);
  assert.equal(game.status, 'over');
  game.reset(); game.time = 13999; game.nextSpawn = Infinity;
  game.update(1);
  assert.equal(game.bunny, false);
  game.time = 26999; game.update(1);
  assert.equal(game.bunny, true);
});

test('mixed penalties use integer halves and end on crossing three', () => {
  const game = new Game(); game.reset();
  landing(game, 1);
  game.time = 9000; landing(game, 1);
  game.time = 15000; landing(game, 1);
  assert.equal(game.penalty, 5);
  landing(game, 1);
  assert.equal(game.penalty, 7);
  assert.equal(game.status, 'over');
});

test('200 and 500 clear penalties in every score cycle', () => {
  for (const score of [199, 499, 1199, 1499]) {
    const game = new Game(); game.reset(); game.score = score; game.penalty = 5;
    const events = landing(game, 0);
    assert.equal(game.penalty, 0);
    assert.ok(events.some(event => event.type === 'bonus'));
    assert.equal(game.status, 'running');
  }
});

test('999 wraps the three digit display to 000 while total continues', () => {
  const game = new Game(); game.reset(); game.score = 999;
  landing(game, 0);
  assert.equal(game.displayScore, '000');
  assert.equal(game.score, 1000);
  assert.equal(game.status, 'running');
  landing(game, 0);
  assert.equal(game.displayScore, '001');
});

test('difficulty grows gently, gets relief at each hundred and stays bounded', () => {
  assert.ok(tempo(30).step > 650);
  assert.ok(tempo(30).spawn > 1800);
  assert.ok(tempo(99).step < tempo(0).step);
  assert.ok(tempo(100).step > tempo(99).step);
  assert.ok(tempo(100).spawn > tempo(99).spawn);
  assert.ok(tempo(122).step < tempo(100).step);
  assert.ok(tempo(10000).step >= 225);
  assert.ok(tempo(10000).spawn >= 550);
});

test('spawned eggs advance through discrete positions with spaced arrivals', () => {
  const game = new Game(); game.reset();
  game.update(100); assert.equal(game.eggs.length, 0);
  for (let i = 0; i < 5; i++) game.update(100);
  assert.equal(game.eggs.length, 1);
  for (let i = 0; i < 8; i++) game.update(100);
  assert.equal(game.eggs[0].step, 1);
  let lastArrival = game.lastArrival;
  for (let i = 0; i < 100; i++) {
    game.score = i * 20;
    game.spawn();
    assert.ok(game.lastArrival - lastArrival >= 430);
    lastArrival = game.lastArrival;
  }
});

test('a long frame cannot fast-forward the game; invalid time is ignored', () => {
  const game = new Game(); game.reset();
  game.update(60000); assert.equal(game.time, 100);
  game.update(NaN); game.update(-5); assert.equal(game.time, 100);
});

test('repeated restarts discard eggs, penalties, events and previous timing', () => {
  const game = new Game();
  for (let i = 0; i < 20; i++) {
    game.reset(); game.time = 15000; game.score = 123; game.penalty = 5;
    game.spawn(); landing(game, 1);
    game.reset();
    assert.equal(game.time, 0);
    assert.equal(game.score, 0);
    assert.equal(game.penalty, 0);
    assert.equal(game.lane, 0);
    assert.equal(game.lastArrival, 0);
    assert.equal(game.nextSpawn, 600);
    assert.deepEqual(game.eggs, []);
    assert.deepEqual(game.events, []);
  }
});
