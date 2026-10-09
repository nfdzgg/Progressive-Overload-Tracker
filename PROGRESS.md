# PROGRESS

Orchestrator log for the build described in `SPEC.md` (behavior) and `DESIGN.md` (visuals).
Updated at every commit to `main`.

## Checklist

### Repo setup
- [x] Rename uploaded `SPEC (3).md` / `DESIGN (2).md` to `SPEC.md` / `DESIGN.md`
- [x] Vite `base` set to the repo name (`/Progressive-Overload-Tracker/`), deploy workflow added (`.github/workflows/deploy.yml`)

### Phase 1 — Foundation (sequential)
- [x] 1. Scaffold: Vite, TS strict, ESLint, Prettier, Vitest, Playwright, CI
- [x] 2. `design/`: tokens.css generated from DESIGN.md (`npm run tokens`, sync test in `scripts/generate-tokens.test.ts`), global styles, bundled fonts
- [x] 3. `ui/`: shared components with render tests, `/#/kitchen-sink` (checked visually at 390×844)
- [x] 4. `domain/`: section 4 types, section 5 rules, test-first (98 named tests: cycle, projection, targets, e1RM, PRs, stalled, weekly, units, dates, format)
- [x] 5. `data/`: Dexie schema (v1), repositories, live-query hooks, seed template (tested row by row against section 7), backup serialize/parse with round-trip and export→wipe→import tests, routine merge, CSV, migration framework
- [x] 6. `app/`: shell, four tabs routed to placeholder screens, first-run gate, safe areas, keyboard-aware bottom bar, PWA manifest + icons + service worker (updates apply on next launch), bundled timer sound, e2e fixtures and test hooks — live on GitHub Pages (Deploy run #5: CI, deploy, and live smoke test green; service worker registers on the live URL)
- [x] Foundation freeze at `7f5a984` — `domain/`, `data/`, `ui/`, `design/`, `app/` are read-only for slices

### Phase 2 — Vertical slices
| Slice | Branch | Status |
|---|---|---|
| S1 Today | `slice/today` (worktree `/home/user/wt-today`) | **merged** (`6757076`); reviewed against 5.1, 5.3, 5.5, 6.2; extension API for S6 in `features/today/extensions.ts`; full suite green after merge (319 unit, 24 e2e); checked at 390×844 |
| S2 Settings | `slice/settings` (worktree `/home/user/wt-settings`) | **merged** (`1315f8c`); reviewed against 4.1, 4.3, 6.6; full suite green after merge (265 unit, 16 e2e) |
| S3 Backup | `slice/backup` (worktree `/home/user/wt-backup`) | **merged** (`81ee4f1`); reviewed against 6.1, 6.6 Data; the first agent stalled after drafting and was replaced by a second agent that reviewed, fixed, verified, and committed the draft; full suite green after merge (380 unit, 31 e2e); checked at 390×844 |
| Wave 1 deploy + live smoke test | — | **done** — Deploy run #9 (`975ffbe`): CI, deploy, and live smoke (first run → template → Today shows Push cards → Settings Routine + Data) all green |
| S4 Calendar | `slice/calendar` | **merged** (`d4f9b23`); reviewed against 5.2, 6.4; full suite green after merge (530 unit, 46 e2e); checked at 390×844 and 320px |
| S5 Progress | `slice/progress` | **merged** (`bd71c17`); reviewed against 5.4–5.7, 6.5; all numbers from domain functions; full suite green after merge (472 unit, 41 e2e); checked at 390×844 and 1280px |
| S6 Session extras | `slice/session-extras` | **merged** (`734072e`); reviewed against 6.3 and the notes/more-menu parts of 6.2; consumes only Today's extension API; full suite green after merge (441 unit, 37 e2e); checked at 390×844 |
| Wave 2 deploy + live smoke test | — | **done** — Deploy run #11 (`78697b8`): CI, deploy, and live smoke (first run → Today Push cards → rest timer starts → Calendar → Progress → Settings Routine + Data) all green |

### Phase 3 — Integration (sequential)
- [x] 1. Full-product Playwright journey (`e2e/journey.spec.ts`, runs at 390×844 and 1280×800): first run with the template → a past session logged from the calendar → full Push session logged on Today → PR badge and rest timer → session auto-finishes → calendar shows it finished and the next day projected as Pull → Progress shows the session, 12 hard sets, and the PR → next day Today shows Pull → an exercise edited in Settings shows on Today without a reload → export, wipe, import → identical data
- [x] 2. Offline check (`e2e/offline.spec.ts`, mobile + desktop): after one online load the service worker controls the page; with the network disabled the app reloads from cache, first run completes, fonts and the timer sound are served, a full Push session is logged, and the data survives an offline reload
- [x] 3. Design pass + `npx @google/design.md lint DESIGN.md` (`npm run lint:design`)
  - Reviewed at 390×844 (plus 320px and 1280px): first run; Today (workout, logged card with PR badge, rest timer, notes sheet, more sheet, swap picker, deload badge, finish confirmation, finished summary, rest day, waiting for restart, empty cycle); Calendar (week strip, month, past-day sheet, entry editor, future-day sheet); Progress (with data and empty); Settings (home, cycle, workout, exercises, exercise editor, new exercise, data section). Checked against DESIGN.md: surface ladder and hairlines, lavender only on the primary action / focus / active tab / primary chart series, green only for PR / completed / add weight, red only for destructive actions, selection by surface lift, sheets (16px top corners, drag handle, 60% scrim), rest timer (surface-2, mono countdown, 2px lavender line), calendar cells, chart colors, 480px column on wide windows and 960px 2-up Progress. No horizontal scroll at 320–1280px. No changes needed.
  - `design.md lint`: 0 errors, 7 warnings, 1 info. Warnings are about DESIGN.md itself and were left as written (DESIGN.md decides visuals): white on `primary-hover` (#828fff) is 2.87:1 — hover only exists on desktop pointers; six colors (`ink-tertiary`, `surface-4`, `hairline`, `hairline-strong`, `hairline-tertiary`, `semantic-overlay`) are reported as "orphaned" because the component tokens don't reference them, but the DESIGN.md prose does and the app uses them (borders, placeholders, scrim).
- [x] 4. Accessibility pass (`e2e/a11y.spec.ts`): axe-core on first run, Today (cards, done card + rest timer, notes sheet, more sheet, finish dialog), Calendar (month, day sheet, entry editor), Progress, and every Settings page — labels on all inputs and icon buttons, names on buttons/links, valid ARIA, landmarks; every visible interactive element ≥44px tall (chips via their 44px hit area); keyboard focus moves top to bottom with a visible focus ring; with reduced motion the sheet and card animations are 0s
- [x] 5. README: what the app is, installing on iPhone, Android, and desktop, backing up, how a friend starts with their own data, developing and deploying

## Acceptance criteria (SPEC section 10)
| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Live on GitHub Pages, installs to an iPhone home screen and as a desktop app, opens standalone | ✅ (real-device install not verifiable from the build sandbox) | https://nfdzgg.github.io/Progressive-Overload-Tracker/ — every Deploy run ends with a Playwright smoke test against the live URL (build id, manifest `display: standalone`, service worker, first run → Today → timer → Calendar → Progress → Settings). `e2e/shell.spec.ts` checks manifest, icons (incl. `apple-touch-icon`, maskable), theme/background color; `e2e/offline.spec.ts` asks Chromium (DevTools protocol) for installability errors and gets none. |
| 2 | Works offline after first load | ✅ | `e2e/offline.spec.ts`: network disabled → app loads, fonts and timer sound served, full session logged, data survives an offline reload |
| 3 | First run offers template or blank; template matches section 7 exactly | ✅ | `src/data/seed.test.ts` (row by row), `e2e/backup.spec.ts`, `e2e/journey.spec.ts` |
| 4 | Full workout with one weight and reps per set per exercise; drafts survive closing the app | ✅ | `e2e/today.spec.ts` (full Push session, drafts survive reload), `e2e/journey.spec.ts` |
| 5 | Variant history separate; chips change reference, target, prefill | ✅ | `src/domain/targets.test.ts`, `e2e/today.spec.ts` |
| 6 | Targets, PRs, e1RM, stalled, weekly numbers match section 5, proven by unit tests | ✅ | `src/domain/*.test.ts` (targets, prs, e1rm, stalled, weekly, units, cycle, projection) |
| 7 | Cycle per 5.1: missed days, rest consumption, both restart options | ✅ | `src/domain/cycle.test.ts`, `src/data/repos.test.ts`, `e2e/today.spec.ts`, `e2e/settings.spec.ts` |
| 8 | Rest timer uses per-exercise durations and stays correct after backgrounding | ✅ | `src/features/session-extras/restTimer.test.ts`, `e2e/session-extras.spec.ts` (clock fast-forward, reload) |
| 9 | Everything in 6.6 editable; edits take effect on Today without a reload | ✅ | `e2e/settings.spec.ts`, `e2e/journey.spec.ts` (sets edited in Settings appear on Today in the same document) |
| 10 | Calendar and Progress show real data, with sensible empty states | ✅ | `e2e/calendar.spec.ts`, `e2e/progress.spec.ts`, journey |
| 11 | Backup export → wipe → import restores identical data; routine-only export has no logs | ✅ | `src/data/repos.test.ts`, `e2e/backup.spec.ts`, `e2e/journey.spec.ts` |
| 12 | Today shows nothing beyond what 6.2 lists | ✅ | Design pass (Phase 3.3) and slice review: cards, Finish workout, and the 5.1 states only; notes/more behind icons; timer bar is shell chrome |
| 13 | Lint, typecheck, all unit tests, all Playwright tests pass in CI | ✅ | Deploy workflow on `main` (see latest run) |
| 14 | PROGRESS.md shows every item complete, with deviations explained | ✅ | This file |

## Branches
- `main` — integration branch, deployed to GitHub Pages.
- `claude/ecstatic-carson-w5p9o7` — session branch, kept in sync with `main`.
- `slice/<name>` — one local branch + git worktree per Phase 2 slice, merged into `main` one at a time after review.

Live URL: https://nfdzgg.github.io/Progressive-Overload-Tracker/

## Deviations from the spec (with reasons)
1. **Spec file names.** The upload named the files `SPEC (3).md` and `DESIGN (2).md`; renamed to `SPEC.md` and `DESIGN.md` to match the layout in SPEC 9.1.
2. **Deploy workflow added in step 1, not step 6.** The task instructions asked for the base path and deploy workflow first. `deploy.yml` runs the full CI (reused from `ci.yml`), builds, deploys to Pages, then smoke-tests the live URL with Playwright (`e2e-live/`), because the build sandbox cannot reach `github.io` directly.
3. **Pinned tool versions.** Vite 7, React 19.2, React Router 7, TypeScript 5.9, ESLint 9, Vitest 4.1.11 (4.1.11 rather than 3.x because 3.x pulls a tinypool with a critical advisory; dev-only), Playwright 1.56.1 (matches the preinstalled Chromium). Newer majors exist (Vite 8, TS 7) but typescript-eslint does not support TS 7 yet.
4. **"Plus one desktop run"** is implemented as a second Playwright project (1280×800) that runs every test tagged `@desktop`.
5. **Design-token lint.** `scripts/check-design-tokens.mjs` runs inside `npm run lint` and rejects raw colors, lengths, font families, and font weights in any CSS outside `tokens.css`, and in feature TypeScript.
6. **`createdAt` on `Session` and `LogEntry`.** Section 4 has only calendar dates, but "most recent", "first logged entry", and "latest three" need an order when two sessions share a date (for example Lateral raise in Push and Pull on the same day via "Start next workout"). Both records carry an epoch-ms `createdAt` used only as a same-date tie-breaker.
7. **Weight field slightly wider than the set fields.** DESIGN asks for equal columns in the input row; the weight field starts at 1.75× the minimum field width because it carries the unit suffix, which otherwise clips values like "102.5". Set fields stay equal; the row wraps when sets don't fit, Log stays at the end.
8. **Calendar cells touch below 360px.** DESIGN asks for at least 8px between adjacent tap targets; below 360px the month grid drops the column gap to 0 so short labels like "Push" stay readable (columns are narrower than 44px there anyway, and touching cells leave no dead zones). From 360px up the 8px gap applies.
9. **Extra dev dependency: `@axe-core/playwright`** (dev only, not shipped) for the Phase 3 accessibility pass, so labels, names, and ARIA are checked automatically on every screen in CI.
10. **Color contrast follows DESIGN.md, not WCAG AA, in two places.** axe reports `ink-tertiary` (#62666d) text below 4.5:1 ("Nothing logged this way yet", projected/rest calendar days, footnotes) and the 12px lavender active-tab label (#5e6ad2 on #010102). DESIGN.md requires both colors for those roles, and it decides visuals, so the contrast rule is excluded from the axe run (all other rules pass). Changing either token in DESIGN.md and running `npm run tokens` would fix them everywhere.

## Decisions on ambiguities
1. **Tokens beyond the front matter.** Values DESIGN.md states only in prose (44px tap target, 20/24px icons, 56px bars, 480/960px columns, 2px focus ring at 50%, 60% scrim, 150–200ms motion, 1.5px icon stroke) are emitted in a "Derived" block of `tokens.css` so feature code never needs a raw value.
2. **Font subsets.** Inter is bundled with the latin and latin-ext subsets (400/500/600); JetBrains Mono with latin 400 only (it renders the timer digits). Other scripts fall back to the system font.
3. **Shared components beyond the DESIGN.md list.** `ui/` also holds `Text`, `Stack`/`Inline`/`Grow`, `Screen` (top bar + column), `ConfirmDialog`, `TextArea`, `Select` (native, styled as a text input), `ChipGroup` (radio-group chips reused for unit, on/off, and range switches instead of inventing a toggle), `ComparisonBars` (this week vs last week), `EmptyState`, `SectionLabel`, and `Icon`. They exist so feature code needs no raw values.
4. **Top bar and tab bar live in `ui/`** as presentational components (`TopBar`, `TabBar`); `app/` composes them. Screens render their own `Screen`/`TopBar` so each can set its title, accessory (for example the Deload badge), and single action.
5. **What Today shows (precedence).** In-progress session (any date, resumed) → empty cycle → waiting for a scheduled restart → finished summary (when `pointerSince` is after today, i.e. a workout was finished today) → rest day → the workout at the pointer.
6. **"Start next workout"** moves the pointer to the next workout item, skipping rest items, and makes it available today.
7. **Rest consumption after an absence.** Each rest item consumes one calendar day counted from `pointerSince`, so after a long absence a single rest item is consumed once and the pointer lands on the next workout.
8. **PRs need something to beat.** A PR requires an earlier qualifying value (so the first logged entry never earns one, and neither does the first entry that reaches `repMin`). A weight of 0 or empty means unweighted; for the rep PR an unweighted set counts as weight 0, so it is compared with every earlier set.
9. **Stalled with mixed entries.** If any entry of the variant has weight, the e1RM metric is used and unweighted entries neither set nor beat the best; otherwise best reps are used.
10. **Streak.** The current week counts if it has a finished session; an empty current week does not break the streak (it is counted from last week).
11. **Editing cycle items** keeps the pointer index if it is still in range, otherwise resets it to 0.
12. **Volume includes deload sessions** (5.7 excludes nothing; only references, PRs, and stalled exclude deloads).
13. **Done cards reopen as drafts.** Tapping a done card sets its entry back to `draft`; it counts again once Log is pressed.
14. **Finishing creates skipped entries** for workout exercises that were never touched, so the calendar can show them as skipped.
15. **Past sessions added from the calendar are created `finished`** (so Today never "resumes" them) and do not move the pointer.
16. **Routine import** matches exercises by name (case-insensitive, trimmed); a match takes the file's settings (type, muscle, sets, reps, rest, per-set weight) and is unarchived, and its variants are matched by name the same way (unmatched variants are added; existing ones not in the file are kept). Workouts and cycle are replaced and the cycle starts at its first item today.
17. **Routine export** contains active exercises with their active variants (including notes), workouts, and cycle items. No sessions, entries, or settings.
18. **Full backup includes settings** (unit, timer preferences, last export date), so a restore is identical.
19. **Keyboard rule.** The tab bar and rest-timer slot hide only when a text field has focus *and* the visual viewport has shrunk below 75% of its tallest height (a real on-screen keyboard on iOS or Android). Desktop windows and emulated browsers never hide them.
20. **Placeholder screens live in `features/<name>/`** with a fixed export contract (`TodayScreen`, `CalendarScreen`, `ProgressScreen`, `SettingsScreen`, `FirstRunScreen` + `DataSection`, `ShellOverlay`), so slices replace their own folder without touching `app/`.
21. **E2E seeding.** With `localStorage["pot:test-hooks"] = "1"` the app exposes the `data` and `domain` modules on `window.__pot`; `e2e/fixtures.ts` uses it to skip first run and seed state. The hook is inert for normal users.
22. **Settings (S2) inputs.** Rest time is a select in 30-second steps (0:30–5:00; an off-step value is kept in the list); sets is a 1–10 select; rep min/max are validated whole numbers (min ≤ max, invalid style per DESIGN). Exercise edits save as you go (an invalid field is not saved until fixed); creating uses an explicit "Create exercise" button.
23. **Settings (S2) confirmations.** Removing a cycle item or removing an exercise from a workout does not confirm (nothing is lost, easy to re-add); deleting a workout, archiving/deleting an exercise or variant, and both restarts always confirm. Reordering uses up/down buttons, not drag and drop; new cycle items go at the end.
24. **Unique names.** Exercise names are unique (case-insensitive) because routine import matches by name; variant names are unique within an exercise. Changing the type of an existing exercise keeps its rep range and rest (defaults fill in only on create, per 4.1).
25. **Today (S1) details.** Finishing with unlogged exercises asks first, then marks them skipped. `onSetCommitted` fires on blur only when the reps value changed while focused, is above 0, and is not the last set (tapping through filled fields does not restart the timer). Typed reps stay when switching chips; only weight prefill and placeholders swap, and a chip tap without a draft creates no session. Skipped cards show "Skipped" in the done style and reopen on tap. A cycle with only rest items shows the empty state.
26. **Backup (S3) details.** "Last export" shows "Never" until the first full backup; the reminder row appears when the last full backup is more than 14 days old, or when it has never been exported and at least one set is logged (a fresh install is not nagged). Only the full JSON backup counts as an export (CSV and routine files cannot restore the device). A restored backup brings back the export date stored in the file, so data stays identical. Files are validated before the confirmation dialog; non-cancel share failures fall back to a download. Both import rows use danger red (DESIGN: "import that overwrites data"). First run preselects the template and lb so starting is one tap.
27. **Integration fix after merging S3:** a Settings unit test asserted a chip state immediately after the database write; it now waits for the live query to re-render (same assertion, no weakening).
28. **Session extras (S6) details.** The rest timer persists its end timestamp in `localStorage` (`pot:rest-timer`) and recomputes every 250ms and on resume; turning the timer off in Settings removes a running one. Sound and vibration fire only if zero is observed within 3 s (so returning to the app after zero passed shows a silent 0:00); a timer that ended over an hour ago is dropped on relaunch. Audio is unlocked once with a muted play during the first user gesture (iOS), and Safari's Audio Session is set to `transient` so the chime ducks music instead of stopping it (best effort, not verified on a device). Skip is hidden on cards already done; swapping a slot that already has numbers asks first (the numbers are discarded); a swapped slot offers "Swap back".
29. **Calendar (S4) details.** Saving an entry in the day sheet marks it logged (needs at least one set with reps, like Log). Untouched weights keep their stored number and unit; changed weights are saved in the display unit. "Not logged" rows list a session's workout exercises without an entry, and can be logged after the fact. The completed dot means "finished session" (calendar-added sessions are created finished).
30. **Progress (S5) details.** "PRs set" counts PR events (one entry can earn up to three kinds), matching the Recent PRs rows. On wide windows the cards flow in two CSS columns (no holes or stretched cards). 1M/3M go back whole calendar months; default 3M. The exercise picker defaults to the latest logged exercise and its latest variant; variant chips appear when two or more variants have history. PR points are marked on the e1RM/best-reps line; deload points are marked on both lines. e1RM is shown rounded to a whole number.
31. **Stacked overlays (orchestrator fix in `ui/`).** S4 reported that Escape on a confirmation above a sheet closed both. Modals now keep a stack and only the topmost handles Escape and Tab (test in `ui/Sheet.test.tsx`).
32. **Rep placeholders.** DESIGN.md says a number input's placeholder is its label ("Set 1"); SPEC 5.3 says rep inputs show the reference reps as placeholders. Behavior follows SPEC: reference reps when there is a reference, the label otherwise; the accessible name is always the label.

## Open questions
_None._
