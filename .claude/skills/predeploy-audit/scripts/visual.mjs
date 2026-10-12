// Visual half of the pre-deploy audit. Loads every page at every width in light and dark, runs the
// checks below in the page, and saves full-page screenshots plus a gallery for a human look.
//   node .claude/skills/predeploy-audit/scripts/visual.mjs [page.html ...]
import fs from "node:fs";
import path from "node:path";
import { Report, allowed, config, launchBrowser, openPage, scrollToEnd, startServer, viewports, withTimeout } from "./lib.mjs";

const pages = process.argv.slice(2).length ? process.argv.slice(2) : config.pages;
const report = new Report("visual");
const shots = path.join(report.dir, "screenshots");
fs.mkdirSync(shots, { recursive: true });

// Runs inside the page. Returns everything the checks need in one pass.
function collect({ bodyFont, longChars }) {
  const visible = (el) => {
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const describe = (el) => (el.dataset?.framerName ? `[${el.dataset.framerName}] ` : "") + `.${String(el.className).split(" ")[0]}`;
  const snippet = (t) => (t.length > 70 ? `${t.slice(0, 70)}…` : t);
  const scope = document.querySelector("#main") || document.body;
  const blockSel = "p, h1, h2, h3, h4, h5, h6, li";
  const blocks = [...scope.querySelectorAll(blockSel)].filter((el) => !el.closest(".mc-root") && visible(el) && !el.querySelector(blockSel));

  // Text sizes inside each block, weighted by characters.
  const textBlocks = blocks.map((el) => {
    const sizes = {};
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let family = "";
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.textContent.trim();
      if (!t) continue;
      const cs = getComputedStyle(n.parentElement);
      family ||= cs.fontFamily.split(",")[0].replace(/["']/g, "");
      sizes[cs.fontSize] ??= { chars: 0, sample: "" };
      sizes[cs.fontSize].chars += t.length;
      if (sizes[cs.fontSize].sample.length < 40) sizes[cs.fontSize].sample += `${t} `;
    }
    const text = el.innerText.trim().replace(/\s+/g, " ");
    const dominant = Object.entries(sizes).sort((a, b) => b[1].chars - a[1].chars)[0]?.[0];
    return { text, family, sizes, dominant, where: describe(el) };
  });

  const mixed = textBlocks
    .filter((b) => Object.keys(b.sizes).length > 1)
    .map((b) => ({
      text: snippet(b.text),
      where: b.where,
      dominant: b.dominant,
      others: Object.entries(b.sizes).filter(([s, v]) => s !== b.dominant && v.chars >= 3).map(([s, v]) => `${s}: "${v.sample.trim()}"`),
    }))
    .filter((m) => m.others.length);

  const body = textBlocks.filter((b) => b.family === bodyFont && b.text.length >= longChars).map((b) => ({ text: b.text, size: b.dominant, where: b.where }));

  // Same visible text twice at one width usually means a breakpoint copy that should be hidden.
  const seen = new Map();
  for (const b of textBlocks) {
    if (b.text.length < 40) continue;
    seen.set(b.text, (seen.get(b.text) || 0) + 1);
  }
  const duplicates = [...seen].filter(([, n]) => n > 1).map(([t, n]) => ({ text: snippet(t), count: n }));

  // Horizontal overflow, and what sticks out.
  const vw = document.documentElement.clientWidth;
  const clipsX = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const o = getComputedStyle(a).overflowX;
      if (o !== "visible") return true;
    }
    return false;
  };
  const sticking = [...scope.querySelectorAll("*")]
    .filter((el) => !el.closest(".mc-root") && visible(el) && el.getBoundingClientRect().right > vw + 2 && !clipsX(el))
    .slice(0, 5)
    .map((el) => `${describe(el)} right edge ${Math.round(el.getBoundingClientRect().right)}px`);
  const overflow = { scrollWidth: document.documentElement.scrollWidth, vw, sticking };

  // Text cut off by its own box.
  const clipped = blocks
    .filter((el) => {
      const cs = getComputedStyle(el);
      return (cs.overflow !== "visible" || cs.textOverflow === "ellipsis") && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2);
    })
    .map((el) => ({ text: snippet(el.innerText.trim()), where: describe(el) }));

  // Bordered cards (Framer draws borders on ::after from --border-* variables).
  const cards = [...scope.querySelectorAll("[data-border]")]
    .filter((el) => visible(el) && el.getBoundingClientRect().height > 60)
    .map((el) => {
      const cs = getComputedStyle(el);
      const after = getComputedStyle(el, "::after");
      return {
        where: describe(el),
        text: snippet(el.innerText.trim().replace(/\s+/g, " ")),
        radius: cs.borderTopLeftRadius,
        background: cs.backgroundColor,
        border: after.borderTopWidth !== "0px" ? after.borderTopColor : "none",
      };
    })
    .filter((c) => c.border !== "none" && parseFloat(c.radius) >= 12);

  const cat = document.querySelector(".mc-root .mc-cat");
  const catWidth = cat ? Math.round(cat.getBoundingClientRect().width) : null;

  return { mixed, body, duplicates, overflow, clipped, cards, catWidth };
}

// Runs inside the page: WCAG contrast of text against the nearest solid background.
function contrast({ min, minLarge }) {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const pageBg = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
  // Pictures bigger than an icon, in page coordinates.
  const media = [...document.querySelectorAll("img, video, picture, canvas, [style*='background-image']")]
    .map((m) => m.getBoundingClientRect())
    .filter((r) => r.width > 40 && r.height > 40)
    .map((r) => ({ left: r.left + scrollX, right: r.right + scrollX, top: r.top + scrollY, bottom: r.bottom + scrollY }));
  const out = [];
  const seen = new Set();
  const scope = document.querySelector("#main") || document.body;
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent.trim();
    if (text.length < 3) continue;
    const el = n.parentElement;
    if (!el || el.closest(".mc-root") || !el.getClientRects().length || seen.has(el)) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden") continue;
    const fg = parse(cs.color);
    if (!fg || fg.a === 0) continue;
    // Text over a picture (e.g. the footer's paper notes) can't be judged from colors; skip it.
    const tr = el.getBoundingClientRect();
    const tx = tr.left + tr.width / 2 + scrollX;
    const ty = tr.top + tr.height / 2 + scrollY;
    if (media.some((m) => tx >= m.left && tx <= m.right && ty >= m.top && ty <= m.bottom)) continue;
    // Otherwise the background is the nearest solid background color up the tree.
    let bg = null;
    for (let a = el; a; a = a.parentElement) {
      const c = parse(getComputedStyle(a).backgroundColor);
      if (c && c.a > 0.5) { bg = c; break; }
    }
    bg ||= pageBg;
    const mixedFg = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) };
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
    const r = ratio(mixedFg, bg);
    if (r < (large ? minLarge : min)) out.push({ text: text.slice(0, 50), ratio: Math.round(r * 100) / 100, fg: cs.color, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`, size: cs.fontSize });
  }
  return out;
}

// AUDIT_DEBUG=1 prints how long each step takes, to find a slow or stuck check.
let lapStart = Date.now();
const lap = (step) => { if (process.env.AUDIT_DEBUG) console.log(`${step}: ${Date.now() - lapStart}ms`); lapStart = Date.now(); };

const { server, origin } = await startServer();
const browser = await launchBrowser();
const catSizes = {};
const shotIndex = [];

try {
  for (const page of pages) {
    for (const { width, label } of viewports) {
      for (const theme of config.themes) {
        const where = `${page} @${width} ${theme}`;
        let session;
        try {
          // A page that takes over 2 minutes to load and scroll is reported, not waited on.
          session = await withTimeout(120000, async () => {
            const opened = await openPage(browser, origin, page, { width, theme });
            await scrollToEnd(opened.p); // trigger lazy content and scroll-in animations
            return opened;
          });
        } catch (e) {
          report.add("Page loads", "error", where, e.message.split("\n")[0]);
          continue;
        }
        const { p, context } = session;
        await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await p.waitForTimeout(600);

        lap(`${where} open+scroll`);
        const data = await p.evaluate(collect, { bodyFont: config.bodyFont, longChars: config.longParagraphChars });

        lap(`${where} collect`);
        // Layout checks don't depend on the theme, so they run once per width.
        if (theme === "light") {
          if (data.mixed.length) for (const m of data.mixed) report.add("Mixed text sizes in one paragraph", "error", `${page} @${width}`, `"${m.text}" is mostly ${m.dominant} but has ${m.others.join("; ")}`);
          else report.pass("Mixed text sizes in one paragraph", `${page} @${width}`);

          const counts = {};
          for (const b of data.body) counts[b.size] = (counts[b.size] || 0) + 1;
          const standard = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
          const odd = data.body.filter((b) => b.size !== standard && !allowed("body-size", page, b.text));
          if (odd.length) for (const b of odd) report.add("Body text size consistency", "warning", `${page} @${width}`, `"${b.text.slice(0, 60)}…" is ${b.size}; most body text here is ${standard}`);
          else report.pass("Body text size consistency", `${page} @${width}`);

          const dups = data.duplicates.filter((d) => !allowed("duplicate", page, d.text));
          if (dups.length) for (const d of dups) report.add("Duplicate content", "error", `${page} @${width}`, `"${d.text}" is visible ${d.count} times`);
          else report.pass("Duplicate content", `${page} @${width}`);

          if (data.overflow.scrollWidth > data.overflow.vw + 1) report.add("Horizontal scroll", "error", `${page} @${width}`, `page is ${data.overflow.scrollWidth}px wide in a ${data.overflow.vw}px viewport. ${data.overflow.sticking.join("; ")}`);
          else report.pass("Horizontal scroll", `${page} @${width}`);

          if (data.clipped.length) for (const c of data.clipped) report.add("Clipped text", "warning", `${page} @${width}`, `"${c.text}" (${c.where}) is cut off by its box`);
          else report.pass("Clipped text", `${page} @${width}`);

          catSizes[`${label}`] ??= {};
          catSizes[`${label}`][page] = data.catWidth;
        }

        // Card groups that look alike should share a border color.
        const groups = new Map();
        for (const c of data.cards) {
          const key = `${c.radius}|${c.background}`;
          groups.set(key, [...(groups.get(key) || []), c]);
        }
        let cardIssue = false;
        for (const [, cards] of groups) {
          const colors = [...new Set(cards.map((c) => c.border))];
          if (colors.length > 1) {
            cardIssue = true;
            report.add("Card border consistency", "warning", where, `cards with the same shape and background use ${colors.length} border colors: ${colors.map((col) => `${col} (${cards.filter((c) => c.border === col).map((c) => `"${c.text.slice(0, 30)}"`).join(", ")})`).join(" vs ")}`);
          }
        }
        if (!cardIssue) report.pass("Card border consistency", where);

        const lowContrast = await p.evaluate(contrast, { min: config.minContrast, minLarge: config.minContrastLarge });
        lap(`${where} contrast`);
        const realLow = lowContrast.filter((c) => !allowed("contrast", page, c.text));
        if (realLow.length) {
          for (const c of realLow.slice(0, 8)) report.add("Text contrast", "warning", where, `"${c.text}" ${c.size} at ${c.ratio}:1 (${c.fg} on ${c.bg})`);
          if (realLow.length > 8) report.add("Text contrast", "warning", where, `…and ${realLow.length - 8} more low-contrast texts`);
        } else report.pass("Text contrast", where);

        // Hover states on large clickable cards (desktop only; phones have no hover).
        if (label === "desktop" && theme === "light") {
          const targets = await p.evaluate(() => {
            const out = [];
            for (const el of document.querySelectorAll("a[href], [data-nested-link][href]")) {
              if (el.closest("nav, .mc-root, .site-mobile-header")) continue;
              // Aim at the picture inside the link: some links also wrap labels and other buttons.
              const pic = [...el.querySelectorAll("img, video, [data-framer-background-image-wrapper]")].find((m) => m.getBoundingClientRect().width > 0);
              const r = pic?.getBoundingClientRect();
              if (!r || r.width < 120 || r.height < 80) continue;
              out.push({ href: el.getAttribute("href"), name: el.dataset.framerName || String(el.className).split(" ")[0], y: r.top + scrollY, x: r.left + r.width / 2, h: r.height });
            }
            return out.slice(0, 20);
          });
          for (const t of targets) {
            await p.evaluate((y) => window.scrollTo({ top: y - 200, behavior: "instant" }), t.y);
            await p.mouse.move(2, 450);
            await p.waitForTimeout(250);
            const snapshot = () => p.evaluate(({ y, x, h }) => {
              const el = document.elementFromPoint(x, y - scrollY + h / 2);
              if (!el) return "";
              const chain = [];
              for (let a = el, i = 0; a && i < 6; a = a.parentElement, i += 1) {
                const cs = getComputedStyle(a);
                chain.push([cs.transform, cs.boxShadow, cs.opacity, cs.filter, cs.backgroundColor, cs.outlineStyle, cs.scale].join("|"));
                for (const child of a.children) { const c = getComputedStyle(child); chain.push([c.transform, c.opacity, c.filter].join("|")); }
              }
              return chain.join(";");
            }, t);
            const before = await snapshot();
            const pos = await p.evaluate(({ y, x, h }) => ({ x, y: y - scrollY + h / 2 }), t);
            await p.mouse.move(pos.x, pos.y, { steps: 3 });
            await p.waitForTimeout(500);
            const after = await snapshot();
            if (before === after) report.add("Hover state on clickable cards", "warning", `${page} @${width}`, `"${t.name}" → ${t.href} looks the same on hover`);
            else report.pass("Hover state on clickable cards", `${page} @${width}`);
          }
        }

        lap(`${where} hover`);
        const file = `${page.replace(".html", "")}-${width}-${theme}.png`;
        await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await p.screenshot({ path: path.join(shots, file), fullPage: true });
        shotIndex.push({ page, width, theme, file });
        lap(`${where} screenshot`);
        await context.close();
      }
    }
  }

  for (const [label, sizes] of Object.entries(catSizes)) {
    const distinct = [...new Set(Object.values(sizes).filter(Boolean))];
    if (distinct.length > 1) report.add("Mascot size", "error", label, `the cat is different sizes across pages: ${Object.entries(sizes).map(([pg, w]) => `${pg} ${w}px`).join(", ")}`);
    else report.pass("Mascot size", label);
  }
} finally {
  await browser.close();
  server.close();
}

// A simple gallery so the screenshots can be skimmed side by side.
const gallery = `<!doctype html><meta charset="utf-8"><title>Audit screenshots</title>
<style>body{font:14px system-ui;margin:16px;background:#f4f4f2}h2{margin:24px 0 8px}.row{display:flex;gap:12px;overflow-x:auto;align-items:flex-start}
figure{margin:0;flex:none}figure img{display:block;max-height:80vh;border:1px solid #ccc;background:#fff}figcaption{font-size:12px;color:#555;margin:4px 0}</style>
${pages.map((pg) => `<h2>${pg}</h2><div class="row">${shotIndex.filter((s) => s.page === pg).map((s) => `<figure><figcaption>${s.width}px · ${s.theme}</figcaption><a href="screenshots/${s.file}"><img src="screenshots/${s.file}" loading="lazy" width="${Math.round(s.width / 4)}"></a></figure>`).join("")}</div>`).join("")}`;
fs.writeFileSync(path.join(report.dir, "gallery.html"), gallery);

const counts = report.write(`Screenshots: \`screenshots/\` · gallery: \`gallery.html\`\n`);
process.exit(counts.error ? 1 : 0);
