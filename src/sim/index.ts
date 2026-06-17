import type { WorldState, Action, SimEvent } from './types';
import { applyActions } from './world';
import { tick } from './tick';

export function step(state: WorldState, actions: Action[] = []): { state: WorldState; events: SimEvent[] } {
  applyActions(state, actions);
  const events = tick(state);
  return { state, events };
}

export * from './types';
export { makeRng } from './prng';
export { createWorld, idx, inBounds, neighbors, applyActions, population } from './world';
export { randomGenome, mutate, clampGenome, genomeCost, isWithinBudget, POINT_BUDGET } from './genome';
export { tick } from './tick';
