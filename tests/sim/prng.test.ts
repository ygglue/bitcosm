import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/sim/prng';

describe('makeRng', () => {
  it('produces values in [0,1)', () => {
    const rng = makeRng(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('differs across calls (not constant)', () => {
    const rng = makeRng(7);
    const seq = new Set(Array.from({ length: 50 }, () => rng.next()));
    expect(seq.size).toBeGreaterThan(40);
  });

  it('can be restored from state()', () => {
    const a = makeRng(99);
    a.next(); a.next(); a.next();
    const snapshot = a.state();
    const expected = [a.next(), a.next(), a.next()];
    const b = makeRng(snapshot);
    const got = [b.next(), b.next(), b.next()];
    expect(got).toEqual(expected);
  });
});
