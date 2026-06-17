<script lang="ts">
  import { paused, speed } from './stores';
  export let onStep: () => void;
  const speeds = [1, 2, 5, 10, 20, 60];
</script>

<div class="sim">
  <button data-action="toggle-pause" on:click={() => paused.update((p) => !p)}>
    {$paused ? '▶ Play' : '⏸ Pause'}
  </button>
  <button data-action="step" on:click={onStep} disabled={!$paused}>⏭ Step</button>
  <label>Speed
    <select bind:value={$speed}>
      {#each speeds as s}<option value={s}>{s}/s</option>{/each}
    </select>
  </label>
</div>

<style>
  .sim { display: flex; align-items: center; gap: 4px; pointer-events: auto; font-size: 12px; }
  button { background: #122; color: #cfe; border: 1px solid #243; padding: 4px 6px; cursor: pointer; font-family: monospace; }
  button:disabled { opacity: 0.4; cursor: default; }
</style>
