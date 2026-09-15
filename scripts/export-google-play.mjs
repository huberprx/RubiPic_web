#!/usr/bin/env node
/**
 * Export Google Play listing graphics from googleplay.html (English).
 *
 * Phone cards are captured exactly as the page styles them: headline, cubes,
 * and the CSS phone-frame (bezel, rounded screen, home indicator). Google Play
 * cards intentionally have no Dynamic Island (see .gp-grid .phone-frame::before).
 * Export CSS only sizes the artboard to 1080×1920 / 1024×500 — it does not
 * strip frames, screenshots, or decorations.
 *
 * Usage: node scripts/export-google-play.mjs
 */

import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile, copyFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT_DIR = join(ROOT, "exports", "google-play", "en-US");
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

function buildPreviewHtml() {
  const items = [
    { file: "feature-graphic-en.png", label: "Feature graphic", w: 1024, h: 500, feature: true },
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
<title>RubiPic — Google Play EN export preview</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 24px;
    font-family: system-ui, sans-serif;
    background: #1a1a1a;
    color: #f5f5f5;
  }
  h1 { font-size: 1.25rem; margin: 0 0 8px; }
  p.lead { margin: 0 0 24px; color: #bbb; max-width: 70ch; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
  }
  figure {
    margin: 0;
    background: #2a2a2a;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #444;
  }
  figure.feature { grid-column: 1 / -1; max-width: 1024px; }
  figure img {
    display: block;
    width: 100%;
    height: auto;
    background: #111;
  }
  figcaption {
    padding: 12px 14px;
    font-size: 0.82rem;
    line-height: 1.45;
    color: #ccc;
  }
  figcaption strong { color: #fff; word-break: break-all; }
</style>
</head>
<body>
  <h1>RubiPic — Google Play listing (English preview)</h1>
  <p class="lead">Review export for Hubert. Not uploaded to Play Console. Generated from <code>googleplay.html</code> + <code>translations.js</code> (EN).</p>
  <div class="grid">${figures}
  </div>
</body>
</html>`;
}

async function copyToArtifacts() {
  try {
    await mkdir(ARTIFACTS_DIR, { recursive: true });
    const names = ["feature-graphic-en.png", ...PHONE_FILES, "preview.html", "preview-contact-sheet.png"];
    for (const name of names) {
      await copyFile(join(OUT_DIR, name), join(ARTIFACTS_DIR, name));
    }
    console.log(`Copied exports to ${ARTIFACTS_DIR}`);
  } catch (err) {
    console.warn("Artifacts copy skipped:", err.message);
  }
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
  await page.waitForTimeout(200);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const { server, baseUrl } = await startStaticServer(ROOT);

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

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
    await page.locator('.lang-toggle button[data-lang="en"]').click();
    await page.waitForFunction(() => document.documentElement.lang === "en");
    await waitForAssets(page);
    await page.addStyleTag({ content: EXPORT_CSS });
    await page.evaluate(() => document.body.classList.add("gp-export-mode"));

    const cards = page.locator(".gp-grid .asc-card");
    const count = await cards.count();
    if (count !== 7) {
      throw new Error(`Expected 7 phone cards, found ${count}`);
    }

    for (let i = 0; i < 7; i += 1) {
      await setActiveExport(page, ".gp-grid .asc-card", i);
      const outPath = join(OUT_DIR, PHONE_FILES[i]);
      await cards.nth(i).screenshot({ path: outPath, type: "png" });
      console.log("Wrote", outPath);
    }

    await page.evaluate(() => {
      document.body.classList.remove("gp-export-mode");
      document
        .querySelectorAll(".asc-card, .gp-feature--empty")
        .forEach((el) => el.classList.remove("gp-export-active"));
    });
    await page.addStyleTag({
      content: `
        header, footer, .section-head, .asc-dims, .gp-feature-block > .section-head,
        .gp-layer-picker, .gp-feature-block > .asc-dims, .deco-cube, .asc-grid { display: none !important; }
        .gp-feature--empty { border-radius: 0 !important; margin: 0 auto !important; }
        .gp-empty-layer:hover, .gp-empty-layer:focus, .gp-empty-layer:focus-visible { outline: none !important; }
      `,
    });

    await page.setViewportSize({ width: 1200, height: 3200 });
    const feature = page.locator(".gp-feature--empty");
    await feature.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const featureBox = await feature.boundingBox();
    if (!featureBox) {
      throw new Error("Feature graphic bounding box not found");
    }
    const featurePath = join(OUT_DIR, "feature-graphic-en.png");
    await page.screenshot({
      path: featurePath,
      clip: {
        x: featureBox.x,
        y: featureBox.y,
        width: featureBox.width,
        height: featureBox.height,
      },
    });
    console.log("Wrote", featurePath);

    const previewPath = join(OUT_DIR, "preview.html");
    await writeFile(previewPath, buildPreviewHtml(), "utf8");
    console.log("Wrote", previewPath);

    const previewPage = await context.newPage();
    await previewPage.setViewportSize({ width: 1600, height: 2800 });
    await previewPage.goto(`file://${previewPath}`, { waitUntil: "networkidle" });
    await previewPage.waitForTimeout(300);
    const sheetPath = join(OUT_DIR, "preview-contact-sheet.png");
    await previewPage.screenshot({ path: sheetPath, fullPage: true });
    console.log("Wrote", sheetPath);
    await previewPage.close();

    await copyToArtifacts();
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
