(function (E) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  E.svg = function (tag, attrs = {}, parent) {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (parent) parent.append(node);
    return node;
  };

  E.lanes = [
    { x: 137, y: 164, endX: 334, endY: 244 },
    { x: 137, y: 302, endX: 334, endY: 382 },
    { x: 763, y: 164, endX: 566, endY: 244 },
    { x: 763, y: 302, endX: 566, endY: 382 }
  ];

  function drawLanes(scene) {
    const rails = E.svg('g', { fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, scene);
    E.lanes.forEach((lane, index) => {
      const sign = index < 2 ? 1 : -1;
      const { x, y, endX, endY } = lane;
      E.svg('path', { d: `M${x - sign * 64} ${y + 16}h${sign * 62}L${endX - sign * 9} ${endY + 14}v9L${x - sign * 3} ${y + 25}h${-sign * 63}Z`, 'stroke-width': 4 }, rails);
      E.svg('path', { d: `M${x - sign * 72} ${y - 80}v111m${sign > 0 ? 10 : -10} -5h${sign * 45}`, 'stroke-width': 3, opacity: .45 }, rails);
      const hen = E.svg('g', { transform: `translate(${x - sign * 43} ${y - 18}) scale(${sign * .82} .82)` }, scene);
      E.svg('use', { href: '#hen-symbol' }, hen);
      for (let i = 0; i < 5; i++) {
        const t = i / 5;
        E.svg('circle', { cx: x + (endX - x) * t, cy: y + (endY - y) * t + 31, r: 2.1, fill: 'currentColor', opacity: .18 }, scene);
      }
    });
  }

  function drawWindow(scene) {
    const win = E.svg('g', { transform: 'translate(450 147)' }, scene);
    win.innerHTML = `<path d="M-59 18v-105H59V18M-64 20H65v8H-64Z" fill="none" stroke="currentColor" stroke-width="4" opacity=".7"/>
      <path d="M-49-77h98v86h-98ZM-49-77l12 19-12 39m98-58L37-58l12 39" fill="none" stroke="currentColor" stroke-width="2" opacity=".2"/>
      <g id="bunny-presence" transform="translate(0 -31)">${E.art.bunny}</g>
      <path d="M-56 19H56" fill="none" stroke="currentColor" stroke-width="5"/>`;
  }

  E.buildScene = function (scene) {
    scene.setAttribute('style', 'color: #344333; font-family: Segoe UI, Arial, sans-serif');
    scene.innerHTML = E.art.definitions + '<rect width="900" height="520" fill="url(#lcd-grain)"/>';
    E.svg('text', { x: 41, y: 38, 'font-size': 11, 'letter-spacing': 3, opacity: .7 }, scene).textContent = 'СЧЁТ';
    E.svg('g', { id: 'digits', transform: 'translate(40 47) scale(.67)' }, scene);
    E.svg('text', { x: 857, y: 38, 'text-anchor': 'end', 'font-size': 11, 'letter-spacing': 3, opacity: .7 }, scene).textContent = 'ШТРАФЫ';
    const penalties = E.svg('g', { id: 'penalties', transform: 'translate(738 55)' }, scene);
    for (let i = 0; i < 3; i++) {
      const g = E.svg('g', { transform: `translate(${i * 42} 0)` }, penalties);
      E.svg('path', { d: 'M15 0A15 15 0 0 0 15 30Z', 'data-half': i * 2 }, g);
      E.svg('path', { d: 'M15 0A15 15 0 0 1 15 30Z', 'data-half': i * 2 + 1 }, g);
      E.svg('path', { d: 'm16 4-5 9 8 5-5 8', fill: 'none', stroke: '#bcc5a5', 'stroke-width': 2 }, g);
    }
    drawLanes(scene);
    drawWindow(scene);
    scene.insertAdjacentHTML('beforeend', E.art.landscape);
    const wolf = E.svg('g', { id: 'wolf', transform: 'translate(450 287)' }, scene);
    wolf.innerHTML = E.art.wolf;
    E.svg('path', { id: 'wolf-arm', fill: 'none', stroke: 'currentColor', 'stroke-width': 13, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, scene);
    const basket = E.svg('g', { id: 'basket', stroke: 'currentColor', 'stroke-width': 3, 'stroke-linejoin': 'round' }, scene);
    basket.innerHTML = '<path d="M-28 7q1-47 28-47T28 7" fill="none"/><path d="m-37 0 10 37h54L37 0Z" fill="#bcc5a5"/><path d="m-35 2 9 33h52L35 2Z" fill="url(#basket-weave)"/><path d="M-38 0h76" stroke-width="6"/>';
    E.svg('g', { id: 'eggs' }, scene);
    E.svg('g', { id: 'effects', 'pointer-events': 'none' }, scene);
    E.svg('text', { id: 'scene-message', x: 450, y: 503, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, 'letter-spacing': 2, opacity: .7 }, scene);
  };
})(window.Electronics);
