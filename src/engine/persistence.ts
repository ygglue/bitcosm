import type { WorldState, Genome } from '../sim/types';
import type { Camera } from './camera';
import type { StrainInfo } from './strains';

export const SCHEMA_VERSION = 1;
const PREFIX = 'bitcosm:save:';

export type MicrobeTuple = [number, number, number, number, number, number, number, number, number];

export interface SerializedWorld {
  width: number;
  height: number;
  tick: number;
  rngState: number;
  food: number[];
  microbes: MicrobeTuple[];
}

export interface SaveData {
  schemaVersion: number;
  world: SerializedWorld;
  camera: Camera;
  strains: StrainInfo[];
  activeGenome: Genome;
}

export function serializeWorld(state: WorldState): SerializedWorld {
  const microbes: MicrobeTuple[] = [];
  for (let i = 0; i < state.microbes.length; i++) {
    const m = state.microbes[i];
    if (!m) continue;
    const g = m.genome;
    microbes.push([i, m.strainId, m.energy, g.metabolism, g.reproThreshold, g.spread, g.diet, g.resilience, g.mutationRate]);
  }
  return {
    width: state.width,
    height: state.height,
    tick: state.tick,
    rngState: state.rngState,
    food: Array.from(state.food),
    microbes,
  };
}

export function deserializeWorld(s: SerializedWorld): WorldState {
  const n = s.width * s.height;
  const microbes: WorldState['microbes'] = new Array(n).fill(null);
  for (const [i, strainId, energy, me, rt, sp, di, re, mu] of s.microbes) {
    microbes[i] = {
      strainId,
      energy,
      genome: { metabolism: me, reproThreshold: rt, spread: sp, diet: di, resilience: re, mutationRate: mu },
      actedTick: -1,
    };
  }
  return {
    width: s.width,
    height: s.height,
    tick: s.tick,
    rngState: s.rngState,
    food: new Float32Array(s.food),
    microbes,
  };
}

export function saveToSlot(slot: string, data: SaveData, storage: Storage = localStorage): void {
  storage.setItem(PREFIX + slot, JSON.stringify(data));
}

export function loadFromSlot(slot: string, storage: Storage = localStorage): SaveData | null {
  const raw = storage.getItem(PREFIX + slot);
  if (raw === null) return null;
  let parsed: SaveData;
  try {
    parsed = JSON.parse(raw) as SaveData;
  } catch {
    return null;
  }
  if (parsed.schemaVersion !== SCHEMA_VERSION) return null;
  return parsed;
}

export function listSlots(storage: Storage = localStorage): string[] {
  const slots: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.startsWith(PREFIX)) slots.push(key.slice(PREFIX.length));
  }
  return slots;
}
