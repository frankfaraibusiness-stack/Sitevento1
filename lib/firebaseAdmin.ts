// lib/firebaseAdmin.ts
//
// Server-only Firebase Admin SDK singleton, shared by every API route
// (track, verify-site). Bypasses Firestore security rules, so this must
// never be imported from client code — it's only ever used inside
// app/api/*/route.ts files, which run exclusively on the server.
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

function getAdminApp(): App {
  if (getApps().length) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
