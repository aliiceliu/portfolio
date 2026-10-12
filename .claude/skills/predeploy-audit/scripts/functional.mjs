// Functional half of the pre-deploy audit: does everything clickable do what it should, is anything
// erroring or missing, and will returning visitors actually get the new files.
//   node .claude/skills/predeploy-audit/scripts/functional.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Report, config, launchBrowser, openPage, password, root, scrollToEnd, startServer, unlock, withTimeout } from "./lib.mjs";

const report = new Report("functional");
const { server, origin } = await startServer();
const browser = await launchBrowser();
const pageName = (url) => new URL(url).pathname.split("/").pop() || "index.html";

async function check(name, where, fn) {
  try {
    // A check stuck for 3 minutes is reported as a failure instead of stalling the audit.
    await withTimeout(180000, fn);
  } catch (e) {
    report.add(name, "error", where, `check crashed: ${e.message.split("\n")[0]}`);
  }
}

try {
  // ---------- Console errors, failed requests, links ----------
  for (const page of config.pages) {
    for (const width of [1440, 390]) {
      const where = `${page} @${width}`;
      await check("Console errors", where, async () => {
        const { p, context, errors, failed, external } = await openPage(browser, origin, page, { width });
        await scrollToEnd(p);
        await p.waitForTimeout(800);
        // React #418 is Framer's hydration mismatch warning; it recovers on its own.
        const hydration = errors.filter((e) => /#418|hydrat|server\/client mismatch/i.test(e));
        const real = [...new Set(errors.filter((e) => !hydration.includes(e)))];
        if (real.length) for (const e of real) report.add("Console errors", "error", where, e.slice(0, 200));
        else report.pass("Console errors", where);
        if (hydration.length) report.add("Console errors", "info", where, `${hydration.length} React hydration warning(s) (#418). Harmless but means the HTML and the JS bundle disagree somewhere.`);

        // Shorten long query strings so the report stays readable.
        const missing = [...new Set(failed.map((f) => f.replace(/\?[^ ]{60,}/, "?…")))].filter((f) => !/favicon/.test(f));
        if (missing.length) for (const f of missing) report.add("Failed requests", "error", where, f);
        else report.pass("Failed requests", where);

        // Images that finished loading but have no pixels are broken (bad file or wrong path).
        const broken = await p.evaluate(() => [...document.images].filter((i) => i.getClientRects().length && i.complete && !i.naturalWidth && i.currentSrc).map((i) => i.currentSrc.replace(location.origin, "")));
        if (broken.length) for (const src of [...new Set(broken)]) report.add("Broken images", "error", where, src);
        else report.pass("Broken images", where);

        const hosts = [...new Set(external.map((u) => new URL(u).host))];
        const framer = hosts.filter((h) => /framer/.test(h));
        if (framer.length) report.add("External requests", "warning", where, `still loads from ${framer.join(", ")}`);
        if (hosts.length) report.add("External requests", "info", where, `external hosts: ${hosts.join(", ")}`);
        else report.pass("External requests", where);

        if (width === 1440) {
          const links = await p.evaluate(() => [...document.querySelectorAll("a[href], [data-nested-link][href]")].map((a) => a.getAttribute("href")));
          const local = [...new Set(links)].filter((h) => h && !/^(?:[a-z]+:|#|\/\/)/i.test(h));
          let broken = 0;
          for (const href of local) {
            const file = path.join(root, decodeURIComponent(href.split(/[?#]/)[0]));
            if (!fs.existsSync(file)) { broken += 1; report.add("Local links", "error", where, `${href} points to a file that doesn't exist`); }
          }
          if (!broken) report.pass("Local links", where);
        }
        await context.close();
      });
    }
  }

  // ---------- Next / Previous Project cards ----------
  for (const page of config.caseStudies) {
    for (const width of [1440, 390]) {
      const where = `${page} @${width}`;
      await check("Next Project card", where, async () => {
        const { p, context } = await openPage(browser, origin, page, { width });
        await scrollToEnd(p);
        const card = await p.evaluate(() => {
          const c = [...document.querySelectorAll(".project-card")].find((e) => e.getClientRects().length && e.offsetWidth);
          if (!c) return null;
          c.scrollIntoView({ block: "center", behavior: "instant" });
          const r = c.getBoundingClientRect();
          const link = c.closest("[data-nested-link][href]") || c.closest("a[href]");
          return { x: r.x + r.width / 2, y: r.y + r.height / 2, href: link?.getAttribute("href") };
        });
        if (!card) { report.add("Next Project card", "error", where, "no Next/Previous Project card found (site-navigation.js tags it as .project-card)"); await context.close(); return; }
        await p.waitForTimeout(300);
        const expected = card.href.replace("./", "");
        await Promise.all([p.waitForURL((u) => pageName(u.href) !== page, { timeout: 5000 }).catch(() => {}), p.mouse.click(card.x, card.y)]);
        const landed = pageName(p.url());
        if (landed === page) report.add("Next Project card", "error", where, `clicking the card stayed on ${page} (expected ${expected})`);
        else if (landed !== expected) report.add("Next Project card", "error", where, `clicking the card went to ${landed}, but its link says ${expected}`);
        else report.pass("Next Project card", where);
        await context.close();
      });
    }
  }

  // ---------- Back to top ----------
  for (const page of config.pages) {
    for (const width of [1440, 390]) {
      const where = `${page} @${width}`;
      await check("Back to top", where, async () => {
        const { p, context } = await openPage(browser, origin, page, { width });
        await scrollToEnd(p);
        const button = await p.evaluate(() => {
          const all = [...document.querySelectorAll('[data-framer-name="back to top asset"]')].filter((e) => e.getClientRects().length && e.offsetWidth);
          const b = all[all.length - 1];
          if (!b) return null;
          b.scrollIntoView({ block: "center", behavior: "instant" });
          const r = b.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        });
        if (!button) { report.add("Back to top", "info", where, "no Back to top button on this page"); await context.close(); return; }
        await p.waitForTimeout(300);
        const url = p.url();
        const start = await p.evaluate(() => scrollY);
        await p.mouse.click(button.x, button.y);
        const samples = [];
        for (let i = 0; i < 16; i += 1) { await p.waitForTimeout(125); samples.push(await p.evaluate(() => scrollY)); }
        const end = samples[samples.length - 1];
        const animated = samples.some((y) => y > 1 && y < start - 1);
        if (p.url() !== url) report.add("Back to top", "error", where, `changed the page to ${p.url().replace(origin, "")}`);
        else if (end > 1) report.add("Back to top", "error", where, `stopped at ${Math.round(end)}px instead of the top (from ${Math.round(start)}px)`);
        else if (!animated) report.add("Back to top", "warning", where, "reached the top without a visible scroll animation");
        else report.pass("Back to top", where);
        await context.close();
      });
    }
  }

  // ---------- Navigation and theme ----------
  await check("Phone menu", "index.html @390", async () => {
    const { p, context } = await openPage(browser, origin, "index.html", { width: 390, mobile: true });
    const trigger = await p.$(".site-mobile-menu-trigger");
    if (!trigger) { report.add("Phone menu", "error", "index.html @390", "no menu button in the phone header"); await context.close(); return; }
    await trigger.tap();
    await p.waitForTimeout(300);
    const open = await p.evaluate(() => { const m = document.querySelector(".site-mobile-menu"); return Boolean(m && !m.hidden && m.getClientRects().length); });
    await p.keyboard.press("Escape");
    await p.waitForTimeout(300);
    const closed = await p.evaluate(() => { const m = document.querySelector(".site-mobile-menu"); return !m || m.hidden; });
    if (!open) report.add("Phone menu", "error", "index.html @390", "tapping the menu button didn't open the menu");
    else if (!closed) report.add("Phone menu", "error", "index.html @390", "Escape didn't close the menu");
    else report.pass("Phone menu", "index.html @390");
    // A menu link goes somewhere.
    await trigger.tap();
    await p.waitForTimeout(300);
    const about = await p.$('.site-mobile-menu a[href*="about"]');
    if (about) {
      await Promise.all([p.waitForURL(/about/, { timeout: 5000 }).catch(() => {}), about.tap()]);
      if (!/about/.test(p.url())) report.add("Phone menu", "error", "index.html @390", "the About link in the menu didn't navigate");
    }
    await context.close();
  });

  await check("Theme toggle", "index.html @1440", async () => {
    const { p, context } = await openPage(browser, origin, "index.html", { width: 1440, theme: "light" });
    const before = await p.evaluate(() => document.documentElement.dataset.theme);
    const toggle = await p.$(".theme-toggle");
    if (!toggle) { report.add("Theme toggle", "error", "index.html @1440", "no theme toggle found"); await context.close(); return; }
    await toggle.click();
    await p.waitForTimeout(300);
    const after = await p.evaluate(() => document.documentElement.dataset.theme);
    await p.goto(`${origin}/about.html`, { waitUntil: "networkidle" });
    const carried = await p.evaluate(() => document.documentElement.dataset.theme);
    if (before === after) report.add("Theme toggle", "error", "index.html @1440", "clicking the toggle didn't change the theme");
    else if (carried !== after) report.add("Theme toggle", "error", "about.html @1440", `theme went back to ${carried} on the next page`);
    else report.pass("Theme toggle", "all pages");
    await context.close();
  });

  // ---------- Password gate ----------
  for (const page of config.caseStudies) {
    await check("Password gate", page, async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const p = await context.newPage();
      await p.goto(`${origin}/${page}`, { waitUntil: "networkidle" });
      if (!(await p.$("#password-input, input[name=password]"))) { report.add("Password gate", "info", page, "not password-protected"); await context.close(); return; }
      await p.fill("#password-input, input[name=password]", "definitely-wrong");
      await p.keyboard.press("Enter");
      await p.waitForTimeout(1200);
      const wrong = await p.evaluate(() => ({
        stillLocked: Boolean(document.querySelector("#password-input, input[name=password]")),
        message: /incorrect password/i.test(document.body.innerText),
        bubble: Boolean(document.querySelector(".mascot-bubble")),
      }));
      if (!wrong.stillLocked) report.add("Password gate", "error", page, "a wrong password unlocked the page");
      if (!wrong.message) report.add("Password gate", "warning", page, "no error message after a wrong password");
      if (wrong.bubble) report.add("Password gate", "warning", page, "the cat showed a bubble after a wrong password (it should only wobble)");
      if (password()) {
        await unlock(p);
        if (await p.$("#password-input, input[name=password]")) report.add("Password gate", "error", page, "the correct password didn't unlock the page");
      }
      if (wrong.stillLocked && wrong.message && !wrong.bubble) report.pass("Password gate", page);
      await context.close();
    });
  }

  // ---------- Play: photo viewer ----------
  for (const [width, mobile] of [[1440, false], [390, true]]) {
    const where = `play.html @${width}`;
    await check("Photo viewer", where, async () => {
      const { p, context } = await openPage(browser, origin, "play.html", { width, mobile });
      const tap = async (handle) => (mobile ? handle.tap() : handle.click());
      const cover = await p.$(".pa-cover");
      if (cover) { await cover.scrollIntoViewIfNeeded(); await tap(cover).catch(() => {}); await p.waitForTimeout(1200); }
      const open = async () => {
        for (const slot of await p.$$(".pa-slot")) {
          if (await slot.isVisible()) { await slot.scrollIntoViewIfNeeded(); await tap(slot).catch(() => {}); await p.waitForTimeout(1000); return Boolean(await p.$(".pa-lb")); }
        }
        return false;
      };
      if (!(await open())) { report.add("Photo viewer", "error", where, "tapping a photo didn't open the viewer"); await context.close(); return; }
      const closeOnTop = await p.evaluate(() => {
        const b = document.querySelector(".pa-lb-close");
        if (!b) return "missing";
        const r = b.getBoundingClientRect();
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return b.contains(top) ? "ok" : `covered by ${top?.closest("[class]")?.className}`;
      });
      if (closeOnTop !== "ok") report.add("Photo viewer", "error", where, `close button is ${closeOnTop}`);
      const caption = () => p.evaluate(() => document.querySelector(".pa-lb-cap")?.innerText);
      const first = await caption();
      const next = await p.$(".pa-lb-next");
      if (next) { await tap(next); await p.waitForTimeout(800); if ((await caption()) === first) report.add("Photo viewer", "warning", where, "the next button didn't change the photo"); }
      if (closeOnTop === "ok") {
        await tap(await p.$(".pa-lb-close"));
        await p.waitForTimeout(800);
        if (await p.$(".pa-lb")) report.add("Photo viewer", "error", where, "the X didn't close the viewer");
      }
      if (!mobile && (await open())) {
        await p.keyboard.press("Escape");
        await p.waitForTimeout(800);
        if (await p.$(".pa-lb")) report.add("Photo viewer", "warning", where, "Escape didn't close the viewer");
      }
      if (!report.findings.some((f) => f.check === "Photo viewer" && f.where === where)) report.pass("Photo viewer", where);
      await context.close();
    });
  }

  // ---------- Mascot ----------
  await check("Mascot bubbles", "urban-design-system.html @1440", async () => {
    const where = "urban-design-system.html @1440";
    const { p, context } = await openPage(browser, origin, "urban-design-system.html", { width: 1440 });
    await p.waitForTimeout(6000); // let the chat's own greeting finish
    // Record the bubble the moment it appears: it times out while the page is still being scrolled.
    await p.evaluate(() => {
      window.__mascotBubble = null;
      new MutationObserver(() => {
        const b = document.querySelector(".mascot-bubble");
        if (b && !window.__mascotBubble) window.__mascotBubble = b.innerText;
      }).observe(document.body, { childList: true, subtree: true });
    });
    await scrollToEnd(p);
    let bubble = null;
    for (let i = 0; i < 14 && !bubble; i += 1) {
      bubble = await p.evaluate(() => window.__mascotBubble);
      if (!bubble) { await p.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" })); await p.waitForTimeout(1000); }
    }
    // Make sure one is showing for the click test below.
    if (bubble && !(await p.$(".mascot-bubble"))) {
      await p.evaluate(() => sessionStorage.removeItem("mascot-seen"));
      await p.reload({ waitUntil: "load" });
      if (await p.$("#password-input, input[name=password]")) await unlock(p);
      await p.waitForTimeout(6000);
      await p.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) { window.scrollTo({ top: y, behavior: "instant" }); await new Promise((r) => setTimeout(r, 60)); }
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
      });
      await p.waitForSelector(".mascot-bubble", { timeout: 12000 }).catch(() => {});
    }
    if (!bubble) { report.add("Mascot bubbles", "warning", where, "no end-of-page bubble appeared"); await context.close(); return; }
    report.add("Mascot bubbles", "info", where, `end-of-page bubble: "${bubble}"`);
    const t0 = Date.now();
    await p.click(".mc-root .mc-cat");
    await p.waitForTimeout(100);
    const left = await p.evaluate(() => document.querySelectorAll(".mc-bubble").length);
    if (left) report.add("Mascot bubbles", "error", where, "a bubble was still showing after clicking the cat");
    else report.pass("Mascot bubbles", `${where} (cat click hides bubbles, ${Date.now() - t0}ms)`);
    await p.click(".mc-root .mc-cat"); // close the chat again
    // Same session: the bubble shouldn't come back.
    await p.reload({ waitUntil: "networkidle" });
    if (await p.$("#password-input, input[name=password]")) await unlock(p);
    await p.waitForTimeout(6000);
    await scrollToEnd(p);
    await p.waitForTimeout(4000);
    if (await p.$(".mascot-bubble")) report.add("Mascot bubbles", "error", where, "the end-of-page bubble showed again in the same session");
    else report.pass("Mascot bubbles", `${where} (no repeat in the same session)`);
    await context.close();
  });

  await check("Mascot bubbles", "index.html @1440 (timeout)", async () => {
    const { p, context } = await openPage(browser, origin, "index.html", { width: 1440 });
    let seenAt = null;
    for (let i = 0; i < 40; i += 1) {
      const n = await p.evaluate(() => document.querySelectorAll(".mc-bubble").length);
      if (n && seenAt === null) seenAt = i;
      if (!n && seenAt !== null) break;
      if (seenAt !== null && i - seenAt > 16) { report.add("Mascot bubbles", "error", "index.html @1440", "a bubble stayed up longer than 8 seconds"); break; }
      await p.waitForTimeout(500);
    }
    if (seenAt === null) report.add("Mascot bubbles", "info", "index.html @1440", "no bubble appeared in 20s, so the timeout couldn't be checked (greetings show once per session)");
    else if (!report.findings.some((f) => f.where === "index.html @1440" && f.check === "Mascot bubbles" && f.severity === "error")) report.pass("Mascot bubbles", "index.html @1440 (bubble times out)");
    await context.close();
  });

  // ---------- About: Smiski cursors ----------
  await check("Smiski cursors", "about.html @1440", async () => {
    const where = "about.html @1440";
    const { p, context } = await openPage(browser, origin, "about.html", { width: 1440 });
    let ok = 0;
    for (const selector of config.aboutCards) {
      const box = await p.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el || !el.offsetWidth) return null;
        el.scrollIntoView({ block: "center", behavior: "instant" });
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }, selector);
      if (!box) { report.add("Smiski cursors", "error", where, `card ${selector} not found (class names change when Framer re-exports; update aboutCards in audit.config.json and smiskis in delight.js)`); continue; }
      await p.waitForTimeout(200);
      await p.mouse.move(box.x - 3, box.y - 3);
      await p.mouse.move(box.x, box.y, { steps: 3 });
      await p.waitForTimeout(400);
      const shown = await p.evaluate(() => Boolean(document.querySelector(".smiski-cursor.is-visible")) && document.documentElement.classList.contains("smiski-hover"));
      if (shown) ok += 1;
      else report.add("Smiski cursors", "error", where, `no Smiski when hovering ${selector}`);
    }
    await p.mouse.move(4, 450, { steps: 3 });
    await p.waitForTimeout(400);
    const leftOver = await p.evaluate(() => Boolean(document.querySelector(".smiski-cursor.is-visible")) || document.body.classList.contains("framer-cursor-none"));
    if (leftOver) report.add("Smiski cursors", "error", where, "the Smiski or a hidden cursor stayed on outside the cards");
    if (ok === config.aboutCards.length && !leftOver) report.pass("Smiski cursors", where);
    await context.close();
  });
} finally {
  await browser.close();
  server.close();
}

// ---------- Static checks: cache busting, bundle copies, syntax, generated CSS ----------

const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
const changed = git("status", "--porcelain", "--untracked-files=all")
  .split("\n").filter(Boolean)
  .map((l) => ({ status: l.slice(0, 2).trim(), file: l.slice(3).replace(/^"|"$/g, "") }));
const changedAssets = changed.filter((c) => /^assets\/(js|css)\//.test(c.file));

// A changed CSS/JS file referenced with ?v= must have a new ?v= on every page, or browsers keep the old copy.
const htmlFiles = config.pages;
for (const page of htmlFiles) {
  const now = fs.readFileSync(path.join(root, page), "utf8");
  let before = "";
  try { before = git("show", `HEAD:${page}`); } catch { /* new page */ }
  for (const { file, status } of changedAssets) {
    const base = path.basename(file);
    const ref = new RegExp(`${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\?v=([\\w.-]+)`);
    const nowV = now.match(ref)?.[1];
    if (!nowV) continue;
    const beforeV = before.match(ref)?.[1];
    if (status !== "??" && beforeV && beforeV === nowV) report.add("Cache busting", "error", page, `${file} changed but is still loaded as ?v=${nowV}`);
    else report.pass("Cache busting", `${page} ${base}`);
  }
}
// Hashed bundles have no ?v=; a changed one keeps its old name, so returning visitors may get a stale copy.
const hashedChanged = changedAssets.filter((c) => c.status !== "??" && /-[0-9a-f]{8}\.(js|mjs)$/.test(c.file));
if (hashedChanged.length) report.add("Cache busting", "info", "assets/js", `${hashedChanged.length} hashed bundle(s) were edited in place (e.g. ${path.basename(hashedChanged[0].file)}). Returning visitors may need a hard refresh until their cache expires.`);

// Each Framer bundle exists as X.mjs and X-<hash>.js; they must stay identical.
const jsDir = path.join(root, "assets/js");
const jsFiles = fs.readdirSync(jsDir);
let pairDrift = 0;
for (const mjs of jsFiles.filter((f) => f.endsWith(".mjs") && !/-[0-9a-f]{8}\.mjs$/.test(f))) {
  const stem = mjs.slice(0, -4).replace("@", "_");
  const twin = jsFiles.find((f) => f !== mjs && f.startsWith(`${stem}-`) && /-[0-9a-f]{8}\.m?js$/.test(f));
  if (!twin) continue;
  if (!fs.readFileSync(path.join(jsDir, mjs)).equals(fs.readFileSync(path.join(jsDir, twin)))) {
    pairDrift += 1;
    report.add("Bundle copies in sync", "error", "assets/js", `${mjs} and ${twin} differ; an edit was only made to one copy`);
  }
}
if (!pairDrift) report.pass("Bundle copies in sync", "assets/js");

// Syntax of every changed script.
for (const { file } of changedAssets.filter((c) => /\.(m?js)$/.test(c.file) && fs.existsSync(path.join(root, c.file)))) {
  const r = spawnSync(process.execPath, ["--check", path.join(root, file)], { encoding: "utf8" });
  if (r.status !== 0) report.add("Script syntax", "error", file, (r.stderr || "").split("\n").find((l) => /Error/.test(l)) || "syntax error");
  else report.pass("Script syntax", file);
}

// The generated dark-theme CSS must match what the build script would produce now.
const darkCss = path.join(root, "assets/css/theme-framer-dark.css");
if (fs.existsSync(path.join(root, "scripts/build-dark-theme.mjs")) && fs.existsSync(darkCss)) {
  const saved = fs.readFileSync(darkCss);
  const r = spawnSync(process.execPath, [path.join(root, "scripts/build-dark-theme.mjs")], { cwd: root, encoding: "utf8" });
  const fresh = fs.readFileSync(darkCss);
  fs.writeFileSync(darkCss, saved);
  if (r.status !== 0) report.add("Generated dark theme", "error", "scripts/build-dark-theme.mjs", r.stderr.split("\n")[0]);
  else if (!saved.equals(fresh)) report.add("Generated dark theme", "warning", "assets/css/theme-framer-dark.css", "out of date with the page CSS; run `npm run build:theme`");
  else report.pass("Generated dark theme", "assets/css/theme-framer-dark.css");
}

const counts = report.write();
process.exit(counts.error ? 1 : 0);
