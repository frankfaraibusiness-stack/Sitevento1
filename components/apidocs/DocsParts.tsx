// components/apidocs/DocsParts.tsx — server-rendered building blocks of the
// public API docs (/docs/api). No client JS except the copy buttons, so every
// word of the reference is in the HTML that crawlers and AI tools receive.
import type { ReactNode } from 'react';
import { CopyButton } from './CopyButton';
import type { DocField } from '@/lib/apiDocsSpec';

/** Tiny JSON highlighter: keys, strings, numbers, booleans. Returns spans. */
function highlightJson(src: string): ReactNode[] {
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push(src.slice(last, m.index));
    if (m[1] && m[2]) {
      out.push(<span key={i++} className="t-key">{m[1]}</span>);
      out.push(m[2]);
    } else if (m[1]) out.push(<span key={i++} className="t-str">{m[1]}</span>);
    else if (m[3]) out.push(<span key={i++} className="t-lit">{m[3]}</span>);
    else out.push(<span key={i++} className="t-num">{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push(src.slice(last));
  return out;
}

interface CodeProps {
  code: string;
  lang: string;
  /** Highlight as JSON. */
  json?: boolean;
  copyLabel?: string;
}

export function Code({ code, lang, json, copyLabel }: CodeProps) {
  return (
    <div className="apd-code">
      <div className="apd-code-bar">
        <span className="apd-code-lang">{lang}</span>
        <CopyButton text={code} label={copyLabel ?? 'Copy'} />
      </div>
      <pre tabIndex={0}>
        <code>{json ? highlightJson(code) : code}</code>
      </pre>
    </div>
  );
}

const TYPE_LABEL: Record<string, string> = {
  text: 'string',
  number: 'number',
  integer: 'integer',
  boolean: 'boolean',
  date: 'date YYYY-MM-DD',
  datetime: 'ISO 8601 date-time',
  list: 'array',
  object: 'object',
};

export function FieldTable({ fields, caption }: { fields: DocField[]; caption?: string }) {
  return (
    <div className="apd-tablewrap">
      <table className="apd-table apd-fields">
        {caption && <caption className="apd-sr">{caption}</caption>}
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Type</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.name}>
              <td data-label="Field">
                <code className="apd-fname">{f.name}</code>
                <span className={`apd-req${f.required ? ' is-req' : ''}`}>{f.required ? 'required' : 'optional'}</span>
              </td>
              <td data-label="Type">
                <span className="apd-type">{TYPE_LABEL[f.type] ?? f.type}</span>
              </td>
              <td data-label="Description">
                {f.note}
                {f.enum && (
                  <span className="apd-enum">
                    One of:{' '}
                    {f.enum.map((v) => (
                      <code key={v}>{v}</code>
                    ))}
                  </span>
                )}
                {f.default && (
                  <span className="apd-default">
                    Default: <code>{f.default}</code>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
