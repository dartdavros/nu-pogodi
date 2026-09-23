/*
 * Сборка приложения: игровой цикл, UI-действия, ориентация, рекорд.
 */
(function (NP) {
  'use strict';

  const BEST_KEY = 'nupogodi.best';

  const svg = document.getElementById('device');
  const root = document.getElementById('app');
  const engine = new NP.Engine();
  const view = new NP.View(svg);
  const sound = NP.Sound;

  // ---------- рекорд ----------

  let best = 0;
  try { best = Math.max(0, parseInt(localStorage.getItem(BEST_KEY), 10) || 0); } catch (e) { /* нет доступа */ }
  function saveBest() {
    try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* приватный режим */ }
  }

  // ---------- тип устройства ----------

  // Touch-режим определяется по основному указателю, а не по ширине окна.
  const mqCoarse = window.matchMedia('(pointer: coarse)');
  const mqNoHover = window.matchMedia('(hover: none)');
  const mqPortrait = window.matchMedia('(orientation: portrait)');
  let isTouch = false;

  function detectMode() {
    isTouch = mqCoarse.matches || (mqNoHover.matches && navigator.maxTouchPoints > 0);
    document.documentElement.classList.toggle('is-touch', isTouch);
    view.setMode(isTouch);
  }

  function isBlockedByPortrait() {
    return isTouch && mqPortrait.matches;
  }

  // ---------- действия ----------

  function startGame() {
    if (isBlockedByPortrait()) return;
    sound.unlock();
    engine.start();
    view.reset();
    view.setBest(best, false);
    sound.start();
    updatePauseLabel();
    if (isTouch) requestLandscape();
  }

  function pauseGame() {
    if (engine.pause()) {
      input.releaseAll();
      updatePauseLabel();
    }
  }

  function resumeGame() {
    if (isBlockedByPortrait()) return;
    sound.unlock();
    if (engine.resume()) updatePauseLabel();
  }

  function updatePauseLabel() {
    const label = document.getElementById('pause-label');
    if (label) label.textContent = engine.state.phase === 'paused' ? 'ДАЛЬШЕ' : 'ПАУЗА';
  }

  function toggleSound() {
    sound.unlock();
    view.setSoundLabel(sound.toggle());
    sound.click();
  }

  function onAction(name) {
    const phase = engine.state.phase;
    switch (name) {
      case 'unlock':
        sound.unlock();
        break;
      case 'sound':
        toggleSound();
        break;
      case 'start':
        startGame();
        break;
      case 'pause':
        if (phase === 'playing') pauseGame();
        else if (phase === 'paused') resumeGame();
        break;
      case 'overlay':
        if (phase === 'paused') resumeGame();
        else if (phase === 'idle') startGame();
        else if (phase === 'over' && view.overlayKey === 'over' && performance.now() >= view.overlayReadyAt) startGame();
        break;
      case 'enter': // старт / продолжить; во время игры ничего не делает
        if (phase === 'paused') resumeGame();
        else if (phase !== 'playing') startGame();
        break;
      case 'space': // старт или пауза
        if (phase === 'playing') pauseGame();
        else if (phase === 'paused') resumeGame();
        else startGame();
        break;
      case 'escape':
        if (phase === 'playing') pauseGame();
        else if (phase === 'paused') resumeGame();
        break;
      default:
        break;
    }
  }

  // Полноэкранный режим и блокировка ориентации — только как улучшение.
  function requestLandscape() {
    const doc = document.documentElement;
    const lock = () => {
      const so = screen.orientation;
      if (so && typeof so.lock === 'function') so.lock('landscape').catch(() => {});
    };
    try {
      if (!document.fullscreenElement && doc.requestFullscreen) {
        doc.requestFullscreen({ navigationUI: 'hide' }).then(lock, lock);
      } else {
        lock();
      }
    } catch (e) {
      /* API недоступно — игра работает и без него */
    }
  }

  // ---------- ввод ----------

  const input = new NP.Input(root, svg, {
    move(pos) { engine.setWolf(pos); },
    press(pos, down) { view.setPressed(pos, down); },
    action: onAction,
    getWolf() { return engine.state.wolf; },
  });

  // ---------- события движка ----------

  function handleEvents(events) {
    for (const ev of events) {
      switch (ev.type) {
        case 'step':
          sound.step(ev.lane);
          break;
        case 'catch':
          sound.catch();
          view.fxCatch(ev.lane, ev.at);
          if (ev.total > best) {
            best = ev.total;
            view.setBest(best, true);
          }
          break;
        case 'miss':
          sound.miss();
          view.fxMiss(ev.lane, ev.at);
          break;
        case 'penaltyReset':
        case 'hundred':
          sound.bonus();
          break;
        case 'hare':
          sound.hare(ev.visible);
          break;
        case 'gameover':
          sound.gameOver();
          saveBest();
          updatePauseLabel();
          break;
        default:
          break;
      }
    }
  }

  // ---------- цикл ----------

  // Один requestAnimationFrame на всё время жизни страницы: рестарт
  // меняет только состояние движка, новых циклов и таймеров не создаёт.
  let last = performance.now();
  function frame(now) {
    let dt = now - last;
    last = now;
    if (!(dt >= 0)) dt = 0;
    if (dt > 250) dt = 250;        // вкладка «проснулась» или сильный провал FPS
    handleEvents(engine.update(dt));
    view.render(engine.state);
    requestAnimationFrame(frame);
  }

  // ---------- системные события ----------

  function onOrientationChange() {
    if (isBlockedByPortrait()) {
      pauseGame();
      input.releaseAll();
    }
  }

  function onHide() {
    pauseGame();
    input.releaseAll();
    saveBest();
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) onHide(); });
  window.addEventListener('blur', () => { pauseGame(); input.releaseAll(); });
  window.addEventListener('pagehide', saveBest);
  const listen = (mq, fn) => (mq.addEventListener ? mq.addEventListener('change', fn) : mq.addListener(fn));
  listen(mqPortrait, onOrientationChange);
  listen(mqCoarse, detectMode);
  listen(mqNoHover, detectMode);
  window.addEventListener('resize', onOrientationChange);

  // ---------- запуск ----------

  detectMode();
  view.setBest(best, false);
  view.setSoundLabel(sound.muted);
  view.render(engine.state);
  requestAnimationFrame(frame);

  NP.app = { engine, view, input, startGame, pauseGame, resumeGame };
})(window.NuPogodi = window.NuPogodi || {});
