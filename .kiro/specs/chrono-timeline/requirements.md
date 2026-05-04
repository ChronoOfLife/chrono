# Requirements Document

## Introduction

Chrono of Life is an interactive, zoomable timeline spanning from the Big Bang (~13.8 billion years ago) to the Heat Death of the universe (~10^106 years in the future). The application presents hundreds of events across cosmic, geological, biological, civilisational, and future categories, with a strong India-centric lens alongside global events.

The visual metaphor is an **ellipsoid globe projection**: the timeline is rendered as a curved, globe-like surface where horizontal latitudes flow infinitely left-to-right through time, and vertical longitude lines mark points in time. The Big Bang anchors the extreme left; the Big Rip / Heat Death anchors the extreme right — scroll stops at both hard boundaries. Events are placed as graphical markers on this curved surface, each carrying an icon and label, clickable to reveal a Wikipedia snippet.

The current prototype is a vanilla JS canvas engine with 9 hardcoded events, no real Y-axis, broken click detection, no mobile support, and unreadable text. This feature replaces it entirely with a SvelteKit-based Zooming User Interface (ZUI) powered by GSAP, featuring a logarithmic time axis, a structured multi-row Y-axis matching the spreadsheet schema, semantic zoom, full event dataset, and a polished detail panel — all deployable as a static site on GitHub Pages.

The layout fills the entire screen/viewport at every breakpoint, from mobile portrait to large desktop, with no dead space.

---

## Glossary

- **Timeline**: The interactive 2D plane displaying all events as a curved ellipsoid projection.
- **Ellipsoid Projection**: The visual metaphor where the timeline surface curves like a globe — horizontal bands (latitudes) flow left-to-right through time; vertical lines (longitudes) mark temporal positions.
- **Event**: A single data point with a time value, title, category row assignment, optional India context, optional world context, and optional Wikipedia link.
- **Event Marker**: The graphical element (icon + label) placed at an event's coordinate on the Timeline. Replaces the plain dot of the prototype.
- **ZUI (Zooming User Interface)**: A navigation paradigm where the user pans and zooms a 2D plane to explore content at varying levels of detail.
- **Semantic Zoom**: A zoom behaviour where the level of detail rendered (labels, descriptions, secondary metadata) changes as a function of the current zoom scale.
- **Logarithmic Time Axis**: The horizontal axis where position is computed as `sign(t) × log10(|t| + 1) × K`, compressing the vast range from −13.8 billion years to 10^106 years into a navigable space.
- **Row Schema**: The fixed vertical structure of the Timeline, derived from the spreadsheet layout — rows 12–23 as defined below.
- **Time Header Rows**: Rows 4–9 — the dual time-reference header showing "From Current Era" and "From Big Bang" values with Power-of-10 and Multiplier sub-rows.
- **Row 10 — Unit**: Displays the unit of measurement (Years, Seconds, etc.) for the current zoom column.
- **Row 11 — Scale**: Displays the scale label (Cosmic, Galactic, Solar, Planetary, Bio, etc.) for the current zoom column.
- **Row 12 — Physical & Natural Transformations**: Events describing physical universe changes, geology, climate, and natural phenomena.
- **Row 13 — Evolution of Human & Civilisation**: Events describing species evolution, societal development, empires, and cultural milestones.
- **Row 14 — Science, Technology & Innovations**: Events describing scientific discoveries, inventions, and technological breakthroughs.
- **Row 15 — India**: Events where India is the primary subject, sourced from the India column of the phase documents.
- **Row 16 — World / Asia**: World events with an Asia sub-row.
- **Row 17 — World / Europe**: World events with a Europe sub-row.
- **Row 18 — World / America**: World events with an America sub-row.
- **Row 21 — Age**: The geological or historical age label (e.g., "Iron Age", "Cambrian", "Mughal Era") for the current time column.
- **HUD (Heads-Up Display)**: Fixed screen-space UI elements that remain stationary while the Timeline plane transforms.
- **Detail Panel**: An overlay that displays full event metadata and Wikipedia summary when an event is selected.
- **Scale Level**: A discrete zoom tier (Overview, Era, Period, Decade, Year) governing which events and labels are visible.
- **SvelteKit**: The frontend framework used to build and statically generate the application.
- **GSAP**: GreenSock Animation Platform — used for all Timeline transforms, semantic zoom transitions, and momentum scrolling.
- **Wikipedia_Fetcher**: The client-side module that retrieves Wikipedia summary text for a given event title.
- **Data_Loader**: The build-time module that reads the JSON event files and makes them available to SvelteKit components.
- **Hit_Tester**: The module responsible for determining which Event Marker, if any, corresponds to a pointer or touch interaction.
- **Renderer**: The SvelteKit component tree responsible for drawing Event Markers, row bands, axis elements, and the ellipsoid curve.
- **Navigator**: The GSAP Observer + ScrollTrigger integration that translates user input into Timeline transforms.

---

## Requirements

### Requirement 1: Data Model and Full Event Dataset

**User Story:** As a visitor, I want to see hundreds of events spanning the full history of the universe, so that I can explore the complete Chrono of Life dataset rather than a 9-event stub.

#### Acceptance Criteria

1. THE Data_Loader SHALL parse a JSON event file where each entry contains at minimum: `time` (number, years relative to present), `title` (string), `row` (string — one of: `physical`, `evolution`, `science`, `india`, `world_asia`, `world_europe`, `world_america`), and optionally `india` (string), `world` (string), `link` (string), `scale` (string), `unit` (string), `age` (string), `fromBigBang` (string), `powerOf10` (string), and `multiplier` (string).
2. THE Data_Loader SHALL load all events from the five phase documents (Phase 1–5), covering the range from −13.8 billion years to 10^106 years.
3. WHEN the Data_Loader encounters a malformed event entry (missing `time` or `title`), THE Data_Loader SHALL skip that entry and log a warning without halting the build.
4. THE Data_Loader SHALL expose the parsed event array to SvelteKit components at build time via a static data import.
5. FOR ALL valid event objects `e`, parsing the JSON then serialising it then parsing again SHALL produce an object equal to `e` (round-trip property).
6. THE Data_Loader SHALL support at least 500 events without degrading build time beyond 30 seconds on a standard CI runner.

---

### Requirement 2: Logarithmic Time Axis with Hard Boundaries

**User Story:** As a visitor, I want the horizontal axis to compress cosmic deep time and far future into a navigable space, with the Big Bang at the extreme left and the Big Rip/Heat Death at the extreme right, so that I can scroll the full span of existence.

#### Acceptance Criteria

1. THE Timeline SHALL map event time values to horizontal pixel positions using the function `tx(t) = sign(t) × log10(|t| + 1) × K`, where `K` is a configurable scale constant.
2. WHEN `t = 0` (present day), THE Timeline SHALL place the event at the horizontal centre of the axis.
3. THE Navigator SHALL enforce a hard left boundary at `t = −13.8 × 10^9` years (Big Bang) — panning SHALL NOT scroll past this point.
4. THE Navigator SHALL enforce a hard right boundary at `t = 10^106` years (Heat Death / Big Rip) — panning SHALL NOT scroll past this point.
5. FOR ALL pairs of events `(a, b)` where `|a.time| < |b.time|`, the pixel distance from the origin to `tx(a)` SHALL be less than the pixel distance from the origin to `tx(b)` (monotonicity property).
6. FOR ALL event time values `t` in the dataset, `tx(tx_inverse(tx(t)))` SHALL equal `tx(t)` within floating-point tolerance (round-trip property).
7. THE Timeline SHALL display vertical longitude lines at cosmologically significant boundaries: −13.8 Gyr, −4.6 Gyr, −3.8 Gyr, −65 Myr, −2.8 Myr, −10,000 BCE, 0 CE, +5 Gyr, +10^14 yr, +10^100 yr.
8. WHEN the Navigator changes the zoom scale, THE Timeline SHALL recompute visible longitude lines and time header values without reloading the page.

---

### Requirement 3: Ellipsoid Visual Projection

**User Story:** As a visitor, I want the timeline to look like a curved globe surface — with horizontal bands flowing through time and vertical lines marking temporal positions — so that the visual metaphor of navigating through cosmic history feels immersive.

#### Acceptance Criteria

1. THE Renderer SHALL apply a CSS or SVG perspective transform to the Timeline container so that the horizontal bands appear to curve away from the viewer at the top and bottom edges, simulating an ellipsoid surface.
2. THE ellipsoid curve SHALL be subtle enough that all row labels and event markers remain fully legible at all zoom levels.
3. THE vertical longitude lines SHALL be rendered as evenly spaced arcs (or straight lines with perspective foreshortening) that converge slightly toward the top and bottom of the viewport.
4. THE ellipsoid projection SHALL scale proportionally when the viewport is resized, maintaining the same visual curvature ratio at all screen sizes.
5. WHEN the user zooms in to Period scale or finer, THE Renderer MAY reduce the curvature intensity to prioritise legibility over the globe metaphor.
6. THE ellipsoid projection SHALL NOT distort event marker positions in a way that breaks the logarithmic time mapping — the horizontal position of any marker SHALL remain mathematically correct after projection.

---

### Requirement 4: Row Schema — Structured Y-Axis

**User Story:** As a visitor, I want events organised into clearly labelled horizontal rows matching the spreadsheet schema, so that I can instantly locate physical events, human evolution, science, India-specific events, and world events by region.

#### Acceptance Criteria

1. THE Timeline SHALL render the following fixed rows in top-to-bottom order, each as a distinct horizontal band with a unique background colour:
   - **Rows 4–6 (Time Header — From Current Era)**: Green background. Displays Power of 10, Multiplier, and Actual Value for the time columns currently in view.
   - **Rows 7–9 (Time Header — From Big Bang)**: Yellow/amber background. Displays Power of 10, Multiplier, and Actual Value measured from the Big Bang.
   - **Row 10 (Unit)**: Neutral background. Displays the unit label (e.g., "Years", "Seconds") for the current zoom level.
   - **Row 11 (Scale)**: Neutral background. Displays the scale label (e.g., "Cosmic", "Galactic", "Planetary") for the current zoom level.
   - **Row 12 (Physical & Natural Transformations)**: Light green background. Events describing physical universe changes, geology, climate, and natural phenomena.
   - **Row 13 (Evolution of Human & Civilisation)**: Light yellow/cream background. Events describing species evolution, societal development, empires, and cultural milestones.
   - **Row 14 (Science, Technology & Innovations)**: Light blue background. Events describing scientific discoveries, inventions, and technological breakthroughs.
   - **Row 15 (India)**: Medium blue background, white text. Events where India is the primary subject.
   - **Row 16 (World / Asia)**: Dark blue background, white text. World events — Asia sub-row.
   - **Row 17 (World / Europe)**: Dark blue background, white text. World events — Europe sub-row.
   - **Row 18 (World / America)**: Dark blue background, white text. World events — America sub-row.
   - **Row 21 (Age)**: Light green background, green text. Displays the geological or historical age label for the current time position.
2. THE row labels (column A in the spreadsheet) SHALL be rendered as sticky left-edge labels that remain visible in screen space while the Timeline pans horizontally.
3. WHEN an event's `row` field does not match any defined row key, THE Renderer SHALL assign it to Row 12 (Physical) as a default and log a warning.
4. THE row heights SHALL be proportional to the viewport height so that all rows are visible simultaneously without vertical scrolling on screens ≥ 600px tall.
5. ON screens < 600px tall, THE Renderer SHALL allow vertical scrolling within the Timeline to access all rows.
6. THE row background colours SHALL maintain a minimum contrast ratio of 3:1 against event marker text per WCAG 2.1 AA for large text.

---

### Requirement 5: Event Markers with Icons and Labels

**User Story:** As a visitor, I want each event to be represented by a graphic icon and a text label on the timeline, so that I can visually identify events at a glance without having to click each one.

#### Acceptance Criteria

1. EACH Event Marker SHALL consist of: a circular or icon-shaped graphic element, a short title label rendered below or beside the graphic, and a subtle connecting line to the row's baseline.
2. THE icon style SHALL vary by row assignment: physical/cosmic events use a star/burst icon; evolution events use a DNA/figure icon; science events use a lightbulb/atom icon; India events use a saffron-coloured marker; world events use a globe/flag icon.
3. WHEN the Timeline is at Overview scale, THE Renderer SHALL display only the graphic element (no label text) for all Event Markers.
4. WHEN the Timeline is at Era scale or finer, THE Renderer SHALL display the title label alongside the graphic element for events whose markers are at least 40px apart on screen.
5. WHEN the Timeline is at Period scale or finer, THE Renderer SHALL additionally display the `age` field as a secondary label beneath the title.
6. WHEN the Timeline transitions between Scale Levels, THE Renderer SHALL animate label opacity using GSAP `autoAlpha` with a duration of 200ms and a stagger of 20ms per label.
7. THE Renderer SHALL NOT render Event Markers for events whose computed screen position falls outside the current viewport bounds (culling property).
8. FOR ALL zoom scale values `s1` and `s2` where `s1 < s2`, the number of visible Event Markers at `s1` SHALL be less than or equal to the number at `s2` (monotonic detail property).

---

### Requirement 6: Navigation — Pan and Zoom

**User Story:** As a visitor, I want to pan horizontally and zoom in/out using mouse, keyboard, and touch gestures, so that I can navigate the full timeline span fluidly on any device.

#### Acceptance Criteria

1. THE Navigator SHALL unify mouse-wheel, trackpad scroll, touch swipe, and pointer drag into a single horizontal pan event stream via GSAP Observer.
2. WHEN the user scrolls the mouse wheel vertically (without modifier keys), THE Navigator SHALL translate that input into horizontal pan of the Timeline.
3. WHEN the user performs a pinch gesture on a touch device, THE Navigator SHALL zoom the Timeline centred on the midpoint of the two touch points.
4. WHEN the user scrolls the mouse wheel while holding the Ctrl or Meta key, THE Navigator SHALL zoom the Timeline centred on the current pointer position.
5. THE Navigator SHALL clamp the zoom scale to the range [0.05, 500] and SHALL NOT allow the Timeline to zoom beyond these bounds.
6. WHEN the user releases a pan gesture, THE Navigator SHALL apply momentum decay (easing) via GSAP so that the Timeline glides to a stop rather than stopping abruptly.
7. THE Navigator SHALL enforce the hard left (Big Bang) and hard right (Heat Death) boundaries during all pan and momentum operations.
8. THE Navigator SHALL support keyboard navigation: ArrowLeft/ArrowRight for pan, +/- for zoom, and Home to return to the present-day anchor.
9. WHEN the Timeline is panned or zoomed, THE HUD time indicator SHALL update to reflect the time value at the horizontal centre of the viewport within 100ms.

---

### Requirement 7: Event Selection and Detail Panel

**User Story:** As a visitor, I want to click or tap an event marker to read its full description, India context, and a Wikipedia summary, so that I can learn about any event in depth.

#### Acceptance Criteria

1. WHEN the user clicks or taps within 12 logical pixels of an Event Marker's centre (24px on touch devices), THE Hit_Tester SHALL identify that event as selected.
2. THE Hit_Tester SHALL account for the current zoom scale, pan offset, and ellipsoid projection transform when computing the logical distance between the pointer position and each Event Marker centre.
3. WHEN an event is selected, THE Detail Panel SHALL become visible and SHALL display: the event title, the `age` label, the `scale` label, the `world` description, the `india` description (if present), and a "Read more on Wikipedia" link (if a `link` field is present).
4. WHEN an event with a `link` field is selected, THE Wikipedia_Fetcher SHALL request the Wikipedia REST summary endpoint (`https://en.wikipedia.org/api/rest_v1/page/summary/{title}`) and SHALL populate the Detail Panel with the returned `extract` text.
5. IF the Wikipedia_Fetcher request fails or times out after 5 seconds, THEN THE Detail Panel SHALL display the locally stored `world` description as a fallback without showing an error to the user.
6. WHEN the user clicks outside the Detail Panel or presses the Escape key, THE Detail Panel SHALL close and the previously selected Event Marker SHALL return to its default visual state.
7. THE Detail Panel SHALL be keyboard-navigable: Tab moves focus through interactive elements, Enter activates links, and Escape closes the panel.
8. THE Detail Panel SHALL be positioned so it does not obscure the selected Event Marker — it SHALL appear as a floating card anchored near the marker, repositioning to stay within viewport bounds.

---

### Requirement 8: India-Centric Lens

**User Story:** As a visitor interested in Indian history, I want Indian events and context to be visually prominent and consistently present, so that the India-centric perspective of the project is always accessible.

#### Acceptance Criteria

1. THE Timeline SHALL render Row 15 (India) with a distinct saffron/blue colour scheme that visually differentiates it from the World rows.
2. WHEN an event carries a non-empty `india` field AND is assigned to a non-India row, THE Renderer SHALL render a secondary India marker in Row 15 at the same horizontal position, linked visually to the primary marker.
3. WHEN the user activates an India-specific filter via the HUD, THE Renderer SHALL highlight all events with a non-empty `india` field and SHALL dim all other events using GSAP `autoAlpha` to 0.2.
4. THE HUD SHALL include a persistent "India" toggle button that activates and deactivates the India filter.
5. WHEN the India filter is active, THE Detail Panel SHALL display the `india` field content before the `world` field content.
6. THE India row label SHALL always be visible in the sticky left-edge column regardless of filter state.

---

### Requirement 9: Time Header Rows and Age Row

**User Story:** As a visitor, I want to see the current time position expressed both as "years from present" and "years from Big Bang", with the geological/historical age label, so that I always have full temporal context.

#### Acceptance Criteria

1. THE Timeline SHALL render Rows 4–6 (From Current Era header) showing, for each visible time column: the Power of 10 exponent, the Multiplier value, and the Actual Value in human-readable form.
2. THE Timeline SHALL render Rows 7–9 (From Big Bang header) showing the equivalent values measured from the Big Bang origin point.
3. THE Time Header rows SHALL update dynamically as the user pans or zooms, reflecting the time values of the columns currently centred in the viewport.
4. Row 10 (Unit) SHALL display the appropriate unit label ("Years", "Millions of Years", "Billions of Years", "Seconds") based on the current zoom level.
5. Row 11 (Scale) SHALL display the scale category label ("Cosmic", "Galactic", "Solar", "Planetary", "Bio", "Geological", "Historical", "Modern") based on the current zoom level.
6. Row 21 (Age) SHALL display the geological or historical age name (e.g., "Hadean", "Cambrian", "Iron Age", "Mughal Era", "Space Age") for the time range currently centred in the viewport.
7. THE Time Header rows and Age row SHALL be rendered with the same sticky left-edge label column as the content rows.

---

### Requirement 10: Responsive Full-Viewport Layout

**User Story:** As a visitor on any device — from a 320px mobile screen to a 4K desktop — I want the timeline to fill the entire screen with no dead space, so that I get the maximum immersive experience on my device.

#### Acceptance Criteria

1. THE Timeline container SHALL use `width: 100vw; height: 100vh` (or equivalent) so that it fills the full browser viewport at all times.
2. THE layout SHALL be fully responsive with no horizontal or vertical overflow on the page body — all scrolling SHALL occur within the Timeline's own pan/zoom system.
3. ON viewports ≥ 1024px wide, THE sticky row label column SHALL be 180px wide; on viewports 600–1023px, it SHALL be 120px wide; on viewports < 600px, it SHALL be 80px wide.
4. THE row heights SHALL scale proportionally to `100vh / total_row_count` so that all rows fit within the viewport height on screens ≥ 600px tall.
5. ON screens < 600px tall, THE Renderer SHALL allow vertical scrolling within the Timeline container to access all rows, while horizontal pan remains the primary navigation.
6. WHEN the browser window is resized, THE Renderer SHALL recompute all layout dimensions and redraw within one animation frame, with no layout shift visible to the user.
7. THE ellipsoid projection curvature SHALL be expressed as a percentage of viewport height so it scales correctly at all resolutions.
8. THE HUD SHALL be positioned at the top of the viewport and SHALL NOT overlap the Time Header rows.

---

### Requirement 11: Heads-Up Display (HUD)

**User Story:** As a visitor, I want persistent on-screen indicators showing my current temporal position and zoom level, so that I always know where I am on the timeline.

#### Acceptance Criteria

1. THE HUD SHALL display the approximate time value at the horizontal centre of the viewport, formatted as a human-readable string (e.g., "13.8 Billion Years Ago", "500 BCE", "2045 CE", "10^14 Years from Now").
2. THE HUD SHALL display the current Scale Level name (Overview / Era / Period / Decade / Year).
3. THE HUD SHALL remain fixed in screen space at all times, regardless of Timeline pan or zoom transforms.
4. THE HUD SHALL include a "Reset View" button that, when activated, animates the Timeline back to the present-day anchor (t = 0) at Era scale using a GSAP tween of 800ms duration.
5. THE HUD SHALL include a compact row legend showing each row's colour swatch and label.
6. WHEN the viewport width is less than 600px, THE HUD SHALL collapse to show only the time indicator and the India toggle button, hiding the row legend.
7. THE HUD SHALL include a "List View" toggle button that switches between the ZUI and a linear accessible list view.

---

### Requirement 12: Mobile and Touch Support

**User Story:** As a visitor on a smartphone or tablet, I want the timeline to be fully navigable by touch, so that I can explore it without a mouse or keyboard.

#### Acceptance Criteria

1. THE Navigator SHALL recognise single-finger drag as a horizontal pan gesture.
2. THE Navigator SHALL recognise two-finger pinch as a zoom gesture centred on the pinch midpoint.
3. THE Navigator SHALL recognise two-finger drag as a pan gesture (to avoid conflict with browser scroll).
4. WHEN a touch event begins on the Timeline container, THE Navigator SHALL call `event.preventDefault()` to suppress native browser scroll interference.
5. THE Hit_Tester SHALL use a touch target radius of at least 24 logical pixels (per WCAG 2.5.5) when evaluating tap events on touch devices.
6. THE HUD controls SHALL have a minimum tap target size of 44×44 logical pixels on touch devices.
7. WHEN the device orientation changes, THE Renderer SHALL recompute the viewport dimensions and redraw the Timeline within one animation frame.
8. THE Detail Panel on mobile SHALL slide up from the bottom of the screen as a bottom sheet, occupying no more than 50% of the viewport height.

---

### Requirement 13: Performance and Rendering

**User Story:** As a visitor, I want the timeline to animate at 60 frames per second even with hundreds of events visible, so that navigation feels smooth and responsive.

#### Acceptance Criteria

1. THE Renderer SHALL use GSAP hardware-accelerated CSS transforms (`will-change: transform`) on the Timeline container element.
2. THE Renderer SHALL cull Event Markers and labels that fall outside the current viewport before each render pass.
3. WHEN more than 200 Event Markers are visible simultaneously, THE Renderer SHALL use a canvas layer for marker rendering and a DOM layer only for labels, to maintain 60 FPS on mid-range devices.
4. THE Renderer SHALL lazy-load event data for Scale Levels finer than Era: data for Period, Decade, and Year scales SHALL be loaded on demand when the user first zooms to that level.
5. WHEN the Timeline is idle (no user input for 500ms), THE Renderer SHALL suspend animation frame requests to reduce CPU usage.
6. THE Timeline SHALL reach an interactive state (first meaningful paint + input responsive) within 3 seconds on a 4G mobile connection.
7. THE total uncompressed size of the initial JavaScript bundle SHALL not exceed 500 KB, excluding event data JSON files.

---

### Requirement 14: Accessibility

**User Story:** As a visitor using assistive technology, I want to navigate and read timeline events without relying solely on visual interaction, so that the application is usable regardless of ability.

#### Acceptance Criteria

1. THE Timeline SHALL provide a linear, keyboard-accessible list view of all events as an alternative to the ZUI, toggled by the "List View" button in the HUD.
2. WHEN the List View is active, THE Renderer SHALL render events as a scrollable `<table>` with columns for: Time (from present), Time (from Big Bang), Unit, Scale, Physical & Natural, Evolution & Civilisation, Science & Technology, India, World, and Age.
3. THE Detail Panel SHALL set `aria-live="polite"` so that screen readers announce newly loaded event content without interrupting the user.
4. ALL interactive controls (HUD buttons, Detail Panel close button, event markers in List View) SHALL have descriptive `aria-label` attributes.
5. THE Timeline SHALL maintain a colour contrast ratio of at least 4.5:1 between Event Marker labels and their row background, per WCAG 2.1 AA.
6. THE application SHALL NOT rely solely on colour to convey row assignment — each row SHALL also use a distinct icon shape or pattern.

---

### Requirement 15: Static Deployment on GitHub Pages

**User Story:** As the project maintainer, I want the application to build as a fully static site and deploy to GitHub Pages without a server, so that hosting remains free and maintenance-free.

#### Acceptance Criteria

1. THE SvelteKit application SHALL be configured with `adapter-static` to produce a fully pre-rendered static output in the `build/` directory.
2. THE build output SHALL include a `404.html` that redirects to `index.html` to support client-side routing on GitHub Pages.
3. WHEN the GitHub Actions workflow runs on a push to the `main` branch, THE workflow SHALL build the SvelteKit application and deploy the `build/` directory to the `gh-pages` branch.
4. THE application SHALL function correctly when served from a non-root path (e.g., `https://chronooflife.github.io/chrono/`) by reading the base path from the SvelteKit `base` config.
5. THE build process SHALL complete without errors when run with `npm run build` in a Node.js 20 LTS environment.
6. THE total uncompressed size of the initial JavaScript bundle SHALL not exceed 500 KB, excluding event data JSON files.
