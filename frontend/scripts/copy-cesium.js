/**
 * Copy Cesium static assets (Workers, Assets, Widgets, ThirdParty) from
 * node_modules/cesium/Build/Cesium/ to public/cesium/ so they can be served
 * as static files by Next.js.
 */

const fs = require("fs");
const path = require("path");

const CESIUM_SOURCE = path.resolve(
  __dirname,
  "..",
  "node_modules",
  "cesium",
  "Build",
  "Cesium"
);
const CESIUM_DEST = path.resolve(__dirname, "..", "public", "cesium");

const DIRS_TO_COPY = ["Workers", "Assets", "Widgets", "ThirdParty"];

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (!fs.existsSync(CESIUM_SOURCE)) {
  console.log("[copy-cesium] Cesium not found in node_modules, skipping.");
  process.exit(0);
}

// Only copy if destination doesn't exist or is outdated
const markerFile = path.join(CESIUM_DEST, ".copied");
const cesiumPkg = path.join(CESIUM_SOURCE, "..", "package.json");
const currentVersion = fs.existsSync(cesiumPkg)
  ? JSON.parse(fs.readFileSync(cesiumPkg, "utf8")).version
  : "unknown";

if (fs.existsSync(markerFile)) {
  const existingVersion = fs.readFileSync(markerFile, "utf8").trim();
  if (existingVersion === currentVersion) {
    console.log(
      `[copy-cesium] Cesium ${currentVersion} assets already in public/cesium/, skipping.`
    );
    process.exit(0);
  }
}

console.log(`[copy-cesium] Copying Cesium ${currentVersion} assets to public/cesium/...`);

for (const dir of DIRS_TO_COPY) {
  const src = path.join(CESIUM_SOURCE, dir);
  const dest = path.join(CESIUM_DEST, dir);
  if (fs.existsSync(src)) {
    copyDirSync(src, dest);
    console.log(`[copy-cesium]   ${dir}/`);
  }
}

fs.writeFileSync(markerFile, currentVersion);
console.log("[copy-cesium] Done.");
