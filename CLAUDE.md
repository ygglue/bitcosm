# Bitcosm

An always-on, browser-based, massively-multiplayer **evolution sandbox**. One giant shared,
grid-based "petri dish" runs on an authoritative server 24/7. Each player is a **designer**: they
spend a point budget on microbe traits, seed a strain into the shared soup, and natural selection
takes over — microbes reproduce, mutate across generations, compete for food/space, prey on rival
strains, and adapt or die out. Players earn currency as their strain thrives and spend it to
intervene. A **daily login keeps a strain alive**; neglected strains decay and die, which bounds
server cost.

> Repo: https://github.com/ygglue/bitcosm.git · package name is currently `microcosm` (the earlier
> working title) — fine to leave or rename later.

## Status

**M1 (single-player browser sandbox) is shipped and merged to `main`.** The pure deterministic
Sim Core (M0) is driven by a framework-agnostic `Engine`, rendered with WebGL, and wrapped in a
Svelte HUD: point-buy genome designer, god-mode tools (seed/food/cull/mutate), pan/zoom camera,
pause/play/step/speed, and localStorage save/load with autosave. No server, accounts, or
multiplayer yet — those are M2–M4.

## Commands

```bash
npm install        # first-time setup
npm run dev        # Vite dev server → http://localhost:5173  (the playable viewer)
npm test           # Vitest unit tests (sim core) — globs tests/sim/**
npm run e2e        # Playwright browser smoke test (needs: npx playwright install chromium)
npm run check      # svelte-check (type-check .svelte components)
npm run build      # tsc --noEmit + vite build
npx tsc --noEmit   # type-check only
```

## Architecture

Four units, each with one responsibility and a clean interface. The **Sim Core is the portable
piece** — keep it pure so it can later move to a Rust/WASM core or a sharded server without
rewriting the game around it.

| Unit | Location | Responsibility |
|------|----------|----------------|
| **Sim Core** | `src/sim/` | Pure, deterministic simulation. Entry point `step(state, actions) → { state, events }`. No I/O. |
| **Client** | `src/ui/`, `src/render/`, `src/input/`, `src/engine/`, `src/main.ts`, `index.html` | Svelte HUD + WebGL renderer + camera/tools/engine driving the Sim Core. Client-only; never re-implements sim logic. |
| **Server** | *(M2, not built)* | Authoritative fixed-tick loop, WebSocket viewport sync, snapshots. |
| **Persistence** | *(M3, not built)* | Neon (Postgres), auth, object storage for world snapshots. |

### Sim Core module map (`src/sim/`)

- `types.ts` — `Genome`, `Microbe`, `WorldState`, `Action`, `SimEvent`.
- `prng.ts` — `makeRng(seed)`, mulberry32, deterministic, state restorable via `rng.state()`.
- `constants.ts` — all tunable simulation numbers (the balance surface).
- `genome.ts` — `randomGenome`, `mutate`, `clampGenome`, `genomeCost`, `isWithinBudget`, `POINT_BUDGET`.
- `world.ts` — `createWorld`, `idx`, `inBounds`, `neighbors`, `applyActions`, `population`.
- `tick.ts` — `tick(state)`: the per-microbe rule.
- `index.ts` — public API: `step()` + re-exports.

## Non-negotiable invariants

1. **Sim Core purity:** nothing in `src/sim/` may use `Math.random()`, `Date.now()`, the DOM,
   network, or any I/O. All randomness flows from the seeded PRNG carried in `WorldState.rngState`,
   which `tick` persists back at the end.
2. **Determinism:** identical `(state, actions)` → identical output. Cells iterate in fixed index
   order; PRNG draws happen in a fixed order. There are golden/hash tests guarding this — don't
   break them.
3. **World model:** bounded rectangle (no wrap), 4-neighbor (von Neumann), single microbe per cell.
4. **Strict TypeScript** everywhere.

## Simulation rules (M0)

**Genome** = six traits, each in `[0,1]`: `metabolism`, `reproThreshold`, `spread`, `diet`
(0 = herbivore → 1 = predator), `resilience`, `mutationRate`.

**Per-tick, per microbe** (fixed cell order; newborns this tick are skipped via `actedTick`):
eat (herbivory `min(food,(1-diet)*FEED_RATE)`) → predate (if `diet>0`, kill a different-strain
neighbor with prob `diet*(1-0.5*victim.genome.resilience)`, gain `victim.energy*PREDATION_EFF`) →
metabolize → die if `energy<=0` → reproduce (if above threshold and `rng<spread`, into an empty
neighbor; child = mutated genome + half energy). Then all cells regen food by `FOOD_REGEN` up to
`FOOD_MAX`.

To experiment: tweak `src/sim/constants.ts` (world balance) or the `founder` genome in
`src/viewer/main.ts` (what gets seeded). The page hot-reloads.

## Roadmap

- **M0 — Sim Core proof** ✅ shipped (pure deterministic sim + Canvas2D viewer + tests).
- **M1 — Single-player browser** ✅ shipped (point-buy genome UI + god-mode tools + WebGL + Svelte HUD + save/load).
- **M2 — Authoritative server + multiplayer:** move sim server-side, WebSocket viewport sync,
  one shared world. ← **next**
- **M3 — Accounts & persistence:** auth, Neon-backed strains, snapshots, daily keep-alive/vitality.
- **M4 — Monetization & polish:** Credits (strictly fair — cosmetics, strain slots, spore
  insurance, analytics/replays, season pass; **never** pay-for-power), polish.

## Conventions

- **TDD:** write the failing test first, then minimal code, then commit. Tests live in `tests/sim/`
  (unit, Vitest) and `tests/e2e/` (Playwright). Keep the two separate — Vitest only globs
  `tests/sim/**`.
- **Commits:** Conventional Commits (`feat:`, `test:`, `chore:`, `docs:`). Branch for feature work;
  `main` is the integration branch.
- **Don't re-implement sim logic** in the viewer/server/tests — always go through the Sim Core API.

## Reference docs

- Vision / spec: `docs/superpowers/specs/2026-06-17-microcosm-design.md`
- M0 implementation plan: `docs/superpowers/plans/2026-06-17-m0-sim-core.md`
- M1 design pressure points (in-place mutation vs. snapshotting; seed-overwrite guard) are recorded
  in the assistant's project memory.
