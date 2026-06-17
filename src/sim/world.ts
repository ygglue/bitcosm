import type { WorldState, Action } from './types';
import { START_ENERGY, FOOD_MAX } from './constants';
import { makeRng, type Rng } from './prng';
import { mutate } from './genome';

export function createWorld(width: number, height: number, seed: number, initialFood: number = FOOD_MAX): WorldState {
  const n = width * height;
  const food = new Float32Array(n);
  food.fill(initialFood);
  const microbes: (WorldState['microbes'][number])[] = new Array(n).fill(null);
  return { width, height, tick: 0, rngState: seed >>> 0, food, microbes };
}

export function idx(state: WorldState, x: number, y: number): number {
  return y * state.width + x;
}

export function inBounds(state: WorldState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < state.width && y < state.height;
}

export function neighbors(state: WorldState, index: number): number[] {
  const x = index % state.width;
  const y = (index - x) / state.width;
  const out: number[] = [];
  if (inBounds(state, x, y - 1)) out.push(index - state.width); // N
  if (inBounds(state, x + 1, y)) out.push(index + 1);           // E
  if (inBounds(state, x, y + 1)) out.push(index + state.width); // S
  if (inBounds(state, x - 1, y)) out.push(index - 1);           // W
  return out;
}

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

export function population(state: WorldState): number {
  let count = 0;
  for (const m of state.microbes) if (m) count++;
  return count;
}
