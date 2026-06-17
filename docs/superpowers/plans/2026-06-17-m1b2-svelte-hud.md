# M1b-2 — Svelte HUD + Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the passive M1b-1 WebGL viewer into the interactive single-player sandbox: a Svelte HUD (toolbar, point-buy genome designer, sim controls, save/load, stats) wired to the existing engine, with god-mode tools applied by clicking the world.

**Architecture:** A framework-agnostic `AppController` owns the `Engine`, `Camera`, `StrainRegistry`, and `GlRenderer`, runs the rAF loop, and routes pointer input. Thin Svelte stores (`src/ui/stores.ts`) hold only UI-relevant state (active tool, brush, genome + derived budget, sim status, stats, strain list, save slots). Svelte components read/write those stores and call controller methods through callback props; the WebGL canvas renders straight from engine state every frame and is never put in a reactive store. This preserves M0's seam: Sim Core stays pure, the Engine drives it, Svelte only paints the HUD.

**Tech Stack:** TypeScript 5 (strict), Vite 5, **Svelte 4** (+ `@sveltejs/vite-plugin-svelte` v3, `svelte-check`), Vitest 2, Playwright.

## Global Constraints

- **Sim Core purity stands:** nothing under `src/sim/` may be edited. The HUD, controller, and components reach the simulation only through the M1a engine + persistence APIs and the Sim Core public exports. Never re-implement sim, coloring, or genome-cost logic — reuse `genomeCost`/`isWithinBudget`/`POINT_BUDGET` from `src/sim/genome.ts` and `fillColorBuffer` from `src/render/colorBuffer.ts`.
- **WorldState never enters a reactive store.** It mutates every tick over 65k cells; only lightweight derived views (tick, population, per-strain counts) are pushed into stores, and only occasionally (not every frame).
- **Determinism of the sim stands.** Time enters the shell only via the rAF timestamp passed to `engine.advance(dtMs)`. No `Math.random()` / `Date.now()` in app code. `setInterval` for autosave is allowed (it is shell I/O, not sim).
- **Strict TypeScript.** `npx tsc --noEmit` clean for `.ts`; `npx svelte-check` clean for `.svelte`.
- **Pinned toolchain versions (verbatim):** `svelte@^4.2.19`, `@sveltejs/vite-plugin-svelte@^3.1.2`, `svelte-check@^3.8.6`.
- **Point budget:** `POINT_BUDGET = 3.0`. Seeding is disabled while the active genome is over budget; the budget meter turns red.
- **Input model:** active tool decides left-drag — `pan` tool pans, action tools (`seed`/`food`/`cull`/`mutate`) apply on press and paint continuously while dragging. **Middle-mouse (button 1) always pans; wheel always zooms**, regardless of tool.
- **Save slots:** three named manual slots `slot-1`, `slot-2`, `slot-3`, plus one `autosave` slot written every 10s. Autosave writes only the `autosave` slot.
- **Speed steps:** `1, 2, 5, 10, 20, 60` ticks/second. **Brush radius:** integer slider `0..6`, default `3`. **World:** 256×256, seed `1337`, five deterministic founder strains on boot.
- **No Co-Authored-By trailer on commits.**

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `vite.config.ts` | create | Vite config registering the Svelte plugin. |
| `svelte.config.js` | create | Svelte preprocess config (`vitePreprocess`). |
| `src/svelte-shims.d.ts` | create | Ambient `*.svelte` module declaration so `tsc` resolves component imports. |
| `package.json` | modify | Add Svelte deps + `check` script. |
| `tsconfig.json` | modify | (only if needed) keep `.svelte` out of `tsc` emit; no functional change expected. |
| `index.html` | modify | `#stage` wrapper holding `#world` canvas + `#hud` Svelte root. |
| `src/ui/stores.ts` | create | Writable + derived UI stores (tool, brush, genome, budget, sim status, stats, strains, slots, notice). |
| `src/input/pointerRouter.ts` | create | Pure `gestureFor(button, tool)` → `'pan' \| 'tool' \| 'none'`. |
| `src/engine/session.ts` | create | `captureSession` / `restoreSession` assembling/disassembling `SaveData`. |
| `src/engine/strains.ts` | modify | Add `restore(strains, activeId)` to rebuild the registry on load. |
| `src/ui/controller.ts` | create | `AppController`: owns engine/camera/strains/renderer, rAF loop, input routing, store sync, save/load/autosave, tool application. |
| `src/main.ts` | modify | Construct controller, mount `App.svelte` into `#hud`, wire callbacks. |
| `src/ui/App.svelte` | create | HUD layout composing the panels; grows across Tasks 4–7. |
| `src/ui/Toolbar.svelte` | create | Tool buttons, brush slider, New-strain, active-strain swatch. |
| `src/ui/GenomeDesigner.svelte` | create | Six trait sliders + live budget meter. |
| `src/ui/SimControls.svelte` | create | Pause/play, step, speed select. |
| `src/ui/StatsPanel.svelte` | create | Tick, population, per-strain legend. |
| `src/ui/SaveLoadPanel.svelte` | create | Named slots + autosave save/load buttons, notice. |
| `tests/ui/stores.test.ts` | create | Unit tests for derived budget logic. |
| `tests/input/pointerRouter.test.ts` | create | Unit tests for gesture routing. |
| `tests/engine/session.test.ts` | create | Save→load round-trip + `StrainRegistry.restore`. |
| `tests/e2e/hud.spec.ts` | create | Component smoke (Task 4) → grows into HUD interaction tests. |
| `tests/e2e/sandbox.spec.ts` | create | Final acceptance flow (Task 8). |
| `CLAUDE.md` | modify | Bump status to M1 complete; viewer → sandbox (Task 8). |

The M1b-1 `tests/e2e/render.spec.ts` (boot + WebGL pixels) stays and must remain green throughout — it is the regression guard that the canvas keeps rendering as the HUD lands.

---

### Task 1: Svelte toolchain + mounted HUD root

**Files:**
- Create: `vite.config.ts`, `svelte.config.js`, `src/svelte-shims.d.ts`, `src/ui/App.svelte`
- Modify: `package.json`, `index.html`, `src/main.ts`

**Interfaces:**
- Produces: a mounted minimal `App.svelte` in `#hud`; the `npm run check` script (`svelte-check`); the project builds with Svelte. Later tasks add components to `App.svelte` and stores/controller behind it.

- [ ] **Step 1: Install Svelte toolchain**

Run:
```bash
npm install -D svelte@^4.2.19 @sveltejs/vite-plugin-svelte@^3.1.2 svelte-check@^3.8.6
```
Expected: packages added to `devDependencies`; `package-lock.json` updated.

- [ ] **Step 2: Add the `check` script to `package.json`**

Edit the `"scripts"` block to read:
```json
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "check": "svelte-check --tsconfig ./tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
});
```

- [ ] **Step 4: Create `svelte.config.js`**

```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
};
```

- [ ] **Step 5: Create `src/svelte-shims.d.ts`**

```ts
declare module '*.svelte' {
  import type { ComponentType } from 'svelte';
  const component: ComponentType;
  export default component;
}
```

- [ ] **Step 6: Create the minimal `src/ui/App.svelte`**

```svelte
<script lang="ts">
  // Minimal HUD root. Panels are added in later tasks.
</script>

<div class="hud" data-hud>
  <div class="title">Bitcosm — sandbox</div>
</div>

<style>
  .hud {
    position: absolute;
    inset: 0;
    pointer-events: none;
    font-family: monospace;
    color: #cfe;
  }
  .title {
    position: absolute;
    top: 8px;
    left: 8px;
    pointer-events: auto;
    font-size: 13px;
    opacity: 0.8;
  }
</style>
```

- [ ] **Step 7: Update `index.html` to host the canvas + HUD root**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bitcosm — sandbox</title>
    <style>
      html, body { margin: 0; height: 100%; background: #0b0f0c; color: #cfe; font-family: monospace; }
      #wrap { display: flex; justify-content: center; padding: 12px; }
      #stage { position: relative; width: 800px; height: 600px; }
      #world { position: absolute; inset: 0; width: 800px; height: 600px; image-rendering: pixelated; border: 1px solid #243; touch-action: none; }
      #hud { position: absolute; inset: 0; }
      #notice { display: none; }
    </style>
  </head>
  <body>
    <div id="wrap">
      <div id="stage">
        <canvas id="world"></canvas>
        <div id="hud"></div>
        <div id="notice"></div>
      </div>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 7b: Mount `App.svelte` from `src/main.ts`**

In `src/main.ts`, add the import at the top (after the existing imports):
```ts
import App from './ui/App.svelte';
```
and, immediately after the `window.__bitcosm = ...` assignment (before the rAF loop), mount the HUD:
```ts
new App({ target: document.getElementById('hud') as HTMLElement });
```
Leave the rest of `src/main.ts` (engine, founders, pan/zoom, render loop) unchanged — Task 4 refactors it.

- [ ] **Step 8: Type-check, build-check, and verify the render e2e still passes**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run check`
Expected: `svelte-check` finds 0 errors.

Run: `npm run e2e`
Expected: PASS — `render.spec.ts` still boots the app and reads colored WebGL pixels (the HUD overlay does not block rendering).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vite.config.ts svelte.config.js src/svelte-shims.d.ts src/ui/App.svelte index.html src/main.ts
git commit -m "feat: add Svelte toolchain and mount minimal HUD root"
```

---

### Task 2: UI stores

**Files:**
- Create: `src/ui/stores.ts`, `tests/ui/stores.test.ts`

**Interfaces:**
- Consumes: `Genome` (`src/sim/types.ts`); `ToolId` (`src/input/pointerTools.ts`); `genomeCost`, `isWithinBudget`, `POINT_BUDGET` (`src/sim/genome.ts`).
- Produces:
  - `type UiTool = 'pan' | ToolId`
  - writables: `tool: Writable<UiTool>`, `brushRadius: Writable<number>`, `foodAmount: Writable<number>`, `genome: Writable<Genome>`, `paused: Writable<boolean>`, `speed: Writable<number>`, `stats: Writable<StatsView>`, `strains: Writable<StrainView[]>`, `activeStrainId: Writable<number | null>`, `slots: Writable<string[]>`, `notice: Writable<string>`
  - deriveds: `budgetCost: Readable<number>`, `overBudget: Readable<boolean>`; const `BUDGET = POINT_BUDGET`
  - interfaces: `StatsView { tick: number; population: number; perStrain: Record<number, number> }`, `StrainView { id: number; color: [number, number, number] }`
  - `DEFAULT_GENOME: Genome` — the founder genome used at boot and as the designer's starting point.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/ui/stores.test.ts
import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { genome, budgetCost, overBudget, BUDGET, DEFAULT_GENOME } from '../../src/ui/stores';

describe('UI stores: budget', () => {
  it('exposes the point budget of 3.0', () => {
    expect(BUDGET).toBeCloseTo(3.0, 5);
  });

  it('the default genome is within budget', () => {
    genome.set(DEFAULT_GENOME);
    // cost = spread + diet + resilience + (1-metabolism) + (1-reproThreshold)
    expect(get(budgetCost)).toBeLessThanOrEqual(BUDGET);
    expect(get(overBudget)).toBe(false);
  });

  it('flags an over-budget genome (all beneficial traits maxed)', () => {
    genome.set({ metabolism: 0, reproThreshold: 0, spread: 1, diet: 1, resilience: 1, mutationRate: 0 });
    expect(get(budgetCost)).toBeCloseTo(5, 5); // 1+1+1+1+1
    expect(get(overBudget)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ui/stores.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/ui/stores"`.

- [ ] **Step 3: Write the implementation**

```ts
// src/ui/stores.ts
import { writable, derived, type Writable, type Readable } from 'svelte/store';
import type { Genome } from '../sim/types';
import type { ToolId } from '../input/pointerTools';
import { genomeCost, isWithinBudget, POINT_BUDGET } from '../sim/genome';

export type UiTool = 'pan' | ToolId;

export interface StatsView {
  tick: number;
  population: number;
  perStrain: Record<number, number>;
}

export interface StrainView {
  id: number;
  color: [number, number, number];
}

export const DEFAULT_GENOME: Genome = {
  metabolism: 0.15,
  reproThreshold: 0.3,
  spread: 0.8,
  diet: 0.1,
  resilience: 0.5,
  mutationRate: 0.5,
};

export const BUDGET = POINT_BUDGET;

export const tool: Writable<UiTool> = writable('pan');
export const brushRadius: Writable<number> = writable(3);
export const foodAmount: Writable<number> = writable(0.5);
export const genome: Writable<Genome> = writable({ ...DEFAULT_GENOME });

export const budgetCost: Readable<number> = derived(genome, (g) => genomeCost(g));
export const overBudget: Readable<boolean> = derived(genome, (g) => !isWithinBudget(g));

export const paused: Writable<boolean> = writable(false);
export const speed: Writable<number> = writable(10);

export const stats: Writable<StatsView> = writable({ tick: 0, population: 0, perStrain: {} });
export const strains: Writable<StrainView[]> = writable([]);
export const activeStrainId: Writable<number | null> = writable(null);

export const slots: Writable<string[]> = writable([]);
export const notice: Writable<string> = writable('');
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/ui/stores.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Run the full unit suite and type-check**

Run: `npm test`
Expected: all prior unit tests + the 3 new ones pass.

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/ui/stores.ts tests/ui/stores.test.ts
git commit -m "feat: add UI stores with derived genome budget"
```

---

### Task 3: Session round-trip (save/load glue + strain restore)

**Files:**
- Create: `src/engine/session.ts`, `tests/engine/session.test.ts`
- Modify: `src/engine/strains.ts`

**Interfaces:**
- Consumes: `serializeWorld`, `deserializeWorld`, `SCHEMA_VERSION`, `SaveData`, `SerializedWorld` (`src/engine/persistence.ts`); `WorldState`, `Genome` (`src/sim/types.ts`); `Camera` (`src/engine/camera.ts`); `StrainInfo` (`src/engine/strains.ts`).
- Produces:
  - `captureSession(world: WorldState, camera: Camera, strains: StrainInfo[], genome: Genome): SaveData`
  - `restoreSession(data: SaveData): { world: WorldState; camera: Camera; strains: StrainInfo[]; genome: Genome }`
  - `StrainRegistry.restore(strains: StrainInfo[], activeId: number | null): void` — replaces the registry's strain list and active strain (used on load).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/engine/session.test.ts
import { describe, it, expect } from 'vitest';
import { createWorld, applyActions } from '../../src/sim/world';
import { createCamera } from '../../src/engine/camera';
import { StrainRegistry } from '../../src/engine/strains';
import { saveToSlot, loadFromSlot } from '../../src/engine/persistence';
import { captureSession, restoreSession } from '../../src/engine/session';
import type { Genome } from '../../src/sim/types';

// Minimal in-memory Storage for deterministic, isolated tests.
function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => { m.delete(k); },
    setItem: (k, v) => { m.set(k, v); },
  } as Storage;
}

const g: Genome = { metabolism: 0.2, reproThreshold: 0.4, spread: 0.6, diet: 0.3, resilience: 0.5, mutationRate: 0.7 };

describe('session round-trip', () => {
  it('captures and restores world, camera, strains, and genome through a slot', () => {
    const world = createWorld(8, 8, 999);
    applyActions(world, [{ type: 'seed', x: 2, y: 2, strainId: 1, genome: g }]);
    const camera = createCamera(4, 4, 12);
    const strains = [{ id: 1, color: [10, 20, 30] as [number, number, number] }];

    const storage = memStorage();
    saveToSlot('slot-1', captureSession(world, camera, strains, g), storage);
    const data = loadFromSlot('slot-1', storage);
    expect(data).not.toBeNull();

    const r = restoreSession(data!);
    expect(r.world.width).toBe(8);
    expect(r.world.tick).toBe(world.tick);
    expect(r.world.microbes[2 * 8 + 2]?.strainId).toBe(1);
    expect(r.camera).toEqual(camera);
    expect(r.strains).toEqual(strains);
    expect(r.genome).toEqual(g);
  });
});

describe('StrainRegistry.restore', () => {
  it('rebuilds the strain list and continues id assignment', () => {
    const reg = new StrainRegistry();
    reg.restore(
      [{ id: 1, color: [1, 2, 3] }, { id: 2, color: [4, 5, 6] }],
      2,
    );
    expect(reg.all().map((s) => s.id)).toEqual([1, 2]);
    expect(reg.active?.id).toBe(2);
    const next = reg.create();
    expect(next.id).toBe(3); // continues after the restored ids
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/session.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/engine/session"` and `reg.restore is not a function`.

- [ ] **Step 3: Add `restore` to `StrainRegistry`**

In `src/engine/strains.ts`, add this method to the `StrainRegistry` class (after `all()`):
```ts
  restore(strains: StrainInfo[], activeId: number | null): void {
    this.strains = strains.map((s) => ({ id: s.id, color: s.color }));
    this.active = activeId === null ? null : (this.get(activeId) ?? null);
  }
```
(`this.strains` is the existing private field; ids remain contiguous from `create()`, so the next `create()` uses `this.strains.length + 1`.)

- [ ] **Step 4: Write `src/engine/session.ts`**

```ts
import type { WorldState, Genome } from '../sim/types';
import type { Camera } from './camera';
import type { StrainInfo } from './strains';
import { serializeWorld, deserializeWorld, SCHEMA_VERSION, type SaveData } from './persistence';

export function captureSession(
  world: WorldState,
  camera: Camera,
  strains: StrainInfo[],
  genome: Genome,
): SaveData {
  return {
    schemaVersion: SCHEMA_VERSION,
    world: serializeWorld(world),
    camera,
    strains,
    activeGenome: genome,
  };
}

export interface RestoredSession {
  world: WorldState;
  camera: Camera;
  strains: StrainInfo[];
  genome: Genome;
}

export function restoreSession(data: SaveData): RestoredSession {
  return {
    world: deserializeWorld(data.world),
    camera: data.camera,
    strains: data.strains,
    genome: data.activeGenome,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/engine/session.test.ts`
Expected: PASS (2 passed).

- [ ] **Step 6: Run the full unit suite and type-check**

Run: `npm test`
Expected: all green.

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/engine/session.ts src/engine/strains.ts tests/engine/session.test.ts
git commit -m "feat: add session capture/restore and strain registry restore"
```

---

### Task 4: Pointer router + AppController + main.ts refactor

**Files:**
- Create: `src/input/pointerRouter.ts`, `tests/input/pointerRouter.test.ts`, `src/ui/controller.ts`, `tests/e2e/hud.spec.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes (router): `UiTool` (`src/ui/stores.ts`).
- Consumes (controller): `Engine`, `worldStats` (`src/engine/engine.ts`); `StrainRegistry` (`src/engine/strains.ts`); camera functions + `Camera` (`src/engine/camera.ts`); `pointerToActions`, `ToolContext` (`src/input/pointerTools.ts`); `fillColorBuffer` (`src/render/colorBuffer.ts`); `GlRenderer` (`src/render/glRenderer.ts`); the stores (`src/ui/stores.ts`); `captureSession`, `restoreSession` (`src/engine/session.ts`); `saveToSlot`, `loadFromSlot`, `listSlots` (`src/engine/persistence.ts`).
- Produces:
  - `type Gesture = 'pan' | 'tool' | 'none'`; `gestureFor(button: number, tool: UiTool): Gesture`
  - `class AppController` with `start()`, `newStrain()`, `step()`, `save(slot: string)`, `load(slot: string)`, and getter `world` (for tests). It mirrors engine state into the stores and drives the engine from the stores. Mounted by `main.ts`; methods are passed to components as callbacks in Tasks 5–7.

- [ ] **Step 1: Write the failing router test**

```ts
// tests/input/pointerRouter.test.ts
import { describe, it, expect } from 'vitest';
import { gestureFor } from '../../src/input/pointerRouter';

describe('gestureFor', () => {
  it('middle mouse (button 1) always pans, even with an action tool', () => {
    expect(gestureFor(1, 'seed')).toBe('pan');
    expect(gestureFor(1, 'pan')).toBe('pan');
  });

  it('left mouse (button 0) pans with the pan tool', () => {
    expect(gestureFor(0, 'pan')).toBe('pan');
  });

  it('left mouse with an action tool applies the tool', () => {
    expect(gestureFor(0, 'seed')).toBe('tool');
    expect(gestureFor(0, 'food')).toBe('tool');
    expect(gestureFor(0, 'cull')).toBe('tool');
    expect(gestureFor(0, 'mutate')).toBe('tool');
  });

  it('other buttons do nothing', () => {
    expect(gestureFor(2, 'seed')).toBe('none');
  });
});
```

- [ ] **Step 2: Run the router test to verify it fails**

Run: `npx vitest run tests/input/pointerRouter.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/input/pointerRouter"`.

- [ ] **Step 3: Write `src/input/pointerRouter.ts`**

```ts
import type { UiTool } from '../ui/stores';

export type Gesture = 'pan' | 'tool' | 'none';

// Decide what a pointer press means, given the mouse button and active tool.
// Middle mouse (1) always pans; left mouse (0) pans only with the pan tool,
// otherwise applies the active action tool.
export function gestureFor(button: number, tool: UiTool): Gesture {
  if (button === 1) return 'pan';
  if (button === 0) return tool === 'pan' ? 'pan' : 'tool';
  return 'none';
}
```

- [ ] **Step 4: Run the router test to verify it passes**

Run: `npx vitest run tests/input/pointerRouter.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: Write `src/ui/controller.ts`**

```ts
import { get } from 'svelte/store';
import { Engine, worldStats } from '../engine/engine';
import { StrainRegistry } from '../engine/strains';
import {
  createCamera, panCamera, zoomCameraAt, clampCamera, screenToWorld, type Camera,
} from '../engine/camera';
import { pointerToActions, type ToolContext } from '../input/pointerTools';
import { fillColorBuffer } from '../render/colorBuffer';
import { GlRenderer } from '../render/glRenderer';
import { gestureFor, type Gesture } from '../input/pointerRouter';
import { captureSession, restoreSession } from '../engine/session';
import { saveToSlot, loadFromSlot, listSlots } from '../engine/persistence';
import {
  tool, brushRadius, foodAmount, genome, paused, speed,
  stats, strains, activeStrainId, slots, notice,
  DEFAULT_GENOME, type StrainView,
} from './stores';

const WORLD_W = 256;
const WORLD_H = 256;
const SEED = 1337;
const MIN_ZOOM = 1;
const MAX_ZOOM = 64;
const AUTOSAVE_MS = 10_000;
const STATS_EVERY = 6; // push stats to the store every N frames

export class AppController {
  private engine: Engine;
  private camera: Camera;
  private registry = new StrainRegistry();
  private renderer: GlRenderer;
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private colorBuf: Uint8Array;
  private gesture: Gesture = 'none';
  private lastX = 0;
  private lastY = 0;
  private frameCount = 0;
  private lastTs = 0;

  constructor(canvas: HTMLCanvasElement, gl: WebGLRenderingContext) {
    this.canvas = canvas;
    this.gl = gl;
    this.engine = new Engine({ width: WORLD_W, height: WORLD_H, seed: SEED });
    this.colorBuf = new Uint8Array(WORLD_W * WORLD_H * 4);
    this.renderer = new GlRenderer(gl, WORLD_W, WORLD_H);
    this.camera = createCamera(
      WORLD_W / 2, WORLD_H / 2,
      Math.min(canvas.width / WORLD_W, canvas.height / WORLD_H),
    );

    // Boot with five deterministic founder strains so the world has life.
    for (let s = 0; s < 5; s++) {
      const info = this.registry.create();
      const cx = 40 + s * 45;
      const cy = 128;
      this.engine.enqueueMany(
        pointerToActions(
          { tool: 'seed', brushRadius: 3, activeStrainId: info.id, genome: DEFAULT_GENOME, foodAmount: 0 },
          cx, cy,
        ),
      );
    }
    this.engine.stepOnce();
    this.syncStrains();
    this.pushStats();

    // Drive the engine from the sim-control stores.
    paused.subscribe((p) => this.engine.setPaused(p));
    speed.subscribe((sp) => { if (sp > 0) this.engine.setSpeed(sp); });

    this.attachInput();
    this.refreshSlots();
    setInterval(() => this.save('autosave'), AUTOSAVE_MS);
  }

  get world() { return this.engine.world; }

  private syncStrains(): void {
    const list: StrainView[] = this.registry.all().map((s) => ({ id: s.id, color: s.color }));
    strains.set(list);
    activeStrainId.set(this.registry.active ? this.registry.active.id : null);
  }

  private pushStats(): void {
    stats.set(worldStats(this.engine.world));
  }

  private refreshSlots(): void {
    slots.set(listSlots());
  }

  newStrain(): number {
    const info = this.registry.create();
    this.syncStrains();
    return info.id;
  }

  step(): void {
    this.engine.stepOnce();
    this.pushStats();
  }

  save(slot: string): void {
    const data = captureSession(this.engine.world, this.camera, this.registry.all(), get(genome));
    saveToSlot(slot, data);
    this.refreshSlots();
    notice.set(`Saved ${slot}`);
  }

  load(slot: string): void {
    const data = loadFromSlot(slot);
    if (!data) { notice.set(`No valid save in ${slot}`); return; }
    const r = restoreSession(data);
    this.engine.loadWorld(r.world);
    this.camera = r.camera;
    this.registry.restore(r.strains, r.strains.length ? r.strains[r.strains.length - 1].id : null);
    genome.set(r.genome);
    this.syncStrains();
    this.pushStats();
    notice.set(`Loaded ${slot}`);
  }

  private worldCell(e: PointerEvent): { wx: number; wy: number } {
    const rect = this.canvas.getBoundingClientRect();
    return screenToWorld(this.camera, e.clientX - rect.left, e.clientY - rect.top, this.canvas.width, this.canvas.height);
  }

  private applyToolAt(e: PointerEvent): void {
    const t = get(tool);
    if (t === 'pan') return;
    if (t === 'seed' && get(activeStrainId) === null) { notice.set('Pick or create a strain first'); return; }
    if (t === 'seed' && get(overBudgetValue())) { notice.set('Genome over budget'); return; }
    const ctx: ToolContext = {
      tool: t,
      brushRadius: get(brushRadius),
      activeStrainId: get(activeStrainId),
      genome: get(genome),
      foodAmount: get(foodAmount),
    };
    const { wx, wy } = this.worldCell(e);
    this.engine.enqueueMany(pointerToActions(ctx, wx, wy));
  }

  private attachInput(): void {
    this.canvas.addEventListener('pointerdown', (e) => {
      this.gesture = gestureFor(e.button, get(tool));
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      if (this.gesture === 'none') return;
      this.canvas.setPointerCapture(e.pointerId);
      if (this.gesture === 'tool') this.applyToolAt(e);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.gesture === 'pan') {
        this.camera = clampCamera(
          panCamera(this.camera, e.clientX - this.lastX, e.clientY - this.lastY),
          WORLD_W, WORLD_H, MIN_ZOOM, MAX_ZOOM,
        );
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      } else if (this.gesture === 'tool') {
        this.applyToolAt(e); // paint continuously while dragging
      }
    });
    const end = (e: PointerEvent) => {
      this.gesture = 'none';
      if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      this.camera = clampCamera(
        zoomCameraAt(this.camera, factor, e.clientX - rect.left, e.clientY - rect.top, this.canvas.width, this.canvas.height),
        WORLD_W, WORLD_H, MIN_ZOOM, MAX_ZOOM,
      );
    }, { passive: false });
  }

  start(): void {
    const loop = (ts: number) => {
      const dt = this.lastTs ? ts - this.lastTs : 0;
      this.lastTs = ts;
      this.engine.advance(dt);
      fillColorBuffer(this.engine.world, this.colorBuf);
      this.renderer.render(this.colorBuf, this.camera);
      if (++this.frameCount % STATS_EVERY === 0) this.pushStats();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

// Local helper to read the over-budget derived store without importing it at
// module top-level alongside the writables (keeps the import list grouped).
import { overBudget } from './stores';
function overBudgetValue() { return overBudget; }
```

> Implementer note: the trailing `overBudgetValue()` indirection is only to keep the over-budget read inline; if you prefer, import `overBudget` with the other store imports at the top and call `get(overBudget)` directly in `applyToolAt`. Either is fine as long as `tsc`/`svelte-check` stay clean and the over-budget seed guard works.

- [ ] **Step 6: Refactor `src/main.ts` to use the controller**

Replace the entire contents of `src/main.ts` with:
```ts
import { AppController } from './ui/controller';
import App from './ui/App.svelte';

const canvas = document.getElementById('world') as HTMLCanvasElement;
const notice = document.getElementById('notice') as HTMLElement;
const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: true });

if (!gl) {
  notice.textContent = 'WebGL is unavailable in this browser — the world cannot be rendered.';
  notice.style.display = 'block';
  throw new Error('WebGL unavailable');
}

// Match the drawing buffer to the displayed CSS size.
function resize(): void {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}
resize();
window.addEventListener('resize', resize);

const controller = new AppController(canvas, gl);
controller.start();

const app = new App({
  target: document.getElementById('hud') as HTMLElement,
  props: {
    onNewStrain: () => controller.newStrain(),
    onStep: () => controller.step(),
    onSave: (slot: string) => controller.save(slot),
    onLoad: (slot: string) => controller.load(slot),
  },
});

declare global {
  interface Window {
    __bitcosm: { controller: AppController; stats: () => ReturnType<typeof import('./engine/engine').worldStats> };
  }
}
import { worldStats } from './engine/engine';
window.__bitcosm = { controller, stats: () => worldStats(controller.world) };

export { app };
```

- [ ] **Step 7: Update `src/ui/App.svelte` to accept (currently unused) callback props**

```svelte
<script lang="ts">
  export let onNewStrain: () => void = () => {};
  export let onStep: () => void = () => {};
  export let onSave: (slot: string) => void = () => {};
  export let onLoad: (slot: string) => void = () => {};
  // Panels that use these props are added in Tasks 5–7.
  void onNewStrain; void onStep; void onSave; void onLoad;
</script>

<div class="hud" data-hud>
  <div class="title">Bitcosm — sandbox</div>
</div>

<style>
  .hud { position: absolute; inset: 0; pointer-events: none; font-family: monospace; color: #cfe; }
  .title { position: absolute; top: 8px; left: 8px; pointer-events: auto; font-size: 13px; opacity: 0.8; }
</style>
```

- [ ] **Step 8: Write the failing controller smoke e2e**

```ts
// tests/e2e/hud.spec.ts
import { test, expect } from '@playwright/test';

test('controller boots, exposes stats, and the world evolves', async ({ page }) => {
  await page.goto('/');

  await page.waitForFunction(() => {
    const w = window as unknown as { __bitcosm?: { stats: () => { population: number } } };
    return !!w.__bitcosm && w.__bitcosm.stats().population > 0;
  }, { timeout: 10_000 });

  await page.waitForFunction(() => {
    const w = window as unknown as { __bitcosm: { stats: () => { tick: number } } };
    return w.__bitcosm.stats().tick > 30;
  }, { timeout: 10_000 });

  // The HUD root is mounted.
  await expect(page.locator('[data-hud]')).toBeVisible();

  // Controller methods work: a new strain gets a fresh id.
  const newId = await page.evaluate(() => {
    const w = window as unknown as { __bitcosm: { controller: { newStrain: () => number } } };
    return w.__bitcosm.controller.newStrain();
  });
  expect(newId).toBeGreaterThan(5); // 5 founders already exist
});
```

- [ ] **Step 9: Type-check, build-check, and run the e2e**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run check`
Expected: 0 errors.

Run: `npm run e2e`
Expected: PASS — both `render.spec.ts` (regression) and `hud.spec.ts` pass. Pan still works (left-drag with default pan tool), the world renders, stats flow.

- [ ] **Step 10: Run the full unit suite**

Run: `npm test`
Expected: all green (router test included).

- [ ] **Step 11: Commit**

```bash
git add src/input/pointerRouter.ts tests/input/pointerRouter.test.ts src/ui/controller.ts src/main.ts src/ui/App.svelte tests/e2e/hud.spec.ts
git commit -m "feat: add app controller and pointer router driving the engine from stores"
```

---

### Task 5: Toolbar + Genome designer

**Files:**
- Create: `src/ui/Toolbar.svelte`, `src/ui/GenomeDesigner.svelte`
- Modify: `src/ui/App.svelte`, `tests/e2e/hud.spec.ts`

**Interfaces:**
- Consumes: stores `tool`, `brushRadius`, `genome`, `budgetCost`, `overBudget`, `BUDGET`, `strains`, `activeStrainId`, `UiTool` (`src/ui/stores.ts`); the `onNewStrain` callback prop from `App`.
- Produces: a toolbar (tool select, brush slider, New-strain button, active-strain swatch) and a genome designer (six sliders + budget meter). Selecting a tool sets the `tool` store; the controller's pointer handler reads it.

- [ ] **Step 1: Write the failing e2e additions (seed-and-grow + over-budget guard)**

Append these tests to `tests/e2e/hud.spec.ts`:
```ts
test('seeding a new strain by clicking the canvas grows its population', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => {
    const w = window as unknown as { __bitcosm?: { stats: () => { population: number } } };
    return !!w.__bitcosm && w.__bitcosm.stats().population > 0;
  }, { timeout: 10_000 });

  // Create a fresh strain and select the Seed tool.
  await page.locator('[data-action="new-strain"]').click();
  await page.locator('[data-tool="seed"]').click();
  const newId = await page.locator('[data-active-strain]').getAttribute('data-active-strain');
  expect(newId).not.toBeNull();
  const id = Number(newId);

  // Click the centre of the canvas to seed a blob of the new strain.
  const canvas = page.locator('#world');
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  // The new strain now has members and they grow over the next ticks.
  await page.waitForFunction((sid) => {
    const w = window as unknown as { __bitcosm: { stats: () => { perStrain: Record<number, number> } } };
    return (w.__bitcosm.stats().perStrain[sid] ?? 0) > 0;
  }, id, { timeout: 10_000 });
});

test('an over-budget genome turns the budget meter red', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-budget]');
  // Drive every beneficial trait to the max via the designer sliders.
  for (const key of ['spread', 'diet', 'resilience']) {
    const slider = page.locator(`[data-trait="${key}"]`);
    await slider.fill('1');
  }
  await page.locator('[data-trait="metabolism"]').fill('0');
  await page.locator('[data-trait="reproThreshold"]').fill('0');
  await expect(page.locator('[data-budget]')).toHaveClass(/over/);
});
```

- [ ] **Step 2: Run the e2e to verify the new tests fail**

Run: `npm run e2e`
Expected: FAIL — `[data-action="new-strain"]`, `[data-tool="seed"]`, and `[data-budget]` selectors do not exist yet.

- [ ] **Step 3: Write `src/ui/Toolbar.svelte`**

```svelte
<script lang="ts">
  import { tool, brushRadius, strains, activeStrainId, type UiTool } from './stores';
  export let onNewStrain: () => void;

  const tools: { id: UiTool; label: string }[] = [
    { id: 'pan', label: '✋ Pan' },
    { id: 'seed', label: '🧬 Seed' },
    { id: 'food', label: '🌿 Food' },
    { id: 'cull', label: '☠ Cull' },
    { id: 'mutate', label: '⚡ Mutate' },
  ];

  const rgb = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;
  $: active = $strains.find((s) => s.id === $activeStrainId) ?? null;
</script>

<div class="toolbar">
  {#each tools as t}
    <button class:selected={$tool === t.id} data-tool={t.id} on:click={() => tool.set(t.id)}>{t.label}</button>
  {/each}
  <label class="brush">Brush
    <input type="range" min="0" max="6" step="1" bind:value={$brushRadius} />
    <span>{$brushRadius}</span>
  </label>
  <button data-action="new-strain" on:click={onNewStrain}>＋ New strain</button>
  {#if active}
    <span class="swatch" data-active-strain={active.id} style="background:{rgb(active.color)}"></span>
  {/if}
</div>

<style>
  .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; pointer-events: auto; }
  button { background: #122; color: #cfe; border: 1px solid #243; padding: 4px 6px; cursor: pointer; font-family: monospace; }
  button.selected { background: #2a5; color: #021; }
  .brush { display: flex; align-items: center; gap: 4px; font-size: 12px; }
  .swatch { width: 14px; height: 14px; border: 1px solid #fff4; display: inline-block; }
</style>
```

- [ ] **Step 4: Write `src/ui/GenomeDesigner.svelte`**

```svelte
<script lang="ts">
  import { genome, budgetCost, overBudget, BUDGET } from './stores';
  import type { Genome } from '../sim/types';

  const traits: { key: keyof Genome; label: string }[] = [
    { key: 'metabolism', label: 'Metabolism' },
    { key: 'reproThreshold', label: 'Repro threshold' },
    { key: 'spread', label: 'Spread' },
    { key: 'diet', label: 'Diet (herb→pred)' },
    { key: 'resilience', label: 'Resilience' },
    { key: 'mutationRate', label: 'Mutation rate' },
  ];

  function setTrait(key: keyof Genome, value: number): void {
    genome.update((g) => ({ ...g, [key]: value }));
  }
</script>

<div class="designer">
  <div class="budget" class:over={$overBudget} data-budget>
    Budget {$budgetCost.toFixed(2)} / {BUDGET.toFixed(1)}
  </div>
  {#each traits as t}
    <label class="trait">
      <span>{t.label}</span>
      <input
        type="range" min="0" max="1" step="0.01"
        data-trait={t.key}
        value={$genome[t.key]}
        on:input={(e) => setTrait(t.key, +e.currentTarget.value)} />
      <span class="val">{$genome[t.key].toFixed(2)}</span>
    </label>
  {/each}
</div>

<style>
  .designer { display: flex; flex-direction: column; gap: 2px; pointer-events: auto; background: #0b0f0cdd; padding: 6px; border: 1px solid #243; font-size: 12px; }
  .budget { font-weight: bold; }
  .budget.over { color: #f55; }
  .trait { display: grid; grid-template-columns: 110px 1fr 34px; align-items: center; gap: 4px; }
  .val { text-align: right; }
</style>
```

- [ ] **Step 5: Update `src/ui/App.svelte` to mount the toolbar + designer**

```svelte
<script lang="ts">
  import Toolbar from './Toolbar.svelte';
  import GenomeDesigner from './GenomeDesigner.svelte';
  export let onNewStrain: () => void = () => {};
  export let onStep: () => void = () => {};
  export let onSave: (slot: string) => void = () => {};
  export let onLoad: (slot: string) => void = () => {};
  void onStep; void onSave; void onLoad;
</script>

<div class="hud" data-hud>
  <div class="left">
    <Toolbar {onNewStrain} />
    <GenomeDesigner />
  </div>
</div>

<style>
  .hud { position: absolute; inset: 0; pointer-events: none; font-family: monospace; color: #cfe; }
  .left { position: absolute; top: 8px; left: 8px; display: flex; flex-direction: column; gap: 6px; width: 280px; }
</style>
```

- [ ] **Step 6: Type-check, build-check, run the e2e**

Run: `npx tsc --noEmit` → clean.
Run: `npm run check` → 0 errors.
Run: `npm run e2e`
Expected: PASS — the seed-and-grow test and over-budget test pass alongside the existing specs.

- [ ] **Step 7: Commit**

```bash
git add src/ui/Toolbar.svelte src/ui/GenomeDesigner.svelte src/ui/App.svelte tests/e2e/hud.spec.ts
git commit -m "feat: add toolbar and point-buy genome designer"
```

---

### Task 6: Sim controls + stats panel

**Files:**
- Create: `src/ui/SimControls.svelte`, `src/ui/StatsPanel.svelte`
- Modify: `src/ui/App.svelte`, `tests/e2e/hud.spec.ts`

**Interfaces:**
- Consumes: stores `paused`, `speed`, `stats`, `strains` (`src/ui/stores.ts`); the `onStep` callback prop.
- Produces: pause/play toggle, step button (enabled only while paused), speed select; a stats panel showing tick, population, and per-strain counts with color swatches.

- [ ] **Step 1: Write the failing e2e additions (pause freezes, step advances by one)**

Append to `tests/e2e/hud.spec.ts`:
```ts
test('pause freezes the tick and step advances exactly one', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => {
    const w = window as unknown as { __bitcosm?: { stats: () => { tick: number } } };
    return !!w.__bitcosm && w.__bitcosm.stats().tick > 5;
  }, { timeout: 10_000 });

  await page.locator('[data-action="toggle-pause"]').click();
  // Read tick, wait, confirm it did not advance while paused.
  const t1 = await page.evaluate(() => (window as any).__bitcosm.stats().tick);
  await page.waitForTimeout(300);
  const t2 = await page.evaluate(() => (window as any).__bitcosm.stats().tick);
  expect(t2).toBe(t1);

  // One step advances by exactly one tick.
  await page.locator('[data-action="step"]').click();
  const t3 = await page.evaluate(() => (window as any).__bitcosm.stats().tick);
  expect(t3).toBe(t1 + 1);
});

test('stats panel shows the live tick', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-stats-tick]');
    return !!el && Number(el.textContent) > 10;
  }, { timeout: 10_000 });
});
```

- [ ] **Step 2: Run the e2e to verify the new tests fail**

Run: `npm run e2e`
Expected: FAIL — `[data-action="toggle-pause"]`, `[data-action="step"]`, `[data-stats-tick]` do not exist.

- [ ] **Step 3: Write `src/ui/SimControls.svelte`**

```svelte
<script lang="ts">
  import { paused, speed } from './stores';
  export let onStep: () => void;
  const speeds = [1, 2, 5, 10, 20, 60];
</script>

<div class="sim">
  <button data-action="toggle-pause" on:click={() => paused.update((p) => !p)}>
    {$paused ? '▶ Play' : '⏸ Pause'}
  </button>
  <button data-action="step" on:click={onStep} disabled={!$paused}>⏭ Step</button>
  <label>Speed
    <select bind:value={$speed}>
      {#each speeds as s}<option value={s}>{s}/s</option>{/each}
    </select>
  </label>
</div>

<style>
  .sim { display: flex; align-items: center; gap: 4px; pointer-events: auto; font-size: 12px; }
  button { background: #122; color: #cfe; border: 1px solid #243; padding: 4px 6px; cursor: pointer; font-family: monospace; }
  button:disabled { opacity: 0.4; cursor: default; }
</style>
```

- [ ] **Step 4: Write `src/ui/StatsPanel.svelte`**

```svelte
<script lang="ts">
  import { stats, strains } from './stores';
  const rgb = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;
</script>

<div class="stats">
  <div>tick <span data-stats-tick>{$stats.tick}</span> · pop {$stats.population}</div>
  {#each $strains as s}
    <div class="row">
      <span class="swatch" style="background:{rgb(s.color)}"></span>
      #{s.id}: {$stats.perStrain[s.id] ?? 0}
    </div>
  {/each}
</div>

<style>
  .stats { pointer-events: auto; background: #0b0f0cdd; padding: 6px; border: 1px solid #243; font-size: 12px; min-width: 120px; }
  .row { display: flex; align-items: center; gap: 4px; }
  .swatch { width: 12px; height: 12px; border: 1px solid #fff4; display: inline-block; }
</style>
```

- [ ] **Step 5: Update `src/ui/App.svelte` to mount sim controls + stats (top-right)**

```svelte
<script lang="ts">
  import Toolbar from './Toolbar.svelte';
  import GenomeDesigner from './GenomeDesigner.svelte';
  import SimControls from './SimControls.svelte';
  import StatsPanel from './StatsPanel.svelte';
  export let onNewStrain: () => void = () => {};
  export let onStep: () => void = () => {};
  export let onSave: (slot: string) => void = () => {};
  export let onLoad: (slot: string) => void = () => {};
  void onSave; void onLoad;
</script>

<div class="hud" data-hud>
  <div class="left">
    <Toolbar {onNewStrain} />
    <GenomeDesigner />
  </div>
  <div class="top-right">
    <SimControls {onStep} />
    <StatsPanel />
  </div>
</div>

<style>
  .hud { position: absolute; inset: 0; pointer-events: none; font-family: monospace; color: #cfe; }
  .left { position: absolute; top: 8px; left: 8px; display: flex; flex-direction: column; gap: 6px; width: 280px; }
  .top-right { position: absolute; top: 8px; right: 8px; display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
</style>
```

- [ ] **Step 6: Type-check, build-check, run the e2e**

Run: `npx tsc --noEmit` → clean.
Run: `npm run check` → 0 errors.
Run: `npm run e2e`
Expected: PASS — pause/step/stats tests pass alongside existing specs.

- [ ] **Step 7: Commit**

```bash
git add src/ui/SimControls.svelte src/ui/StatsPanel.svelte src/ui/App.svelte tests/e2e/hud.spec.ts
git commit -m "feat: add sim controls and live stats panel"
```

---

### Task 7: Save/load panel + autosave

**Files:**
- Create: `src/ui/SaveLoadPanel.svelte`
- Modify: `src/ui/App.svelte`, `tests/e2e/hud.spec.ts`

**Interfaces:**
- Consumes: stores `slots`, `notice` (`src/ui/stores.ts`); the `onSave` / `onLoad` callback props.
- Produces: a panel with three named slots (save + load buttons) and an autosave load button; load buttons disabled until that slot exists; a notice line.

- [ ] **Step 1: Write the failing e2e addition (save → reload → load restores)**

Append to `tests/e2e/hud.spec.ts`:
```ts
test('save then reload then load restores the world', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => {
    const w = window as unknown as { __bitcosm?: { stats: () => { tick: number } } };
    return !!w.__bitcosm && w.__bitcosm.stats().tick > 20;
  }, { timeout: 10_000 });

  // Pause so the saved tick is stable, then save to slot-1.
  await page.locator('[data-action="toggle-pause"]').click();
  const savedTick = await page.evaluate(() => (window as any).__bitcosm.stats().tick);
  await page.locator('[data-save="slot-1"]').click();

  // Reload the page (fresh world at tick 0-ish) and load slot-1.
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as { __bitcosm?: unknown }).__bitcosm, { timeout: 10_000 });
  await page.locator('[data-load="slot-1"]').click();

  const loadedTick = await page.evaluate(() => (window as any).__bitcosm.stats().tick);
  expect(loadedTick).toBe(savedTick);
});
```

- [ ] **Step 2: Run the e2e to verify it fails**

Run: `npm run e2e`
Expected: FAIL — `[data-save="slot-1"]` / `[data-load="slot-1"]` do not exist.

- [ ] **Step 3: Write `src/ui/SaveLoadPanel.svelte`**

```svelte
<script lang="ts">
  import { slots, notice } from './stores';
  export let onSave: (slot: string) => void;
  export let onLoad: (slot: string) => void;
  const named = ['slot-1', 'slot-2', 'slot-3'];
</script>

<div class="saveload">
  {#each named as s}
    <div class="row">
      <span class="name">{s}</span>
      <button data-save={s} on:click={() => onSave(s)}>Save</button>
      <button data-load={s} disabled={!$slots.includes(s)} on:click={() => onLoad(s)}>Load</button>
    </div>
  {/each}
  <button data-load="autosave" disabled={!$slots.includes('autosave')} on:click={() => onLoad('autosave')}>Load autosave</button>
  {#if $notice}<div class="notice">{$notice}</div>{/if}
</div>

<style>
  .saveload { pointer-events: auto; background: #0b0f0cdd; padding: 6px; border: 1px solid #243; font-size: 12px; display: flex; flex-direction: column; gap: 2px; }
  .row { display: flex; align-items: center; gap: 4px; }
  .name { width: 48px; }
  button { background: #122; color: #cfe; border: 1px solid #243; padding: 2px 6px; cursor: pointer; font-family: monospace; }
  button:disabled { opacity: 0.4; cursor: default; }
  .notice { color: #9cf; margin-top: 2px; }
</style>
```

- [ ] **Step 4: Update `src/ui/App.svelte` to mount the save/load panel (bottom-left)**

```svelte
<script lang="ts">
  import Toolbar from './Toolbar.svelte';
  import GenomeDesigner from './GenomeDesigner.svelte';
  import SimControls from './SimControls.svelte';
  import StatsPanel from './StatsPanel.svelte';
  import SaveLoadPanel from './SaveLoadPanel.svelte';
  export let onNewStrain: () => void = () => {};
  export let onStep: () => void = () => {};
  export let onSave: (slot: string) => void = () => {};
  export let onLoad: (slot: string) => void = () => {};
</script>

<div class="hud" data-hud>
  <div class="left">
    <Toolbar {onNewStrain} />
    <GenomeDesigner />
  </div>
  <div class="top-right">
    <SimControls {onStep} />
    <StatsPanel />
  </div>
  <div class="bottom-left">
    <SaveLoadPanel {onSave} {onLoad} />
  </div>
</div>

<style>
  .hud { position: absolute; inset: 0; pointer-events: none; font-family: monospace; color: #cfe; }
  .left { position: absolute; top: 8px; left: 8px; display: flex; flex-direction: column; gap: 6px; width: 280px; }
  .top-right { position: absolute; top: 8px; right: 8px; display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
  .bottom-left { position: absolute; bottom: 8px; left: 8px; }
</style>
```

- [ ] **Step 5: Type-check, build-check, run the e2e**

Run: `npx tsc --noEmit` → clean.
Run: `npm run check` → 0 errors.
Run: `npm run e2e`
Expected: PASS — the save→reload→load test passes alongside all existing specs.

- [ ] **Step 6: Commit**

```bash
git add src/ui/SaveLoadPanel.svelte src/ui/App.svelte tests/e2e/hud.spec.ts
git commit -m "feat: add save/load panel with named slots and autosave"
```

---

### Task 8: Acceptance flow + docs

**Files:**
- Create: `tests/e2e/sandbox.spec.ts`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: the fully wired app from Tasks 1–7.
- Produces: one end-to-end acceptance test covering the headline flow, and updated project docs marking M1 complete.

- [ ] **Step 1: Write the failing acceptance e2e**

```ts
// tests/e2e/sandbox.spec.ts
import { test, expect } from '@playwright/test';

test('design → seed → grow → save → reload → load', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => {
    const w = window as unknown as { __bitcosm?: { stats: () => { population: number } } };
    return !!w.__bitcosm && w.__bitcosm.stats().population > 0;
  }, { timeout: 10_000 });

  // Design: lower diet so the new strain is a fast herbivore, within budget.
  await page.locator('[data-trait="diet"]').fill('0.05');

  // New strain + Seed tool, then paint a short drag across the canvas centre.
  await page.locator('[data-action="new-strain"]').click();
  await page.locator('[data-tool="seed"]').click();
  const id = Number(await page.locator('[data-active-strain]').getAttribute('data-active-strain'));

  const box = (await page.locator('#world').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx - 30, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 30, cy, { steps: 8 });
  await page.mouse.up();

  // The new strain establishes and grows.
  await page.waitForFunction((sid) => {
    const w = window as unknown as { __bitcosm: { stats: () => { perStrain: Record<number, number> } } };
    return (w.__bitcosm.stats().perStrain[sid] ?? 0) >= 1;
  }, id, { timeout: 10_000 });

  // Save, reload, load, and confirm the strain survived the round-trip.
  await page.locator('[data-action="toggle-pause"]').click();
  await page.locator('[data-save="slot-2"]').click();
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as { __bitcosm?: unknown }).__bitcosm, { timeout: 10_000 });
  await page.locator('[data-load="slot-2"]').click();

  const restored = await page.evaluate((sid) => {
    const w = window as unknown as { __bitcosm: { stats: () => { perStrain: Record<number, number> } } };
    return w.__bitcosm.stats().perStrain[sid] ?? 0;
  }, id);
  expect(restored).toBeGreaterThan(0);

  await page.screenshot({ path: 'test-results/bitcosm-sandbox.png' });
});
```

- [ ] **Step 2: Run the e2e to verify it passes**

Run: `npm run e2e`
Expected: PASS — `sandbox.spec.ts`, `hud.spec.ts`, and `render.spec.ts` all green. (`sandbox.spec.ts` should pass on the first wired run; if it fails only on a cold Vite start, re-run — the `waitForFunction` guards handle warm-up, same as M1b-1.)

- [ ] **Step 3: Update `CLAUDE.md`**

Make these edits to `CLAUDE.md`:

1. In the **Status** section, replace the M0 line with:
```markdown
**M1 (single-player browser sandbox) is shipped and merged to `main`.** The pure deterministic
Sim Core (M0) is driven by a framework-agnostic `Engine`, rendered with WebGL, and wrapped in a
Svelte HUD: point-buy genome designer, god-mode tools (seed/food/cull/mutate), pan/zoom camera,
pause/play/step/speed, and localStorage save/load with autosave. No server, accounts, or
multiplayer yet — those are M2–M4.
```

2. In the **Architecture** table, update the **Viewer** row to:
```markdown
| **Client** | `src/ui/`, `src/render/`, `src/input/`, `src/engine/`, `src/main.ts`, `index.html` | Svelte HUD + WebGL renderer + camera/tools/engine driving the Sim Core. Client-only; never re-implements sim logic. |
```

3. In the **Commands** block, add after the `e2e` line:
```markdown
npm run check      # svelte-check (type-check .svelte components)
```

4. In the **Roadmap**, change the M1 line to `✅ shipped` and mark **M2** as `← next`.

- [ ] **Step 4: Final full verification**

Run: `npm test` → all unit tests green.
Run: `npx tsc --noEmit` → clean.
Run: `npm run check` → 0 errors.
Run: `npm run build` → succeeds (tsc + vite build).
Run: `npm run e2e` → all e2e specs pass.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/sandbox.spec.ts CLAUDE.md
git commit -m "test: add sandbox acceptance flow and mark M1 complete in docs"
```

---

## Self-Review

**1. Spec coverage (M1 sandbox spec §1–§11):**
- Point-buy genome designer + live budget meter (§6) → Task 5 `GenomeDesigner.svelte` using `genomeCost`/`isWithinBudget`/`POINT_BUDGET`; over-budget disables seeding (controller guard) + red meter. ✓
- God-mode tools seed/food/cull/mutate + place by clicking (§5) → Task 4 controller `applyToolAt` via `pointerToActions`; Task 5 toolbar selects tool. ✓
- Multiple strains, distinct colors (§5/§6) → `StrainRegistry` + `New strain`; stats legend with swatches. ✓
- Sim controls pause/play/step/speed (§7) → Task 6 `SimControls.svelte` driving `paused`/`speed` stores → engine; step enabled only when paused. ✓
- Large bounded world + pan/zoom WebGL camera (§4) → reuses M1b-1 renderer + camera; controller routes pan (pan tool / middle-drag) and wheel zoom. ✓
- localStorage save/load of a session, named slots + autosave (§8) → Task 3 session glue, Task 7 panel, controller autosave interval. ✓
- Error handling: corrupt/version-mismatch save rejected gracefully (§9) → `loadFromSlot` returns null → controller sets notice, keeps current world; WebGL-unavailable notice retained from M1b-1 in `main.ts`. ✓
- Architecture: framework-agnostic Engine + thin Svelte stores; WorldState never reactive (§2) → controller owns engine; only derived views in stores; canvas renders from engine each frame. ✓
- Testing: new-action coverage already in M1a; engine scheduling/persistence/camera unit-tested in M1a; this plan adds stores, router, session unit tests + Playwright design/seed/grow + save/reload (§10). ✓
- Tech stack: Svelte for HUD, raw WebGL, TS strict, Vite/Vitest/Playwright (§11) → Task 1 toolchain. ✓
- Deferred (correctly out of scope): biomass economy, chunked/infinite world, server/accounts/monetization (§ "Out of scope"). Not touched. ✓

**2. Placeholder scan:** Every code step contains complete file contents; every run step names the exact command and expected result. The one judgment call (`overBudget` import grouping in the controller) is flagged with an explicit implementer note offering the simpler inline alternative — not a placeholder. No TBD/TODO/"handle edge cases". ✓

**3. Type consistency:**
- `UiTool = 'pan' | ToolId` defined in `stores.ts` (Task 2), consumed by `pointerRouter.ts` (Task 4) and `Toolbar.svelte` (Task 5). ✓
- `gestureFor(button: number, tool: UiTool): Gesture` — defined Task 4, called in controller `attachInput`. ✓
- `captureSession(world, camera, strains, genome)` / `restoreSession(data)` — defined Task 3, called in controller `save`/`load` (Task 4). ✓
- `StrainRegistry.restore(strains, activeId)` — added Task 3, called in controller `load`. ✓
- Controller method names (`newStrain`, `step`, `save`, `load`, `start`, getter `world`) — defined Task 4, passed as props in `main.ts` and consumed by components via callbacks (Tasks 5–7). ✓
- Store names/types match between `stores.ts` (Task 2) and every component import (Tasks 4–7): `tool`, `brushRadius`, `foodAmount`, `genome`, `budgetCost`, `overBudget`, `BUDGET`, `paused`, `speed`, `stats`, `strains`, `activeStrainId`, `slots`, `notice`, `StatsView`, `StrainView`, `DEFAULT_GENOME`. ✓
- `worldStats(state) → { tick, population, perStrain }` matches `StatsView`; `StrainInfo { id, color }` matches `StrainView`. ✓
- Data-attribute selectors used by e2e (`data-tool`, `data-action="new-strain"`, `data-active-strain`, `data-budget`, `data-trait`, `data-action="toggle-pause"`, `data-action="step"`, `data-stats-tick`, `data-save`, `data-load`) are each emitted by the component built in the same or an earlier task. ✓

One coupling to watch during execution (flagged, not a gap): the seed-and-grow e2e assumes a brush-3 seed of the default/edited genome establishes a living colony within ~10s at speed 10. If a reviewer or run shows the new strain dies out before the assertion (e.g., genome edited to something non-viable in a future change), prefer asserting `perStrain[id] >= 1` immediately after seeding (membership) rather than sustained growth — the acceptance test in Task 8 already lowers `diet` to keep the strain viable. No change needed now; noted for the execution reviewer.
