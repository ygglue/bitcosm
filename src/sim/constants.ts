// All tunable simulation constants live here so balancing is one-file.
export const FEED_RATE = 0.5;     // max nutrient a pure herbivore eats per tick
export const METAB_MIN = 0.02;    // energy/tick upkeep at metabolism=0
export const METAB_MAX = 0.2;     // energy/tick upkeep at metabolism=1
export const REPRO_MIN = 1.5;     // energy to split at reproThreshold=0
export const REPRO_MAX = 5;       // energy to split at reproThreshold=1
export const PREDATION_EFF = 0.6; // fraction of victim energy gained on a kill
export const MUT_SCALE = 0.1;     // max per-trait jitter at mutationRate=1
export const START_ENERGY = 1.0;  // energy a seeded microbe starts with
export const FOOD_MAX = 1.0;      // cap on per-cell nutrient
export const FOOD_REGEN = 0.05;   // nutrient regained per cell per tick
