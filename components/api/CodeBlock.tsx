'use client';

// components/api/CodeBlock.tsx — scrollable code with a copy button; JSON gets light syntax colour.
import type { ReactNode } from 'react';
import { ApiIcon } from './apiIcons';
import { IconCheck } from '@/components/analytics/AnalyticsIcons';
import { useCopy } from './useCopy';

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\b\d+(?:\.\d+)?\b)|\b(true|false|null)\b/g;

/** Colours JSON-ish text: keys, strings, numbers, literals. Anything else passes through. */
export function highlightJson(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of Array.from(code.matchAll(TOKEN))) {
    const at = m.index ?? 0;
    if (at > last) out.push(code.slice(last, at));
    if (m[1]) {
      if (m[2]) {
        out.push(<span key={n++} className="apx-tk-key">{m[1]}</span>);
        out.push(m[2]);
      } else {
        out.push(<span key={n++} className="apx-tk-str">{m[1]}</span>);
      }
    } else if (m[3]) {
      out.push(<span key={n++} className="apx-tk-num">{m[3]}</span>);
    } else if (m[4]) {
      out.push(<span key={n++} className="apx-tk-lit">{m[4]}</span>);
    }
    last = at + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

interface Props {
  code: string;
  /** What the copy button copies, when it differs from what's shown (e.g. a masked key). */
  copyText?: string;
  label?: string;
  json?: boolean;
  id: string;
}

export function CodeBlock({ code, copyText, label, json, id }: Props) {
  const { copied, copy } = useCopy();
  const done = copied === id;
  return (
    <div className="apx-code">
      <div className="apx-code-bar">
        <span>{label ?? ''}</span>
        <button type="button" className={done ? 'apx-copy is-done' : 'apx-copy'} onClick={() => copy(copyText ?? code, id)} aria-label={`Copy ${label ?? 'code'}`}>
          {done ? <IconCheck /> : <ApiIcon name="copy" />}
          <span>{done ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre tabIndex={0}>
        <code>{json ? highlightJson(code) : code}</code>
      </pre>
    </div>
  );
}
