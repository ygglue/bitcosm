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
  stats, strains, activeStrainId, slots, notice, overBudget,
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
  private colorBuf: Uint8Array;
  private gesture: Gesture = 'none';
  private lastX = 0;
  private lastY = 0;
  private frameCount = 0;
  private lastTs = 0;

  constructor(canvas: HTMLCanvasElement, gl: WebGLRenderingContext) {
    this.canvas = canvas;
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
    if (t === 'seed' && get(overBudget)) { notice.set('Genome over budget'); return; }
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
