#!/usr/bin/env node
/**
 * Export Google Play listing graphics from googleplay.html per locale.
 *
 * Phone cards match the page 1:1 (headline, cubes, CSS phone-frame / bezel /
 * home indicator). Dynamic Island stays off because .gp-grid disables it.
 * Feature graphic is the layered board as styled (RubiPic wordmark top-left).
 *
 * Usage:
 *   node scripts/export-google-play.mjs
 *   node scripts/export-google-play.mjs --only=pl-PL,de-DE
 */

import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile, copyFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT_ROOT = join(ROOT, "exports", "google-play");
const ARTIFACTS_DIR = "/opt/cursor/artifacts";

const PHONE_FILES = [
  "01-start-with-any-photo.png",
  "02-adjust-cube-colors.png",
  "03-adjust-image-settings.png",
  "04-download-assembly-instructions.png",
  "05-print-color.png",
  "06-print-bw.png",
  "07-in-your-language.png",
];

const FEATURE_FILE = "feature-graphic.png";

const EXPORT_CSS = `
  header, footer, .section-head, .asc-dims, .gp-feature-block > .section-head,
  .gp-layer-picker, .gp-feature-block > .asc-dims, .deco-cube { display: none !important; }
  body.gp-export-mode { background: #fbf0dc; margin: 0; padding: 0; overflow: hidden; }
  body.gp-export-mode main,
  body.gp-export-mode section,
  body.gp-export-mode .wrap { padding: 0 !important; margin: 0 !important; max-width: none !important; }
  body.gp-export-mode .asc-grid { display: block !important; max-width: none !important; }
  body.gp-export-mode .asc-card {
    display: none;
    position: fixed;
    left: 0;
    top: 0;
    width: 1080px !important;
    height: 1920px !important;
    aspect-ratio: auto !important;
    margin: 0 !important;
    box-shadow: none !important;
    z-index: 9999;
  }
  body.gp-export-mode .asc-card.gp-export-active { display: flex !important; }
  body.gp-export-mode .gp-feature-block { margin: 0 !important; }
  body.gp-export-mode .gp-feature--empty {
    display: none;
    position: fixed;
    left: 0;
    top: 0;
    width: 1024px !important;
    height: 500px !important;
    aspect-ratio: auto !important;
    border-radius: 0 !important;
    margin: 0 !important;
    max-width: none !important;
    z-index: 9999;
  }
  body.gp-export-mode .gp-feature--empty.gp-export-active { display: block !important; }
  .gp-empty-layer:hover,
  .gp-empty-layer:focus,
  .gp-empty-layer:focus-visible { outline: none !important; }
`;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function parseOnlyArg() {
  const arg = process.argv.find((item) => item.startsWith("--only="));
  if (!arg) return null;
  return arg
    .slice("--only=".length)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadHeadlineLocales() {
  const require = createRequire(import.meta.url);
  const src = require("node:fs").readFileSync(join(ROOT, "assets/js/play-headlines.js"), "utf8");
  const sandbox = { window: {} };
  const fn = new Function("window", src + "\nreturn window.RUBIPIC_PLAY_HEADLINES;");
  return fn(sandbox.window);
}

function startStaticServer(root) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const path = join(root, decodeURIComponent((req.url || "/").split("?")[0]));
      const filePath = path.endsWith("/") ? join(path, "index.html") : path;
      try {
        const data = await readFile(filePath);
        const ext = extname(filePath).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        res.end(data);
      } catch {
        res.writeHead(404).end("Not found");
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function waitForAssets(page) {
  await page.waitForFunction(() => document.fonts.ready);
  await page.evaluate(async () => {
    const imgs = Array.from(document.images);
    await Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((resolve, reject) => {
              img.addEventListener("load", resolve, { once: true });
              img.addEventListener("error", reject, { once: true });
            })
      )
    );
  });
}

function buildPreviewHtml(locale, label) {
  const items = [
    { file: FEATURE_FILE, label: "Feature graphic", w: 1024, h: 500, feature: true },
    ...PHONE_FILES.map((file, i) => ({
      file,
      label: `Phone screenshot ${i + 1}`,
      w: 1080,
      h: 1920,
      feature: false,
    })),
  ];

  const figures = items
    .map(
      (item) => `
    <figure${item.feature ? ' class="feature"' : ""}>
      <img src="${item.file}" width="${item.w}" height="${item.h}" alt="${item.label}">
      <figcaption><strong>${item.file}</strong><br>${item.label} · ${item.w}×${item.h} px</figcaption>
    </figure>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RubiPic — Google Play ${locale} preview</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; font-family: system-ui, sans-serif; background: #1a1a1a; color: #f5f5f5; }
  h1 { font-size: 1.25rem; margin: 0 0 8px; }
  p.lead { margin: 0 0 24px; color: #bbb; max-width: 70ch; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
  figure { margin: 0; background: #2a2a2a; border-radius: 12px; overflow: hidden; border: 1px solid #444; }
  figure.feature { grid-column: 1 / -1; max-width: 1024px; }
  figure img { display: block; width: 100%; height: auto; background: #111; }
  figcaption { padding: 12px 14px; font-size: 0.82rem; line-height: 1.45; color: #ccc; }
  figcaption strong { color: #fff; word-break: break-all; }
  a { color: #9cf; }
</style>
</head>
<body>
  <h1>RubiPic — Google Play listing (${label} / ${locale})</h1>
  <p class="lead">Review export for Hubert. Not uploaded to Play Console. Cards match <code>googleplay.html</code> including phone frames. <a href="../index.html">All locales</a></p>
  <div class="grid">${figures}
  </div>
</body>
</html>`;
}

function buildIndexHtml(locales, catalog) {
  const links = locales
    .map((locale) => {
      const label = catalog[locale].label;
      return `<li><a href="${locale}/preview.html"><strong>${locale}</strong> — ${label}</a></li>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>RubiPic — Google Play exports</title>
<style>
  body { font-family: system-ui, sans-serif; background: #1a1a1a; color: #eee; padding: 32px; }
  a { color: #9cf; }
  li { margin: 8px 0; }
</style>
</head>
<body>
  <h1>RubiPic Google Play graphics</h1>
  <p>Localized listing screenshots for review. Not uploaded to Play Console.</p>
  <ul>
${links}
  </ul>
</body>
</html>`;
}

async function setActiveExport(page, selector, index) {
  await page.evaluate(
    ({ cardSelector, activeIndex }) => {
      document
        .querySelectorAll(".asc-card, .gp-feature--empty")
        .forEach((el) => el.classList.remove("gp-export-active"));
      document.querySelectorAll(cardSelector).forEach((el, i) => {
        el.classList.toggle("gp-export-active", i === activeIndex);
      });
    },
    { cardSelector: selector, activeIndex: index }
  );
  await page.waitForTimeout(80);
}

async function applyPlayLocale(page, locale) {
  await page.evaluate((code) => {
    if (typeof window.RUBIPIC_APPLY_LANG !== "function") {
      throw new Error("RUBIPIC_APPLY_LANG is not available");
    }
    window.RUBIPIC_APPLY_LANG(code);
  }, locale);
  await page.waitForFunction(() => document.fonts.ready);
  await page.waitForTimeout(50);
}

async function exportLocalePhones(page, locale, outDir) {
  await applyPlayLocale(page, locale);
  await page.evaluate(() => {
    document.body.classList.add("gp-export-mode");
    document.querySelector(".gp-feature--empty")?.classList.remove("gp-export-active");
  });

  const cards = page.locator(".gp-grid .asc-card");
  const count = await cards.count();
  if (count !== 7) throw new Error(`Expected 7 phone cards, found ${count}`);

  for (let i = 0; i < 7; i += 1) {
    await setActiveExport(page, ".gp-grid .asc-card", i);
    const outPath = join(outDir, PHONE_FILES[i]);
    await cards.nth(i).screenshot({ path: outPath, type: "png" });
  }
}

async function captureFeatureGraphic(page, destPath) {
  await page.evaluate(() => {
    document.body.classList.remove("gp-export-mode");
    document
      .querySelectorAll(".asc-card, .gp-feature--empty")
      .forEach((el) => el.classList.remove("gp-export-active"));
    var board = document.querySelector(".gp-feature--empty");
    if (board) board.style.borderRadius = "0";
  });
  await page.setViewportSize({ width: 1200, height: 3200 });
  const feature = page.locator(".gp-feature--empty");
  await feature.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const box = await feature.boundingBox();
  if (!box) throw new Error("Feature graphic bounding box not found");
  await page.screenshot({
    path: destPath,
    clip: { x: box.x, y: box.y, width: box.width, height: box.height },
  });
}

async function writeContactSheet(context, outDir, locale, label) {
  const previewPath = join(outDir, "preview.html");
  await writeFile(previewPath, buildPreviewHtml(locale, label), "utf8");
  const previewPage = await context.newPage();
  await previewPage.setViewportSize({ width: 1600, height: 2800 });
  await previewPage.goto(pathToFileURL(previewPath).href, { waitUntil: "networkidle" });
  await previewPage.waitForTimeout(200);
  await previewPage.screenshot({ path: join(outDir, "preview-contact-sheet.png"), fullPage: true });
  await previewPage.close();
}

function runTarCopy(srcDir, destDir) {
  return new Promise((resolve, reject) => {
    const tar = spawn("tar", ["-C", srcDir, "-cf", "-", "."]);
    const untar = spawn("tar", ["-C", destDir, "-xf", "-"]);
    tar.stdout.pipe(untar.stdin);
    tar.on("error", reject);
    untar.on("error", reject);
    untar.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`tar exited ${code}`));
    });
  });
}

async function copyToArtifacts(locales) {
  try {
    const dest = join(ARTIFACTS_DIR, "google-play-i18n");
    await mkdir(ARTIFACTS_DIR, { recursive: true });
    await mkdir(dest, { recursive: true });
    await runTarCopy(OUT_ROOT, dest);
    if (locales.includes("en-US")) {
      const enDir = join(OUT_ROOT, "en-US");
      await copyFile(join(enDir, FEATURE_FILE), join(ARTIFACTS_DIR, "feature-graphic-en.png")).catch(() => {});
      for (const name of PHONE_FILES) {
        await copyFile(join(enDir, name), join(ARTIFACTS_DIR, name)).catch(() => {});
      }
    }
    console.log(`Copied exports to ${dest}`);
  } catch (err) {
    console.warn("Artifacts copy skipped:", err.message);
  }
}

async function main() {
  const catalog = loadHeadlineLocales();
  const allLocales = Object.keys(catalog);
  const only = parseOnlyArg();
  const locales = only || allLocales;
  const missing = locales.filter((locale) => !catalog[locale]);
  if (missing.length) {
    throw new Error(`Unknown locale(s): ${missing.join(", ")}`);
  }

  await mkdir(OUT_ROOT, { recursive: true });
  const { server, baseUrl } = await startStaticServer(ROOT);
  const browser = await chromium.launch({ channel: "chrome", headless: true });

  try {
    const context = await browser.newContext({
      deviceScaleFactor: 1,
      viewport: { width: 1200, height: 2000 },
    });
    await context.addInitScript(() => {
      localStorage.setItem("rubipic-lang", "en");
    });

    const page = await context.newPage();
    await page.goto(`${baseUrl}/googleplay.html`, { waitUntil: "networkidle" });
    await waitForAssets(page);
    await page.addStyleTag({ content: EXPORT_CSS });

    const sharedFeature = join(OUT_ROOT, "_feature-graphic.png");
    await captureFeatureGraphic(page, sharedFeature);
    await page.setViewportSize({ width: 1200, height: 2000 });
    await page.addStyleTag({ content: EXPORT_CSS });
    await page.evaluate(() => document.body.classList.add("gp-export-mode"));

    for (const locale of locales) {
      const outDir = join(OUT_ROOT, locale);
      await mkdir(outDir, { recursive: true });
      console.log(`Exporting ${locale} (${catalog[locale].label})…`);
      await exportLocalePhones(page, locale, outDir);
      await copyFile(sharedFeature, join(outDir, FEATURE_FILE));
      if (locale === "en-US") {
        await copyFile(sharedFeature, join(outDir, "feature-graphic-en.png"));
      }
      await writeContactSheet(context, outDir, locale, catalog[locale].label);
      console.log("  wrote", outDir);
    }

    await writeFile(join(OUT_ROOT, "index.html"), buildIndexHtml(locales, catalog), "utf8");
    const localeList = locales
      .map((locale) => `- ${locale} (${catalog[locale].label})`)
      .join("\n");
    await writeFile(
      join(OUT_ROOT, "LOCALES.md"),
      `# Google Play listing exports\n\nNot uploaded to Play Console.\n\nCompleted locales (${locales.length}):\n\n${localeList}\n`,
      "utf8"
    );

    await copyToArtifacts(locales);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
