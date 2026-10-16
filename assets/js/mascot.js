// Miam Miam as mascot (styles in assets/css/mascot.css). Adds a layer of hand-drawn accessories to
// the cat and reacts to what the visitor does:
//  - dozes off after 20s idle, wakes with a stretch on any activity
//  - wears a nightcap in dark mode; sun sparkles when switching back to light
//  - hops with a heart on reaching the end of a page, plus the page's one unprompted bubble:
//    the next project and what it's about on case studies, a "say hi" nudge elsewhere
//  - cheers when someone clicks Email, LinkedIn or Resume
//  - on password screens, wobbles at a wrong password
// Bubbles never stack with the chat's own bubble or open panel, and an unprompted bubble is shown
// at most once per browser session.
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const IDLE_MS = 20000;

  // In the same order as the folders on the home page. Miam Miam Bakery isn't live yet, so the last
  // case study points people to Alice instead of a page.
  const caseStudies = [
    { path: "respulse", title: "ResPulse", about: "Turning a passive credit service into an engaging experience for residents." },
    { path: "urban-design-system", title: "Urban Design System", about: "Building a 0 → 1 design system for AnyoneHome's CRM." },
    { path: "questionnaire", title: "Property Onboarding", about: "Redesigning an onboarding questionnaire to cut repetitive rework." },
  ];
  const upcoming = {
    title: "Miam Miam Bakery",
    contact: "mailto:2003.liu.alice@gmail.com?subject=Miam%20Miam%20Bakery",
  };
  const currentCaseStudy = caseStudies.findIndex(({ path }) => location.pathname.includes(path));

  const ink = 'stroke="#8b4f2c" stroke-linejoin="round" stroke-linecap="round"';
  // Drawn on the cat illustration's own 360x296 grid so it lines up with the head and eyes.
  const art = `
    <svg class="mascot-art" viewBox="0 0 360 296" aria-hidden="true" focusable="false">
      <g class="mascot-eyes">
        <ellipse cx="129" cy="108" rx="19" ry="15" fill="#f7f7f6"/>
        <ellipse cx="230" cy="107" rx="21" ry="15" fill="#f7f7f6"/>
        <path d="M114 106 Q129 120 144 106 M215 105 Q230 119 245 105" fill="none" stroke="#5b3420" stroke-width="6" stroke-linecap="round"/>
      </g>
      <g class="mascot-cap" ${ink} stroke-width="7">
        <path d="M136 62 C132 22 172 -4 216 1 C258 6 292 32 312 72 L297 79 C284 56 268 50 258 60 Z" fill="#7d8fd6"/>
        <path d="M188 18 l3.5 7.5 7.5 3.5 -7.5 3.5 -3.5 7.5 -3.5 -7.5 -7.5 -3.5 7.5 -3.5 Z M244 24 l2.5 5.5 5.5 2.5 -5.5 2.5 -2.5 5.5 -2.5 -5.5 -5.5 -2.5 5.5 -2.5 Z" fill="#ffd24a" stroke-width="2.5"/>
        <rect x="124" y="50" width="150" height="24" rx="12" fill="#f8f4ee"/>
        <circle cx="305" cy="84" r="15" fill="#f8f4ee"/>
      </g>
    </svg>
    <span class="mascot-zzz"><span>z</span><span>z</span><span>Z</span></span>`;

  const fxArt = {
    heart: `<svg viewBox="0 0 32 32"><path d="M16 27 C6 20 3 14.5 5.2 10.2 C7.4 6 12.8 6 16 10.6 C19.2 6 24.6 6 26.8 10.2 C29 14.5 26 20 16 27 Z" fill="#ec4242" stroke="#8b4f2c" stroke-width="2" stroke-linejoin="round"/></svg>`,
    sparkle: `<svg viewBox="0 0 32 32"><path d="M16 3 C17 11 21 15 29 16 C21 17 17 21 16 29 C15 21 11 17 3 16 C11 15 15 11 16 3 Z" fill="#ffd24a" stroke="#8b4f2c" stroke-width="2" stroke-linejoin="round"/></svg>`,
  };

  let cat = null;
  let layer = null;
  const catObserver = new MutationObserver(syncAnimation);

  // ---------- Layer setup ----------

  function getLayer() {
    const button = document.querySelector(".mc-root .mc-cat");
    if (!button) return null;
    if (button !== cat || !layer?.isConnected) {
      cat = button;
      layer = document.createElement("span");
      layer.className = "mascot-layer";
      layer.setAttribute("aria-hidden", "true");
      layer.innerHTML = art;
      layer.dataset.cap = document.documentElement.dataset.theme === "dark" ? "on" : "off";
      cat.append(layer);
      catObserver.disconnect();
      catObserver.observe(cat, { attributes: true, attributeFilter: ["class"] });
      syncAnimation();
    }
    return layer;
  }

  // Keep the accessories in step with the drawing's bob/hop animations.
  function syncAnimation() {
    requestAnimationFrame(() => {
      const drawing = cat?.querySelector("img")?.getAnimations()[0];
      const mirror = layer?.getAnimations()[0];
      if (drawing && mirror && drawing.currentTime != null) mirror.currentTime = drawing.currentTime;
    });
  }

  // The chat portals the cat into <body> once React has rendered it.
  new MutationObserver(() => getLayer()).observe(document.body, { childList: true });
  getLayer();

  // ---------- Small building blocks ----------

  function hop(times = 2) {
    if (!getLayer() || reduceMotion.matches) return;
    cat.animate(
      [{ transform: "translateY(0)" }, { transform: "translateY(-14px) rotate(-3deg)", offset: 0.45 }, { transform: "translateY(0)" }],
      { duration: 500, iterations: times, easing: "ease-out", composite: "add" },
    );
  }

  function wobble() {
    if (!getLayer() || reduceMotion.matches) return;
    cat.animate(
      [{ transform: "rotate(0)" }, { transform: "rotate(-6deg)" }, { transform: "rotate(5deg)" }, { transform: "rotate(0)" }],
      { duration: 700, easing: "ease-in-out", composite: "add" },
    );
  }

  function stretch() {
    if (!getLayer() || reduceMotion.matches) return;
    cat.animate(
      [{ transform: "scale(1, 1)" }, { transform: "scale(1.06, .93)" }, { transform: "scale(.97, 1.06)" }, { transform: "scale(1, 1)" }],
      { duration: 550, easing: "ease-in-out", composite: "add" },
    );
  }

  // Float hearts or sparkles off the cat's head.
  function burst(kind, count = 1) {
    const host = getLayer();
    if (!host) return;
    for (let i = 0; i < count; i += 1) {
      const fx = document.createElement("span");
      fx.className = "mascot-fx";
      fx.innerHTML = fxArt[kind];
      fx.style.left = `${10 + i * 26 + Math.random() * 8}%`;
      fx.style.top = `${-22 + (i % 2) * 10}%`;
      fx.style.animationDelay = `${i * 120}ms`;
      fx.style.setProperty("--fx-rot", `${Math.round(Math.random() * 30 - 15)}deg`);
      fx.style.setProperty("--fx-dx", `${Math.round(Math.random() * 16 - 8)}px`);
      host.append(fx);
      setTimeout(() => fx.remove(), 2000 + i * 120);
    }
  }

  // ---------- Speech bubbles ----------

  let bubble = null;
  let bubbleTimer = 0;
  let unpromptedUsed = false;

  // Unprompted bubbles already shown this session, so moving between pages doesn't repeat them.
  const seenKey = "mascot-seen";
  function seen(id) {
    try {
      return JSON.parse(sessionStorage.getItem(seenKey) || "[]").includes(id);
    } catch {
      return false;
    }
  }
  function markSeen(id) {
    try {
      const ids = JSON.parse(sessionStorage.getItem(seenKey) || "[]");
      if (!ids.includes(id)) sessionStorage.setItem(seenKey, JSON.stringify([...ids, id]));
    } catch {
      // Storage can be blocked; the bubble then only stays once-per-page.
    }
  }

  function chatIsBusy() {
    return Boolean(document.querySelector(".mc-panel, .mc-bubble:not(.mascot-bubble)"));
  }

  function hideBubble() {
    clearTimeout(bubbleTimer);
    bubble?.remove();
    bubble = null;
  }

  // Shows a bubble above the cat. Returns false if the chat is already talking.
  function say(html, { duration = 5000 } = {}) {
    const root = getLayer() && cat.closest(".mc-root");
    if (!root || chatIsBusy()) return false;
    hideBubble();
    bubble = document.createElement("div");
    bubble.className = "mc-bubble mascot-bubble";
    bubble.setAttribute("role", "status");
    bubble.innerHTML = html;
    root.append(bubble);
    const schedule = () => { clearTimeout(bubbleTimer); bubbleTimer = setTimeout(hideBubble, duration); };
    // Stay up while someone is reading or tabbing to the link. Mouse only: a tap fires pointerenter
    // with no pointerleave, which would keep the bubble up for good.
    bubble.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") clearTimeout(bubbleTimer); });
    bubble.addEventListener("pointerleave", schedule);
    bubble.addEventListener("focusin", () => clearTimeout(bubbleTimer));
    bubble.addEventListener("focusout", schedule);
    schedule();
    return true;
  }

  // The page's single unprompted bubble; waits politely if the chat is mid-greeting.
  function sayOnce(id, html, attempts = 8) {
    if (unpromptedUsed || seen(id)) return;
    if (say(html, { duration: 6000 })) {
      unpromptedUsed = true;
      markSeen(id);
    } else if (attempts > 0) setTimeout(() => sayOnce(id, html, attempts - 1), 1200);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && bubble) hideBubble();
  });

  // Clicking the cat opens the chat, so the bubble gets out of the way right away.
  document.addEventListener("pointerdown", (event) => {
    if (bubble && event.target instanceof Element && event.target.closest(".mc-root .mc-cat")) hideBubble();
  }, true);
  document.addEventListener("click", (event) => {
    if (bubble && event.target instanceof Element && event.target.closest(".mc-root .mc-cat")) hideBubble();
  }, true);

  // ---------- Idle: doze off, wake with a stretch ----------

  let idleTimer = 0;
  let lastActivity = -Infinity;

  function sleep() {
    const host = getLayer();
    if (!host) return;
    if (document.hidden || document.querySelector(".mc-panel") || bubble) {
      idleTimer = setTimeout(sleep, IDLE_MS);
      return;
    }
    host.dataset.asleep = "true";
    // A sleeping cat doesn't talk: hides the chat's own greeting/teaser bubbles until it wakes.
    cat.closest(".mc-root")?.setAttribute("data-mascot-asleep", "");
  }

  function onActivity() {
    const now = performance.now();
    if (now - lastActivity < 250) return;
    lastActivity = now;
    if (layer?.dataset.asleep === "true") {
      delete layer.dataset.asleep;
      cat?.closest(".mc-root")?.removeAttribute("data-mascot-asleep");
      stretch();
    }
    clearTimeout(idleTimer);
    idleTimer = setTimeout(sleep, IDLE_MS);
  }
  for (const type of ["pointermove", "pointerdown", "keydown", "scroll", "wheel", "touchstart"]) {
    window.addEventListener(type, onActivity, { passive: true });
  }
  onActivity();

  // ---------- Dark mode: nightcap ----------

  new MutationObserver(() => {
    const host = getLayer();
    if (!host) return;
    const dark = document.documentElement.dataset.theme === "dark";
    if ((host.dataset.cap === "on") === dark) return;
    host.dataset.cap = dark ? "on" : "off";
    if (dark) wobble();
    else burst("sparkle", 3);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // ---------- Reaching the end of the page ----------

  let reachedEnd = false;

  function nearBottom() {
    const doc = document.documentElement;
    return doc.scrollHeight > window.innerHeight + 200 && window.scrollY + window.innerHeight >= doc.scrollHeight - 160;
  }

  function onEndOfPage() {
    if (reachedEnd || document.querySelector("#password-input") || !nearBottom()) return;
    reachedEnd = true;
    hop();
    burst("heart");
    if (currentCaseStudy === caseStudies.length - 1) {
      sayOnce(`end:${caseStudies[currentCaseStudy].path}`, `Next up: ${upcoming.title}, a project still in the works. <a href="${upcoming.contact}">Contact Alice to learn more →</a>`);
    } else if (currentCaseStudy >= 0) {
      const next = caseStudies[currentCaseStudy + 1];
      sayOnce(`end:${caseStudies[currentCaseStudy].path}`, `<a href="./${next.path}.html">Next up: ${next.title} →</a> ${next.about}`);
    } else {
      sayOnce("end:say-hi", "Liked what you saw? Say hi to Alice! ✉︎");
    }
  }
  window.addEventListener("scroll", onEndOfPage, { passive: true });

  // ---------- Contact & resume clicks ----------

  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element && event.target.closest("a[href]");
    if (!link || link.closest(".mascot-bubble")) return;
    const href = link.getAttribute("href") || "";
    const isResume = /resume[^/]*\.pdf$/i.test(href) || /resume/i.test(link.textContent);
    const isContact = /^mailto:|linkedin\.com/i.test(href);
    if (!isResume && !isContact) return;
    hop();
    burst("heart", 2);
    say(isResume ? "Great pick! Alice's resume is opening ✿" : "Yay! Alice would love to hear from you ✿", { duration: 4500 });
  }, true);

  // ---------- Password screens: a wobble after a wrong guess ----------

  document.addEventListener("submit", (event) => {
    if (!(event.target instanceof Element) || !event.target.querySelector("#password-input")) return;
    setTimeout(() => {
      if (document.querySelector("#password-input")) {
        wobble();
      } else {
        hideBubble();
        hop(1);
        burst("heart");
      }
    }, 350);
  }, true);

  // ---------- For other scripts (night-stickers.js) ----------
  // Lets other delights make the cat react without duplicating its bubble and animation rules.
  // hushUnprompted: the visitor is busy with something else (e.g. the sticker hunt), so skip this
  // page's unprompted bubble instead of letting it cover a reaction.
  window.miamMascot = { say, sayOnce, hop, burst, wobble, hushUnprompted: () => { unpromptedUsed = true; } };
})();
