# Coach Jay

Golf coaching app for Back Nine – North Arlington. Coaches track student progress, ball data, swing video and
assign video lessons; students open it on their phone (installable, no App Store) or any computer.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres, Auth, Storage) · Tailwind 4 · deployed on Vercel.
**Bridge:** a small .NET 8 program (`bridge/`) that streams shots from a Full Swing KIT into the app.

## What's in v1

| Area | Coach | Student |
|---|---|---|
| Roster | Add/edit students by email; see carry trend per student at a glance | — |
| Progress | Goal, focus, handicap, lesson log (every session with its note) | Home: latest coach note, carry trend, next lesson, homework |
| Ball data | Per-club averages, metric trend chart, session table | Same view, read-only |
| Ball data in | **Manual** form · **KIT bridge** (live, shot-by-shot) · **Bay CSV import** | — |
| Swing video | Upload from the lesson (phone camera works), add a coach note | Watch with the note |
| Live session | **● Live session** on a student: record or pick a clip, it opens in slow-mo review (0.1×–1×, frame step, A/B loop); today's clips in a strip, earlier swings to compare | Reviews the same clips in slow motion |
| Lessons | Upload to a library by category; assign to students | Watch assigned lessons, mark watched |

Deliberately not in v1: booking, payments, chat, swing-video drawing tools.

## Setup (about 20 minutes)

### 1. Supabase
1. Create a project at https://supabase.com (free tier is fine to start).
2. SQL Editor → paste and run `supabase/migrations/0001_init.sql`. This creates tables, row-level security, the
   two private video buckets, and the triggers that create a profile on signup and link students to their roster row.
3. Authentication → Providers → Email: leave **Confirm email** on for production; turn it off while testing locally
   so you can sign in immediately.
4. Project Settings → API: copy the **URL**, **anon key** and **service_role key**.

### 2. Run locally
```
cp .env.example .env.local      # paste the three Supabase values
npm install
npm run dev                     # http://localhost:3000
```
Sign up as a **Coach** first. Then add a student by email; when that student signs up with the same email, their
account links to the roster row automatically.

### 3. Deploy
Push to GitHub, import the repo at https://vercel.com, add the three environment variables, deploy.
Then in Supabase → Authentication → URL Configuration, set **Site URL** to your Vercel URL.

On a phone, open the site in Safari/Chrome → Share → **Add to Home Screen**. It installs like an app.

## Ball data: the three paths

1. **Manual** — Student → Ball data → *Log session*. One club's averages per entry. Smash factor is computed.
2. **Full Swing KIT, live** — see `bridge/README.md`. Needs SDK credentials from Full Swing Golf and a Windows
   laptop on the same Wi-Fi as the KIT. Arm a student on the *KIT bridge* page; every shot lands in their profile as
   they hit it. Shots queue locally if the app is unreachable.
3. **Simulator bay import** — Student → Ball data → *Import bay CSV*. Accepts any CSV/TSV with recognizable column
   names (`Club, Club Speed, Ball Speed, Launch Angle, Spin Rate, Carry, Total, Side`, any order, units in parens
   are ignored). Preview before import. Full Swing's bays have no public API, so this is the path for them until
   Full Swing offers something better.

All three land in the same `sessions` + `shots` tables with a `source` tag; every chart reads from one view
(`session_club_averages`), so the app never cares where a shot came from.

## Project layout
```
supabase/migrations/0001_init.sql   schema, RLS, storage buckets, triggers
src/proxy.ts                        auth + role routing on every request
src/lib/                            supabase clients, data loaders, types, CSV parser
src/components/                     shell, nav, stats + chart, video grid/player, uploader
src/app/(auth)/                     login, signup
src/app/coach/                      roster, student detail (progress/data/swings/lessons), log, import, library, bridge
src/app/student/                    home, numbers, swings, lessons
src/app/api/ingest/kit/             bridge endpoint (bearer token, service role)
src/app/api/video/                  signed playback URLs (RLS decides who may watch)
bridge/                             .NET console app for the KIT
tests/                              CSV parser tests (`npx tsx --test tests/*.test.ts`)
```

## Security notes
- Students can only read their own rows (RLS). Coaches only their own roster.
- Video buckets are private. Playback is through one-hour signed URLs minted server-side after an RLS check.
- Bridge tokens are stored hashed. The ingest route is the only route that uses the service role key, and only
  after the token matches.

## Roadmap after v1
- CSV import straight from the Full Swing app's share sheet (once we see what it exports).
- Side-by-side swing compare and simple drawing on video.
- Booking / reminders (or just link out to whatever you already use).
- Native iOS wrapper if push notifications become important.
