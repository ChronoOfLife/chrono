<script lang="ts">
  /**
   * HUD.svelte
   * Fixed screen-space overlay: time indicator, zoom level, India toggle,
   * Reset View, List View toggle, and row legend.
   */
  import { createEventDispatcher } from 'svelte';
  import { centreTimeFromState } from '$lib/navigator/navigator.js';
  import { formatTime } from '$lib/math/axis.js';
  import { getScaleLevel, ROW_DEFINITIONS } from '$lib/layout/rows.js';
  import type { ViewState } from '$lib/math/axis.js';

  export let viewState: ViewState;
  export let viewportWidth: number;
  export let indiaFilterActive = false;
  export let listViewActive = false;
  export let isMobile = false;

  const dispatch = createEventDispatcher<{
    reset: void;
    toggleIndia: void;
    toggleListView: void;
  }>();

  $: centreT = centreTimeFromState(viewState, viewportWidth);
  $: timeLabel = formatTime(centreT);
  $: scaleLevel = getScaleLevel(viewState.zoomScale);

  // Only show content rows in the legend
  $: legendRows = ROW_DEFINITIONS.filter(r => r.isContent);
</script>

<div class="hud" class:mobile={isMobile} role="toolbar" aria-label="Timeline controls">
  <!-- Time indicator -->
  <div class="hud-time" aria-live="polite" aria-label="Current time position">
    <span class="time-label">{timeLabel}</span>
    {#if !isMobile}
      <span class="scale-badge">{scaleLevel}</span>
    {/if}
  </div>

  <!-- Controls -->
  <div class="hud-controls">
    <button
      class="hud-btn"
      class:active={indiaFilterActive}
      on:click={() => dispatch('toggleIndia')}
      aria-label="Toggle India filter"
      aria-pressed={indiaFilterActive}
      title="Highlight India events"
    >
      🇮🇳 India
    </button>

    <button
      class="hud-btn"
      on:click={() => dispatch('reset')}
      aria-label="Reset view to present day"
      title="Reset to present day"
    >
      ⌂ Reset
    </button>

    <button
      class="hud-btn"
      class:active={listViewActive}
      on:click={() => dispatch('toggleListView')}
      aria-label="Toggle list view"
      aria-pressed={listViewActive}
      title="Switch to list view"
    >
      ☰ List
    </button>
  </div>

  <!-- Row legend (hidden on mobile) -->
  {#if !isMobile}
    <div class="hud-legend" role="list" aria-label="Row legend">
      {#each legendRows as row}
        <div class="legend-item" role="listitem">
          <span
            class="legend-swatch"
            style="background:{row.background};border:1px solid {row.textColor}33"
            aria-hidden="true"
          ></span>
          <span class="legend-label" style="color:{row.textColor === '#ffffff' ? '#ccc' : row.textColor}">
            {row.subLabel ?? row.label.split('\n')[0]}
          </span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .hud {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: rgba(5, 7, 15, 0.85);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(255,255,255,0.08);
    font-family: system-ui, sans-serif;
    flex-wrap: wrap;
  }

  .hud.mobile {
    padding: 4px 8px;
    gap: 4px;
  }

  .hud-time {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .time-label {
    font-size: 13px;
    font-weight: 700;
    color: #e8eaf6;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .scale-badge {
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 10px;
    background: rgba(255,255,255,0.1);
    color: #90caf9;
    text-transform: capitalize;
    white-space: nowrap;
  }

  .hud-controls {
    display: flex;
    gap: 4px;
  }

  .hud-btn {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
    color: #e8eaf6;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 11px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    min-width: 44px;
    min-height: 32px;
    white-space: nowrap;
  }

  .hud-btn:hover {
    background: rgba(255,255,255,0.15);
    border-color: rgba(255,255,255,0.3);
  }

  .hud-btn.active {
    background: rgba(255, 153, 51, 0.25);
    border-color: #FF9933;
    color: #FF9933;
  }

  .hud-legend {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .legend-swatch {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .legend-label {
    font-size: 9px;
    white-space: nowrap;
    opacity: 0.85;
  }
</style>
