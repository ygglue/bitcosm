import { describe, it, expect } from 'vitest';
import { Engine, worldStats } from '../../src/engine/engine';
import { createWorld, applyActions, population } from '../../src/sim/world';
import type { Genome } from '../../src/sim/types';

const g: Genome = { metabolism: 0.15, reproThreshold: 0.3, spread: 0.8, diet: 0.1, resilience: 0.5, mutationRate: 0.2 };

describe('Engine scheduling', () => {
  it('advances ticks based on elapsed time and speed', () => {
    const e = new Engine({ width: 8, height: 8, seed: 1 });
    e.setSpeed(10); // 1 tick per 100ms
    expect(e.world.tick).toBe(0);
    expect(e.advance(100)).toBe(1);
    expect(e.world.tick).toBe(1);
    expect(e.advance(250)).toBe(2); // 2 whole ticks, 50ms remainder carried
    expect(e.world.tick).toBe(3);
  });

  it('does nothing while paused, but stepOnce still ticks', () => {
    const e = new Engine({ width: 8, height: 8, seed: 1 });
    e.setPaused(true);
    expect(e.advance(1000)).toBe(0);
    expect(e.world.tick).toBe(0);
    e.stepOnce();
    expect(e.world.tick).toBe(1);
  });

  it('applies queued actions on the next tick', () => {
    const e = new Engine({ width: 8, height: 8, seed: 1 });
    e.enqueue({ type: 'seed', x: 4, y: 4, strainId: 1, genome: g });
    expect(population(e.world)).toBe(0); // not applied until a tick runs
    e.stepOnce();
    expect(population(e.world)).toBeGreaterThan(0);
  });

  it('setSpeed rejects non-positive speeds', () => {
    const e = new Engine({ width: 4, height: 4, seed: 1 });
    expect(() => e.setSpeed(0)).toThrow();
    expect(() => e.setSpeed(-5)).toThrow();
  });

  it('loadWorld swaps state and clears the queue', () => {
    const e = new Engine({ width: 8, height: 8, seed: 1 });
    e.enqueue({ type: 'seed', x: 0, y: 0, strainId: 1, genome: g });
    const fresh = createWorld(8, 8, 2);
    applyActions(fresh, [{ type: 'seed', x: 7, y: 7, strainId: 9, genome: g }]);
    e.loadWorld(fresh);
    expect(e.world.microbes[e.world.width * 7 + 7]).not.toBeNull();
    e.stepOnce(); // queued (0,0) seed must NOT apply — it was cleared
    expect(e.world.microbes[0]).toBeNull();
  });
});

describe('worldStats', () => {
  it('reports tick, population, and per-strain counts', () => {
    const w = createWorld(8, 8, 1);
    applyActions(w, [
      { type: 'seed', x: 1, y: 1, strainId: 1, genome: g },
      { type: 'seed', x: 2, y: 2, strainId: 1, genome: g },
      { type: 'seed', x: 3, y: 3, strainId: 7, genome: g },
    ]);
    const s = worldStats(w);
    expect(s.tick).toBe(0);
    expect(s.population).toBe(3);
    expect(s.perStrain[1]).toBe(2);
    expect(s.perStrain[7]).toBe(1);
  });
});
