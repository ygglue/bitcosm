# Microcosm / Bitcosm — M1 (Single-Player Sandbox) Design Spec

**Date:** 2026-06-17
**Status:** Approved design; next step is the M1 implementation plan.
**Builds on:** M0 (Sim Core proof), shipped on `main`. See
`docs/superpowers/specs/2026-06-17-microcosm-design.md` (north-star) and
`docs/superpowers/plans/2026-06-17-m0-sim-core.md`.

---

## 1. Goal

Turn the proven-but-passive M0 simulation into a genuinely fun, interactive **single-player
god-sandbox** that runs entirely in the browser. The player designs microbe strains with a
point-buy genome editor, places them into a large world, acts on the world with god-mode tools,
controls the flow of time, and saves/restores sessions. No server, no accounts, no economy — pure
free-play.

M1 doubles as the place we build the **reusable client** (WebGL renderer, camera, genome designer,
HUD) that M2's multiplayer will wire to a server. Components are designed so M2 swaps the local
loop for a server feed without reworking the UI.

### In scope
- Point-buy genome designer + placing strains by clicking the world.
- God-mode tools: drop food, cull, inject mutation. Multiple strains coexisting and competing.
- Simulation controls: pause / play / step / speed.
- A large world with a pan/zoom **WebGL** camera.
- localStorage save/load of a session.

### Out of scope (deferred)
- **Biomass economy** (costs/cooldowns on interventions) → M2, where it matters (strains compete
  for real). M1 interventions are free.
- **Chunked / infinite world** → M2, paired with the server, because chunk lifecycle and streaming
  only pay off in the shared, server-owned world. M1 uses a large *bounded* region; the renderer is
  written chunk-agnostic ("draw the cells in view") so it carries over unchanged.
- Server, accounts (Neon), vitality/keep-alive, currencies, monetization → M2–M4.

---

## 2. Architecture

**Approach: a framework-agnostic `Engine` plus thin Svelte stores for the HUD only.** The `Engine`
owns the authoritative `WorldState` and the simulation loop and exposes methods; it mirrors only
*UI-relevant* state (active tool, current genome + budget, sim status, stats) into Svelte stores.
The WebGL canvas renders straight from engine state each frame. The `WorldState` itself is never
put in a reactive store (it mutates every tick over tens of thousands of cells — reactive
subscriptions would thrash).

This preserves M0's clean seam: the **Sim Core stays pure and deterministic**; the **Engine** drives
it and manages tools/camera/persistence; **Svelte** only paints the HUD. The Engine stays reusable
when M2 replaces the local `step()` loop with a server feed.

### Units (one responsibility each, clean boundaries)

| Unit | Files | Responsibility |
|------|-------|----------------|
| **Sim Core** | `src/sim/` | Pure deterministic simulation. M1 adds `cull` + `mutate` actions only. |
| **Engine** | `src/engine/engine.ts` | Owns `WorldState`; sim loop (tick scheduling, pause/play/step/speed); enqueues + applies Actions; pushes UI state to stores. |
| **Camera** | `src/engine/camera.ts` | Pan/zoom; pure screen↔world coordinate mapping. |
| **Strains** | `src/engine/strains.ts` | Strain registry (id → color), active strain, color assignment. |
| **Persistence** | `src/engine/persistence.ts` | Serialize/deserialize world+camera+strains ↔ localStorage. |
| **Renderer** | `src/render/glRenderer.ts` | WebGL: fill per-cell color buffer, upload as texture, draw visible region under camera. |
| **Pointer tools** | `src/input/pointerTools.ts` | The only place pointer events + active tool → Sim Core Actions. |
| **HUD** | `src/ui/*.svelte`, `src/ui/stores.ts` | Reactive presentation: toolbar, genome panel, sim controls, save/load, stats. |
| **Shell** | `src/main.ts`, `index.html` | Wires Engine + canvas + Svelte App together. |

The M0 Canvas2D viewer (`src/viewer/`) is **replaced** by this client; its per-cell coloring logic
is carried into `glRenderer.ts`.

---

## 3. Sim Core changes

M0's `Action` union (`seed`, `dropFood`) gains two purely additive, deterministic variants
(extend the union + `applyActions`, with unit tests). Nothing else in the core changes — the tick
rule, determinism, and existing tests all stand.

- `{ type: 'cull'; x: number; y: number; radius: number }` — remove microbes within the radius.
- `{ type: 'mutate'; x: number; y: number; radius: number }` — apply a mutation burst to microbes
  in the radius, reusing the existing `mutate(genome, rng)` so it stays seeded/deterministic.

Both use the existing Chebyshev-radius convention from `dropFood` and draw randomness only from the
PRNG carried in `WorldState.rngState`.

---

## 4. World, rendering & camera

- **World:** a large *bounded* region, default **256×256** (~65k cells). Configurable. The renderer
  is agnostic to the dimensions, so M2's chunked-infinite world reuses it unchanged.
- **WebGL renderer:** reuse M0's per-cell coloring (food → green shade; microbe → strain color), but
  fill a `Uint8Array` and upload it as a `W×H` RGBA texture (`texSubImage2D`), then draw one quad
  with **NEAREST** filtering under the camera transform. Pan/zoom is just the quad transform — the
  GPU samples the texture, so navigation is effectively free at any zoom. CPU cost stays O(cells)
  per frame for the color fill (same as M0), fine at this region size.
- **Camera:** pan by drag, zoom by wheel (cursor-anchored). Pure functions map screen↔world
  coordinates so `pointerTools` can convert a click to a world cell.

---

## 5. God-mode tools

The player selects a tool, then acts on the world (pointer → `pointerTools` → enqueued Action).

- **Design & seed a strain** — the genome designer (Section 6) defines the active strain; clicking
  the world seeds it (a small brush of cells) → `seed` actions.
- **Drop food** — paint nutrient blooms → `dropFood`.
- **Cull** — click/drag to wipe microbes in an area → `cull` (the "smite" tool).
- **Inject mutation** — brush a mutation burst onto a region → `mutate`.
- **Multiple strains** — design and release several strains; each gets a distinct color and competes
  in the shared world.

---

## 6. Genome designer

- Six trait sliders (`metabolism`, `reproThreshold`, `spread`, `diet`, `resilience`, `mutationRate`),
  each `[0,1]`, matching the Sim Core `Genome`.
- A **live budget meter** using the core's existing `genomeCost`, `isWithinBudget`, and
  `POINT_BUDGET`. The meter turns red and "release/seed" is disabled while over budget.
- The active strain has a color (from the strain registry); newly released strains get the next
  distinct color.

---

## 7. Simulation control & data flow

Two decoupled clocks:
- **Render loop** (every animation frame): `glRenderer.render(world, camera)`; push lightweight
  stats into the store occasionally (not every frame).
- **Sim clock** (driven by speed/pause): an accumulator in `engine` calls `step(world, queued)` at
  the chosen rate. Render and sim rates are independent, so pausing freezes evolution while pan/zoom
  and design stay live. Controls: **pause / play / step-one-tick / speed**.
- **Pointer → world:** pointer events → `pointerTools` → `engine.enqueue(action)` (applied on the
  next `step`).
- **HUD → engine:** Svelte components call engine methods (`selectTool`, `setGenome`, `setSpeed`,
  `pause`, `step`, `save`, `load`); the engine writes UI-relevant changes back into stores.

---

## 8. Persistence

- **Save:** serialize `{ schemaVersion, world, camera, strains, activeGenome }` to a named
  localStorage slot. `WorldState` is serialized compactly — food as a plain number array, microbes
  as `[index, strainId, energy, ...genome]` tuples skipping empty cells — so saves stay small.
- **Load:** validate `schemaVersion`, rebuild typed arrays (`Float32Array` food, microbe array).
- A few named slots plus an autosave.

---

## 9. Error handling

- Corrupt or wrong-version save → reject gracefully, keep the current world, surface a small notice;
  never crash the loop.
- Over-budget genome → "release" disabled, budget meter red (via the core's budget helpers).
- WebGL context unavailable → friendly message instead of a blank canvas.

---

## 10. Testing

- **Sim core:** unit tests for the new `cull` and `mutate` actions (deterministic, area-bounded;
  same Chebyshev convention as `dropFood`).
- **Engine:** unit tests for sim-loop scheduling (pause/step/speed accumulator), persistence
  round-trip (serialize→deserialize equals original), camera math (screen↔world round-trip), and
  strain color assignment.
- **Playwright (updated from M0's smoke test):** boot the app, design a strain, click the world to
  place it, run a few ticks → assert population grows and the canvas shows colored pixels; plus a
  save→reload test asserting the world restores. Real Chromium supports WebGL headless.
- WebGL internals aren't unit-tested; the Playwright visual smoke covers rendering at runtime.

---

## 11. Tech stack additions

- **Svelte** for the HUD (reactive stores + components), integrated via Vite. The WebGL world canvas
  is separate from the Svelte tree.
- Raw **WebGL** (no rendering library) for the world renderer.
- Everything else carries over from M0 (TypeScript strict, Vite, Vitest, Playwright).

---

## 12. Open questions (defer to relevant task during planning)
- Exact brush sizes/shapes per tool and the speed-slider steps (tune during implementation).
- Number of named save slots and autosave cadence.
- Default strain color palette (distinct, colorblind-friendly ordering).
