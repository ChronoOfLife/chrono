import { a0 as ssr_context, a1 as attr_class, e as escape_html, a2 as attr, a3 as ensure_array_like, a4 as attr_style, a5 as stringify, a6 as bind_props, a7 as fallback } from "../../chunks/renderer.js";
import "clsx";
import { gsap } from "gsap";
import { Observer } from "gsap/Observer";
function onDestroy(fn) {
  /** @type {SSRContext} */
  ssr_context.r.on_destroy(fn);
}
const K = 120;
function tx(t) {
  return Math.sign(t) * Math.log10(Math.abs(t) + 1) * K;
}
function txInverse(px) {
  const sign = Math.sign(px);
  return sign * (Math.pow(10, Math.abs(px) / K) - 1);
}
function screenX(t, viewState, viewportWidth) {
  return viewportWidth / 2 + viewState.panX + tx(t) * viewState.zoomScale;
}
function formatTime(t) {
  const abs = Math.abs(t);
  const suffix = t < 0 ? " Ago" : t > 0 ? " From Now" : "";
  if (t === 0) return "Present Day";
  if (abs >= 1e9) {
    const val = (abs / 1e9).toPrecision(3);
    return `${val} Billion Years${suffix}`;
  }
  if (abs >= 1e6) {
    const val = (abs / 1e6).toPrecision(3);
    return `${val} Million Years${suffix}`;
  }
  if (abs >= 1e3) {
    const val = Math.round(abs / 1e3);
    return `${val},000 Years${suffix}`;
  }
  if (abs >= 1) {
    const year = Math.round(Math.abs(t));
    if (t < 0) return `${year} BCE`;
    return `${year} CE`;
  }
  return `${t.toExponential(2)} Years${suffix}`;
}
const ROW_DEFINITIONS = [
  // ── Time Header: From Current Era (rows 4–6) ──────────────────────────────
  {
    key: "header_era_power",
    label: "From Current Era",
    subLabel: "Power of 10",
    background: "#c8e6c9",
    textColor: "#1b5e20",
    isHeader: true,
    isContent: false
  },
  {
    key: "header_era_multiplier",
    label: "",
    subLabel: "Multiplier",
    background: "#c8e6c9",
    textColor: "#1b5e20",
    isHeader: true,
    isContent: false
  },
  {
    key: "header_era_actual",
    label: "",
    subLabel: "Actual value",
    background: "#a5d6a7",
    textColor: "#1b5e20",
    isHeader: true,
    isContent: false
  },
  // ── Time Header: From Big Bang (rows 7–9) ─────────────────────────────────
  {
    key: "header_bb_power",
    label: "From Big Bang",
    subLabel: "Power of 10",
    background: "#fff9c4",
    textColor: "#f57f17",
    isHeader: true,
    isContent: false
  },
  {
    key: "header_bb_multiplier",
    label: "",
    subLabel: "Multiplier",
    background: "#fff9c4",
    textColor: "#f57f17",
    isHeader: true,
    isContent: false
  },
  {
    key: "header_bb_actual",
    label: "",
    subLabel: "Actual value",
    background: "#fff176",
    textColor: "#f57f17",
    isHeader: true,
    isContent: false
  },
  // ── Row 10: Unit ──────────────────────────────────────────────────────────
  {
    key: "unit",
    label: "Unit",
    background: "#f5f5f5",
    textColor: "#424242",
    isHeader: true,
    isContent: false
  },
  // ── Row 11: Scale ─────────────────────────────────────────────────────────
  {
    key: "scale_row",
    label: "Scale",
    background: "#eeeeee",
    textColor: "#424242",
    isHeader: true,
    isContent: false
  },
  // ── Row 12: Physical & Natural Transformations ────────────────────────────
  {
    key: "physical",
    label: "Physical and natural\ntransformations",
    background: "#e8f5e9",
    textColor: "#1b5e20",
    isHeader: false,
    isContent: true,
    contentRowKey: "physical"
  },
  // ── Row 13: Evolution of Human & Civilisation ─────────────────────────────
  {
    key: "evolution",
    label: "Evolution of Human\n& civilisation",
    background: "#fffde7",
    textColor: "#5d4037",
    isHeader: false,
    isContent: true,
    contentRowKey: "evolution"
  },
  // ── Row 14: Science, Technology & Innovations ─────────────────────────────
  {
    key: "science",
    label: "Science,\nTechnology and\nInnovations",
    background: "#e3f2fd",
    textColor: "#0d47a1",
    isHeader: false,
    isContent: true,
    contentRowKey: "science"
  },
  // ── Row 15: India ─────────────────────────────────────────────────────────
  {
    key: "india",
    label: "India",
    background: "#1a3a6b",
    textColor: "#ffffff",
    accentColor: "#FF9933",
    isHeader: false,
    isContent: true,
    contentRowKey: "india"
  },
  // ── Row 16: World / Asia ──────────────────────────────────────────────────
  {
    key: "world_asia",
    label: "World",
    subLabel: "Asia",
    background: "#0d2b5e",
    textColor: "#ffffff",
    isHeader: false,
    isContent: true,
    contentRowKey: "world_asia"
  },
  // ── Row 17: World / Europe ────────────────────────────────────────────────
  {
    key: "world_europe",
    label: "",
    subLabel: "Europe",
    background: "#0d2b5e",
    textColor: "#ffffff",
    isHeader: false,
    isContent: true,
    contentRowKey: "world_europe"
  },
  // ── Row 18: World / America ───────────────────────────────────────────────
  {
    key: "world_america",
    label: "",
    subLabel: "America",
    background: "#0d2b5e",
    textColor: "#ffffff",
    isHeader: false,
    isContent: true,
    contentRowKey: "world_america"
  },
  // ── Row 21: Age ───────────────────────────────────────────────────────────
  {
    key: "age",
    label: "Age:",
    background: "#f1f8e9",
    textColor: "#33691e",
    isHeader: false,
    isContent: false
  }
];
const TOTAL_ROW_COUNT = ROW_DEFINITIONS.length;
function getLabelColumnWidth(viewportWidth) {
  if (viewportWidth >= 1024) return 180;
  if (viewportWidth >= 600) return 120;
  return 80;
}
function computeRowLayout(viewportWidth, viewportHeight) {
  const labelColumnWidth = getLabelColumnWidth(viewportWidth);
  const rowHeight = Math.floor(viewportHeight / TOTAL_ROW_COUNT);
  const rows = [];
  ROW_DEFINITIONS.forEach((def, i) => {
    const y = i * rowHeight;
    rows.push({
      key: def.key,
      y,
      height: rowHeight,
      centreY: y + rowHeight / 2,
      definition: def
    });
  });
  return {
    rowHeight,
    labelColumnWidth,
    rows,
    totalHeight: TOTAL_ROW_COUNT * rowHeight,
    viewportWidth,
    viewportHeight
  };
}
function getRowEntry(layout, rowKey) {
  return layout.rows.find((r) => r.definition.contentRowKey === rowKey);
}
function getScaleLevel(zoomScale) {
  if (zoomScale < 0.5) return "overview";
  if (zoomScale < 5) return "era";
  if (zoomScale < 50) return "period";
  if (zoomScale < 200) return "decade";
  return "year";
}
function centreTimeFromState(state, viewportWidth) {
  const logPx = -state.panX / state.zoomScale;
  return txInverse(logPx);
}
gsap.registerPlugin(Observer);
function getEllipsoidTransform(viewportHeight, intensity = 0.3) {
  const perspective = Math.round(viewportHeight * (4 + (1 - intensity) * 6));
  return `perspective(${perspective}px) rotateX(${intensity * 3}deg)`;
}
function getCurvatureIntensity(zoomScale) {
  if (zoomScale >= 50) return 0;
  if (zoomScale >= 5) return 0.15;
  return 0.3;
}
function HUD($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let centreT, timeLabel, scaleLevel, legendRows;
    let viewState = $$props["viewState"];
    let viewportWidth = $$props["viewportWidth"];
    let indiaFilterActive = fallback($$props["indiaFilterActive"], false);
    let listViewActive = fallback($$props["listViewActive"], false);
    let isMobile = fallback($$props["isMobile"], false);
    centreT = centreTimeFromState(viewState);
    timeLabel = formatTime(centreT);
    scaleLevel = getScaleLevel(viewState.zoomScale);
    legendRows = ROW_DEFINITIONS.filter((r) => r.isContent);
    $$renderer2.push(`<div${attr_class("hud svelte-1y9k209", void 0, { "mobile": isMobile })} role="toolbar" aria-label="Timeline controls"><div class="hud-time svelte-1y9k209" aria-live="polite" aria-label="Current time position"><span class="time-label svelte-1y9k209">${escape_html(timeLabel)}</span> `);
    if (!isMobile) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="scale-badge svelte-1y9k209">${escape_html(scaleLevel)}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="hud-controls svelte-1y9k209"><button${attr_class("hud-btn svelte-1y9k209", void 0, { "active": indiaFilterActive })} aria-label="Toggle India filter"${attr("aria-pressed", indiaFilterActive)} title="Highlight India events">🇮🇳 India</button> <button class="hud-btn svelte-1y9k209" aria-label="Reset view to present day" title="Reset to present day">⌂ Reset</button> <button${attr_class("hud-btn svelte-1y9k209", void 0, { "active": listViewActive })} aria-label="Toggle list view"${attr("aria-pressed", listViewActive)} title="Switch to list view">☰ List</button></div> `);
    if (!isMobile) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="hud-legend svelte-1y9k209" role="list" aria-label="Row legend"><!--[-->`);
      const each_array = ensure_array_like(legendRows);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let row = each_array[$$index];
        $$renderer2.push(`<div class="legend-item svelte-1y9k209" role="listitem"><span class="legend-swatch svelte-1y9k209"${attr_style(`background:${stringify(row.background)};border:1px solid ${stringify(row.textColor)}33`)} aria-hidden="true"></span> <span class="legend-label svelte-1y9k209"${attr_style(`color:${stringify(row.textColor === "#ffffff" ? "#ccc" : row.textColor)}`)}>${escape_html(row.subLabel ?? row.label.split("\n")[0])}</span></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
    bind_props($$props, {
      viewState,
      viewportWidth,
      indiaFilterActive,
      listViewActive,
      isMobile
    });
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let events, rowLayout, scaleLevel, curvature, ellipsoidTransform, headerRowCount, visibleEvents, showLabels, showAgeLabel;
    let data = $$props["data"];
    let viewState = { panX: 0, zoomScale: 1 };
    let viewportWidth = 0;
    let viewportHeight = 0;
    let isMobile = false;
    let indiaFilterActive = false;
    let listViewActive = false;
    function handleResize() {
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
      isMobile = viewportWidth < 600;
    }
    onDestroy(() => {
      window.removeEventListener("resize", handleResize);
    });
    events = data.events;
    rowLayout = computeRowLayout(viewportWidth, viewportHeight);
    scaleLevel = getScaleLevel(viewState.zoomScale);
    curvature = getCurvatureIntensity(viewState.zoomScale);
    ellipsoidTransform = getEllipsoidTransform(viewportHeight, curvature);
    headerRowCount = ROW_DEFINITIONS.filter((r) => r.isHeader).length;
    rowLayout.rowHeight * headerRowCount;
    visibleEvents = events.filter((e) => {
      const sx = screenX(e.time, viewState, viewportWidth);
      return sx >= -40 && sx <= viewportWidth + 40;
    });
    showLabels = scaleLevel !== "overview";
    showAgeLabel = scaleLevel === "period" || scaleLevel === "decade" || scaleLevel === "year";
    $$renderer2.push(`<div class="timeline-container svelte-1uha8ag"${attr_style(`width:${stringify(viewportWidth)}px;height:${stringify(viewportHeight)}px`)} role="region" aria-label="Chrono of Life interactive timeline"><canvas class="canvas-layer svelte-1uha8ag"${attr("width", viewportWidth)}${attr("height", viewportHeight)} aria-hidden="true"></canvas> <div class="rows-layer svelte-1uha8ag"${attr_style(`transform:${stringify(ellipsoidTransform)};transform-origin:center center;will-change:transform`)}><!--[-->`);
    const each_array = ensure_array_like(rowLayout.rows);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let row = each_array[$$index];
      $$renderer2.push(`<div class="row-band svelte-1uha8ag"${attr_style(` top:${stringify(row.y)}px; height:${stringify(row.height)}px; background:${stringify(row.definition.background)}; color:${stringify(row.definition.textColor)}; left:${stringify(rowLayout.labelColumnWidth)}px; right:0; `)} aria-hidden="true"></div>`);
    }
    $$renderer2.push(`<!--]--> `);
    if (showLabels) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<!--[-->`);
      const each_array_1 = ensure_array_like(visibleEvents);
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let event = each_array_1[$$index_1];
        const sx = screenX(event.time, viewState, viewportWidth);
        const rowEntry = getRowEntry(rowLayout, event.row);
        if (rowEntry && sx > rowLayout.labelColumnWidth && sx < viewportWidth) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div${attr_class("event-label svelte-1uha8ag", void 0, { "dimmed": indiaFilterActive })}${attr_style(` left:${stringify(sx + 8)}px; top:${stringify(rowEntry.centreY - 18)}px; color:${stringify(rowEntry.definition.textColor === "#ffffff" ? "#e8eaf6" : rowEntry.definition.textColor)}; `)} aria-hidden="true"><span class="label-title svelte-1uha8ag">${escape_html(event.title)}</span> `);
          if (showAgeLabel && event.age) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="label-age svelte-1uha8ag">${escape_html(event.age)}</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="label-column svelte-1uha8ag"${attr_style(`width:${stringify(rowLayout.labelColumnWidth)}px`)}><!--[-->`);
    const each_array_2 = ensure_array_like(rowLayout.rows);
    for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
      let row = each_array_2[$$index_2];
      $$renderer2.push(`<div class="label-cell svelte-1uha8ag"${attr_style(` height:${stringify(row.height)}px; background:${stringify(row.definition.background)}; color:${stringify(row.definition.textColor)}; border-right:2px solid rgba(0,0,0,0.2); `)}>`);
      if (row.definition.label) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="label-text svelte-1uha8ag">${escape_html(row.definition.label)}</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (row.definition.subLabel && !row.definition.label) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="label-sub svelte-1uha8ag">${escape_html(row.definition.subLabel)}</span>`);
      } else if (row.definition.subLabel) {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`<span class="label-sub svelte-1uha8ag">${escape_html(row.definition.subLabel)}</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div></div> `);
    HUD($$renderer2, {
      viewState,
      viewportWidth,
      indiaFilterActive,
      listViewActive,
      isMobile
    });
    $$renderer2.push(`<!----> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { data });
  });
}
export {
  _page as default
};
