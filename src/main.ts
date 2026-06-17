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
