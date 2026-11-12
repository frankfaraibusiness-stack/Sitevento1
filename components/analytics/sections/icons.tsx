// components/analytics/sections/icons.tsx — small stroke icons for the sections.
import type { SVGProps } from 'react';
import type { DiagIcon, GoalIcon } from './analyticsTypes';

function Svg(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props} />;
}

export const ArrowUp = () => (
  <Svg strokeWidth={3}>
    <path d="M12 19V5m0 0l-6 6m6-6l6 6" />
  </Svg>
);
export const ArrowDown = () => (
  <Svg strokeWidth={3}>
    <path d="M12 5v14m0 0l-6-6m6 6l6-6" />
  </Svg>
);
export const ArrowRight = () => (
  <Svg>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const CheckIcon = () => (
  <Svg strokeWidth={2.5}>
    <path d="M20 6L9 17l-5-5" />
  </Svg>
);
export const RefreshIcon = () => (
  <Svg>
    <path d="M21 12a9 9 0 11-2.64-6.36M21 3v6h-6" />
  </Svg>
);

export function GoalGlyph({ name }: { name: GoalIcon }) {
  switch (name) {
    case 'check':
      return (
        <Svg>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </Svg>
      );
    case 'send':
      return (
        <Svg>
          <path d="M22 2L11 13" />
          <path d="M22 2l-7 20-4-9-9-4 20-7z" />
        </Svg>
      );
    case 'clock':
      return (
        <Svg>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </Svg>
      );
    default:
      return (
        <Svg>
          <path d="M4 4h16v16H4z" />
          <path d="M4 9h16M9 4v16" />
        </Svg>
      );
  }
}

export function DiagGlyph({ name }: { name: DiagIcon }) {
  switch (name) {
    case 'warning':
      return (
        <Svg>
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <path d="M12 9v4M12 17h.01" />
        </Svg>
      );
    case 'clock':
      return (
        <Svg>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </Svg>
      );
    case 'layers':
      return (
        <Svg>
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
        </Svg>
      );
    default:
      return (
        <Svg>
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </Svg>
      );
  }
}
