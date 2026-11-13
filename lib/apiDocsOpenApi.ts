// lib/apiDocsOpenApi.ts — OpenAPI 3.1 description of POST /api/ingest, built
// from lib/apiDocsSpec.ts (served at /docs/openapi.json). One request body
// schema per event, discriminated by `event`, so code generators and AI
// tools know exactly which fields each event needs.
import {
  COMMON_FIELDS,
  DOCS_SITE_URL,
  DOCS_URL,
  DOC_EVENTS,
  DOC_STATUSES,
  INGEST_URL,
  withSite,
  type DocEvent,
  type DocField,
} from './apiDocsSpec';

type Json = Record<string, unknown>;

function fieldSchema(f: DocField): Json {
  const base: Json = { description: f.note };
  switch (f.type) {
    case 'number':
      return { ...base, type: 'number', minimum: 0 };
    case 'integer':
      return { ...base, type: 'integer', minimum: 0 };
    case 'boolean':
      return { ...base, type: 'boolean' };
    case 'date':
      return { ...base, type: 'string', format: 'date', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
    case 'datetime':
      return { ...base, type: 'string', format: 'date-time' };
    case 'list':
      return { ...base, type: 'array', minItems: 1, maxItems: 100, items: { $ref: '#/components/schemas/OrderItem' } };
    case 'object':
      return { ...base, type: 'object', additionalProperties: true };
    default:
      return f.enum ? { ...base, type: 'string', enum: f.enum } : { ...base, type: 'string', maxLength: 200 };
  }
}

function eventSchema(ev: DocEvent, name: string): Json {
  const props: Json = {};
  const required: string[] = ['event'];
  props.event = name.startsWith('custom.<') ? { type: 'string', pattern: '^custom\\.[A-Za-z0-9_.-]{1,60}$', description: 'custom. followed by your event name.' } : { type: 'string', const: name };
  props.siteId = { type: 'string', description: 'Startup id. Required when the account has several startups.' };
  props.visitorId = { type: 'string', maxLength: 200 };
  props.occurredAt = { type: 'string', format: 'date-time', description: 'When it happened (default: now).' };
  for (const f of ev.fields) {
    if (f.name === 'event') continue;
    props[f.name] = fieldSchema(f);
    if (f.required) required.push(f.name);
  }
  return {
    title: name,
    description: `${ev.when} Requires the "${ev.permission}" permission. ${ev.repeat}`,
    type: 'object',
    required,
    properties: props,
    examples: [withSite(ev.example)],
  };
}

export function buildOpenApi(): Json {
  const schemas: Json = {
    OrderItem: {
      type: 'object',
      description: 'One line of an order. `name` or `productId` is required.',
      required: ['price'],
      properties: {
        name: { type: 'string', maxLength: 150 },
        productId: { type: 'string', maxLength: 150 },
        price: { type: 'number', minimum: 0 },
        quantity: { type: 'integer', minimum: 1, maximum: 100000, default: 1 },
        cost: { type: 'number', minimum: 0, description: 'What one unit costs you.' },
      },
      anyOf: [{ required: ['name'] }, { required: ['productId'] }],
    },
    Error: {
      type: 'object',
      required: ['ok', 'error'],
      properties: {
        ok: { type: 'boolean', const: false },
        error: { type: 'string' },
        code: { type: 'string', enum: Array.from(new Set(DOC_STATUSES.map((s) => s.code).filter(Boolean))) },
        field: { type: ['string', 'null'] },
        permission: { type: 'string' },
      },
    },
    Accepted: {
      type: 'object',
      required: ['ok'],
      properties: {
        ok: { type: 'boolean', const: true },
        id: { type: 'string' },
        event: { type: 'string' },
        test: { type: 'boolean' },
        duplicate: { type: 'boolean', description: 'true when this id was already received; nothing was stored or billed.' },
        usage: { type: 'object', properties: { used: { type: 'integer' }, limit: { type: 'integer' } } },
      },
    },
  };
  const names: string[] = [];
  for (const ev of DOC_EVENTS) {
    const name = ev.event.startsWith('custom.<') ? 'CustomEvent' : ev.event.replace(/[^A-Za-z0-9]+/g, '_');
    schemas[name] = eventSchema(ev, ev.event);
    names.push(name);
  }

  const errorResponses: Json = {};
  const seen = new Set<number>();
  for (const s of DOC_STATUSES) {
    if (seen.has(s.status)) continue;
    seen.add(s.status);
    const codes = DOC_STATUSES.filter((x) => x.status === s.status);
    errorResponses[String(s.status)] = {
      description: codes.map((c) => `${c.code ? c.code + ': ' : ''}${c.meaning} ${c.fix}`).join('\n'),
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
    };
  }

  const example = DOC_EVENTS.find((e) => e.event === 'order.completed')!;
  void COMMON_FIELDS;

  return {
    openapi: '3.1.0',
    info: {
      title: 'sitevento API',
      version: '1.0.0',
      description: `Send server-side business events (subscriptions, orders, refunds, costs, sign-ups, logins, goals, server health) to sitevento. Human docs: ${DOCS_URL}. One event per request. Money in major units. Traffic metrics can never be written.`,
    },
    servers: [{ url: DOCS_SITE_URL }],
    externalDocs: { description: 'Human-readable reference', url: DOCS_URL },
    paths: {
      '/api/ingest': {
        post: {
          operationId: 'sendEvent',
          summary: 'Send one event',
          description: `Call from your server only (no CORS). The event type must be switched on for the startup at /dashboard/api. Full URL: ${INGEST_URL}`,
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { oneOf: names.map((n) => ({ $ref: `#/components/schemas/${n}` })) },
                example: withSite(example.example),
              },
            },
          },
          responses: {
            '200': { description: 'Accepted (or an ignored duplicate).', content: { 'application/json': { schema: { $ref: '#/components/schemas/Accepted' } } } },
            ...errorResponses,
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', description: 'Account API key: sv_live_… (real) or sv_test_… (test). Get it at /dashboard/api.' },
      },
      schemas,
    },
  };
}
