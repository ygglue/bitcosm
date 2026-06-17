export interface Rng {
  next(): number;
  state(): number;
}

// mulberry32 — fast, deterministic, single uint32 of state.
export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return {
    next(): number {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    state(): number {
      return s;
    },
  };
}
