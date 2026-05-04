<script lang="ts">
  /**
   * AgeRow.svelte
   * Row 21 — displays the geological/historical age for the current viewport centre.
   */
  import { centreTimeFromState } from '$lib/navigator/navigator.js';
  import type { ViewState } from '$lib/math/axis.js';

  export let viewState: ViewState;
  export let viewportWidth: number;
  export let labelColumnWidth: number;

  // Age lookup table — ordered from oldest to newest
  const AGE_TABLE: Array<{ from: number; to: number; label: string }> = [
    { from: -Infinity,  to: -13.77e9, label: 'Planck / Inflationary Epoch' },
    { from: -13.77e9,   to: -13.4e9,  label: 'Recombination / Dark Ages' },
    { from: -13.4e9,    to: -11e9,    label: 'Cosmic Dawn / Reionization' },
    { from: -11e9,      to: -5e9,     label: 'Galactic Age' },
    { from: -5e9,       to: -4.6e9,   label: 'Pre-Solar' },
    { from: -4.6e9,     to: -4e9,     label: 'Hadean' },
    { from: -4e9,       to: -3.6e9,   label: 'Eoarchean' },
    { from: -3.6e9,     to: -3.2e9,   label: 'Paleoarchean' },
    { from: -3.2e9,     to: -2.8e9,   label: 'Mesoarchean' },
    { from: -2.8e9,     to: -2.5e9,   label: 'Neoarchean' },
    { from: -2.5e9,     to: -1.6e9,   label: 'Paleoproterozoic' },
    { from: -1.6e9,     to: -1e9,     label: 'Mesoproterozoic' },
    { from: -1e9,       to: -541e6,   label: 'Neoproterozoic' },
    { from: -541e6,     to: -485e6,   label: 'Cambrian' },
    { from: -485e6,     to: -443e6,   label: 'Ordovician' },
    { from: -443e6,     to: -419e6,   label: 'Silurian' },
    { from: -419e6,     to: -359e6,   label: 'Devonian' },
    { from: -359e6,     to: -299e6,   label: 'Carboniferous' },
    { from: -299e6,     to: -252e6,   label: 'Permian' },
    { from: -252e6,     to: -201e6,   label: 'Triassic' },
    { from: -201e6,     to: -145e6,   label: 'Jurassic' },
    { from: -145e6,     to: -66e6,    label: 'Cretaceous' },
    { from: -66e6,      to: -56e6,    label: 'Paleocene' },
    { from: -56e6,      to: -34e6,    label: 'Eocene' },
    { from: -34e6,      to: -23e6,    label: 'Oligocene' },
    { from: -23e6,      to: -5.3e6,   label: 'Miocene' },
    { from: -5.3e6,     to: -2.6e6,   label: 'Pliocene' },
    { from: -2.6e6,     to: -11700,   label: 'Pleistocene' },
    { from: -11700,     to: -3300,    label: 'Mesolithic / Neolithic' },
    { from: -3300,      to: -1200,    label: 'Bronze Age' },
    { from: -1200,      to: -550,     label: 'Iron Age' },
    { from: -550,       to: -323,     label: 'Classical Antiquity' },
    { from: -323,       to: 476,      label: 'Hellenistic / Roman Era' },
    { from: 476,        to: 1453,     label: 'Medieval Age' },
    { from: 1453,       to: 1760,     label: 'Early Modern' },
    { from: 1760,       to: 1900,     label: 'Industrial Age' },
    { from: 1900,       to: 1945,     label: '20th Century (Early)' },
    { from: 1945,       to: 1991,     label: 'Atomic / Cold War Age' },
    { from: 1991,       to: 2026,     label: 'Information Age' },
    { from: 2026,       to: 2100,     label: 'AI Age' },
    { from: 2100,       to: 5e9,      label: 'Space Age' },
    { from: 5e9,        to: Infinity, label: 'Deep Future' },
  ];

  function getAge(t: number): string {
    for (const entry of AGE_TABLE) {
      if (t >= entry.from && t < entry.to) return entry.label;
    }
    return '—';
  }

  $: centreT = centreTimeFromState(viewState, viewportWidth);
  $: ageLabel = getAge(centreT);
</script>

<div class="age-row" style="--label-w: {labelColumnWidth}px">
  <div class="row-label">Age:</div>
  <div class="row-value">{ageLabel}</div>
</div>

<style>
  .age-row {
    display: flex;
    align-items: center;
    min-height: 22px;
    background: #f1f8e9;
    border-top: 1px solid rgba(0,0,0,0.1);
    font-family: system-ui, sans-serif;
    font-size: 11px;
  }

  .row-label {
    width: var(--label-w);
    min-width: var(--label-w);
    padding: 2px 6px;
    font-weight: 700;
    color: #33691e;
    border-right: 1px solid rgba(0,0,0,0.1);
    white-space: nowrap;
  }

  .row-value {
    flex: 1;
    padding: 2px 8px;
    color: #33691e;
    font-weight: 600;
    font-size: 12px;
  }
</style>
