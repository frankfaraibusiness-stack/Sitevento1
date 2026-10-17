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

// This module is imported (directly or transitively) by
// components/AppRoot.tsx, a 'use client' component — but Next.js still
// *executes* client components on the server, both at build time
// (prerendering) and, with `force-dynamic`, on every request's SSR pass.
// 'use client' only controls what ships to the browser, not where the
// module first runs.
//
// The old `export const auth = getAuth(...)` pattern constructed the SDK
// instance at module-evaluation time — the instant anything imported this
// file. That happens during every server render too, so if that
// particular invocation's env didn't have real NEXT_PUBLIC_* values
// (wrong Vercel Environment, cold start timing, etc.), getAuth() threw
// `auth/invalid-api-key` on the server, not just at build.
//
// Fix: never construct anything at module scope. Construction is deferred
// into getFirebaseAuth() / getFirebaseDb(), which every call site now
// calls (instead of importing a pre-built `auth` / `db` constant) from
// inside useEffect/useCallback/event handlers/async functions — i.e.
// only in response to real browser-side invocation, never during a
// server render pass. A lazy Proxy wouldn't work here: the Firebase SDK
// does instanceof/branded-type checks on `auth`/`db` arguments, so
// callers need the real constructed instance, just constructed late.
//
// As a last line of defense, each getter also throws a clear error if
// somehow still invoked with `typeof window === 'undefined'` (i.e.
// genuinely on the server), rather than letting it fail deep inside the
// Firebase SDK with a cryptic invalid-api-key stack trace.

let firebaseApp: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;

function getFirebaseApp(): FirebaseApp {
  if (typeof window === 'undefined') {
    throw new Error(
      'Firebase must not be initialized during server rendering. ' +
        'Call getFirebaseAuth()/getFirebaseDb() only from client-side code ' +
        '(useEffect, event handlers, etc.), never at module scope or during render.'
    );
  }
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    // Fail with one clear message instead of letting the Firebase SDK
    // throw its generic `auth/invalid-api-key` — that error gives no
    // hint that the actual problem is missing/unset NEXT_PUBLIC_* env
    // vars in this deployment's Environment (Production/Preview/Dev) in
    // Vercel's project settings.
    throw new Error(
      'Firebase config is missing required values (apiKey/projectId/appId). ' +
        'Check that NEXT_PUBLIC_FIREBASE_* environment variables are set for ' +
        'this deployment\'s Environment in Vercel, then redeploy.'
    );
  }
  if (!firebaseApp) {
    firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  return firebaseApp;
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp());
  }
  return authInstance;
}

export function getFirebaseDb(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(getFirebaseApp());
  }
  return dbInstance;
}
