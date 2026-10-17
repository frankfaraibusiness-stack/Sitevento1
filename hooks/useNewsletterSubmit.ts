// hooks/useNewsletterSubmit.ts
//
// Replaces handleNewsletterSubmit(event): button text swaps to "..." for
// 700ms, then the footer note confirms. No real subscribe endpoint in
// the original — this is the same fire-and-forget simulated delay.
'use client';

import { useCallback, useState } from 'react';

export function useNewsletterSubmit() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('No spam. Unsubscribe anytime.');

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (submitting) return;
      setSubmitting(true);
      setTimeout(() => {
        setSubmitting(false);
        setEmail('');
        setNote("You're subscribed. Thanks!");
      }, 700);
    },
    [submitting]
  );

  return { email, setEmail, submitting, note, handleSubmit };
}
