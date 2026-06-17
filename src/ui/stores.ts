import { writable, derived, type Writable, type Readable } from 'svelte/store';
import type { Genome } from '../sim/types';
import type { ToolId } from '../input/pointerTools';
import { genomeCost, isWithinBudget, POINT_BUDGET } from '../sim/genome';

export type UiTool = 'pan' | ToolId;

export interface StatsView {
  tick: number;
  population: number;
  perStrain: Record<number, number>;
}

export interface StrainView {
  id: number;
  color: [number, number, number];
}

export const DEFAULT_GENOME: Genome = {
  metabolism: 0.15,
  reproThreshold: 0.3,
  spread: 0.8,
  diet: 0.1,
  resilience: 0.5,
  mutationRate: 0.5,
};

export const BUDGET = POINT_BUDGET;

export const tool: Writable<UiTool> = writable('pan');
export const brushRadius: Writable<number> = writable(3);
export const foodAmount: Writable<number> = writable(0.5);
export const genome: Writable<Genome> = writable({ ...DEFAULT_GENOME });

export const budgetCost: Readable<number> = derived(genome, (g) => genomeCost(g));
export const overBudget: Readable<boolean> = derived(genome, (g) => !isWithinBudget(g));

export const paused: Writable<boolean> = writable(false);
export const speed: Writable<number> = writable(10);

export const stats: Writable<StatsView> = writable({ tick: 0, population: 0, perStrain: {} });
export const strains: Writable<StrainView[]> = writable([]);
export const activeStrainId: Writable<number | null> = writable(null);

export const slots: Writable<string[]> = writable([]);
export const notice: Writable<string> = writable('');
