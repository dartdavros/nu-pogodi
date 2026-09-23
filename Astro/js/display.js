(function (E) {
  'use strict';
  const SEGMENTS = [
    '5,0 25,0 29,4 25,8 5,8 1,4', '26,9 30,5 30,27 26,31 22,27 22,13',
    '26,33 30,37 30,59 26,63 22,55 22,37', '5,60 25,60 29,64 25,68 5,68 1,64',
    '0,37 4,33 8,37 8,55 4,63 0,59', '0,5 4,9 8,13 8,27 4,31 0,27',
    '5,30 25,30 29,34 25,38 5,38 1,34'
  ];
  const NUMBERS = ['1111110', '0110000', '1101101', '1111001', '0110011', '1011011', '1011111', '1110000', '1111111', '1111011'];

  class Display {
    constructor(scene) {
      E.buildScene(scene);
      this.scene = scene;
      this.eggNodes = new Map();
      this.effects = [];
      this.digitNodes = [];
      this.lastScore = '';
      this.lastPenalty = -1;
      this.lastLane = -1;
      const digits = scene.querySelector('#digits');
      for (let i = 0; i < 3; i++) {
        const group = E.svg('g', { transform: `translate(${i * 40} 0)` }, digits);
        this.digitNodes.push(SEGMENTS.map(points => E.svg('polygon', { points, fill: 'currentColor', opacity: .07 }, group)));
      }
      this.eggGroup = scene.querySelector('#eggs');
      this.effectGroup = scene.querySelector('#effects');
      this.wolf = scene.querySelector('#wolf');
      this.arm = scene.querySelector('#wolf-arm');
      this.basket = scene.querySelector('#basket');
      this.bunny = scene.querySelector('#bunny-presence');
      this.halves = [...scene.querySelectorAll('[data-half]')];
      this.message = scene.querySelector('#scene-message');
    }

    reset() {
      this.eggGroup.replaceChildren();
      this.effectGroup.replaceChildren();
      this.eggNodes.clear();
      this.effects = [];
      this.message.textContent = '';
    }

    updateWolf(lane) {
      if (this.lastLane === lane) return;
      this.lastLane = lane;
      const direction = lane < 2 ? 1 : -1;
      const point = E.lanes[lane];
      this.wolf.setAttribute('transform', `translate(450 287) scale(${direction} 1)`);
      this.arm.setAttribute('d', `M${450 - 27 * direction} 323Q${450 - 51 * direction} ${point.endY + 32} ${point.endX + 24 * direction} ${point.endY + 15}`);
      this.basket.setAttribute('transform', `translate(${point.endX} ${point.endY + 12})`);
    }

    render(game, now) {
      if (game.displayScore !== this.lastScore) {
        this.lastScore = game.displayScore;
        this.scene.querySelector('#digits').setAttribute('aria-label', `Счёт: ${game.displayScore}`);
        [...game.displayScore].forEach((digit, i) => this.digitNodes[i].forEach((node, j) => node.setAttribute('opacity', NUMBERS[Number(digit)][j] === '1' ? .92 : .07)));
      }
      if (this.lastPenalty !== game.penalty) {
        this.lastPenalty = game.penalty;
        this.scene.querySelector('#penalties').setAttribute('aria-label', `Штрафы: ${game.penalty / 2} из 3`);
        this.halves.forEach((node, i) => {
          node.setAttribute('fill', 'currentColor');
          node.setAttribute('opacity', i < game.penalty ? .9 : .09);
        });
      }
      this.updateWolf(game.lane);
      this.bunny.setAttribute('opacity', game.bunny ? '1' : '0');
      const alive = new Set();
      for (const egg of game.eggs) {
        alive.add(egg.id);
        let node = this.eggNodes.get(egg.id);
        if (!node) {
          node = E.svg('use', { href: '#egg-symbol' }, this.eggGroup);
          this.eggNodes.set(egg.id, node);
        }
        const lane = E.lanes[egg.lane];
        const progress = Math.min(1, (game.time - egg.born) / egg.duration);
        // Smooth interpolation between the five logical positions, using SVG transforms.
        const discrete = progress * E.STEPS;
        const fraction = discrete % 1;
        const eased = fraction * fraction * (3 - 2 * fraction);
        const t = (Math.floor(discrete) + eased) / E.STEPS;
        const x = lane.x + (lane.endX - lane.x) * t;
        const y = lane.y + (lane.endY - lane.y) * t;
        node.setAttribute('transform', `translate(${x} ${y}) rotate(${t * (egg.lane < 2 ? 260 : -260)})`);
      }
      for (const [id, node] of this.eggNodes) {
        if (!alive.has(id)) { node.remove(); this.eggNodes.delete(id); }
      }
      this.renderEffects(now);
    }

    event(event, now) {
      if (!['catch', 'miss', 'bonus'].includes(event.type)) return;
      const node = E.svg('g', {}, this.effectGroup);
      const lane = E.lanes[event.lane] || { endX: 450, endY: 235 };
      if (event.type === 'miss') {
        node.innerHTML = '<use href="#egg-symbol" class="falling-egg"/><g class="shell" fill="#c8ceb4" stroke="currentColor" stroke-width="2.5"><path d="m-25-5 9 5 5-10 6 11 6-6q-1 22-26 0Z"/><path d="m9-5 8 5 4-9 9 6q-3 21-21-2Z"/><path d="m-38 3-8-5m80 6 9-4M0-17l3-9" fill="none"/></g><text class="penalty-label" text-anchor="middle" font-size="16" font-weight="700"></text>';
        node.querySelector('text').textContent = event.units === 1 ? '+½' : '+1';
      } else {
        E.svg('text', { 'text-anchor': 'middle', fill: 'currentColor', 'font-size': event.type === 'bonus' ? 18 : 16, 'font-weight': 700 }, node).textContent = event.type === 'bonus' ? 'ШТРАФЫ СБРОШЕНЫ' : '+1';
      }
      this.effects.push({ type: event.type, node, start: now, x: lane.endX, y: lane.endY });
    }

    renderEffects(now) {
      this.effects = this.effects.filter(effect => {
        const age = now - effect.start;
        const duration = effect.type === 'bonus' ? 1800 : 850;
        if (age >= duration) { effect.node.remove(); return false; }
        const { node, x, y } = effect;
        if (effect.type === 'miss') {
          const t = Math.min(1, age / 410);
          const fallenY = y + (453 - y) * t * t;
          const egg = node.querySelector('.falling-egg');
          egg.setAttribute('transform', `translate(${x} ${fallenY}) rotate(${t * 130})`);
          egg.setAttribute('visibility', t < 1 ? 'visible' : 'hidden');
          const shell = node.querySelector('.shell');
          shell.setAttribute('transform', `translate(${x} 459)`);
          shell.setAttribute('visibility', t >= 1 ? 'visible' : 'hidden');
          const label = node.querySelector('text');
          label.setAttribute('x', x);
          label.setAttribute('y', 432 - Math.max(0, age - 410) / 35);
          label.setAttribute('opacity', t >= 1 ? '1' : '0');
        } else node.setAttribute('transform', `translate(${x} ${y - 22 - age / 40})`);
        node.setAttribute('opacity', Math.min(1, (duration - age) / 220));
        return true;
      });
    }
  }
  E.Display = Display;
})(window.Electronics);
