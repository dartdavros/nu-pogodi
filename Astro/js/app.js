(function (E) {
  'use strict';
  const game = new E.Game();
  const display = new E.Display(document.getElementById('game-scene'));
  const sound = new E.Sound();
  const ui = Object.fromEntries(['overlay', 'overlay-kicker', 'overlay-title', 'overlay-copy', 'overlay-footnote', 'start', 'pause', 'sound', 'best', 'status-text', 'announcer', 'keyboard-guide'].map(id => [id, document.getElementById(id)]));
  let best = 0;
  let paused = false;
  let orientationBlocked = false;
  let previousTime = null;
  let visualTime = 0;
  let overAt = null;
  let controls;
  try {
    best = Math.max(0, Number(localStorage.getItem('electronics-best')) || 0);
    if (!Number.isFinite(best)) best = 0;
    sound.enabled = localStorage.getItem('electronics-sound') !== 'off';
  } catch (_) { /* In-memory records remain available when storage is blocked. */ }

  function save(key, value) { try { localStorage.setItem(key, String(value)); } catch (_) { /* Session fallback. */ } }
  function updateSound() {
    ui.sound.textContent = sound.enabled ? 'ЗВУК: ВКЛ' : 'ЗВУК: ВЫКЛ';
    ui.sound.setAttribute('aria-pressed', String(sound.enabled));
  }

  function overlay(mode) {
    ui.overlay.hidden = mode === 'running';
    ui.pause.disabled = game.status !== 'running';
    ui.pause.innerHTML = paused ? 'ПРОДОЛЖИТЬ' : 'ПАУЗА <span>ESC</span>';
    ui['status-text'].textContent = { running: 'ИГРА ИДЁТ', paused: 'ПАУЗА', over: 'ИГРА ОКОНЧЕНА', ready: 'ГОТОВ К ИГРЕ' }[mode];
    ui['keyboard-guide'].hidden = mode === 'over';
    document.querySelector('.touch-guide').hidden = mode === 'over';
    if (mode === 'paused') {
      ui['overlay-kicker'].textContent = 'МОЖНО ВЫДОХНУТЬ';
      ui['overlay-title'].textContent = 'Пауза';
      ui['overlay-copy'].textContent = 'Яйца подождут. Продолжим?';
      ui.start.textContent = 'ПРОДОЛЖИТЬ';
      ui['overlay-footnote'].textContent = 'Нажми кнопку или Esc, чтобы вернуться в игру.';
    }
    if (mode === 'over') {
      ui['overlay-kicker'].textContent = 'ЕЩЁ ОДНУ ПОПЫТКУ?';
      ui['overlay-title'].textContent = 'Ну, погоди!';
      ui['overlay-copy'].textContent = `Игра окончена. Поймано яиц: ${game.score}. Лучший результат: ${best}.`;
      ui.start.innerHTML = 'START <span>НОВАЯ ИГРА</span>';
      ui['overlay-footnote'].textContent = 'С Зайцем промах стоит полштрафа. На 200 и 500 штрафы сгорают.';
      ui.announcer.textContent = `Игра окончена. Счёт ${game.score}.`;
    }
  }

  function start() {
    if (orientationBlocked || document.hidden) return;
    sound.unlock();
    if (game.status === 'running' && !paused) return;
    if (game.status !== 'running') {
      game.reset();
      display.reset();
      visualTime = 0;
      overAt = null;
      controls?.clearPressed();
      ui.announcer.textContent = 'Игра началась.';
    }
    paused = false;
    previousTime = null;
    overlay('running');
    controls?.select(game.lane);
    ui.start.blur();
  }

  function suspend() {
    if (game.status === 'running') {
      paused = true;
      previousTime = null;
      overlay('paused');
    }
  }

  function togglePause() {
    if (game.status !== 'running' || orientationBlocked) return;
    if (paused) start(); else suspend();
  }

  controls = E.bindControls({
    move(lane) {
      if (paused || orientationBlocked || game.status !== 'running') return;
      sound.unlock();
      game.move(lane);
      display.updateWolf(lane); // Input updates the pose immediately, before the next frame.
      controls.select(lane);
    },
    start, pause: togglePause, suspend,
    orientation(blocked) { orientationBlocked = blocked; if (blocked) suspend(); }
  });

  ui.start.addEventListener('click', start);
  ui.pause.addEventListener('click', togglePause);
  ui.sound.addEventListener('click', () => {
    sound.enabled = !sound.enabled;
    if (sound.enabled) sound.unlock();
    else if (sound.context) sound.context.suspend().catch(() => {});
    save('electronics-sound', sound.enabled ? 'on' : 'off');
    updateSound();
  });

  function frame(timestamp) {
    let delta = previousTime === null ? 0 : timestamp - previousTime;
    previousTime = timestamp;
    if (delta > 700 && game.status === 'running' && !paused) { suspend(); delta = 0; }
    if (!paused && !orientationBlocked && !document.hidden) {
      visualTime += Math.min(delta, 100);
      const events = game.update(delta);
      events.forEach(event => {
        display.event(event, visualTime);
        sound.play(event.type);
        if (event.type === 'over') {
          overAt = visualTime;
          ui.pause.disabled = true;
          ui['status-text'].textContent = 'ИГРА ОКОНЧЕНА';
        }
        if (event.type === 'miss') ui.announcer.textContent = `Промах. Штрафы: ${game.penalty / 2} из 3.`;
        if (event.type === 'bonus') ui.announcer.textContent = 'Все штрафы сброшены.';
      });
      if (game.score > best) { best = game.score; save('electronics-best', best); ui.best.textContent = String(best).padStart(3, '0'); }
      if (overAt !== null && visualTime - overAt >= 880) { overlay('over'); overAt = null; }
    }
    display.render(game, visualTime);
    requestAnimationFrame(frame);
  }

  ui.best.textContent = String(best).padStart(3, '0');
  updateSound();
  controls.select(game.lane);
  display.render(game, 0);
  // Exactly one animation loop for the lifetime of the page; restart creates none.
  requestAnimationFrame(frame);
})(window.Electronics);
