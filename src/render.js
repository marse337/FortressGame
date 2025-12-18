// src/render.js
import { CONFIG } from "./config.js";
import { PAL } from "./palette.js";
import { RNG, drawDitheredRect, drawPixelRect, insideEllipse } from "./utils.js";

function torchHash(tx, ty, seed) {
  // deterministic per-tile “spark” chance (no flicker)
  let h = (tx * 73856093) ^ (ty * 19349663) ^ (seed | 0);
  h >>>= 0;
  return h;
}

function renderOcean(ctx, t, ui, rng) {
  drawDitheredRect(ctx, 0, 0, CONFIG.INTERNAL_W, CONFIG.INTERNAL_H, PAL.ocean1, PAL.ocean0, 2);

  for (let y = 0; y < CONFIG.INTERNAL_H; y += 8) {
    const band = (y / 8) % 2 === 0 ? PAL.ocean2 : PAL.ocean1;
    ctx.globalAlpha = 0.12;
    drawPixelRect(ctx, 0, y, CONFIG.INTERNAL_W, 4, band);
    ctx.globalAlpha = 1;
  }

  if (ui.waves) {
    ctx.globalAlpha = 0.28;
    const waveCount = 260;
    for (let i = 0; i < waveCount; i++) {
      const x = (rng.next() * CONFIG.INTERNAL_W) | 0;
      const y = (rng.next() * CONFIG.INTERNAL_H) | 0;
      const w = ((rng.next() * 3) | 0) + 1;
      const phase = Math.sin((t * 0.002) + x * 0.06 + y * 0.04);
      if (phase > 0.65) drawPixelRect(ctx, x, y, w, 1, PAL.foam2);
    }
    ctx.globalAlpha = 1;
  }
}

function renderIsland(ctx, t, ui, state) {
  const { cx, cy, rx, ry } = state;

  for (let y = 0; y < CONFIG.INTERNAL_H; y += 2) {
    for (let x = 0; x < CONFIG.INTERNAL_W; x += 2) {
      if (!insideEllipse(x, y, cx, cy, rx, ry)) continue;
      const n = Math.sin(x * 0.09) + Math.cos(y * 0.07) + Math.sin((x + y) * 0.03);
      const c = (n > 1.1) ? PAL.grass1 : (n < 0.2 ? PAL.grass2 : PAL.grass0);
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  const beachOuterRx = rx * 1.05;
  const beachOuterRy = ry * 1.06;
  const beachInnerRx = rx * 0.96;
  const beachInnerRy = ry * 0.96;

  for (let y = 0; y < CONFIG.INTERNAL_H; y += 2) {
    for (let x = 0; x < CONFIG.INTERNAL_W; x += 2) {
      const inOuter = insideEllipse(x, y, cx, cy, beachOuterRx, beachOuterRy);
      const inInner = insideEllipse(x, y, cx, cy, beachInnerRx, beachInnerRy);
      if (inOuter && !inInner) {
        const c = (((x + y) >> 2) % 2 === 0) ? PAL.beach0 : PAL.beach1;
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  const foamOuterRx = rx * 1.16;
  const foamOuterRy = ry * 1.18;
  const foamInnerRx = rx * 1.06;
  const foamInnerRy = ry * 1.07;

  for (let y = 0; y < CONFIG.INTERNAL_H; y += 2) {
    for (let x = 0; x < CONFIG.INTERNAL_W; x += 2) {
      const inOuter = insideEllipse(x, y, cx, cy, foamOuterRx, foamOuterRy);
      const inInner = insideEllipse(x, y, cx, cy, foamInnerRx, foamInnerRy);
      if (inOuter && !inInner) {
        const wv = ui.waves ? Math.sin(t * 0.004 + x * 0.12 + y * 0.08) : 0.8;
        const c = (wv > 0.4) ? PAL.foam1 : PAL.foam2;
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }
}

function renderBorder(ctx) {
  drawPixelRect(ctx, 0, 0, CONFIG.INTERNAL_W, 10, "#4b5563");
  drawPixelRect(ctx, 0, CONFIG.INTERNAL_H - 10, CONFIG.INTERNAL_W, 10, "#4b5563");
  drawPixelRect(ctx, 0, 0, 10, CONFIG.INTERNAL_H, "#4b5563");
  drawPixelRect(ctx, CONFIG.INTERNAL_W - 10, 0, 10, CONFIG.INTERNAL_H, "#4b5563");

  ctx.globalAlpha = 0.25;
  drawPixelRect(ctx, 10, 10, CONFIG.INTERNAL_W - 20, 2, "#fff");
drawPixelRect(ctx, 10, 10, 2, CONFIG.INTERNAL_H - 20, "#fff");
  ctx.globalAlpha = 1;
}

/**
 * Irregular courtyards (from flood-fill):
 * state.courtyardRegions = [{ tiles:[{x,y},...], bounds:{...} }, ...]
 */
function renderCourtyards(ctx, state) {
  const regions = state.courtyardRegions || [];
  if (!regions.length) return;

  for (const r of regions) {
    // 1) Dark floor tiles
    for (const t of r.tiles) {
      const px = t.x * CONFIG.TILE;
      const py = t.y * CONFIG.TILE;
      drawDitheredRect(ctx, px, py, CONFIG.TILE, CONFIG.TILE, "#0a1630", "#081126", 2);
    }

    // 2) Blue grid lines per tile (only where interior exists)
    ctx.globalAlpha = 0.65;
    for (const t of r.tiles) {
      const px = t.x * CONFIG.TILE;
      const py = t.y * CONFIG.TILE;

      drawPixelRect(ctx, px, py, CONFIG.TILE, 1, "rgba(72, 139, 255, .35)");
      drawPixelRect(ctx, px, py, 1, CONFIG.TILE, "rgba(72, 139, 255, .35)");

      drawPixelRect(ctx, px, py + CONFIG.TILE - 1, CONFIG.TILE, 1, "rgba(72, 139, 255, .18)");
      drawPixelRect(ctx, px + CONFIG.TILE - 1, py, 1, CONFIG.TILE, "rgba(72, 139, 255, .18)");
    }
    ctx.globalAlpha = 1;
  }
}

function renderWalls(ctx, state) {
  for (const k of state.wallTiles) {
    const [tx, ty] = k.split(",").map(Number);
    const x = tx * CONFIG.TILE;
    const y = ty * CONFIG.TILE;

    drawPixelRect(ctx, x, y, CONFIG.TILE, CONFIG.TILE, PAL.wall1);
    drawPixelRect(ctx, x, y + 5, CONFIG.TILE, 3, PAL.wall0);
    drawPixelRect(ctx, x + 1, y + 1, 3, 2, PAL.wall3);
    drawPixelRect(ctx, x + 1, y + 3, 2, 1, PAL.wall2);

    if ((torchHash(tx, ty, state.renderSeed) % 100) < 7) {
      drawPixelRect(ctx, x + 6, y + 2, 1, 2, "#fbbf24");
      drawPixelRect(ctx, x + 6, y + 1, 1, 1, "#fde68a");
    }
  }
}

function renderBoats(ctx, t, ui, state) {
  for (const b of state.boats) {
    const bob = ui.waves ? Math.sin(t * 0.006 + b.bob) * 1.5 : 0;
    const x = b.x;
    const y = b.y + bob;

    const dx = Math.cos(b.dir), dy = Math.sin(b.dir);
    const absx = Math.abs(dx), absy = Math.abs(dy);
    const orient = absx > absy ? (dx > 0 ? "E" : "W") : (dy > 0 ? "S" : "N");

    ctx.save();
    ctx.translate(x | 0, y | 0);

    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#000";
    ctx.fillRect(-10, 8, 20, 3);
    ctx.globalAlpha = 1;

    const hull = () => {
      drawPixelRect(ctx, -10, 2, 20, 6, PAL.boat1);
      drawPixelRect(ctx, -8, 1, 16, 1, PAL.boat2);
      drawPixelRect(ctx, -9, 7, 18, 1, PAL.boat0);
      drawPixelRect(ctx, 10, 3, 2, 4, PAL.boat0);
    };

    const sail = () => {
      drawPixelRect(ctx, -2, -10, 2, 12, "#374151");
      drawPixelRect(ctx, 0, -9, 10, 8, PAL.sail0);
      drawPixelRect(ctx, 0, -9, 10, 1, "#e2e8f0");
      drawPixelRect(ctx, 8, -8, 2, 6, "#e2e8f0");
    };

    if (orient === "E") { hull(); sail(); }
    if (orient === "W") { ctx.scale(-1, 1); hull(); sail(); }
    if (orient === "N") { ctx.rotate(-Math.PI / 2); hull(); sail(); }
    if (orient === "S") { ctx.rotate(Math.PI / 2); hull(); sail(); }

    ctx.restore();
  }
}

function renderTurrets(ctx, state) {
  for (const t of (state.turrets || [])) {
    const x = t.x * CONFIG.TILE;
    const y = t.y * CONFIG.TILE;

    const w = (t.dir === 0) ? (CONFIG.TILE * 2) : CONFIG.TILE;
    const h = (t.dir === 0) ? CONFIG.TILE : (CONFIG.TILE * 2);

    const life = (t.life ?? 3);

    // life: 3=green, 2=orange, 1=red
    const topColor =
      life >= 3 ? "#22c55e" :
      life === 2 ? "#f59e0b" :
      "#ef4444";

    drawPixelRect(ctx, x, y, w, h, "#374151");
    drawPixelRect(ctx, x, y + h - 2, w, 2, "#111827");

    drawPixelRect(ctx, x + 2, y + 2, Math.max(1, w - 4), Math.max(1, h - 4), topColor);

    if (t.dir === 0) drawPixelRect(ctx, x + w - 3, y + 3, 3, 2, "#e5e7eb");
    else drawPixelRect(ctx, x + 3, y, 2, 3, "#e5e7eb");
  }
}

// Tetromino ghost hover (state.hover.cells)
function renderHover(ctx, state) {
  const h = state.hover;
  if (!h || h.x < 0 || h.y < 0) return;

  const cells = h.cells || [];
  if (!cells.length) return;

  // Only show the wall-piece ghost in BUILD (turret ghost can stay as-is if you want)
  // If you want both, remove this phase check.
  if (state.phase !== "BUILD" && state.phase !== "TURRET") return;

  // Strong contrast colors
  const ok = !!h.valid;
  const outline = ok ? "#e5e7eb" : "#ff4d4d";  // bright white vs strong red
  const fillA    = ok ? "rgba(15, 23, 42, 0.55)" : "rgba(127, 29, 29, 0.55)"; // dark navy / dark red
  const fillB    = ok ? "rgba(59, 130, 246, 0.25)" : "rgba(248, 113, 113, 0.25)"; // blue / red tint

  for (const c of cells) {
    const px = c.x * CONFIG.TILE;
    const py = c.y * CONFIG.TILE;

    // 1) dark fill (covers grass clearly)
    ctx.globalAlpha = 1;
    ctx.fillStyle = fillA;
    ctx.fillRect(px, py, CONFIG.TILE, CONFIG.TILE);

    // 2) subtle checker (16-bit vibe + readability)
    ctx.fillStyle = fillB;
    ctx.fillRect(px, py, CONFIG.TILE, 1);
    ctx.fillRect(px, py, 1, CONFIG.TILE);
    ctx.fillRect(px + CONFIG.TILE - 1, py, 1, CONFIG.TILE);
    ctx.fillRect(px, py + CONFIG.TILE - 1, CONFIG.TILE, 1);

    // 3) bright outline (most important part)
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, CONFIG.TILE - 2, CONFIG.TILE - 2);
  }
}


function renderGridOverlay(ctx) {
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = PAL.grid;
  ctx.lineWidth = 1;

  for (let x = 0; x <= CONFIG.INTERNAL_W; x += CONFIG.TILE) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, CONFIG.INTERNAL_H);
    ctx.stroke();
  }

  for (let y = 0; y <= CONFIG.INTERNAL_H; y += CONFIG.TILE) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(CONFIG.INTERNAL_W, y + 0.5);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

function renderBanner(ctx, state) {
  if (!state.bannerActive) return;

  const h = 28;
  const y = (state.bannerY | 0);

  ctx.globalAlpha = 0.92;
  drawPixelRect(ctx, 0, y, CONFIG.INTERNAL_W, h, "#111827");
  ctx.globalAlpha = 1;

  drawPixelRect(ctx, 0, y, CONFIG.INTERNAL_W, 1, "#e5e7eb");
  drawPixelRect(ctx, 0, y + h - 1, CONFIG.INTERNAL_W, 1, "#e5e7eb");

  ctx.globalAlpha = 0.25;
  drawPixelRect(ctx, 0, y + 4, CONFIG.INTERNAL_W, 1, "#60a5fa");
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillText(state.bannerText || "", (CONFIG.INTERNAL_W / 2) + 1, y + (h / 2) + 1);

  ctx.fillStyle = "#fbbf24";
  ctx.fillText(state.bannerText || "", (CONFIG.INTERNAL_W / 2), y + (h / 2));
  ctx.restore();
}

function renderProjectiles(ctx, state) {
  const ps = state.projectiles || [];
  for (const p of ps) {
    const x = (p.x | 0);
    const y = (p.y | 0);
    const c = (p.type === "enemy") ? "#fb7185" : "#fbbf24";
    drawPixelRect(ctx, x - 1, y - 1, 3, 3, c);
  }
}

function renderAimCursor(ctx, state) {
  if (state.phase !== "COMBAT") return;

  const x = state.aimX | 0;
  const y = state.aimY | 0;

  drawPixelRect(ctx, x - 6, y, 13, 1, "#e5e7eb");
  drawPixelRect(ctx, x, y - 6, 1, 13, "#e5e7eb");
  drawPixelRect(ctx, x - 1, y - 1, 3, 3, "#fbbf24");
}

export function renderFrame({ ctx, buf, vctx, view, state, ui }, t) {
  const rng = new RNG(state.renderSeed);

  ctx.clearRect(0, 0, CONFIG.INTERNAL_W, CONFIG.INTERNAL_H);

  renderOcean(ctx, t, ui, rng);
  renderIsland(ctx, t, ui, state);

  renderCourtyards(ctx, state);
  renderWalls(ctx, state);
  renderTurrets(ctx, state);

  renderBoats(ctx, t, ui, state);
  renderProjectiles(ctx, state);
  renderAimCursor(ctx, state);

  if (ui.grid) renderGridOverlay(ctx);

  renderBorder(ctx);
  renderHover(ctx, state);

  // Banner on top of everything
  renderBanner(ctx, state);

  // Upscale to view
  vctx.imageSmoothingEnabled = false;
  const vw = view.width, vh = view.height;

  const scale = Math.floor(Math.min(vw / CONFIG.INTERNAL_W, vh / CONFIG.INTERNAL_H));
  const dw = CONFIG.INTERNAL_W * scale;
  const dh = CONFIG.INTERNAL_H * scale;
  const ox = ((vw - dw) / 2) | 0;
  const oy = ((vh - dh) / 2) | 0;

  vctx.clearRect(0, 0, vw, vh);
  vctx.drawImage(buf, 0, 0, CONFIG.INTERNAL_W, CONFIG.INTERNAL_H, ox, oy, dw, dh);

  if (ui.scanlines) {
    vctx.globalAlpha = 0.18;
    for (let y = oy; y < oy + dh; y += 3) vctx.fillRect(ox, y, dw, 1);
    vctx.globalAlpha = 1;
  }

  return { scale, ox, oy };
}
