/**
 * axis.ts
 * Logarithmic time axis math for Chrono of Life.
 *
 * tx(t) = sign(t) × log10(|t| + 1) × K
 *
 * This compresses the full range from −13.8e9 years (Big Bang) to
 * 10^106 years (Heat Death) into a navigable pixel space while
 * preserving monotonicity and keeping t=0 (present) at the origin.
 */

/** Scale constant: pixels per log unit at zoom=1 */
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

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 500;

/**
 * Map a time value (years relative to present) to a logical pixel position
 * on the timeline axis (origin = present day).
 */
export function tx(t: number): number {
  return Math.sign(t) * Math.log10(Math.abs(t) + 1) * K;
}

/**
 * Inverse of tx: map a logical pixel position back to a time value.
 */
export function txInverse(px: number): number {
  const sign = Math.sign(px);
  return sign * (Math.pow(10, Math.abs(px) / K) - 1);
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
