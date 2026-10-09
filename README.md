# Progressive Overload Tracker

A phone-first gym logger that makes progressive overload effortless: open it, see today's workout, see what to beat, log weight and reps.

**Live app:** https://nfdzgg.github.io/Progressive-Overload-Tracker/

- **Today** shows one card per exercise in today's workout, with last time's numbers for the variant you pick and a target (beat it by one rep, or add weight). Type one weight and the reps per set, tap **Log**.
- **Calendar** shows what you did and what's coming up in your cycle; past days can be edited or filled in after the fact.
- **Progress** shows this week, consistency, sets per muscle group, recent PRs, stalled lifts, a chart per exercise and variant, and weekly volume.
- **Settings** is where everything is configured: exercises and their variants, workouts, the cycle, units, the rest timer, and backups.

Everything stays on your device. There are no accounts, no server, and no analytics. After the first visit the app works fully offline.

`SPEC.md` describes the behavior, `DESIGN.md` the visual design, and `PROGRESS.md` how it was built (including every deviation and decision).

## Install

The app is a PWA: install it once and it opens full screen, without browser chrome, like a native app.

### iPhone / iPad (Safari)

1. Open https://nfdzgg.github.io/Progressive-Overload-Tracker/ in **Safari** (other iOS browsers cannot install web apps on older iOS versions).
2. Tap the **Share** button (square with an arrow).
3. Scroll down and tap **Add to Home Screen**, then **Add**.
4. Open **Overload** from your home screen.

### Android (Chrome)

1. Open the link in **Chrome**.
2. Tap **Install app** when it appears, or open the **⋮** menu and choose **Install app** / **Add to Home screen**.
3. Open **Overload** from your home screen or app drawer.

### Desktop (Chrome, Edge, and other Chromium browsers)

1. Open the link.
2. Click the **install** icon at the right of the address bar (or open the browser menu → **Install Progressive Overload Tracker** / **Apps → Install this site as an app**).
3. The app opens in its own window and appears in your applications. On a wide screen it keeps a phone-shaped column; Progress widens to two columns.

Updates install in the background and apply the next time you open the app. Settings → About shows the version and a small "Updated" note after an update.

## Back up your data

Your data lives only in this browser on this device, so back it up now and then. Settings → Data shows when you last exported and reminds you (there, never on Today) once it's more than 14 days old.

- **Export full backup (JSON)** — everything: library, workouts, cycle, every session and log, and settings. Keep it somewhere safe (Files, iCloud Drive, Google Drive, email to yourself). On phones the share sheet opens; elsewhere the file downloads.
- **Import backup** — restores a full backup. It **replaces everything on this device** (you're asked to confirm first).
- **Export logs (CSV)** — one row per logged set, for spreadsheets.
- **Export routine only (JSON)** — your exercises, workouts, and cycle, with no logs.
- **Import routine** — loads a routine. Exercises are matched to yours by name (so their history is kept), new ones are created, and your workouts and cycle are replaced.

Moving to a new phone: export a full backup on the old one, open the app on the new one, finish the first screen (any choice), then Settings → Data → **Import backup**.

## A friend starting with their own data

Everyone's data is separate: it lives on their own device. Share the link; on first run they choose either the **Push / Pull / Legs template** (a ready-made routine they can edit) or **Start blank**, and lb or kg. Everything (exercises, variants, sets, rep ranges, rest times, workouts, the cycle) is editable in Settings.

To give a friend your routine without your logs: Settings → Data → **Export routine only**, send them the file, and they use **Import routine** after their first run.

## Develop

Requirements: Node 20+ (CI uses Node 22).

```sh
npm ci
npm run dev            # http://localhost:5173/Progressive-Overload-Tracker/
npm run lint           # ESLint + Prettier + design-token check (no raw colors/sizes)
npm run typecheck      # tsc in strict mode
npm test               # Vitest unit and component tests
npx playwright test    # end-to-end tests (390×844 mobile, plus @desktop tests at 1280×800)
npm run build          # production build in dist/
npm run tokens         # regenerate src/design/tokens.css after editing DESIGN.md
npm run lint:design    # npx @google/design.md lint DESIGN.md
```

Playwright needs a Chromium build (`npx playwright install chromium` if you don't have one). It builds the app and serves a preview automatically; set `PW_PORT` to use another port.

On a Mac with Xcode, `ios-install-check/run.sh` (needs `brew install xcodegen`) adds the live app to an iPhone Simulator's home screen through Safari and checks it opens standalone. It is test tooling only, not part of the app.

### Layout

```
src/
  app/        shell, router, tab bar wiring, PWA registration
  design/     tokens.css (generated from DESIGN.md), global styles, bundled fonts
  ui/         shared components (Button, Chip, Card, Sheet, NumberInput, charts, …); /#/kitchen-sink shows them all
  domain/     types and pure rules: cycle, targets, PRs, e1RM, stalled, weekly numbers, units
  data/       Dexie schema, repositories, live-query hooks, seed template, backup files
  features/   today, settings, backup (first run + data), calendar, progress, session-extras (timer, notes, skip/swap/deload)
e2e/          Playwright tests (including the full-product journey, offline, and accessibility)
```

Rules worth knowing:

- All calculations live in `src/domain` as pure functions with unit tests; no UI code computes them.
- Feature code uses only `src/ui` components and design tokens; `npm run lint` fails on raw colors, lengths, or fonts.
- Storage changes need a new Dexie version in `src/data/db.ts` and a matching step in `src/data/migrations.ts`, so older backups still import.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`: the full CI (lint, typecheck, unit tests, build, Playwright), then a build for GitHub Pages, the deploy, and two checks against the live URL: a Playwright smoke test (iPhone-sized Chromium, WebKit as an iPhone, desktop Chromium, plus a real desktop install) and, on a macOS runner, Add to Home Screen in the iOS Simulator's Safari (`.github/workflows/ios-install.yml`). Pull requests and other branches run `.github/workflows/ci.yml`.

GitHub Pages must be set to deploy from **GitHub Actions** (repository Settings → Pages → Source). The Vite `base` is the repository name (`/Progressive-Overload-Tracker/`); if you fork under a different name, change `BASE_PATH` in `vite.config.ts` and the URLs in `playwright.live.config.ts` and `e2e/shell.spec.ts`.
