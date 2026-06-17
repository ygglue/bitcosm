import { createWorld, applyActions, step, population, makeRng } from '../sim/index';
import type { WorldState, Genome } from '../sim/index';
import { render } from './render';

declare global {
  interface Window {
    __microcosm: { state: WorldState };
  }
}

const founder: Genome = {
  metabolism: 0.15, reproThreshold: 0.3, spread: 0.8, diet: 0.1, resilience: 0.5, mutationRate: 0.5,
};

const canvas = document.getElementById('world') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const stats = document.getElementById('stats')!;

const state = createWorld(160, 120, 12345);

// Seed 6 founder blobs of ~5x5 at deterministic positions.
const rng = makeRng(2024);
for (let s = 1; s <= 6; s++) {
  const cx = Math.floor(rng.next() * state.width);
  const cy = Math.floor(rng.next() * state.height);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      applyActions(state, [{ type: 'seed', x: cx + dx, y: cy + dy, strainId: s, genome: founder }]);
    }
  }
}

window.__microcosm = { state };

let frame = 0;
function loop(): void {
  step(state);
  render(state, ctx);
  if (frame % 10 === 0) {
    stats.textContent = `tick ${state.tick} · population ${population(state)}`;
  }
  frame++;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
