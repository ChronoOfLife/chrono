/**
 * navigator.ts
 * Pure functions for pan/zoom state management with hard boundary clamping.
 * No GSAP dependency — these are testable pure functions.
 * GSAP wiring lives in gsap-observer.ts.
 */

import {
  tx,
  txInverse,
  BIG_BANG_TIME,
  HEAT_DEATH_TIME,
  MIN_ZOOM,
  MAX_ZOOM,
  type ViewState,
} from '$lib/math/axis.js';

export interface NavigatorConfig {
  minZoom: number;           // default MIN_ZOOM = 0.3
  maxZoom: number;           // default MAX_ZOOM = 2000
  leftBoundaryTime: number;  // default BIG_BANG_TIME
  rightBoundaryTime: number; // default HEAT_DEATH_TIME
  momentumDecay: number;     // GSAP ease duration in seconds (default 1.2)
}

export const DEFAULT_CONFIG: NavigatorConfig = {
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM,
  leftBoundaryTime: BIG_BANG_TIME,
  rightBoundaryTime: HEAT_DEATH_TIME,
  momentumDecay: 1.2,
};

/**
 * Clamp panX so that the Big Bang never scrolls past the left edge
 * and the Heat Death never scrolls past the right edge.
 *
 * screenX(t) = viewportWidth/2 + panX + tx(t) * zoomScale
 *
 * Left boundary:  screenX(BIG_BANG_TIME) >= 0
 *   => panX >= -viewportWidth/2 - tx(BIG_BANG_TIME) * zoomScale
 *
 * Right boundary: screenX(HEAT_DEATH_TIME) <= viewportWidth
 *   => panX <= viewportWidth/2 - tx(HEAT_DEATH_TIME) * zoomScale
 */
function clampPanX(
  panX: number,
  zoomScale: number,
  config: NavigatorConfig,
  viewportWidth: number
): number {
  // screenX(t) = viewportWidth/2 + panX + tx(t) * zoomScale
  // Left boundary:  screenX(leftBoundaryTime) >= 0
  //   => panX >= -viewportWidth/2 - tx(leftBoundaryTime) * zoomScale
  const minPanX = -viewportWidth / 2 - tx(config.leftBoundaryTime) * zoomScale;
  // Right boundary: screenX(rightBoundaryTime) <= viewportWidth
  //   => panX <= viewportWidth/2 - tx(rightBoundaryTime) * zoomScale
  const maxPanX = viewportWidth / 2 - tx(config.rightBoundaryTime) * zoomScale;

  // If the entire timeline is narrower than the viewport (minPanX > maxPanX),
  // clamp to minPanX so the Big Bang stays at the left edge.
  // This prevents the "centering" from pushing the Big Bang off-screen.
  if (minPanX >= maxPanX) {
    return minPanX;
  }

  return Math.max(minPanX, Math.min(maxPanX, panX));
}

/**
 * Clamp the full ViewState: zoom within [minZoom, maxZoom],
 * then clamp panX to boundary constraints.
 */
export function clampViewState(
  state: ViewState,
  config: NavigatorConfig,
  viewportWidth: number
): ViewState {
  const zoomScale = Math.max(config.minZoom, Math.min(config.maxZoom, state.zoomScale));
  const panX = clampPanX(state.panX, zoomScale, config, viewportWidth);
  return { panX, zoomScale };
}

/**
 * Apply a horizontal pan delta (pixels) to the current ViewState.
 */
export function applyPan(
  state: ViewState,
  deltaX: number,
  config: NavigatorConfig,
  viewportWidth: number
): ViewState {
  return clampViewState(
    { ...state, panX: state.panX + deltaX },
    config,
    viewportWidth
  );
}

/**
 * Apply a zoom factor centred on a screen X position (originX).
 *
 * To zoom centred on originX:
 *   1. Compute the time at originX before zoom
 *   2. Apply the new zoom scale
 *   3. Adjust panX so that the same time stays at originX
 *
 * timeAtOrigin = txInverse((originX - viewportWidth/2 - panX) / zoomScale)
 * After zoom: originX = viewportWidth/2 + newPanX + tx(timeAtOrigin) * newZoom
 * => newPanX = originX - viewportWidth/2 - tx(timeAtOrigin) * newZoom
 */
export function applyZoom(
  state: ViewState,
  factor: number,
  originX: number,
  config: NavigatorConfig,
  viewportWidth: number
): ViewState {
  const newZoom = Math.max(config.minZoom, Math.min(config.maxZoom, state.zoomScale * factor));

  // Compute the logical pixel offset of originX from the timeline origin
  const logPxAtOrigin = (originX - viewportWidth / 2 - state.panX) / state.zoomScale;
  // Keep that same logical position at originX after zoom
  const newPanX = originX - viewportWidth / 2 - logPxAtOrigin * newZoom;

  return clampViewState({ panX: newPanX, zoomScale: newZoom }, config, viewportWidth);
}

/**
 * Reset view centred on ~1800 CE (modern era) at zoom=1.
 * The modern era (1500–2030 CE) is the densest region and gets 300px at zoom=1,
 * so this gives users an immediately useful starting view.
 */
export function resetView(viewportWidth: number): ViewState {
  // Centre on 1800 CE so the modern era is prominently visible
  const targetPx = tx(1800);
  const panX = -targetPx; // tx(1800) * zoomScale=1 offset, centred in viewport
  return clampViewState(
    { panX, zoomScale: 1 },
    DEFAULT_CONFIG,
    viewportWidth
  );
}

/**
 * Compute the time value at the centre of the viewport.
 */
export function centreTimeFromState(state: ViewState, viewportWidth: number): number {
  const logPx = -state.panX / state.zoomScale;
  return txInverse(logPx);
}
