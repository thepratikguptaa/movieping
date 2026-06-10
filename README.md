# MoviePing

Waitlist movies **and web series** and get a push notification when they hit theatres, when they land on streaming, and when a tracked series gets a new season. Personalized recommendations, watchlists, and automated release/OTT checkers on a fully free stack.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Firebase Auth · Firestore · Firebase Cloud Messaging · TMDB API · Vercel

## Features

- Email/password + Google auth, profile management
- Onboarding wizard (movie genres, **series genres**, languages, industries, favorite movies)
- Dashboard: personalized movie + series recommendations, upcoming, trending movies, trending series, watchlist
- Movie & series detail: poster, overview, cast, genres, release/air date, multi-region "where to watch"
- Unified search across the full TMDB catalog (movies **and** series) with an "upcoming only" filter
- Web push (FCM): permission prompt, token storage, foreground/background delivery, click handling, in-app history
- Three notification events for waitlisted titles — **Now Showing** (theatrical/digital release, movies), **Now Streaming** (lands on an OTT, movies + series) and **New Season** (a tracked series adds a streaming season)
- Netflix-inspired dark UI, mobile-first, responsive

## Project layout

```
src/
├─ app/
│  ├─ layout.tsx · page.tsx          # root + landing
│  ├─ login/ · signup/ · onboarding/
│  ├─ (app)/                         # authed shell: navbar, bottom nav, FCM bootstrap
│  │  ├─ dashboard/ · watchlist/ · notifications/ · profile/
│  │  ├─ search/ · movie/[id]/ · tv/[id]/
│  ├─ firebase-messaging-sw.js/route.ts   # SW, config injected from env
│  └─ api/
│     ├─ fcm/register/               # store FCM token
│     ├─ waitlist/                   # subscribe / unsubscribe (movies + series, server-side)
│     ├─ search/                     # unified movie + series multi-search
│     ├─ movies/                     # trending · upcoming · search · genres · recommendations
│     ├─ tv/                         # trending · genres
│     └─ cron/                       # release-check · ott-check
├─ components/                       # UI + feature components
├─ hooks/use-fcm.ts
├─ lib/                              # firebase/ · tmdb · notify · server-auth · auth-context · utils
└─ types/index.ts
```

## Firestore schema

| Path | Purpose |
| --- | --- |
| `users/{uid}` | Profile, `preferences` (incl. `tvGenres`), `onboarded` |
| `users/{uid}/watchlist/{docId}` | Watchlist items (`mediaType`, `notify`) |
| `users/{uid}/fcmTokens/{tokenId}` | Device push tokens |
| `users/{uid}/notifications/{id}` | Notification history (server-written) |
| `movies/{docId}` | Tracked titles (`mediaType`, `released`, `onOtt`, providers, `seasonCount`) |
| `movies/{docId}/subscribers/{uid}` | Subscribers (`notified`, `ottNotified`, `lastSeasonNotified`) |

`docId` is the bare TMDB id for movies (backward-compatible) and `tv_<id>` for series, since a movie and a series can share the same numeric id. A missing `mediaType` is treated as `movie`.

Clients read/write only their own data. `movies/*` is client-read-only and written solely via the Admin SDK in API routes. Rules in [`firestore.rules`](./firestore.rules).

## Environment

Copy `.env.example` to `.env.local` and populate. Source of each value:

| Variable | Source |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase Console → Project Settings → General → Web app config |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Cloud Messaging → Web Push certificates |
| `FIREBASE_PROJECT_ID` / `CLIENT_EMAIL` / `PRIVATE_KEY` | Service Accounts → generate private key (single line, quoted, `\n` escapes) |
| `TMDB_API_KEY` *(or `TMDB_READ_TOKEN`)* | themoviedb.org API settings |
| `WATCH_REGION` | ISO 3166-1 region for OTT checks (e.g. `US`, `IN`, `GB`) |
| `CRON_SECRET` | Any random string; sent by Vercel Cron as `Authorization: Bearer <secret>` |
| `NEXT_PUBLIC_APP_URL` | Public base URL; used in notification links |

Firebase requirements: enable Email/Password (and Google) sign-in, create the Firestore database, and add the deploy domain under Auth → Settings → Authorized domains.

## Run

```bash
npm install
npm run dev          # http://localhost:3000

firebase deploy --only firestore:rules,firestore:indexes
```

PWA/notification icons (`public/icons/icon-192.png`, `icon-512.png`, `badge.png`) are optional — the app runs without them.

## Notifications

FCM token is requested after login, stored under `users/{uid}/fcmTokens`, and used by the server to push. Foreground messages render as toasts; background messages are handled by the service worker (`onBackgroundMessage`), including click-to-focus. Every delivered notification is also written to `users/{uid}/notifications`.

## Automated checkers (Vercel Cron)

Defined in [`vercel.json`](./vercel.json), authenticated with `CRON_SECRET`.

| Endpoint | Schedule | Behavior |
| --- | --- | --- |
| `/api/cron/release-check` | daily | Flips `released` for tracked movies, pushes **Now Showing** to subscribers where `notified == false`. (Series skip this — they're written `released: true` and driven entirely by the OTT checker.) |
| `/api/cron/ott-check` | daily | Checks TMDB watch-providers for `WATCH_REGION`. **Movies:** on new streaming availability pushes **Now Streaming** to subscribers where `ottNotified == false`. **Series:** re-checked every run (even when already streaming) to also detect new seasons — first availability pushes **Now Streaming**, a higher aired-season count than last recorded pushes **New Season**. |

Subscribing records a title's current release/streaming state (and, for series, the current season count), so already-available titles and existing seasons don't fire a false alert later. Manual trigger:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/release-check
curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/ott-check
```

Both crons run once daily (08:00 UTC) per [`vercel.json`](./vercel.json) — within Vercel Hobby's once-daily cron limit. Bump the schedule or trigger manually for faster checks on paid plans.

## Deploy

Push to GitHub, import in Vercel, set all env vars (point `NEXT_PUBLIC_APP_URL` at the production URL), add the Vercel domain to Firebase authorized domains. Crons register automatically from `vercel.json`. TMDB is reachable server-side from Vercel without a VPN.

## Scripts

`npm run dev` · `npm run build` · `npm start` · `npm run lint`

---

Uses the TMDB API; not endorsed or certified by TMDB.
