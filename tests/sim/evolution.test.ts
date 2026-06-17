import { describe, it, expect } from 'vitest';
import { createWorld, applyActions, population, step, makeRng, idx } from '../../src/sim/index';
import type { WorldState, Genome } from '../../src/sim/types';

// A robust founder: low metabolism, modest threshold, high spread, herbivore, drifts.
const founder: Genome = {
  metabolism: 0.15, reproThreshold: 0.3, spread: 0.8, diet: 0.1, resilience: 0.5, mutationRate: 0.5,
};

function seedWorld(seed: number): WorldState {
  const w = createWorld(64, 64, seed);
  const rng = makeRng(seed ^ 0x9e3779b9);
  for (let k = 0; k < 200; k++) {
    const x = Math.floor(rng.next() * w.width);
    const y = Math.floor(rng.next() * w.height);
    applyActions(w, [{ type: 'seed', x, y, strainId: (k % 4) + 1, genome: founder }]);
  }
  return w;
}

function distinctMetabolisms(state: WorldState): number {
  const set = new Set<string>();
  for (const m of state.microbes) if (m) set.add(m.genome.metabolism.toFixed(4));
  return set.size;
}

describe('evolution proof', () => {
  it('is non-degenerate after 300 ticks (not extinct, not saturated)', () => {
    const w = seedWorld(2024);
    for (let t = 0; t < 300; t++) step(w);
    const total = w.width * w.height;
    expect(population(w)).toBeGreaterThan(0);
    expect(population(w)).toBeLessThan(total);
  });

  it('is deterministic: same seed yields identical population', () => {
    const a = seedWorld(2024);
    const b = seedWorld(2024);
    for (let t = 0; t < 300; t++) { step(a); step(b); }
    expect(population(a)).toBe(population(b));
  });

  it('produces genome diversity through mutation', () => {
    const w = seedWorld(2024);
    for (let t = 0; t < 300; t++) step(w);
    // founder metabolism is identical for all seeds; drift must create variants.
    expect(distinctMetabolisms(w)).toBeGreaterThan(1);
  });

  it('keeps at least one founder lineage alive long-term', () => {
    const w = seedWorld(99);
    for (let t = 0; t < 500; t++) step(w);
    const alive = new Set<number>();
    for (const m of w.microbes) if (m) alive.add(m.strainId);
    expect(alive.size).toBeGreaterThan(0);
    // sanity: occupied cell at a valid index
    const anyAlive = w.microbes.findIndex((m) => m !== null);
    expect(anyAlive).toBeGreaterThanOrEqual(0);
    expect(anyAlive).toBeLessThan(idx(w, w.width - 1, w.height - 1) + 1);
  });
});
