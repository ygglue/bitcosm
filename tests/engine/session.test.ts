import { describe, it, expect } from 'vitest';
import { createWorld, applyActions } from '../../src/sim/world';
import { createCamera } from '../../src/engine/camera';
import { StrainRegistry } from '../../src/engine/strains';
import { saveToSlot, loadFromSlot } from '../../src/engine/persistence';
import { captureSession, restoreSession } from '../../src/engine/session';
import type { Genome } from '../../src/sim/types';

// Minimal in-memory Storage for deterministic, isolated tests.
function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => { m.delete(k); },
    setItem: (k, v) => { m.set(k, v); },
  } as Storage;
}

const g: Genome = { metabolism: 0.2, reproThreshold: 0.4, spread: 0.6, diet: 0.3, resilience: 0.5, mutationRate: 0.7 };

describe('session round-trip', () => {
  it('captures and restores world, camera, strains, and genome through a slot', () => {
    const world = createWorld(8, 8, 999);
    applyActions(world, [{ type: 'seed', x: 2, y: 2, strainId: 1, genome: g }]);
    const camera = createCamera(4, 4, 12);
    const strains = [{ id: 1, color: [10, 20, 30] as [number, number, number] }];

    const storage = memStorage();
    saveToSlot('slot-1', captureSession(world, camera, strains, g), storage);
    const data = loadFromSlot('slot-1', storage);
    expect(data).not.toBeNull();

    const r = restoreSession(data!);
    expect(r.world.width).toBe(8);
    expect(r.world.tick).toBe(world.tick);
    expect(r.world.microbes[2 * 8 + 2]?.strainId).toBe(1);
    expect(r.camera).toEqual(camera);
    expect(r.strains).toEqual(strains);
    expect(r.genome).toEqual(g);
  });
});

describe('StrainRegistry.restore', () => {
  it('rebuilds the strain list and continues id assignment', () => {
    const reg = new StrainRegistry();
    reg.restore(
      [{ id: 1, color: [1, 2, 3] }, { id: 2, color: [4, 5, 6] }],
      2,
    );
    expect(reg.all().map((s) => s.id)).toEqual([1, 2]);
    expect(reg.active?.id).toBe(2);
    const next = reg.create();
    expect(next.id).toBe(3); // continues after the restored ids
  });
});
