<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { gsap } from 'gsap';

  import type { ChronoEvent } from '$lib/data/types.js';
  import type { ViewState } from '$lib/math/axis.js';
  import { screenX, txInverse } from '$lib/math/axis.js';
  import { computeRowLayout, getScaleLevel, getRowEntry, ROW_DEFINITIONS } from '$lib/layout/rows.js';
  import { createNavigator } from '$lib/navigator/gsap-observer.js';
  import { resetView, centreTimeFromState } from '$lib/navigator/navigator.js';
  import { CanvasRenderer, drawMarkers, drawLongitudeLines } from '$lib/renderer/canvas-layer.js';
  import { hitTest } from '$lib/hit-tester/hit-tester.js';
  import { formatTime } from '$lib/math/axis.js';

  import HUD from '$lib/components/HUD.svelte';
  import DetailPanel from '$lib/components/DetailPanel.svelte';
  import ListView from '$lib/components/ListView.svelte';

  // ── Page data ──────────────────────────────────────────────────────────────
  export let data: { events: ChronoEvent[] };
  $: events = data.events;

  // ── Viewport state ─────────────────────────────────────────────────────────
  let vw = 1280;
  let vh = 800;
  let isMobile = false;

  // ── Navigation state ───────────────────────────────────────────────────────
  let viewState: ViewState = { panX: 0, zoomScale: 1 };

  // ── UI state ───────────────────────────────────────────────────────────────
  let indiaFilterActive = false;
  let listViewActive = false;
  let selectedEvent: ChronoEvent | null = null;
  let selectedMarkerX = 0;
  let selectedMarkerY = 0;

  // ── DOM refs ───────────────────────────────────────────────────────────────
  let containerEl: HTMLDivElement;
  let canvasEl: HTMLCanvasElement;

  // ── Renderer & Navigator ───────────────────────────────────────────────────
  let canvasRenderer: CanvasRenderer | null = null;
  let destroyNavigator: (() => void) | null = null;

  // ── Derived layout ─────────────────────────────────────────────────────────
  $: rowLayout = computeRowLayout(vw, vh);
  $: scaleLevel = getScaleLevel(viewState.zoomScale);
  $: showLabels = scaleLevel !== 'overview';
  $: showAgeLabel = scaleLevel === 'period' || scaleLevel === 'decade' || scaleLevel === 'year';

  // ── Visible events (viewport-culled) ──────────────────────────────────────
  $: visibleEvents = events.filter(e => {
    const sx = screenX(e.time, viewState, vw);
    return sx >= -40 && sx <= vw + 40;
  });

  // ── Time header values (reactive to pan/zoom) ──────────────────────────────
  $: centreT = centreTimeFromState(viewState, vw);
  $: timeLabel = formatTime(centreT);

  function getPowerOf10(t: number): string {
    if (t === 0) return '0';
    const abs = Math.abs(t);
    const exp = Math.floor(Math.log10(abs));
    return `10^${exp}`;
  }
  function getMultiplier(t: number): string {
    if (t === 0) return '0';
    const abs = Math.abs(t);
    const exp = Math.floor(Math.log10(abs));
    const mult = abs / Math.pow(10, exp);
    return mult.toFixed(2).replace(/\.?0+$/, '');
  }
  function getActualValue(t: number): string {
    if (t === 0) return 'Present';
    const abs = Math.abs(t);
    const sign = t < 0 ? '−' : '+';
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toPrecision(3)} Billion Yrs`;
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toPrecision(3)} Million Yrs`;
    if (abs >= 1e3) return `${sign}${Math.round(abs / 1e3)}k Yrs`;
    return `${sign}${Math.round(abs)} Yrs`;
  }
  function getUnitLabel(t: number): string {
    const abs = Math.abs(t);
    if (abs >= 1e9) return 'Billions of Years';
    if (abs >= 1e6) return 'Millions of Years';
    if (abs >= 1e3) return 'Thousands of Years';
    return 'Years';
  }
  function getScaleLabel(t: number): string {
    const abs = Math.abs(t);
    if (abs >= 1e9) return 'Cosmic / Galactic';
    if (abs >= 1e6) return 'Geological';
    if (abs >= 1e3) return 'Historical';
    if (abs >= 100) return 'Modern';
    return 'Present';
  }

  const BIG_BANG_OFFSET = 13.8e9;
  $: bbT = BIG_BANG_OFFSET + centreT;

  $: eraActual  = getActualValue(centreT);
  $: eraPower   = getPowerOf10(centreT);
  $: eraMulti   = getMultiplier(centreT);
  $: bbActual   = getActualValue(bbT);
  $: bbPower    = getPowerOf10(bbT);
  $: bbMulti    = getMultiplier(bbT);
  $: unitLabel  = getUnitLabel(centreT);
  $: scaleLabel = getScaleLabel(centreT);

  // Age lookup
  const AGE_TABLE: Array<{ from: number; to: number; label: string }> = [
    { from: -Infinity, to: -13.77e9, label: 'Planck / Inflationary Epoch' },
    { from: -13.77e9,  to: -13.4e9,  label: 'Recombination / Dark Ages' },
    { from: -13.4e9,   to: -11e9,    label: 'Cosmic Dawn / Reionization' },
    { from: -11e9,     to: -5e9,     label: 'Galactic Age' },
    { from: -5e9,      to: -4.6e9,   label: 'Pre-Solar' },
    { from: -4.6e9,    to: -4e9,     label: 'Hadean' },
    { from: -4e9,      to: -3.6e9,   label: 'Eoarchean' },
    { from: -3.6e9,    to: -3.2e9,   label: 'Paleoarchean' },
    { from: -3.2e9,    to: -2.8e9,   label: 'Mesoarchean' },
    { from: -2.8e9,    to: -2.5e9,   label: 'Neoarchean' },
    { from: -2.5e9,    to: -1.6e9,   label: 'Paleoproterozoic' },
    { from: -1.6e9,    to: -1e9,     label: 'Mesoproterozoic' },
    { from: -1e9,      to: -541e6,   label: 'Neoproterozoic' },
    { from: -541e6,    to: -485e6,   label: 'Cambrian' },
    { from: -485e6,    to: -443e6,   label: 'Ordovician' },
    { from: -443e6,    to: -419e6,   label: 'Silurian' },
    { from: -419e6,    to: -359e6,   label: 'Devonian' },
    { from: -359e6,    to: -299e6,   label: 'Carboniferous' },
    { from: -299e6,    to: -252e6,   label: 'Permian' },
    { from: -252e6,    to: -201e6,   label: 'Triassic' },
    { from: -201e6,    to: -145e6,   label: 'Jurassic' },
    { from: -145e6,    to: -66e6,    label: 'Cretaceous' },
    { from: -66e6,     to: -56e6,    label: 'Paleocene' },
    { from: -56e6,     to: -34e6,    label: 'Eocene' },
    { from: -34e6,     to: -23e6,    label: 'Oligocene' },
    { from: -23e6,     to: -5.3e6,   label: 'Miocene' },
    { from: -5.3e6,    to: -2.6e6,   label: 'Pliocene' },
    { from: -2.6e6,    to: -11700,   label: 'Pleistocene' },
    { from: -11700,    to: -3300,    label: 'Mesolithic / Neolithic' },
    { from: -3300,     to: -1200,    label: 'Bronze Age' },
    { from: -1200,     to: -550,     label: 'Iron Age' },
    { from: -550,      to: -323,     label: 'Classical Antiquity' },
    { from: -323,      to: 476,      label: 'Hellenistic / Roman Era' },
    { from: 476,       to: 1453,     label: 'Medieval Age' },
    { from: 1453,      to: 1760,     label: 'Early Modern' },
    { from: 1760,      to: 1900,     label: 'Industrial Age' },
    { from: 1900,      to: 1945,     label: '20th Century (Early)' },
    { from: 1945,      to: 1991,     label: 'Atomic / Cold War Age' },
    { from: 1991,      to: 2026,     label: 'Information Age' },
    { from: 2026,      to: 2100,     label: 'AI Age' },
    { from: 2100,      to: 5e9,      label: 'Space Age' },
    { from: 5e9,       to: Infinity, label: 'Deep Future' },
  ];
  function getAge(t: number): string {
    for (const e of AGE_TABLE) {
      if (t >= e.from && t < e.to) return e.label;
    }
    return '—';
  }
  $: ageLabel = getAge(centreT);

  // ── Canvas draw ────────────────────────────────────────────────────────────
  function draw(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, vw, vh);
    drawLongitudeLines(ctx, viewState, vw, vh);
    drawMarkers({
      ctx,
      events: visibleEvents,
      viewState,
      rowLayout,
      scaleLevel,
      viewportWidth: vw,
      viewportHeight: vh,
      selectedEvent,
      indiaFilterActive,
    });
  }

  // ── Resize ─────────────────────────────────────────────────────────────────
  function handleResize() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    isMobile = vw < 600;
    if (canvasEl) {
      canvasEl.width = vw;
      canvasEl.height = vh;
    }
    canvasRenderer?.markDirty();
  }

  // ── Pointer / click ────────────────────────────────────────────────────────
  function handlePointerDown(e: PointerEvent) {
    const isTouch = e.pointerType === 'touch';
    const result = hitTest(e.clientX, e.clientY, visibleEvents, viewState, rowLayout, isTouch, vw, vh);
    if (result.event) {
      selectedEvent = result.event;
      selectedMarkerX = screenX(result.event.time, viewState, vw);
      selectedMarkerY = getRowEntry(rowLayout, result.event.row)?.centreY ?? e.clientY;
      canvasRenderer?.markDirty();
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  function handleReset() {
    const target = resetView(vw);
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

  // ── Mount ──────────────────────────────────────────────────────────────────
  onMount(() => {
    vw = window.innerWidth;
    vh = window.innerHeight;
    isMobile = vw < 600;

    canvasEl.width = vw;
    canvasEl.height = vh;

    canvasRenderer = new CanvasRenderer(canvasEl);
    canvasRenderer.onDraw = draw;

    destroyNavigator = createNavigator({
      container: containerEl,
      getViewState: () => viewState,
      setViewState: (s) => { viewState = s; canvasRenderer?.markDirty(); },
      getViewportWidth: () => vw,
      onReset: handleReset,
    });

    window.addEventListener('resize', handleResize);
    canvasRenderer.markDirty();
  });

  onDestroy(() => {
    window.removeEventListener('resize', handleResize);
    destroyNavigator?.();
    canvasRenderer?.destroy();
  });

  // Re-draw on state changes
  $: if (canvasRenderer) {
    canvasRenderer.onDraw = draw;
    canvasRenderer.markDirty();
  }
</script>

<!-- ═══════════════════════════════════════════════════════════════════════════
     LAYOUT: fixed full-screen container
     ─────────────────────────────────────────────────────────────────────── -->
<div
  bind:this={containerEl}
  class="timeline-root"
  role="region"
  aria-label="Chrono of Life interactive timeline"
  on:pointerdown={handlePointerDown}
>

  <!-- ── Row bands + label column ─────────────────────────────────────────── -->
  <div class="rows-layer" aria-hidden="true">
    {#each rowLayout.rows as row (row.key)}
      <div
        class="row-band"
        style="
          top: {row.y}px;
          height: {row.height}px;
          left: {rowLayout.labelColumnWidth}px;
          background: {row.definition.background};
        "
      ></div>
    {/each}

    <!-- Event text labels (shown at era+ zoom) -->
    {#if showLabels}
      {#each visibleEvents as event (event.time + '|' + event.title + '|' + event.row)}
        {@const sx = screenX(event.time, viewState, vw)}
        {@const rowEntry = getRowEntry(rowLayout, event.row)}
        {#if rowEntry && sx > rowLayout.labelColumnWidth + 4 && sx < vw - 4}
          <div
            class="event-label"
            class:dimmed={indiaFilterActive && !event.india}
            style="left: {sx + 8}px; top: {rowEntry.centreY - 16}px;"
            aria-hidden="true"
          >
            <span class="label-title" style="color: {rowEntry.definition.textColor === '#ffffff' ? '#e8eaf6' : rowEntry.definition.textColor}">
              {event.title}
            </span>
            {#if showAgeLabel && event.age}
              <span class="label-age">{event.age}</span>
            {/if}
          </div>
        {/if}
      {/each}
    {/if}
  </div>

  <!-- ── Sticky left label column ─────────────────────────────────────────── -->
  <div class="label-column" style="width: {rowLayout.labelColumnWidth}px;" aria-hidden="true">
    {#each rowLayout.rows as row (row.key)}
      <div
        class="label-cell"
        style="
          height: {row.height}px;
          background: {row.definition.background};
          color: {row.definition.textColor};
        "
      >
        <!-- Inline time-header values for header rows -->
        {#if row.key === 'header_era_power'}
          <span class="lc-title">From Current Era</span>
          <span class="lc-val">{eraPower}</span>
        {:else if row.key === 'header_era_multiplier'}
          <span class="lc-sub">×{eraMulti}</span>
        {:else if row.key === 'header_era_actual'}
          <span class="lc-actual">{eraActual}</span>
        {:else if row.key === 'header_bb_power'}
          <span class="lc-title">From Big Bang</span>
          <span class="lc-val">{bbPower}</span>
        {:else if row.key === 'header_bb_multiplier'}
          <span class="lc-sub">×{bbMulti}</span>
        {:else if row.key === 'header_bb_actual'}
          <span class="lc-actual">{bbActual}</span>
        {:else if row.key === 'unit'}
          <span class="lc-title">Unit</span>
          <span class="lc-sub">{unitLabel}</span>
        {:else if row.key === 'scale_row'}
          <span class="lc-title">Scale</span>
          <span class="lc-sub">{scaleLabel}</span>
        {:else if row.key === 'age'}
          <span class="lc-title">Age</span>
          <span class="lc-sub age-text">{ageLabel}</span>
        {:else if row.definition.label}
          <span class="lc-title">{row.definition.label}</span>
          {#if row.definition.subLabel}
            <span class="lc-sub">{row.definition.subLabel}</span>
          {/if}
        {:else if row.definition.subLabel}
          <span class="lc-sub">{row.definition.subLabel}</span>
        {/if}
      </div>
    {/each}
  </div>

  <!-- ── Canvas (markers + longitude lines) ───────────────────────────────── -->
  <canvas bind:this={canvasEl} class="canvas-layer" aria-hidden="true"></canvas>

</div>

<!-- ── HUD overlay (outside container to avoid stacking context issues) ─── -->
<HUD
  {viewState}
  viewportWidth={vw}
  {indiaFilterActive}
  {listViewActive}
  {isMobile}
  on:reset={handleReset}
  on:toggleIndia={() => { indiaFilterActive = !indiaFilterActive; canvasRenderer?.markDirty(); }}
  on:toggleListView={() => { listViewActive = !listViewActive; }}
/>

<!-- ── Detail panel ────────────────────────────────────────────────────────── -->
{#if selectedEvent}
  <DetailPanel
    event={selectedEvent}
    anchorX={selectedMarkerX}
    anchorY={selectedMarkerY}
    viewportWidth={vw}
    viewportHeight={vh}
    {isMobile}
    on:close={() => { selectedEvent = null; canvasRenderer?.markDirty(); }}
  />
{/if}

<!-- ── List view ───────────────────────────────────────────────────────────── -->
{#if listViewActive}
  <ListView
    {events}
    on:selectEvent={(e) => {
      selectedEvent = e.detail;
      selectedMarkerX = screenX(e.detail.time, viewState, vw);
      selectedMarkerY = getRowEntry(rowLayout, e.detail.row)?.centreY ?? vh / 2;
      listViewActive = false;
    }}
  />
{/if}

<style>
  /* ── Global resets ────────────────────────────────────────────────────── */
  :global(*, *::before, *::after) { box-sizing: border-box; }
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #05070f;
    color: #e8eaf6;
    font-family: system-ui, -apple-system, sans-serif;
  }

  /* ── Root container ───────────────────────────────────────────────────── */
  .timeline-root {
    position: fixed;
    inset: 0;
    overflow: hidden;
    cursor: grab;
    user-select: none;
    touch-action: none;
    background: #05070f;
  }
  .timeline-root:active { cursor: grabbing; }

  /* ── Row bands layer ──────────────────────────────────────────────────── */
  .rows-layer {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
  }

  .row-band {
    position: absolute;
    right: 0;
    /* Full opacity — rows ARE the background */
  }

  /* ── Label column ─────────────────────────────────────────────────────── */
  .label-column {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    border-right: 2px solid rgba(0, 0, 0, 0.3);
    pointer-events: none;
    overflow: hidden;
  }

  .label-cell {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 2px 5px;
    overflow: hidden;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  }

  .lc-title {
    font-size: 8px;
    font-weight: 700;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0.9;
  }
  .lc-val {
    font-size: 9px;
    font-weight: 600;
    font-family: monospace;
    white-space: nowrap;
  }
  .lc-sub {
    font-size: 8px;
    opacity: 0.75;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lc-actual {
    font-size: 8px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .age-text {
    font-size: 7px;
    font-weight: 600;
    color: #33691e;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Canvas ───────────────────────────────────────────────────────────── */
  .canvas-layer {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    /* width/height set imperatively in onMount + handleResize */
  }

  /* ── Event labels ─────────────────────────────────────────────────────── */
  .event-label {
    position: absolute;
    z-index: 5;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 1px;
    max-width: 130px;
    transition: opacity 0.15s;
  }
  .event-label.dimmed { opacity: 0.15; }

  .label-title {
    font-size: 9px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background: rgba(5, 7, 15, 0.72);
    padding: 1px 3px;
    border-radius: 2px;
    max-width: 130px;
  }
  .label-age {
    font-size: 8px;
    opacity: 0.7;
    white-space: nowrap;
    background: rgba(5, 7, 15, 0.5);
    padding: 1px 3px;
    border-radius: 2px;
  }
</style>
