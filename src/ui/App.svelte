<script lang="ts">
  import Toolbar from './Toolbar.svelte';
  import GenomeDesigner from './GenomeDesigner.svelte';
  import SimControls from './SimControls.svelte';
  import StatsPanel from './StatsPanel.svelte';
  export let onNewStrain: () => void = () => {};
  export let onStep: () => void = () => {};
  export let onSave: (slot: string) => void = () => {};
  export let onLoad: (slot: string) => void = () => {};
  void onSave; void onLoad;
</script>

<div class="hud" data-hud>
  <div class="left">
    <Toolbar {onNewStrain} />
    <GenomeDesigner />
  </div>
  <div class="top-right">
    <SimControls {onStep} />
    <StatsPanel />
  </div>
</div>

<style>
  .hud { position: absolute; inset: 0; pointer-events: none; font-family: monospace; color: #cfe; }
  .left { position: absolute; top: 8px; left: 8px; display: flex; flex-direction: column; gap: 6px; width: 280px; }
  .top-right { position: absolute; top: 8px; right: 8px; display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
</style>
