

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/fallbacks/layout.svelte.js')).default;
export const universal = {
  "prerender": true,
  "ssr": false
};
export const universal_id = "src/routes/+layout.ts";
export const imports = ["_app/immutable/nodes/0.BKKhAYep.js","_app/immutable/chunks/DgNOrIrA.js","_app/immutable/chunks/CJqeGh0u.js","_app/immutable/chunks/Ou6zobTZ.js"];
export const stylesheets = [];
export const fonts = [];
