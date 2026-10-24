// hooks/useAuthForms.ts
//
// Replaces handleSubmit(e, kind)/fakeOAuth()/friendlyFirebaseError wiring
// from the original inline script. One hook used by AuthOverlay for all
// three panes (sign in, sign up, forgot password) plus Google OAuth.
'use client';

import { useCallback, useState } from 'react';
import {
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { friendlyFirebaseError } from '@/lib/authErrors';

const googleProvider = new GoogleAuthProvider();

export type AuthPane = 'signin' | 'signup' | 'forgot' | 'success';
export type SuccessKind = 'signin' | 'signin-google' | 'signup' | 'forgot';

export function useAuthForms(onSuccess: (kind: SuccessKind) => void) {
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  const clearErrors = useCallback(() => {
    setFieldErrors({});
    setFormError('');
  }, []);

  // Account creation now happens entirely server-side via
  // app/api/create-account (Admin SDK createUser + a custom token) —
  // see that route's header comment. The client's only job afterward
  // is exchanging the custom token for a real session via
  // signInWithCustomToken, which is not itself a write.
  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      clearErrors();
      setSubmitting(true);
      try {
        const res = await fetch('/api/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });
        const result = await res.json().catch(() => ({}));

        if (!res.ok || !result.ok) {
          setFieldErrors({ email: result.error || 'Could not create your account. Please try again.' });
          return;
        }

        const auth = getFirebaseAuth();
        await signInWithCustomToken(auth, result.customToken);
        onSuccess('signup');
      } catch (err) {
        setFieldErrors({ email: friendlyFirebaseError(err) });
      } finally {
        setSubmitting(false);
      }
    },
    [clearErrors, onSuccess]
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      clearErrors();
      setSubmitting(true);
      try {
        const auth = getFirebaseAuth();
        await signInWithEmailAndPassword(auth, email, password);
        onSuccess('signin');
      } catch (err) {
        setFieldErrors({ password: friendlyFirebaseError(err) });
      } finally {
        setSubmitting(false);
      }
    },
    [clearErrors, onSuccess]
  );

  const forgotPassword = useCallback(
    async (email: string) => {
      clearErrors();
      setSubmitting(true);
      try {
        const auth = getFirebaseAuth();
        await sendPasswordResetEmail(auth, email);
        onSuccess('forgot');
      } catch (err) {
        setFieldErrors({ email: friendlyFirebaseError(err) });
      } finally {
        setSubmitting(false);
      }
    },
    [clearErrors, onSuccess]
  );

  const googleSignIn = useCallback(
    async (kind: 'signin' | 'signup') => {
      setSubmitting(true);
      try {
        const auth = getFirebaseAuth();
        await signInWithPopup(auth, googleProvider);
        onSuccess(kind === 'signup' ? 'signup' : 'signin-google');
      } catch (err) {
        setFormError(friendlyFirebaseError(err));
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess]
  );

  return { submitting, fieldErrors, formError, clearErrors, signUp, signIn, forgotPassword, googleSignIn };
}
