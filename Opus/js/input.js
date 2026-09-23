/*
 * Ввод: клавиатура (keydown) и Pointer Events.
 * Мышь нажимает только нарисованные кнопки; касание работает по всему
 * экрану — он делится на четыре зоны вокруг кнопок, чтобы большие пальцы
 * не промахивались мимо.
 */
(function (NP) {
  'use strict';

  const KEY_CODES = {
    KeyQ: 0, KeyA: 1, KeyP: 2, KeyL: 3,
    Numpad7: 0, Numpad1: 1, Numpad9: 2, Numpad3: 3,
  };
  // Запасной вариант по символу (раскладки, где code недоступен)
  const KEY_CHARS = { q: 0, 'й': 0, a: 1, 'ф': 1, p: 2, 'з': 2, l: 3, 'д': 3 };

  // Границы зон в координатах viewBox корпуса (см. index.html)
  const MID_X = 800;
  const LCD_LEFT = 335, LCD_RIGHT = 1265;
  const SPLIT_Y_SIDE = 487;   // между центрами боковых кнопок
  const SPLIT_Y_LCD = 405;    // между верхними и нижними лотками

  class Input {
    /**
     * handlers: { move(pos), press(pos, down), action(name, event), getWolf() }
     */
    constructor(root, svg, handlers) {
      this.root = root;
      this.svg = svg;
      this.h = handlers;
      this.pointers = new Map();   // pointerId -> pos
      this.keysDown = new Map();   // code -> pos
      this._pt = svg.createSVGPoint();

      this._onKeyDown = this._onKeyDown.bind(this);
      this._onKeyUp = this._onKeyUp.bind(this);
      this._onPointerDown = this._onPointerDown.bind(this);
      this._onPointerMove = this._onPointerMove.bind(this);
      this._onPointerUp = this._onPointerUp.bind(this);
      this._prevent = (e) => e.preventDefault();

      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup', this._onKeyUp);
      root.addEventListener('pointerdown', this._onPointerDown);
      window.addEventListener('pointermove', this._onPointerMove, { passive: true });
      window.addEventListener('pointerup', this._onPointerUp);
      window.addEventListener('pointercancel', this._onPointerUp);
      // Долгое нажатие, двойной тап, pinch — не должны мешать игре.
      document.addEventListener('contextmenu', this._prevent);
      document.addEventListener('gesturestart', this._prevent);
      document.addEventListener('dblclick', this._prevent);
      root.addEventListener('touchstart', this._prevent, { passive: false });
    }

    /** Отпустить все удерживаемые кнопки (потеря фокуса, пауза). */
    releaseAll() {
      for (const pos of this.pointers.values()) this.h.press(pos, false);
      for (const pos of this.keysDown.values()) this.h.press(pos, false);
      this.pointers.clear();
      this.keysDown.clear();
    }

    // ---------- клавиатура ----------

    _keyToPos(e) {
      if (e.code in KEY_CODES) return KEY_CODES[e.code];
      const ch = (e.key || '').toLowerCase();
      if (ch in KEY_CHARS) return KEY_CHARS[ch];
      const wolf = this.h.getWolf();
      const left = wolf < 2, upper = wolf % 2 === 0;
      switch (e.key) {
        case 'ArrowUp': return left ? 0 : 2;
        case 'ArrowDown': return left ? 1 : 3;
        case 'ArrowLeft': return upper ? 0 : 1;
        case 'ArrowRight': return upper ? 2 : 3;
        default: return -1;
      }
    }

    _onKeyDown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const named = { Enter: 'enter', ' ': 'space', Escape: 'escape' }[e.key];
      if (named) {
        e.preventDefault();
        if (!e.repeat) this.h.action(named, e);
        return;
      }
      if (e.code === 'KeyM' || (e.key || '').toLowerCase() === 'ь') {
        if (!e.repeat) this.h.action('sound', e);
        return;
      }

      const pos = this._keyToPos(e);
      if (pos < 0) return;
      e.preventDefault();
      if (!e.repeat && !this.keysDown.has(e.code)) {
        this.keysDown.set(e.code, pos);
        this.h.press(pos, true);
      }
      this.h.move(pos);
    }

    _onKeyUp(e) {
      const pos = this.keysDown.get(e.code);
      if (pos === undefined) return;
      this.keysDown.delete(e.code);
      this.h.press(pos, false);
    }

    // ---------- указатель ----------

    _zone(e) {
      const ctm = this.svg.getScreenCTM();
      if (!ctm) return -1;
      this._pt.x = e.clientX;
      this._pt.y = e.clientY;
      const p = this._pt.matrixTransform(ctm.inverse());
      const inLcd = p.x > LCD_LEFT && p.x < LCD_RIGHT;
      const upper = p.y < (inLcd ? SPLIT_Y_LCD : SPLIT_Y_SIDE);
      return (p.x < MID_X ? 0 : 2) + (upper ? 0 : 1);
    }

    _onPointerDown(e) {
      if (e.button > 0) return;
      const actionEl = e.target.closest && e.target.closest('[data-action]');
      if (actionEl) {
        e.preventDefault();
        this.h.action(actionEl.getAttribute('data-action'), e);
        if (actionEl.classList.contains('pill')) {
          actionEl.classList.add('pressed');
          setTimeout(() => actionEl.classList.remove('pressed'), 120);
        }
        return;
      }

      let pos = -1;
      const btn = e.target.closest && e.target.closest('[data-btn]');
      if (btn) pos = +btn.getAttribute('data-btn');
      else if (e.pointerType !== 'mouse') pos = this._zone(e);
      if (pos < 0) return;

      e.preventDefault();
      this.h.action('unlock', e);
      this._setPointer(e.pointerId, pos);
    }

    _onPointerMove(e) {
      if (!this.pointers.has(e.pointerId) || e.pointerType === 'mouse') return;
      const pos = this._zone(e);
      if (pos >= 0) this._setPointer(e.pointerId, pos);
    }

    _onPointerUp(e) {
      const pos = this.pointers.get(e.pointerId);
      if (pos === undefined) return;
      this.pointers.delete(e.pointerId);
      this.h.press(pos, false);
    }

    _setPointer(id, pos) {
      const prev = this.pointers.get(id);
      if (prev === pos) return;
      if (prev !== undefined) this.h.press(prev, false);
      this.pointers.set(id, pos);
      this.h.press(pos, true);
      this.h.move(pos);
    }
  }

  NP.Input = Input;
})(window.NuPogodi = window.NuPogodi || {});
