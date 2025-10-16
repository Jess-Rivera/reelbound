# v0.1.0 — Vertical Slice (Definition)

## 1) Goal (one line)

Deliver a single, repeatable run that feels like *a game*: spin → fight → shop → progress → end, with heat-driven pacing and basic persistence.

## 2) Core Loop (must exist end-to-end)

* Start screen → New Run
* Encounter (fight) driven by a **single slot machine**
* **Heat** rises/decays and affects difficulty/feedback
* Rewards → **Tickets** earned
* **Shop** node (spend tickets on a few meaningful actions)
* Simple **Map** progression (2–3 encounters + 1 shop + boss placeholder)
* **Run end** (win/lose) → Summary → Back to start
* **Save/Load** last run state (resume or start fresh)

## 3) Systems & “Definition of Done”

### A) RoundManager/FightManager/RunManager (meta flow)

* FightManager controls single fight over N rounds, takes inputs and spits results
* RoundManager controls a single round.
* RunManager orchestrates states: `Start → Encounter → Shop → Map → End`
* Persists `RunProgress` to localStorage with a version stamp
* Can resume mid-run or clear and start new
* State diagram documented in `docs/ARCHITECTURE.md`

**DoD:** start → finish without dev tools; F5 reload resumes or cleanly resets by choice.

---

### B) Slot Machine (combat driver)

* 3 reels, deterministic RNG seed per spin (for reproducible bugs)
* Symbol table comes from data (no hardcoded weights)
* Single win condition & payout path (keep it simple)
* Spin timing consistent at 60fps on mid laptop

**DoD:** 50 spins in a row produce no timing glitches; symbols/payouts match data.

---

### C) Heat System (pacing lever)

* Clear rules: +heat on spin/win-streak; -heat on decay/between nodes
* 2–3 thresholds (e.g., Calm < 50, Tense ≥ 50, Overheat ≥ 100)
* Visual feedback for current tier (tint, pulse, or SFX swap)
* Heat influences at least one parameter (e.g., enemy strength, payout variance)

**DoD:** QA script proves heat moves as designed and visibly changes gameplay.

---

### D) Ticket Economy & Shop

* Ticket earnings per encounter (formula defined & documented)
* Shop offers **exactly 3** actions to keep scope tight:

  1. Reduce Heat (flat or %)
  2. Heal/Repair (if applicable)
  3. Reroll Next Encounter Modifier (or minor buff)
* Prices scale mildly with map depth or previous purchases

**DoD:** All three actions work, update state, and are reflected next encounter.

---

### E) Map & Encounters

* Minimal map: Encounter → Shop → Encounter → Boss (placeholder)
* Node data structure serialized in JSON
* Choosing a node updates RunManager and loads the correct scene

**DoD:** Can click through the whole path; node types render correctly.

---

### F) Data-Driven Symbol/Item Metadata

* `iconMetaTable` pulled from JSON (sprite URL, rarity, base value, tags)
* Public assets resolved via `import.meta.env.BASE_URL`
* Loader validates required fields and logs missing sprites

**DoD:** Build fails gracefully (console error) on malformed JSON; happy path loads all symbols.

---

### G) UI & UX Polish (slice-level only)

* Start screen with “New Run / Continue / Settings (placeholder)”
* HUD: credits/tickets, heat meter, spin button, small combat log
* Minimal animation polish for spins (ease-in/out, reel blur or ghosting)
* Audio optional; if present, a single spin SFX + win SFX

**DoD:** All HUD data stays in sync; no clickable dead-ends; controller/mouse both usable (pick one primary if needed).

---

### H) Save/Load & Versioning

* `RunProgress` schema includes `saveVersion`
* On load: if version mismatch is non-breaking, continue; if breaking, prompt “start new”
* Version tagged `0.1.0-<prerelease>`; changelog updated

**DoD:** Simulate old save: app shows clear UX and does not crash.

---

## 4) Data Schemas (minimal, concrete)

### `RunProgress` (TS)

```ts
export interface RunProgress {
  saveVersion: "0.1";
  seed: number;
  day: number;
  nodeIndex: number;
  tickets: number;
  totalCredits: number;
  machineState: {
    heat: number;
    lastPayout: number;
  };
  enemyState: {
    tier: number;
    hp: number;
  };
}
```

### `Symbol` (JSON)

```json
{
  "id": "cherry",
  "sprite": "assets/cherry.png",
  "rarity": "common",
  "value": 10,
  "tags": ["fruit"]
}
```

### `ShopAction` (JSON)

```json
{ "id": "reduce_heat", "label": "Reduce Heat", "cost": 5, "effect": { "heatDelta": -25 } }
```

### `MapNode` (JSON)

```json
{ "id": "node2", "type": "shop", "next": ["node3"] }
```

## 5) Non-Goals (explicitly *not* in v0.1.0)

* Multiple machines, complex items, or buildcrafting
* Procedural map variety beyond the simple path
* Meta progression across runs
* Full audio suite, VFX library, or advanced shaders
* Mobile/browser compatibility beyond desktop Chrome

## 6) Performance & Quality Bars

* 60fps on a 2-core laptop at 1080p during spins
* No unhandled exceptions in console during a full run
* Lighthouse (or manual) check: no blocking 404s on assets
* Memory steady across 50 spins (no image handle leaks)

## 7) Telemetry / Debug (dev-only)

* Toggleable debug overlay: heat, last spin result, RNG seed
* “Force Overheat” and “Give 10 Tickets” dev buttons (guarded behind a flag)
* One JSON dump of final `RunProgress` on run end (console)

## 8) Acceptance Tests (quick manual script)

* New Run → finish 2 encounters → shop once → boss placeholder → end → summary shown
* Refresh mid-run → Continue restores to same node with same heat/tickets
* Spin 20x: heat crosses threshold; UI feedback changes; payouts still correct
* Buy all 3 shop actions across a run; each effect applies and persists
* Break the data once (missing sprite) → game logs error, continues gracefully

## 9) Packaging & Release

* GitHub Pages build: `npm run build:gh` → auto deploy on `main`
* Tag: `v0.1.0-beta.1` when feature complete; `v0.1.0` when stable
* `docs/CHANGELOG.md` updated with Added/Changed/Fixed & BREAKING (if any)

## 10) Risks & Mitigations

* **Asset paths / base URL**: use the `asset()` helper everywhere in data
* **Save schema churn**: include `saveVersion` and a migration stub early
* **Timing jitter**: decouple reel spin visuals from payout resolution logic
* **Scope creep**: lock shop to 3 actions; lock map to 4 nodes

---

### Implementation Order (1–2 week push)

1. RunManager skeleton + state transitions
2. Slot machine single payout path + reels timing
3. Heat rules + thresholds + basic feedback
4. Ticket earnings + Shop actions wired to state
5. Minimal map path + node navigation
6. Save/load + versioning + error handling
7. UI polish + acceptance sweep + tag
S