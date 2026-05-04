/**
 * loader.ts
 * Validates and loads ChronoEvent objects from a raw JSON array.
 * Used both at build time (SvelteKit load()) and in tests.
 */

import { VALID_ROW_KEYS, type ChronoEvent, type LoadResult, type RowKey } from './types.js';

/**
 * Validate and load events from a raw JSON array.
 * - Skips entries missing `time` (number) or `title` (string)
 * - Defaults unknown `row` values to 'physical'
 * - Returns all valid events plus a list of warning strings
 */
export function loadEvents(raw: unknown[]): LoadResult {
  const events: ChronoEvent[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];

    if (typeof entry !== 'object' || entry === null) {
      const msg = `Entry ${i}: not an object — skipped`;
      warnings.push(msg);
      console.warn(msg);
      continue;
    }

    const obj = entry as Record<string, unknown>;

    // Required: time must be a finite number
    if (typeof obj.time !== 'number' || !isFinite(obj.time)) {
      const msg = `Entry ${i} ("${obj.title ?? 'unknown'}"): missing or invalid 'time' — skipped`;
      warnings.push(msg);
      console.warn(msg);
      continue;
    }

    // Required: title must be a non-empty string
    if (typeof obj.title !== 'string' || obj.title.trim() === '') {
      const msg = `Entry ${i}: missing or empty 'title' — skipped`;
      warnings.push(msg);
      console.warn(msg);
      continue;
    }

    // Row: default to 'physical' if unknown
    let row: RowKey = 'physical';
    if (typeof obj.row === 'string' && VALID_ROW_KEYS.has(obj.row as RowKey)) {
      row = obj.row as RowKey;
    } else if (obj.row !== undefined) {
      const msg = `Entry ${i} ("${obj.title}"): unknown row '${obj.row}' — defaulting to 'physical'`;
      warnings.push(msg);
      console.warn(msg);
    }

    const event: ChronoEvent = {
      time: obj.time,
      title: obj.title.trim(),
      row,
    };

    // Optional string fields
    const optionalStrings: (keyof ChronoEvent)[] = [
      'india', 'world', 'link', 'scale', 'unit', 'age', 'fromCurrentEra', 'fromBigBang'
    ];
    for (const key of optionalStrings) {
      if (typeof obj[key] === 'string' && (obj[key] as string).trim() !== '') {
        (event as Record<string, unknown>)[key] = (obj[key] as string).trim();
      }
    }

    events.push(event);
  }

  return { events, warnings };
}
