// @ts-nocheck
import { loadEvents } from '$lib/data/loader.js';
import type { PageLoad } from './$types.js';

export const load = async () => {
  // Dynamic import keeps events.json out of the initial JS bundle
  const eventsRaw = await import('$lib/data/events.json');
  const { events, warnings } = loadEvents(eventsRaw.default as unknown[]);
  if (warnings.length > 0) {
    console.warn(`[chrono] ${warnings.length} data warnings during load`);
  }
  return { events };
};
;null as any as PageLoad;