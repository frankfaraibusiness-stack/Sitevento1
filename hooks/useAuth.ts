// hooks/useAuth.ts
//
// Replaces the original's module-level `let currentUser` + a single
// top-level onAuthStateChanged call. Same behavior — explicit local
// persistence, authReady gate so we never flash the signed-out view for
// a session that's still loading from storage — but as proper React
// state any component can subscribe to via useAuth().
'use client';

import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();

    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.error('Failed to set auth persistence', err);
    });

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  return { user, authReady };
}
