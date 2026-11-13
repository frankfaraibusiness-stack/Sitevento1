// components/api/snippets.ts
//
// Builds the copy-paste examples on the API page from one payload object.
// `shownKey` is what's printed (masked unless revealed); the copy button
// always uses the real one — see ApiQuickstart.

export type Lang = 'curl' | 'node' | 'python' | 'php';

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'curl', label: 'cURL' },
  { id: 'node', label: 'Node.js' },
  { id: 'python', label: 'Python' },
  { id: 'php', label: 'PHP' },
];

type Style = 'py' | 'php';

function lit(v: unknown, style: Style, depth: number): string {
  const pad = '  '.repeat(depth + 1);
  const end = '  '.repeat(depth);
  if (v === null || v === undefined) return style === 'py' ? 'None' : 'null';
  if (typeof v === 'boolean') return style === 'py' ? (v ? 'True' : 'False') : v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (Array.isArray(v)) {
    if (v.length === 0) return style === 'py' ? '[]' : '[]';
    return `[\n${v.map((x) => `${pad}${lit(x, style, depth + 1)},`).join('\n')}\n${end}]`;
  }
  const entries = Object.entries(v as Record<string, unknown>);
  if (entries.length === 0) return style === 'py' ? '{}' : '[]';
  const arrow = style === 'py' ? ': ' : ' => ';
  const open = style === 'py' ? '{' : '[';
  const close = style === 'py' ? '}' : ']';
  return `${open}\n${entries.map(([k, x]) => `${pad}'${k}'${arrow}${lit(x, style, depth + 1)},`).join('\n')}\n${end}${close}`;
}

function indentAfterFirst(s: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return s
    .split('\n')
    .map((line, i) => (i === 0 ? line : pad + line))
    .join('\n');
}

export function buildSnippet(lang: Lang, url: string, shownKey: string, payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload, null, 2);

  if (lang === 'curl') {
    const body = json.replace(/'/g, `'\\''`);
    return `curl -X POST ${url} \\\n  -H "Authorization: Bearer ${shownKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '${body}'`;
  }

  if (lang === 'node') {
    return `await fetch("${url}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${shownKey}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(${indentAfterFirst(json, 2)}),
});`;
  }

  if (lang === 'python') {
    return `import requests

requests.post(
    "${url}",
    headers={"Authorization": "Bearer ${shownKey}"},
    json=${indentAfterFirst(lit(payload, 'py', 0), 4)},
)`;
  }

  return `<?php
$ch = curl_init("${url}");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer ${shownKey}",
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode(${indentAfterFirst(lit(payload, 'php', 0), 4)}),
    CURLOPT_RETURNTRANSFER => true,
]);
curl_exec($ch);`;
}
