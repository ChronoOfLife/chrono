<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fetchWikiSummary } from '$lib/wikipedia/fetcher.js';
  import type { ChronoEvent } from '$lib/data/types.js';

  export let event: ChronoEvent | null = null;
  export let anchorX = 0;   // screen X of the selected marker
  export let anchorY = 0;   // screen Y of the selected marker
  export let viewportWidth = 800;
  export let viewportHeight = 600;
  export let isMobile = false;

  const dispatch = createEventDispatcher<{ close: void }>();

  let wikiExtract = '';
  let wikiThumb = '';
  let loading = false;
  let panelEl: HTMLElement;

  // Panel dimensions (estimated)
  const PANEL_W = 340;
  const PANEL_H = 320;

  // Compute panel position — float near marker, stay in viewport
  $: panelStyle = computePanelStyle(anchorX, anchorY, viewportWidth, viewportHeight, isMobile);

  function computePanelStyle(ax: number, ay: number, vw: number, vh: number, mobile: boolean): string {
    if (mobile) {
      // Bottom sheet on mobile
      return `position:fixed;left:0;right:0;bottom:0;width:100%;max-height:50vh;border-radius:16px 16px 0 0;`;
    }

    let left = ax + 16;
    let top = ay - PANEL_H / 2;

    // Keep within viewport
    if (left + PANEL_W > vw - 8) left = ax - PANEL_W - 16;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    if (top + PANEL_H > vh - 8) top = vh - PANEL_H - 8;

    return `position:fixed;left:${left}px;top:${top}px;width:${PANEL_W}px;`;
  }

  // Fetch Wikipedia content whenever event changes
  $: if (event) {
    wikiExtract = '';
    wikiThumb = '';
    loadWiki(event);
  }

  async function loadWiki(ev: ChronoEvent) {
    if (!ev.link) return;
    loading = true;
    // Extract article title from Wikipedia URL
    const urlTitle = ev.link.split('/wiki/').pop() ?? ev.title;
    const decoded = decodeURIComponent(urlTitle.replace(/_/g, ' '));
    const summary = await fetchWikiSummary(decoded);
    loading = false;
    if (summary) {
      wikiExtract = summary.extract;
      wikiThumb = summary.thumbnail?.source ?? '';
    }
  }

  function close() {
    dispatch('close');
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  onMount(() => {
    panelEl?.focus();
  });
</script>

<svelte:window on:keydown={onKeyDown} />

{#if event}
  <!-- Backdrop (click outside to close) -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="backdrop"
    on:click={close}
    aria-hidden="true"
  ></div>

  <div
    bind:this={panelEl}
    class="detail-panel"
    class:mobile={isMobile}
    style={panelStyle}
    role="dialog"
    aria-modal="true"
    aria-label="Event details: {event.title}"
    tabindex="-1"
  >
    <!-- Header -->
    <div class="panel-header">
      <div class="panel-meta">
        {#if event.age}
          <span class="badge age">{event.age}</span>
        {/if}
        {#if event.scale}
          <span class="badge scale">{event.scale}</span>
        {/if}
      </div>
      <button
        class="close-btn"
        on:click={close}
        aria-label="Close event details"
      >✕</button>
    </div>

    <!-- Title -->
    <h2 class="panel-title">{event.title}</h2>

    <!-- Thumbnail -->
    {#if wikiThumb}
      <img class="panel-thumb" src={wikiThumb} alt="Illustration for {event.title}" />
    {/if}

    <!-- Content -->
    <div
      class="panel-content"
      aria-live="polite"
      aria-atomic="true"
    >
      {#if loading}
        <p class="loading">Loading Wikipedia summary…</p>
      {:else if wikiExtract}
        <p class="wiki-extract">{wikiExtract}</p>
      {:else if event.india}
        <p class="india-context"><strong>India:</strong> {event.india}</p>
        {#if event.world}
          <p class="world-context"><strong>World:</strong> {event.world}</p>
        {/if}
      {:else if event.world}
        <p class="world-context">{event.world}</p>
      {/if}

      {#if event.india && wikiExtract}
        <p class="india-context"><strong>India:</strong> {event.india}</p>
      {/if}
    </div>

    <!-- Footer -->
    {#if event.link}
      <div class="panel-footer">
        <a
          href={event.link}
          target="_blank"
          rel="noopener noreferrer"
          class="wiki-link"
          aria-label="Read more about {event.title} on Wikipedia"
        >
          Read more on Wikipedia ↗
        </a>
      </div>
    {/if}
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
    background: transparent;
  }

  .detail-panel {
    z-index: 100;
    background: #1a1f2e;
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 12px;
    padding: 16px;
    color: #e8eaf6;
    font-family: system-ui, sans-serif;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    overflow-y: auto;
    max-height: 80vh;
    outline: none;
  }

  .detail-panel.mobile {
    border-radius: 16px 16px 0 0;
    padding: 20px 16px 32px;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }

  .panel-meta {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .badge {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .badge.age {
    background: #33691e;
    color: #ccff90;
  }

  .badge.scale {
    background: #0d47a1;
    color: #90caf9;
  }

  .close-btn {
    background: none;
    border: none;
    color: rgba(255,255,255,0.5);
    cursor: pointer;
    font-size: 16px;
    padding: 0 4px;
    line-height: 1;
    transition: color 0.15s;
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover { color: #fff; }

  .panel-title {
    font-size: 16px;
    font-weight: 700;
    margin: 0 0 10px;
    color: #ffffff;
    line-height: 1.3;
  }

  .panel-thumb {
    width: 100%;
    max-height: 120px;
    object-fit: cover;
    border-radius: 8px;
    margin-bottom: 10px;
  }

  .panel-content {
    font-size: 13px;
    line-height: 1.6;
    color: #b0bec5;
  }

  .loading {
    color: rgba(255,255,255,0.4);
    font-style: italic;
  }

  .wiki-extract {
    margin: 0 0 8px;
  }

  .india-context {
    margin: 6px 0 0;
    color: #FF9933;
    font-size: 12px;
  }

  .world-context {
    margin: 0;
  }

  .panel-footer {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid rgba(255,255,255,0.1);
  }

  .wiki-link {
    color: #64b5f6;
    font-size: 12px;
    text-decoration: none;
    font-weight: 600;
  }

  .wiki-link:hover {
    text-decoration: underline;
    color: #90caf9;
  }
</style>
