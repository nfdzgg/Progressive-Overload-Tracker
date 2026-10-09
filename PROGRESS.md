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
- [ ] 3. `ui/`: shared components with render tests, `/#/kitchen-sink`
- [ ] 4. `domain/`: section 4 types, section 5 rules, test-first
- [ ] 5. `data/`: Dexie schema, repositories, seed template, backup round-trip
- [ ] 6. `app/`: shell, four tabs, safe areas, PWA, deploy — live on GitHub Pages
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

## Decisions on ambiguities
1. **Tokens beyond the front matter.** Values DESIGN.md states only in prose (44px tap target, 20/24px icons, 56px bars, 480/960px columns, 2px focus ring at 50%, 60% scrim, 150–200ms motion, 1.5px icon stroke) are emitted in a "Derived" block of `tokens.css` so feature code never needs a raw value.
2. **Font subsets.** Inter is bundled with the latin and latin-ext subsets (400/500/600); JetBrains Mono with latin 400 only (it renders the timer digits). Other scripts fall back to the system font.

## Open questions
_None._
