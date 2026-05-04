/**
 * axis.ts
 * Piecewise linear time axis for Chrono of Life.
 *
 * Allocates screen-space proportional to event density:
 *   - Modern era (1500–2030 CE): 300px  ← very dense, 180+ events
 *   - Classical/Medieval (-3000–0): 200px ← dense, 200+ events
 *   - Hominin evolution (-10M to -100K): 200px ← medium density
 *   - Cosmic/geological: compressed
 *   - Deep future: moderate space
 *
 * Total logical width at zoom=1: ~1840px
 * Origin (px=0) is at t=0 (year 0 CE / present day).
 */

/** Kept for backward compatibility — not used in piecewise math */
export const K = 120;

/** Hard left boundary: Big Bang */
export const BIG_BANG_TIME = -13.8e9;

/** Hard right boundary: Heat Death of the Universe */
export const HEAT_DEATH_TIME = 1e100; // practical cap; 10^106 exceeds JS float precision

/** ViewState: the single source of truth for navigation */
export interface ViewState {
  panX: number;       // pixel offset of the timeline origin from viewport centre
  zoomScale: number;  // current zoom multiplier, clamped to [MIN_ZOOM, MAX_ZOOM]
}

export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 2000;

// ── Piecewise zone table ──────────────────────────────────────────────────────
// Each entry: { tStart, tEnd, pxStart, pxEnd }
// pxStart/pxEnd are logical pixels at zoom=1, with t=0 (year 0 CE) at px=0
// Zones must be contiguous and cover BIG_BANG_TIME to HEAT_DEATH_TIME

interface PiecewiseZone {
  tStart: number;
  tEnd: number;
  pxStart: number;
  pxEnd: number;
}

/**
 * Build the piecewise zone table.
 * Segments are defined as [tStart, tEnd, pixelWidth].
 * After building, all zones are shifted so that t=0 maps to px=0.
 */
function buildZones(): PiecewiseZone[] {
  // [tStart, tEnd, pixelWidth] — ordered from Big Bang to Heat Death
  const segments: Array<[number, number, number]> = [
    // ── Past (negative time, left of origin) ──────────────────────────────
    [-13.8e9,  -1e9,     200],  // Zone 0: Cosmic/Galactic (Phase 1 sparse)
    [-1e9,     -100e6,   150],  // Zone 1: Geological deep time (Phase 1)
    [-100e6,   -10e6,    150],  // Zone 2: Mesozoic/Cenozoic (Phase 1 dense end)
    [-10e6,    -100e3,   200],  // Zone 3: Hominin evolution (Phase 2)
    [-100e3,   -3000,    150],  // Zone 4: Paleolithic/Neolithic (Phase 2 late)
    [-3000,    0,        200],  // Zone 5: Classical/Medieval BCE (Phase 3)
    // ── Future (positive time, right of origin) ───────────────────────────
    [0,        1500,     80],   // Zone 6: 0 CE to 1500 CE (sparse, pre-modern)
    [1500,     2030,     300],  // Zone 7: Modern era 1500–2030 CE (Phase 4, very dense)
    [2030,     1e4,      80],   // Zone 8: Near future 2030–10000 CE (Phase 5 start)
    [1e4,      1e6,      80],   // Zone 9: Far future 10K–1M CE
    [1e6,      1e9,      100],  // Zone 10: Deep future 1M–1B years
    [1e9,      1e100,    300],  // Zone 11: Deep time (Phase 5 sparse)
  ];

  // First pass: compute raw cumulative pixels from the leftmost point (Big Bang)
  let cumPx = 0;
  const rawZones: PiecewiseZone[] = [];
  for (const [tStart, tEnd, width] of segments) {
    rawZones.push({
      tStart,
      tEnd,
      pxStart: cumPx,
      pxEnd: cumPx + width,
    });
    cumPx += width;
  }

  // Find the raw pixel value at t=0 so we can shift the origin
  const pxAtZero = rawInterpolatePx(rawZones, 0);

  // Second pass: shift all zones so t=0 → px=0
  return rawZones.map(z => ({
    tStart: z.tStart,
    tEnd: z.tEnd,
    pxStart: z.pxStart - pxAtZero,
    pxEnd: z.pxEnd - pxAtZero,
  }));
}

/** Linear interpolation within a raw (unshifted) zone array — used only during buildZones(). */
function rawInterpolatePx(zones: PiecewiseZone[], t: number): number {
  if (t <= zones[0].tStart) return zones[0].pxStart;
  if (t >= zones[zones.length - 1].tEnd) return zones[zones.length - 1].pxEnd;
  for (const z of zones) {
    if (t >= z.tStart && t <= z.tEnd) {
      const frac = (t - z.tStart) / (z.tEnd - z.tStart);
      return z.pxStart + frac * (z.pxEnd - z.pxStart);
    }
  }
  return 0;
}

// Build zones once at module load
const ZONES: PiecewiseZone[] = buildZones();

/**
 * Map a time value (years CE, negative = BCE) to a logical pixel position.
 * Origin (px=0) is at t=0 (year 0 CE / present day).
 */
export function tx(t: number): number {
  if (t <= ZONES[0].tStart) return ZONES[0].pxStart;
  if (t >= ZONES[ZONES.length - 1].tEnd) return ZONES[ZONES.length - 1].pxEnd;
  for (let i = 0; i < ZONES.length; i++) {
    const z = ZONES[i];
    // Use strict upper bound for all zones except the last, so boundary values
    // fall into the next zone rather than being clamped to the current zone's end.
    const inZone = i < ZONES.length - 1
      ? t >= z.tStart && t < z.tEnd
      : t >= z.tStart && t <= z.tEnd;
    if (inZone) {
      const frac = (t - z.tStart) / (z.tEnd - z.tStart);
      return z.pxStart + frac * (z.pxEnd - z.pxStart);
    }
  }
  return 0;
}

/**
 * Inverse of tx: map a logical pixel position back to a time value.
 */
export function txInverse(px: number): number {
  if (px <= ZONES[0].pxStart) return ZONES[0].tStart;
  if (px >= ZONES[ZONES.length - 1].pxEnd) return ZONES[ZONES.length - 1].tEnd;
  for (let i = 0; i < ZONES.length; i++) {
    const z = ZONES[i];
    const inZone = i < ZONES.length - 1
      ? px >= z.pxStart && px < z.pxEnd
      : px >= z.pxStart && px <= z.pxEnd;
    if (inZone) {
      const frac = (px - z.pxStart) / (z.pxEnd - z.pxStart);
      return z.tStart + frac * (z.tEnd - z.tStart);
    }
  }
  return 0;
}

/**
 * Compute the screen X position of a time value given the current ViewState
 * and viewport width.
 *
 * screenX = viewportWidth/2 + panX + tx(t) * zoomScale
 */
export function screenX(t: number, viewState: ViewState, viewportWidth: number): number {
  return viewportWidth / 2 + viewState.panX + tx(t) * viewState.zoomScale;
}

/**
 * Compute the time value at a given screen X position (inverse of screenX).
 */
export function screenXToTime(sx: number, viewState: ViewState, viewportWidth: number): number {
  const logPx = (sx - viewportWidth / 2 - viewState.panX) / viewState.zoomScale;
  return txInverse(logPx);
}

/**
 * Get the time value at the horizontal centre of the viewport.
 */
export function centreTime(viewState: ViewState, viewportWidth: number): number {
  return screenXToTime(viewportWidth / 2, viewState, viewportWidth);
}

/**
 * Format a time value as a human-readable string.
 */
export function formatTime(t: number): string {
  const abs = Math.abs(t);
  const suffix = t < 0 ? ' Ago' : t > 0 ? ' From Now' : '';

  if (t === 0) return 'Present Day';

  if (abs >= 1e9) {
    const val = (abs / 1e9).toPrecision(3);
    return `${val} Billion Years${suffix}`;
  }
  if (abs >= 1e6) {
    const val = (abs / 1e6).toPrecision(3);
    return `${val} Million Years${suffix}`;
  }
  if (abs >= 1e3) {
    const val = Math.round(abs / 1e3);
    return `${val},000 Years${suffix}`;
  }
  if (abs >= 1) {
    const year = Math.round(Math.abs(t));
    if (t < 0) return `${year} BCE`;
    return `${year} CE`;
  }

  return `${t.toExponential(2)} Years${suffix}`;
}
