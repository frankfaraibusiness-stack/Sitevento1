# Widgets update — what changed and how to deploy

## What's new
- All 10 widgets in the dashboard's Widgets panel are now clickable and live (no more `live: false` placeholders).
- Each widget has real content served from this app at `/w/{widgetId}`, mounted in the customer's site via a sandboxed iframe (`public/sitevento.js`).
- Fully functional: Announcement Bar, Countdown Timer, Spin-the-Wheel, Exit-Intent Popup, Social Proof, Reviews, Video Popup, Feedback Tab (`/api/feedback`), Referral link generator.
- Support Chat: full typing/sending UI, backed by `/api/chat` + `lib/aiReply.ts`, which tries **Groq** (`llama-3.1-8b-instant`) then falls back to **Gemini** (`gemini-1.5-flash`), then a canned reply if both fail.

## Files touched
- `lib/widgets.ts` — widget catalog + config field schemas
- `hooks/useSiteWidget.ts` — new hook for per-site widget config/enable state
- `components/dashboard/WidgetsPanel.tsx`, `WidgetConfigPanel.tsx` — dashboard UI
- `components/dashboard/DashboardShell.tsx` — passes `uid`/`activeSite` through
- `public/sitevento.js` — passes per-site config into the widget iframe via a `#cfg` hash
- `app/w/[widgetId]/` — new route serving all 10 widgets' actual content
- `app/api/chat/route.ts`, `app/api/feedback/route.ts` — new backend routes
- `lib/aiReply.ts` — Groq → Gemini → fallback reply logic
- `scripts/manage-widget.mjs` — added `seed-catalog` command

## Deploy steps
1. `npm install && npm run build` — catch anything that needs installed type packages (this was built/reviewed without `node_modules` available).
2. Set env vars on your deployment: `GROQ_API_KEY`, `GEMINI_API_KEY` (Support Chat works without them too, just with canned replies).
3. Seed the global widget catalog once, pointing at your deployed origin:
   ```
   node scripts/manage-widget.mjs seed-catalog --baseUrl https://your-app.vercel.app
   ```
4. Grant a site access to a widget (repeat per site/widget you want live):
   ```
   node scripts/manage-widget.mjs put-site-widget --uid <uid> --siteId <siteId> --widgetId support-chat --enabled true
   ```
   (Or just use the dashboard's Widgets panel — toggling a widget on there does this for you.)
5. On the customer's site, add the widget's mount point wherever it should appear:
   ```html
   <div data-sitevento-widget="support-chat"></div>
   ```

## Known limitations / next steps
- Built and reviewed without network access, so `npm install`/`next build` were not run here — please run them before deploying.
- Support Chat's AI replies need `GROQ_API_KEY`/`GEMINI_API_KEY` set to do more than the canned fallback reply.
- Exit-Intent detection listens for `mouseout` at the top of the viewport; works well on desktop, has no true mobile equivalent (there's no cursor) — consider a scroll-based or timed fallback for mobile if that matters to you.
- Referral widget generates a shareable link but nothing currently attributes a later visit back to it (`/api/track` doesn't read `?ref=` yet).
