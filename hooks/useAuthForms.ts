// hooks/useAuthForms.ts
//
// Replaces handleSubmit(e, kind)/fakeOAuth()/friendlyFirebaseError wiring
// from the original inline script. One hook used by AuthOverlay for all
// three panes (sign in, sign up, forgot password) plus Google OAuth.
'use client';

import { useCallback, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
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

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      clearErrors();
      setSubmitting(true);
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
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
