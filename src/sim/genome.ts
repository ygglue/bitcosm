import type { Genome } from './types';
import type { Rng } from './prng';
import { MUT_SCALE } from './constants';

// Beneficial traits (high spread/diet/resilience, low metabolism/reproThreshold)
// cost points; mutationRate is free. Budget bounds a starting genome.
export const POINT_BUDGET = 3.0;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export function clampGenome(g: Genome): Genome {
  return {
    metabolism: clamp01(g.metabolism),
    reproThreshold: clamp01(g.reproThreshold),
    spread: clamp01(g.spread),
    diet: clamp01(g.diet),
    resilience: clamp01(g.resilience),
    mutationRate: clamp01(g.mutationRate),
  };
}

export function randomGenome(rng: Rng): Genome {
  return {
    metabolism: rng.next(),
    reproThreshold: rng.next(),
    spread: rng.next(),
    diet: rng.next(),
    resilience: rng.next(),
    mutationRate: rng.next(),
  };
}

export function mutate(g: Genome, rng: Rng): Genome {
  const jitter = (): number => (rng.next() * 2 - 1) * g.mutationRate * MUT_SCALE;
  return clampGenome({
    metabolism: g.metabolism + jitter(),
    reproThreshold: g.reproThreshold + jitter(),
    spread: g.spread + jitter(),
    diet: g.diet + jitter(),
    resilience: g.resilience + jitter(),
    mutationRate: g.mutationRate + jitter(),
  });
}

export function genomeCost(g: Genome): number {
  return g.spread + g.diet + g.resilience + (1 - g.metabolism) + (1 - g.reproThreshold);
}

export function isWithinBudget(g: Genome, budget: number = POINT_BUDGET): boolean {
  return genomeCost(g) <= budget;
}
