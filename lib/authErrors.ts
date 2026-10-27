// lib/authErrors.ts
//
// Maps Firebase Auth error codes to the same human-readable copy the
// original friendlyFirebaseError() used, extracted as a pure function so
// it's reusable/testable instead of living inline in a DOM handler.
import type { FirebaseError } from 'firebase/app';

const ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/invalid-email': "That email address doesn't look right.",
  'auth/weak-password': 'Password should be at least 6 characters.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
  'auth/popup-closed-by-user': 'Google sign-in was closed before finishing.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
};

export function friendlyFirebaseError(err: unknown): string {
  const code = (err as FirebaseError)?.code || '';
  const message = (err as FirebaseError)?.message;
  return ERROR_MESSAGES[code] || message || 'Something went wrong. Please try again.';
}
