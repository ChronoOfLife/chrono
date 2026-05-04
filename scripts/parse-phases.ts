/**
 * parse-phases.ts
 * Reads Chrono Phase 1–5.md, parses each markdown table row into a ChronoEvent,
 * and writes src/lib/data/events.json
 *
 * Column layout (0-indexed):
 *  0: From Current Era
 *  1: From Big Bang
 *  2: Unit
 *  3: Scale
 *  4: Physical and Natural Transformations
 *  5: Evolution of Human & Civilisation
 *  6: Science, Technology and Innovations
 *  7: India
 *  8: (empty sub-column)
 *  9: World
 * 10: Age
 * 11: Reference URL
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Types ────────────────────────────────────────────────────────────────────

export type RowKey =
  | 'physical'
  | 'evolution'
  | 'science'
  | 'india'
  | 'world_asia'
  | 'world_europe'
  | 'world_america';

export interface ChronoEvent {
  time: number;
  title: string;
  row: RowKey;
  india?: string;
  world?: string;
  link?: string;
  scale?: string;
  unit?: string;
  age?: string;
  fromCurrentEra?: string;
  fromBigBang?: string;
}

// ── Time parsing ─────────────────────────────────────────────────────────────

/**
 * Parse a "From Current Era" string like:
 *   "-13.8 Billion", "-500 BCE", "1500 CE", "2045 CE",
 *   "-10,000 BCE", "-900,000", "10^106", "10^15"
 * Returns years relative to present (negative = past, positive = future).
 */
function parseTime(raw: string): number | null {
  const s = raw.trim().replace(/\\/g, '').replace(/,/g, '');

  if (!s || s === 'N/A' || s === '') return null;

  // Power-of-10 notation: "10^106", "10^15"
  const powMatch = s.match(/^10\^(\d+)$/);
  if (powMatch) return Math.pow(10, parseInt(powMatch[1]));

  // Negative power-of-10: "-10^36"
  const negPowMatch = s.match(/^-10\^(\d+)$/);
  if (negPowMatch) return -Math.pow(10, parseInt(negPowMatch[1]));

  // Billion years: "-13.8 Billion", "-4.54 Billion"
  const billionMatch = s.match(/^(-?\d+\.?\d*)\s*Billion$/i);
  if (billionMatch) return parseFloat(billionMatch[1]) * 1e9;

  // Million years: "-800 Million", "-65 Million"
  const millionMatch = s.match(/^(-?\d+\.?\d*)\s*Million$/i);
  if (millionMatch) return parseFloat(millionMatch[1]) * 1e6;

  // Thousand years: "-10000" or plain number with k suffix
  const kMatch = s.match(/^(-?\d+\.?\d*)k$/i);
  if (kMatch) return parseFloat(kMatch[1]) * 1e3;

  // BCE: "-500 BCE", "-10000 BCE"
  const bceMatch = s.match(/^-?(\d+\.?\d*)\s*BCE$/i);
  if (bceMatch) return -parseFloat(bceMatch[1]);

  // CE: "1500 CE", "2045 CE", "1 CE"
  const ceMatch = s.match(/^(\d+\.?\d*)\s*CE$/i);
  if (ceMatch) return parseFloat(ceMatch[1]);

  // Plain negative number (years): "-900000", "-74000"
  const plainMatch = s.match(/^(-?\d+\.?\d*)$/);
  if (plainMatch) return parseFloat(plainMatch[1]);

  // Trillion: "1 Trillion"
  const trillionMatch = s.match(/^(-?\d+\.?\d*)\s*Trillion$/i);
  if (trillionMatch) return parseFloat(trillionMatch[1]) * 1e12;

  return null;
}

// ── Markdown table parsing ────────────────────────────────────────────────────

function cleanCell(cell: string): string {
  return cell
    .trim()
    .replace(/\\\-/g, '-')
    .replace(/\\\*/g, '*')
    .replace(/\*\*(.*?)\*\*/g, '$1')  // strip bold
    .replace(/\*(.*?)\*/g, '$1')       // strip italic
    .replace(/\\_/g, '_')
    .replace(/\\#/g, '#')
    .trim();
}

function isNaOrEmpty(s: string): boolean {
  const c = cleanCell(s);
  return !c || c === 'N/A' || c === 'n/a' || c === '-';
}

function parseTableRow(cells: string[]): ChronoEvent[] {
  if (cells.length < 10) return [];

  const fromCurrentEra = cleanCell(cells[0]);
  const fromBigBang    = cleanCell(cells[1]);
  const unit           = cleanCell(cells[2]);
  const scale          = cleanCell(cells[3]);  const physical       = cleanCell(cells[4]);
  const evolution      = cleanCell(cells[5]);
  const science        = cleanCell(cells[6]);
  const india          = cleanCell(cells[7]);
  // cells[8] is empty sub-column
  const world          = cleanCell(cells[9] ?? '');
  const age            = cleanCell(cells[10] ?? '');
  const link           = cleanCell(cells[11] ?? '').replace(/\\_/g, '_').replace(/\\/g, '');

  const time = parseTime(fromCurrentEra);
  if (time === null) return [];

  const events: ChronoEvent[] = [];

  const base: Omit<ChronoEvent, 'title' | 'row'> = {
    time,
    fromCurrentEra,
    fromBigBang: isNaOrEmpty(fromBigBang) ? undefined : fromBigBang,
    unit: isNaOrEmpty(unit) ? undefined : unit,
    scale: isNaOrEmpty(scale) ? undefined : scale,
    age: isNaOrEmpty(age) ? undefined : age,
    india: isNaOrEmpty(india) ? undefined : india,
    world: isNaOrEmpty(world) ? undefined : world,
    link: link && link.startsWith('http') ? link : undefined,
  };

  // Determine primary row and title
  // Priority: physical > evolution > science > india > world
  if (!isNaOrEmpty(physical)) {
    events.push({ ...base, title: physical, row: 'physical' });
  } else if (!isNaOrEmpty(evolution)) {
    events.push({ ...base, title: evolution, row: 'evolution' });
  } else if (!isNaOrEmpty(science)) {
    events.push({ ...base, title: science, row: 'science' });
  } else if (!isNaOrEmpty(india)) {
    events.push({ ...base, title: india, row: 'india' });
  } else if (!isNaOrEmpty(world)) {
    events.push({ ...base, title: world, row: 'world_asia' });
  } else {
    // All content columns are N/A — skip
    return [];
  }

  // If the primary row is NOT india but india content exists, also emit an india row event
  if (events.length > 0 && events[0].row !== 'india' && !isNaOrEmpty(india)) {
    events.push({ ...base, title: india, row: 'india' });
  }

  // If world content exists and primary is not world, also emit world event
  // Assign to world_asia/europe/america based on keywords in the world text
  if (events.length > 0 && !events[0].row.startsWith('world') && !isNaOrEmpty(world)) {
    const worldRow = classifyWorldRow(world, scale);
    events.push({ ...base, title: world, row: worldRow });
  }

  return events;
}

/**
 * Classify a world event into world_asia, world_europe, or world_america
 * based on keywords in the text and scale/context.
 */
function classifyWorldRow(worldText: string, scale: string): 'world_asia' | 'world_europe' | 'world_america' {
  const t = worldText.toLowerCase();
  const s = scale.toLowerCase();

  // America keywords
  const americaKw = ['america', 'aztec', 'inca', 'maya', 'clovis', 'columbus', 'jamestown',
    'boston', 'washington', 'us ', 'usa', 'united states', 'canada', 'mexico',
    'pacific rim', 'kelp highway', 'pre-clovis', 'sahul'];
  if (americaKw.some(k => t.includes(k))) return 'world_america';

  // Europe keywords
  const europeKw = ['rome', 'roman', 'greek', 'greece', 'europe', 'european', 'britain',
    'england', 'french', 'france', 'german', 'spain', 'spanish', 'viking',
    'charlemagne', 'napoleon', 'renaissance', 'reformation', 'crusade',
    'byzantine', 'ottoman', 'medieval', 'feudal', 'magna carta', 'waterloo',
    'versailles', 'westphalia', 'athens', 'sparta', 'alexander', 'caesar',
    'augustus', 'justinian', 'carolingian', 'frankish', 'gothic', 'vandal',
    'hun', 'mongol in europe', 'black death', 'plague of justinian'];
  if (europeKw.some(k => t.includes(k))) return 'world_europe';

  // Asia keywords (default for most ancient/cosmic events)
  const asiaKw = ['china', 'chinese', 'japan', 'japanese', 'korea', 'mongol', 'persia',
    'persian', 'mesopotamia', 'babylon', 'sumeria', 'egypt', 'ottoman',
    'tang', 'han', 'qin', 'ming', 'qing', 'silk road', 'gobekli',
    'fertile crescent', 'jericho', 'catalhoyuk'];
  if (asiaKw.some(k => t.includes(k))) return 'world_asia';

  // Cosmic/geological/biological events — use asia as default (neutral)
  return 'world_asia';
}

function parseMarkdownFile(filePath: string): ChronoEvent[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const events: ChronoEvent[] = [];
  let inTable = false;
  let headerSkipped = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect table rows (start with |)
    if (!trimmed.startsWith('|')) {
      if (inTable) inTable = false;
      continue;
    }

    inTable = true;

    // Skip header row (contains "From Current Era") and separator row (contains ---)
    if (trimmed.includes('From Current Era') || trimmed.includes('---')) {
      headerSkipped = true;
      continue;
    }

    if (!headerSkipped) continue;

    // Split cells
    const cells = trimmed
      .split('|')
      .slice(1, -1) // remove leading and trailing empty strings from | delimiters
      .map(c => c.trim());

    const parsed = parseTableRow(cells);
    events.push(...parsed);
  }

  return events;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const phaseFiles = [
    'Chrono Phase 1.md',
    'Chrono Phase 2.md',
    'Chrono Phase 3.md',
    'Chrono Phase 4.md',
    'Chrono Phase 5.md',
  ];

  const allEvents: ChronoEvent[] = [];
  let totalWarnings = 0;

  for (const file of phaseFiles) {
    const filePath = join(ROOT, file);
    console.log(`Parsing ${file}...`);
    try {
      const events = parseMarkdownFile(filePath);
      console.log(`  → ${events.length} events`);
      allEvents.push(...events);
    } catch (err) {
      console.warn(`  ⚠ Could not read ${file}: ${err}`);
      totalWarnings++;
    }
  }

  // Sort by time ascending (Big Bang first)
  allEvents.sort((a, b) => a.time - b.time);

  // Deduplicate: same time + title + row
  const seen = new Set<string>();
  const deduped = allEvents.filter(e => {
    const key = `${e.time}|${e.title}|${e.row}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`\nTotal events: ${deduped.length} (${allEvents.length - deduped.length} duplicates removed)`);
  if (totalWarnings > 0) console.warn(`Warnings: ${totalWarnings}`);

  // Write output
  const outDir = join(ROOT, 'src', 'lib', 'data');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'events.json');
  writeFileSync(outPath, JSON.stringify(deduped, null, 2), 'utf-8');
  console.log(`\n✓ Written to ${outPath}`);

  if (deduped.length < 500) {
    console.warn(`⚠ Only ${deduped.length} events — expected ≥ 500`);
  }
}

main();
