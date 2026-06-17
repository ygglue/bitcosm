import type { Action, Genome } from '../sim/types';

export type ToolId = 'seed' | 'food' | 'cull' | 'mutate';

export interface ToolContext {
  tool: ToolId;
  brushRadius: number;
  activeStrainId: number | null;
  genome: Genome;
  foodAmount: number;
}

export function pointerToActions(ctx: ToolContext, wx: number, wy: number): Action[] {
  const x = Math.round(wx);
  const y = Math.round(wy);
  switch (ctx.tool) {
    case 'seed': {
      if (ctx.activeStrainId === null) return [];
      const acts: Action[] = [];
      const r = ctx.brushRadius;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          acts.push({ type: 'seed', x: x + dx, y: y + dy, strainId: ctx.activeStrainId, genome: ctx.genome });
        }
      }
      return acts;
    }
    case 'food':
      return [{ type: 'dropFood', x, y, radius: ctx.brushRadius, amount: ctx.foodAmount }];
    case 'cull':
      return [{ type: 'cull', x, y, radius: ctx.brushRadius }];
    case 'mutate':
      return [{ type: 'mutate', x, y, radius: ctx.brushRadius }];
  }
}
