// app/api/wallet/route.ts
//
// POST { idToken, action, ...fields } — backend for /dashboard/wallet.
// Same single-route, action-dispatch shape as app/api/advertise/route.ts
// and app/api/user-action/route.ts: one authenticated endpoint, several
// related actions, instead of a route file per verb.
//
// Actions:
//   'get-wallet'       {}                      -> balance + ledger page
//   'deposit'          { amountUsd }            -> adds to the prepaid balanceMicrocents ledger
//   'set-auto-recharge'{ enabled }              -> toggles whether overage writes may draw from the wallet at all
//
// ── No payment provider wired up ──────────────────────────────────
// Identical situation and identical honesty to app/api/advertise's own
// 'top-up' action (see that route's header comment in full) — nothing
// in this codebase integrates Stripe or any other processor yet.
// 'deposit' is a prepaid-ledger adjustment ONLY: it increments
// balanceMicrocents directly, it does not charge a card. Wiring in a
// real processor later means putting a payment webhook in front of
// this same balance-increment transaction (only call it from a
// successful charge event) rather than trusting a client POST body
// directly — this route is written so that gate slots in as one more
// condition before the existing Firestore write, not a rewrite. It is
// NOT safe to expose as-is to let anyone grant themselves free wallet
// balance; that is an accepted, explicit limitation carried over from
// the advertise route's own prepaid ledger.
//
// ── Why this is a separate route from app/api/advertise ──────────────
// The wallet is GLOBAL (one per account, pays for daily-write overage
// across every connected site) where advertiserAccount/billing is
// scoped to ad spend specifically — different collection
// (users/{uid}/wallet/account vs users/{uid}/advertiserAccount/billing),
// different consumer (lib/serverAuth.ts's write-limit enforcement vs
// app/api/ad-track's per-impression pricing), different unit
// (microcents here, matching USD cents 1:1 would lose precision on a
// $0.00001-per-write rate — see lib/wallet.ts's header for why
// microcents). Keeping them as two ledgers, not one shared balance,
// means a user's ad budget and their write-overage budget can never
// accidentally drain each other.
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminApp, getAdminDb, jsonError, verifyCaller, rateLimitOk, getCallerPlan } from '@/lib/serverAuth';
import {
  MIN_DEPOSIT_USD,
  MAX_DEPOSIT_USD,
  usdToMicrocents,
  summarizeWallet,
  type WalletAccountDoc,
  type WalletLedgerEntry,
} from '@/lib/wallet';

export const maxDuration = 10;
export const runtime = 'nodejs';

const MAX_BODY_BYTES = 8 * 1024;
const LEDGER_PAGE_SIZE = 25;

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) return jsonError(400, 'Request body too large.');
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return jsonError(400, 'Request body too large.');

    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonError(400, 'Malformed JSON body.');
    }

    const { idToken, action } = body || {};
    if (typeof action !== 'string') return jsonError(400, 'Missing action.');

    let app;
    try {
      app = getAdminApp();
    } catch (err) {
      console.error('[wallet] Firebase Admin init error', err);
      return jsonError(500, 'Server is not configured yet (missing Firebase Admin credentials).');
    }

    const uid = await verifyCaller(app, idToken);
    if (!uid) return jsonError(401, 'Invalid or expired session. Please sign in again.');

    if (!rateLimitOk(`wallet:${uid}:${action}`, 30, 60_000)) {
      return jsonError(429, 'Too many requests. Please try again shortly.');
    }

    const db = getAdminDb();
    const walletRef = db.collection('users').doc(uid).collection('wallet').doc('account');
    const ledgerCol = walletRef.collection('ledger');

    switch (action) {
      case 'get-wallet': {
        const { cursor } = body || {};
        let query = ledgerCol.orderBy('createdAt', 'desc').limit(LEDGER_PAGE_SIZE);
        if (typeof cursor === 'string' && cursor) {
          const cursorSnap = await ledgerCol.doc(cursor).get();
          if (cursorSnap.exists) query = query.startAfter(cursorSnap);
        }

        const [walletSnap, ledgerSnap, planId] = await Promise.all([walletRef.get(), query.get(), getCallerPlan(db, uid)]);
        const walletDoc = (walletSnap.exists ? walletSnap.data() : null) as WalletAccountDoc | null;

        const entries: WalletLedgerEntry[] = ledgerSnap.docs.map((d) => {
          const data = d.data();
          const createdAt =
            data.createdAt && typeof data.createdAt.toDate === 'function'
              ? data.createdAt.toDate().toISOString()
              : new Date().toISOString();
          return {
            id: d.id,
            kind: data.kind,
            amountMicrocents: data.amountMicrocents ?? 0,
            balanceAfterMicrocents: data.balanceAfterMicrocents ?? 0,
            writesCovered: data.writesCovered,
            planId: data.planId,
            note: data.note,
            createdAt,
          };
        });

        return NextResponse.json(
          {
            ok: true,
            wallet: summarizeWallet(walletDoc, planId),
            ledger: entries,
            nextCursor: ledgerSnap.docs.length === LEDGER_PAGE_SIZE ? ledgerSnap.docs[ledgerSnap.docs.length - 1].id : null,
          },
          { status: 200, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      case 'deposit': {
        const { amountUsd } = body || {};
        if (
          typeof amountUsd !== 'number' ||
          !Number.isFinite(amountUsd) ||
          amountUsd < MIN_DEPOSIT_USD ||
          amountUsd > MAX_DEPOSIT_USD
        ) {
          return jsonError(400, `amountUsd must be a number between ${MIN_DEPOSIT_USD} and ${MAX_DEPOSIT_USD}.`);
        }
        const depositMicrocents = usdToMicrocents(Math.round(amountUsd * 100) / 100);

        const result = await db.runTransaction(async (tx) => {
          const snap = await tx.get(walletRef);
          const current = (snap.exists ? (snap.data() as WalletAccountDoc).balanceMicrocents : 0) || 0;
          const next = current + depositMicrocents;

          tx.set(
            walletRef,
            {
              balanceMicrocents: next,
              lifetimeDepositedMicrocents: FieldValue.increment(depositMicrocents),
              autoRechargeEnabled: snap.exists ? undefined : true,
              updatedAt: FieldValue.serverTimestamp(),
              createdAt: snap.exists ? undefined : FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          const entryRef = ledgerCol.doc();
          tx.set(entryRef, {
            kind: 'deposit',
            amountMicrocents: depositMicrocents,
            balanceAfterMicrocents: next,
            createdAt: FieldValue.serverTimestamp(),
          });

          return next;
        });

        return NextResponse.json(
          { ok: true, balanceMicrocents: result },
          { status: 200, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      case 'set-auto-recharge': {
        const { enabled } = body || {};
        if (typeof enabled !== 'boolean') return jsonError(400, 'enabled must be a boolean.');

        await walletRef.set(
          { autoRechargeEnabled: enabled, updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );

        return NextResponse.json({ ok: true, autoRechargeEnabled: enabled }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
      }

      default:
        return jsonError(400, `Unknown action: ${action}`);
    }
  } catch (err) {
    console.error('[wallet] error', err);
    return jsonError(500, 'Something went wrong. Please try again.');
  }
}
