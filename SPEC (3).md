# Progressive Overload Tracker — SPEC

A phone-first gym logger that makes progressive overload effortless: open it, see today's workout, see what to beat, log weight and reps. Installed as a PWA from GitHub Pages. All data stays on the device.

**Companion file:** `DESIGN.md` is the single source for everything visual (colors, type, spacing, components, layout rules). This spec contains no visual decisions. If the two ever disagree on something visual, `DESIGN.md` wins; on behavior, this file wins.

---

## 1. Product principles

1. **The Today screen is sacred.** It shows exercise cards and nothing else. Every secondary action sits behind an icon or a sheet. Every configuration option lives in Settings.
2. **Minimal typing.** One weight per exercise, reps per set, one Log button. Last session's weight is prefilled.
3. **Nothing is hardcoded.** Exercises, variants, sets, rep ranges, rest times, workouts, and cycle order are all user data. The owner's routine ships only as an optional starter template.
4. **History is per variant.** Numbers from different machines, grips, or variations are never compared with each other.
5. **Local only.** No accounts, no server, no analytics, no network calls after install. Works fully offline.

## 2. Out of scope (do not build)

- Cloud sync, accounts, or any backend.
- Bodyweight tracking.
- Social features, sharing of logs, leaderboards.
- Exercise videos, instructions, or an exercise database.
- Light mode.
- Push notifications.

## 3. Tech stack

| Concern | Choice |
|---|---|
| Build | Vite + React + TypeScript (strict mode) |
| Routing | React Router with hash routing (GitHub Pages safe) |
| Storage | IndexedDB through Dexie; `dexie-react-hooks` for live queries |
| PWA | `vite-plugin-pwa` (Workbox), precache everything, `display: standalone` |
| Styling | CSS Modules + CSS custom properties generated from `DESIGN.md` tokens |
| Fonts | Inter and JetBrains Mono bundled via `@fontsource` (no CDN) |
| Charts | Hand-built SVG components (line, bar); no chart library |
| Unit tests | Vitest + React Testing Library + `fake-indexeddb` |
| End-to-end | Playwright, mobile viewport 390×844, plus one desktop run |
| Quality | ESLint, Prettier, `tsc --noEmit` |
| Deploy | GitHub Actions → GitHub Pages on push to `main`; Vite `base` set to the repo name |

No other runtime dependencies without a written reason in `PROGRESS.md`.

## 4. Domain model

All ids are UUID strings. Dates are local calendar dates as `YYYY-MM-DD`. Weeks start on Monday.

```ts
type Unit = 'lb' | 'kg';

type ExerciseType = 'legCompound' | 'upperCompound' | 'largeIsolation' | 'smallIsolation';

type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'abs';

interface Variant { id: string; name: string; note: string; archived: boolean; }

interface Exercise {
  id: string;
  name: string;
  type: ExerciseType;
  muscleGroup: MuscleGroup;        // one primary group, used for weekly set counts
  sets: number;                    // default 2, range 1–10
  repMin: number;
  repMax: number;
  restSeconds: number;
  variants: Variant[];             // at least one
  defaultVariantId: string;        // the "main way", preselected on the card
  perSetWeight: boolean;           // default false
  archived: boolean;
}

interface Workout { id: string; name: string; exerciseIds: string[]; } // ordered

type CycleItem = { kind: 'workout'; workoutId: string } | { kind: 'rest' };

interface CycleState {
  items: CycleItem[];              // ordered, repeats forever
  pointer: number;                 // index of the next item
  pointerSince: string;            // date the pointer arrived at this item
  restartOn: string | null;        // date a scheduled restart takes effect
}

interface Session {
  id: string;
  date: string;
  workoutId: string;
  workoutName: string;             // snapshot, so history survives renames
  deload: boolean;
  status: 'inProgress' | 'finished';
}

interface SetLog { reps: number | null; weight: number | null; } // weight used only when perSetWeight

interface LogEntry {
  id: string;
  sessionId: string;
  date: string;
  exerciseId: string;
  variantId: string;
  unit: Unit;                      // unit the entry was typed in
  weight: number | null;           // null = bodyweight / no weight
  sets: SetLog[];
  status: 'draft' | 'logged' | 'skipped';
  swappedFromExerciseId: string | null;
}

interface Settings {
  unit: Unit;                      // default 'lb'
  restTimerEnabled: boolean;       // default true
  restTimerSound: boolean;         // default true
  lastExportAt: string | null;
  onboarded: boolean;
}
```

### 4.1 Exercise type defaults

Choosing a type when creating an exercise fills in these defaults. Both values stay editable per exercise.

| Type | Examples | Rep range | Rest |
|---|---|---|---|
| `legCompound` | Leg press, squat, RDL | 6–12 | 3:00 |
| `upperCompound` | Presses, rows, pulldowns | 6–12 | 2:30 |
| `largeIsolation` | Chest fly, leg curl, leg extension | 10–15 | 2:00 |
| `smallIsolation` | Lateral raise, curls, triceps, rear delt, calves, abs | 10–15 | 1:30 |

### 4.2 Units

Entries store the number as typed plus its unit. When the display unit differs, convert for display only (1 kg = 2.2046 lb), rounded to the nearest 0.5. Stored values are never rewritten when the setting changes.

### 4.3 Deleting

Exercises and variants that have history are archived, never deleted: they disappear from workouts and pickers but their history, charts, and PRs remain. Items with no history are removed outright.

## 5. Rules and calculations

All of this lives in pure functions under `src/domain/` with full unit-test coverage. No UI code computes these.

### 5.1 Cycle (rotating queue)

- Today shows the item at `pointer`.
- A workout is **finished** when every exercise is logged or skipped, or when the user taps Finish workout (unlogged exercises become skipped). Finishing advances the pointer by one and sets `pointerSince` to the next calendar day.
- **Missed days never skip a workout.** If the user does not train, the pointer stays where it is.
- **Rest items consume exactly one calendar day.** If the pointer is on a rest item and today is later than `pointerSince`, advance past it on app open. A rest day screen offers "Train anyway", which advances past the rest item immediately.
- One workout per calendar day by default. After finishing, Today shows a compact summary of the finished session, with a "Start next workout" action for anyone who wants a second session.
- **Restart cycle** (Settings): "Restart today" sets `pointer = 0` now. "Restart on Monday" sets `restartOn` to the coming Monday; until then Today shows a rest state with "Start now", which cancels the wait and restarts immediately. On or after `restartOn`, set `pointer = 0` and clear it.
- An in-progress session from an earlier date is resumed, not discarded.

### 5.2 Projection (for the calendar)

Future days are projected by walking the cycle from the pointer, one item per day, starting today (or tomorrow if today's session is finished), honoring `restartOn`. Projection is a preview only and is never stored.

### 5.3 Reference entry and target

For an exercise + variant, the **reference** is the most recent `logged` entry from a non-deload session.

- No reference → show "Nothing logged this way yet"; no prefill.
- Every set in the reference reached `repMax` → target is **Add weight** (shown with the reference numbers).
- Otherwise → target is **Beat** the reference: same weight, one more rep on any set.
- The weight input is prefilled with the reference weight. Rep inputs show the reference reps as placeholders, never as values.

### 5.4 Estimated 1RM

Epley: `weight × (1 + reps / 30)`, using the best set of the entry. For entries with no weight, e1RM is undefined and reps are used instead.

### 5.5 Personal records

Per exercise + variant, non-deload sessions only, never on the first logged entry:

- **Weight PR:** heaviest weight logged for at least `repMin` reps.
- **Rep PR:** most reps in a single set at this weight or heavier.
- **e1RM PR:** highest estimated 1RM.

For unweighted entries only the rep PR applies. Logging an entry that sets any PR shows the PR badge on that card.

### 5.6 Stalled

An exercise + variant is stalled when it has at least four non-deload entries and none of the latest three beat the best e1RM (or best reps when unweighted) recorded before them.

### 5.7 Weekly numbers

- **Hard sets per muscle group:** count of logged sets with reps > 0, by the exercise's `muscleGroup`, per Monday-based week. Deload sessions count.
- **Volume:** sum of weight × reps over logged sets; unweighted sets contribute 0.
- **Consistency:** finished sessions per week for the last 8 weeks, and the current streak of consecutive weeks with at least one finished session.

## 6. Screens

Four bottom tabs: **Today, Calendar, Progress, Settings.**

### 6.1 First run

One screen: choose **Push / Pull / Legs template** or **Start blank**, and choose lb or kg. Call `navigator.storage.persist()` afterwards. Sets `onboarded`.

### 6.2 Today

- Title is the workout name. Body is one card per exercise, in workout order.
- **Card contents:** exercise name; a notes icon and a "more" icon; variant chips with the default variant preselected (no chips when there is one variant); the reference line and target for the selected variant; the input row (weight, one reps field per set, Log).
- Switching the chip swaps the reference line, prefill, and placeholders to that variant.
- With `perSetWeight` on, each set gets its own weight field next to its reps field; an empty weight means bodyweight.
- Weight may always be left empty (bodyweight).
- Typing saves a `draft` entry immediately, so closing the app mid-workout loses nothing.
- **Log** requires at least one set with reps. It marks the entry `logged`, collapses the card to its done state showing the numbers, and shows a PR badge when earned. Tapping a done card reopens it for editing.
- **Notes icon** opens a sheet with the note for the selected variant (seat height, pin setting). The icon shows a subtle marker when a note exists. Notes are never shown inline.
- **More menu** (sheet): Skip for today; Swap for today (pick another exercise from the library; the log is recorded against the exercise actually performed); Mark session as deload (applies to the whole session and shows a Deload badge in the top bar).
- **Finish workout** sits below the last card. When every card is done or skipped the session finishes automatically.
- Rest day and waiting-for-restart states are described in 5.1.

### 6.3 Rest timer

- Enabled by default; can be turned off in Settings.
- Starts when a reps field for any set other than the last is filled and loses focus, and again when Log is pressed. Duration is the exercise's `restSeconds`.
- Shown as the compact bar from `DESIGN.md`, above the tab bar, on every tab. Tap to dismiss; a new start replaces the running one.
- Based on an end timestamp, so it stays correct after the app is backgrounded or the phone is locked.
- At zero: play a short bundled sound if enabled, and call `navigator.vibrate` where supported. It then stays at 0:00 until dismissed or replaced.

### 6.4 Calendar

- Month view with a week strip for the current week at the top. Each day shows its workout label.
- Past days show what was done, with a marker for finished sessions. Future days show the projection (5.2). Rest days are labeled.
- Tap a past day → sheet listing that session's entries; each is editable and deletable. Tap a future day → read-only list of the planned workout's exercises.
- A past day with no session can have one added from the sheet (pick a workout), for logging something after the fact. This does not move the pointer.

### 6.5 Progress

May be denser than Today. Sections, top to bottom:

1. **This week:** finished sessions, PRs set, total hard sets.
2. **Consistency:** sessions per week (last 8 weeks) and the current streak.
3. **Sets per muscle group:** this week against last week.
4. **Recent PRs:** latest 10, with exercise, variant, type of PR, and date.
5. **Stalled:** exercise + variant pairs flagged by 5.6. Hidden when empty.
6. **Exercise detail:** pick an exercise, then a variant. Line chart of e1RM and top weight over time with PR points marked; range switch 1M / 3M / All; below it the full history list for that variant. Deload sessions are shown but visually marked.
7. **Volume:** weekly total volume, last 8 weeks.

Empty states explain what will appear once there is data; no fake numbers.

### 6.6 Settings

- **Routine**
  - Cycle: reorder, add, and remove workout and rest items.
  - Workouts: create, rename, delete; add, remove, and reorder exercises.
  - Exercises (library): create, rename, archive; edit type, muscle group, sets, rep range, rest time, per-set weight; add, rename, reorder, and archive variants; choose the default variant.
  - Restart cycle: today or on Monday (5.1), with confirmation.
- **Preferences:** unit; rest timer on/off; timer sound on/off.
- **Data**
  - Export full backup (JSON). Export logs (CSV). Import backup (replaces everything, after a confirmation that states this).
  - Export routine only (JSON, no logs). Import routine: exercises are matched to existing ones by name (case-insensitive) so history is kept; unmatched ones are created; the cycle and workouts are replaced.
  - Files use the Web Share API when available and fall back to a download.
  - Show the last export date. If it is more than 14 days old, show a quiet reminder row here only, never on Today.
- **About:** app version, and a short "how to install" note.

## 7. Seed template (Push / Pull / Legs)

Cycle: Push, Pull, Legs, Push, Pull, Legs, Rest. All exercises: 2 sets. The first variant listed is the default. Lateral raise is one exercise shared by Push and Pull.

| Exercise | Type | Muscle | Variants |
|---|---|---|---|
| Chest press | upperCompound | chest | Machine, Bench |
| Incline press | upperCompound | chest | Bench |
| Chest fly | largeIsolation | chest | Downstairs machine, Upstairs machine, Dumbbell on bench |
| Lateral raise | smallIsolation | shoulders | Cable, Machine, Dumbbell |
| Tricep overhead cable extension | smallIsolation | triceps | Cable |
| Tricep pushdown | smallIsolation | triceps | Cable, Machine |
| Lat pulldown | upperCompound | back | Wide grip, Short grip |
| Row | upperCompound | back | Machine |
| Rear delt fly | smallIsolation | shoulders | Machine, Cable |
| Curl | smallIsolation | biceps | Preacher curl, Regular curl |
| Hammer curl | smallIsolation | biceps | Dumbbell |
| Leg press | legCompound | quads | Downstairs machine, Upstairs machine |
| Romanian deadlift | legCompound | hamstrings | Bar |
| Seated leg curl | largeIsolation | hamstrings | Downstairs machine, Upstairs machine |
| Leg extension | largeIsolation | quads | Downstairs machine, Upstairs machine |
| Incline bench crunch | smallIsolation | abs | Incline bench (`perSetWeight: true`) |

- **Push:** Chest press, Incline press, Chest fly, Lateral raise, Tricep overhead cable extension, Tricep pushdown.
- **Pull:** Lat pulldown, Row, Rear delt fly, Lateral raise, Curl, Hammer curl.
- **Legs:** Leg press, Romanian deadlift, Seated leg curl, Leg extension, Incline bench crunch.

## 8. PWA and platform requirements

- Installable on iOS (Add to Home Screen) and on desktop browsers; opens standalone with no browser chrome. Manifest, icons (including `apple-touch-icon` and maskable), theme and background color from `DESIGN.md` canvas.
- Fully usable offline after the first load, including fonts and the timer sound.
- Service worker updates apply on next launch; show a small "Updated" note in Settings → About, not a blocking prompt.
- Numeric keypads: `inputmode="decimal"` for weight, `inputmode="numeric"` for reps.
- Backup files carry a `schemaVersion`. Dexie migrations are written for every schema change; importing an older backup migrates it.

## 9. Build system

The project is built in three phases. Phase 1 is sequential and creates a frozen foundation. Phase 2 is vertical slices built in parallel. Phase 3 is integration.

### 9.1 Repository layout

```
src/
  app/          shell, router, tab bar, top bar, providers
  design/       tokens.css (generated from DESIGN.md), global styles, fonts
  ui/           shared presentational components (Button, Chip, Card, Sheet, NumberInput, ListRow, Badge, charts/)
  domain/       types and pure functions: cycle, targets, prs, stalled, e1rm, weekly, units
  data/         Dexie schema, migrations, repositories, seed template, backup (serialize/parse)
  features/
    today/
    session-extras/   rest timer, notes, skip, swap, deload
    settings/
    backup/           export/import UI and first run
    calendar/
    progress/
e2e/
SPEC.md  DESIGN.md  PROGRESS.md  README.md
```

### 9.2 Phase 1 — Foundation (sequential, one agent)

Built in this order, each step committed separately:

1. Scaffold: Vite, TypeScript strict, ESLint, Prettier, Vitest, Playwright, CI workflow that runs lint, typecheck, unit tests, build.
2. `design/`: turn `DESIGN.md` tokens into CSS custom properties; global styles; bundled fonts.
3. `ui/`: every shared component named in `DESIGN.md`, each with a render test. A hidden `/#/kitchen-sink` route shows them all for visual checking.
4. `domain/`: all types from section 4 and all rules from section 5, test-first. Every rule in section 5 has named tests, including edge cases (missed days, rest consumption, scheduled restart, first entry, deload exclusion, unweighted entries, unit conversion).
5. `data/`: Dexie schema, repositories, seed template, backup serialize/parse with round-trip tests.
6. `app/`: shell with the four tabs routed to placeholder screens, safe-area handling, PWA manifest and service worker, deploy workflow. The empty shell must be live on GitHub Pages before Phase 2 starts.

**Foundation freeze.** After Phase 1, `domain/`, `data/`, `ui/`, `design/`, and `app/` are read-only for slice agents. If a slice needs a change there, it stops and reports the need; the orchestrator makes the change on `main` and the slices rebase. This is what makes parallel work safe.

### 9.3 Phase 2 — Vertical slices (parallel)

Each slice delivers one user-visible capability end to end: screen, state, persistence wiring, unit tests, and one Playwright test. Each slice is built by its own subagent in its own git worktree and branch (`slice/<name>`), touching only its own `features/<name>/` folder and its own e2e file.

**Wave 1 (three agents in parallel)**

| Slice | Folder | Delivers | Spec sections |
|---|---|---|---|
| S1 Today | `features/today` | Cards, variant chips, reference and target, drafts, Log, done state, PR badge, finish, rest-day and restart states | 5.1, 5.3, 5.5, 6.2 (without notes and the more menu) |
| S2 Settings | `features/settings` | Routine, library, cycle editing, restart cycle, preferences | 4.1, 4.3, 6.6 (without Data) |
| S3 Backup | `features/backup` | First run, export/import of backup and routine, CSV, reminder row | 6.1, 6.6 Data |

**Wave 2 (three agents in parallel, after Wave 1 is merged)**

| Slice | Folder | Delivers | Spec sections |
|---|---|---|---|
| S4 Calendar | `features/calendar` | Month and week views, projection, day sheets, editing past entries, adding a past session | 5.2, 6.4 |
| S5 Progress | `features/progress` | All dashboard sections and exercise detail | 5.4–5.7, 6.5 |
| S6 Session extras | `features/session-extras` | Rest timer, notes sheet, skip, swap, deload | 6.3, and the notes and more-menu parts of 6.2 |

S6 plugs into Today through extension points that S1 must expose (a slot for card header actions and a callback fired when a set is committed and when an entry is logged). S1 defines these; S6 only consumes them.

**Slice rules**

- Read `SPEC.md` and `DESIGN.md` in full before writing code.
- Tests first for any logic; UI uses only `ui/` components and design tokens, never raw color or size values.
- A slice is **done** when: its acceptance behavior works at 390×844, lint, typecheck, unit tests, and its Playwright test pass, and it has made no edits outside its folder.
- The orchestrator reviews each slice against its spec sections, merges it into `main`, and runs the full suite before the next merge. After each wave, deploy and smoke-test the live site.

### 9.4 Phase 3 — Integration (sequential)

1. One Playwright journey covering the whole product: first run with the template → log a full Push session → see the PR badge and rest timer → pointer advances → calendar shows it → Progress reflects it → edit an exercise in Settings → export, wipe, import, and confirm identical data.
2. Offline check: with the network disabled, the installed build loads and logs a session.
3. Design pass: every screen compared against `DESIGN.md`; run `npx @google/design.md lint DESIGN.md`.
4. Accessibility pass: labels on all inputs and icon buttons, focus order, 44px targets, reduced motion.
5. `README.md`: what the app is, how to install it on iPhone, Android, and desktop, how to back up, how a friend starts with their own data, and how to develop and deploy.

### 9.5 Tracking

`PROGRESS.md` is kept current by the orchestrator: a checklist of every phase step and slice with status, the branch name, deviations from this spec with reasons, and open questions. It is updated at every merge. Commits use `type(scope): summary` (for example `feat(today): log entry and done state`).

## 10. Acceptance criteria

The project is complete when all of these are true:

1. The app is live on GitHub Pages, installs to an iPhone home screen and as a desktop app, and opens standalone.
2. It works offline after first load.
3. First run offers the template or a blank start; the template matches section 7 exactly.
4. A full workout can be logged with one weight and reps per set per exercise; drafts survive closing the app.
5. Variant history is separate; switching chips changes the reference, target, and prefill.
6. Targets, PRs, e1RM, stalled flags, and weekly numbers match section 5, proven by unit tests.
7. The cycle behaves as in 5.1, including missed days, rest consumption, and both restart options.
8. The rest timer uses per-exercise durations and stays correct after backgrounding.
9. Everything in 6.6 is editable, and edits take effect on Today without a reload.
10. Calendar and Progress show real data as specified, with sensible empty states.
11. Backup export → wipe → import restores identical data; routine-only export contains no logs.
12. The Today screen shows nothing beyond what 6.2 lists.
13. Lint, typecheck, all unit tests, and all Playwright tests pass in CI.
14. `PROGRESS.md` shows every item complete, with any deviations explained.
