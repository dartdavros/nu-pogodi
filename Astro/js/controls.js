(function (E) {
  'use strict';
  E.bindControls = function (actions) {
    const keys = { KeyQ: 0, KeyA: 1, KeyP: 2, KeyL: 3 };
    const buttons = [...document.querySelectorAll('[data-lane]')];
    const held = new Map();
    const keyHeld = new Set();
    const touchQuery = matchMedia('(pointer: coarse)');
    const hoverQuery = matchMedia('(any-hover: hover)');
    const portraitQuery = matchMedia('(orientation: portrait)');

    function updatePressed() {
      buttons.forEach((button, lane) => button.classList.toggle('pressed', [...held.values()].includes(lane) || keyHeld.has(lane)));
    }

    function clearPressed() { held.clear(); keyHeld.clear(); updatePressed(); }

    buttons.forEach((button, lane) => {
      button.addEventListener('pointerdown', event => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        held.set(event.pointerId, lane);
        updatePressed();
        actions.move(lane);
      });
      const release = event => { held.delete(event.pointerId); updatePressed(); };
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
      button.addEventListener('contextmenu', event => event.preventDefault());
      // Keyboard / accessibility activation of the drawn buttons.
      button.addEventListener('click', event => { if (event.detail === 0) actions.move(lane); });
    });

    document.addEventListener('keydown', event => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (Object.hasOwn(keys, event.code)) {
        event.preventDefault();
        const lane = keys[event.code];
        keyHeld.add(lane);
        updatePressed();
        actions.move(lane);
      } else if (event.code === 'Escape' && !event.repeat) {
        event.preventDefault(); actions.pause();
      } else if ((event.code === 'Enter' || event.code === 'Space') && !event.repeat && event.target.tagName !== 'BUTTON') {
        event.preventDefault(); actions.start();
      }
    });
    document.addEventListener('keyup', event => {
      if (Object.hasOwn(keys, event.code)) { keyHeld.delete(keys[event.code]); updatePressed(); }
    });
    window.addEventListener('blur', () => { clearPressed(); actions.suspend(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { clearPressed(); actions.suspend(); }
    });
    window.addEventListener('pagehide', () => { clearPressed(); actions.suspend(); });

    function capabilities() {
      const touch = touchQuery.matches || (navigator.maxTouchPoints > 0 && !hoverQuery.matches);
      document.body.classList.toggle('touch-device', touch);
      const blocked = touch && portraitQuery.matches;
      document.getElementById('rotate').hidden = !blocked;
      document.querySelector('.page').inert = blocked;
      actions.orientation(blocked);
      if (blocked) clearPressed();
    }
    touchQuery.addEventListener('change', capabilities);
    hoverQuery.addEventListener('change', capabilities);
    portraitQuery.addEventListener('change', capabilities);
    window.addEventListener('resize', capabilities);
    capabilities();
    return { clearPressed, select(lane) { buttons.forEach((button, i) => button.classList.toggle('selected', i === lane)); } };
  };
})(window.Electronics);
