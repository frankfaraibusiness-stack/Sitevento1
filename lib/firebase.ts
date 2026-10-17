// lib/firebase.ts
//
// Client-side Firebase SDK singleton. Config values are public (safe to
// ship to the browser — Firebase access control lives in security rules,
// not in hiding this object). Hardcoded directly here (rather than read
// from NEXT_PUBLIC_* env vars) at the user's request, since the Vercel
// deployment's env vars weren't being picked up correctly for this
// Environment. This is a private repo, so committing these is fine —
// Firebase web config is meant to be public regardless.
'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCd0d__8akeieiLp4soUaYLU_fT9YmZ_ko',
  authDomain: 'autoagent-e750a.firebaseapp.com',
  projectId: 'autoagent-e750a',
  storageBucket: 'autoagent-e750a.firebasestorage.app',
  messagingSenderId: '420577964097',
  appId: '1:420577964097:web:b4a7cf15d7472f030796c0',
  measurementId: 'G-55GCMYWBWF',
};

// This module is imported (directly or transitively) by
// components/AppRoot.tsx, a 'use client' component — but Next.js still
// *executes* client components on the server, both at build time
// (prerendering) and, with `force-dynamic`, on every request's SSR pass.
// 'use client' only controls what ships to the browser, not where the
// module first runs.
//
// Firebase SDK functions (onAuthStateChanged, collection, signOut,
// etc.) do internal instanceof/branded-type checks on their `auth`/`db`
// arguments, so a lazy Proxy wrapper wouldn't be safe here — it has to
// be the real SDK instance. Instead, construction is deferred into
// getFirebaseAuth() / getFirebaseDb(), which every call site calls
// (instead of importing a pre-built `auth` / `db` constant) from inside
// useEffect/useCallback/event handlers/async functions — i.e. only in
// response to real browser-side invocation, never during a server
// render pass.

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
