

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_page.svelte.js')).default;
export const universal = {
  "prerender": true,
  "ssr": false,
  "load": null
};
export const universal_id = "src/routes/+page.ts";
export const imports = ["_app/immutable/nodes/2.Cd1CswS7.js","_app/immutable/chunks/B5aKb2HV.js","_app/immutable/chunks/CJqeGh0u.js","_app/immutable/chunks/Ou6zobTZ.js","_app/immutable/chunks/DgNOrIrA.js","_app/immutable/chunks/puCCJj8O.js","_app/immutable/chunks/BI8Cu2cz.js"];
export const stylesheets = ["_app/immutable/assets/2.D19UJrAD.css"];
export const fonts = [];
