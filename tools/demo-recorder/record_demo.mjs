// SoloOps demo recorder — drives the real app in headless Chromium and
// saves one .webm clip per scene to ../../recordings/.
//
// Usage:
//   node record_demo.mjs              # all scenes
//   node record_demo.mjs 3 6          # only scenes 3 and 6
//   BASE=http://localhost:5173 node record_demo.mjs
//
// Assumes the demo stack is running:
//   SOLOOPS_DB_PATH=demo.db uvicorn main:app --port 8001   (backend)
//   VITE_API_URL=http://127.0.0.1:8001 vite --port 5174    (frontend)
// Re-seed demo.db before a full run so captures don't hit duplicate guards.

import { chromium } from "playwright";
import { mkdirSync, renameSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE || "http://localhost:5174";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "../../recordings");
const SIZE = { width: 1920, height: 1080 };
const AI_WAIT = 120_000;

const beat = (ms) => new Promise((r) => setTimeout(r, ms));

// A fake cursor + click ring so headless footage shows where things happen.
async function injectCursor(context) {
  await context.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent = `
      .rec-dot, .rec-ring { position: fixed; z-index: 2147483647; pointer-events: none;
        border-radius: 50%; transform: translate(-50%,-50%); }
      .rec-dot { width: 14px; height: 14px; background: rgba(108,92,231,.85);
        box-shadow: 0 0 0 3px rgba(255,255,255,.9), 0 2px 8px rgba(0,0,0,.35);
        transition: left .18s ease-out, top .18s ease-out; }
      .rec-ring { width: 36px; height: 36px; border: 3px solid rgba(108,92,231,.7);
        animation: rec-ripple .45s ease-out forwards; }
      @keyframes rec-ripple { from { transform: translate(-50%,-50%) scale(.4); opacity: 1; }
        to { transform: translate(-50%,-50%) scale(1.4); opacity: 0; } }`;
    const dot = document.createElement("div");
    dot.className = "rec-dot";
    dot.style.left = "-50px";
    dot.style.top = "-50px";
    const mount = () => {
      document.head.appendChild(css);
      document.body.appendChild(dot);
    };
    if (document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount);
    window.addEventListener("mousemove", (e) => {
      dot.style.left = e.clientX + "px";
      dot.style.top = e.clientY + "px";
    });
    window.addEventListener("mousedown", (e) => {
      const ring = document.createElement("div");
      ring.className = "rec-ring";
      ring.style.left = e.clientX + "px";
      ring.style.top = e.clientY + "px";
      document.body.appendChild(ring);
      ring.addEventListener("animationend", () => ring.remove());
    });
  });
}

async function clickText(page, selector, text) {
  const el = page.locator(selector).filter({ hasText: text }).first();
  await el.scrollIntoViewIfNeeded();
  await beat(500);
  await el.click();
  await beat(700);
}

async function typeInto(page, selector, text) {
  const el = page.locator(selector);
  await el.click();
  await beat(300);
  await el.pressSequentially(text, { delay: 30 });
  await beat(600);
}

const nav = (page, label) =>
  clickText(page, "button.nav-item", label);

/* ---------------- scenes ---------------- */

async function scene01_overview(page) {
  await page.goto(BASE);
  await page.waitForSelector(".space-card", { timeout: 30_000 });
  await beat(2500);
  const banner = page.locator(".conflict-banner");
  if (await banner.count()) {
    await banner.scrollIntoViewIfNeeded();
    await beat(3000);
    await page.locator(".space-cards").scrollIntoViewIfNeeded();
    await beat(1500);
  }
}

async function scene02_spaces(page) {
  await page.goto(BASE);
  await page.waitForSelector(".space-card");
  await beat(1200);
  await nav(page, "Manage spaces");
  await page.waitForSelector(".page-head");
  await beat(2500);
  await nav(page, "Camera Rental");
  await page.waitForSelector(".page-head");
  await beat(2500);
}

async function captureExample(page, chipText, holdMs = 3500) {
  await nav(page, "AI Capture");
  await page.waitForSelector("#customer-message");
  await beat(800);
  await clickText(page, ".chip", chipText);
  await clickText(page, "button.btn", "Analyze with Local AI");
  await page.waitForSelector(".extracted-fields", { timeout: AI_WAIT });
  await beat(holdMs);
  await clickText(page, "button.btn", "Save as Task");
  await page.waitForSelector(".save-success", { timeout: 30_000 });
  await beat(2500);
}

async function scene03_capture_scholarship(page) {
  await page.goto(BASE);
  await page.waitForSelector(".space-card");
  await captureExample(page, "Scholarship renewal documents");
}

async function scene04_capture_booking(page) {
  await page.goto(BASE);
  await page.waitForSelector(".space-card");
  await captureExample(page, "rent the camera");
}

async function scene05_attention(page) {
  await page.goto(BASE);
  await page.waitForSelector(".space-card");
  await beat(1500);
  const card = page.locator(".ov-grid .card").first();
  await card.scrollIntoViewIfNeeded();
  await beat(3500);
}

async function scene06_plan(page) {
  await page.goto(BASE);
  await page.waitForSelector(".plan-card");
  await page.locator(".plan-card").scrollIntoViewIfNeeded();
  await beat(1200);
  await clickText(page, "button.btn", "Plan my day with local AI");
  await page.waitForSelector(".plan-summary", { timeout: AI_WAIT });
  await beat(3000);
  const add = page.locator("button", { hasText: "Add to calendar" }).first();
  if (await add.count()) {
    await add.scrollIntoViewIfNeeded();
    await beat(800);
    await add.click();
    await page.waitForSelector(".plan-added", { timeout: 15_000 });
    await beat(2000);
  }
}

async function scene07_calendar(page) {
  await page.goto(BASE);
  await page.waitForSelector(".space-card");
  await nav(page, "Calendar");
  await page.waitForSelector(".cal-week");
  await beat(3000);
  const cell = page.locator(".cal-now");
  if (await cell.count()) await cell.scrollIntoViewIfNeeded();
  await beat(2000);
  await clickText(page, ".seg button", "Month");
  await page.waitForSelector(".cal-month");
  await beat(2500);
}

async function scene08_ask(page) {
  await page.goto(BASE);
  await page.waitForSelector(".space-card");
  await nav(page, "Assistant");
  await page.waitForSelector(".scope-toggle");
  await beat(1000);
  await clickText(page, ".chip", "What should I prioritize today?");
  await page.waitForSelector(".bubble-ai", { timeout: AI_WAIT });
  await page.waitForFunction(
    () => !document.body.innerText.includes("Thinking..."),
    { timeout: AI_WAIT }
  );
  await beat(3000);
}

async function scene09_focus(page) {
  await page.goto(BASE);
  await page.waitForSelector(".focus-nav-button");
  await beat(1000);
  await page.locator(".focus-nav-button").click();
  await page.waitForSelector(".focus-select select");
  await beat(1200);
  // pick the scholarship task if present, else the first option
  const value = await page.evaluate(() => {
    const sel = document.querySelector(".focus-select select");
    const opt = [...sel.options].find((o) =>
      /scholarship|renewal/i.test(o.textContent)
    );
    return (opt || sel.options[0])?.value || "";
  });
  if (value) await page.selectOption(".focus-select select", value);
  await beat(1000);
  await clickText(page, "button", "Generate Plan");
  await page.waitForSelector(".checklist", { timeout: AI_WAIT });
  await beat(2500);
  await page.locator(".checklist input").first().check();
  await beat(1200);
  await clickText(page, ".timer-actions .btn", "Start");
  await beat(4000); // let the countdown visibly tick
  await page.locator("button.exit").click();
  await page.waitForSelector(".float-pill");
  await beat(2000);
  await page.locator(".float-pill").click();
  await page.waitForSelector(".float-card");
  await beat(2500);
}

const SCENES = [
  ["01-overview", scene01_overview],
  ["02-spaces", scene02_spaces],
  ["03-capture-scholarship", scene03_capture_scholarship],
  ["04-capture-booking", scene04_capture_booking],
  ["05-attention", scene05_attention],
  ["06-plan-my-day", scene06_plan],
  ["07-calendar", scene07_calendar],
  ["08-ask-soloops", scene08_ask],
  ["09-focus-mode", scene09_focus],
];

/* ---------------- runner ---------------- */

mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2).map(Number).filter(Boolean);
const browser = await chromium.launch({ headless: true });

for (const [i, [name, fn]] of SCENES.entries()) {
  const num = i + 1;
  if (only.length && !only.includes(num)) continue;
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: OUT, size: SIZE },
  });
  await injectCursor(context);
  const page = await context.newPage();
  const t0 = Date.now();
  try {
    await fn(page);
    console.log(`✓ scene ${name} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  } catch (err) {
    console.log(`✗ scene ${name} failed: ${err.message.split("\n")[0]}`);
  }
  const video = page.video();
  await context.close();
  if (video) {
    const src = await video.path();
    const dst = join(OUT, `scene-${name}.webm`);
    if (existsSync(dst)) renameSync(dst, `${dst}.old`);
    renameSync(src, dst);
  }
}

await browser.close();
console.log(`Done → ${OUT}`);
