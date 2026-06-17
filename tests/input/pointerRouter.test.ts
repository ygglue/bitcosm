import { describe, it, expect } from 'vitest';
import { gestureFor } from '../../src/input/pointerRouter';

describe('gestureFor', () => {
  it('middle mouse (button 1) always pans, even with an action tool', () => {
    expect(gestureFor(1, 'seed')).toBe('pan');
    expect(gestureFor(1, 'pan')).toBe('pan');
  });

  it('left mouse (button 0) pans with the pan tool', () => {
    expect(gestureFor(0, 'pan')).toBe('pan');
  });

  it('left mouse with an action tool applies the tool', () => {
    expect(gestureFor(0, 'seed')).toBe('tool');
    expect(gestureFor(0, 'food')).toBe('tool');
    expect(gestureFor(0, 'cull')).toBe('tool');
    expect(gestureFor(0, 'mutate')).toBe('tool');
  });

  it('other buttons do nothing', () => {
    expect(gestureFor(2, 'seed')).toBe('none');
  });
});
