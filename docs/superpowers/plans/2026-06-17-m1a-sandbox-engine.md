# M1a — Sandbox Engine & Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete, headless, fully unit-tested logic layer for the M1 single-player sandbox: two new deterministic Sim Core actions (`cull`, `mutate`), a pan/zoom camera, a strain registry, the simulation `Engine` (owns the world + tick scheduling + action queue), localStorage persistence, pointer-tool→action mapping, and the per-cell color buffer fill. No DOM, no WebGL, no Svelte — those are Plan M1b.

**Architecture:** A framework-agnostic `Engine` owns the authoritative `WorldState` from the M0 Sim Core and drives it with a time-accumulator tick loop; surrounding pure modules (camera, strains, persistence, pointer tools, colors, color-buffer) are small, single-responsibility, and independently testable. Everything here is pure TypeScript runnable under Vitest's node environment.

**Tech Stack:** TypeScript 5 (strict), Vitest 2. No new runtime dependencies. Builds on M0 (`src/sim/`).

## Global Constraints

- **Sim Core (`src/sim/`) stays pure and deterministic:** no I/O, no `Date.now()`, no `Math.random()`, no DOM, no network. All randomness flows from the seeded PRNG in `WorldState.rngState`; the new `mutate` action draws only from it and persists `rngState` back.
- **Determinism:** identical `(state, actions)` → identical output. New actions use the same fixed Chebyshev-radius convention as `dropFood`.
- **TypeScript strict mode** everywhere.
- **The `Engine` is framework-agnostic:** it must not import Svelte, touch the DOM, or call `Date.now()`/`requestAnimationFrame`. Time enters only via the `dtMs` argument to `advance()`.
- **World is a bounded rectangle** (M1; chunked-infinite is M2), 4-neighbor, single-occupancy — unchanged from M0.

---

## File Structure

```
src/
  sim/
    types.ts        # MODIFY: add cull + mutate to the Action union
    world.ts        # MODIFY: applyActions handles cull + mutate (rng-threaded)
  colors.ts         # NEW: strainColor + hslToRgb (shared by renderer + UI)
  engine/
    camera.ts       # NEW: Camera + pan/zoom + screen<->world (pure)
    strains.ts      # NEW: StrainRegistry + paletteColor
    engine.ts       # NEW: Engine (world + tick scheduling + queue) + worldStats
    persistence.ts  # NEW: serialize/deserialize world; save/load slots (injectable Storage)
  input/
    pointerTools.ts # NEW: pointerToActions (pure tool->Action mapping)
  render/
    colorBuffer.ts  # NEW: fillColorBuffer (pure per-cell RGBA fill)
tests/
  sim/world.actions.test.ts
  colors.test.ts
  engine/camera.test.ts
  engine/strains.test.ts
  engine/engine.test.ts
  engine/persistence.test.ts
  input/pointerTools.test.ts
  render/colorBuffer.test.ts
vitest.config.ts    # MODIFY: include all tests/** except tests/e2e
```

The M0 viewer (`src/viewer/`) and its inline color helpers remain untouched in this plan; they are replaced/deleted in Plan M1b. The minor color duplication between `src/colors.ts` (new) and `src/viewer/render.ts` (to be deleted) is intentional and short-lived.

---

## Locked Interfaces (every task must match these exactly)

```typescript
// src/sim/types.ts — Action union gains two variants:
//   | { type: 'cull'; x: number; y: number; radius: number }
//   | { type: 'mutate'; x: number; y: number; radius: number }

// src/colors.ts
export function strainColor(strainId: number): [number, number, number];
export function hslToRgb(h: number, s: number, l: number): [number, number, number];

// src/engine/camera.ts
export interface Camera { x: number; y: number; zoom: number; } // x,y = world cell at viewport centre; zoom = screen px per cell
export function createCamera(x: number, y: number, zoom: number): Camera;
export function screenToWorld(cam: Camera, sx: number, sy: number, vw: number, vh: number): { wx: number; wy: number };
export function worldToScreen(cam: Camera, wx: number, wy: number, vw: number, vh: number): { sx: number; sy: number };
export function panCamera(cam: Camera, dxScreen: number, dyScreen: number): Camera;
export function zoomCameraAt(cam: Camera, factor: number, sx: number, sy: number, vw: number, vh: number): Camera;
export function clampCamera(cam: Camera, worldW: number, worldH: number, minZoom: number, maxZoom: number): Camera;

// src/engine/strains.ts
export interface StrainInfo { id: number; color: [number, number, number]; }
export function paletteColor(index: number): [number, number, number];
export class StrainRegistry {
  active: StrainInfo | null;
  create(): StrainInfo;            // next id (1,2,3...), next palette colour, sets active
  get(id: number): StrainInfo | undefined;
  setActive(id: number): void;
  all(): StrainInfo[];
}

// src/engine/engine.ts
export interface EngineOptions { width: number; height: number; seed: number; }
export interface WorldStats { tick: number; population: number; perStrain: Record<number, number>; }
export function worldStats(state: WorldState): WorldStats;
export class Engine {
  readonly world: WorldState;
  paused: boolean;        // default false
  speed: number;          // ticks/sec, default 10, always > 0
  constructor(opts: EngineOptions);
  enqueue(action: Action): void;
  enqueueMany(actions: Action[]): void;
  advance(dtMs: number): number;   // steps sim per elapsed time*speed (no-op if paused); returns steps taken
  stepOnce(): void;                // drain queue + exactly one tick, ignores paused
  setSpeed(ticksPerSecond: number): void;  // throws if <= 0
  setPaused(paused: boolean): void;
  loadWorld(world: WorldState): void;       // replace world (persistence load); clears queue + accumulator
}

// src/engine/persistence.ts
export const SCHEMA_VERSION = 1;
export type MicrobeTuple = [number, number, number, number, number, number, number, number, number];
//   [index, strainId, energy, metabolism, reproThreshold, spread, diet, resilience, mutationRate]
export interface SerializedWorld { width: number; height: number; tick: number; rngState: number; food: number[]; microbes: MicrobeTuple[]; }
export interface SaveData { schemaVersion: number; world: SerializedWorld; camera: Camera; strains: StrainInfo[]; activeGenome: Genome; }
export function serializeWorld(state: WorldState): SerializedWorld;
export function deserializeWorld(s: SerializedWorld): WorldState;
export function saveToSlot(slot: string, data: SaveData, storage?: Storage): void;
export function loadFromSlot(slot: string, storage?: Storage): SaveData | null; // null if missing/corrupt/version-mismatch
export function listSlots(storage?: Storage): string[];

// src/input/pointerTools.ts
export type ToolId = 'seed' | 'food' | 'cull' | 'mutate';
export interface ToolContext { tool: ToolId; brushRadius: number; activeStrainId: number | null; genome: Genome; foodAmount: number; }
export function pointerToActions(ctx: ToolContext, wx: number, wy: number): Action[];

// src/render/colorBuffer.ts
export function fillColorBuffer(world: WorldState, buf: Uint8Array): void; // buf length must be width*height*4 (RGBA)
```

---

### Task 1: Sim Core — `cull` and `mutate` actions

**Files:**
- Modify: `src/sim/types.ts` (extend `Action` union)
- Modify: `src/sim/world.ts` (`applyActions`)
- Modify: `vitest.config.ts` (broaden test include)
- Create: `tests/sim/world.actions.test.ts`

**Interfaces:**
- Consumes: `makeRng` (`./prng`), `mutate` (`./genome`), existing `applyActions`/`idx`/`inBounds`.
- Produces: `Action` variants `{ type:'cull'; x; y; radius }` and `{ type:'mutate'; x; y; radius }`. `applyActions` removes microbes within a `cull`'s Chebyshev radius, and replaces the genome of each microbe within a `mutate`'s radius via `mutate(genome, rng)`; the rng is created from `state.rngState` only if a `mutate` action is present and persisted back afterward (so `seed`/`dropFood`-only calls leave `rngState` untouched, preserving M0 behavior).

- [ ] **Step 1: Broaden the Vitest include** — replace the contents of `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
```

- [ ] **Step 2: Write the failing test** — create `tests/sim/world.actions.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { createWorld, idx, applyActions, population } from '../../src/sim/world';
import type { Genome } from '../../src/sim/types';

const g: Genome = { metabolism: 0.2, reproThreshold: 0.3, spread: 0.8, diet: 0.1, resilience: 0.5, mutationRate: 0.5 };

function seedBlock(w = createWorld(7, 7, 42)) {
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
    applyActions(w, [{ type: 'seed', x, y, strainId: 1, genome: g }]);
  }
  return w;
}

describe('cull action', () => {
  it('removes microbes within the Chebyshev radius and leaves the rest', () => {
    const w = seedBlock();
    expect(population(w)).toBe(49);
    applyActions(w, [{ type: 'cull', x: 3, y: 3, radius: 1 }]); // 3x3 around centre
    expect(w.microbes[idx(w, 3, 3)]).toBeNull();
    expect(w.microbes[idx(w, 2, 2)]).toBeNull();
    expect(w.microbes[idx(w, 4, 4)]).toBeNull();
    expect(w.microbes[idx(w, 0, 0)]).not.toBeNull(); // outside radius
    expect(population(w)).toBe(49 - 9);
  });

  it('does not advance rngState', () => {
    const w = seedBlock();
    const before = w.rngState;
    applyActions(w, [{ type: 'cull', x: 3, y: 3, radius: 2 }]);
    expect(w.rngState).toBe(before);
  });
});

describe('mutate action', () => {
  it('changes genomes within the radius deterministically and advances rngState', () => {
    const a = seedBlock(createWorld(7, 7, 99));
    const b = seedBlock(createWorld(7, 7, 99));
    const beforeRng = a.rngState;
    applyActions(a, [{ type: 'mutate', x: 3, y: 3, radius: 1 }]);
    applyActions(b, [{ type: 'mutate', x: 3, y: 3, radius: 1 }]);
    // deterministic: same seed + same action => identical genomes
    expect(a.microbes[idx(a, 3, 3)]!.genome).toEqual(b.microbes[idx(b, 3, 3)]!.genome);
    // a centre genome actually drifted (mutationRate 0.5 > 0)
    expect(a.microbes[idx(a, 3, 3)]!.genome).not.toEqual(g);
    // outside the radius is untouched
    expect(a.microbes[idx(a, 0, 0)]!.genome).toEqual(g);
    // rngState advanced
    expect(a.rngState).not.toBe(beforeRng);
  });

  it('leaves rngState untouched for seed/dropFood-only calls', () => {
    const w = createWorld(7, 7, 7);
    const before = w.rngState;
    applyActions(w, [{ type: 'seed', x: 1, y: 1, strainId: 1, genome: g }, { type: 'dropFood', x: 1, y: 1, radius: 1, amount: 0.1 }]);
    expect(w.rngState).toBe(before);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/sim/world.actions.test.ts`
Expected: FAIL (cull/mutate not handled; type errors on the new action shapes).

- [ ] **Step 4: Extend the `Action` union** — in `src/sim/types.ts`, replace the `Action` type with:

```typescript
export type Action =
  | { type: 'seed'; x: number; y: number; strainId: number; genome: Genome }
  | { type: 'dropFood'; x: number; y: number; radius: number; amount: number }
  | { type: 'cull'; x: number; y: number; radius: number }
  | { type: 'mutate'; x: number; y: number; radius: number };
```

- [ ] **Step 5: Handle the new actions** — in `src/sim/world.ts`, add imports at the top and replace `applyActions` with the version below.

Add to the imports already present:
```typescript
import { makeRng, type Rng } from './prng';
import { mutate } from './genome';
```

Replace `applyActions`:
```typescript
export function applyActions(state: WorldState, actions: Action[]): void {
  let rng: Rng | null = null;
  for (const a of actions) {
    if (a.type === 'seed') {
      if (!inBounds(state, a.x, a.y)) continue;
      state.microbes[idx(state, a.x, a.y)] = {
        strainId: a.strainId,
        energy: START_ENERGY,
        genome: a.genome,
        actedTick: -1,
      };
    } else if (a.type === 'dropFood') {
      for (let dy = -a.radius; dy <= a.radius; dy++) {
        for (let dx = -a.radius; dx <= a.radius; dx++) {
          const x = a.x + dx;
          const y = a.y + dy;
          if (!inBounds(state, x, y)) continue;
          const i = idx(state, x, y);
          const v = state.food[i] + a.amount;
          state.food[i] = v > FOOD_MAX ? FOOD_MAX : v;
        }
      }
    } else if (a.type === 'cull') {
      for (let dy = -a.radius; dy <= a.radius; dy++) {
        for (let dx = -a.radius; dx <= a.radius; dx++) {
          const x = a.x + dx;
          const y = a.y + dy;
          if (!inBounds(state, x, y)) continue;
          state.microbes[idx(state, x, y)] = null;
        }
      }
    } else {
      // mutate
      if (!rng) rng = makeRng(state.rngState);
      for (let dy = -a.radius; dy <= a.radius; dy++) {
        for (let dx = -a.radius; dx <= a.radius; dx++) {
          const x = a.x + dx;
          const y = a.y + dy;
          if (!inBounds(state, x, y)) continue;
          const m = state.microbes[idx(state, x, y)];
          if (m) m.genome = mutate(m.genome, rng);
        }
      }
    }
  }
  if (rng) state.rngState = rng.state();
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — new action tests pass; all M0 tests (26) still pass.

- [ ] **Step 7: Commit**

```bash
git add src/sim/types.ts src/sim/world.ts tests/sim/world.actions.test.ts vitest.config.ts
git commit -m "feat: add cull and mutate sim actions"
```

---

### Task 2: Shared colors module

**Files:**
- Create: `src/colors.ts`
- Create: `tests/colors.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `strainColor(strainId): [number,number,number]` (deterministic, distinct hues via the golden-ratio trick) and `hslToRgb(h,s,l): [number,number,number]` (each channel 0–255). Used by the strain registry, the color buffer, and (in M1b) the renderer and HUD.

- [ ] **Step 1: Write the failing test** — create `tests/colors.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { strainColor, hslToRgb } from '../src/colors';

describe('hslToRgb', () => {
  it('maps primary hues correctly', () => {
    expect(hslToRgb(0, 1, 0.5)).toEqual([255, 0, 0]);      // red
    expect(hslToRgb(1 / 3, 1, 0.5)).toEqual([0, 255, 0]);  // green
    expect(hslToRgb(2 / 3, 1, 0.5)).toEqual([0, 0, 255]);  // blue
  });
  it('returns channels in [0,255]', () => {
    for (let i = 0; i < 20; i++) {
      for (const c of hslToRgb(i / 20, 0.7, 0.55)) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe('strainColor', () => {
  it('is deterministic', () => {
    expect(strainColor(3)).toEqual(strainColor(3));
  });
  it('gives distinct colors to consecutive strain ids', () => {
    const a = strainColor(1).join(',');
    const b = strainColor(2).join(',');
    const c = strainColor(3).join(',');
    expect(new Set([a, b, c]).size).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/colors.test.ts`
Expected: FAIL — cannot resolve `../src/colors`.

- [ ] **Step 3: Write the implementation** — create `src/colors.ts`

```typescript
// Distinct, stable color per strain via the golden-ratio hue trick.
export function strainColor(strainId: number): [number, number, number] {
  const hue = (strainId * 0.61803398875) % 1;
  return hslToRgb(hue, 0.7, 0.55);
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  const seg = Math.floor(h * 6) % 6;
  if (seg === 0) [r, g, b] = [c, x, 0];
  else if (seg === 1) [r, g, b] = [x, c, 0];
  else if (seg === 2) [r, g, b] = [0, c, x];
  else if (seg === 3) [r, g, b] = [0, x, c];
  else if (seg === 4) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/colors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/colors.ts tests/colors.test.ts
git commit -m "feat: add shared strain color module"
```

---

### Task 3: Camera

**Files:**
- Create: `src/engine/camera.ts`
- Create: `tests/engine/camera.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the `Camera` interface and pure functions from the locked list. `Camera.x/y` are the world-cell coordinates under the viewport center; `zoom` is screen pixels per cell. `screenToWorld`/`worldToScreen` are exact inverses. `panCamera` moves the camera opposite to cursor drag. `zoomCameraAt` keeps the world point under the cursor fixed. `clampCamera` clamps zoom to `[minZoom,maxZoom]` and center to `[0,worldW]×[0,worldH]`.

- [ ] **Step 1: Write the failing test** — create `tests/engine/camera.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { createCamera, screenToWorld, worldToScreen, panCamera, zoomCameraAt, clampCamera } from '../../src/engine/camera';

describe('camera coordinate mapping', () => {
  it('screenToWorld and worldToScreen are inverses', () => {
    const cam = createCamera(50, 40, 4);
    const vw = 800, vh = 600;
    const { wx, wy } = screenToWorld(cam, 123, 456, vw, vh);
    const { sx, sy } = worldToScreen(cam, wx, wy, vw, vh);
    expect(sx).toBeCloseTo(123, 6);
    expect(sy).toBeCloseTo(456, 6);
  });
  it('viewport center maps to the camera position', () => {
    const cam = createCamera(50, 40, 4);
    const { wx, wy } = screenToWorld(cam, 400, 300, 800, 600);
    expect(wx).toBeCloseTo(50, 6);
    expect(wy).toBeCloseTo(40, 6);
  });
});

describe('panCamera', () => {
  it('moves the camera opposite to the drag, scaled by zoom', () => {
    const cam = createCamera(50, 40, 4);
    const out = panCamera(cam, 8, -4); // dragged right 8px, up 4px
    expect(out.x).toBeCloseTo(50 - 8 / 4, 6);
    expect(out.y).toBeCloseTo(40 - -4 / 4, 6);
    expect(out.zoom).toBe(4);
  });
});

describe('zoomCameraAt', () => {
  it('keeps the world point under the cursor fixed', () => {
    const cam = createCamera(50, 40, 4);
    const vw = 800, vh = 600, sx = 600, sy = 200;
    const before = screenToWorld(cam, sx, sy, vw, vh);
    const out = zoomCameraAt(cam, 2, sx, sy, vw, vh);
    expect(out.zoom).toBeCloseTo(8, 6);
    const after = screenToWorld(out, sx, sy, vw, vh);
    expect(after.wx).toBeCloseTo(before.wx, 6);
    expect(after.wy).toBeCloseTo(before.wy, 6);
  });
});

describe('clampCamera', () => {
  it('clamps zoom and center into range', () => {
    const out = clampCamera(createCamera(-10, 999, 0.1), 256, 256, 1, 40);
    expect(out.zoom).toBe(1);
    expect(out.x).toBe(0);
    expect(out.y).toBe(256);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/engine/camera.test.ts`
Expected: FAIL — cannot resolve `../../src/engine/camera`.

- [ ] **Step 3: Write the implementation** — create `src/engine/camera.ts`

```typescript
export interface Camera {
  x: number; // world cell x at viewport centre
  y: number; // world cell y at viewport centre
  zoom: number; // screen pixels per cell
}

export function createCamera(x: number, y: number, zoom: number): Camera {
  return { x, y, zoom };
}

export function screenToWorld(cam: Camera, sx: number, sy: number, vw: number, vh: number): { wx: number; wy: number } {
  return {
    wx: cam.x + (sx - vw / 2) / cam.zoom,
    wy: cam.y + (sy - vh / 2) / cam.zoom,
  };
}

export function worldToScreen(cam: Camera, wx: number, wy: number, vw: number, vh: number): { sx: number; sy: number } {
  return {
    sx: (wx - cam.x) * cam.zoom + vw / 2,
    sy: (wy - cam.y) * cam.zoom + vh / 2,
  };
}

export function panCamera(cam: Camera, dxScreen: number, dyScreen: number): Camera {
  return { x: cam.x - dxScreen / cam.zoom, y: cam.y - dyScreen / cam.zoom, zoom: cam.zoom };
}

export function zoomCameraAt(cam: Camera, factor: number, sx: number, sy: number, vw: number, vh: number): Camera {
  const before = screenToWorld(cam, sx, sy, vw, vh);
  const zoom = cam.zoom * factor;
  // keep `before` under the cursor: solve screenToWorld(newCam, sx, sy) == before
  return {
    x: before.wx - (sx - vw / 2) / zoom,
    y: before.wy - (sy - vh / 2) / zoom,
    zoom,
  };
}

export function clampCamera(cam: Camera, worldW: number, worldH: number, minZoom: number, maxZoom: number): Camera {
  const zoom = Math.min(maxZoom, Math.max(minZoom, cam.zoom));
  const x = Math.min(worldW, Math.max(0, cam.x));
  const y = Math.min(worldH, Math.max(0, cam.y));
  return { x, y, zoom };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/engine/camera.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/camera.ts tests/engine/camera.test.ts
git commit -m "feat: add pan/zoom camera"
```

---

### Task 4: Strain registry

**Files:**
- Create: `src/engine/strains.ts`
- Create: `tests/engine/strains.test.ts`

**Interfaces:**
- Consumes: `strainColor` from `../colors`.
- Produces: `paletteColor(index)` (delegates to `strainColor(index+1)` so the first strain is id 1) and `StrainRegistry`. `create()` allocates the next id starting at 1, assigns `paletteColor` by creation order, sets it active, and returns it. `get`, `setActive`, `all` behave as named.

- [ ] **Step 1: Write the failing test** — create `tests/engine/strains.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { StrainRegistry, paletteColor } from '../../src/engine/strains';
import { strainColor } from '../../src/colors';

describe('paletteColor', () => {
  it('maps index 0 to strain color 1', () => {
    expect(paletteColor(0)).toEqual(strainColor(1));
  });
});

describe('StrainRegistry', () => {
  it('creates strains with incrementing ids and distinct colors, setting active', () => {
    const reg = new StrainRegistry();
    expect(reg.active).toBeNull();
    const s1 = reg.create();
    const s2 = reg.create();
    expect(s1.id).toBe(1);
    expect(s2.id).toBe(2);
    expect(reg.active).toEqual(s2);
    expect(s1.color).not.toEqual(s2.color);
    expect(reg.all().map((s) => s.id)).toEqual([1, 2]);
  });
  it('get and setActive work', () => {
    const reg = new StrainRegistry();
    reg.create();
    const s2 = reg.create();
    reg.setActive(1);
    expect(reg.active!.id).toBe(1);
    expect(reg.get(2)).toEqual(s2);
    expect(reg.get(99)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/engine/strains.test.ts`
Expected: FAIL — cannot resolve `../../src/engine/strains`.

- [ ] **Step 3: Write the implementation** — create `src/engine/strains.ts`

```typescript
import { strainColor } from '../colors';

export interface StrainInfo {
  id: number;
  color: [number, number, number];
}

export function paletteColor(index: number): [number, number, number] {
  return strainColor(index + 1);
}

export class StrainRegistry {
  active: StrainInfo | null = null;
  private strains: StrainInfo[] = [];

  create(): StrainInfo {
    const id = this.strains.length + 1;
    const info: StrainInfo = { id, color: paletteColor(this.strains.length) };
    this.strains.push(info);
    this.active = info;
    return info;
  }

  get(id: number): StrainInfo | undefined {
    return this.strains.find((s) => s.id === id);
  }

  setActive(id: number): void {
    const found = this.get(id);
    if (found) this.active = found;
  }

  all(): StrainInfo[] {
    return [...this.strains];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/engine/strains.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/strains.ts tests/engine/strains.test.ts
git commit -m "feat: add strain registry"
```

---

### Task 5: Engine + world stats

**Files:**
- Create: `src/engine/engine.ts`
- Create: `tests/engine/engine.test.ts`

**Interfaces:**
- Consumes: `createWorld` (`../sim/world`), `step` (`../sim/index`), `population` (`../sim/world`), types `WorldState`/`Action` (`../sim/types`).
- Produces: `Engine` and `worldStats` per the locked list. `advance(dtMs)` accumulates time and runs `floor` ticks at `speed` ticks/sec (no-op while paused), capped at 240 steps per call to avoid a spiral; returns the number of steps taken. Each tick drains the queued actions into `step`. `stepOnce` drains + ticks once regardless of `paused`. `loadWorld` swaps the world and clears the queue and accumulator.

- [ ] **Step 1: Write the failing test** — create `tests/engine/engine.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { Engine, worldStats } from '../../src/engine/engine';
import { createWorld, applyActions, population } from '../../src/sim/world';
import type { Genome } from '../../src/sim/types';

const g: Genome = { metabolism: 0.15, reproThreshold: 0.3, spread: 0.8, diet: 0.1, resilience: 0.5, mutationRate: 0.2 };

describe('Engine scheduling', () => {
  it('advances ticks based on elapsed time and speed', () => {
    const e = new Engine({ width: 8, height: 8, seed: 1 });
    e.setSpeed(10); // 1 tick per 100ms
    expect(e.world.tick).toBe(0);
    expect(e.advance(100)).toBe(1);
    expect(e.world.tick).toBe(1);
    expect(e.advance(250)).toBe(2); // 2 whole ticks, 50ms remainder carried
    expect(e.world.tick).toBe(3);
  });

  it('does nothing while paused, but stepOnce still ticks', () => {
    const e = new Engine({ width: 8, height: 8, seed: 1 });
    e.setPaused(true);
    expect(e.advance(1000)).toBe(0);
    expect(e.world.tick).toBe(0);
    e.stepOnce();
    expect(e.world.tick).toBe(1);
  });

  it('applies queued actions on the next tick', () => {
    const e = new Engine({ width: 8, height: 8, seed: 1 });
    e.enqueue({ type: 'seed', x: 4, y: 4, strainId: 1, genome: g });
    expect(population(e.world)).toBe(0); // not applied until a tick runs
    e.stepOnce();
    expect(population(e.world)).toBeGreaterThan(0);
  });

  it('setSpeed rejects non-positive speeds', () => {
    const e = new Engine({ width: 4, height: 4, seed: 1 });
    expect(() => e.setSpeed(0)).toThrow();
    expect(() => e.setSpeed(-5)).toThrow();
  });

  it('loadWorld swaps state and clears the queue', () => {
    const e = new Engine({ width: 8, height: 8, seed: 1 });
    e.enqueue({ type: 'seed', x: 0, y: 0, strainId: 1, genome: g });
    const fresh = createWorld(8, 8, 2);
    applyActions(fresh, [{ type: 'seed', x: 7, y: 7, strainId: 9, genome: g }]);
    e.loadWorld(fresh);
    expect(e.world.microbes[e.world.width * 7 + 7]).not.toBeNull();
    e.stepOnce(); // queued (0,0) seed must NOT apply — it was cleared
    expect(e.world.microbes[0]).toBeNull();
  });
});

describe('worldStats', () => {
  it('reports tick, population, and per-strain counts', () => {
    const w = createWorld(8, 8, 1);
    applyActions(w, [
      { type: 'seed', x: 1, y: 1, strainId: 1, genome: g },
      { type: 'seed', x: 2, y: 2, strainId: 1, genome: g },
      { type: 'seed', x: 3, y: 3, strainId: 7, genome: g },
    ]);
    const s = worldStats(w);
    expect(s.tick).toBe(0);
    expect(s.population).toBe(3);
    expect(s.perStrain[1]).toBe(2);
    expect(s.perStrain[7]).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/engine/engine.test.ts`
Expected: FAIL — cannot resolve `../../src/engine/engine`.

- [ ] **Step 3: Write the implementation** — create `src/engine/engine.ts`

```typescript
import type { WorldState, Action } from '../sim/types';
import { createWorld, population } from '../sim/world';
import { step } from '../sim/index';

const MAX_STEPS_PER_ADVANCE = 240;

export interface EngineOptions { width: number; height: number; seed: number; }
export interface WorldStats { tick: number; population: number; perStrain: Record<number, number>; }

export function worldStats(state: WorldState): WorldStats {
  const perStrain: Record<number, number> = {};
  for (const m of state.microbes) {
    if (m) perStrain[m.strainId] = (perStrain[m.strainId] ?? 0) + 1;
  }
  return { tick: state.tick, population: population(state), perStrain };
}

export class Engine {
  world: WorldState;
  paused = false;
  speed = 10;
  private queue: Action[] = [];
  private acc = 0;

  constructor(opts: EngineOptions) {
    this.world = createWorld(opts.width, opts.height, opts.seed);
  }

  enqueue(action: Action): void {
    this.queue.push(action);
  }

  enqueueMany(actions: Action[]): void {
    for (const a of actions) this.queue.push(a);
  }

  private runTick(): void {
    const actions = this.queue;
    this.queue = [];
    step(this.world, actions);
  }

  advance(dtMs: number): number {
    if (this.paused) return 0;
    this.acc += dtMs;
    const interval = 1000 / this.speed;
    let steps = 0;
    while (this.acc >= interval && steps < MAX_STEPS_PER_ADVANCE) {
      this.runTick();
      this.acc -= interval;
      steps++;
    }
    if (steps === MAX_STEPS_PER_ADVANCE) this.acc = 0;
    return steps;
  }

  stepOnce(): void {
    this.runTick();
  }

  setSpeed(ticksPerSecond: number): void {
    if (ticksPerSecond <= 0) throw new Error('speed must be > 0');
    this.speed = ticksPerSecond;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  loadWorld(world: WorldState): void {
    this.world = world;
    this.queue = [];
    this.acc = 0;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/engine/engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/engine.ts tests/engine/engine.test.ts
git commit -m "feat: add sandbox engine and world stats"
```

---

### Task 6: Persistence

**Files:**
- Create: `src/engine/persistence.ts`
- Create: `tests/engine/persistence.test.ts`

**Interfaces:**
- Consumes: `WorldState`/`Genome` types (`../sim/types`), `Camera` (`./camera`), `StrainInfo` (`./strains`).
- Produces: per the locked list. `serializeWorld`/`deserializeWorld` are exact round-trip inverses. `saveToSlot`/`loadFromSlot`/`listSlots` take an injectable `Storage` (default `localStorage`); keys are prefixed `bitcosm:save:`. `loadFromSlot` returns `null` on a missing key, JSON parse error, or `schemaVersion` mismatch.

- [ ] **Step 1: Write the failing test** — create `tests/engine/persistence.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { serializeWorld, deserializeWorld, saveToSlot, loadFromSlot, listSlots, SCHEMA_VERSION } from '../../src/engine/persistence';
import type { SaveData } from '../../src/engine/persistence';
import { createWorld, applyActions } from '../../src/sim/world';
import { createCamera } from '../../src/engine/camera';
import type { Genome } from '../../src/sim/types';

const g: Genome = { metabolism: 0.15, reproThreshold: 0.3, spread: 0.8, diet: 0.1, resilience: 0.5, mutationRate: 0.2 };

// minimal in-memory Storage for tests
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear() { map.clear(); },
    getItem(k) { return map.has(k) ? map.get(k)! : null; },
    key(i) { return [...map.keys()][i] ?? null; },
    removeItem(k) { map.delete(k); },
    setItem(k, v) { map.set(k, v); },
  } as Storage;
}

function sampleWorld() {
  const w = createWorld(6, 5, 123);
  applyActions(w, [
    { type: 'seed', x: 1, y: 1, strainId: 1, genome: g },
    { type: 'seed', x: 4, y: 3, strainId: 2, genome: { ...g, diet: 0.9 } },
    { type: 'dropFood', x: 2, y: 2, radius: 1, amount: 0.3 },
  ]);
  return w;
}

describe('serialize/deserialize world', () => {
  it('round-trips exactly', () => {
    const w = sampleWorld();
    const back = deserializeWorld(serializeWorld(w));
    expect(back).toEqual(w);
  });
});

describe('save/load slots', () => {
  const data = (): SaveData => ({
    schemaVersion: SCHEMA_VERSION,
    world: serializeWorld(sampleWorld()),
    camera: createCamera(3, 2, 8),
    strains: [{ id: 1, color: [10, 20, 30] }, { id: 2, color: [40, 50, 60] }],
    activeGenome: g,
  });

  it('saves and loads a slot', () => {
    const st = fakeStorage();
    saveToSlot('slotA', data(), st);
    const loaded = loadFromSlot('slotA', st);
    expect(loaded).toEqual(data());
  });

  it('lists saved slots', () => {
    const st = fakeStorage();
    saveToSlot('one', data(), st);
    saveToSlot('two', data(), st);
    expect(listSlots(st).sort()).toEqual(['one', 'two']);
  });

  it('returns null for missing, corrupt, or version-mismatched data', () => {
    const st = fakeStorage();
    expect(loadFromSlot('missing', st)).toBeNull();
    st.setItem('bitcosm:save:bad', '{not json');
    expect(loadFromSlot('bad', st)).toBeNull();
    st.setItem('bitcosm:save:old', JSON.stringify({ ...data(), schemaVersion: 0 }));
    expect(loadFromSlot('old', st)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/engine/persistence.test.ts`
Expected: FAIL — cannot resolve `../../src/engine/persistence`.

- [ ] **Step 3: Write the implementation** — create `src/engine/persistence.ts`

```typescript
import type { WorldState, Genome } from '../sim/types';
import type { Camera } from './camera';
import type { StrainInfo } from './strains';

export const SCHEMA_VERSION = 1;
const PREFIX = 'bitcosm:save:';

export type MicrobeTuple = [number, number, number, number, number, number, number, number, number];

export interface SerializedWorld {
  width: number;
  height: number;
  tick: number;
  rngState: number;
  food: number[];
  microbes: MicrobeTuple[];
}

export interface SaveData {
  schemaVersion: number;
  world: SerializedWorld;
  camera: Camera;
  strains: StrainInfo[];
  activeGenome: Genome;
}

export function serializeWorld(state: WorldState): SerializedWorld {
  const microbes: MicrobeTuple[] = [];
  for (let i = 0; i < state.microbes.length; i++) {
    const m = state.microbes[i];
    if (!m) continue;
    const g = m.genome;
    microbes.push([i, m.strainId, m.energy, g.metabolism, g.reproThreshold, g.spread, g.diet, g.resilience, g.mutationRate]);
  }
  return {
    width: state.width,
    height: state.height,
    tick: state.tick,
    rngState: state.rngState,
    food: Array.from(state.food),
    microbes,
  };
}

export function deserializeWorld(s: SerializedWorld): WorldState {
  const n = s.width * s.height;
  const microbes: WorldState['microbes'] = new Array(n).fill(null);
  for (const [i, strainId, energy, me, rt, sp, di, re, mu] of s.microbes) {
    microbes[i] = {
      strainId,
      energy,
      genome: { metabolism: me, reproThreshold: rt, spread: sp, diet: di, resilience: re, mutationRate: mu },
      actedTick: -1,
    };
  }
  return {
    width: s.width,
    height: s.height,
    tick: s.tick,
    rngState: s.rngState,
    food: new Float32Array(s.food),
    microbes,
  };
}

export function saveToSlot(slot: string, data: SaveData, storage: Storage = localStorage): void {
  storage.setItem(PREFIX + slot, JSON.stringify(data));
}

export function loadFromSlot(slot: string, storage: Storage = localStorage): SaveData | null {
  const raw = storage.getItem(PREFIX + slot);
  if (raw === null) return null;
  let parsed: SaveData;
  try {
    parsed = JSON.parse(raw) as SaveData;
  } catch {
    return null;
  }
  if (parsed.schemaVersion !== SCHEMA_VERSION) return null;
  return parsed;
}

export function listSlots(storage: Storage = localStorage): string[] {
  const slots: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.startsWith(PREFIX)) slots.push(key.slice(PREFIX.length));
  }
  return slots;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/engine/persistence.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/persistence.ts tests/engine/persistence.test.ts
git commit -m "feat: add localStorage persistence for sandbox sessions"
```

---

### Task 7: Pointer tools

**Files:**
- Create: `src/input/pointerTools.ts`
- Create: `tests/input/pointerTools.test.ts`

**Interfaces:**
- Consumes: `Action`/`Genome` types (`../sim/types`).
- Produces: `ToolId`, `ToolContext`, and `pointerToActions(ctx, wx, wy)` per the locked list. The world point is rounded to the nearest cell. `seed` emits one `seed` action per cell in the Chebyshev brush (size `2*brushRadius+1` square) for `activeStrainId` with `genome`, or `[]` if `activeStrainId` is null. `food`/`cull`/`mutate` each emit a single action at the rounded cell with `radius = brushRadius` (and `amount = foodAmount` for food).

- [ ] **Step 1: Write the failing test** — create `tests/input/pointerTools.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { pointerToActions } from '../../src/input/pointerTools';
import type { ToolContext } from '../../src/input/pointerTools';
import type { Genome } from '../../src/sim/types';

const g: Genome = { metabolism: 0.15, reproThreshold: 0.3, spread: 0.8, diet: 0.1, resilience: 0.5, mutationRate: 0.2 };
const base: Omit<ToolContext, 'tool'> = { brushRadius: 1, activeStrainId: 5, genome: g, foodAmount: 0.5 };

describe('pointerToActions', () => {
  it('seed emits one seed action per brush cell', () => {
    const acts = pointerToActions({ ...base, tool: 'seed' }, 10.4, 7.6);
    expect(acts).toHaveLength(9); // 3x3 brush
    expect(acts.every((a) => a.type === 'seed')).toBe(true);
    // includes the rounded centre (10, 8)
    expect(acts).toContainEqual({ type: 'seed', x: 10, y: 8, strainId: 5, genome: g });
  });

  it('seed with no active strain emits nothing', () => {
    const acts = pointerToActions({ ...base, tool: 'seed', activeStrainId: null }, 3, 3);
    expect(acts).toEqual([]);
  });

  it('food emits a single dropFood action', () => {
    expect(pointerToActions({ ...base, tool: 'food' }, 3.2, 4.7)).toEqual([
      { type: 'dropFood', x: 3, y: 5, radius: 1, amount: 0.5 },
    ]);
  });

  it('cull emits a single cull action', () => {
    expect(pointerToActions({ ...base, tool: 'cull', brushRadius: 2 }, 8, 8)).toEqual([
      { type: 'cull', x: 8, y: 8, radius: 2 },
    ]);
  });

  it('mutate emits a single mutate action', () => {
    expect(pointerToActions({ ...base, tool: 'mutate' }, 8, 8)).toEqual([
      { type: 'mutate', x: 8, y: 8, radius: 1 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/input/pointerTools.test.ts`
Expected: FAIL — cannot resolve `../../src/input/pointerTools`.

- [ ] **Step 3: Write the implementation** — create `src/input/pointerTools.ts`

```typescript
import type { Action, Genome } from '../sim/types';

export type ToolId = 'seed' | 'food' | 'cull' | 'mutate';

export interface ToolContext {
  tool: ToolId;
  brushRadius: number;
  activeStrainId: number | null;
  genome: Genome;
  foodAmount: number;
}

export function pointerToActions(ctx: ToolContext, wx: number, wy: number): Action[] {
  const x = Math.round(wx);
  const y = Math.round(wy);
  switch (ctx.tool) {
    case 'seed': {
      if (ctx.activeStrainId === null) return [];
      const acts: Action[] = [];
      const r = ctx.brushRadius;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          acts.push({ type: 'seed', x: x + dx, y: y + dy, strainId: ctx.activeStrainId, genome: ctx.genome });
        }
      }
      return acts;
    }
    case 'food':
      return [{ type: 'dropFood', x, y, radius: ctx.brushRadius, amount: ctx.foodAmount }];
    case 'cull':
      return [{ type: 'cull', x, y, radius: ctx.brushRadius }];
    case 'mutate':
      return [{ type: 'mutate', x, y, radius: ctx.brushRadius }];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/input/pointerTools.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/input/pointerTools.ts tests/input/pointerTools.test.ts
git commit -m "feat: add pointer tool to action mapping"
```

---

### Task 8: Color buffer fill

**Files:**
- Create: `src/render/colorBuffer.ts`
- Create: `tests/render/colorBuffer.test.ts`

**Interfaces:**
- Consumes: `WorldState` (`../sim/types`), `strainColor` (`../colors`).
- Produces: `fillColorBuffer(world, buf)` — fills a `Uint8Array` of length `width*height*4` with RGBA: empty cells are shaded green by food level (`r=10, g=30+food*120, b=20, a=255`), occupied cells use `strainColor(strainId)` at full alpha. This is the pure CPU half of the M1b WebGL renderer (the texture source), unit-testable without a GPU.

- [ ] **Step 1: Write the failing test** — create `tests/render/colorBuffer.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { fillColorBuffer } from '../../src/render/colorBuffer';
import { createWorld, idx, applyActions } from '../../src/sim/world';
import { strainColor } from '../../src/colors';
import type { Genome } from '../../src/sim/types';

const g: Genome = { metabolism: 0.15, reproThreshold: 0.3, spread: 0.8, diet: 0.1, resilience: 0.5, mutationRate: 0.2 };

describe('fillColorBuffer', () => {
  it('writes RGBA for every cell with alpha 255', () => {
    const w = createWorld(4, 3, 1);
    const buf = new Uint8Array(4 * 3 * 4);
    fillColorBuffer(w, buf);
    for (let i = 0; i < 12; i++) expect(buf[i * 4 + 3]).toBe(255);
  });

  it('colors an occupied cell by its strain', () => {
    const w = createWorld(4, 3, 1);
    applyActions(w, [{ type: 'seed', x: 2, y: 1, strainId: 7, genome: g }]);
    const buf = new Uint8Array(4 * 3 * 4);
    fillColorBuffer(w, buf);
    const o = idx(w, 2, 1) * 4;
    const [r, gg, b] = strainColor(7);
    expect([buf[o], buf[o + 1], buf[o + 2]]).toEqual([r, gg, b]);
  });

  it('shades empty cells green by food level', () => {
    const w = createWorld(2, 1, 1); // food starts at FOOD_MAX = 1.0
    const buf = new Uint8Array(2 * 1 * 4);
    fillColorBuffer(w, buf);
    expect(buf[0]).toBe(10);            // r
    expect(buf[1]).toBe(30 + 1 * 120);  // g at full food
    expect(buf[2]).toBe(20);            // b
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/render/colorBuffer.test.ts`
Expected: FAIL — cannot resolve `../../src/render/colorBuffer`.

- [ ] **Step 3: Write the implementation** — create `src/render/colorBuffer.ts`

```typescript
import type { WorldState } from '../sim/types';
import { strainColor } from '../colors';

export function fillColorBuffer(world: WorldState, buf: Uint8Array): void {
  const { width, height, food, microbes } = world;
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const m = microbes[i];
    let r: number, g: number, b: number;
    if (m) {
      [r, g, b] = strainColor(m.strainId);
    } else {
      const f = food[i];
      r = 10;
      g = Math.round(30 + f * 120);
      b = 20;
    }
    const o = i * 4;
    buf[o] = r;
    buf[o + 1] = g;
    buf[o + 2] = b;
    buf[o + 3] = 255;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all unit suites green (M0 26 + the new M1a tests).

- [ ] **Step 5: Commit**

```bash
git add src/render/colorBuffer.ts tests/render/colorBuffer.test.ts
git commit -m "feat: add pure color buffer fill for the renderer"
```

---

## Self-Review

**Spec coverage (M1a scope — the headless logic for the M1 spec):**
- New `cull` + `mutate` Sim Core actions (spec §3) → Task 1, deterministic, rng-threaded. ✅
- Pan/zoom camera + screen↔world mapping (spec §4) → Task 3. ✅
- Strain registry / colors / multiple strains (spec §5, §6) → Tasks 2, 4. ✅
- Engine: world ownership, tick scheduling (pause/play/step/speed), action queue, stats (spec §2, §7) → Task 5. ✅
- localStorage save/load with compact serialization + corrupt/version handling (spec §8, §9) → Task 6. ✅
- Pointer-tool → action mapping for all four tools (spec §5) → Task 7. ✅
- Per-cell color buffer (the CPU source for the M1b WebGL texture) (spec §4) → Task 8. ✅
- *Deferred to Plan M1b (correctly absent here):* the WebGL renderer GL code, Svelte HUD components/stores, app wiring, and the updated Playwright e2e (spec §2 HUD, §4 GL, §10 Playwright). The budget meter UI (spec §6) consumes the M0 `genomeCost`/`isWithinBudget` helpers in M1b.
- *Deferred to M2 (per spec):* Biomass economy, chunked/infinite world, server, accounts.

**Placeholder scan:** No TBD/TODO/"handle edge cases". Every code step contains complete code; every test step contains real assertions.

**Type consistency:** `Action` (with the two new variants), `Camera`, `StrainInfo`, `WorldStats`, `SaveData`, `SerializedWorld`/`MicrobeTuple`, `ToolId`/`ToolContext` are each defined once in the Locked Interfaces and used verbatim across tasks. `pointerToActions` emits exactly the `Action` shapes `applyActions` consumes (Task 1 ↔ Task 7). `serializeWorld`/`deserializeWorld` mirror the `WorldState` shape from M0 and the genome field order is identical in the tuple, `deserializeWorld`, and `serializeWorld`. `Engine` consumes `step` (`{state,events}`) and `createWorld`/`population` with the signatures M0 exports. `fillColorBuffer` and `strainColor` agree on the `[r,g,b]` tuple type.
