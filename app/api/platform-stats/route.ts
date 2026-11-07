// app/api/platform-stats/route.ts
//
// GET → one read-only snapshot of sitevento's platform-wide numbers,
// for the Console dashboard (app/console). Nothing in this route ever
// writes — it only aggregates data that other routes already produce:
//   - users/{uid}                  → total accounts, signups/day
//     (createdAt is already seeded by app/api/create-account)
//   - users/{uid}/sites/{siteId}   → total connected sites, via a
//     Firestore collectionGroup('sites') count — same .count()
//     aggregation app/api/site-limits and app/api/connect-site already
//     use, so this is a single cheap aggregation query, not N reads.
//   - platformDaily/{YYYY-MM-DD}   → platform (marketing-site) visits,
//     unique visitors, and signups per day — written by the new
//     app/api/platform-track route (see that route's header for why
//     this collection didn't exist before now).
//
// Gated behind the Console passcode cookie (app/api/console-auth) —
// NOT the regular user auth system, and NOT scoped to any one
// account; this is deliberately a platform-operator-only view. See
// console-auth's header for the testing-phase caveat.
//
// Response shape:
// {
//   ok: true,
//   totals: {
//     users: number,
//     sitesConnected: number,
//     verifiedSites: number,
//     platformVisitsAllTime: number,
//     signupsAllTime: number,
//   },
//   today: {
//     newUsers: number,
//     platformVisits: number,
//     uniqueVisitors: number,
//     signups: number,
//   },
//   conversion: {
//     // signups / unique visitors over the trailing window below —
//     // the one number more useful than an all-time ratio, since an
//     // all-time ratio is dominated by very early, low-traffic days.
//     ratePct: number,
//     windowDays: number,
//   },
//   series: Array<{
//     date: string,       // YYYY-MM-DD, UTC
//     visits: number,
//     uniqueVisitors: number,
//     signups: number,
//     newUsers: number,   // from users/{uid}.createdAt, bucketed by day
//   }>,  // last `windowDays` days, oldest first
// }
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const maxDuration = 20;
export const dynamic = 'force-dynamic';

const CONSOLE_COOKIE_NAME = 'console_session';
const CONSOLE_COOKIE_VALUE = 'granted-2026-console';
const WINDOW_DAYS = 30;

function dateKeysForWindow(days: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get(CONSOLE_COOKIE_NAME)?.value;
    if (cookie !== CONSOLE_COOKIE_VALUE) {
      return NextResponse.json({ ok: false, error: 'Not authorized.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[platform-stats] Firebase Admin init error', err);
      return NextResponse.json(
        { ok: false, error: 'Server is not configured yet (missing Firebase Admin credentials).' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const dayKeys = dateKeysForWindow(WINDOW_DAYS);
    const today = todayKey();

    // ── Totals: users, sites ──────────────────────────────────────
    // .count() aggregation queries run server-side in Firestore
    // itself (one network round trip, no document reads billed at
    // per-doc rates) — same pattern already used by
    // app/api/site-limits and app/api/connect-site.
    const [usersCountSnap, sitesCountSnap, verifiedSitesCountSnap] = await Promise.all([
      db.collection('users').count().get(),
      db.collectionGroup('sites').count().get(),
      db.collectionGroup('sites').where('status', '==', 'verified').count().get(),
    ]);

    const totalUsers = usersCountSnap.data().count;
    const totalSites = sitesCountSnap.data().count;
    const totalVerifiedSites = verifiedSitesCountSnap.data().count;

    // ── New users per day, over the window ──────────────────────────
    // users/{uid}.createdAt is a plain epoch-ms number (seeded by
    // app/api/create-account) — no Firestore Timestamp index needed,
    // just a range query and a client-side day bucket.
    const windowStartMs = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const newUsersByDay: Record<string, number> = {};
    for (const k of dayKeys) newUsersByDay[k] = 0;
    let signupsAllTime = totalUsers; // every account that exists signed up at some point

    try {
      const recentUsersSnap = await db
        .collection('users')
        .where('createdAt', '>=', windowStartMs)
        .select('createdAt')
        .get();
      for (const doc of recentUsersSnap.docs) {
        const createdAt = doc.data()?.createdAt;
        if (typeof createdAt === 'number') {
          const key = new Date(createdAt).toISOString().slice(0, 10);
          if (key in newUsersByDay) newUsersByDay[key] += 1;
        }
      }
    } catch (err) {
      // Missing composite index or similar — degrade to all-zero
      // daily new-user series rather than failing the whole
      // dashboard. Totals above are unaffected.
      console.error('[platform-stats] recent-users query failed (series will show 0s)', err);
    }

    // ── Platform (marketing-site) visits/signups per day ────────────
    const dayDocs = await Promise.all(
      dayKeys.map((key) =>
        db
          .collection('platformDaily')
          .doc(key)
          .get()
          .then((snap) => ({ key, data: snap.exists ? snap.data() : null }))
          .catch(() => ({ key, data: null }))
      )
    );

    let platformVisitsAllTimeWindow = 0;
    let uniqueVisitorsWindow = 0;
    let signupsFromBeaconWindow = 0;

    const series = dayDocs.map(({ key, data }) => {
      const visits = typeof data?.visits === 'number' ? data.visits : 0;
      const uniqueVisitors = typeof data?.uniqueVisitors === 'number' ? data.uniqueVisitors : 0;
      const signups = typeof data?.signups === 'number' ? data.signups : 0;
      platformVisitsAllTimeWindow += visits;
      uniqueVisitorsWindow += uniqueVisitors;
      signupsFromBeaconWindow += signups;
      return { date: key, visits, uniqueVisitors, signups, newUsers: newUsersByDay[key] || 0 };
    });

    const todayData = dayDocs.find((d) => d.key === today)?.data || null;
    const todayVisits = typeof todayData?.visits === 'number' ? todayData.visits : 0;
    const todayUniques = typeof todayData?.uniqueVisitors === 'number' ? todayData.uniqueVisitors : 0;
    const todaySignups = typeof todayData?.signups === 'number' ? todayData.signups : 0;
    const todayNewUsers = newUsersByDay[today] || 0;

    // All-time platform visits — one extra aggregation read across
    // every platformDaily doc ever written. Cheap relative to the
    // per-day docs above (one query, not one-per-day), and the only
    // way to report an all-time total without maintaining a separate
    // running counter doc.
    let platformVisitsAllTime = platformVisitsAllTimeWindow;
    try {
      const allDaysSnap = await db.collection('platformDaily').get();
      let sum = 0;
      for (const doc of allDaysSnap.docs) {
        const v = doc.data()?.visits;
        if (typeof v === 'number') sum += v;
      }
      platformVisitsAllTime = sum;
    } catch (err) {
      console.error('[platform-stats] all-time visits aggregation failed (using window sum)', err);
    }

    const conversionRatePct = uniqueVisitorsWindow > 0 ? (signupsFromBeaconWindow / uniqueVisitorsWindow) * 100 : 0;

    return NextResponse.json(
      {
        ok: true,
        totals: {
          users: totalUsers,
          sitesConnected: totalSites,
          verifiedSites: totalVerifiedSites,
          platformVisitsAllTime,
          signupsAllTime,
        },
        today: {
          newUsers: todayNewUsers,
          platformVisits: todayVisits,
          uniqueVisitors: todayUniques,
          signups: todaySignups,
        },
        conversion: {
          ratePct: Math.round(conversionRatePct * 100) / 100,
          windowDays: WINDOW_DAYS,
        },
        series,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[platform-stats] UNCAUGHT handler error', err);
    return NextResponse.json({ ok: false, error: 'Could not load platform stats.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
