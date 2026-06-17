import { describe, it, expect } from 'vitest';
import { fillColorBuffer } from '../../src/render/colorBuffer';
import { createWorld, idx, applyActions } from '../../src/sim/world';
import { strainColor } from '../../src/colors';
import type { Genome } from '../../src/sim/types';

const g: Genome = { metabolism: 0.15, reproThreshold: 0.3, spread: 0.8, diet: 0.1, resilience: 0.5, mutationRate: 0.2 };

describe('fillColorBuffer', () => {
  it('writes RGBA for every cell with alpha 255', () => {
    const w = createWorld(4, 3, 1);
    const buf = new Uint8Array(4 * 3 * 4);
    fillColorBuffer(w, buf);
    for (let i = 0; i < 12; i++) expect(buf[i * 4 + 3]).toBe(255);
  });

  it('colors an occupied cell by its strain', () => {
    const w = createWorld(4, 3, 1);
    applyActions(w, [{ type: 'seed', x: 2, y: 1, strainId: 7, genome: g }]);
    const buf = new Uint8Array(4 * 3 * 4);
    fillColorBuffer(w, buf);
    const o = idx(w, 2, 1) * 4;
    const [r, gg, b] = strainColor(7);
    expect([buf[o], buf[o + 1], buf[o + 2]]).toEqual([r, gg, b]);
  });

  it('shades empty cells green by food level', () => {
    const w = createWorld(2, 1, 1); // food starts at FOOD_MAX = 1.0
    const buf = new Uint8Array(2 * 1 * 4);
    fillColorBuffer(w, buf);
    expect(buf[0]).toBe(10);            // r
    expect(buf[1]).toBe(30 + 1 * 120);  // g at full food
    expect(buf[2]).toBe(20);            // b
  });
});
