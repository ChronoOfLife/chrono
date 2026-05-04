# Implementation Plan: Chrono of Life — Interactive Timeline

## Overview

This plan converts the design document into an incremental sequence of coding tasks that build the SvelteKit + GSAP + TypeScript application from scaffolding through to CI/CD deployment. Each task builds on the previous one; no code is left orphaned. Tasks are ordered so that core math and data are validated early, then the rendering and navigation layers are layered on top, and finally polish, accessibility, and deployment are added.

## Tasks

- [x] 1. Scaffold SvelteKit project with TypeScript, GSAP, Vitest, and fast-check
  - Initialise a new SvelteKit project with `create svelte` using the TypeScript + ESLint template
  - Install and configure `@sveltejs/adapter-static` in `svelte.config.js`; set `fallback: '404.html'` and configure `base` path for GitHub Pages sub-path deployment
  - Install runtime dependencies: `gsap`, `@gsap/observer`
  - Install dev dependencies: `vitest`, `@vitest/coverage-v8`, `fast-check`, `axe-core`, `bundlesize`
  - Add `vitest.config.ts` with jsdom environment and coverage thresholds
  - Add `tsconfig.json` strict mode settings
  - Verify `npm run build` and `npm run test -- --run` both exit 0 on a clean project
  - _Requirements: 15.1, 15.5_

- [-] 2. Build the data pipeline — parse Phase 1–5 markdown → `events.json`
  - [x] 2.1 Write `scripts/parse-phases.ts` — a Node.js build script that reads `Chrono Phase 1.md` through `Chrono Phase 5.md`, parses each markdown table row into a `ChronoEvent` object, and writes `src/lib/data/events.json`
    - Map table columns to `ChronoEvent` fields: `time` (parse "From Current Era" column — handle "−13.8 Billion", "10^106", CE/BCE notation), `title` (from Physical/Evolution/Science/India/World columns), `row` (derive from which column the title came from), `india`, `world`, `link`, `scale`, `unit`, `age`, `fromBigBang`
    - Skip rows where both the primary content column and India column are "N/A"
    - Emit `console.warn` for any row missing a parseable time value
    - Write the output array to `src/lib/data/events.json`
    - Add `"parse-phases": "tsx scripts/parse-phases.ts"` to `package.json` scripts
    - _Requirements: 1.1, 1.2, 1.3, 1.6_

  - [ ]* 2.2 Write property test — Property 2: Malformed Event Skipping
    - **Property 2: Malformed Event Skipping**
    - Use `fc.array(fc.record({...}))` to generate mixed arrays of valid and invalid entries
    - Assert `loadEvents(array).events.length === validCount`
    - **Validates: Requirements 1.3**

  - [x] 2.3 Implement `src/lib/data/loader.ts` — `loadEvents(jsonPath): LoadResult`
    - Parse the JSON array, validate each entry for `time` (number) and `title` (string)
    - Skip malformed entries with `console.warn`; default unknown `row` values to `'physical'` with a warning
    - Export `ChronoEvent`, `RowKey`, and `LoadResult` TypeScript interfaces
    - _Requirements: 1.1, 1.3, 1.4, 4.3_

  - [ ]* 2.4 Write property test — Property 1: Event JSON Round-Trip
    - **Property 1: Event JSON Round-Trip**
    - Generate random `ChronoEvent` objects with `fc.record`; assert `JSON.parse(JSON.stringify(e))` deeply equals `e`
    - **Validates: Requirements 1.5**

  - [ ]* 2.5 Write property test — Property 9: Unknown Row Defaults to Physical
    - **Property 9: Unknown Row Defaults to Physical**
    - Generate strings that are not valid `RowKey` values; assert `loadEvents([{time:0, title:'x', row: unknownString}]).events[0].row === 'physical'`
    - **Validates: Requirements 4.3**

  - [x] 2.6 Wire `loader.ts` into SvelteKit `+page.ts` `load()` function
    - Import `events.json` statically; call `loadEvents`; return `{ events, warnings }` as page data
    - _Requirements: 1.4_

- [ ] 3. Checkpoint — data pipeline
  - Run `npm run parse-phases` and verify `events.json` contains ≥ 500 entries
  - Run `npm run test -- --run` and ensure all property tests pass
  - Ask the user if questions arise.

- [-] 4. Implement core math modules — logarithmic axis and screen mapping
  - [x] 4.1 Create `src/lib/math/axis.ts` with `tx`, `txInverse`, and `screenX` functions
    - Implement `tx(t: number): number` — `Math.sign(t) * Math.log10(Math.abs(t) + 1) * K`
    - Implement `txInverse(px: number): number` — inverse of `tx`
    - Implement `screenX(t, viewState, viewportWidth): number`
    - Export `K = 120` as a named constant; export `ViewState` interface
    - _Requirements: 2.1, 2.2_

  - [ ]* 4.2 Write property test — Property 3: Logarithmic Axis Monotonicity
    - **Property 3: Logarithmic Axis Monotonicity**
    - Generate pairs `(a, b)` where `|a| < |b|`, both in `[-13.8e9, 1e106]`; assert `Math.abs(tx(a)) < Math.abs(tx(b))`
    - **Validates: Requirements 2.5**

  - [ ]* 4.3 Write property test — Property 4: Logarithmic Axis Round-Trip
    - **Property 4: Logarithmic Axis Round-Trip**
    - Generate `t` in `[-13.8e9, 1e106]`; assert `Math.abs(txInverse(tx(t)) - t) / (Math.abs(t) + 1) < 1e-6`
    - **Validates: Requirements 2.6**

  - [x] 4.4 Create `src/lib/layout/rows.ts` — row schema and layout engine
    - Define `ROW_DEFINITIONS` array with all seven `RowDefinition` objects (keys, labels, colours, row indices)
    - Implement `computeRowLayout(viewportWidth, viewportHeight): RowLayout`
    - Implement `getLabelColumnWidth(viewportWidth): 180 | 120 | 80`
    - _Requirements: 4.1, 4.4, 10.3, 10.4_

  - [ ]* 4.5 Write property test — Property 7: Row Heights Proportional to Viewport
    - **Property 7: Row Heights Proportional to Viewport**
    - Generate viewport heights in `[400, 4000]` and row counts in `[8, 20]`; assert each row height equals `Math.floor(h / n) ± 1`
    - **Validates: Requirements 4.4, 10.4**

  - [ ]* 4.6 Write property test — Property 14: Label Column Width at Breakpoints
    - **Property 14: Label Column Width at Breakpoints**
    - Generate viewport widths in `[200, 3840]`; assert `getLabelColumnWidth(w) === (w >= 1024 ? 180 : w >= 600 ? 120 : 80)`
    - **Validates: Requirements 10.3**

  - [ ]* 4.7 Write property test — Property 8: Row Colour Contrast
    - **Property 8: Row Colour Contrast**
    - Iterate over all `ROW_DEFINITIONS` (deterministic); implement `wcagContrastRatio(fg, bg)` helper; assert ratio ≥ 3.0 for each row
    - **Validates: Requirements 4.6**

- [x] 5. Implement the Navigator — GSAP pan, zoom, momentum, and boundary clamping
  - [x] 5.1 Create `src/lib/navigator/navigator.ts`
    - Implement `NavigatorConfig` and `ViewState` types
    - Implement `clampViewState(state, config, viewportWidth): ViewState` — enforces Big Bang left boundary, Heat Death right boundary, and zoom range `[0.05, 500]`
    - Implement `applyPan(state, deltaX, config, viewportWidth): ViewState`
    - Implement `applyZoom(state, factor, originX, config, viewportWidth): ViewState` — zoom centred on `originX`
    - _Requirements: 2.3, 2.4, 6.5, 6.7_

  - [ ]* 5.2 Write property test — Property 5: Navigator Boundary and Zoom Invariants
    - **Property 5: Navigator Boundary and Zoom Invariants**
    - Generate sequences of pan/zoom deltas applied to random initial `ViewState`; assert Big Bang screenX ≤ viewportWidth, Heat Death screenX ≥ 0, and `0.05 ≤ zoomScale ≤ 500` after all operations
    - **Validates: Requirements 2.3, 2.4, 6.5, 6.7**

  - [x] 5.3 Create `src/lib/navigator/gsap-observer.ts` — wire GSAP Observer to navigator functions
    - Register GSAP Observer on the timeline container element
    - Map `onDrag` / `onWheel` to `applyPan`; map `onChangeX` with Ctrl/Meta modifier to `applyZoom`
    - Implement pinch-to-zoom via `onPress` / `onMove` touch events; compute midpoint and scale factor
    - Apply momentum decay via `gsap.to` with `power2.out` easing on pointer release
    - Suppress native browser scroll with `event.preventDefault()` on touch start
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 12.1, 12.2, 12.3, 12.4_

  - [x] 5.4 Add keyboard navigation to the Navigator
    - Listen for `ArrowLeft` / `ArrowRight` (pan), `+` / `-` (zoom), `Home` (reset to t=0 at Era scale)
    - Wire to the same `applyPan` / `applyZoom` functions
    - _Requirements: 6.8_

- [ ] 6. Checkpoint — math and navigation
  - Run all property tests; verify boundary clamping and zoom invariants pass
  - Manually verify pan and zoom work in the browser with `npm run dev`
  - Ask the user if questions arise.

- [-] 7. Implement the Renderer — canvas layer, DOM layer, and ellipsoid projection
  - [x] 7.1 Create `src/lib/renderer/canvas-layer.ts` — canvas marker rendering
    - Implement `drawMarkers(ctx, events, viewState, rowLayout, scaleLevel, viewportWidth)` — draws circular/icon markers for all events whose `screenX` falls within `[0, viewportWidth]` (culling)
    - Implement `getMarkerStyle(row: RowKey): MarkerStyle` — maps row key to icon shape and colour
    - Implement `getScaleLevel(zoomScale): ScaleLevel`
    - Suspend `requestAnimationFrame` when idle for >500ms
    - _Requirements: 5.1, 5.2, 5.3, 13.1, 13.2, 13.3, 13.5_

  - [ ]* 7.2 Write property test — Property 10: Viewport Culling Monotonicity
    - **Property 10: Viewport Culling Monotonicity**
    - Generate `s1 < s2` in `[0.05, 500]` and random `panX`; assert `visibleCount(events, s1, panX, w) ≤ visibleCount(events, s2, panX, w)`
    - **Validates: Requirements 5.8**

  - [x] 7.3 Create `src/lib/renderer/ellipsoid.ts` — ellipsoid projection helpers
    - Implement `getEllipsoidYOffset(rowCentreY, viewportHeight): number` — computes the vertical curve offset for a given row's Y position
    - Implement `getEllipsoidTransform(viewportHeight): string` — returns the CSS perspective transform string for the timeline container
    - Ensure horizontal `screenX` is unaffected by the Y offset
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 7.4 Write property test — Property 6: Ellipsoid Projection Preserves Horizontal Position
    - **Property 6: Ellipsoid Projection Preserves Horizontal Position**
    - Generate random time values and `ViewState` objects; assert `marker.screenX === screenX(t, viewState, viewportWidth)` regardless of Y offset
    - **Validates: Requirements 3.6**

  - [x] 7.5 Create `src/routes/+page.svelte` — main timeline page component
    - Render the full-viewport container (`width: 100vw; height: 100vh; overflow: hidden`)
    - Mount the canvas layer and DOM label layer
    - Render row bands as fixed-height `<div>` elements with CSS background colours from `ROW_DEFINITIONS`
    - Apply ellipsoid CSS perspective transform to the timeline container
    - Render sticky left-edge row label column (width from `getLabelColumnWidth`)
    - Wire `ViewState` as a Svelte store; subscribe canvas and DOM layers to it
    - _Requirements: 3.1, 4.1, 4.2, 10.1, 10.2, 10.4_

  - [x] 7.6 Implement DOM label layer in `+page.svelte`
    - Use `{#each visibleEvents as event}` to render absolutely positioned label elements
    - Show/hide labels via GSAP `autoAlpha` based on `ScaleLevel` (no labels at Overview; labels at Era+; age sub-label at Period+)
    - Animate label transitions with 200ms duration and 20ms stagger
    - _Requirements: 5.3, 5.4, 5.5, 5.6_

  - [x] 7.7 Render longitude lines at cosmologically significant boundaries
    - Draw vertical lines at: −13.8 Gyr, −4.6 Gyr, −3.8 Gyr, −65 Myr, −2.8 Myr, −10,000 BCE, 0 CE, +5 Gyr, +10^14 yr, +10^100 yr
    - Recompute visible lines on every pan/zoom update
    - _Requirements: 2.7, 2.8_

- [x] 8. Implement the Hit_Tester
  - [x] 8.1 Create `src/lib/hit-tester/hit-tester.ts`
    - Implement `hitTest(pointerX, pointerY, events, viewState, rowLayout, isTouch, viewportWidth): HitTestResult`
    - Iterate only over currently visible (culled) events
    - Use radius 12px for mouse, 24px for touch
    - Account for `zoomScale`, `panX`, and ellipsoid Y-offset when computing distances
    - Return the closest event within radius, or `{ event: null, distance: Infinity }`
    - _Requirements: 7.1, 7.2_

  - [ ]* 8.2 Write property test — Property 11: Hit Test Radius
    - **Property 11: Hit Test Radius**
    - Generate event screen positions, pointer offsets within and beyond radius, and `ViewState`; assert hit within radius returns the event and beyond radius returns null
    - **Validates: Requirements 7.1, 7.2, 12.5**

- [x] 9. Implement the Wikipedia_Fetcher and Detail Panel
  - [x] 9.1 Create `src/lib/wikipedia/fetcher.ts`
    - Implement `fetchWikiSummary(title, timeoutMs = 5000): Promise<WikiSummary | null>`
    - Use `AbortController` for timeout; return `null` on any error or non-OK response
    - _Requirements: 7.4, 7.5_

  - [x] 9.2 Create `src/lib/components/DetailPanel.svelte`
    - Display: event title, `age`, `scale`, `world` description, `india` description (if present), "Read more on Wikipedia" link (if `link` present)
    - On mount, call `fetchWikiSummary`; populate with `extract` text; fall back to `world` field on failure
    - Set `aria-live="polite"` on the content region
    - Position as a floating card anchored near the selected marker; reposition to stay within viewport bounds
    - On mobile (viewport < 600px), render as a bottom sheet occupying ≤ 50% viewport height
    - Close on Escape key or outside click; restore focus to the previously selected marker
    - Implement full keyboard navigation: Tab through interactive elements, Enter activates links
    - _Requirements: 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 12.8, 14.3, 14.4_

- [ ] 10. Checkpoint — rendering and interaction
  - Verify event markers render correctly at all scale levels
  - Verify Detail Panel opens, fetches Wikipedia content, and falls back gracefully
  - Verify hit testing works for both mouse and touch
  - Run all tests with `npm run test -- --run`
  - Ask the user if questions arise.

- [ ] 11. Implement Time Header rows and Age row
  - [x] 11.1 Create `src/lib/components/TimeHeader.svelte`
    - Reactively compute visible `TimeColumn` values from the current `ViewState` Svelte store
    - Render Rows 4–6 (From Current Era): Power of 10, Multiplier, Actual Value — green background
    - Render Rows 7–9 (From Big Bang): equivalent values from Big Bang origin — yellow/amber background
    - Render Row 10 (Unit): unit label based on zoom level
    - Render Row 11 (Scale): scale category label based on zoom level
    - Update on every pan/zoom event; apply sticky left-edge label column
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.7_

  - [ ]* 11.2 Write property test — Property 13: Time Header Values Correctness
    - **Property 13: Time Header Values Correctness**
    - Generate `ViewState` objects; assert `timeHeader.centreTime === txInverse((viewportWidth/2 - panX) / zoomScale / K)` and displayed `powerOf10`/`multiplier`/`actualValue` match `centreTime`
    - **Validates: Requirements 9.1, 9.2, 9.3**

  - [x] 11.3 Create `src/lib/components/AgeRow.svelte`
    - Reactively compute the geological/historical age label for the time value at the viewport centre
    - Render Row 21 with light green background and green text
    - Apply sticky left-edge label column
    - _Requirements: 9.6, 9.7_

- [ ] 12. Implement the HUD
  - [x] 12.1 Create `src/lib/components/HUD.svelte`
    - Display current time value at viewport centre as a human-readable string (e.g., "13.8 Billion Years Ago", "500 BCE", "2045 CE", "10^14 Years from Now")
    - Display current Scale Level name
    - Position fixed at top of viewport; do not overlap Time Header rows
    - Include "Reset View" button: GSAP tween to t=0 at Era scale over 800ms
    - Include compact row legend (colour swatch + label for each row)
    - Include "India" toggle button that activates/deactivates the India filter
    - Include "List View" toggle button
    - On viewport < 600px: collapse to time indicator + India toggle only (hide row legend)
    - Ensure all HUD controls have minimum 44×44px tap targets on touch devices
    - Add `aria-label` attributes to all interactive controls
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 12.6, 14.4_

  - [x] 12.2 Wire HUD time indicator to ViewState store
    - Subscribe to `ViewState`; compute `txInverse` of viewport centre; format as human-readable string
    - Update within 100ms of any pan/zoom event
    - _Requirements: 6.9, 11.1_

- [ ] 13. Implement the India-centric lens
  - [ ] 13.1 Add India secondary marker rendering to the canvas layer
    - For each event with a non-empty `india` field assigned to a non-India row, render a secondary saffron-coloured marker in the India row at the same `screenX`
    - Draw a subtle connecting line between the primary and secondary markers
    - _Requirements: 8.1, 8.2_

  - [ ]* 13.2 Write property test — Property 12: India Secondary Marker Placement
    - **Property 12: India Secondary Marker Placement**
    - Generate events with non-empty `india` field on non-India rows; assert `getSecondaryMarkers(event, viewState)` includes a marker with `row === 'india'` and `screenX === primaryScreenX`
    - **Validates: Requirements 8.2**

  - [ ] 13.3 Implement India filter in the Renderer
    - When India filter is active (from HUD toggle), use GSAP `autoAlpha` to dim all non-India events to 0.2 and highlight India events
    - When Detail Panel is open with India filter active, display `india` field before `world` field
    - Ensure India row label remains visible in sticky column regardless of filter state
    - _Requirements: 8.3, 8.4, 8.5, 8.6_

- [ ] 14. Implement responsive layout and mobile support
  - [ ] 14.1 Add responsive CSS to `+page.svelte` and layout components
    - Implement three breakpoints: mobile < 600px, tablet 600–1023px, desktop ≥ 1024px
    - Sticky label column widths: 80px / 120px / 180px
    - Row heights: `100vh / totalRowCount` on screens ≥ 600px tall; allow vertical scroll on shorter screens
    - Ellipsoid curvature expressed as a percentage of viewport height
    - HUD positioned at top; does not overlap Time Header rows
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.7, 10.8_

  - [ ] 14.2 Handle viewport resize
    - Add a debounced `resize` event listener that recomputes `RowLayout` and `ViewportState`
    - Trigger a single RAF redraw after resize; no layout shift visible
    - Handle device orientation change on mobile
    - _Requirements: 10.6, 12.7_

- [ ] 15. Implement accessibility — List View, ARIA, keyboard navigation
  - [x] 15.1 Create `src/lib/components/ListView.svelte`
    - Render all events as a scrollable `<table>` with columns: Time (from present), Time (from Big Bang), Unit, Scale, Physical & Natural, Evolution & Civilisation, Science & Technology, India, World, Age
    - Toggle visibility via the HUD "List View" button
    - Each row in the table is keyboard-focusable; Enter opens the Detail Panel for that event
    - _Requirements: 14.1, 14.2_

  - [ ] 15.2 Add ARIA attributes and keyboard navigation throughout
    - Add `aria-label` to all HUD buttons, Detail Panel close button, and event markers in List View
    - Ensure `aria-live="polite"` is set on the Detail Panel content region
    - Verify Tab order through HUD controls is logical
    - Add `role="region"` and `aria-label` to the main timeline canvas area
    - _Requirements: 14.3, 14.4, 14.6_

  - [ ] 15.3 Verify colour contrast for all rows
    - Confirm each row's `textColor` vs `background` meets WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text)
    - Confirm each row uses a distinct icon shape or pattern in addition to colour
    - _Requirements: 14.5, 14.6_

- [ ] 16. Checkpoint — full feature integration
  - Run `npm run test -- --run` and verify all 14 property tests pass
  - Verify List View renders all events and is keyboard-navigable
  - Verify India filter, Detail Panel, HUD, and responsive layout all work together
  - Ask the user if questions arise.

- [ ] 17. Performance optimisation
  - [ ] 17.1 Implement lazy loading for fine-grained scale levels
    - Split event data into scale buckets (Overview/Era vs Period/Decade/Year)
    - Load Period+ data on demand when the user first zooms to that level using dynamic `import()`
    - _Requirements: 13.4_

  - [ ] 17.2 Add `will-change: transform` and idle RAF suspension
    - Apply `will-change: transform` to the timeline container element
    - Implement idle detection: suspend RAF requests after 500ms of no user input; resume on next input event
    - _Requirements: 13.1, 13.5_

  - [ ] 17.3 Add `bundlesize` check to enforce 500 KB initial JS bundle limit
    - Configure `.bundlesizerc` or `bundlesize` field in `package.json` with `maxSize: "500 kB"` for the initial JS chunk
    - Add `bundlesize` to the `npm run build` post-step or as a separate CI check
    - _Requirements: 13.7, 15.6_

- [ ] 18. Set up GitHub Actions CI/CD — build and deploy to gh-pages
  - [x] 18.1 Create `.github/workflows/deploy.yml`
    - Trigger on push to `main` branch
    - Steps: checkout, setup Node.js 20 LTS, `npm ci`, `npm run parse-phases`, `npm run test -- --run`, `npm run build`, deploy `build/` to `gh-pages` branch using `peaceiris/actions-gh-pages`
    - _Requirements: 15.3, 15.5_

  - [ ] 18.2 Verify static output correctness
    - Assert `build/index.html` exists after build
    - Assert `build/404.html` exists and contains a redirect to `index.html`
    - Assert the application loads correctly when served from the configured `base` path
    - _Requirements: 15.1, 15.2, 15.4_

  - [ ]* 18.3 Add Lighthouse CI step to the workflow
    - Install `@lhci/cli`; add a `lighthouserc.js` asserting First Contentful Paint < 3s on simulated 4G
    - Run `lhci autorun` against the built static output in CI
    - _Requirements: 13.6_

- [ ] 19. Final checkpoint — all tests pass, build succeeds, deployment verified
  - Run `npm run parse-phases` and confirm ≥ 500 events in `events.json`
  - Run `npm run test -- --run` and confirm all 14 property-based tests and all unit tests pass
  - Run `npm run build` and confirm it exits 0 with no errors
  - Confirm `build/index.html` and `build/404.html` are present
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at each major layer boundary
- Property tests validate the 14 universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- The `scripts/parse-phases.ts` script must be run before `npm run build` to generate `events.json`
- The existing `engine.js`, `index.html`, and `data.json` files are replaced by SvelteKit output — do not delete them until the SvelteKit build is verified working
- The five `Chrono Phase N.md` files are read-only source data; never modify them
