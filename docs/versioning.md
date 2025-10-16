# Versioning Policy for Slotspire

This document defines how we version builds, when to bump numbers, and the commands to cut releases.

## Format
`MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]`

- **MAJOR** — Save-breaking changes or fundamental rewrites (post-1.0). Pre-1.0, still call out breaking changes (see below).
- **MINOR** — New features/content or notable UX additions in a backward-compatible way.
- **PATCH** — Bug fixes, tuning/balance, perf, small UI tweaks.
- **PRERELEASE** — `alpha.N`, `beta.N`, `rc.N`.
- **BUILD** — Optional metadata like a build id or date (e.g., `+20251016`).

> Current track: `0.1.0-alpha.1` (Vertical Slice, first alpha).

## Pre-1.0 Rules
While SemVer allows breaking changes before 1.0, we’ll keep clarity:
- **Save-breaking change** → bump **MINOR** and add a **BREAKING** note in the changelog.
- **New feature/content** → bump **MINOR**.
- **Fixes/tuning only** → bump **PATCH**.

## When to Bump
Ask in order:
1. **Save format or core contract changed?** → MINOR++ (mark BREAKING).
2. **New player-facing feature/content?** → MINOR++.
3. **Otherwise** → PATCH++.

## Milestones & Examples
- **0.1.0 – Vertical Slice**
  - Alphas while exploring: `0.1.0-alpha.1`, `0.1.0-alpha.2` …
  - Beta when feature-complete: `0.1.0-beta.1` …
  - Final: `0.1.0`.
  - Hotfixes: `0.1.1`, `0.1.2`.
- **0.2.0 – Run Progression** (RunManager + tickets + shop): start at `0.2.0-alpha.1`.
- **0.3.0 – Variety & Systems** (new machine, alchemy, branching): `0.3.0-alpha.1`.

## Changelog Sections
For each release in `docs/CHANGELOG.md`:
- **Added** — features/content
- **Changed** — tuning/UX
- **Fixed** — bugs
- **Performance** — perf wins
- **Removed/Deprecated** — if any
- **BREAKING** — explicit save/load migration notes

## Tagging & Releasing Commands

### Cut an alpha/beta/rc tag
```bash
# from the branch you’re tagging (usually dev for pre-release)
git pull
git tag -a v0.1.0-alpha.2 -m "Alpha 2: RunManager MVP + Heat + Tickets"
git push origin v0.1.0-alpha.2
```

### Ship a stable milestone
```bash
# ensure main is up to date and green
git checkout main
git merge dev
npm run changelog   # or update docs/CHANGELOG.md manually
git add docs/CHANGELOG.md
git commit -m "docs(changelog): release v0.1.0"

# tag and push
git tag -a v0.1.0 -m "Vertical Slice"
git push origin main --tags
```

### Patch release
```bash
# on main after fixes merged
npm run changelog
git add docs/CHANGELOG.md
git commit -m "docs(changelog): 0.1.1"
git tag -a v0.1.1 -m "Patch: bug fixes & balance"
git push origin main --tags
```

## Labeling BREAKING Changes
If a change breaks existing saves or data contracts:
- Add a **BREAKING** entry in the changelog with migration steps (or note that old saves are invalidated).
- Consider adding a save-version field to persisted data and a migration path in code when feasible.

## Version-to-Milestone Mapping (living document)
- `0.1.x` — Vertical Slice (one machine, one map, RunManager MVP, heat baseline, shop placeholder)
- `0.2.x` — Run Progression (persistent RunProgress, ticket economy, real shop)
- `0.3.x` — Variety & Systems (second machine, alchemy, map branching)

## Notes
- Marketing names can accompany tags in releases (e.g., “Vertical Slice Update”).
- GitHub Pages deploys from **main**; pre-releases can live on **dev** and be tagged independently.

