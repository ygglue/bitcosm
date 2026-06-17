<script lang="ts">
  // Minimal HUD root. Panels are added in later tasks.
</script>

<div class="hud" data-hud>
  <div class="title">Bitcosm — sandbox</div>
</div>

<style>
  .hud {
    position: absolute;
    inset: 0;
    pointer-events: none;
    font-family: monospace;
    color: #cfe;
  }
  .title {
    position: absolute;
    top: 8px;
    left: 8px;
    pointer-events: auto;
    font-size: 13px;
    opacity: 0.8;
  }
</style>
