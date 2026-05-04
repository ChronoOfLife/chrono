/**
 * Core data types for Chrono of Life
 */

export type RowKey =
  | 'physical'
  | 'evolution'
  | 'science'
  | 'india'
  | 'world_asia'
  | 'world_europe'
  | 'world_america';

export const VALID_ROW_KEYS: ReadonlySet<RowKey> = new Set([
  'physical',
  'evolution',
  'science',
  'india',
  'world_asia',
  'world_europe',
  'world_america',
]);

export interface ChronoEvent {
  time: number;           // years relative to present (negative = past)
  title: string;          // display title
  row: RowKey;            // which row this event belongs to
  india?: string;         // India-specific context
  world?: string;         // world context description
  link?: string;          // Wikipedia article URL
  scale?: string;         // e.g. "Cosmic", "Galactic", "Planetary"
  unit?: string;          // e.g. "Years", "Millions of Years"
  age?: string;           // e.g. "Iron Age", "Cambrian"
  fromCurrentEra?: string; // human-readable "From Current Era" string
  fromBigBang?: string;   // human-readable "From Big Bang" string
}

export interface LoadResult {
  events: ChronoEvent[];
  warnings: string[];
}
