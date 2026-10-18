#!/usr/bin/env node
// scripts/manage-widget.mjs
//
// Admin-only CLI for the widget catalog. Uses the Firebase Admin SDK
// with the same service-account env vars as the deployed app
// (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY),
// so it writes with full trust — never run this against untrusted
// input, and never port this logic into a browser-reachable route.
//
// This is what makes "add a widget, it shows up immediately with no
// redeploy" literally true: app/api/widget/route.ts reads
// widgets/{widgetId} and sites/{siteId}/widgets/{widgetId} fresh on
// every request (short server-side cache only — see that route's
// CACHE_CONTROL comment), so writing new docs here is the entire
// deployment step for a new widget.
//
// ── Usage ───────────────────────────────────────────────────────────
//
//   # Add/update a widget in the global catalog:
//   node scripts/manage-widget.mjs put-widget \
//     --id tic-tac-toe \
//     --name "Tic Tac Toe" \
//     --type iframe \
//     --bundleUrl https://cdn.example.com/widgets/tic-tac-toe/index.html \
//     --version 1 \
//     --enabled true
//
//   # Grant (or update) one site's access to a widget:
//   node scripts/manage-widget.mjs put-site-widget \
//     --uid <ownerUid> --siteId <siteId> --widgetId tic-tac-toe \
//     --enabled true --config '{"height":"520px"}' --version 1
//
//   # Disable a widget globally (immediately blocks delivery everywhere):
//   node scripts/manage-widget.mjs put-widget --id tic-tac-toe --enabled false
//
// Run with: node scripts/manage-widget.mjs <command> [--flag value ...]

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function getAdminDb() {
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
      });
  return getFirestore(app);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i += 1;
      }
    }
  }
  return out;
}

function toBool(v, fallback) {
  if (v === undefined) return fallback;
  if (typeof v === 'boolean') return v;
  return String(v).toLowerCase() === 'true';
}

async function putWidget(db, args) {
  if (!args.id) throw new Error('--id is required');
  const ref = db.collection('widgets').doc(String(args.id));
  const existing = await ref.get();

  const data = {
    name: args.name ?? existing.data()?.name ?? args.id,
    type: args.type ?? existing.data()?.type ?? 'iframe',
    enabled: toBool(args.enabled, existing.exists ? existing.data().enabled : true),
    version: args.version !== undefined ? Number(args.version) : existing.data()?.version ?? 1,
    bundleUrl: args.bundleUrl ?? existing.data()?.bundleUrl,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (!data.bundleUrl) {
    throw new Error('--bundleUrl is required the first time a widget is created');
  }
  if (!data.bundleUrl.startsWith('https://')) {
    throw new Error('--bundleUrl must be an https:// URL (widgets are always delivered over HTTPS)');
  }

  await ref.set(data, { merge: true });
  console.log(`widgets/${args.id} ${existing.exists ? 'updated' : 'created'}:`, data);
}

async function putSiteWidget(db, args) {
  if (!args.uid) throw new Error('--uid is required');
  if (!args.siteId) throw new Error('--siteId is required');
  if (!args.widgetId) throw new Error('--widgetId is required');

  const siteRef = db.collection('users').doc(args.uid).collection('sites').doc(args.siteId);
  const siteSnap = await siteRef.get();
  if (!siteSnap.exists) {
    throw new Error(`No site users/${args.uid}/sites/${args.siteId} — check the uid/siteId.`);
  }

  const ref = siteRef.collection('widgets').doc(args.widgetId);
  const existing = await ref.get();

  let config = existing.data()?.config ?? {};
  if (args.config) {
    try {
      config = JSON.parse(args.config);
    } catch {
      throw new Error('--config must be valid JSON, e.g. --config \'{"height":"480px"}\'');
    }
  }

  const data = {
    enabled: toBool(args.enabled, existing.exists ? existing.data().enabled : true),
    config,
    version: args.version !== undefined ? Number(args.version) : existing.data()?.version ?? 1,
  };

  await ref.set(data, { merge: true });
  console.log(
    `users/${args.uid}/sites/${args.siteId}/widgets/${args.widgetId} ${existing.exists ? 'updated' : 'created'}:`,
    data
  );
}

// The 10 widget ids this project ships UI/content for (see lib/widgets.ts
// WIDGET_CATALOG and app/w/[widgetId]/ for the actual rendered content).
// Every one is served from THIS deployment's own /w/{id} route — no
// separate CDN/hosting needed — so seeding the catalog is just pointing
// each widgetId at https://<your-deployment>/w/{id}.
const SHIPPED_WIDGET_IDS = [
  'support-chat',
  'spin-wheel',
  'exit-intent',
  'countdown-timer',
  'social-proof',
  'reviews-widget',
  'video-popup',
  'feedback-widget',
  'referral-widget',
  'announcement-bar',
];

async function seedCatalog(db, args) {
  if (!args.baseUrl) {
    throw new Error(
      '--baseUrl is required, e.g. --baseUrl https://your-app.vercel.app (no trailing slash)'
    );
  }
  if (!args.baseUrl.startsWith('https://')) {
    throw new Error('--baseUrl must be an https:// URL');
  }
  const base = args.baseUrl.replace(/\/$/, '');

  for (const id of SHIPPED_WIDGET_IDS) {
    const ref = db.collection('widgets').doc(id);
    const existing = await ref.get();
    const data = {
      name: existing.data()?.name ?? id,
      type: 'iframe',
      enabled: true,
      version: existing.data()?.version ?? 1,
      bundleUrl: `${base}/w/${id}`,
      updatedAt: FieldValue.serverTimestamp(),
    };
    await ref.set(data, { merge: true });
    console.log(`widgets/${id} ${existing.exists ? 'updated' : 'created'} -> ${data.bundleUrl}`);
  }
  console.log(`\nSeeded ${SHIPPED_WIDGET_IDS.length} widgets. Each site must still be granted access with put-site-widget before it can use one.`);
}

async function main() {
  const [, , command, ...rest] = process.argv;
  const args = parseArgs(rest);
  const db = getAdminDb();

  if (command === 'put-widget') {
    await putWidget(db, args);
  } else if (command === 'put-site-widget') {
    await putSiteWidget(db, args);
  } else if (command === 'seed-catalog') {
    await seedCatalog(db, args);
  } else {
    console.error(
      'Usage:\n' +
        '  node scripts/manage-widget.mjs put-widget --id <id> --name <name> --type iframe --bundleUrl <https url> [--version N] [--enabled true|false]\n' +
        '  node scripts/manage-widget.mjs put-site-widget --uid <uid> --siteId <siteId> --widgetId <id> [--enabled true|false] [--config \'<json>\'] [--version N]\n' +
        '  node scripts/manage-widget.mjs seed-catalog --baseUrl https://your-app.vercel.app\n' +
        '      (creates/updates all 10 shipped widgets in the global catalog, pointing\n' +
        '       each bundleUrl at this deployment\'s own /w/{id} route)'
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
