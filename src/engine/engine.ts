import type { WorldState, Action } from '../sim/types';
import { createWorld, population } from '../sim/world';
import { step } from '../sim/index';

const MAX_STEPS_PER_ADVANCE = 240;

export interface EngineOptions { width: number; height: number; seed: number; }
export interface WorldStats { tick: number; population: number; perStrain: Record<number, number>; }

export function worldStats(state: WorldState): WorldStats {
  const perStrain: Record<number, number> = {};
  for (const m of state.microbes) {
    if (m) perStrain[m.strainId] = (perStrain[m.strainId] ?? 0) + 1;
  }
  return { tick: state.tick, population: population(state), perStrain };
}

export class Engine {
  world: WorldState;
  paused = false;
  speed = 10;
  private queue: Action[] = [];
  private acc = 0;

  constructor(opts: EngineOptions) {
    this.world = createWorld(opts.width, opts.height, opts.seed);
  }

  enqueue(action: Action): void {
    this.queue.push(action);
  }

  enqueueMany(actions: Action[]): void {
    for (const a of actions) this.queue.push(a);
  }

  private runTick(): void {
    const actions = this.queue;
    this.queue = [];
    step(this.world, actions);
  }

  advance(dtMs: number): number {
    if (this.paused) return 0;
    this.acc += dtMs;
    const interval = 1000 / this.speed;
    let steps = 0;
    while (this.acc >= interval && steps < MAX_STEPS_PER_ADVANCE) {
      this.runTick();
      this.acc -= interval;
      steps++;
    }
    if (steps === MAX_STEPS_PER_ADVANCE) this.acc = 0;
    return steps;
  }

  stepOnce(): void {
    this.runTick();
  }

  setSpeed(ticksPerSecond: number): void {
    if (ticksPerSecond <= 0) throw new Error('speed must be > 0');
    this.speed = ticksPerSecond;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  loadWorld(world: WorldState): void {
    this.world = world;
    this.queue = [];
    this.acc = 0;
  }
}
