import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// NEON HEIST — Shadow Protocol
// Heist game: thief navigates maze past guards (vision cones), cameras, to steal the loot.
// Serves the game via HTTP so the judge can open it in a desktop browser.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? path.join(__dirname, "out");
fs.mkdirSync(outputDir, { recursive: true });

// Copy game files to output
function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

copyDir(path.join(__dirname, "game"), path.join(outputDir, "game"));
copyDir(path.join(__dirname, "screenshots"), path.join(outputDir, "screenshots"));

// Write run instructions
fs.writeFileSync(path.join(outputDir, "README.txt"),
  "Open game/index.html in a desktop browser (Chrome/Edge/Firefox).\n" +
  "Controls: WASD or Arrow keys. Reach the diamond without being detected.\n"
);

console.log(`NEON HEIST ready at: ${outputDir}/game/index.html`);
console.log("Open in Chrome to play.");
