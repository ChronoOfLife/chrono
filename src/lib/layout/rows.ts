/**
 * rows.ts
 * Row schema and layout engine for Chrono of Life.
 *
 * Implements the spreadsheet-derived Y-axis structure:
 *   Rows 4–6:  Time Header "From Current Era"  (green)
 *   Rows 7–9:  Time Header "From Big Bang"      (amber)
 *   Row  10:   Unit                             (neutral)
 *   Row  11:   Scale                            (neutral)
 *   Row  12:   Physical & Natural               (light green)
 *   Row  13:   Evolution & Civilisation         (light yellow)
 *   Row  14:   Science, Technology & Innovations(light blue)
 *   Row  15:   India                            (medium blue + saffron)
 *   Row  16:   World / Asia                     (dark blue)
 *   Row  17:   World / Europe                   (dark blue)
 *   Row  18:   World / America                  (dark blue)
 *   Row  21:   Age                              (light green, green text)
 */

import type { RowKey } from '$lib/data/types.js';

// ── Row definitions ───────────────────────────────────────────────────────────

export interface RowDefinition {
  key: string;
  label: string;
  subLabel?: string;
  background: string;
  textColor: string;
  accentColor?: string;
  isHeader: boolean;      // true for time header rows
  isContent: boolean;     // true for event-bearing rows
  contentRowKey?: RowKey; // maps to ChronoEvent.row
}

export const ROW_DEFINITIONS: RowDefinition[] = [
  // ── Time Header: From Current Era (rows 4–6) ──────────────────────────────
  {
    key: 'header_era_power',
    label: 'From Current Era',
    subLabel: 'Power of 10',
    background: '#c8e6c9',
    textColor: '#1b5e20',
    isHeader: true,
    isContent: false,
  },
  {
    key: 'header_era_multiplier',
    label: '',
    subLabel: 'Multiplier',
    background: '#c8e6c9',
    textColor: '#1b5e20',
    isHeader: true,
    isContent: false,
  },
  {
    key: 'header_era_actual',
    label: '',
    subLabel: 'Actual value',
    background: '#a5d6a7',
    textColor: '#1b5e20',
    isHeader: true,
    isContent: false,
  },
  // ── Time Header: From Big Bang (rows 7–9) ─────────────────────────────────
  {
    key: 'header_bb_power',
    label: 'From Big Bang',
    subLabel: 'Power of 10',
    background: '#fff9c4',
    textColor: '#f57f17',
    isHeader: true,
    isContent: false,
  },
  {
    key: 'header_bb_multiplier',
    label: '',
    subLabel: 'Multiplier',
    background: '#fff9c4',
    textColor: '#f57f17',
    isHeader: true,
    isContent: false,
  },
  {
    key: 'header_bb_actual',
    label: '',
    subLabel: 'Actual value',
    background: '#fff176',
    textColor: '#f57f17',
    isHeader: true,
    isContent: false,
  },
  // ── Row 10: Unit ──────────────────────────────────────────────────────────
  {
    key: 'unit',
    label: 'Unit',
    background: '#f5f5f5',
    textColor: '#424242',
    isHeader: true,
    isContent: false,
  },
  // ── Row 11: Scale ─────────────────────────────────────────────────────────
  {
    key: 'scale_row',
    label: 'Scale',
    background: '#eeeeee',
    textColor: '#424242',
    isHeader: true,
    isContent: false,
  },
  // ── Row 12: Physical & Natural Transformations ────────────────────────────
  {
    key: 'physical',
    label: 'Physical and natural\ntransformations',
    background: '#e8f5e9',
    textColor: '#1b5e20',
    isHeader: false,
    isContent: true,
    contentRowKey: 'physical',
  },
  // ── Row 13: Evolution of Human & Civilisation ─────────────────────────────
  {
    key: 'evolution',
    label: 'Evolution of Human\n& civilisation',
    background: '#fffde7',
    textColor: '#5d4037',
    isHeader: false,
    isContent: true,
    contentRowKey: 'evolution',
  },
  // ── Row 14: Science, Technology & Innovations ─────────────────────────────
  {
    key: 'science',
    label: 'Science,\nTechnology and\nInnovations',
    background: '#e3f2fd',
    textColor: '#0d47a1',
    isHeader: false,
    isContent: true,
    contentRowKey: 'science',
  },
  // ── Row 15: India ─────────────────────────────────────────────────────────
  {
    key: 'india',
    label: 'India',
    background: '#1a3a6b',
    textColor: '#ffffff',
    accentColor: '#FF9933',
    isHeader: false,
    isContent: true,
    contentRowKey: 'india',
  },
  // ── Row 16: World / Asia ──────────────────────────────────────────────────
  {
    key: 'world_asia',
    label: 'World',
    subLabel: 'Asia',
    background: '#0d2b5e',
    textColor: '#ffffff',
    isHeader: false,
    isContent: true,
    contentRowKey: 'world_asia',
  },
  // ── Row 17: World / Europe ────────────────────────────────────────────────
  {
    key: 'world_europe',
    label: '',
    subLabel: 'Europe',
    background: '#0d2b5e',
    textColor: '#ffffff',
    isHeader: false,
    isContent: true,
    contentRowKey: 'world_europe',
  },
  // ── Row 18: World / America ───────────────────────────────────────────────
  {
    key: 'world_america',
    label: '',
    subLabel: 'America',
    background: '#0d2b5e',
    textColor: '#ffffff',
    isHeader: false,
    isContent: true,
    contentRowKey: 'world_america',
  },
  // ── Row 21: Age ───────────────────────────────────────────────────────────
  {
    key: 'age',
    label: 'Age:',
    background: '#f1f8e9',
    textColor: '#33691e',
    isHeader: false,
    isContent: false,
  },
];

export const TOTAL_ROW_COUNT = ROW_DEFINITIONS.length;

// ── Layout computation ────────────────────────────────────────────────────────

export interface RowLayoutEntry {
  key: string;
  y: number;        // top pixel position
  height: number;
  centreY: number;
  definition: RowDefinition;
}

export interface RowLayout {
  rowHeight: number;
  labelColumnWidth: number;
  rows: RowLayoutEntry[];
  totalHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}

export function getLabelColumnWidth(viewportWidth: number): 80 | 120 | 180 {
  if (viewportWidth >= 1024) return 180;
  if (viewportWidth >= 600) return 120;
  return 80;
}

export function computeRowLayout(viewportWidth: number, viewportHeight: number): RowLayout {
  const labelColumnWidth = getLabelColumnWidth(viewportWidth);
  const rowHeight = Math.floor(viewportHeight / TOTAL_ROW_COUNT);
  const rows: RowLayoutEntry[] = [];

  ROW_DEFINITIONS.forEach((def, i) => {
    const y = i * rowHeight;
    rows.push({
      key: def.key,
      y,
      height: rowHeight,
      centreY: y + rowHeight / 2,
      definition: def,
    });
  });

  return {
    rowHeight,
    labelColumnWidth,
    rows,
    totalHeight: TOTAL_ROW_COUNT * rowHeight,
    viewportWidth,
    viewportHeight,
  };
}

/**
 * Get the RowLayoutEntry for a given content row key.
 */
export function getRowEntry(layout: RowLayout, rowKey: RowKey): RowLayoutEntry | undefined {
  return layout.rows.find(r => r.definition.contentRowKey === rowKey);
}

/**
 * Scale level based on zoom scale.
 */
export type ScaleLevel = 'overview' | 'era' | 'period' | 'decade' | 'year';

export function getScaleLevel(zoomScale: number): ScaleLevel {
  if (zoomScale < 0.5)  return 'overview';
  if (zoomScale < 5)    return 'era';
  if (zoomScale < 50)   return 'period';
  if (zoomScale < 200)  return 'decade';
  return 'year';
}

/**
 * Icon shape for each row type.
 */
export type IconShape = 'star' | 'dna' | 'lightbulb' | 'saffron-dot' | 'globe';

export function getIconShape(rowKey: RowKey): IconShape {
  switch (rowKey) {
    case 'physical':      return 'star';
    case 'evolution':     return 'dna';
    case 'science':       return 'lightbulb';
    case 'india':         return 'saffron-dot';
    case 'world_asia':
    case 'world_europe':
    case 'world_america': return 'globe';
  }
}
