import { Engine, worldStats } from './engine/engine';
import { StrainRegistry } from './engine/strains';
import { createCamera, panCamera, zoomCameraAt, clampCamera } from './engine/camera';
import type { Camera } from './engine/camera';
import { pointerToActions } from './input/pointerTools';
import { fillColorBuffer } from './render/colorBuffer';
import { GlRenderer } from './render/glRenderer';
import type { Genome } from './sim/types';
import App from './ui/App.svelte';

const WORLD_W = 256;
const WORLD_H = 256;
const SEED = 1337;
const MIN_ZOOM = 1;
const MAX_ZOOM = 64;

const founder: Genome = {
  metabolism: 0.15, reproThreshold: 0.3, spread: 0.8, diet: 0.1, resilience: 0.5, mutationRate: 0.5,
};

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

const engine = new Engine({ width: WORLD_W, height: WORLD_H, seed: SEED });
const strains = new StrainRegistry();
const colorBuf = new Uint8Array(WORLD_W * WORLD_H * 4);
const renderer = new GlRenderer(gl, WORLD_W, WORLD_H);

let camera: Camera = createCamera(
  WORLD_W / 2,
  WORLD_H / 2,
  Math.min(canvas.width / WORLD_W, canvas.height / WORLD_H),
);

// Seed a few founder strains in a deterministic row so there is life to watch.
for (let s = 0; s < 5; s++) {
  strains.create();
  const cx = 40 + s * 45;
  const cy = 128;
  engine.enqueueMany(
    pointerToActions(
      { tool: 'seed', brushRadius: 3, activeStrainId: strains.active!.id, genome: founder, foodAmount: 0 },
      cx, cy,
    ),
  );
}
engine.stepOnce(); // apply the queued seeds so the first frame already shows them

// --- input: drag to pan, wheel to zoom (cursor-anchored) ---
let dragging = false;
let lastX = 0;
let lastY = 0;
canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointerup', (e) => {
  dragging = false;
  canvas.releasePointerCapture(e.pointerId);
});
canvas.addEventListener('pointercancel', () => { dragging = false; });
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  camera = clampCamera(
    panCamera(camera, e.clientX - lastX, e.clientY - lastY),
    WORLD_W, WORLD_H, MIN_ZOOM, MAX_ZOOM,
  );
  lastX = e.clientX;
  lastY = e.clientY;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  camera = clampCamera(
    zoomCameraAt(camera, factor, e.clientX - rect.left, e.clientY - rect.top, canvas.width, canvas.height),
    WORLD_W, WORLD_H, MIN_ZOOM, MAX_ZOOM,
  );
}, { passive: false });

declare global {
  interface Window {
    __bitcosm: { engine: Engine; stats: () => ReturnType<typeof worldStats> };
  }
}
window.__bitcosm = { engine, stats: () => worldStats(engine.world) };

new App({ target: document.getElementById('hud') as HTMLElement });

let last = performance.now();
function frame(now: number): void {
  const dt = now - last;
  last = now;
  engine.advance(dt);
  fillColorBuffer(engine.world, colorBuf);
  renderer.render(colorBuf, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
