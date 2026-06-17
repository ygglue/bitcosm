import type { UiTool } from '../ui/stores';

export type Gesture = 'pan' | 'tool' | 'none';

// Decide what a pointer press means, given the mouse button and active tool.
// Middle mouse (1) always pans; left mouse (0) pans only with the pan tool,
// otherwise applies the active action tool.
export function gestureFor(button: number, tool: UiTool): Gesture {
  if (button === 1) return 'pan';
  if (button === 0) return tool === 'pan' ? 'pan' : 'tool';
  return 'none';
}
