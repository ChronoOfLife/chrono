/**
 * canvas-layer.ts
 * High-performance canvas rendering for event markers.
 * Handles culling, icon drawing, and idle RAF suspension.
 */

import { screenX } from '$lib/math/axis.js';
import type { ViewState } from '$lib/math/axis.js';
import type { ChronoEvent } from '$lib/data/types.js';
import type { RowKey } from '$lib/data/types.js';
import {
  getRowEntry,
  getIconShape,
  type RowLayout,
  type ScaleLevel,
} from '$lib/layout/rows.js';

// ── Marker colours per row ────────────────────────────────────────────────────

const ROW_COLOURS: Record<RowKey, string> = {
  physical:      '#4caf50',
  evolution:     '#ff9800',
  science:       '#2196f3',
  india:         '#FF9933',
  world_asia:    '#90caf9',
  world_europe:  '#80cbc4',
  world_america: '#ce93d8',
};

const MARKER_RADIUS = 5;
const MARKER_RADIUS_OVERVIEW = 3;

// ── Icon drawing ──────────────────────────────────────────────────────────────

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const spikes = 5;
  const outerR = r;
  const innerR = r * 0.45;
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerR);
  ctx.closePath();
}

function drawDNA(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // Simplified: two overlapping circles
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy, r * 0.7, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.3, cy, r * 0.7, 0, Math.PI * 2);
}

function drawLightbulb(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.2, r * 0.75, 0, Math.PI * 2);
  ctx.rect(cx - r * 0.3, cy + r * 0.4, r * 0.6, r * 0.4);
}

function drawGlobe(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r);
  ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
}

function drawMarkerIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  row: RowKey,
  radius: number,
  selected: boolean
) {
  const colour = ROW_COLOURS[row];
  const shape = getIconShape(row);

  ctx.save();
  ctx.fillStyle = selected ? '#ffffff' : colour;
  ctx.strokeStyle = selected ? colour : 'rgba(255,255,255,0.6)';
  ctx.lineWidth = selected ? 2 : 1;

  switch (shape) {
    case 'star':
      drawStar(ctx, cx, cy, radius + 1);
      ctx.fill();
      ctx.stroke();
      break;
    case 'dna':
      drawDNA(ctx, cx, cy, radius);
      ctx.fill();
      break;
    case 'lightbulb':
      drawLightbulb(ctx, cx, cy, radius);
      ctx.fill();
      ctx.stroke();
      break;
    case 'saffron-dot':
      ctx.fillStyle = selected ? '#ffffff' : '#FF9933';
      ctx.strokeStyle = '#1a3a6b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    case 'globe':
      drawGlobe(ctx, cx, cy, radius);
      ctx.stroke();
      break;
    default:
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
  }

  ctx.restore();
}

// ── Connecting line ───────────────────────────────────────────────────────────

function drawConnector(
  ctx: CanvasRenderingContext2D,
  cx: number,
  markerY: number,
  baselineY: number,
  colour: string
) {
  if (Math.abs(markerY - baselineY) < 2) return;
  ctx.save();
  ctx.strokeStyle = colour + '66'; // 40% opacity
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(cx, markerY);
  ctx.lineTo(cx, baselineY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ── Longitude lines ───────────────────────────────────────────────────────────

const LONGITUDE_TIMES = [
  -13.8e9,   // Big Bang
  -4.6e9,    // Formation of Earth
  -3.8e9,    // Abiogenesis
  -65e6,     // K-Pg extinction
  -2.8e6,    // Genus Homo
  -10000,    // 10,000 BCE
  0,         // Present
  5e9,       // Sun leaves main sequence
  1e14,      // Last stars
  1e100,     // Heat Death
];

export function drawLongitudeLines(
  ctx: CanvasRenderingContext2D,
  viewState: ViewState,
  viewportWidth: number,
  viewportHeight: number
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;

  for (const t of LONGITUDE_TIMES) {
    const sx = screenX(t, viewState, viewportWidth);
    if (sx < 0 || sx > viewportWidth) continue;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, viewportHeight);
    ctx.stroke();
  }
  ctx.restore();
}

// ── Main draw function ────────────────────────────────────────────────────────

export interface DrawMarkersOptions {
  ctx: CanvasRenderingContext2D;
  events: ChronoEvent[];
  viewState: ViewState;
  rowLayout: RowLayout;
  scaleLevel: ScaleLevel;
  viewportWidth: number;
  viewportHeight: number;
  selectedEvent?: ChronoEvent | null;
  indiaFilterActive?: boolean;
}

export function drawMarkers(opts: DrawMarkersOptions): ChronoEvent[] {
  const {
    ctx, events, viewState, rowLayout, scaleLevel,
    viewportWidth, viewportHeight, selectedEvent, indiaFilterActive
  } = opts;

  const visible: ChronoEvent[] = [];
  const radius = scaleLevel === 'overview' ? MARKER_RADIUS_OVERVIEW : MARKER_RADIUS;

  for (const event of events) {
    const sx = screenX(event.time, viewState, viewportWidth);

    // Cull off-screen events
    if (sx < -20 || sx > viewportWidth + 20) continue;

    const rowEntry = getRowEntry(rowLayout, event.row);
    if (!rowEntry) continue;

    const cy = rowEntry.centreY;
    const colour = ROW_COLOURS[event.row];
    const isSelected = selectedEvent?.time === event.time && selectedEvent?.title === event.title;
    const isDimmed = indiaFilterActive && !event.india;

    ctx.save();
    if (isDimmed) ctx.globalAlpha = 0.2;

    // Connector line from marker to row baseline
    drawConnector(ctx, sx, cy - radius - 2, rowEntry.y + rowEntry.height, colour);

    // Marker icon
    drawMarkerIcon(ctx, sx, cy, event.row, radius, isSelected);

    ctx.restore();
    visible.push(event);
  }

  return visible;
}

// ── Idle RAF management ───────────────────────────────────────────────────────

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rafId: number | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private readonly IDLE_TIMEOUT = 500;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  markDirty() {
    this.dirty = true;
    this.resetIdleTimer();
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => this.frame());
    }
  }

  private frame() {
    this.rafId = null;
    if (this.dirty) {
      this.dirty = false;
      this.onDraw?.(this.ctx);
      if (this.dirty) {
        this.rafId = requestAnimationFrame(() => this.frame());
      }
    }
  }

  private resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      // Idle — stop requesting frames
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }, this.IDLE_TIMEOUT);
  }

  onDraw: ((ctx: CanvasRenderingContext2D) => void) | null = null;

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.markDirty();
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.idleTimer) clearTimeout(this.idleTimer);
  }
}
