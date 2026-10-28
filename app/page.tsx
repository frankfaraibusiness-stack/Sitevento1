// app/page.tsx — deliberately a plain Server Component (no 'use client'
// here). All the interactive logic lives in components/AppRoot.tsx.
//
// Next.js only honors a route's `export const dynamic` when it's read
// from a Server Component; the same export in a 'use client' page file
// is silently ignored, and `next build` still tries to statically
// prerender the route. That prerender executes the client tree on the
// server at build time, before real NEXT_PUBLIC_FIREBASE_* env vars are
// available in that context, so lib/firebase.ts's getAuth() call throws
// `auth/invalid-api-key` and fails the build.
//
// Keeping this file server-only and forcing dynamic rendering here
// means "/" is never statically generated at build time — only
// rendered per-request (server) or in the browser, both of which have
// real env vars.
import AppRoot from '@/components/AppRoot';

export const dynamic = 'force-dynamic';

export default function Page() {
  return <AppRoot />;
}
