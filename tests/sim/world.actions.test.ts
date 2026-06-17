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
