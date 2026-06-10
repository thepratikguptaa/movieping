# 🎬 MoviePing

Waitlist upcoming movies and get a **push notification the moment they release**. Personalized recommendations, watchlists, and an automated release checker — built on a 100% free stack.

> **Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Firebase Auth · Firestore · Firebase Cloud Messaging (FCM) · TMDB API · Vercel

---

## ✨ Features

- **Auth** — email/password signup, login, logout, profile management
- **Onboarding** — collect favorite genres, languages, industries, and movies
- **Dashboard** — personalized recommendations, upcoming, trending, and your watchlist
- **Movie details** — poster, overview, cast, genres, release date; add/remove watchlist + "notify me"
- **Push notifications** — permission prompt, FCM token storage, foreground + background + click handling, notification history
- **Waitlist system** — subscribe to a movie's release
- **Automated release checker** — scheduled Vercel Cron job fetches TMDB, detects releases, and pushes to subscribers
- **Netflix-inspired** dark, mobile-first, responsive UI with motion

---

## 📁 Folder structure

```
movieping/
├─ firebase.json                 # Firestore deploy config
├─ firestore.rules               # Security rules
├─ firestore.indexes.json        # Composite/collection-group indexes
├─ vercel.json                   # Cron schedule for the release checker
├─ .env.example                  # All required environment variables
├─ public/
│  └─ manifest.webmanifest
└─ src/
   ├─ app/
   │  ├─ layout.tsx              # Root layout + providers
   │  ├─ page.tsx                # Landing
   │  ├─ login/ · signup/        # Auth pages
   │  ├─ onboarding/             # Preference wizard
   │  ├─ (app)/                  # Authenticated, navbar + FCM bootstrap
   │  │  ├─ dashboard/
   │  │  ├─ watchlist/
   │  │  ├─ notifications/
   │  │  ├─ profile/
   │  │  └─ movie/[id]/
   │  ├─ firebase-messaging-sw.js/route.ts   # Service worker (config injected from env)
   │  └─ api/
   │     ├─ fcm/register/        # Store FCM token
   │     ├─ waitlist/            # Subscribe / unsubscribe (server-side)
   │     ├─ movies/              # trending · upcoming · search · genres · recommendations
   │     └─ cron/release-check/  # Scheduled release checker
   ├─ components/                # UI + feature components
   ├─ hooks/use-fcm.ts
   ├─ lib/
   │  ├─ firebase/               # client · admin · messaging · db helpers
   │  ├─ tmdb.ts · notify.ts · server-auth.ts · utils.ts · constants.ts
   │  └─ auth-context.tsx · api-client.ts
   └─ types/index.ts
```

---

## 🗄️ Firestore schema

| Collection / path | Purpose |
| --- | --- |
| `users/{uid}` | Profile + `preferences` + `onboarded` flag |
| `users/{uid}/watchlist/{movieId}` | Watchlist items (`notify` flag) |
| `users/{uid}/fcmTokens/{tokenId}` | Registered device push tokens |
| `users/{uid}/notifications/{id}` | Notification history (server-written) |
| `movies/{movieId}` | Tracked movies for the release checker |
| `movies/{movieId}/subscribers/{uid}` | Waitlist subscribers (`notified` flag) |

Security: users read/write only their own data; `movies/*` is **read-only to clients** and written exclusively via the Admin SDK in API routes. See [`firestore.rules`](./firestore.rules).

---

## 🚀 Local setup

### 1. Prerequisites
- Node 18.18+ (or 20+)
- A free [Firebase](https://console.firebase.google.com/) project
- A free [TMDB API key](https://www.themoviedb.org/settings/api)

### 2. Install
```bash
npm install
```

### 3. Configure Firebase
1. **Authentication** → enable **Email/Password** sign-in.
2. **Firestore Database** → create in production mode.
3. **Project Settings → General** → register a Web app → copy the config into `NEXT_PUBLIC_FIREBASE_*`.
4. **Project Settings → Cloud Messaging → Web Push certificates** → generate a key pair → copy into `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
5. **Project Settings → Service Accounts** → *Generate new private key* → copy `project_id`, `client_email`, `private_key` into `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.

### 4. Environment variables
```bash
cp .env.example .env.local
# then fill every value
```
> For `FIREBASE_PRIVATE_KEY`, keep it on one line wrapped in double quotes with `\n` escapes — the admin helper converts `\n` back to real newlines.

### 5. Deploy Firestore rules & indexes
```bash
npm i -g firebase-tools
firebase login
firebase use <your-project-id>
firebase deploy --only firestore:rules,firestore:indexes
```

### 6. Run
```bash
npm run dev
# http://localhost:3000
```

> **Icons:** add `public/icons/icon-192.png`, `icon-512.png`, and `badge.png` for full PWA/notification icons (the app works without them — they just 404).

---

## 🔔 How notifications work

1. After login, the app requests notification permission (`useFcm`).
2. On grant, it registers `/firebase-messaging-sw.js`, gets an FCM token, and `POST`s it to `/api/fcm/register` → stored under `users/{uid}/fcmTokens`.
3. **Foreground** messages are shown as toasts; **background** messages are handled by the service worker (`onBackgroundMessage`), including click-to-open.
4. Every delivered notification is also written to `users/{uid}/notifications` for the in-app history.

## ⏰ Automated release checker

- Defined in [`vercel.json`](./vercel.json): runs `/api/cron/release-check` every 6 hours.
- It loads tracked movies where `released == false`, re-checks TMDB, flips `released`, then pushes to every subscriber with `notified == false` and marks them done.
- Protected by `CRON_SECRET` (sent by Vercel as `Authorization: Bearer <secret>`).

Trigger manually:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>/api/cron/release-check
```

---

## ☁️ Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in [Vercel](https://vercel.com/new).
3. Add **all** variables from `.env.example` in **Settings → Environment Variables** (set `NEXT_PUBLIC_APP_URL` to your production URL).
4. Add your Vercel domain to Firebase **Auth → Settings → Authorized domains**.
5. Deploy. The cron job is registered automatically from `vercel.json`.

> Vercel Cron is available on the free Hobby plan (limited to daily on Hobby — adjust the schedule in `vercel.json` if needed, e.g. `0 9 * * *`).

---

## 📜 Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | Lint |

Built with ❤️ and TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
