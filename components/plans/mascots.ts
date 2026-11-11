// components/plans/mascots.ts
//
// One original mascot per plan, drawn as inline SVG. Each builder takes
// a `uid` so gradient ids stay unique when the same mascot is on screen
// twice (card header + pitch bubble). Only static markup and the
// alphanumeric uid are interpolated, so rendering it as HTML is safe.
// Motion (bob, blink, twinkle) lives in styles/plans/ventol-plans.css.
import type { PlanId } from '@/lib/plans';

export interface MascotDef {
  name: string;
  render: (uid: string) => string;
}

const OPEN =
  '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">';
const SHADOW = '<ellipse cx="60" cy="113" rx="30" ry="4.5" fill="#000" opacity=".28"/>';
const SPARK = 'M14 52l2.2 5.8L22 60l-5.8 2.2L14 68l-2.2-5.8L6 60l5.8-2.2Z';

// Free: Sprout, a mint bean with a leafy sprout.
const sprout = (u: string) =>
  `${OPEN}<defs><radialGradient id="${u}b" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="#e3fcec"/><stop offset=".45" stop-color="#6ee7a3"/><stop offset="1" stop-color="#15803d"/></radialGradient></defs>
${SHADOW}
<g class="vpl-m-body">
<path d="M60 33C60 24 60 19 63 13" fill="none" stroke="#052e1a" stroke-width="3.5" stroke-linecap="round"/>
<path d="M63 14C73 3 90 7 92 17C81 23 69 21 63 14Z" fill="#4ade80" stroke="#052e1a" stroke-width="3" stroke-linejoin="round"/>
<path d="M61 20C51 9 35 11 31 20C42 27 55 26 61 20Z" fill="#22c55e" stroke="#052e1a" stroke-width="3" stroke-linejoin="round"/>
<path d="M60 32C86 32 101 53 101 76C101 99 83 109 60 109C37 109 19 99 19 76C19 53 34 32 60 32Z" fill="url(#${u}b)" stroke="#052e1a" stroke-width="3.5" stroke-linejoin="round"/>
<g class="vpl-m-eyes"><ellipse cx="45" cy="72" rx="6" ry="8" fill="#052e1a"/><ellipse cx="75" cy="72" rx="6" ry="8" fill="#052e1a"/><circle cx="47" cy="68.5" r="2.4" fill="#fff"/><circle cx="77" cy="68.5" r="2.4" fill="#fff"/></g>
<ellipse cx="34" cy="86" rx="7" ry="4.5" fill="#fb7185" opacity=".65"/><ellipse cx="86" cy="86" rx="7" ry="4.5" fill="#fb7185" opacity=".65"/>
<path d="M52 86Q60 94 68 86" fill="none" stroke="#052e1a" stroke-width="3.2" stroke-linecap="round"/>
</g></svg>`;

// Starter: Zippy, a sky-blue square with a lightning antenna.
const zippy = (u: string) =>
  `${OPEN}<defs><linearGradient id="${u}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7f0ff"/><stop offset=".5" stop-color="#38bdf8"/><stop offset="1" stop-color="#0369a1"/></linearGradient></defs>
${SHADOW}
<g transform="translate(-1.2 -18) scale(.8)"><path class="vpl-m-twinkle" d="${SPARK}" fill="#fde047"/></g>
<g transform="translate(96.2 2) scale(.7)"><path class="vpl-m-twinkle" style="animation-delay:.9s" d="${SPARK}" fill="#fde047"/></g>
<g class="vpl-m-body">
<rect x="20" y="38" width="80" height="70" rx="30" fill="url(#${u}b)" stroke="#04243d" stroke-width="3.5"/>
<path class="vpl-m-bolt" d="M67 2L50 24H60L54 40L74 17H64Z" fill="#fde047" stroke="#713f12" stroke-width="2.6" stroke-linejoin="round"/>
<g class="vpl-m-eyes"><circle cx="45" cy="70" r="10" fill="#fff" stroke="#04243d" stroke-width="2.5"/><circle cx="75" cy="70" r="10" fill="#fff" stroke="#04243d" stroke-width="2.5"/><circle cx="47" cy="71" r="5" fill="#04243d"/><circle cx="77" cy="71" r="5" fill="#04243d"/><circle cx="49" cy="68.5" r="1.8" fill="#fff"/><circle cx="79" cy="68.5" r="1.8" fill="#fff"/></g>
<ellipse cx="29" cy="86" rx="6" ry="4" fill="#fda4af" opacity=".6"/><ellipse cx="91" cy="86" rx="6" ry="4" fill="#fda4af" opacity=".6"/>
<path d="M43 87Q60 106 77 87Z" fill="#04243d" stroke="#04243d" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M52 96Q60 91 68 96Q60 103 52 96Z" fill="#fb7185"/>
</g></svg>`;

// Plus: Nova, a cosmic violet cub with a star on its brow.
const nova = (u: string) =>
  `${OPEN}<defs><radialGradient id="${u}b" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#f7dcff"/><stop offset=".5" stop-color="#c084fc"/><stop offset="1" stop-color="#6d28d9"/></radialGradient></defs>
${SHADOW}
<g transform="translate(-1.2 -18) scale(.8)"><path class="vpl-m-twinkle" d="${SPARK}" fill="#f0abfc"/></g>
<g transform="translate(99.6 -12) scale(.6)"><path class="vpl-m-twinkle" style="animation-delay:.7s" d="${SPARK}" fill="#fde68a"/></g>
<g transform="translate(96.2 58) scale(.7)"><path class="vpl-m-twinkle" style="animation-delay:1.4s" d="${SPARK}" fill="#f5d0fe"/></g>
<g class="vpl-m-body">
<circle cx="31" cy="46" r="12" fill="#a855f7" stroke="#2e1065" stroke-width="3.5"/><circle cx="31" cy="46" r="5.5" fill="#f0abfc"/>
<circle cx="89" cy="46" r="12" fill="#a855f7" stroke="#2e1065" stroke-width="3.5"/><circle cx="89" cy="46" r="5.5" fill="#f0abfc"/>
<circle cx="60" cy="72" r="40" fill="url(#${u}b)" stroke="#2e1065" stroke-width="3.5"/>
<path d="M60 39L62.23 44.93L68.56 45.22L63.61 49.17L65.29 55.28L60 51.8L54.71 55.28L56.39 49.17L51.44 45.22L57.77 44.93Z" fill="#fde68a" stroke="#78350f" stroke-width="2" stroke-linejoin="round"/>
<path d="M40 74Q47 64 54 74" fill="none" stroke="#2e1065" stroke-width="3.6" stroke-linecap="round"/>
<path d="M66 74Q73 64 80 74" fill="none" stroke="#2e1065" stroke-width="3.6" stroke-linecap="round"/>
<ellipse cx="36" cy="86" rx="8" ry="5" fill="#f472b6" opacity=".6"/><ellipse cx="84" cy="86" rx="8" ry="5" fill="#f472b6" opacity=".6"/>
<path d="M53 85Q56.5 91 60 85Q63.5 91 67 85" fill="none" stroke="#2e1065" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</g></svg>`;

// Business: Baron, a crowned gold gentleman in shades and a bow tie.
const baron = (u: string) =>
  `${OPEN}<defs><linearGradient id="${u}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2c4"/><stop offset=".45" stop-color="#fbbf24"/><stop offset="1" stop-color="#b45309"/></linearGradient><linearGradient id="${u}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff59d"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs>
${SHADOW}
<g class="vpl-m-body">
<rect x="24" y="36" width="72" height="74" rx="32" fill="url(#${u}b)" stroke="#2b1400" stroke-width="3.5"/>
<path d="M36 38L40 14L51 27L60 9L69 27L80 14L84 38Z" fill="url(#${u}c)" stroke="#2b1400" stroke-width="3.2" stroke-linejoin="round"/>
<path d="M38 32H82" stroke="#2b1400" stroke-width="2.2" opacity=".45"/>
<circle cx="40" cy="14" r="3.4" fill="#ef4444" stroke="#2b1400" stroke-width="1.8"/><circle cx="60" cy="9" r="3.4" fill="#60a5fa" stroke="#2b1400" stroke-width="1.8"/><circle cx="80" cy="14" r="3.4" fill="#ef4444" stroke="#2b1400" stroke-width="1.8"/>
<rect x="33" y="60" width="24" height="16" rx="6" fill="#14110a" stroke="#000" stroke-width="2"/><rect x="63" y="60" width="24" height="16" rx="6" fill="#14110a" stroke="#000" stroke-width="2"/>
<path d="M57 66H63" stroke="#14110a" stroke-width="3.2"/>
<path d="M38 65H45M68 65H75" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".55"/>
<ellipse cx="33" cy="86" rx="6" ry="4" fill="#fb923c" opacity=".5"/><ellipse cx="87" cy="86" rx="6" ry="4" fill="#fb923c" opacity=".5"/>
<path d="M50 87Q61 94 73 85" fill="none" stroke="#2b1400" stroke-width="3.2" stroke-linecap="round"/>
<path d="M60 102L48 96V108Z" fill="#b91c1c" stroke="#2b1400" stroke-width="2.2" stroke-linejoin="round"/><path d="M60 102L72 96V108Z" fill="#b91c1c" stroke="#2b1400" stroke-width="2.2" stroke-linejoin="round"/>
<circle cx="60" cy="102" r="3.2" fill="#ef4444" stroke="#2b1400" stroke-width="2"/>
</g></svg>`;

export const MASCOTS: Record<PlanId, MascotDef> = {
  free: { name: 'Sprout', render: sprout },
  starter: { name: 'Zippy', render: zippy },
  scale: { name: 'Nova', render: nova },
  'pro-developer': { name: 'Baron', render: baron },
};
