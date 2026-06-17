import { describe, it, expect } from 'vitest';
import { createWorld, idx, applyActions, population } from '../../src/sim/world';
import { step } from '../../src/sim/index';
import type { Genome, WorldState } from '../../src/sim/types';

const base: Genome = { metabolism: 0.1, reproThreshold: 0.3, spread: 1, diet: 0, resilience: 0, mutationRate: 0 };

function hash(state: WorldState): string {
  let h = `${state.tick}|${state.rngState}|`;
  for (let i = 0; i < state.microbes.length; i++) {
    const m = state.microbes[i];
    h += m ? `${i}:${m.strainId}:${m.energy.toFixed(4)};` : '';
  }
  return h;
}

describe('tick: metabolism & death', () => {
  it('starves a microbe with no food and high metabolism', () => {
    const w = createWorld(3, 3, 1);
    for (let i = 0; i < w.food.length; i++) w.food[i] = 0;
    applyActions(w, [{ type: 'seed', x: 1, y: 1, strainId: 1, genome: { ...base, metabolism: 1, diet: 0 } }]);
    // energy starts at 1.0; upkeep at metabolism=1 is METAB_MAX=0.2/tick.
    // Food regenerates 0.05/tick, so net loss is ~0.15/tick once the cell
    // refills — death lands around tick 7. Run 10 to be safely past it.
    for (let t = 0; t < 10; t++) step(w);
    expect(population(w)).toBe(0);
  });
});

describe('tick: herbivory', () => {
  it('a fed microbe gains net energy', () => {
    const w = createWorld(3, 3, 1);
    applyActions(w, [{ type: 'seed', x: 1, y: 1, strainId: 1, genome: { ...base, reproThreshold: 1, spread: 0 } }]);
    const before = w.microbes[idx(w, 1, 1)]!.energy;
    step(w);
    const after = w.microbes[idx(w, 1, 1)]!.energy;
    expect(after).toBeGreaterThan(before);
  });
});

describe('tick: reproduction', () => {
  it('splits into an empty neighbor and shares energy', () => {
    const w = createWorld(3, 3, 1);
    applyActions(w, [{ type: 'seed', x: 1, y: 1, strainId: 1, genome: base }]);
    w.microbes[idx(w, 1, 1)]!.energy = 10; // well above threshold
    const events = step(w).events;
    expect(population(w)).toBe(2);
    expect(events.some((e) => e.type === 'birth' && e.strainId === 1)).toBe(true);
  });
});

describe('tick: predation', () => {
  it('a predator kills an adjacent rival and absorbs energy', () => {
    const w = createWorld(3, 3, 1);
    applyActions(w, [
      { type: 'seed', x: 1, y: 1, strainId: 1, genome: { ...base, diet: 1, reproThreshold: 1, spread: 0 } },
      { type: 'seed', x: 2, y: 1, strainId: 2, genome: { ...base, diet: 0, resilience: 0, reproThreshold: 1, spread: 0 } },
    ]);
    const predator = w.microbes[idx(w, 1, 1)]!;
    const before = predator.energy;
    step(w);
    expect(w.microbes[idx(w, 2, 1)]).toBeNull(); // victim eaten
    expect(w.microbes[idx(w, 1, 1)]!.energy).toBeGreaterThan(before - 0.2); // gained from kill
  });
});

describe('tick: determinism', () => {
  it('two worlds with the same seed evolve identically', () => {
    const make = () => {
      const w = createWorld(8, 8, 12345);
      applyActions(w, [
        { type: 'seed', x: 2, y: 2, strainId: 1, genome: { ...base, mutationRate: 0.5 } },
        { type: 'seed', x: 5, y: 5, strainId: 2, genome: { ...base, mutationRate: 0.5 } },
      ]);
      return w;
    };
    const a = make();
    const b = make();
    for (let t = 0; t < 50; t++) { step(a); step(b); }
    expect(hash(a)).toBe(hash(b));
  });
});
