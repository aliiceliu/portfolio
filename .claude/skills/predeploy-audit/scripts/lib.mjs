// Shared plumbing for the pre-deploy audit: a static server for the site, a browser, page loading
// (including the password gate), and the report writer. visual.mjs and functional.mjs hold the checks.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const root = path.resolve(skillDir, "../../..");
export const config = JSON.parse(fs.readFileSync(path.join(skillDir, "audit.config.json"), "utf8"));

// ---------- Static server ----------

const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".avif": "image/avif", ".gif": "image/gif", ".woff2": "font/woff2", ".woff": "font/woff",
  ".mp4": "video/mp4", ".webm": "video/webm", ".ico": "image/x-icon",
};

export function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) { res.writeHead(404).end("not found"); return; }
    const stat = fs.statSync(file);
    const type = types[path.extname(file).toLowerCase()] || "application/octet-stream";
    // Videos need range requests or Chromium won't play them.
    const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
    if (range) {
      const start = Number(range[1] || 0);
      // Answer in pieces of at most 1MB. Streaming whole videos tied up the browser's few connections
      // to this server, which stalled other page loads for 15+ minutes.
      const end = Math.min(range[2] ? Number(range[2]) : stat.size - 1, start + 1024 * 1024 - 1, stat.size - 1);
      res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1 });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { "Content-Type": type, "Content-Length": stat.size, "Accept-Ranges": "bytes", "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  server.keepAliveTimeout = 1000;
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}

// ---------- Browser ----------

function findChromium() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const caches = [path.join(os.homedir(), "Library/Caches/ms-playwright"), path.join(os.homedir(), ".cache/ms-playwright")];
  for (const cache of caches) {
    if (!fs.existsSync(cache)) continue;
    const builds = fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
    for (const build of builds) {
      for (const candidate of [
        "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
        "chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
        "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
        "chrome-linux/chrome",
        "chrome-linux64/chrome",
      ]) {
        const full = path.join(cache, build, candidate);
        if (fs.existsSync(full)) return full;
      }
    }
  }
  const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  return fs.existsSync(mac) ? mac : undefined;
}

export async function launchBrowser() {
  let chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    console.error("playwright-core is missing. Run `npm install` in the project root first.");
    process.exit(2);
  }
  const executablePath = findChromium();
  if (!executablePath) {
    console.error("No Chromium found. Run `npx playwright-core install chromium` or set CHROME_PATH.");
    process.exit(2);
  }
  // Pages the browser thinks are in the background get their timers slowed to a crawl, which once
  // turned a 4-second page load into 17 minutes; keep every page running at full speed.
  return chromium.launch({
    executablePath,
    args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"],
  });
}

export const viewports = config.widths.map((width) => ({ width, label: width >= 1200 ? "desktop" : width >= 810 ? "tablet" : "phone" }));

// Opens a page at a width and theme, gets past the password screen, and waits for Framer to settle.
export async function openPage(browser, origin, page, { width, theme = "light", reducedMotion = "no-preference", mobile = false } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    colorScheme: theme,
    reducedMotion,
    isMobile: mobile,
    hasTouch: mobile,
  });
  // Start in the requested theme the way the site's toggle stores it, without overriding a later toggle.
  await context.addInitScript((t) => { try { if (!localStorage.getItem("theme")) localStorage.setItem("theme", t); } catch {} }, theme);
  const p = await context.newPage();
  const errors = [];
  const failed = [];
  const external = [];
  p.on("pageerror", (e) => errors.push(e.message.split("\n")[0]));
  // Failed loads are reported once, from the network side, not again as console noise.
  p.on("console", (m) => { if (m.type() === "error" && !/^Failed to load resource/.test(m.text())) errors.push(m.text().split("\n")[0]); });
  // ERR_ABORTED is a load cut short on purpose (a video's preload, or the page closing), not a failure.
  p.on("requestfailed", (r) => { if (!/ERR_ABORTED/.test(r.failure()?.errorText || "")) failed.push(`${r.url()} (${r.failure()?.errorText})`); });
  p.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.url()} (HTTP ${r.status()})`); });
  p.on("request", (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith("data:")) external.push(r.url()); });
  // Looping videos can keep the network busy, so "idle" is a best effort after the page has loaded.
  await p.goto(`${origin}/${page}`, { waitUntil: "load", timeout: 60000 });
  await p.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  const locked = Boolean(await p.$("#password-input, input[name=password]"));
  if (locked) await unlock(p);
  await p.waitForTimeout(1500);
  return { p, context, errors, failed, external, locked };
}

export function withTimeout(ms, fn) {
  let timer;
  return Promise.race([
    fn().finally(() => clearTimeout(timer)),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timed out after ${ms / 1000}s`)), ms); }),
  ]);
}

export function password() {
  return process.env.AUDIT_PASSWORD || "";
}

export async function unlock(p) {
  if (!password()) throw new Error("This page is password-protected: set AUDIT_PASSWORD before running the audit.");
  await p.fill("#password-input, input[name=password]", password());
  await p.keyboard.press("Enter");
  await p.waitForTimeout(2000);
}

// Lazy images only load once they come near the viewport, so step down a screen at a time (an
// instant jump to the bottom skips them), until the page stops growing; then wait for images.
export async function scrollToEnd(p) {
  // Waits happen on this side, not with in-page timers, so a throttled page can't stall the audit.
  for (let pass = 0; pass < 3; pass += 1) {
    const startHeight = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let step = 0; step < 300; step += 1) {
      const atEnd = await p.evaluate(() => {
        window.scrollBy({ top: Math.round(innerHeight * 0.8), behavior: "instant" });
        return window.scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
      });
      await p.waitForTimeout(120);
      if (atEnd) break;
    }
    await p.waitForTimeout(300);
    if ((await p.evaluate(() => document.documentElement.scrollHeight)) === startHeight) break;
  }
  // Give images that started loading up to 6s to finish.
  for (let i = 0; i < 20; i += 1) {
    if (!(await p.evaluate(() => [...document.images].some((img) => img.getClientRects().length && !img.complete)))) break;
    await p.waitForTimeout(300);
  }
}

// ---------- Report ----------

export class Report {
  constructor(part) {
    this.part = part;
    this.findings = [];
    this.passes = [];
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    this.dir = path.join(root, "audit-reports", `${stamp}-${part}`);
    fs.mkdirSync(this.dir, { recursive: true });
  }

  // severity: "error" (broken / clearly wrong), "warning" (likely wrong, needs a look), "info" (FYI)
  add(check, severity, where, detail) {
    this.findings.push({ check, severity, where, detail });
  }

  pass(check, where) {
    this.passes.push({ check, where });
  }

  write(extra = "") {
    const order = { error: 0, warning: 1, info: 2 };
    const sorted = [...this.findings].sort((a, b) => order[a.severity] - order[b.severity] || a.check.localeCompare(b.check));
    const counts = Object.fromEntries(["error", "warning", "info"].map((s) => [s, sorted.filter((f) => f.severity === s).length]));
    const lines = [
      `# Pre-deploy audit: ${this.part}`,
      "",
      `Run ${new Date().toLocaleString()} · ${counts.error} errors · ${counts.warning} warnings · ${counts.info} info · ${this.passes.length} checks passed`,
      "",
    ];
    const byCheck = new Map();
    for (const f of sorted) byCheck.set(f.check, [...(byCheck.get(f.check) || []), f]);
    for (const [check, items] of byCheck) {
      lines.push(`## ${check}`, "");
      for (const f of items) lines.push(`- **${f.severity}** · ${f.where} · ${f.detail}`);
      lines.push("");
    }
    const passed = [...new Set(this.passes.map((x) => x.check))].filter((c) => !byCheck.has(c));
    if (passed.length) lines.push("## Passed with no findings", "", ...passed.map((c) => `- ${c}`), "");
    if (extra) lines.push(extra);
    fs.writeFileSync(path.join(this.dir, "report.md"), lines.join("\n"));
    fs.writeFileSync(path.join(this.dir, "findings.json"), JSON.stringify({ part: this.part, findings: sorted, passes: this.passes }, null, 2));
    console.log(lines.slice(0, 3).join("\n"));
    console.log(`Report: ${path.relative(root, path.join(this.dir, "report.md"))}`);
    return counts;
  }
}

// Text that is allowed to break a rule on purpose (see audit.config.json "allow").
export function allowed(rule, page, text) {
  return (config.allow?.[rule] || []).some((a) => (a.page === "*" || a.page === page) && text.startsWith(a.textStartsWith));
}
