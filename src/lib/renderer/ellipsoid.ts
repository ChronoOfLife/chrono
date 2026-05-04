/**
 * ellipsoid.ts
 * Ellipsoid globe projection helpers.
 *
 * The visual metaphor: the timeline surface curves like a globe.
 * Horizontal position (screenX) is NEVER affected — only the Y axis
 * gets a subtle sine-curve offset to simulate the globe curvature.
 *
 * The CSS perspective transform on the container gives the overall
 * "looking at a curved surface" feel.
 */

/**
 * Compute the CSS perspective transform string for the timeline container.
 * This gives the subtle globe-like curvature to the overall layout.
 *
 * @param viewportHeight - current viewport height in pixels
 * @param intensity - curvature intensity 0–1 (default 0.3)
 */
export function getEllipsoidTransform(viewportHeight: number, intensity = 0.3): string {
  // perspective distance scales with viewport height
  const perspective = Math.round(viewportHeight * (4 + (1 - intensity) * 6));
  return `perspective(${perspective}px) rotateX(${intensity * 3}deg)`;
}

/**
 * Compute the vertical Y offset for a row's centre position to simulate
 * the ellipsoid curvature. Rows near the top and bottom of the viewport
 * curve slightly inward.
 *
 * This is a VISUAL-ONLY offset — it does NOT affect hit-testing or
 * the horizontal screenX position of any marker.
 *
 * @param rowCentreY - the row's centre Y in pixels (0 = top of viewport)
 * @param viewportHeight - current viewport height in pixels
 * @param amplitude - max pixel offset at the edges (default 8% of viewport height)
 */
export function getEllipsoidYOffset(
  rowCentreY: number,
  viewportHeight: number,
  amplitude?: number
): number {
  const amp = amplitude ?? viewportHeight * 0.04;
  // Normalise rowCentreY to [-1, 1] range
  const normalised = (rowCentreY / viewportHeight) * 2 - 1;
  // Cosine curve: 0 at centre, amp at edges
  return amp * (1 - Math.cos(normalised * Math.PI)) * 0.5;
}

/**
 * Reduce curvature intensity at fine zoom levels (Period+) for legibility.
 *
 * @param zoomScale - current zoom scale
 * @returns intensity value 0–1
 */
export function getCurvatureIntensity(zoomScale: number): number {
  if (zoomScale >= 50) return 0;      // Period+ — flat for legibility
  if (zoomScale >= 5)  return 0.15;   // Era — subtle
  return 0.3;                          // Overview — full globe feel
}
