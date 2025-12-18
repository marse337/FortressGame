// src/courtyard.js
import { key } from "./utils.js";

export function rebuildCourtyardSet(state) {
  if (!state) return;
  if (!state.courtyardSet) state.courtyardSet = new Set();
  state.courtyardSet.clear();

  const regions = state.courtyardRegions || [];
  for (const r of regions) {
    const tiles = r?.tiles || [];
    for (const t of tiles) state.courtyardSet.add(key(t.x, t.y));
  }
}
