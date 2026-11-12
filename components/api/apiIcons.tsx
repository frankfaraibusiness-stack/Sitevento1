// components/api/apiIcons.tsx — stroke icons for the API page. Inherit
// currentColor, sized by their parent (.apx-ico svg { 20px }).
import type { ReactElement, SVGProps } from 'react';

function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

const ICONS: Record<string, (p: SVGProps<SVGSVGElement>) => ReactElement> = {
  repeat: (p) => (
    <Svg {...p}>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a3 3 0 0 1 3-3h15" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a3 3 0 0 1-3 3H3" />
    </Svg>
  ),
  tag: (p) => (
    <Svg {...p}>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.2" />
    </Svg>
  ),
  bag: (p) => (
    <Svg {...p}>
      <path d="M6 7h12l1 13H5L6 7Z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
    </Svg>
  ),
  undo: (p) => (
    <Svg {...p}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </Svg>
  ),
  box: (p) => (
    <Svg {...p}>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
    </Svg>
  ),
  receipt: (p) => (
    <Svg {...p}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path d="M9 8h6M9 12h6" />
    </Svg>
  ),
  megaphone: (p) => (
    <Svg {...p}>
      <path d="M3 10v4a1 1 0 0 0 1 1h3l8 4V5L7 9H4a1 1 0 0 0-1 1Z" />
      <path d="M19 9a4 4 0 0 1 0 6" />
    </Svg>
  ),
  userPlus: (p) => (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M19 8v6M16 11h6" />
    </Svg>
  ),
  login: (p) => (
    <Svg {...p}>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M10 8l4 4-4 4M14 12H3" />
    </Svg>
  ),
  hourglass: (p) => (
    <Svg {...p}>
      <path d="M6 3h12M6 21h12" />
      <path d="M7 3c0 5 5 5 5 9s-5 4-5 9M17 3c0 5-5 5-5 9s5 4 5 9" />
    </Svg>
  ),
  flag: (p) => (
    <Svg {...p}>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </Svg>
  ),
  spark: (p) => (
    <Svg {...p}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </Svg>
  ),
  search: (p) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4-4" />
    </Svg>
  ),
  alert: (p) => (
    <Svg {...p}>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 10v4M12 17.5v.01" />
    </Svg>
  ),
  pulse: (p) => (
    <Svg {...p}>
      <path d="M3 12h4l2.5 6 4-12 2.5 6H21" />
    </Svg>
  ),
  eye: (p) => (
    <Svg {...p}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  ),
  eyeOff: (p) => (
    <Svg {...p}>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.8M6.5 7.5A16.5 16.5 0 0 0 2 12s3.6 7 10 7c1.5 0 2.9-.4 4.1-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Svg>
  ),
  users: (p) => (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.5A6 6 0 0 1 21 20" />
    </Svg>
  ),
  click: (p) => (
    <Svg {...p}>
      <path d="m9 9 11 4-4.5 1.8L13 19.5 9 9Z" />
      <path d="M5.5 5.5 7 7M4 10h2M10 4v2M14.5 5.5 13 7" />
    </Svg>
  ),
  globe: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.8 2.6 4 5.6 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.6-4-9s1.2-6.4 4-9Z" />
    </Svg>
  ),
  device: (p) => (
    <Svg {...p}>
      <rect x="3" y="5" width="14" height="10" rx="2" />
      <path d="M8 19h4M10 15v4" />
      <rect x="15" y="9" width="6" height="11" rx="1.6" />
    </Svg>
  ),
  shield: (p) => (
    <Svg {...p}>
      <path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </Svg>
  ),
  copy: (p) => (
    <Svg {...p}>
      <rect x="9" y="9" width="12" height="12" rx="2.2" />
      <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" />
    </Svg>
  ),
  refresh: (p) => (
    <Svg {...p}>
      <path d="M21 4v5h-5" />
      <path d="M20.5 9A8.5 8.5 0 1 0 21 13" />
    </Svg>
  ),
  key: (p) => (
    <Svg {...p}>
      <circle cx="8" cy="14" r="4.2" />
      <path d="M11 11l9-9M16 6l3 3M14 8l2 2" />
    </Svg>
  ),
  code: (p) => (
    <Svg {...p}>
      <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
    </Svg>
  ),
  info: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5v.01" />
    </Svg>
  ),
  link: (p) => (
    <Svg {...p}>
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
    </Svg>
  ),
  plug: (p) => (
    <Svg {...p}>
      <path d="M9 3v5M15 3v5" />
      <path d="M6 8h12v3a6 6 0 0 1-12 0V8Z" />
      <path d="M12 17v4" />
    </Svg>
  ),
};

export function ApiIcon({ name, ...rest }: { name: string } & SVGProps<SVGSVGElement>) {
  const Icon = ICONS[name] ?? ICONS.spark;
  return <Icon {...rest} />;
}
