import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { genome, budgetCost, overBudget, BUDGET, DEFAULT_GENOME } from '../../src/ui/stores';

describe('UI stores: budget', () => {
  it('exposes the point budget of 3.0', () => {
    expect(BUDGET).toBeCloseTo(3.0, 5);
  });

  it('the default genome is within budget', () => {
    genome.set(DEFAULT_GENOME);
    // cost = spread + diet + resilience + (1-metabolism) + (1-reproThreshold)
    expect(get(budgetCost)).toBeLessThanOrEqual(BUDGET);
    expect(get(overBudget)).toBe(false);
  });

  it('flags an over-budget genome (all beneficial traits maxed)', () => {
    genome.set({ metabolism: 0, reproThreshold: 0, spread: 1, diet: 1, resilience: 1, mutationRate: 0 });
    expect(get(budgetCost)).toBeCloseTo(5, 5); // 1+1+1+1+1
    expect(get(overBudget)).toBe(true);
  });
});
