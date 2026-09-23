(function (E) {
  'use strict';
  class Sound {
    constructor() { this.enabled = true; this.context = null; this.lastStep = -1; }

    unlock() {
      if (!this.enabled) return;
      try {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        if (!this.context) this.context = new Audio();
        if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      } catch (_) { /* Audio is optional; the game still works if the browser denies it. */ }
    }

    tone(frequency, start, duration, volume = .035) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + .005);
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(this.context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + .01);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }

    play(type) {
      if (!this.enabled || !this.context || this.context.state !== 'running') return;
      const time = this.context.currentTime;
      if (type === 'step') {
        if (time - this.lastStep < .065) return;
        this.lastStep = time;
        this.tone(360, time, .025, .013);
      }
      if (type === 'catch') { this.tone(880, time, .06); this.tone(1320, time + .055, .09); }
      if (type === 'miss') { this.tone(180, time, .12); this.tone(110, time + .09, .18); }
      if (type === 'bonus') [660, 880, 1100, 1320].forEach((n, i) => this.tone(n, time + i * .1, .12));
      if (type === 'over') [440, 330, 220, 110].forEach((n, i) => this.tone(n, time + i * .16, .21));
    }
  }
  E.Sound = Sound;
})(window.Electronics);
