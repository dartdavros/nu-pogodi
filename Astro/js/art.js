(function (E) {
  'use strict';
  E.art = {
    definitions: `<defs>
      <pattern id="lcd-grain" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".45" fill="#344333" opacity=".07"/></pattern>
      <pattern id="basket-weave" width="12" height="10" patternUnits="userSpaceOnUse"><path d="M0 0h12M0 5h12M3 0l4 10m5-10 4 10" stroke="currentColor" stroke-width="1.4" fill="none"/></pattern>
      <g id="egg-symbol"><path d="M-9 0C-9-8-4-17 0-17S9-8 9 0C9 13-9 13-9 0Z" fill="#c8ceb4" stroke="currentColor" stroke-width="3"/><path d="M-4-7q-3 5-1 8" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".45"/></g>
      <g id="hen-symbol" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M-33 0q-27-12-21-32l17 12-4-23 17 22q19-19 33-10L13-44q-7-11 1-12 0-12 8-7 7-9 10 1 12-3 10 7 9 5 0 13l-4 20Q49 4 27 16q-19 10-42-2Z" fill="currentColor" stroke="none"/>
        <path d="m39-40 17 6-17 7" fill="currentColor"/>
        <circle cx="29" cy="-43" r="3.5" fill="#bcc5a5" stroke="none"/>
        <path d="M-24-5q20 19 39-2M-3 21v8m20-10v10M-10 29H5m5 0h15" fill="none"/>
        <path d="M-24-5q20 19 39-2" stroke="#bcc5a5" fill="none" stroke-width="2"/>
      </g>
    </defs>`,
    wolf: `<g id="wolf-body" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <path d="M29 78q58 6 65 44-32-18-65-18" fill="currentColor"/>
      <path d="m-27 105-10 55-27 12q-10 11 7 13h38l20-69m14-8 12 53 23 11q12 12-6 13H18L0 123" fill="currentColor"/>
      <path d="M-37 160h19m39 1h14" stroke="#bcc5a5"/>
      <path d="M-31 22q-21 40-14 80 36 23 78 0 8-32-7-76l-19-9Z" fill="#a7b294"/>
      <path d="M-29 31q24 18 52 1M-36 46q34 18 64 2M-40 64q38 17 70 1M-42 82q38 18 73 2" fill="none" stroke-width="5"/>
      <path d="m-21 18 1-29 33-9 8 40q-12 22-42-2" fill="#bcc5a5"/>
      <path d="m-31-38-5-47 22 24 14-35 11 33 19-13-3 32 12 18-21 1 5 19-33-6q-17 2-27-9l-40-10q-13-7-10-16l15-12 38 4" fill="currentColor"/>
      <path d="m-30-41-28 5-17-5q-7 9 1 15l38 10 19-3 6-17" fill="#bcc5a5" stroke="none"/>
      <path d="m-68-46-13 2q-9 7 0 14l12-2Z" fill="currentColor" stroke="none"/>
      <ellipse cx="-19" cy="-45" rx="10" ry="15" fill="#d2d7bf" stroke-width="2" transform="rotate(14 -19 -45)"/>
      <ellipse cx="-23" cy="-44" rx="3.5" ry="6" fill="currentColor" stroke="none"/>
      <path d="m-31-61 19-3m-48 37 20 5m2-1-3 8m5-67 5 14" fill="none"/>
      <path d="M-34-7q13 15 32 8" fill="none" stroke="#bcc5a5" stroke-width="2"/>
      <path d="M12-19 32-8 18 0l14 9-23 3" fill="currentColor" stroke="none"/>
    </g>`,
    bunny: `<g id="bunny" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M-18 3q-20-43-11-58 11-11 18 45M3-13q0-51 13-49 16 4 0 53" fill="#c7ceb1"/>
      <path d="m-24-45 9 27M12-49 8-24" fill="none"/>
      <path d="M-23-10q18-21 39 0 18 20 0 33l12 28h-64l12-28q-18-15 1-33" fill="#c7ceb1"/>
      <path d="M-31 35q24 10 51 0M-35 46h61" stroke-width="5"/>
      <ellipse cx="-11" cy="1" rx="2" ry="4" fill="currentColor"/>
      <ellipse cx="8" cy="1" rx="2" ry="4" fill="currentColor"/>
      <path d="m-5 10 5 2 4-3m-5 4v7m-11-4q12 13 22-1" fill="none"/>
      <path d="m-8 21 1 7h7v-7" fill="#d2d7bf" stroke-width="2"/>
      <path d="m21 27 17-16m-3 1 4-12m-2 14 12-4" fill="none"/>
    </g>`,
    landscape: `<g fill="none" stroke="currentColor" stroke-width="2" opacity=".3">
      <path d="M30 467h840M42 477h71m44 0h78m443 0h98m40 0h38"/>
      <path d="M73 465v-31l13-12 13 12v31m-30-17h35m696 17v-31l13-12 13 12v31m-30-17h35"/>
      <path d="m129 465 5-12 5 12m-9-7-7-9m589 16 8-16 6 16m42 0 4-9 5 9"/>
    </g>`
  };
})(window.Electronics);
