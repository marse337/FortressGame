export function generateLayout(state, rng) {
  state.wallTiles.clear();
  if (state.courtyardRegions) state.courtyardRegions.length = 0;
  state.boats.length = 0;

  // Boats around the island perimeter (keep or remove if you want)
  const boatCount = 6;
  for (let i = 0; i < boatCount; i++) {
    const angle = (i / boatCount) * Math.PI * 2 + (rng.next() * 0.35);
    const rr = 1.25 + rng.next() * 0.10;
    const bx = state.cx + Math.cos(angle) * state.rx * rr;
    const by = state.cy + Math.sin(angle) * state.ry * rr;

    state.boats.push({
      x: bx,
      y: by,
      dir: angle + Math.PI,
      bob: rng.next() * Math.PI * 2
    });
  }

  state.renderSeed = rng.seed >>> 0;
}
