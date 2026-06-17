<script lang="ts">
  import { slots, notice } from './stores';
  export let onSave: (slot: string) => void;
  export let onLoad: (slot: string) => void;
  const named = ['slot-1', 'slot-2', 'slot-3'];
</script>

<div class="saveload">
  {#each named as s}
    <div class="row">
      <span class="name">{s}</span>
      <button data-save={s} on:click={() => onSave(s)}>Save</button>
      <button data-load={s} disabled={!$slots.includes(s)} on:click={() => onLoad(s)}>Load</button>
    </div>
  {/each}
  <button data-load="autosave" disabled={!$slots.includes('autosave')} on:click={() => onLoad('autosave')}>Load autosave</button>
  {#if $notice}<div class="notice">{$notice}</div>{/if}
</div>

<style>
  .saveload { pointer-events: auto; background: #0b0f0cdd; padding: 6px; border: 1px solid #243; font-size: 12px; display: flex; flex-direction: column; gap: 2px; }
  .row { display: flex; align-items: center; gap: 4px; }
  .name { width: 48px; }
  button { background: #122; color: #cfe; border: 1px solid #243; padding: 2px 6px; cursor: pointer; font-family: monospace; }
  button:disabled { opacity: 0.4; cursor: default; }
  .notice { color: #9cf; margin-top: 2px; }
</style>
