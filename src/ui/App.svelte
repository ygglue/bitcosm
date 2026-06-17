<script lang="ts">
  export let onNewStrain: () => void = () => {};
  export let onStep: () => void = () => {};
  export let onSave: (slot: string) => void = () => {};
  export let onLoad: (slot: string) => void = () => {};
  // Panels that use these props are added in Tasks 5–7.
  void onNewStrain; void onStep; void onSave; void onLoad;
</script>

<div class="hud" data-hud>
  <div class="title">Bitcosm — sandbox</div>
</div>

<style>
  .hud { position: absolute; inset: 0; pointer-events: none; font-family: monospace; color: #cfe; }
  .title { position: absolute; top: 8px; left: 8px; pointer-events: auto; font-size: 13px; opacity: 0.8; }
</style>
