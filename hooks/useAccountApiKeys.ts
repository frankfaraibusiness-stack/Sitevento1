// hooks/useAccountApiKeys.ts
//
// Live subscription to the two account-level API keys on users/{uid}
// (lib/apiKeys.ts). Same listener components/settings/panels/ApiPanel.tsx
// uses inline; lifted here so the dedicated API page can share it.
// Regenerating goes through app/api/user-action's 'generate-api-key'
// action — the Admin-SDK write lands, this listener reflects it.
'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';

export interface AccountApiKeys {
  live: string | null;
  test: string | null;
}

export function useAccountApiKeys(uid: string | null) {
  const [keys, setKeys] = useState<AccountApiKeys>({ live: null, test: null });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!uid) {
      setKeys({ live: null, test: null });
      setLoaded(false);
      return;
    }
    setLoaded(false);
    const db = getFirebaseDb();
    const unsub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        const data = snap.exists() ? snap.data() : {};
        setKeys({
          live: typeof data?.apiKeyLive === 'string' ? data.apiKeyLive : null,
          test: typeof data?.apiKeyTest === 'string' ? data.apiKeyTest : null,
        });
        setLoaded(true);
      },
      (err) => {
        console.error('api keys snapshot error', err);
        setLoaded(true);
      }
    );
    return () => unsub();
  }, [uid]);

  return { keys, loaded };
}
