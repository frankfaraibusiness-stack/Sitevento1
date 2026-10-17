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

// getApps().length check mirrors the original inline <script type="module">
// pattern — avoids "Firebase App named '[DEFAULT]' already exists" errors
// under Next.js Fast Refresh, where this module can be re-evaluated.
export const firebaseApp: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(firebaseApp);
export const db: Firestore = getFirestore(firebaseApp);
