# Files touched

- `styles/marketing-content.css` — `.pill-nav` is full-width (no `max-width`/auto-margin centering), so the logo sits flush left and the avatar/hamburger sit flush right.
- `styles/marketing-hero.css` — rewritten so mobile and desktop are two separate rule blocks instead of one shared layout stretched with clamp():
  - **Mobile (up to 1023px)**: single stacked column, phone-tuned sizes, no mascot.
  - **Desktop (1024px+)**: its own container/padding, its own headline scale, and a real two-column grid (`#marketingView`) that places the hero copy on the left and the connected-site preview card on the right, side by side — not the mobile stack widened.
  - Only truly shared, size-independent tokens (colors, the highlight-shape polygon, keyframes) are defined once outside both blocks.
- `components/marketing/Hero.tsx` — removed the bunny mascot; split the "Connected/Disconnected" demo card out of `Hero` into its own exported `ConnectedSiteShowcase` component/section.
- `components/marketing/MarketingPage.tsx` — renders `<Hero />` and `<ConnectedSiteShowcase />` as two sibling sections; their shared parent (`#marketingView`) switches from a vertical stack (mobile) to a two-column grid (desktop) via media query.
- `app/globals.css` — removed the `hero-mascot.css` import (mascot is gone).

# Files deleted (no longer used)

- `components/marketing/HeroMascot.tsx`
- `styles/hero-mascot.css`

Drop these files into the same paths in your project (and delete the two files listed above) to apply the fix.
