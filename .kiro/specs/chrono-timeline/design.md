# Design Document: Chrono of Life — Interactive Timeline (chrono-timeline)

## Overview

Chrono of Life is a SvelteKit-based Zooming User Interface (ZUI) that replaces the existing vanilla-canvas prototype with a production-quality interactive timeline. The application spans from the Big Bang (−13.8 billion years) to the Heat Death of the universe (~10^106 years), presenting 500+ events across cosmic, geological, biological, civilisational, and future categories with a strong India-centric lens.

The core visual metaphor is an **ellipsoid globe projection**: horizontal bands (latitudes) flow left-to-right through time; vertical longitude lines mark temporal positions. The Big Bang anchors the hard left boundary; the Heat Death / Big Rip anchors the hard right boundary.

The application is deployed as a fully static site on GitHub Pages via `adapter-static`, with no server-side runtime.

### Key Design Decisions

1. **SvelteKit + adapter-static** — chosen for component reactivity, SSG support, and zero-cost GitHub Pages hosting.
2. **GSAP for all motion** — Observer plugin unifies input streams; ScrollTrigger handles momentum; `autoAlpha` drives semantic zoom transitions. This avoids building a custom animation engine.
3. **Logarithmic time axis** — `tx(t) = sign(t) × log10(|t| + 1) × K` compresses the 10^115-year span into a navigable pixel space while preserving monotonicity.
4. **Hybrid canvas + DOM rendering** — a canvas layer handles high-density dot/icon rendering; a DOM layer handles labels and interactive elements. This maintains 60 FPS with 500+ events.
5. **Wikipedia REST API (client-side)** — event detail fetched on demand; locally stored `world` description used as fallback. No server proxy needed.
6. **JSON event data at build time** — all five phase documents are pre-compiled into a single `events.json` file; SvelteKit imports it statically, enabling SSG pre-rendering of the initial state.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Pages CDN                         │
│                    (static build/ output)                       │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP
┌──────────────────────────────▼──────────────────────────────────┐
│                     SvelteKit Application                       │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Data Layer  │  │  Navigation  │  │   Rendering Layer    │  │
│  │              │  │  (Navigator) │  │                      │  │
│  │ Data_Loader  │  │ GSAP Observer│  │  Canvas (markers)    │  │
│  │ events.json  │  │ GSAP Tween   │  │  DOM (labels, HUD)   │  │
│  │ Hit_Tester   │  │ Boundaries   │  │  Ellipsoid CSS       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    UI Components                         │   │
│  │  HUD  │  DetailPanel  │  RowLabels  │  TimeHeader  │ Age │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Wikipedia_Fetcher (client-side)             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               │ fetch (on demand)
                    ┌──────────▼──────────┐
                    │  Wikipedia REST API  │
                    │  /api/rest_v1/page/  │
                    │  summary/{title}     │
                    └─────────────────────┘
```

### Module Boundaries

| Module | Responsibility | Technology |
|---|---|---|
| `Data_Loader` | Parse, validate, and expose event JSON at build time | SvelteKit `load()` + static import |
| `Navigator` | Translate user input into pan/zoom transforms with momentum and boundary clamping | GSAP Observer + custom tween |
| `Renderer` | Draw event markers, row bands, longitude lines, ellipsoid projection | Canvas 2D + Svelte DOM |
| `Hit_Tester` | Map pointer/touch coordinates to event markers accounting for zoom, pan, and projection | Pure TypeScript |
| `Wikipedia_Fetcher` | Fetch Wikipedia summary on event selection with timeout and fallback | `fetch` + AbortController |
| `HUD` | Fixed screen-space overlay: time indicator, zoom level, India toggle, Reset View, List View | Svelte component |
| `DetailPanel` | Event detail overlay with Wikipedia content, keyboard navigation, ARIA | Svelte component |
| `TimeHeader` | Dynamic rows 4–9 showing power-of-10, multiplier, actual value for current viewport | Svelte reactive component |
| `AgeRow` | Row 21 — geological/historical age label for current viewport centre | Svelte reactive component |

---

## Components and Interfaces

### Data_Loader

```typescript
interface ChronoEvent {
  time: number;           // years relative to present (negative = past)
  title: string;          // display title
  row: RowKey;            // one of the defined row keys
  india?: string;         // India-specific context
  world?: string;         // world context description
  link?: string;          // Wikipedia article URL
  scale?: string;         // e.g. "Cosmic", "Galactic", "Planetary"
  unit?: string;          // e.g. "Years", "Millions of Years"
  age?: string;           // e.g. "Iron Age", "Cambrian"
  fromBigBang?: string;   // human-readable time from Big Bang
  powerOf10?: string;     // exponent string, e.g. "9"
  multiplier?: string;    // multiplier string, e.g. "13.8"
}

type RowKey =
  | 'physical'
  | 'evolution'
  | 'science'
  | 'india'
  | 'world_asia'
  | 'world_europe'
  | 'world_america';

interface LoadResult {
  events: ChronoEvent[];
  warnings: string[];     // malformed entries that were skipped
}

function loadEvents(jsonPath: string): LoadResult;
```

Malformed entries (missing `time` or `title`) are skipped with a `console.warn`. Unknown `row` values default to `'physical'` with a warning. The loader is invoked at build time via SvelteKit's `+page.ts` `load()` function, making the event array available as a page prop.

### Navigator

```typescript
interface ViewState {
  panX: number;       // pixel offset of the timeline origin from viewport centre
  zoomScale: number;  // current zoom multiplier, clamped to [0.05, 500]
}

interface NavigatorConfig {
  K: number;                    // logarithmic scale constant (pixels per log unit)
  minZoom: number;              // 0.05
  maxZoom: number;              // 500
  leftBoundaryTime: number;     // -13.8e9
  rightBoundaryTime: number;    // 1e106
  momentumDecay: number;        // GSAP ease duration for momentum
}

// GSAP Observer callback signatures
type PanHandler = (deltaX: number) => void;
type ZoomHandler = (factor: number, originX: number) => void;
```

The Navigator uses GSAP Observer to unify mouse wheel, trackpad, touch drag, and pointer drag into a single event stream. Zoom is centred on the pointer position (desktop) or pinch midpoint (touch). Momentum is applied via a GSAP tween with `power2.out` easing on release. Hard boundaries are enforced by clamping `panX` so that `tx(leftBoundaryTime)` and `tx(rightBoundaryTime)` never scroll off-screen past their respective edges.

### Logarithmic Time Axis

```typescript
const K = 120; // configurable scale constant (pixels per log unit at zoom=1)

function tx(t: number): number {
  return Math.sign(t) * Math.log10(Math.abs(t) + 1) * K;
}

function txInverse(px: number): number {
  const sign = Math.sign(px);
  return sign * (Math.pow(10, Math.abs(px) / K) - 1);
}

// Screen position of an event given current view state
function screenX(t: number, viewState: ViewState, viewportWidth: number): number {
  return viewportWidth / 2 + viewState.panX + tx(t) * viewState.zoomScale;
}
```

### Renderer

The Renderer is split into two layers:

**Canvas layer** (for high-density marker rendering):
- Draws circular/icon markers for all events whose `screenX` falls within `[0, viewportWidth]`
- Culls off-screen events before each frame
- Uses `requestAnimationFrame` driven by GSAP ticker
- Suspends RAF when idle for >500ms

**DOM layer** (for labels and interactive elements):
- Svelte `{#each}` over visible events, absolutely positioned via `left: {screenX}px`
- Labels shown/hidden via GSAP `autoAlpha` based on current Scale Level
- Row bands rendered as fixed-height `<div>` elements with CSS background colours

```typescript
type ScaleLevel = 'overview' | 'era' | 'period' | 'decade' | 'year';

function getScaleLevel(zoomScale: number): ScaleLevel {
  if (zoomScale < 0.5)   return 'overview';
  if (zoomScale < 5)     return 'era';
  if (zoomScale < 50)    return 'period';
  if (zoomScale < 200)   return 'decade';
  return 'year';
}
```

### Hit_Tester

```typescript
interface HitTestResult {
  event: ChronoEvent | null;
  distance: number;
}

function hitTest(
  pointerX: number,
  pointerY: number,
  events: ChronoEvent[],
  viewState: ViewState,
  rowLayout: RowLayout,
  isTouch: boolean,
  viewportWidth: number
): HitTestResult {
  const radius = isTouch ? 24 : 12;
  // For each event, compute screenX and screenY (row centre Y),
  // return the closest event within radius
}
```

The Hit_Tester accounts for the current `zoomScale`, `panX`, and the ellipsoid Y-offset when computing distances. It iterates only over currently visible (culled) events for performance.

### Wikipedia_Fetcher

```typescript
interface WikiSummary {
  extract: string;
  thumbnail?: { source: string };
}

async function fetchWikiSummary(
  title: string,
  timeoutMs: number = 5000
): Promise<WikiSummary | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const slug = title.replace(/ /g, '_');
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`,
      { signal: controller.signal }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
```

On failure or timeout, the `DetailPanel` falls back to the event's locally stored `world` description.

---

## Data Models

### Row Schema

```typescript
interface RowDefinition {
  key: RowKey;
  label: string;
  background: string;   // CSS colour
  textColor: string;
  accentColor?: string;
  rowIndex: number;     // 0-based display order
}

const ROW_DEFINITIONS: RowDefinition[] = [
  // Time headers (rows 4–9) are rendered separately as sticky header rows
  { key: 'physical',      label: 'Physical & Natural Transformations', background: '#d4edda', textColor: '#155724', rowIndex: 0 },
  { key: 'evolution',     label: 'Evolution of Human & Civilisation',  background: '#fff9c4', textColor: '#5d4037', rowIndex: 1 },
  { key: 'science',       label: 'Science, Technology & Innovations',  background: '#cce5ff', textColor: '#004085', rowIndex: 2 },
  { key: 'india',         label: 'India',                              background: '#1a3a6b', textColor: '#ffffff', accentColor: '#FF9933', rowIndex: 3 },
  { key: 'world_asia',    label: 'World / Asia',                       background: '#0d2b5e', textColor: '#ffffff', rowIndex: 4 },
  { key: 'world_europe',  label: 'World / Europe',                     background: '#0d2b5e', textColor: '#ffffff', rowIndex: 5 },
  { key: 'world_america', label: 'World / America',                    background: '#0d2b5e', textColor: '#ffffff', rowIndex: 6 },
];
```

### Time Header Model

```typescript
interface TimeColumn {
  time: number;           // the time value at this column's centre
  powerOf10: string;      // e.g. "9" for 10^9
  multiplier: string;     // e.g. "13.8"
  actualValue: string;    // human-readable, e.g. "13.8 Billion Years Ago"
  fromBigBang: string;    // e.g. "0 Years" or "13.8 Billion Years"
  unit: string;           // "Years" | "Millions of Years" | "Billions of Years"
  scale: string;          // "Cosmic" | "Galactic" | "Solar" | "Planetary" | ...
}
```

The `TimeHeader` component computes visible `TimeColumn` values reactively from the current `ViewState`, updating on every pan/zoom event.

### Event Marker Visual Model

```typescript
interface MarkerStyle {
  iconShape: 'star' | 'dna' | 'lightbulb' | 'saffron-dot' | 'globe';
  color: string;
  size: number;           // base radius in logical pixels
}

function getMarkerStyle(row: RowKey): MarkerStyle {
  // Maps row key to icon shape and colour
}
```

### Layout Model

```typescript
interface RowLayout {
  rowHeight: number;          // viewport height / total row count
  labelColumnWidth: number;   // 180 | 120 | 80 depending on viewport width
  headerRowCount: number;     // number of time header rows (6: rows 4–9)
  contentRowCount: number;    // 7 content rows + 1 age row = 8
  totalRowCount: number;      // headerRowCount + contentRowCount + unit + scale rows
  rows: Array<{
    key: string;
    y: number;              // top pixel position
    height: number;
    centreY: number;
  }>;
}
```

### Viewport and Scale Level

```typescript
interface ViewportState {
  width: number;
  height: number;
  breakpoint: 'mobile' | 'tablet' | 'desktop';  // <600 | 600-1023 | ≥1024
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Event JSON Round-Trip

*For any* valid `ChronoEvent` object `e`, serialising it to JSON and then parsing the result SHALL produce an object deeply equal to `e`.

**Validates: Requirements 1.5**

---

### Property 2: Malformed Event Skipping

*For any* JSON array of event objects where some entries are missing `time` or `title`, the Data_Loader SHALL return only the valid entries, and the count of returned events SHALL equal the count of entries that had both `time` and `title` present.

**Validates: Requirements 1.3**

---

### Property 3: Logarithmic Axis Monotonicity

*For any* two event time values `a` and `b` where `|a| < |b|`, the pixel distance from the origin to `tx(a)` SHALL be strictly less than the pixel distance from the origin to `tx(b)`.

**Validates: Requirements 2.5**

---

### Property 4: Logarithmic Axis Round-Trip

*For any* event time value `t` in the valid range `[-13.8e9, 1e106]`, `txInverse(tx(t))` SHALL equal `t` within floating-point tolerance (1e-6 relative error).

**Validates: Requirements 2.6**

---

### Property 5: Navigator Boundary and Zoom Invariants

*For any* sequence of pan and zoom operations applied to any initial `ViewState`, the resulting state SHALL satisfy all of the following simultaneously: the Big Bang marker SHALL NOT be scrolled past the viewport left edge; the Heat Death marker SHALL NOT be scrolled past the viewport right edge; and the zoom scale SHALL remain within `[0.05, 500]`.

**Validates: Requirements 2.3, 2.4, 6.5, 6.7**

---

### Property 6: Ellipsoid Projection Preserves Horizontal Position

*For any* event time value `t` and any `ViewState`, the horizontal screen position of the event marker SHALL equal `screenX(t, viewState, viewportWidth)` regardless of the Y-axis ellipsoid offset applied to that marker.

**Validates: Requirements 3.6**

---

### Property 7: Row Heights Proportional to Viewport

*For any* viewport height `h` and total row count `n`, each row's rendered height SHALL equal `h / n` (within 1px rounding tolerance).

**Validates: Requirements 4.4, 10.4**

---

### Property 8: Row Colour Contrast

*For any* row definition in `ROW_DEFINITIONS`, the WCAG 2.1 relative luminance contrast ratio between the row's `textColor` and `background` SHALL be at least 3:1.

**Validates: Requirements 4.6**

---

### Property 9: Unknown Row Defaults to Physical

*For any* event object whose `row` field is not one of the seven defined `RowKey` values, the Data_Loader SHALL assign it to the `'physical'` row.

**Validates: Requirements 4.3**

---

### Property 10: Viewport Culling Monotonicity

*For any* two zoom scale values `s1 < s2` applied to the same `panX` and event dataset, the number of Event Markers rendered at `s1` SHALL be less than or equal to the number rendered at `s2`.

**Validates: Requirements 5.8**

---

### Property 11: Hit Test Radius

*For any* event marker at screen position `(ex, ey)`, any pointer at `(px, py)` where `hypot(px - ex, py - ey) ≤ radius` (where `radius` is 12px for mouse and 24px for touch), and any `ViewState`, the Hit_Tester SHALL identify that event as selected after accounting for zoom, pan, and ellipsoid projection transforms.

**Validates: Requirements 7.1, 7.2, 12.5**

---

### Property 12: India Secondary Marker Placement

*For any* event `e` with a non-empty `india` field assigned to a non-India row, the Renderer SHALL produce a secondary marker in the India row at the same horizontal screen position as the primary marker for `e`.

**Validates: Requirements 8.2**

---

### Property 13: Time Header Values Correctness

*For any* `ViewState` (pan offset and zoom scale), the Time Header rows SHALL display the power-of-10 exponent, multiplier, and human-readable actual value that correctly correspond to the time value at the horizontal centre of the viewport, for both the "From Current Era" and "From Big Bang" reference frames.

**Validates: Requirements 9.1, 9.2, 9.3**

---

### Property 14: Label Column Width at Breakpoints

*For any* viewport width `w`, the sticky row label column width SHALL be 180px when `w ≥ 1024`, 120px when `600 ≤ w < 1024`, and 80px when `w < 600`.

**Validates: Requirements 10.3**

---

## Error Handling

### Data Loading Errors

| Scenario | Handling |
|---|---|
| Missing `time` or `title` field | Skip entry, emit `console.warn` with entry index |
| Unknown `row` value | Default to `'physical'`, emit `console.warn` |
| JSON parse failure | Throw at build time — build fails with clear error message |
| Empty event array | Render empty timeline with boundary markers only |

### Navigation Errors

| Scenario | Handling |
|---|---|
| Pan beyond Big Bang boundary | Clamp `panX` so Big Bang stays at or right of viewport left edge |
| Pan beyond Heat Death boundary | Clamp `panX` so Heat Death stays at or left of viewport right edge |
| Zoom below minimum (0.05) | Clamp `zoomScale` to 0.05 |
| Zoom above maximum (500) | Clamp `zoomScale` to 500 |
| Rapid input causing frame drops | GSAP ticker batches transforms; RAF suspended when idle |

### Wikipedia Fetch Errors

| Scenario | Handling |
|---|---|
| Network timeout (>5s) | AbortController cancels request; fallback to `world` field |
| HTTP error (4xx/5xx) | Treat as null response; fallback to `world` field |
| Missing `extract` in response | Display `world` field; show "Read more" link if `link` present |
| CORS error | Wikipedia REST API supports CORS; no proxy needed |

### Rendering Errors

| Scenario | Handling |
|---|---|
| Canvas context unavailable | Fall back to DOM-only rendering with reduced performance |
| Viewport resize during animation | Debounce resize handler; recompute layout within one RAF |
| Event with no matching row | Assign to `physical` row; log warning |

---

## Testing Strategy

### Unit Tests (Vitest)

Unit tests cover specific examples, edge cases, and pure function correctness.

**Data_Loader tests:**
- Valid event array parses correctly
- Entry missing `time` is skipped; count is reduced by 1
- Entry missing `title` is skipped; count is reduced by 1
- Unknown `row` value defaults to `'physical'`
- Empty array returns empty result without error

**Logarithmic axis tests:**
- `tx(0)` returns 0
- `tx(-13.8e9)` is negative and finite
- `tx(1e106)` is positive and finite
- `txInverse(tx(t))` ≈ `t` for representative values: −13.8e9, −1000, 0, 2025, 1e14, 1e100

**Hit_Tester tests:**
- Pointer exactly on marker centre returns that event
- Pointer 11px from marker centre (desktop) returns that event
- Pointer 13px from marker centre (desktop) returns null
- Pointer 23px from marker centre (touch) returns that event
- Pointer 25px from marker centre (touch) returns null
- Multiple overlapping markers returns the closest one

**Navigator boundary tests:**
- Pan left past Big Bang clamps correctly
- Pan right past Heat Death clamps correctly
- Zoom below 0.05 clamps to 0.05
- Zoom above 500 clamps to 500

**Wikipedia_Fetcher tests:**
- Successful fetch returns `extract` text
- Timeout after 5s returns null
- HTTP 404 returns null

### Property-Based Tests (fast-check)

Property-based tests use [fast-check](https://fast-check.io/) with a minimum of 100 iterations per property. Each test is tagged with its design property reference.

**Feature: chrono-timeline, Property 1: Event JSON Round-Trip**
```typescript
// Arbitraries: generate random ChronoEvent objects with valid fields
// Property: JSON.parse(JSON.stringify(e)) deeply equals e
```

**Feature: chrono-timeline, Property 2: Malformed Event Skipping**
```typescript
// Arbitraries: generate arrays mixing valid and invalid (missing time/title) entries
// Property: loadEvents(array).events.length === count of entries with both time and title
```

**Feature: chrono-timeline, Property 3: Logarithmic Axis Monotonicity**
```typescript
// Arbitraries: generate pairs (a, b) where |a| < |b|, both in [-13.8e9, 1e106]
// Property: Math.abs(tx(a)) < Math.abs(tx(b))
```

**Feature: chrono-timeline, Property 4: Logarithmic Axis Round-Trip**
```typescript
// Arbitraries: generate t in [-13.8e9, 1e106]
// Property: Math.abs(txInverse(tx(t)) - t) / (Math.abs(t) + 1) < 1e-6
```

**Feature: chrono-timeline, Property 5: Navigator Boundary and Zoom Invariants**
```typescript
// Arbitraries: generate sequences of pan/zoom deltas applied to random initial ViewState
// Property: after all operations:
//   - Big Bang screenX ≤ viewportWidth (not scrolled off left)
//   - Heat Death screenX ≥ 0 (not scrolled off right)
//   - 0.05 ≤ zoomScale ≤ 500
```

**Feature: chrono-timeline, Property 6: Ellipsoid Projection Preserves Horizontal Position**
```typescript
// Arbitraries: generate random time values and ViewState objects
// Property: marker.screenX === screenX(t, viewState, viewportWidth) regardless of Y offset
```

**Feature: chrono-timeline, Property 7: Row Heights Proportional to Viewport**
```typescript
// Arbitraries: generate viewport heights in [400, 4000] and row counts in [8, 20]
// Property: each row's rendered height === Math.floor(h / n) ± 1
```

**Feature: chrono-timeline, Property 8: Row Colour Contrast**
```typescript
// Arbitraries: iterate over all ROW_DEFINITIONS (deterministic, not random)
// Property: wcagContrastRatio(row.textColor, row.background) >= 3.0
```

**Feature: chrono-timeline, Property 9: Unknown Row Defaults to Physical**
```typescript
// Arbitraries: generate strings that are not valid RowKey values
// Property: loadEvents([{time: 0, title: 'x', row: unknownString}]).events[0].row === 'physical'
```

**Feature: chrono-timeline, Property 10: Viewport Culling Monotonicity**
```typescript
// Arbitraries: generate s1, s2 where 0.05 ≤ s1 < s2 ≤ 500, random panX
// Property: visibleCount(events, s1, panX, viewportWidth) ≤ visibleCount(events, s2, panX, viewportWidth)
```

**Feature: chrono-timeline, Property 11: Hit Test Radius**
```typescript
// Arbitraries: generate event screen positions, pointer offsets within radius, ViewState
// Property: hitTest(pointer, events, viewState, ..., isTouch) returns the event
//           when distance ≤ radius; returns null when distance > radius
```

**Feature: chrono-timeline, Property 12: India Secondary Marker Placement**
```typescript
// Arbitraries: generate events with non-empty india field assigned to non-India rows
// Property: getSecondaryMarkers(event, viewState).some(m => m.row === 'india' && m.screenX === primaryScreenX)
```

**Feature: chrono-timeline, Property 13: Time Header Values Correctness**
```typescript
// Arbitraries: generate ViewState objects (panX, zoomScale)
// Property: timeHeader.centreTime === txInverse((viewportWidth/2 - panX) / zoomScale / K)
//           and displayed powerOf10/multiplier/actualValue match centreTime
```

**Feature: chrono-timeline, Property 14: Label Column Width at Breakpoints**
```typescript
// Arbitraries: generate viewport widths in [200, 3840]
// Property: getLabelColumnWidth(w) === (w >= 1024 ? 180 : w >= 600 ? 120 : 80)
```

### Integration Tests

- Wikipedia_Fetcher: 1–2 real fetch calls to verify API contract (run in CI with network access)
- GitHub Actions build: `npm run build` completes without errors in Node.js 20 LTS
- Static output: `build/` contains `index.html` and `404.html`

### Accessibility Tests

- Automated: axe-core scan of rendered DOM for WCAG 2.1 AA violations
- Manual: keyboard navigation through HUD controls and List View table
- Manual: screen reader announcement of Detail Panel content via `aria-live="polite"`

### Performance Benchmarks

- Lighthouse CI: First Contentful Paint < 3s on simulated 4G
- Bundle size check: initial JS bundle < 500 KB (uncompressed), enforced in CI via `bundlesize`
- Frame rate: manual verification of 60 FPS with 200+ visible markers using Chrome DevTools

### SvelteKit-Specific Tests

- `+page.ts` `load()` function returns correct event array shape
- `adapter-static` build produces correct `404.html` redirect
- Base path configuration works when served from non-root path
