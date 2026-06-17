import { describe, it, expect } from 'vitest';
import { serializeWorld, deserializeWorld, saveToSlot, loadFromSlot, listSlots, SCHEMA_VERSION } from '../../src/engine/persistence';
import type { SaveData } from '../../src/engine/persistence';
import { createWorld, applyActions } from '../../src/sim/world';
import { createCamera } from '../../src/engine/camera';
import type { Genome } from '../../src/sim/types';

const g: Genome = { metabolism: 0.15, reproThreshold: 0.3, spread: 0.8, diet: 0.1, resilience: 0.5, mutationRate: 0.2 };

// minimal in-memory Storage for tests
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear() { map.clear(); },
    getItem(k) { return map.has(k) ? map.get(k)! : null; },
    key(i) { return [...map.keys()][i] ?? null; },
    removeItem(k) { map.delete(k); },
    setItem(k, v) { map.set(k, v); },
  } as Storage;
}

function sampleWorld() {
  const w = createWorld(6, 5, 123);
  applyActions(w, [
    { type: 'seed', x: 1, y: 1, strainId: 1, genome: g },
    { type: 'seed', x: 4, y: 3, strainId: 2, genome: { ...g, diet: 0.9 } },
    { type: 'dropFood', x: 2, y: 2, radius: 1, amount: 0.3 },
  ]);
  return w;
}

describe('serialize/deserialize world', () => {
  it('round-trips exactly', () => {
    const w = sampleWorld();
    const back = deserializeWorld(serializeWorld(w));
    expect(back).toEqual(w);
  });
});

describe('save/load slots', () => {
  const data = (): SaveData => ({
    schemaVersion: SCHEMA_VERSION,
    world: serializeWorld(sampleWorld()),
    camera: createCamera(3, 2, 8),
    strains: [{ id: 1, color: [10, 20, 30] }, { id: 2, color: [40, 50, 60] }],
    activeGenome: g,
  });

  it('saves and loads a slot', () => {
    const st = fakeStorage();
    saveToSlot('slotA', data(), st);
    const loaded = loadFromSlot('slotA', st);
    expect(loaded).toEqual(data());
  });

  it('lists saved slots', () => {
    const st = fakeStorage();
    saveToSlot('one', data(), st);
    saveToSlot('two', data(), st);
    expect(listSlots(st).sort()).toEqual(['one', 'two']);
  });

  it('returns null for missing, corrupt, or version-mismatched data', () => {
    const st = fakeStorage();
    expect(loadFromSlot('missing', st)).toBeNull();
    st.setItem('bitcosm:save:bad', '{not json');
    expect(loadFromSlot('bad', st)).toBeNull();
    st.setItem('bitcosm:save:old', JSON.stringify({ ...data(), schemaVersion: 0 }));
    expect(loadFromSlot('old', st)).toBeNull();
  });
});
