<script lang="ts">
  import { tool, brushRadius, strains, activeStrainId, type UiTool } from './stores';
  export let onNewStrain: () => void;

  const tools: { id: UiTool; label: string }[] = [
    { id: 'pan', label: '✋ Pan' },
    { id: 'seed', label: '🧬 Seed' },
    { id: 'food', label: '🌿 Food' },
    { id: 'cull', label: '☠ Cull' },
    { id: 'mutate', label: '⚡ Mutate' },
  ];

  const rgb = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;
  $: active = $strains.find((s) => s.id === $activeStrainId) ?? null;
</script>

<div class="toolbar">
  {#each tools as t}
    <button class:selected={$tool === t.id} data-tool={t.id} on:click={() => tool.set(t.id)}>{t.label}</button>
  {/each}
  <label class="brush">Brush
    <input type="range" min="0" max="6" step="1" bind:value={$brushRadius} />
    <span>{$brushRadius}</span>
  </label>
  <button data-action="new-strain" on:click={onNewStrain}>＋ New strain</button>
  {#if active}
    <span class="swatch" data-active-strain={active.id} style="background:{rgb(active.color)}"></span>
  {/if}
</div>

<style>
  .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; pointer-events: auto; }
  button { background: #122; color: #cfe; border: 1px solid #243; padding: 4px 6px; cursor: pointer; font-family: monospace; }
  button.selected { background: #2a5; color: #021; }
  .brush { display: flex; align-items: center; gap: 4px; font-size: 12px; }
  .swatch { width: 14px; height: 14px; border: 1px solid #fff4; display: inline-block; }
</style>
