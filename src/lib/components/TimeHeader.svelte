<script lang="ts">
  /**
   * TimeHeader.svelte
   * Renders the dual time-reference header rows (From Current Era + From Big Bang)
   * plus Unit and Scale rows. Updates reactively on every pan/zoom.
   */
  import { centreTimeFromState } from '$lib/navigator/navigator.js';
  import type { ViewState } from '$lib/math/axis.js';
  import { getScaleLevel } from '$lib/layout/rows.js';

  export let viewState: ViewState;
  export let viewportWidth: number;
  export let labelColumnWidth: number;

  // ── Time formatting helpers ───────────────────────────────────────────────

  function getScaleLabel(t: number): string {
    const abs = Math.abs(t);
    if (abs >= 1e9)  return 'Cosmic / Galactic';
    if (abs >= 1e6)  return 'Geological';
    if (abs >= 1e3)  return 'Historical';
    if (abs >= 100)  return 'Modern';
    return 'Present';
  }

  function getUnitLabel(t: number): string {
    const abs = Math.abs(t);
    if (abs >= 1e9)  return 'Billions of Years';
    if (abs >= 1e6)  return 'Millions of Years';
    if (abs >= 1e3)  return 'Thousands of Years';
    return 'Years';
  }

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
    if (abs >= 1e9)  return `${sign}${(abs / 1e9).toPrecision(3)} Billion Years`;
    if (abs >= 1e6)  return `${sign}${(abs / 1e6).toPrecision(3)} Million Years`;
    if (abs >= 1e3)  return `${sign}${Math.round(abs / 1e3)}k Years`;
    return `${sign}${Math.round(abs)} Years`;
  }

  // Big Bang offset: 13.8 billion years ago
  const BIG_BANG_OFFSET = 13.8e9;

  function fromBigBang(t: number): number {
    return BIG_BANG_OFFSET + t;
  }

  // ── Reactive computations ─────────────────────────────────────────────────

  $: centreT = centreTimeFromState(viewState, viewportWidth);
  $: bbT = fromBigBang(centreT);

  $: eraActual   = getActualValue(centreT);
  $: eraPower    = getPowerOf10(centreT);
  $: eraMulti    = getMultiplier(centreT);

  $: bbActual    = getActualValue(bbT);
  $: bbPower     = getPowerOf10(bbT);
  $: bbMulti     = getMultiplier(bbT);

  $: unitLabel   = getUnitLabel(centreT);
  $: scaleLabel  = getScaleLabel(centreT);
</script>

<div class="time-header" style="--label-w: {labelColumnWidth}px">
  <!-- From Current Era rows (green) -->
  <div class="header-row era-power">
    <div class="row-label era-label">From Current Era</div>
    <div class="row-value">Power of 10: <strong>{eraPower}</strong></div>
  </div>
  <div class="header-row era-multi">
    <div class="row-label"></div>
    <div class="row-value">Multiplier: <strong>{eraMulti}</strong></div>
  </div>
  <div class="header-row era-actual">
    <div class="row-label"></div>
    <div class="row-value actual"><strong>{eraActual}</strong></div>
  </div>

  <!-- From Big Bang rows (amber) -->
  <div class="header-row bb-power">
    <div class="row-label bb-label">From Big Bang</div>
    <div class="row-value">Power of 10: <strong>{bbPower}</strong></div>
  </div>
  <div class="header-row bb-multi">
    <div class="row-label"></div>
    <div class="row-value">Multiplier: <strong>{bbMulti}</strong></div>
  </div>
  <div class="header-row bb-actual">
    <div class="row-label"></div>
    <div class="row-value actual"><strong>{bbActual}</strong></div>
  </div>

  <!-- Unit row -->
  <div class="header-row unit-row">
    <div class="row-label unit-label">Unit</div>
    <div class="row-value">{unitLabel}</div>
  </div>

  <!-- Scale row -->
  <div class="header-row scale-row">
    <div class="row-label scale-label">Scale</div>
    <div class="row-value">{scaleLabel}</div>
  </div>
</div>

<style>
  .time-header {
    width: 100%;
    font-family: system-ui, sans-serif;
    font-size: 11px;
  }

  .header-row {
    display: flex;
    align-items: center;
    height: 100%;
    min-height: 22px;
    border-bottom: 1px solid rgba(0,0,0,0.1);
  }

  .row-label {
    width: var(--label-w);
    min-width: var(--label-w);
    padding: 2px 6px;
    font-weight: 700;
    font-size: 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border-right: 1px solid rgba(0,0,0,0.15);
  }

  .row-value {
    flex: 1;
    padding: 2px 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row-value.actual { font-size: 12px; }

  /* From Current Era — green */
  .era-power, .era-multi { background: #c8e6c9; color: #1b5e20; }
  .era-actual            { background: #a5d6a7; color: #1b5e20; }
  .era-label             { color: #1b5e20; }

  /* From Big Bang — amber */
  .bb-power, .bb-multi   { background: #fff9c4; color: #e65100; }
  .bb-actual             { background: #fff176; color: #e65100; }
  .bb-label              { color: #e65100; }

  /* Unit / Scale — neutral */
  .unit-row  { background: #f5f5f5; color: #424242; }
  .scale-row { background: #eeeeee; color: #424242; }
  .unit-label, .scale-label { color: #424242; }
</style>
