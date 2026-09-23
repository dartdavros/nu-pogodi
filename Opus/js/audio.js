/*
 * Синтезированные звуки (Web Audio API). AudioContext создаётся
 * только после первого действия пользователя — см. unlock().
 */
(function (NP) {
  'use strict';

  const MUTE_KEY = 'nupogodi.muted';
  const LANE_TONES = [660, 494, 784, 587];

  function readMuted() {
    try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; }
  }

  const Sound = {
    ctx: null,
    master: null,
    muted: readMuted(),

    unlock() {
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        try {
          this.ctx = new Ctx();
        } catch (e) {
          return;
        }
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.22;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    },

    setMuted(muted) {
      this.muted = !!muted;
      try { localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0'); } catch (e) { /* приватный режим */ }
      if (this.master) {
        const t = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(t);
        this.master.gain.setTargetAtTime(this.muted ? 0 : 0.22, t, 0.01);
      }
    },

    toggle() {
      this.setMuted(!this.muted);
      return this.muted;
    },

    _ready() {
      return !!this.ctx && this.ctx.state !== 'closed' && !this.muted;
    },

    /** Одна нота с короткой атакой и экспоненциальным затуханием. */
    _tone(freq, dur, opts) {
      const o = opts || {};
      const ctx = this.ctx;
      const t0 = ctx.currentTime + (o.delay || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = o.type || 'square';
      osc.frequency.setValueAtTime(freq, t0);
      if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
      const vol = o.vol == null ? 0.5 : o.vol;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    },

    _seq(notes, stepDur, opts) {
      notes.forEach((f, i) => {
        this._tone(f, stepDur * 0.9, Object.assign({}, opts, { delay: (opts && opts.delay || 0) + i * stepDur }));
      });
    },

    step(lane) {
      if (!this._ready()) return;
      this._tone(LANE_TONES[lane] || 600, 0.045, { vol: 0.28 });
    },

    catch() {
      if (!this._ready()) return;
      this._tone(988, 0.06, { type: 'triangle', vol: 0.6 });
      this._tone(1319, 0.09, { type: 'triangle', vol: 0.6, delay: 0.055 });
    },

    miss() {
      if (!this._ready()) return;
      this._tone(420, 0.32, { type: 'sawtooth', slideTo: 90, vol: 0.45 });
      // писк убегающего цыплёнка
      this._tone(2100, 0.035, { type: 'sine', vol: 0.3, delay: 0.5 });
      this._tone(2400, 0.035, { type: 'sine', vol: 0.3, delay: 0.62 });
      this._tone(2100, 0.035, { type: 'sine', vol: 0.3, delay: 0.74 });
    },

    gameOver() {
      if (!this._ready()) return;
      this._seq([659, 523, 440, 349, 262], 0.2, { type: 'square', vol: 0.35, delay: 0.45 });
    },

    start() {
      if (!this._ready()) return;
      this._seq([523, 659, 784, 1047], 0.08, { type: 'square', vol: 0.3 });
    },

    bonus() {
      if (!this._ready()) return;
      this._seq([784, 988, 1175, 1568], 0.07, { type: 'triangle', vol: 0.5 });
    },

    hare(visible) {
      if (!this._ready()) return;
      this._tone(visible ? 1200 : 1500, 0.07, { type: 'sine', slideTo: visible ? 1700 : 1000, vol: 0.18 });
    },

    click() {
      if (!this._ready()) return;
      this._tone(1800, 0.02, { type: 'square', vol: 0.12 });
    },
  };

  NP.Sound = Sound;
})(window.NuPogodi = window.NuPogodi || {});
