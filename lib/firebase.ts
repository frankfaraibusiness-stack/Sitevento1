// lib/firebase.ts
//
// Client-side Firebase SDK singleton. Config values are public (safe to
// ship to the browser — Firebase access control lives in security rules,
// not in hiding this object), sourced from NEXT_PUBLIC_* env vars so
// they're baked in at build time the same way the old inline config
// object worked, just without hardcoding secrets/ids directly in source.
'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// `page.tsx` is a 'use client' component, but Next.js still *executes*
// client components on the server during static generation
// (prerendering `/` at build time) — 'use client' only controls what
// ships to the browser, not where the module first runs. The old
// `export const auth = getAuth(...)` pattern ran at module-evaluation
// time, so `next build` called getAuth() server-side before real env
// vars were available in that context, throwing `auth/invalid-api-key`
// and failing the build.
//
// Firebase SDK functions (onAuthStateChanged(auth, ...), collection(db,
// ...), signOut(auth), etc.) do internal instanceof/branded-type checks
// on these arguments, so a lazy Proxy wrapper isn't safe here — it has
// to be the real SDK instance. Instead, every call site keeps using
// `auth` / `db` as plain values exactly as before; what changed is that
// `app/page.tsx` now forces the dynamic rendering of "/" (see its
// `export const dynamic = 'force-dynamic'`), which stops Next.js from
// ever prerendering this page at build time, so this module only ever
// executes in the browser or during a real per-request server render,
// both of which have real env vars available.
const firebaseApp: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(firebaseApp);
export const db: Firestore = getFirestore(firebaseApp);
