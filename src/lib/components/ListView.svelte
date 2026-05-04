<script lang="ts">
  /**
   * ListView.svelte
   * Accessible linear table view of all events — keyboard navigable alternative to ZUI.
   */
  import { createEventDispatcher } from 'svelte';
  import { formatTime } from '$lib/math/axis.js';
  import type { ChronoEvent } from '$lib/data/types.js';

  export let events: ChronoEvent[] = [];

  const dispatch = createEventDispatcher<{ selectEvent: ChronoEvent }>();

  function onRowKeyDown(e: KeyboardEvent, event: ChronoEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      dispatch('selectEvent', event);
    }
  }

  function rowLabel(row: string): string {
    const map: Record<string, string> = {
      physical:      'Physical',
      evolution:     'Evolution',
      science:       'Science',
      india:         'India',
      world_asia:    'World / Asia',
      world_europe:  'World / Europe',
      world_america: 'World / America',
    };
    return map[row] ?? row;
  }
</script>

<div class="list-view" role="region" aria-label="Timeline events list">
  <div class="list-header">
    <h2>All Events ({events.length})</h2>
    <p class="hint">Press Enter on any row to view details.</p>
  </div>

  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th scope="col">Time</th>
          <th scope="col">Title</th>
          <th scope="col">Category</th>
          <th scope="col">Age</th>
          <th scope="col">India</th>
          <th scope="col">World</th>
        </tr>
      </thead>
      <tbody>
        {#each events as event (event.time + event.title + event.row)}
          <tr
            tabindex="0"
            role="button"
            aria-label="View details for {event.title}"
            on:click={() => dispatch('selectEvent', event)}
            on:keydown={(e) => onRowKeyDown(e, event)}
            class="event-row row-{event.row}"
          >
            <td class="time-cell">{formatTime(event.time)}</td>
            <td class="title-cell">{event.title}</td>
            <td class="cat-cell">{rowLabel(event.row)}</td>
            <td class="age-cell">{event.age ?? '—'}</td>
            <td class="india-cell">{event.india ?? '—'}</td>
            <td class="world-cell">{event.world ?? '—'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .list-view {
    position: fixed;
    inset: 0;
    z-index: 80;
    background: #05070f;
    color: #e8eaf6;
    font-family: system-ui, sans-serif;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .list-header {
    padding: 48px 16px 8px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    flex-shrink: 0;
  }

  .list-header h2 {
    margin: 0 0 4px;
    font-size: 18px;
    color: #fff;
  }

  .hint {
    margin: 0;
    font-size: 12px;
    color: rgba(255,255,255,0.4);
  }

  .table-wrapper {
    flex: 1;
    overflow-y: auto;
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  thead th {
    position: sticky;
    top: 0;
    background: #0d1117;
    color: #90caf9;
    padding: 8px 10px;
    text-align: left;
    font-weight: 600;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    white-space: nowrap;
  }

  .event-row {
    cursor: pointer;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    transition: background 0.1s;
  }

  .event-row:hover,
  .event-row:focus {
    background: rgba(255,255,255,0.06);
    outline: 1px solid rgba(100,181,246,0.5);
  }

  td {
    padding: 6px 10px;
    vertical-align: top;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .time-cell  { color: #90caf9; white-space: nowrap; }
  .title-cell { font-weight: 600; color: #fff; max-width: 240px; }
  .cat-cell   { color: #b0bec5; }
  .age-cell   { color: #a5d6a7; }
  .india-cell { color: #FF9933; }
  .world-cell { color: #b0bec5; }

  /* Row colour accents */
  .row-india         td:first-child { border-left: 3px solid #FF9933; }
  .row-physical      td:first-child { border-left: 3px solid #4caf50; }
  .row-evolution     td:first-child { border-left: 3px solid #ff9800; }
  .row-science       td:first-child { border-left: 3px solid #2196f3; }
  .row-world_asia    td:first-child { border-left: 3px solid #90caf9; }
  .row-world_europe  td:first-child { border-left: 3px solid #80cbc4; }
  .row-world_america td:first-child { border-left: 3px solid #ce93d8; }
</style>
