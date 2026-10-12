---
name: predeploy-audit
description: Pre-deployment audit for Alice's portfolio site, in two parts, visual and functional. Use before committing or deploying site changes, or when asked to "audit", "check before deploy", or run "/predeploy-audit visual|functional". Reports problems first, then asks which to fix.
---

# Pre-deploy audit

Two parts, run separately or together:

- **visual**: text sizes, duplicate content, layout overflow, card consistency, contrast in light and dark, hover states, mascot size, and a full-page screenshot gallery.
- **functional**: console and network errors, links, Next Project cards, Back to top, phone menu, theme toggle, password gate, the Play photo viewer, mascot bubbles, Smiski cursors, cache busting, bundle copies, script syntax and the generated dark-theme CSS.

Arguments: `visual`, `functional`, or nothing (both, visual first). Page names after the part limit the visual run, e.g. `visual about.html`.

## The one rule

**Report first, fix only after asking.** Never edit a file during the audit. Present the findings, then ask which ones to fix.

## Steps

1. **Setup** (once per machine): run `npm install` in the project root so `playwright-core` is available. If no Chromium is found, run `npx playwright-core install chromium`.
2. **Password**: the case studies are locked. Run with `AUDIT_PASSWORD` set. If you don't know it, ask the user; never write it into a file or commit it.
3. **Run** the requested part(s) from the project root:
   - `AUDIT_PASSWORD=… caffeinate -i npm run audit:visual` (about 5–10 minutes)
   - `AUDIT_PASSWORD=… caffeinate -i npm run audit:functional` (about 5–10 minutes)

   Run them in the background and wait for the completion notice. A non-zero exit only means errors were found. `caffeinate -i` (macOS) keeps the Mac awake: if it sleeps mid-run, page loads freeze and come back as "timed out" errors. Those aren't site problems; re-run the affected pages (`npm run audit:visual -- page.html`). `AUDIT_DEBUG=1` prints how long each visual step takes.
4. **Read the report**: `audit-reports/<timestamp>-<part>/report.md` (`findings.json` has the same data).
5. **Visual only: look at the screenshots yourself.** The scripts can't judge taste. Open the phone (390) and dark screenshots of each page in `screenshots/` and look for things like:
   - overlapping elements
   - odd gaps or misaligned blocks
   - images that failed or are cropped badly
   - anything that looks unlike the rest of the site

   Add what you find as your own findings. `gallery.html` is for the user to skim.

   Full-page screenshots draw fixed elements (the cat, its bubbles, the nav) once, at a spot that doesn't match any real scroll position. So an overlap with one of them in a full-page shot is not evidence. Before reporting it, reproduce it in a normal viewport-sized screenshot at the relevant scroll position; for example, scroll to the bottom on a 390×844 phone.
6. **Verify before reporting.** For each error or warning, confirm it's real: open the page at that width, or read the code. Drop false positives, and say which ones you dropped and why. If something is intentional, suggest adding it to `allow` in `audit.config.json` with a `why`.
7. **Report to the user**, grouped by part, then by severity:
   - **Errors**: broken or clearly wrong.
   - **Warnings**: probably wrong, needs a decision.
   - **Info**: FYI, and only if relevant.

   For each finding, give the page and width, what's wrong in plain words, and the likely fix in one line. End with the checks that passed, as one line.
8. **Ask what to fix** with AskUserQuestion, multiSelect, one option per finding or group of related findings (at most 4 options per question). Put the recommended ones first. Include "None for now".
9. **Fix only what was chosen**, then:
   - bump `?v=` on every page for each edited CSS/JS file referenced with `?v=`;
   - edit both copies of a Framer bundle (`X.mjs` and `X-<hash>.js`);
   - when page CSS changes, edit both the HTML's inline style and the bundle's CSS string; the HTML copy is what's used, but they must agree;
   - re-run `npm run build:theme` if any Framer color changed;
   - re-run the part that covers the fix, and report the before/after.

## Site facts the checks depend on

- Pages are a static Framer export. Most content of the locked case studies is rendered from JS bundles in `assets/js/`, not the HTML.
- Hand-written behavior lives in:
  - `site-navigation.js`: nav, Back to top, project-card tagging
  - `delight.js` / `delight.css`: pencil cursor, click stamps, Smiskis
  - `mascot.js` / `mascot.css`: the cat
  - `theme.js` / `theme.css`: dark mode
- Phone width is under 810px. Tablet is 810–1199px. Desktop is 1200px and up.
- On phones, case study body text is 14px.
- If the audit says the Smiski card classes are missing after a Framer re-export, update `aboutCards` in `audit.config.json` and `smiskis` in `delight.js` together.

## Adding a check

Put it in `scripts/visual.mjs` (how it looks) or `scripts/functional.mjs` (what it does), using `report.add(check, "error"|"warning"|"info", where, detail)` and `report.pass(check, where)`. When a bug is fixed that a check would have caught, add that check here so it can't come back.
