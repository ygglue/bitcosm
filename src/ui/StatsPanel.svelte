<script lang="ts">
  import { stats, strains } from './stores';
  const rgb = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;
</script>

<div class="stats">
  <div>tick <span data-stats-tick>{$stats.tick}</span> · pop {$stats.population}</div>
  {#each $strains as s}
    <div class="row">
      <span class="swatch" style="background:{rgb(s.color)}"></span>
      #{s.id}: {$stats.perStrain[s.id] ?? 0}
    </div>
  {/each}
</div>

<style>
  .stats { pointer-events: auto; background: #0b0f0cdd; padding: 6px; border: 1px solid #243; font-size: 12px; min-width: 120px; }
  .row { display: flex; align-items: center; gap: 4px; }
  .swatch { width: 12px; height: 12px; border: 1px solid #fff4; display: inline-block; }
</style>
