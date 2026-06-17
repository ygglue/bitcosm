import type { WorldState, SimEvent, Genome } from './types';
import { makeRng } from './prng';
import { neighbors } from './world';
import { mutate } from './genome';
import {
  FEED_RATE, METAB_MIN, METAB_MAX, REPRO_MIN, REPRO_MAX,
  PREDATION_EFF, FOOD_MAX, FOOD_REGEN,
} from './constants';

const metabCost = (g: Genome): number => METAB_MIN + g.metabolism * (METAB_MAX - METAB_MIN);
const reproCost = (g: Genome): number => REPRO_MIN + g.reproThreshold * (REPRO_MAX - REPRO_MIN);
const herbRate = (g: Genome): number => (1 - g.diet) * FEED_RATE;

export function tick(state: WorldState): SimEvent[] {
  const events: SimEvent[] = [];
  const rng = makeRng(state.rngState);
  state.tick += 1;
  const t = state.tick;
  const n = state.width * state.height;

  for (let i = 0; i < n; i++) {
    const m = state.microbes[i];
    if (!m || m.actedTick === t) continue;
    m.actedTick = t;
    const g = m.genome;

    // 1. Herbivory
    const eat = Math.min(state.food[i], herbRate(g));
    state.food[i] -= eat;
    m.energy += eat;

    // 2. Predation
    if (g.diet > 0) {
      const prey = neighbors(state, i).filter((j) => {
        const o = state.microbes[j];
        return o !== null && o.strainId !== m.strainId;
      });
      if (prey.length > 0) {
        const j = prey[Math.floor(rng.next() * prey.length)];
        const victim = state.microbes[j]!;
        if (rng.next() < g.diet * (1 - 0.5 * victim.genome.resilience)) {
          m.energy += victim.energy * PREDATION_EFF;
          state.microbes[j] = null;
          events.push({ type: 'predation', index: j, strainId: m.strainId });
          events.push({ type: 'death', index: j, strainId: victim.strainId });
        }
      }
    }

    // 3. Metabolism
    m.energy -= metabCost(g);

    // 4. Death
    if (m.energy <= 0) {
      state.microbes[i] = null;
      events.push({ type: 'death', index: i, strainId: m.strainId });
      continue;
    }

    // 5. Reproduction
    if (m.energy >= reproCost(g) && rng.next() < g.spread) {
      const empties = neighbors(state, i).filter((j) => state.microbes[j] === null);
      if (empties.length > 0) {
        const j = empties[Math.floor(rng.next() * empties.length)];
        const childEnergy = m.energy / 2;
        m.energy = childEnergy;
        state.microbes[j] = {
          strainId: m.strainId,
          energy: childEnergy,
          genome: mutate(g, rng),
          actedTick: t,
        };
        events.push({ type: 'birth', index: j, strainId: m.strainId });
      }
    }
  }

  // Food regeneration
  for (let i = 0; i < n; i++) {
    const f = state.food[i] + FOOD_REGEN;
    state.food[i] = f > FOOD_MAX ? FOOD_MAX : f;
  }

  state.rngState = rng.state();
  return events;
}
