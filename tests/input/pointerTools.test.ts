import { describe, it, expect } from 'vitest';
import { pointerToActions } from '../../src/input/pointerTools';
import type { ToolContext } from '../../src/input/pointerTools';
import type { Genome } from '../../src/sim/types';

const g: Genome = { metabolism: 0.15, reproThreshold: 0.3, spread: 0.8, diet: 0.1, resilience: 0.5, mutationRate: 0.2 };
const base: Omit<ToolContext, 'tool'> = { brushRadius: 1, activeStrainId: 5, genome: g, foodAmount: 0.5 };

describe('pointerToActions', () => {
  it('seed emits one seed action per brush cell', () => {
    const acts = pointerToActions({ ...base, tool: 'seed' }, 10.4, 7.6);
    expect(acts).toHaveLength(9); // 3x3 brush
    expect(acts.every((a) => a.type === 'seed')).toBe(true);
    // includes the rounded centre (10, 8)
    expect(acts).toContainEqual({ type: 'seed', x: 10, y: 8, strainId: 5, genome: g });
  });

  it('seed with no active strain emits nothing', () => {
    const acts = pointerToActions({ ...base, tool: 'seed', activeStrainId: null }, 3, 3);
    expect(acts).toEqual([]);
  });

  it('food emits a single dropFood action', () => {
    expect(pointerToActions({ ...base, tool: 'food' }, 3.2, 4.7)).toEqual([
      { type: 'dropFood', x: 3, y: 5, radius: 1, amount: 0.5 },
    ]);
  });

  it('cull emits a single cull action', () => {
    expect(pointerToActions({ ...base, tool: 'cull', brushRadius: 2 }, 8, 8)).toEqual([
      { type: 'cull', x: 8, y: 8, radius: 2 },
    ]);
  });

  it('mutate emits a single mutate action', () => {
    expect(pointerToActions({ ...base, tool: 'mutate' }, 8, 8)).toEqual([
      { type: 'mutate', x: 8, y: 8, radius: 1 },
    ]);
  });
});
