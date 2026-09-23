/*
 * SVG-отображение: строит LCD-сцену и каждый кадр отражает в ней
 * состояние движка. Сам движок о координатах ничего не знает.
 */
(function (NP) {
  'use strict';

  const SVGNS = 'http://www.w3.org/2000/svg';
  const W = 890;                        // ширина LCD в локальных координатах
  const FLOOR_Y = 652;
  const U = [0.1, 0.3, 0.5, 0.7, 0.9];  // позиции яйца вдоль лотка
  const U_SPAWN = -0.06;                // яйцо «выкатывается» из-под курицы
  const U_TIP = 1.04;                   // край лотка
  const EGG_LIFT = 24;                  // центр яйца над осью лотка
  const OVER_DELAY = 900;               // экран Game Over после анимации промаха

  function el(tag, attrs, parent) {
    const node = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function group(parent, attrs, markup) {
    const g = el('g', attrs, parent);
    if (markup) g.innerHTML = markup;
    return g;
  }

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------- геометрия лотков ----------

  const LEFT_RAMPS = [
    { a: [72, 218], b: [286, 302] },   // верхний
    { a: [72, 403], b: [286, 487] },   // нижний
  ];

  const LANES = [0, 1, 2, 3].map((lane) => {
    const left = lane < 2;
    const upper = lane % 2 === 0;
    const mx = (x) => (left ? x : W - x);
    const base = LEFT_RAMPS[upper ? 0 : 1];
    const a = [mx(base.a[0]), base.a[1]];
    const b = [mx(base.b[0]), base.b[1]];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    let nx = dy / len;
    let ny = -dx / len;
    if (ny > 0) { nx = -nx; ny = -ny; }
    return {
      left, upper, dir: left ? 1 : -1, a, b, nx, ny,
      angle: Math.atan2(dy, dx) * 180 / Math.PI,
      basket: [mx(300), upper ? 336 : 521],
      breakAt: [mx(330), FLOOR_Y - 10],
    };
  });

  function eggPoint(lane, u) {
    const g = LANES[lane];
    return [
      g.a[0] + (g.b[0] - g.a[0]) * u + g.nx * EGG_LIFT,
      g.a[1] + (g.b[1] - g.a[1]) * u + g.ny * EGG_LIFT,
    ];
  }

  // ---------- рисунки ----------

  const EGG_ART =
    '<ellipse class="ink" rx="15" ry="19"/>' +
    '<ellipse class="bg" cx="-5" cy="-7" rx="3.6" ry="5.6" opacity=".6"/>';

  const HEN_ART = // смотрит вправо, начало координат — под курицей
    '<path class="ink-s" d="M-44,4 H38" stroke-width="6"/>' +
    '<path class="ink" d="M-26,-16 L-40,-38 L-34,-30 L-38,-44 L-24,-24 Z"/>' +
    '<ellipse class="ink" cx="-4" cy="-15" rx="24" ry="15"/>' +
    '<path class="bg-s" d="M-16,-18 q10,10 22,0" stroke-width="3"/>' +
    '<path class="ink" d="M8,-22 L14,-38 L24,-34 L20,-18 Z"/>' +
    '<circle class="ink" cx="18" cy="-38" r="10"/>' +
    '<path class="ink" d="M10,-46 q2,-9 7,-4 q3,-8 7,-1 q4,-5 5,3 Z"/>' +
    '<path class="ink" d="M27,-40 L37,-36 L27,-32 Z"/>' +
    '<circle class="bg" cx="21" cy="-40" r="2.6"/>';

  const CHICK_ART = // смотрит вправо, начало координат — у лап
    '<ellipse class="ink" cx="0" cy="-13" rx="12" ry="10"/>' +
    '<circle class="ink" cx="9" cy="-24" r="7.5"/>' +
    '<path class="ink" d="M15,-26 L23,-23 L15,-20 Z"/>' +
    '<circle class="bg" cx="11" cy="-26" r="1.8"/>' +
    '<path class="bg-s" d="M-7,-15 q5,5 11,0" stroke-width="2.2"/>' +
    '<g class="legs-a"><path class="ink-s" d="M-3,-4 L-7,0 M4,-4 L7,0" stroke-width="3"/></g>' +
    '<g class="legs-b"><path class="ink-s" d="M-3,-4 L-1,0 M4,-4 L1,0" stroke-width="3"/></g>';

  const BASKET_ART = // центр — точка, куда падает яйцо
    '<path class="ink" d="M-42,-18 L42,-18 L33,22 L-33,22 Z"/>' +
    '<path class="bg-s" d="M-36,-4 H36 M-33,9 H33 M-14,-16 L-12,20 M14,-16 L12,20" stroke-width="3"/>' +
    '<ellipse class="ink" cx="0" cy="-18" rx="44" ry="8"/>' +
    '<ellipse class="bg" cx="0" cy="-18" rx="35" ry="3.6"/>';

  // Волк смотрит влево; для правых положений группа зеркалится.
  const WOLF_BODY =
    '<path class="ink" d="M504,470 C536,468 560,488 566,520 C552,512 538,510 526,514 C534,500 522,490 506,490 Z"/>' +
    '<path class="ink" d="M412,498 L460,500 L452,560 L464,612 L416,612 L428,560 Z"/>' +
    '<path class="ink" d="M462,500 L510,498 L500,560 L512,612 L466,612 L474,560 Z"/>' +
    '<path class="bg-s" d="M430,560 H452 M476,560 H499" stroke-width="3"/>' +
    '<path class="ink" d="M418,614 L462,614 L462,638 L396,638 C394,626 404,616 418,614 Z"/>' +
    '<path class="ink" d="M472,614 L514,614 L516,638 L452,638 C452,628 460,616 472,614 Z"/>' +
    '<path class="ink" d="M446,294 L484,294 L482,328 L450,328 Z"/>' +
    '<path class="ink" d="M418,324 C440,314 488,314 508,324 L516,440 C516,472 502,502 470,506 L442,506 C414,502 402,472 404,440 Z"/>' +
    '<g clip-path="url(#wolfTorsoClip)"><path class="bg-s" d="M398,346 H522 M398,370 H522 M398,394 H522 M398,418 H522 M398,442 H522 M398,466 H522" stroke-width="8"/></g>' +
    '<rect class="ink" x="404" y="488" width="112" height="16" rx="4"/>' +
    '<ellipse class="ink" cx="466" cy="264" rx="46" ry="40"/>' +
    '<path class="ink" d="M444,246 C414,242 388,254 374,268 C366,278 370,294 386,298 L448,302 Z"/>' +
    '<ellipse class="ink" cx="372" cy="272" rx="13" ry="10.5"/>' +
    '<ellipse class="bg" cx="367" cy="268" rx="4" ry="2.6"/>' +
    '<path class="ink" d="M472,234 L494,190 L504,246 Z"/>' +
    '<path class="bg" d="M482,232 L492,208 L497,238 Z"/>' +
    '<path class="ink" d="M444,236 L452,194 L474,230 Z"/>' +
    '<path class="ink" d="M506,252 L532,266 L508,282 Z"/>' +
    '<ellipse class="bg" cx="438" cy="252" rx="12" ry="14"/>' +
    '<circle class="ink" cx="433" cy="255" r="5.5"/>' +
    '<path class="bg-s" d="M420,232 L454,240" stroke-width="4.5"/>' +
    '<path class="bg-s" d="M388,290 Q416,300 446,286" stroke-width="3.5"/>' +
    '<path class="bg" d="M404,293 L412,294 L407,302 Z"/>';

  const WOLF_ARMS_UP =
    '<path class="ink-s" d="M430,344 C398,332 360,318 332,312" stroke-width="17"/>' +
    '<path class="ink-s" d="M442,374 C408,368 368,346 338,330" stroke-width="17"/>' +
    '<g transform="translate(300,336)">' + BASKET_ART + '</g>' +
    '<circle class="ink" cx="334" cy="313" r="11"/><circle class="ink" cx="340" cy="330" r="11"/>';

  const WOLF_ARMS_DOWN =
    '<path class="ink-s" d="M424,342 C392,376 372,446 338,496" stroke-width="17"/>' +
    '<path class="ink-s" d="M430,372 C400,414 384,480 344,514" stroke-width="17"/>' +
    '<g transform="translate(300,521)">' + BASKET_ART + '</g>' +
    '<circle class="ink" cx="338" cy="497" r="11"/><circle class="ink" cx="344" cy="514" r="11"/>';

  const HARE_ART = // в координатах окна
    '<path class="ink" d="M52,148 C52,120 62,110 86,110 C110,110 120,120 120,148 Z"/>' +
    '<ellipse class="ink" cx="72" cy="46" rx="8" ry="30" transform="rotate(-12 72 46)"/>' +
    '<ellipse class="bg" cx="72" cy="48" rx="3" ry="20" transform="rotate(-12 72 48)"/>' +
    '<ellipse class="ink" cx="100" cy="44" rx="8" ry="30" transform="rotate(10 100 44)"/>' +
    '<ellipse class="bg" cx="100" cy="46" rx="3" ry="20" transform="rotate(10 100 46)"/>' +
    '<circle class="ink" cx="86" cy="94" r="25"/>' +
    '<ellipse class="bg" cx="77" cy="90" rx="6" ry="7.5"/><ellipse class="bg" cx="95" cy="90" rx="6" ry="7.5"/>' +
    '<circle class="ink" cx="78" cy="92" r="3"/><circle class="ink" cx="94" cy="92" r="3"/>' +
    '<ellipse class="bg" cx="86" cy="104" rx="5" ry="3.5"/>' +
    '<path class="bg-s" d="M78,110 Q86,116 94,110" stroke-width="2.5"/>' +
    '<path class="bg" d="M83,112 h6 v6 h-6 Z"/>' +
    '<g class="hare-paw"><path class="ink-s" d="M112,118 L128,94" stroke-width="10"/><circle class="ink" cx="129" cy="90" r="8"/></g>';

  // Семисегментные цифры
  const DIGITS = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];

  function segmentPolys(x0, y0, w, h, t) {
    const g = 2.2;
    const L = x0 + t / 2, R = x0 + w - t / 2, T = y0 + t / 2, M = y0 + h / 2, B = y0 + h - t / 2;
    const hs = (x1, x2, y) => [[x1, y], [x1 + t / 2, y - t / 2], [x2 - t / 2, y - t / 2], [x2, y], [x2 - t / 2, y + t / 2], [x1 + t / 2, y + t / 2]];
    const vs = (x, y1, y2) => [[x, y1], [x + t / 2, y1 + t / 2], [x + t / 2, y2 - t / 2], [x, y2], [x - t / 2, y2 - t / 2], [x - t / 2, y1 + t / 2]];
    const polys = {
      a: hs(L + g, R - g, T), g: hs(L + g, R - g, M), d: hs(L + g, R - g, B),
      f: vs(L, T + g, M - g), b: vs(R, T + g, M - g), e: vs(L, M + g, B - g), c: vs(R, M + g, B - g),
    };
    const out = {};
    for (const k in polys) out[k] = polys[k].map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    return out;
  }

  // ---------- View ----------

  class View {
    constructor(svg) {
      this.svg = svg;
      this.lcd = svg.querySelector('#lcd-scene');
      this.touch = false;
      this.best = 0;
      this.newBest = false;
      this.eggEls = new Map();
      this.fx = [];
      this.pressed = [0, 0, 0, 0];
      this._cache = {};
      this.overlayReadyAt = 0;
      this._build();
    }

    _build() {
      const root = this.lcd;
      root.innerHTML = '';

      // «Печатный» фон и неактивные сегменты
      const back = group(root, { class: 'lcd-back' });
      el('path', { class: 'ink-s floor', d: `M0,${FLOOR_Y} H${W}`, 'stroke-width': 3 }, back);
      for (let i = 0; i < 18; i++) {
        el('path', { class: 'ink-s grass', d: `M${20 + i * 50},${FLOOR_Y} l6,-9 l6,9`, 'stroke-width': 2 }, back);
      }

      const ghost = group(root, { class: 'ghost' });
      for (let lane = 0; lane < 4; lane++) {
        const g = LANES[lane];
        for (const u of U) {
          const [x, y] = eggPoint(lane, u);
          group(ghost, { transform: `translate(${x.toFixed(1)},${y.toFixed(1)})` }, EGG_ART);
        }
        const flip = g.left ? '' : `translate(${W},0) scale(-1,1)`;
        group(ghost, { transform: flip }, g.upper ? WOLF_ARMS_UP : WOLF_ARMS_DOWN);
      }

      // Лотки и куры
      const ramps = group(root, { class: 'ramps' });
      for (let lane = 0; lane < 4; lane++) {
        const g = LANES[lane];
        const d = `M${g.a[0]},${g.a[1]} L${g.b[0]},${g.b[1]}`;
        el('path', { class: 'ink-s', d, 'stroke-width': 11 }, ramps);
        el('path', { class: 'bg-s', d, 'stroke-width': 3 }, ramps);
        const px = lerp(g.a[0], g.b[0], 0.55);
        const py = lerp(g.a[1], g.b[1], 0.55);
        el('path', { class: 'ink-s', d: `M${px},${py} L${px},${py + 26} M${px - 10 * g.dir},${py + 26} H${px + 10 * g.dir}`, 'stroke-width': 5 }, ramps);
        const hx = g.a[0] - 26 * g.dir;
        const hy = g.a[1] - 4;
        group(ramps, { transform: `translate(${hx},${hy}) scale(${g.dir},1)` }, HEN_ART);
      }

      // Окно с Зайцем
      const win = group(root, { class: 'hare-window', transform: 'translate(14,12)' });
      const defs = el('defs', null, win);
      const clip = el('clipPath', { id: 'hareClip' }, defs);
      el('rect', { x: 6, y: 6, width: 160, height: 128 }, clip);
      el('rect', { class: 'window-glass', x: 6, y: 6, width: 160, height: 128 }, win);
      const hareClip = group(win, { 'clip-path': 'url(#hareClip)' });
      this.hare = group(hareClip, { class: 'hare' }, HARE_ART);
      el('rect', { class: 'ink-s', x: 3, y: 3, width: 166, height: 134, rx: 4, 'stroke-width': 6 }, win);
      el('rect', { class: 'ink', x: -4, y: 134, width: 180, height: 10, rx: 3 }, win);

      // Рекорд
      const rec = group(root, { class: 'record' });
      el('text', { class: 'lcd-text small', x: 262, y: 42, 'text-anchor': 'middle' }, rec).textContent = 'РЕКОРД';
      this.bestText = el('text', { class: 'lcd-text best', x: 262, y: 80, 'text-anchor': 'middle' }, rec);

      // Счёт
      const score = group(root, { class: 'score', transform: 'skewX(-6)' });
      this.digitSegs = [];
      for (let i = 0; i < 3; i++) {
        const polys = segmentPolys(352 + i * 76, 18, 58, 100, 12);
        const segs = {};
        for (const k in polys) {
          el('polygon', { class: 'ink ghost-seg', points: polys[k] }, score);
          segs[k] = el('polygon', { class: 'ink seg', points: polys[k] }, score);
        }
        this.digitSegs.push(segs);
      }

      // Штрафы
      const pen = group(root, { class: 'penalties' });
      this.penIcons = [];
      for (let i = 0; i < 3; i++) {
        const x = 690 + i * 64;
        group(pen, { class: 'ghost-seg', transform: `translate(${x},82) scale(1.5)` }, CHICK_ART);
        this.penIcons.push(group(pen, { class: 'pen', transform: `translate(${x},82) scale(1.5)` }, CHICK_ART));
      }
      el('text', { class: 'lcd-text small', x: 754, y: 112, 'text-anchor': 'middle' }, pen).textContent = 'ШТРАФ';

      // Слои динамики: яйца и эффекты — под Волком, чтобы «падать в корзину».
      this.eggLayer = group(root, { class: 'eggs' });
      this.fxLayer = group(root, { class: 'fx' });

      // Волк
      this.wolf = group(root, { class: 'wolf' });
      group(this.wolf, null, WOLF_BODY);
      this.armsUp = group(this.wolf, { class: 'arms' }, WOLF_ARMS_UP);
      this.armsDown = group(this.wolf, { class: 'arms' }, WOLF_ARMS_DOWN);

      this.overlay = group(root, { class: 'overlay', 'data-action': 'overlay' });
    }

    setMode(touch) {
      if (this.touch === touch) return;
      this.touch = touch;
      this._cache.overlay = null;
    }

    setBest(best, isNew) {
      this.best = best;
      this.newBest = !!isNew;
    }

    setPressed(pos, down) {
      this.pressed[pos] = Math.max(0, this.pressed[pos] + (down ? 1 : -1));
      const btn = this.svg.querySelector(`[data-btn="${pos}"]`);
      if (btn) btn.classList.toggle('pressed', this.pressed[pos] > 0);
    }

    flashPressed(pos) {
      this.setPressed(pos, true);
      setTimeout(() => this.setPressed(pos, false), 110);
    }

    releaseAll() {
      for (let i = 0; i < 4; i++) { this.pressed[i] = 1; this.setPressed(i, false); }
    }

    setSoundLabel(muted) {
      const t = this.svg.querySelector('#sound-label');
      if (t) t.textContent = muted ? 'ЗВУК ВЫКЛ' : 'ЗВУК ВКЛ';
      const slash = this.svg.querySelector('#sound-slash');
      if (slash) slash.style.display = muted ? '' : 'none';
    }

    /** Новая игра: убрать всё, что осталось от прошлой. */
    reset() {
      for (const f of this.fx) f.node.remove();
      this.fx = [];
      for (const node of this.eggEls.values()) node.remove();
      this.eggEls.clear();
      this._cache = {};
      this.newBest = false;
    }

    // ---------- эффекты ----------

    fxCatch(lane, at) {
      const node = group(this.fxLayer, null, EGG_ART);
      const from = eggPoint(lane, U[U.length - 1]);
      const to = LANES[lane].basket;
      this.fx.push({
        node, start: at, dur: 170,
        update: (p) => {
          const e = easeInOut(p);
          const x = lerp(from[0], to[0], e);
          const y = lerp(from[1], to[1], e) - Math.sin(p * Math.PI) * 10;
          node.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${(1 - 0.3 * p).toFixed(3)})`);
        },
      });
    }

    fxMiss(lane, at) {
      const g = LANES[lane];
      const node = group(this.fxLayer, { class: 'miss' });
      const egg = group(node, null, EGG_ART);
      const broken = group(node, { class: 'broken', transform: `translate(${g.breakAt[0]},${g.breakAt[1]})` },
        '<ellipse class="ink" cx="0" cy="6" rx="26" ry="6"/>' +
        '<path class="ink" d="M-24,4 L-22,-10 L-16,-4 L-12,-14 L-8,-4 L-6,6 Z"/>' +
        '<path class="ink" d="M24,4 L22,-12 L17,-5 L12,-15 L9,-3 L6,6 Z"/>' +
        '<ellipse class="bg" cx="0" cy="5" rx="9" ry="3"/>');
      const chick = group(node, { class: 'chick' });
      const chickArt = group(chick, { transform: `scale(${g.dir * 1.4},1.4)` }, CHICK_ART);
      const legsA = chickArt.querySelector('.legs-a');
      const legsB = chickArt.querySelector('.legs-b');
      const from = eggPoint(lane, U[U.length - 1]);
      const tip = eggPoint(lane, U_TIP);
      const land = g.breakAt;
      const runTo = g.left ? -40 : W + 40;
      broken.style.display = 'none';
      chick.style.display = 'none';

      this.fx.push({
        node, start: at, dur: 1500,
        update: (_p, ms) => {
          if (ms < 110) {
            const t = ms / 110;
            const x = lerp(from[0], tip[0], t), y = lerp(from[1], tip[1], t);
            egg.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${(g.dir * (440 + t * 60)).toFixed(0)})`);
          } else if (ms < 380) {
            const t = (ms - 110) / 270;
            const x = lerp(tip[0], land[0], t);
            const y = tip[1] + (land[1] - tip[1]) * t * t;
            egg.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${(g.dir * (500 + t * 200)).toFixed(0)})`);
          } else {
            egg.style.display = 'none';
            broken.style.display = '';
            broken.setAttribute('opacity', ms > 1200 ? (1 - (ms - 1200) / 300).toFixed(2) : '1');
          }
          if (ms >= 460) {
            const t = clamp01((ms - 460) / 950);
            chick.style.display = t >= 1 ? 'none' : '';
            const x = lerp(land[0], runTo, t);
            const hop = Math.abs(Math.sin(ms / 45)) * 6;
            chick.setAttribute('transform', `translate(${x.toFixed(1)},${(FLOOR_Y - 4 - hop).toFixed(1)})`);
            const alt = Math.floor(ms / 70) % 2 === 0;
            legsA.style.display = alt ? '' : 'none';
            legsB.style.display = alt ? 'none' : '';
          }
        },
      });
    }

    _updateFx(time) {
      for (let i = this.fx.length - 1; i >= 0; i--) {
        const f = this.fx[i];
        const ms = time - f.start;
        if (ms >= f.dur) {
          f.node.remove();
          this.fx.splice(i, 1);
        } else {
          f.update(clamp01(ms / f.dur), Math.max(0, ms));
        }
      }
    }

    // ---------- кадр ----------

    render(s) {
      const c = this._cache;
      const time = s.time;

      if (c.wolf !== s.wolf) {
        c.wolf = s.wolf;
        const g = LANES[s.wolf];
        this.wolf.setAttribute('transform', g.left ? '' : `translate(${W},0) scale(-1,1)`);
        this.armsUp.style.display = g.upper ? '' : 'none';
        this.armsDown.style.display = g.upper ? 'none' : '';
      }
      const bump = s.phase !== 'idle' && time - s.lastCatchAt < 140;
      if (c.bump !== bump) {
        c.bump = bump;
        this.wolf.classList.toggle('bump', bump);
      }

      if (c.score !== s.score) {
        c.score = s.score;
        const str = String(s.score).padStart(3, '0');
        for (let i = 0; i < 3; i++) {
          const on = DIGITS[+str[i]];
          const segs = this.digitSegs[i];
          for (const k in segs) segs[k].style.display = on.includes(k) ? '' : 'none';
        }
      }

      if (c.pen !== s.penaltyHalves) {
        c.pen = s.penaltyHalves;
        this.penIcons.forEach((icon, i) => {
          const halves = s.penaltyHalves - i * 2;
          icon.style.display = halves > 0 ? '' : 'none';
          icon.classList.toggle('half', halves === 1);
        });
      }

      if (c.best !== this.best) {
        c.best = this.best;
        this.bestText.textContent = String(this.best).padStart(3, '0');
      }

      const hareUp = s.hareVisible && s.phase !== 'idle';
      if (c.hare !== hareUp) {
        c.hare = hareUp;
        this.hare.classList.toggle('up', hareUp);
      }

      this._renderEggs(s);
      this._updateFx(time);
      this._renderOverlay(s);
    }

    _renderEggs(s) {
      const seen = new Set();
      for (const egg of s.eggs) {
        seen.add(egg.id);
        let node = this.eggEls.get(egg.id);
        if (!node) {
          node = group(this.eggLayer, { class: 'egg' }, EGG_ART);
          this.eggEls.set(egg.id, node);
        }
        const t = clamp01((s.time - egg.movedAt) / egg.moveDur);
        const e = easeInOut(t);
        const fromU = egg.prevStep < 0 ? U_SPAWN : U[egg.prevStep];
        const u = lerp(fromU, U[egg.step], e);
        const [x, y] = eggPoint(egg.lane, u);
        const roll = LANES[egg.lane].dir * (egg.prevStep + e * (egg.step - egg.prevStep)) * 110;
        node.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${roll.toFixed(1)})`);
        node.setAttribute('opacity', egg.prevStep < 0 ? Math.min(1, t * 2.5).toFixed(2) : '1');
      }
      for (const [id, node] of this.eggEls) {
        if (!seen.has(id)) {
          node.remove();
          this.eggEls.delete(id);
        }
      }
    }

    _renderOverlay(s) {
      let key = '';
      if (s.phase === 'idle') key = 'idle';
      else if (s.phase === 'paused') key = 'pause';
      else if (s.phase === 'over' && s.time - s.overAt >= OVER_DELAY) key = 'over';
      if (this._cache.overlay === key) return;
      this._cache.overlay = key;
      this.overlay.innerHTML = key ? this._overlayMarkup(key, s) : '';
      this.overlay.style.display = key ? '' : 'none';
      this.overlayKey = key;
      this.overlayReadyAt = performance.now() + (key === 'over' ? 500 : 0);
    }

    _overlayMarkup(key, s) {
      const panel = '<rect class="panel" x="140" y="138" width="610" height="460" rx="22"/>';
      const txt = (x, y, cls, str) => `<text class="lcd-text ${cls}" x="${x}" y="${y}" text-anchor="middle">${str}</text>`;
      const button = (label) =>
        '<g class="lcd-btn"><rect x="330" y="494" width="230" height="64" rx="32"/>' +
        txt(445, 536, 'btn-label', label) + '</g>';

      if (key === 'pause') {
        return panel +
          txt(445, 250, 'title', 'ПАУЗА') +
          txt(445, 310, 'body', 'Игра остановлена') +
          txt(445, 350, 'body', this.touch ? 'Коснитесь, чтобы продолжить' : 'Esc или Пробел — продолжить') +
          button('ДАЛЬШЕ');
      }

      if (key === 'over') {
        const best = this.newBest ? 'Новый рекорд!' : `Рекорд: ${this.best}`;
        return panel +
          txt(445, 232, 'title', 'ИГРА ОКОНЧЕНА') +
          txt(445, 300, 'big', `Поймано: ${s.total}`) +
          txt(445, 350, 'body', best) +
          txt(445, 400, 'body', this.touch ? 'Коснитесь, чтобы сыграть ещё' : 'Enter или Пробел — новая игра') +
          button('ЕЩЁ РАЗ');
      }

      // Экран приветствия с подсказкой управления
      let controls;
      if (this.touch) {
        const pad = (x, y, arrowRot) =>
          `<g transform="translate(${x},${y})"><circle class="ink" r="26"/>` +
          `<path class="bg" transform="rotate(${arrowRot})" d="M0,-13 L11,4 L4,4 L4,13 L-4,13 L-4,4 L-11,4 Z"/></g>`;
        controls =
          pad(236, 318, -45) + pad(236, 392, -135) + pad(654, 318, 45) + pad(654, 392, 135) +
          txt(445, 338, 'body', 'Жмите большие') +
          txt(445, 372, 'body', 'кнопки по бокам') +
          txt(445, 406, 'small', 'четыре лотка — четыре кнопки');
      } else {
        const key4 = (x, y, k, label, anchor) =>
          `<g transform="translate(${x},${y})"><rect class="ink" x="-26" y="-26" width="52" height="52" rx="9"/>` +
          `<text class="lcd-text keycap" y="11" text-anchor="middle">${k}</text></g>` +
          `<text class="lcd-text small" x="${x + (anchor === 'start' ? 38 : -38)}" y="${y + 6}" text-anchor="${anchor}">${label}</text>`;
        controls =
          key4(210, 322, 'Q', 'верх слева', 'start') +
          key4(210, 394, 'A', 'низ слева', 'start') +
          key4(680, 322, 'P', 'верх справа', 'end') +
          key4(680, 394, 'L', 'низ справа', 'end') +
          txt(445, 364, 'small', 'или стрелки');
      }

      return panel +
        txt(445, 208, 'title', 'НУ, ПОГОДИ!') +
        txt(445, 250, 'body', 'Ловите яйца корзиной Волка') +
        controls +
        txt(445, 444, 'small', 'Промах — штраф, при Зайце в окне — пол-штрафа.') +
        txt(445, 470, 'small', '3 штрафа — конец. На 200 и 500 штрафы сбрасываются.') +
        button('СТАРТ') +
        (this.touch ? '' : txt(445, 580, 'small', 'Enter / Пробел'));
    }
  }

  NP.View = View;
})(window.NuPogodi = window.NuPogodi || {});
