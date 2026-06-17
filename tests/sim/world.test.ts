import { describe, it, expect } from 'vitest';
import { createWorld, idx, inBounds, neighbors, applyActions, population } from '../../src/sim/world';
import { FOOD_MAX, START_ENERGY } from '../../src/sim/constants';
import type { Genome } from '../../src/sim/types';

const g: Genome = { metabolism: 0.2, reproThreshold: 0.3, spread: 0.8, diet: 0.1, resilience: 0.5, mutationRate: 0.4 };

describe('createWorld', () => {
  it('initializes a full, empty, seeded world', () => {
    const w = createWorld(4, 3, 77);
    expect(w.width).toBe(4);
    expect(w.height).toBe(3);
    expect(w.tick).toBe(0);
    expect(w.rngState).toBe(77);
    expect(w.food.length).toBe(12);
    expect(w.microbes.length).toBe(12);
    expect([...w.food].every((f) => f === FOOD_MAX)).toBe(true);
    expect(w.microbes.every((m) => m === null)).toBe(true);
  });
});

describe('idx / inBounds', () => {
  it('maps (x,y) to a row-major index', () => {
    const w = createWorld(4, 3, 1);
    expect(idx(w, 0, 0)).toBe(0);
    expect(idx(w, 3, 0)).toBe(3);
    expect(idx(w, 0, 1)).toBe(4);
    expect(idx(w, 3, 2)).toBe(11);
  });
  it('detects out-of-bounds coordinates', () => {
    const w = createWorld(4, 3, 1);
    expect(inBounds(w, 0, 0)).toBe(true);
    expect(inBounds(w, 3, 2)).toBe(true);
    expect(inBounds(w, -1, 0)).toBe(false);
    expect(inBounds(w, 4, 0)).toBe(false);
    expect(inBounds(w, 0, 3)).toBe(false);
  });
});

describe('neighbors', () => {
  it('returns 4 for an interior cell, fewer at edges/corners', () => {
    const w = createWorld(4, 3, 1);
    expect(neighbors(w, idx(w, 1, 1)).sort((a, b) => a - b))
      .toEqual([idx(w, 1, 0), idx(w, 0, 1), idx(w, 2, 1), idx(w, 1, 2)].sort((a, b) => a - b));
    expect(neighbors(w, idx(w, 0, 0)).length).toBe(2);
    expect(neighbors(w, idx(w, 3, 0)).length).toBe(2);
    expect(neighbors(w, idx(w, 1, 0)).length).toBe(3);
  });
});

describe('applyActions', () => {
  it('seed places a microbe with starting energy', () => {
    const w = createWorld(4, 3, 1);
    applyActions(w, [{ type: 'seed', x: 2, y: 1, strainId: 7, genome: g }]);
    const m = w.microbes[idx(w, 2, 1)];
    expect(m).not.toBeNull();
    expect(m!.strainId).toBe(7);
    expect(m!.energy).toBe(START_ENERGY);
    expect(m!.actedTick).toBe(-1);
    expect(population(w)).toBe(1);
  });

  it('dropFood raises nutrient within radius, capped at FOOD_MAX', () => {
    const w = createWorld(4, 3, 1);
    // deplete first so the increase is observable
    for (let i = 0; i < w.food.length; i++) w.food[i] = 0;
    applyActions(w, [{ type: 'dropFood', x: 1, y: 1, radius: 1, amount: 2 }]);
    expect(w.food[idx(w, 1, 1)]).toBe(FOOD_MAX); // capped
    expect(w.food[idx(w, 0, 0)]).toBe(FOOD_MAX); // within Chebyshev radius 1
    expect(w.food[idx(w, 3, 1)]).toBe(0);        // outside radius
  });
});
