# PROGRESS

Orchestrator log for the build described in `SPEC.md` (behavior) and `DESIGN.md` (visuals).
Updated at every commit to `main`.

## Checklist

### Repo setup
- [x] Rename uploaded `SPEC (3).md` / `DESIGN (2).md` to `SPEC.md` / `DESIGN.md`
- [ ] Vite `base` set to the repo name, deploy workflow added

### Phase 1 — Foundation (sequential)
- [ ] 1. Scaffold: Vite, TS strict, ESLint, Prettier, Vitest, Playwright, CI
- [ ] 2. `design/`: tokens.css generated from DESIGN.md, global styles, bundled fonts
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

## Decisions on ambiguities
_None yet._

## Open questions
_None._
