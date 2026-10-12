// Generates assets/css/theme-framer-dark.css: dark-mode overrides for colors that the Framer export
// hardcodes (class rules like `.framer-x .framer-y { background-color: #fff }` and inline rich-text
// colors) instead of routing through a --token-* variable. Hand-tuned rules live in theme.css,
// which loads after this file and wins ties.
//
// Re-run after re-exporting from Framer:  npm run build:theme
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const outFile = path.join(root, "assets/css/theme-framer-dark.css");

// Only scan what the pages actually load (bundles exist as .mjs and hashed .js copies).
const pages = fs.readdirSync(root).filter((f) => f.endsWith(".html"));
const sources = new Set(pages.map((p) => path.join(root, p)));
for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  for (const [, file] of html.matchAll(/assets\/js\/([^"'?\s]+\.m?js)/g)) sources.add(path.join(root, "assets/js", file));
}
// Lazily imported page bundles (e.g. the password-protected case studies) are referenced from other bundles.
for (const file of fs.readdirSync(path.join(root, "assets/js"))) {
  if (/-[0-9a-f]{8}\.js$/.test(file)) sources.add(path.join(root, "assets/js", file));
}

// Custom components are themed by hand in theme.css.
const handThemed = /\.(ah|pa|mc)-|framer-TJFvs/;

// ---------- color math ----------
function parseColor(value) {
  value = value.trim().toLowerCase();
  let m = value.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  m = value.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  }
  return null;
}

function toHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

const hsl = (h, s, l, a = 1) => `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%${a < 1 ? ` / ${+a.toFixed(2)}` : ""})`;

// Light backgrounds -> dark surfaces of the same hue.
function darkBackground(c) {
  const { h, s, l } = toHsl(c);
  if (l < 0.6) return null; // already a mid/dark color; leave it alone
  if (c.r === 255 && c.g === 255 && c.b === 255) return c.a < 1 ? `rgba(255, 255, 255, ${+(c.a * 0.15).toFixed(3)})` : "var(--c-bg)";
  if (s < 0.12) return c.a < 1 ? `rgba(255, 255, 255, ${+(c.a * 0.3).toFixed(3)})` : "var(--c-surface)";
  return hsl(h, Math.min(s, 0.45) * 0.55, 0.16);
}

// Borders: light ones become subtle dark tints; dark ones are lifted so they stay visible.
function darkBorder(c) {
  const { h, s, l } = toHsl(c);
  if (s < 0.12) return l > 0.5 ? "var(--c-border)" : "var(--c-border-strong)";
  if (l > 0.7) return hsl(h, Math.min(s, 0.5) * 0.6, 0.3);
  if (l < 0.4) return hsl(h, s, 0.45);
  return null;
}

// Dark text -> light text. Greys map onto the palette; colored text keeps its hue.
// Translucent text is judged as it renders on white, so e.g. 76% and 45% black stay distinct.
function darkText(c) {
  const onWhite = (v) => v * c.a + 255 * (1 - c.a);
  const { h, s, l } = toHsl({ r: onWhite(c.r), g: onWhite(c.g), b: onWhite(c.b) });
  if (l > 0.6) return null; // light text (usually on an image or a dark chip); leave it
  if (s < 0.12) return l < 0.2 ? "var(--c-text)" : l < 0.45 ? "var(--c-text-2)" : "var(--c-text-3)";
  return hsl(h, Math.min(s, 0.85), 0.74);
}

// ---------- scan ----------
const classRules = new Map(); // "selector" -> Map(prop -> value)
const inlineText = new Set();
const extractedVars = new Set(); // "--extracted-abc|rgba(…)": Framer variant colors, animated inline
const ruleRe = /([^{}`]+)\{([^{}`]*)\}/g;
const declRe = /(background-color|--border-color|--framer-text-color)\s*:\s*([^;}]+)/g;

for (const file of sources) {
  const src = fs.readFileSync(file, "utf8");
  for (const [, rawSelector, body] of src.matchAll(ruleRe)) {
    const selector = rawSelector.trim();
    if (!selector.includes(".framer-") || handThemed.test(selector) || /[@;"'`<>]/.test(selector)) continue;
    for (const [, prop, rawValue] of body.matchAll(declRe)) {
      const color = parseColor(rawValue);
      if (!color) continue; // var(--token-*) values are handled by re-pointing the tokens
      const mapped = prop === "background-color" ? darkBackground(color) : prop === "--border-color" ? darkBorder(color) : darkText(color);
      if (!mapped) continue;
      for (const single of selector.split(",").map((s) => s.trim().replace(/\s+/g, " "))) {
        if (!classRules.has(single)) classRules.set(single, new Map());
        classRules.get(single).set(prop, mapped);
      }
    }
  }
  // Inline rich-text colors, as written in HTML (`--framer-text-color: rgb(…)`) or in React style objects.
  for (const [, value] of src.matchAll(/"?--framer-text-color"?\s*:\s*[`"]?(rgba?\([^)]*\))/g)) inlineText.add(value.replace(/\s+/g, " "));
  for (const [, name, value] of src.matchAll(/"?(--extracted-[a-z0-9]+)"?\s*:\s*[`"](rgba?\([^)]*\))[`"]/g)) extractedVars.add(`${name}|${value.replace(/\s+/g, " ")}`);
}

// ---------- emit ----------
const lines = [
  "/* GENERATED by scripts/build-dark-theme.mjs; do not edit. Hand-tuned dark styles live in theme.css. */",
  "",
  "/* Framer class rules with hardcoded colors */",
];
const byBody = new Map();
for (const [selector, decls] of classRules) {
  const body = [...decls].map(([p, v]) => `${p}: ${v}`).join("; ");
  if (!byBody.has(body)) byBody.set(body, []);
  byBody.get(body).push(`[data-theme="dark"] ${selector}`);
}
for (const [body, selectors] of [...byBody].sort((a, b) => a[0].localeCompare(b[0]))) {
  lines.push(`${selectors.sort().join(",\n")} { ${body}; }`);
}

lines.push("", "/* Inline rich-text colors (React writes these as style attributes, hence !important) */");
for (const value of [...inlineText].sort()) {
  const c = parseColor(value);
  const mapped = c && darkText(c);
  if (!mapped) continue;
  // React normalises to "rgb(r, g, b)"; the static HTML may omit the space after the colon.
  lines.push(`[data-theme="dark"] [style*="--framer-text-color: ${value}"],\n[data-theme="dark"] [style*="--framer-text-color:${value}"] { --framer-text-color: ${mapped} !important; }`);
}

lines.push("", "/* Framer variant text colors (--extracted-*), set inline and animated between variants */");
for (const entry of [...extractedVars].sort()) {
  const [name, value] = entry.split("|");
  const c = parseColor(value);
  const mapped = c && darkText(c);
  if (!mapped) continue;
  lines.push(`[data-theme="dark"] [style*="${name}: ${value}"] { ${name}: ${mapped} !important; }`);
}

fs.writeFileSync(outFile, lines.join("\n") + "\n");
console.log(`wrote ${path.relative(root, outFile)}: ${classRules.size} class rules, ${inlineText.size} inline colors, ${extractedVars.size} variant colors scanned`);
