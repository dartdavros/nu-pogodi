/*
 * Игровая механика «Ну, погоди!» — без DOM и без координат.
 * Состояние меняется только через start/pause/resume/setWolf/update.
 * update(dt) возвращает список событий, которые потребляют отображение и звук.
 */
(function (NP) {
  'use strict';

  // Положения Волка и номера лотков совпадают.
  const POS = { UL: 0, LL: 1, UR: 2, LR: 3 };
  const LANES = 4;
  const STEPS = 5;                  // дискретных позиций яйца на лотке
  const MAX_PENALTY_HALVES = 6;     // 3 штрафных очка, хранятся в половинках
  const MISS_FREEZE_MS = 1100;      // пауза после промаха, пока разбивается яйцо
  const PENALTY_RESET_SCORES = [200, 500];
  const MOVE_FRACTION = 0.55;       // доля такта, за которую яйцо перекатывается

  /*
   * Интенсивность растёт внутри каждой сотни и немного откатывается
   * в начале следующей: 0..1 на первой сотне, 0.6..1.6 на второй и т.д.
   */
  function intensity(total) {
    const hundreds = Math.floor(total / 100);
    const within = total % 100;
    return Math.min(6.5, hundreds * 0.6 + within / 100);
  }

  // Длительность одного шага яиц, мс: ~620 в начале, ~230 на максимуме.
  function stepInterval(total) {
    return 200 + 420 * Math.exp(-0.42 * intensity(total));
  }

  // Средний интервал между появлениями яиц в тактах: 2.7 → 1.2.
  function spawnGap(total) {
    return Math.max(1.2, 2.7 - 0.4 * intensity(total));
  }

  function randRange(random, min, max) {
    return min + (max - min) * random();
  }

  class Engine {
    constructor(random) {
      this.random = random || Math.random;
      this.state = this._freshState('idle', POS.LL);
      this._acc = 0;
      this._spawnIn = 1;
      this._hareTimer = 0;
      this._nextId = 1;
    }

    _freshState(phase, wolf) {
      return {
        phase,              // 'idle' | 'playing' | 'paused' | 'over'
        time: 0,            // игровое время, мс (стоит на паузе)
        score: 0,           // трёхзначный счёт на табло
        total: 0,           // всего поймано за игру (для сложности и рекорда)
        penaltyHalves: 0,   // штраф в половинах очка
        wolf,
        eggs: [],           // { id, lane, step, prevStep, movedAt, moveDur }, по убыванию step
        hareVisible: false,
        hareChangedAt: -1e9,
        freezeUntil: 0,
        lastCatchAt: -1e9,
        overAt: 0,
        interval: stepInterval(0),
      };
    }

    start() {
      this.state = this._freshState('playing', this.state.wolf);
      this._acc = 0;
      this._spawnIn = 1;
      this._hareTimer = randRange(this.random, 5000, 9000);
      this._nextId = 1;
    }

    pause() {
      if (this.state.phase !== 'playing') return false;
      this.state.phase = 'paused';
      return true;
    }

    resume() {
      if (this.state.phase !== 'paused') return false;
      this.state.phase = 'playing';
      return true;
    }

    /** Мгновенно переставляет Волка. Возвращает true, если положение изменилось. */
    setWolf(pos) {
      if (!(pos >= 0 && pos < LANES)) return false;
      if (this.state.phase === 'paused') return false;
      if (this.state.wolf === pos) return false;
      this.state.wolf = pos;
      return true;
    }

    update(dt) {
      const s = this.state;
      const events = [];
      if (s.phase === 'paused' || !(dt > 0)) return events;
      s.time += dt;
      if (s.phase !== 'playing') return events;

      this._updateHare(dt, events);
      if (s.time < s.freezeUntil) return events;

      this._acc += dt;
      // Не больше двух тактов за кадр: резкий провал FPS не «проматывает» игру.
      for (let i = 0; i < 2 && s.phase === 'playing'; i++) {
        const interval = stepInterval(s.total);
        if (this._acc < interval) break;
        this._acc -= interval;
        this._tick(events, interval, s.time - this._acc);
        if (s.freezeUntil > s.time) { this._acc = 0; break; }
      }
      if (s.phase === 'playing') {
        this._acc = Math.min(this._acc, stepInterval(s.total));
      }
      return events;
    }

    _updateHare(dt, events) {
      const s = this.state;
      this._hareTimer -= dt;
      if (this._hareTimer > 0) return;
      s.hareVisible = !s.hareVisible;
      s.hareChangedAt = s.time;
      this._hareTimer = s.hareVisible
        ? randRange(this.random, 3500, 6500)
        : randRange(this.random, 6000, 14000);
      events.push({ type: 'hare', visible: s.hareVisible });
    }

    _tick(events, interval, t) {
      const s = this.state;
      s.interval = interval;

      // Яйца идут синхронно и всегда стоят на разных шагах, поэтому
      // за один такт до конца лотка доходит не больше одного яйца.
      const remaining = [];
      for (let i = 0; i < s.eggs.length; i++) {
        const egg = s.eggs[i];
        if (egg.step === STEPS - 1) {
          this._resolve(egg, t, events);
          if (s.phase !== 'playing') {
            // Игра окончена: остальные яйца застывают на своих местах.
            s.eggs = remaining.concat(s.eggs.slice(i + 1));
            return;
          }
        } else {
          egg.prevStep = egg.step;
          egg.step += 1;
          egg.movedAt = t;
          egg.moveDur = interval * MOVE_FRACTION;
          remaining.push(egg);
        }
      }
      s.eggs = remaining;

      this._spawnIn -= 1;
      if (this._spawnIn <= 0) {
        const lane = Math.floor(this.random() * LANES);
        s.eggs.push({
          id: this._nextId++, lane, step: 0, prevStep: -1,
          movedAt: t, moveDur: interval * MOVE_FRACTION,
        });
        events.push({ type: 'spawn', lane });
        const gap = spawnGap(s.total);
        const base = Math.floor(gap);
        this._spawnIn = base + (this.random() < gap - base ? 1 : 0);
      }

      if (s.eggs.length) {
        events.push({ type: 'step', lane: s.eggs[0].lane, step: s.eggs[0].step });
      }
    }

    _resolve(egg, t, events) {
      const s = this.state;
      if (s.wolf === egg.lane) {
        s.total += 1;
        s.score = s.total % 1000;
        s.lastCatchAt = t;
        events.push({ type: 'catch', lane: egg.lane, score: s.score, total: s.total, at: t });
        if (PENALTY_RESET_SCORES.includes(s.score) && s.penaltyHalves > 0) {
          s.penaltyHalves = 0;
          events.push({ type: 'penaltyReset' });
        }
        if (s.total % 100 === 0) events.push({ type: 'hundred', total: s.total });
        return;
      }

      const halves = s.hareVisible ? 1 : 2;
      s.penaltyHalves = Math.min(MAX_PENALTY_HALVES, s.penaltyHalves + halves);
      s.freezeUntil = t + MISS_FREEZE_MS;
      events.push({ type: 'miss', lane: egg.lane, hare: s.hareVisible, halves, at: t });
      if (s.penaltyHalves >= MAX_PENALTY_HALVES) {
        s.phase = 'over';
        s.overAt = t;
        events.push({ type: 'gameover', score: s.score, total: s.total });
      }
    }
  }

  NP.Engine = Engine;
  NP.rules = {
    POS, LANES, STEPS, MAX_PENALTY_HALVES, MISS_FREEZE_MS,
    PENALTY_RESET_SCORES, intensity, stepInterval, spawnGap,
  };
})(window.NuPogodi = window.NuPogodi || {});
