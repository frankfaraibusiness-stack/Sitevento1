'use client';

// components/apidocs/CopyButton.tsx — copy-to-clipboard for the public API
// docs. `text` is copied as-is; with `fetchUrl` the text is fetched on click
// (used for "copy the whole reference as Markdown"). Works without any
// account and falls back to a hidden textarea when the Clipboard API is
// blocked. The rest of the docs page is plain server HTML, so crawlers and
// AI tools never depend on this component.
import { useEffect, useRef, useState } from 'react';

interface Props {
  text?: string;
  fetchUrl?: string;
  label?: string;
  doneLabel?: string;
  className?: string;
  title?: string;
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function CopyButton({ text, fetchUrl, label = 'Copy', doneLabel = 'Copied', className = '', title }: Props) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'fail'>('idle');
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  async function onClick() {
    setState('busy');
    let value = text ?? '';
    if (fetchUrl) {
      try {
        const res = await fetch(fetchUrl);
        value = await res.text();
      } catch {
        value = '';
      }
    }
    const ok = value ? await writeClipboard(value) : false;
    setState(ok ? 'done' : 'fail');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 1800);
  }

  return (
    <button type="button" className={`apd-copy ${className}${state === 'done' ? ' is-done' : ''}`} onClick={onClick} title={title} aria-live="polite">
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {state === 'done' ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : (<><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" /></>)}
      </svg>
      <span>{state === 'done' ? doneLabel : state === 'fail' ? 'Select & copy' : label}</span>
    </button>
  );
}
