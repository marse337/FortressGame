// Bundle src/*.js into a single classic-script game.js so the game runs from
// file:// without an HTTP server. Edit files in src/, then run `node build.mjs`.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Topological order: dependencies first. Top-level `const`/`class` from each
// file must be defined before any code that uses them runs.
const ORDER = [
  "config.js",
  "gameConstants.js",
  "palette.js",
  "utils.js",
  "pieces.js",
  "mapper.js",
  "layout.js",
  "state.js",
  "enclosure.js",
  "courtyard.js",
  "wavePrep.js",
  "buildPhase.js",
  "turretPhase.js",
  "combatPhase.js",
  "flow.js",
  "gameLoop.js",
  "render.js",
  "ui.js",
  "input.js",
  "main.js",
];

function strip(src) {
  return src
    // `import { ... } from "./..."` (handles multi-line imports)
    .replace(/^[ \t]*import\s+\{[\s\S]*?\}\s+from\s+["'][^"']+["'];?[ \t]*\n?/gm, "")
    // `import x from "./..."` and `import "./..."` (not used here, but safe)
    .replace(/^[ \t]*import\s+\w+\s+from\s+["'][^"']+["'];?[ \t]*\n?/gm, "")
    .replace(/^[ \t]*import\s+["'][^"']+["'];?[ \t]*\n?/gm, "")
    // Drop the `export` keyword from declarations.
    .replace(/^[ \t]*export\s+(?=function|class|const|let|var|async)/gm, "");
}

const parts = ORDER.map((name) => {
  const path = join(__dirname, "src", name);
  const src = readFileSync(path, "utf8");
  return `// ============ src/${name} ============\n${strip(src).trim()}\n`;
});

const banner =
  `/* Island Fortress - generated bundle.\n` +
  `   Source of truth lives in src/*.js.\n` +
  `   To regenerate after editing source: node build.mjs */\n`;

const out = `${banner}(function () {\n  "use strict";\n\n${parts.join("\n")}\n})();\n`;

writeFileSync(join(__dirname, "game.js"), out);
console.log(`Wrote game.js (${out.length.toLocaleString()} bytes from ${ORDER.length} files).`);
