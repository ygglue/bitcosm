import { describe, it, expect } from 'vitest';
import { clampGenome, randomGenome, mutate, genomeCost, isWithinBudget, POINT_BUDGET } from '../../src/sim/genome';
import { makeRng } from '../../src/sim/prng';
import type { Genome } from '../../src/sim/types';

const flat = (v: number): Genome => ({
  metabolism: v, reproThreshold: v, spread: v, diet: v, resilience: v, mutationRate: v,
});

describe('clampGenome', () => {
  it('clamps every trait into [0,1]', () => {
    const g = clampGenome({ metabolism: -1, reproThreshold: 2, spread: 0.5, diet: -0.2, resilience: 1.5, mutationRate: 0.3 });
    for (const v of Object.values(g)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(g.spread).toBe(0.5);
  });
});

describe('randomGenome', () => {
  it('is deterministic for the same seed and in range', () => {
    const g1 = randomGenome(makeRng(5));
    const g2 = randomGenome(makeRng(5));
    expect(g1).toEqual(g2);
    for (const v of Object.values(g1)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('mutate', () => {
  it('returns an identical genome when mutationRate is 0', () => {
    const g = { ...flat(0.5), mutationRate: 0 };
    expect(mutate(g, makeRng(1))).toEqual(g);
  });

  it('drifts traits when mutationRate > 0, staying in [0,1]', () => {
    const g = flat(0.5);
    const child = mutate(g, makeRng(1));
    expect(child).not.toEqual(g);
    for (const v of Object.values(child)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic for the same genome and seed', () => {
    const g = flat(0.5);
    expect(mutate(g, makeRng(3))).toEqual(mutate(g, makeRng(3)));
  });
});

describe('genomeCost / isWithinBudget', () => {
  it('costs more for stronger beneficial traits', () => {
    const weak = { metabolism: 1, reproThreshold: 1, spread: 0, diet: 0, resilience: 0, mutationRate: 0 };
    const strong = { metabolism: 0, reproThreshold: 0, spread: 1, diet: 1, resilience: 1, mutationRate: 0 };
    expect(genomeCost(strong)).toBeGreaterThan(genomeCost(weak));
  });

  it('rejects genomes over budget', () => {
    const strong = { metabolism: 0, reproThreshold: 0, spread: 1, diet: 1, resilience: 1, mutationRate: 0 };
    expect(genomeCost(strong)).toBeGreaterThan(POINT_BUDGET);
    expect(isWithinBudget(strong)).toBe(false);
    expect(isWithinBudget(flat(0.4))).toBe(true);
  });
});
