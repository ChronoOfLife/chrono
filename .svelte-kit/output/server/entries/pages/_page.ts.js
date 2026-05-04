const VALID_ROW_KEYS = /* @__PURE__ */ new Set([
  "physical",
  "evolution",
  "science",
  "india",
  "world_asia",
  "world_europe",
  "world_america"
]);
function loadEvents(raw) {
  const events = [];
  const warnings = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    if (typeof entry !== "object" || entry === null) {
      const msg = `Entry ${i}: not an object — skipped`;
      warnings.push(msg);
      console.warn(msg);
      continue;
    }
    const obj = entry;
    if (typeof obj.time !== "number" || !isFinite(obj.time)) {
      const msg = `Entry ${i} ("${obj.title ?? "unknown"}"): missing or invalid 'time' — skipped`;
      warnings.push(msg);
      console.warn(msg);
      continue;
    }
    if (typeof obj.title !== "string" || obj.title.trim() === "") {
      const msg = `Entry ${i}: missing or empty 'title' — skipped`;
      warnings.push(msg);
      console.warn(msg);
      continue;
    }
    let row = "physical";
    if (typeof obj.row === "string" && VALID_ROW_KEYS.has(obj.row)) {
      row = obj.row;
    } else if (obj.row !== void 0) {
      const msg = `Entry ${i} ("${obj.title}"): unknown row '${obj.row}' — defaulting to 'physical'`;
      warnings.push(msg);
      console.warn(msg);
    }
    const event = {
      time: obj.time,
      title: obj.title.trim(),
      row
    };
    const optionalStrings = [
      "india",
      "world",
      "link",
      "scale",
      "unit",
      "age",
      "fromCurrentEra",
      "fromBigBang"
    ];
    for (const key of optionalStrings) {
      if (typeof obj[key] === "string" && obj[key].trim() !== "") {
        event[key] = obj[key].trim();
      }
    }
    events.push(event);
  }
  return { events, warnings };
}
const load = async () => {
  const eventsRaw = await import("../../chunks/events.js");
  const { events, warnings } = loadEvents(eventsRaw.default);
  if (warnings.length > 0) {
    console.warn(`[chrono] ${warnings.length} data warnings during load`);
  }
  return { events };
};
export {
  load
};
