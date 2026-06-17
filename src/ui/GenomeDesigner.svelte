<script lang="ts">
  import { genome, budgetCost, overBudget, BUDGET } from './stores';
  import type { Genome } from '../sim/types';

  const traits: { key: keyof Genome; label: string }[] = [
    { key: 'metabolism', label: 'Metabolism' },
    { key: 'reproThreshold', label: 'Repro threshold' },
    { key: 'spread', label: 'Spread' },
    { key: 'diet', label: 'Diet (herb→pred)' },
    { key: 'resilience', label: 'Resilience' },
    { key: 'mutationRate', label: 'Mutation rate' },
  ];

  function setTrait(key: keyof Genome, value: number): void {
    genome.update((g) => ({ ...g, [key]: value }));
  }
</script>

<div class="designer">
  <div class="budget" class:over={$overBudget} data-budget>
    Budget {$budgetCost.toFixed(2)} / {BUDGET.toFixed(1)}
  </div>
  {#each traits as t}
    <label class="trait">
      <span>{t.label}</span>
      <input
        type="range" min="0" max="1" step="0.01"
        data-trait={t.key}
        value={$genome[t.key]}
        on:input={(e) => setTrait(t.key, +e.currentTarget.value)} />
      <span class="val">{$genome[t.key].toFixed(2)}</span>
    </label>
  {/each}
</div>

<style>
  .designer { display: flex; flex-direction: column; gap: 2px; pointer-events: auto; background: #0b0f0cdd; padding: 6px; border: 1px solid #243; font-size: 12px; }
  .budget { font-weight: bold; }
  .budget.over { color: #f55; }
  .trait { display: grid; grid-template-columns: 110px 1fr 34px; align-items: center; gap: 4px; }
  .val { text-align: right; }
</style>
