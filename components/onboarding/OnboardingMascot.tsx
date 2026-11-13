'use client';

// components/onboarding/OnboardingMascot.tsx
//
// The onboarding flow's "premium marketing" visual anchor on each of
// the 3 steps: the brand's bunny mascot (public/mascot/hero-bunny.png
// — same character used on the marketing homepage's hero) set inside
// a floating, animated stage with orbiting accent shapes behind it
// (styles/onboarding/onboarding.css drives the float/orbit/pulse
// keyframes). `tone` swaps the glow/orbit accent color per step so
// each step still feels distinct even though it's the same mascot
// image throughout — matching the dashboard's own green/purple/blue
// "tone" family (see --dash-green/--dash-purple/--dash-blue in
// styles/base/base.css) rather than inventing new colors.
interface OnboardingMascotProps {
  tone: 'lime' | 'purple' | 'blue';
  flip?: boolean;
}

export function OnboardingMascot({ tone, flip = false }: OnboardingMascotProps) {
  return (
    <div className={`onb-mascot-stage onb-mascot-${tone}`} aria-hidden="true">
      <div className="onb-mascot-glow" />
      <div className="onb-mascot-ring onb-mascot-ring-a" />
      <div className="onb-mascot-ring onb-mascot-ring-b" />

      <span className="onb-mascot-shape onb-mascot-shape-1" />
      <span className="onb-mascot-shape onb-mascot-shape-2" />
      <span className="onb-mascot-shape onb-mascot-shape-3" />
      <span className="onb-mascot-shape onb-mascot-shape-4" />

      <div className="onb-mascot-float">
        <img
          className="onb-mascot-img"
          style={flip ? { transform: 'scaleX(-1)' } : undefined}
          src="/mascot/hero-bunny.png"
          alt=""
        />
      </div>

      <div className="onb-mascot-shadow" />
    </div>
  );
}
