// hooks/useAuthForms.ts
//
// Replaces handleSubmit(e, kind)/fakeOAuth()/friendlyFirebaseError wiring
// from the original inline script. One hook used by AuthOverlay for all
// three panes (sign in, sign up, forgot password) plus Google OAuth.
'use client';

import { useCallback, useState } from 'react';
import {
  GoogleAuthProvider,
  getAdditionalUserInfo,
  sendPasswordResetEmail,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { friendlyFirebaseError } from '@/lib/authErrors';
import { establishSession } from '@/lib/sessionClient';

const googleProvider = new GoogleAuthProvider();

export type AuthPane = 'signin' | 'signup' | 'forgot' | 'success';
export type SuccessKind = 'signin' | 'signin-google' | 'signup' | 'forgot';

// `isNewUser` tells the caller (AuthOverlay -> AppRoot) whether this
// was a genuinely brand-new account, so the post-auth onboarding flow
// only ever shows for a true first-time signup — including a
// first-time Google sign-in, which creates an account exactly like
// email signup does but goes through the same 'signin-google' call
// the returning-Google-user path uses. Firebase's own
// getAdditionalUserInfo(cred).isNewUser is the one reliable signal
// for "this uid did not exist a moment ago," so it's read here right
// off the credential rather than guessed from which button was
// clicked.
export function useAuthForms(onSuccess: (kind: SuccessKind, isNewUser: boolean) => void) {
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
        const cred = await signInWithCustomToken(auth, result.customToken);
        // Mint the server-side session cookie alongside the client
        // SDK session — see lib/sessionClient.ts / useAuth.ts for why
        // pages hydrate from this cookie rather than only from the
        // client SDK's own (async, sometimes-unreliable) restore.
        const freshIdToken = await cred.user.getIdToken();
        await establishSession(freshIdToken);
        onSuccess('signup', true);
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
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const freshIdToken = await cred.user.getIdToken();
        await establishSession(freshIdToken);
        onSuccess('signin', false);
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
        onSuccess('forgot', false);
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
        const cred = await signInWithPopup(auth, googleProvider);
        const freshIdToken = await cred.user.getIdToken();
        await establishSession(freshIdToken);
        const isNewUser = !!getAdditionalUserInfo(cred)?.isNewUser;
        onSuccess(kind === 'signup' ? 'signup' : 'signin-google', isNewUser);
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
