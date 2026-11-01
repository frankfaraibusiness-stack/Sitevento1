// lib/theme.ts
//
// Shared source of truth for the Settings > Appearance "Theme Colour"
// feature, imported from both sides of the trust boundary:
//   - client: components/settings/panels/AppearancePanel.tsx (presets +
//     live validation while typing) and hooks/useAppliedAppearance.ts
//     (applying the saved value to <html>)
//   - server: app/api/user-action/route.ts's doUpdateSettings, which
//     re-validates with this same function rather than trusting
//     whatever the client already checked — never skip that, a
//     request to the API route doesn't have to come from this UI.
//
// Three curated swatches as quick picks, but the field is free text:
// any valid 6-digit hex is accepted, so visitors can also enter their
// own code.
export const THEME_COLOR_PRESETS = ['#d3fcaa', '#c1b5f7', '#f6b6ed'] as const;

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// '' is also valid — it means "no override, use the app's default
// --app-bg (base.css)". Everything else must be a strict 6-digit hex.
export function isValidThemeColor(value: unknown): value is string {
  return value === '' || (typeof value === 'string' && HEX_COLOR_RE.test(value));
}

// Normalizes a raw user-typed hex string: trims whitespace, adds a
// leading '#' if missing, lowercases it. Returns null if the result
// still isn't a valid hex color. Used by the client input so "D3FCAA"
// or "d3fcaa" (no '#') both work, not just the exact preset strings.
export function normalizeThemeColorInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return '';
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  const lower = withHash.toLowerCase();
  return HEX_COLOR_RE.test(lower) ? lower : null;
}
