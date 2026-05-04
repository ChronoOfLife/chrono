/**
 * hit-tester.ts
 * Maps pointer/touch coordinates to ChronoEvent markers.
 * Accounts for zoom scale, pan offset, and ellipsoid Y offset.
 */

import { screenX } from '$lib/math/axis.js';
import type { ViewState } from '$lib/math/axis.js';
import type { ChronoEvent } from '$lib/data/types.js';
import { getRowEntry, type RowLayout } from '$lib/layout/rows.js';
import { getEllipsoidYOffset } from '$lib/renderer/ellipsoid.js';

export interface HitTestResult {
  event: ChronoEvent | null;
  distance: number;
}

const MOUSE_RADIUS = 12;
const TOUCH_RADIUS = 24;

/**
 * Find the closest event marker to the given pointer position.
 *
 * @param pointerX - screen X of the pointer/touch
 * @param pointerY - screen Y of the pointer/touch
 * @param events - the currently visible (culled) events to test against
 * @param viewState - current pan/zoom state
 * @param rowLayout - computed row layout
 * @param isTouch - true for touch events (larger hit radius)
 * @param viewportWidth - current viewport width
 * @param viewportHeight - current viewport height
 */
export function hitTest(
  pointerX: number,
  pointerY: number,
  events: ChronoEvent[],
  viewState: ViewState,
  rowLayout: RowLayout,
  isTouch: boolean,
  viewportWidth: number,
  viewportHeight: number
): HitTestResult {
  const radius = isTouch ? TOUCH_RADIUS : MOUSE_RADIUS;
  let closest: ChronoEvent | null = null;
  let closestDist = Infinity;

  for (const event of events) {
    const rowEntry = getRowEntry(rowLayout, event.row);
    if (!rowEntry) continue;

    const sx = screenX(event.time, viewState, viewportWidth);

    // Apply ellipsoid Y offset (visual only — must match canvas rendering)
    const yOffset = getEllipsoidYOffset(rowEntry.centreY, viewportHeight);
    const sy = rowEntry.centreY + yOffset;

    const dist = Math.hypot(pointerX - sx, pointerY - sy);

    if (dist <= radius && dist < closestDist) {
      closestDist = dist;
      closest = event;
    }
  }

  return { event: closest, distance: closestDist };
}
