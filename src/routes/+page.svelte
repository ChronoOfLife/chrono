<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { gsap } from 'gsap';
  import { writable } from 'svelte/store';

  import type { ChronoEvent } from '$lib/data/types.js';
  import type { ViewState } from '$lib/math/axis.js';
  import { screenX, BIG_BANG_TIME, HEAT_DEATH_TIME } from '$lib/math/axis.js';
  import { computeRowLayout, getScaleLevel, getRowEntry, ROW_DEFINITIONS } from '$lib/layout/rows.js';
  import { createNavigator } from '$lib/navigator/gsap-observer.js';
  import { resetView } from '$lib/navigator/navigator.js';
  import {
    CanvasRenderer,
    drawMarkers,
    drawLongitudeLines,
  } from '$lib/renderer/canvas-layer.js';
  import { getEllipsoidTransform, getCurvatureIntensity } from '$lib/renderer/ellipsoid.js';
  import { hitTest } from '$lib/hit-tester/hit-tester.js';

  import HUD from '$lib/components/HUD.svelte';
  import DetailPanel from '$lib/components/DetailPanel.svelte';
  import TimeHeader from '$lib/components/TimeHeader.svelte';
  import AgeRow from '$lib/components/AgeRow.svelte';
  import ListView from '$lib/components/ListView.svelte';

  // ── Page data ─────────────────────────────────────────────────────────────
  export let data: { events: ChronoEvent[] };
  $: events = data.events;

  // ── State ─────────────────────────────────────────────────────────────────
  let viewState: ViewState = { panX: 0, zoomScale: 1 };
  let viewportWidth = 0;
  let viewportHeight = 0;
  let isMobile = false;
  let indiaFilterActive = false;
  let listViewActive = false;
  let selectedEvent: ChronoEvent | null = null;
  let selectedMarkerX = 0;
  let selectedMarkerY = 0;

  // ── DOM refs ──────────────────────────────────────────────────────────────
  let containerEl: HTMLDivElement;
  let canvasEl: HTMLCanvasElement;
  let labelsEl: HTMLDivElement;

  // ── Renderer & Navigator ──────────────────────────────────────────────────
  let canvasRenderer: CanvasRenderer | null = null;
  let destroyNavigator: (() => void) | null = null;

  // ── Layout ────────────────────────────────────────────────────────────────
  $: rowLayout = computeRowLayout(viewportWidth, viewportHeight);
  $: scaleLevel = getScaleLevel(viewState.zoomScale);
  $: curvature = getCurvatureIntensity(viewState.zoomScale);
  $: ellipsoidTransform = getEllipsoidTransform(viewportHeight, curvature);

  // ── HUD header height (rows 4–11 = 8 header rows) ────────────────────────
  $: headerRowCount = ROW_DEFINITIONS.filter(r => r.isHeader).length;
  $: headerHeight = rowLayout.rowHeight * headerRowCount;

  // ── Visible events (culled) ───────────────────────────────────────────────
  $: visibleEvents = events.filter(e => {
    const sx = screenX(e.time, viewState, viewportWidth);
    return sx >= -40 && sx <= viewportWidth + 40;
  });

  // ── Label visibility thresholds ───────────────────────────────────────────
  $: showLabels = scaleLevel !== 'overview';
  $: showAgeLabel = scaleLevel === 'period' || scaleLevel === 'decade' || scaleLevel === 'year';

  // ── Canvas draw ───────────────────────────────────────────────────────────
  function draw(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, viewportWidth, viewportHeight);

    // Draw longitude lines
    drawLongitudeLines(ctx, viewState, viewportWidth, viewportHeight);

    // Draw event markers
    drawMarkers({
      ctx,
      events: visibleEvents,
      viewState,
      rowLayout,
      scaleLevel,
      viewportWidth,
      viewportHeight,
      selectedEvent,
      indiaFilterActive,
    });
  }

  // ── Resize handler ────────────────────────────────────────────────────────
  function handleResize() {
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
    isMobile = viewportWidth < 600;
    if (canvasRenderer) {
      canvasRenderer.resize(viewportWidth, viewportHeight);
    }
  }

  // ── Click / tap handler ───────────────────────────────────────────────────
  function handlePointerDown(e: PointerEvent) {
    const isTouch = e.pointerType === 'touch';
    const result = hitTest(
      e.clientX, e.clientY,
      visibleEvents,
      viewState,
      rowLayout,
      isTouch,
      viewportWidth,
      viewportHeight
    );
    if (result.event) {
      selectedEvent = result.event;
      selectedMarkerX = screenX(result.event.time, viewState, viewportWidth);
      const rowEntry = getRowEntry(rowLayout, result.event.row);
      selectedMarkerY = rowEntry?.centreY ?? e.clientY;
      canvasRenderer?.markDirty();
    }
  }

  // ── Reset view ────────────────────────────────────────────────────────────
  function handleReset() {
    const target = resetView(viewportWidth);
    gsap.to(viewState, {
      panX: target.panX,
      zoomScale: target.zoomScale,
      duration: 0.8,
      ease: 'power2.inOut',
      onUpdate() {
        viewState = { ...viewState };
        canvasRenderer?.markDirty();
      },
    });
  }

  // ── Mount ─────────────────────────────────────────────────────────────────
  onMount(() => {
    handleResize();
    window.addEventListener('resize', handleResize);

    // Canvas renderer
    canvasRenderer = new CanvasRenderer(canvasEl);
    canvasRenderer.onDraw = draw;

    // Navigator
    destroyNavigator = createNavigator({
      container: containerEl,
      getViewState: () => viewState,
      setViewState: (s) => {
        viewState = s;
        canvasRenderer?.markDirty();
      },
      getViewportWidth: () => viewportWidth,
      onReset: handleReset,
    });

    canvasRenderer.markDirty();
  });

  onDestroy(() => {
    window.removeEventListener('resize', handleResize);
    destroyNavigator?.();
    canvasRenderer?.destroy();
  });

  // Re-draw whenever viewState or filter changes
  $: if (canvasRenderer && viewportWidth > 0) {
    canvasRenderer.onDraw = draw;
    canvasRenderer.markDirty();
  }
</script>

<!-- Full-viewport container -->
<div
  bind:this={containerEl}
  class="timeline-container"
  style="width:{viewportWidth}px;height:{viewportHeight}px"
  role="region"
  aria-label="Chrono of Life interactive timeline"
  on:pointerdown={handlePointerDown}
>
  <!-- Canvas layer (markers + longitude lines) -->
  <canvas
    bind:this={canvasEl}
    class="canvas-layer"
    width={viewportWidth}
    height={viewportHeight}
    aria-hidden="true"
  ></canvas>

  <!-- Row bands (DOM layer) -->
  <div
    class="rows-layer"
    style="transform:{ellipsoidTransform};transform-origin:center center;will-change:transform"
  >
    {#each rowLayout.rows as row}
      <div
        class="row-band"
        style="
          top:{row.y}px;
          height:{row.height}px;
          background:{row.definition.background};
          color:{row.definition.textColor};
          left:{rowLayout.labelColumnWidth}px;
          right:0;
        "
        aria-hidden="true"
      ></div>
    {/each}

    <!-- DOM labels layer (visible events) -->
    {#if showLabels}
      {#each visibleEvents as event (event.time + event.title + event.row)}
        {@const sx = screenX(event.time, viewState, viewportWidth)}
        {@const rowEntry = getRowEntry(rowLayout, event.row)}
        {#if rowEntry && sx > rowLayout.labelColumnWidth && sx < viewportWidth}
          <div
            class="event-label"
            class:dimmed={indiaFilterActive && !event.india}
            style="
              left:{sx + 8}px;
              top:{rowEntry.centreY - 18}px;
              color:{rowEntry.definition.textColor === '#ffffff' ? '#e8eaf6' : rowEntry.definition.textColor};
            "
            aria-hidden="true"
          >
            <span class="label-title">{event.title}</span>
            {#if showAgeLabel && event.age}
              <span class="label-age">{event.age}</span>
            {/if}
          </div>
        {/if}
      {/each}
    {/if}
  </div>

  <!-- Sticky left label column -->
  <div
    class="label-column"
    style="width:{rowLayout.labelColumnWidth}px"
  >
    {#each rowLayout.rows as row}
      <div
        class="label-cell"
        style="
          height:{row.height}px;
          background:{row.definition.background};
          color:{row.definition.textColor};
          border-right:2px solid rgba(0,0,0,0.2);
        "
      >
        {#if row.definition.label}
          <span class="label-text">{row.definition.label}</span>
        {/if}
        {#if row.definition.subLabel && !row.definition.label}
          <span class="label-sub">{row.definition.subLabel}</span>
        {:else if row.definition.subLabel}
          <span class="label-sub">{row.definition.subLabel}</span>
        {/if}
      </div>
    {/each}
  </div>
</div>

<!-- HUD (fixed overlay) -->
<HUD
  {viewState}
  {viewportWidth}
  {indiaFilterActive}
  {listViewActive}
  {isMobile}
  on:reset={handleReset}
  on:toggleIndia={() => { indiaFilterActive = !indiaFilterActive; canvasRenderer?.markDirty(); }}
  on:toggleListView={() => { listViewActive = !listViewActive; }}
/>

<!-- Detail Panel -->
{#if selectedEvent}
  <DetailPanel
    event={selectedEvent}
    anchorX={selectedMarkerX}
    anchorY={selectedMarkerY}
    {viewportWidth}
    {viewportHeight}
    {isMobile}
    on:close={() => { selectedEvent = null; canvasRenderer?.markDirty(); }}
  />
{/if}

<!-- List View -->
{#if listViewActive}
  <ListView
    {events}
    on:selectEvent={(e) => {
      selectedEvent = e.detail;
      selectedMarkerX = screenX(e.detail.time, viewState, viewportWidth);
      const rowEntry = getRowEntry(rowLayout, e.detail.row);
      selectedMarkerY = rowEntry?.centreY ?? viewportHeight / 2;
      listViewActive = false;
    }}
  />
{/if}

<style>
  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #05070f;
    color: #e8eaf6;
  }

  .timeline-container {
    position: fixed;
    top: 0;
    left: 0;
    overflow: hidden;
    cursor: grab;
    user-select: none;
    touch-action: none;
  }

  .timeline-container:active {
    cursor: grabbing;
  }

  .canvas-layer {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 2;
    pointer-events: none;
  }

  .rows-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
  }

  .row-band {
    position: absolute;
    opacity: 0.35;
  }

  .label-column {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    z-index: 10;
    display: flex;
    flex-direction: column;
    pointer-events: none;
  }

  .label-cell {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 2px 4px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .label-text {
    font-family: system-ui, sans-serif;
    font-size: 9px;
    font-weight: 700;
    line-height: 1.2;
    white-space: pre-line;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .label-sub {
    font-family: system-ui, sans-serif;
    font-size: 8px;
    opacity: 0.75;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .event-label {
    position: absolute;
    pointer-events: none;
    z-index: 5;
    display: flex;
    flex-direction: column;
    gap: 1px;
    max-width: 120px;
    transition: opacity 0.2s;
  }

  .event-label.dimmed {
    opacity: 0.15;
  }

  .label-title {
    font-family: system-ui, sans-serif;
    font-size: 9px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background: rgba(5,7,15,0.7);
    padding: 1px 3px;
    border-radius: 2px;
    max-width: 120px;
  }

  .label-age {
    font-family: system-ui, sans-serif;
    font-size: 8px;
    opacity: 0.7;
    white-space: nowrap;
    background: rgba(5,7,15,0.5);
    padding: 1px 3px;
    border-radius: 2px;
  }
</style>
