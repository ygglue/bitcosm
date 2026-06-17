import { describe, it, expect } from 'vitest';
import { strainColor, hslToRgb } from '../src/colors';

describe('hslToRgb', () => {
  it('maps primary hues correctly', () => {
    expect(hslToRgb(0, 1, 0.5)).toEqual([255, 0, 0]);      // red
    expect(hslToRgb(1 / 3, 1, 0.5)).toEqual([0, 255, 0]);  // green
    expect(hslToRgb(2 / 3, 1, 0.5)).toEqual([0, 0, 255]);  // blue
  });
  it('returns channels in [0,255]', () => {
    for (let i = 0; i < 20; i++) {
      for (const c of hslToRgb(i / 20, 0.7, 0.55)) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe('strainColor', () => {
  it('is deterministic', () => {
    expect(strainColor(3)).toEqual(strainColor(3));
  });
  it('gives distinct colors to consecutive strain ids', () => {
    const a = strainColor(1).join(',');
    const b = strainColor(2).join(',');
    const c = strainColor(3).join(',');
    expect(new Set([a, b, c]).size).toBe(3);
  });
});
