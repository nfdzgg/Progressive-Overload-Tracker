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
- [ ] 6. `app/`: shell, four tabs routed to placeholder screens, first-run gate, safe areas, keyboard-aware bottom bar, PWA manifest + icons + service worker (updates apply on next launch), bundled timer sound, e2e fixtures and test hooks — deploy pending
- [ ] Foundation freeze

### Phase 2 — Vertical slices
| Slice | Branch | Status |
|---|---|---|
| S1 Today | `slice/today` | not started |
| S2 Settings | `slice/settings` | not started |
| S3 Backup | `slice/backup` | not started |
| Wave 1 deploy + live smoke test | — | not started |
| S4 Calendar | `slice/calendar` | not started |
| S5 Progress | `slice/progress` | not started |
| S6 Session extras | `slice/session-extras` | not started |
| Wave 2 deploy + live smoke test | — | not started |

### Phase 3 — Integration (sequential)
- [ ] 1. Full-product Playwright journey
- [ ] 2. Offline check
- [ ] 3. Design pass + `npx @google/design.md lint DESIGN.md`
- [ ] 4. Accessibility pass
- [ ] 5. README

## Branches
- `main` — integration branch, deployed to GitHub Pages.
- `claude/ecstatic-carson-w5p9o7` — session branch, kept in sync with `main`.

## Deviations from the spec (with reasons)
1. **Spec file names.** The upload named the files `SPEC (3).md` and `DESIGN (2).md`; renamed to `SPEC.md` and `DESIGN.md` to match the layout in SPEC 9.1.
2. **Deploy workflow added in step 1, not step 6.** The task instructions asked for the base path and deploy workflow first. `deploy.yml` runs the full CI (reused from `ci.yml`), builds, deploys to Pages, then smoke-tests the live URL with Playwright (`e2e-live/`), because the build sandbox cannot reach `github.io` directly.
3. **Pinned tool versions.** Vite 7, React 19.2, React Router 7, TypeScript 5.9, ESLint 9, Vitest 4.1.11 (4.1.11 rather than 3.x because 3.x pulls a tinypool with a critical advisory; dev-only), Playwright 1.56.1 (matches the preinstalled Chromium). Newer majors exist (Vite 8, TS 7) but typescript-eslint does not support TS 7 yet.
4. **"Plus one desktop run"** is implemented as a second Playwright project (1280×800) that runs every test tagged `@desktop`.
5. **Design-token lint.** `scripts/check-design-tokens.mjs` runs inside `npm run lint` and rejects raw colors, lengths, font families, and font weights in any CSS outside `tokens.css`, and in feature TypeScript.
6. **`createdAt` on `Session` and `LogEntry`.** Section 4 has only calendar dates, but "most recent", "first logged entry", and "latest three" need an order when two sessions share a date (for example Lateral raise in Push and Pull on the same day via "Start next workout"). Both records carry an epoch-ms `createdAt` used only as a same-date tie-breaker.

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

## Open questions
_None._
