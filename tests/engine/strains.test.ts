import { describe, it, expect } from 'vitest';
import { StrainRegistry, paletteColor } from '../../src/engine/strains';
import { strainColor } from '../../src/colors';

describe('paletteColor', () => {
  it('maps index 0 to strain color 1', () => {
    expect(paletteColor(0)).toEqual(strainColor(1));
  });
});

describe('StrainRegistry', () => {
  it('creates strains with incrementing ids and distinct colors, setting active', () => {
    const reg = new StrainRegistry();
    expect(reg.active).toBeNull();
    const s1 = reg.create();
    const s2 = reg.create();
    expect(s1.id).toBe(1);
    expect(s2.id).toBe(2);
    expect(reg.active).toEqual(s2);
    expect(s1.color).not.toEqual(s2.color);
    expect(reg.all().map((s) => s.id)).toEqual([1, 2]);
  });
  it('get and setActive work', () => {
    const reg = new StrainRegistry();
    reg.create();
    const s2 = reg.create();
    reg.setActive(1);
    expect(reg.active!.id).toBe(1);
    expect(reg.get(2)).toEqual(s2);
    expect(reg.get(99)).toBeUndefined();
  });
});
