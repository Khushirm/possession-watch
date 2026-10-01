# Possession Watch

**A watchdog for people waiting on under-construction flats in India.**

Builders must publish progress, completion-date extensions and complaints on their state's RERA portal. Almost no buyer checks
those clunky portals, so a delay usually becomes visible only after the possession date has passed. Possession Watch checks
your project's public page every morning and records what changed, in plain language. It also estimates the delay interest
you're owed under Section 18 of the RERA Act.

## MVP scope

| Feature | Where |
|---|---|
| Watch a project page (RERA page or builder's updates page) | App → Projects → **+** |
| Daily automatic check at 07:00 IST + manual "Check now" | Inngest cron → Firecrawl |
| Key facts: completion dates, extensions, complaints, progress % | Firecrawl JSON extraction |
| Change timeline with the exact lines added/removed | Project screen |
| Delay-interest calculator (works offline, no server needed) | App → Calculator |

Out of scope for now: push notifications, user accounts, agreement-PDF reading. See [Next steps](#next-steps).

## How it works

```
Expo app ──REST──▶ Hono API (Node) ──event──▶ Inngest ──▶ check-project function
                       │                                    1. Firecrawl: page → markdown  (1 credit)
                       │                                    2. unchanged? → done
                       ▼                                    3. changed → Firecrawl JSON facts (~5 credits)
                   SQLite / Turso (libSQL) ◀────────────────4. save snapshot + update entry
```

- **Credit-aware:** structured extraction runs only when the page text actually changes. Watching 10 projects daily is about
  300 credits/month in the steady state. Firecrawl's free plan includes more than that (check the
  [pricing page](https://www.firecrawl.dev/pricing) for the current allowance).
- **No false alarms from counters:** visitor counters and "last updated" clocks are removed before comparing pages.
- **Durable jobs:** Inngest retries transient failures. A bad API key or exhausted credits fail immediately, with a readable
  message shown in the app.

## Run it locally

You need Node 22.13+ (24 recommended) and the **Expo Go** app on your phone.

### 1. Server

```bash
cd server
npm install
cp .env.example .env        # then paste your FIRECRAWL_API_KEY
npm run dev                 # API on http://localhost:3000
```

In a second terminal, start the Inngest Dev Server. It's free, runs locally and doesn't need an account:

```bash
cd server
npm run inngest:dev         # dashboard at http://localhost:8288
```

### 2. App

```bash
cd app
npm install
cp .env.example .env        # set EXPO_PUBLIC_API_URL to http://<your-PC-LAN-IP>:3000
npx expo start              # scan the QR code with Expo Go
```

Find your LAN IP with `ipconfig` (IPv4 Address). Your phone and PC must be on the same Wi-Fi. If Windows Firewall asks about
Node.js, allow it on **Private networks**.

### Keys and config

| Variable | Where | Required | Get it from |
|---|---|---|---|
| `FIRECRAWL_API_KEY` | `server/.env` | Yes | https://www.firecrawl.dev → sign up (free) → API Keys |
| `INNGEST_DEV=1` | `server/.env` | Local only | Already in `.env.example` |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | `server/.env` | Only when deployed | https://app.inngest.com (free Hobby plan) |
| `APP_API_TOKEN` / `EXPO_PUBLIC_API_TOKEN` | both `.env` files | Optional locally, required in production | Any long random string, the same in both |
| `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | `server/.env` | Token only for Turso | Defaults to a local SQLite file |
| `EXPO_PUBLIC_API_URL` | `app/.env` | Yes | Your PC's LAN IP + `:3000` |

## Deploy (free)

The server runs on **Render** (free web service), data lives in **Turso** (hosted SQLite), and **Inngest Cloud** runs the
daily 07:00 IST check. The Android app is built as an APK with **EAS**. All four have free plans; none needs a card.

1. **Turso database.** Sign up at https://turso.tech, create a database (region: Mumbai / `aws-ap-south-1`), and copy its
   **URL** (`libsql://…`) and a **token** (Database → *Create Token*).
2. **Inngest keys.** Sign up at https://app.inngest.com, then copy the **Event Key** (Manage → Event Keys) and the
   **Signing Key** (Manage → Signing Key) from the *Production* environment.
3. **Render.** Push this repo to GitHub. In https://dashboard.render.com choose **New → Blueprint**, pick the repo, and
   fill in the five secrets it asks for (`FIRECRAWL_API_KEY`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `INNGEST_EVENT_KEY`,
   `INNGEST_SIGNING_KEY`). `render.yaml` sets everything else, including a generated `APP_API_TOKEN`.
   Check `https://<service>.onrender.com/health` returns `{"status":"ok"}`.
4. **Connect Inngest.** In Inngest → Apps → **Sync new app**, enter `https://<service>.onrender.com/api/inngest`.
   Both functions (`check-project`, `check-all-projects-daily`) should appear.
5. **Android APK.**
   ```bash
   cd app
   npx eas-cli login
   npx eas-cli init                      # links the project to your Expo account (writes projectId to app.json)
   npx eas-cli env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://<service>.onrender.com --visibility plaintext
   npx eas-cli env:create --environment preview --name EXPO_PUBLIC_API_TOKEN --value <APP_API_TOKEN from Render> --visibility sensitive
   npx eas-cli build --platform android --profile preview
   ```
   Open the link EAS prints on your phone to install the APK.

Render's free service sleeps after ~15 minutes idle; the first request after that takes up to a minute. The 07:00 cron
wakes it, and Inngest retries if that first call times out.

## Tests

```bash
cd server && npm test && npm run typecheck   # change detection, check pipeline, API routes
cd app && npm test && npm run typecheck      # delay-interest calculator
```

## Known limits

- **Some RERA portals don't have a link per project.** They show details only after a search form or captcha. Those pages
  can't be watched yet. Use the builder's construction-updates page instead, or pick a portal with project URLs.
- **Single user, no login.** Anyone who can reach the server can use it. Set `APP_API_TOKEN` before exposing it beyond your Wi-Fi.
  It's a shared secret baked into the app, which is fine for a personal MVP but is not real user auth.
- **Extracted facts can be wrong.** The app labels them as automatic and links to the official page.
- **The calculator is an estimate, not legal advice.** The rate and method depend on each state's rules.

## Next steps

1. Push notifications when key facts change (Expo push + an Inngest step; needs an EAS development build).
2. Built-in search for one state's RERA portal (start with whichever portal has stable project URLs).
3. Upload your builder-buyer agreement PDF → extract the possession date and penalty clause (RAG).
4. Accounts (e.g. Supabase Auth) so more than one person can use a deployment.
