export interface Genome {
  metabolism: number;
  reproThreshold: number;
  spread: number;
  diet: number;
  resilience: number;
  mutationRate: number;
}

export interface Microbe {
  strainId: number;
  energy: number;
  genome: Genome;
  actedTick: number;
}

export interface WorldState {
  width: number;
  height: number;
  tick: number;
  rngState: number;
  food: Float32Array;
  microbes: (Microbe | null)[];
}

export type Action =
  | { type: 'seed'; x: number; y: number; strainId: number; genome: Genome }
  | { type: 'dropFood'; x: number; y: number; radius: number; amount: number }
  | { type: 'cull'; x: number; y: number; radius: number }
  | { type: 'mutate'; x: number; y: number; radius: number };

export interface SimEvent {
  type: 'birth' | 'death' | 'predation';
  index: number;
  strainId: number;
}
