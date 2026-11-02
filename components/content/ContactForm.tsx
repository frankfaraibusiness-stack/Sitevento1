'use client';

// components/content/ContactForm.tsx
//
// Name / email / message form for /contact. Submits to
// app/api/contact/route.ts (Admin SDK, server-side write into
// Firestore's contactSubmissions collection — see that route's header
// comment for why this isn't a direct client Firestore write). On
// success, swaps the form for an animated checkmark
// (.cp-success-circle-ring + .cp-success-check in
// styles/content/content-pages.css, both pure CSS stroke-dash animations).
import { useState } from 'react';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.ok) {
        setStatus('error');
        setErrorMsg(
          data?.reason === 'invalid email'
            ? 'Please enter a valid email address.'
            : data?.reason === 'rate limited'
              ? "You've sent a few messages in a row — please wait a minute and try again."
              : 'Something went wrong sending that. Please try again.'
        );
        return;
      }
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong sending that. Please try again.');
    }
  };

  if (status === 'success') {
    return (
      <div className="cp-success">
        <svg className="cp-success-circle" viewBox="0 0 72 72" fill="none">
          <circle className="cp-success-circle-bg" cx="36" cy="36" r="30" />
          <circle className="cp-success-circle-ring" cx="36" cy="36" r="30" transform="rotate(-90 36 36)" />
          <path className="cp-success-check" d="M23 37.5 32 46.5 50 26.5" />
        </svg>
        <h3>Message sent</h3>
        <p>Thanks, {name.split(' ')[0] || 'there'} — we&apos;ve got it and will reply at {email}.</p>
      </div>
    );
  }

  return (
    <form className="cp-contact-form" onSubmit={handleSubmit}>
      <div className="cp-field">
        <label htmlFor="contact-name">Name</label>
        <input
          id="contact-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jordan Lee"
          autoComplete="name"
        />
      </div>
      <div className="cp-field">
        <label htmlFor="contact-email">Email</label>
        <input
          id="contact-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
        />
      </div>
      <div className="cp-field">
        <label htmlFor="contact-message">Message</label>
        <textarea
          id="contact-message"
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What's going on with your site or account?"
        />
      </div>

      {status === 'error' && <p className="cp-contact-error">{errorMsg}</p>}

      <button className="cp-contact-submit" type="submit" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Sending…' : 'Send message'}
        {status !== 'submitting' && (
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        )}
      </button>
    </form>
  );
}
