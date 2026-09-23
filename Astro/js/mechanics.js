(function (root) {
  'use strict';
  const STEPS = 5;

  function tempo(score) {
    const relief = score >= 100 ? Math.max(0, 1 - (score % 100) / 22) : 0;
    const pressure = 1 - Math.exp(-score / 190);
    return {
      step: 760 - 535 * pressure + 125 * relief,
      spawn: 2050 - 1500 * pressure + 260 * relief
    };
  }

  // Pure game state: no DOM, coordinates, audio, timers or browser storage.
  class Game {
    constructor(random = Math.random) {
      this.random = random;
      this.reset();
      this.status = 'ready';
    }

    reset() {
      this.status = 'running';
      this.time = 0;
      this.score = 0;
      this.penalty = 0; // One unit is HALF a penalty. Six units end the game.
      this.lane = 0;
      this.bunny = false;
      this.eggs = [];
      this.events = [];
      this.nextSpawn = 600;
      this.lastArrival = 0;
      this.lastLane = -1;
      this.nextId = 1;
    }

    move(lane) {
      if (this.status === 'running' && Number.isInteger(lane) && lane >= 0 && lane < 4) {
        this.lane = lane;
      }
    }

    spawn() {
      let lane = Math.min(3, Math.floor(this.random() * 4));
      // Avoid long runs on one lane without making the sequence predictable.
      if (lane === this.lastLane && this.random() < 0.65) lane = (lane + 1 + Math.floor(this.random() * 3)) % 4;
      const speed = tempo(this.score);
      const arrival = Math.max(this.time + STEPS * speed.step, this.lastArrival + 430);
      this.eggs.push({ id: this.nextId++, lane, born: this.time, duration: arrival - this.time, step: 0 });
      this.lastLane = lane;
      this.lastArrival = arrival;
      this.nextSpawn = this.time + speed.spawn * (0.92 + this.random() * 0.16);
    }

    resolve(egg) {
      if (egg.lane === this.lane) {
        this.score++;
        this.events.push({ type: 'catch', lane: egg.lane });
        if (this.score % 1000 === 200 || this.score % 1000 === 500) {
          this.penalty = 0;
          this.events.push({ type: 'bonus' });
        }
      } else {
        const units = this.bunny ? 1 : 2;
        this.penalty += units;
        this.events.push({ type: 'miss', lane: egg.lane, units });
        if (this.penalty >= 6) {
          this.status = 'over';
          this.events.push({ type: 'over' });
        }
      }
    }

    update(delta) {
      this.events = [];
      if (this.status !== 'running' || !Number.isFinite(delta) || delta <= 0) return this.events;
      // A stalled frame cannot run several seconds of unseen gameplay.
      this.time += Math.min(delta, 100);
      this.bunny = this.time % 18000 >= 9000 && this.time % 18000 < 14000;
      if (this.time >= this.nextSpawn) this.spawn();
      const expired = new Set();
      for (const egg of this.eggs) {
        const step = Math.min(STEPS, Math.floor((this.time - egg.born) / (egg.duration / STEPS)));
        if (step > egg.step) {
          egg.step = step;
          if (step < STEPS) this.events.push({ type: 'step', lane: egg.lane });
        }
        if (this.time - egg.born >= egg.duration) {
          expired.add(egg.id);
          this.resolve(egg);
          if (this.status === 'over') break;
        }
      }
      this.eggs = this.eggs.filter(egg => !expired.has(egg.id));
      return this.events;
    }

    get displayScore() { return String(this.score % 1000).padStart(3, '0'); }
  }

  root.Electronics = { Game, tempo, STEPS };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Electronics;
})(typeof window !== 'undefined' ? window : globalThis);
