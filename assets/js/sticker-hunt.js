// Sticker hunt (styles in assets/css/sticker-hunt.css). Six stickers hide on Home, About and Play, one
// per page per theme: a "day" set in light mode and a glow-in-the-dark "night" set in dark mode.
//  - Each sits faint (about a quarter visible) until the mouse comes near: day stickers fade in and curl a corner up,
//    night stickers glow. On touch screens they curl or pulse now and then instead.
//  - Clicking one peels it off and sends it to Miam Miam, who counts it.
//  - Found stickers join Home's sticker sheet (its hunt row), where they can be dragged around like the
//    rest; the sheet component reads the same storage and listens for "sticker-hunt:change".
// Progress is remembered per browser. The sheet's Reset only returns stickers to the sheet.
(() => {
  const storageKey = "sticker-hunt-found";
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const nearRadius = 220; // px from the sticker's center where it starts to react
  const size = 52;

  // Drawn on the sticker sheet's own 80x80 grid and outline, so found stickers match the originals.
  const line = 'stroke="#222" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"';
  const glow = "#dcffe8"; // night stickers are pale glow-in-the-dark plastic
  const art = {
    sun: `<svg viewBox="0 0 80 80" aria-hidden="true" focusable="false">
      <g ${line} stroke-width="3"><path d="M40 6v9M40 65v9M6 40h9M65 40h9M16 16l6.5 6.5M57.5 57.5L64 64M16 64l6.5-6.5M57.5 22.5L64 16" fill="none"/></g>
      <circle cx="40" cy="40" r="18" fill="#ffd24a" ${line}/>
      <path d="M33 38 Q35 40.5 37 38 M43 38 Q45 40.5 47 38 M35.5 45 Q40 49 44.5 45" fill="none" ${line}/>
      <path d="M29 31 C30 28 33 26 35 26" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
    </svg>`,
    cloud: `<svg viewBox="0 0 80 80" aria-hidden="true" focusable="false">
      <path d="M22 58 C12 58 8 50 12 43 C14 39 18 37 22 38 C22 28 30 21 39 22 C46 23 51 28 53 34 C56 32 61 32 65 35 C71 40 70 50 64 55 C62 57 59 58 56 58 Z" fill="#e8f1ff" ${line}/>
      <path d="M32 45 Q34 47.5 36 45 M44 45 Q46 47.5 48 45" fill="none" ${line}/>
      <path d="M26 38 C27 33 31 29 35 28" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
    </svg>`,
    loaf: `<svg viewBox="0 0 80 80" aria-hidden="true" focusable="false">
      <path d="M12 44 C10 30 22 20 40 20 C58 20 70 30 68 44 C67 50 63 52 62 52 L62 62 C62 64 60 66 58 66 L22 66 C20 66 18 64 18 62 L18 52 C17 52 13 50 12 44 Z" fill="#e7b77a" ${line}/>
      <path d="M28 30 L33 38 M39 28 L44 36 M50 30 L55 38" fill="none" ${line}/>
      <path d="M20 36 C21 31 25 27 30 25" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
    </svg>`,
    moon: `<svg viewBox="0 0 80 80" aria-hidden="true" focusable="false">
      <path d="M50 10 C30 11 15 27 15 46 C15 64 30 73 45 71 C59 70 69 61 71 51 C65 56 56 57 49 54 C36 48 33 30 41 18 C44 14 47 11 50 10 Z" fill="${glow}" ${line}/>
      <path d="M32 43 Q36 46.5 40 43" fill="none" ${line}/>
      <path d="M56 19 h7 l-7 8 h7" fill="none" ${line}/>
    </svg>`,
    star: `<svg viewBox="0 0 80 80" aria-hidden="true" focusable="false">
      <path d="M40 7 L49 29 L73 31 L55 46 L61 70 L40 57 L19 70 L25 46 L7 31 L31 29 Z" fill="${glow}" ${line}/>
      <path d="M31 40 Q34 43 37 40 M43 40 Q46 43 49 40 M36.5 48 Q40 51 43.5 48" fill="none" ${line}/>
    </svg>`,
    croissant: `<svg viewBox="0 0 80 80" aria-hidden="true" focusable="false">
      <path d="M6 59 C6 31 22 15 40 15 C58 15 74 31 74 59 C66 51 55 47 40 47 C25 47 14 51 6 59 Z" fill="${glow}" ${line}/>
      <path d="M23 21 C27 31 27 40 25 49 M40 15 C42 26 42 37 40 47 M57 21 C53 31 53 40 55 49" fill="none" ${line}/>
    </svg>`,
  };
  const names = { sun: "sun", cloud: "cloud", loaf: "bread loaf", moon: "sleepy moon", star: "sleepy star", croissant: "croissant moon" };
  const daySet = ["sun", "cloud", "loaf"];
  const nightSet = ["moon", "star", "croissant"];
  const order = [...daySet, ...nightSet];

  // ---------- Hiding spots ----------
  // Next to something stable on each page; each returns a top-left corner in viewport coordinates.
  const clientWidth = () => document.documentElement.clientWidth;
  const rectOf = (selector) => {
    const element = document.querySelector(selector);
    return element?.getClientRects().length ? element.getBoundingClientRect() : null;
  };
  const spots = {
    // Home: on the sticker sheet's corners (sun top-left, moon bottom-right).
    sun: () => { const r = rectOf(".ah-sheet"); return r && { left: r.left - size * 0.5, top: r.top - size * 0.55 }; },
    moon: () => { const r = rectOf(".ah-sheet"); return r && { left: r.right - size * 0.55, top: r.bottom - size * 0.45 }; },
    // About: either side of the "Find me elsewhere" footer note.
    cloud: () => { const r = rectOf(".framer-TJFvs"); return r && { left: Math.max(10, r.left - size - 28), top: r.top + r.height * 0.3 }; },
    star: () => { const r = rectOf(".framer-TJFvs"); return r && { left: Math.min(r.right + 28, clientWidth() - size - 10), top: r.top + r.height * 0.25 }; },
    // Play: either side of the album, or on its bottom corners when there's no margin.
    loaf: () => {
      const r = rectOf(".pa-cover");
      if (!r) return null;
      return r.left >= size + 40 ? { left: r.left - size - 28, top: r.top + r.height * 0.55 } : { left: r.left + 14, top: r.bottom - size - 52 };
    },
    croissant: () => {
      const r = rectOf(".pa-cover");
      if (!r) return null;
      return clientWidth() - r.right >= size + 40 ? { left: r.right + 28, top: r.top + r.height * 0.4 } : { left: r.right - size - 14, top: r.bottom - size - 52 };
    },
  };
  const path = location.pathname;
  const page = /about/.test(path) ? "about" : /play/.test(path) ? "play" : /\/(index\.html)?$/.test(path) ? "home" : null;
  const pageStickers = { home: { day: "sun", night: "moon" }, about: { day: "cloud", night: "star" }, play: { day: "loaf", night: "croissant" } }[page];

  // ---------- Progress ----------

  function found() {
    try {
      // One-time carry-over from the first, night-only version of the hunt.
      const old = localStorage.getItem("night-stickers-found");
      if (old) {
        localStorage.removeItem("night-stickers-found");
        localStorage.setItem(storageKey, JSON.stringify([...new Set([...JSON.parse(localStorage.getItem(storageKey) || "[]"), ...JSON.parse(old)])]));
      }
      const list = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(list) ? list.filter((id) => order.includes(id)) : [];
    } catch {
      return [];
    }
  }
  function saveFound(list) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(list));
    } catch {
      // Storage can be blocked; the find then only lasts for this page view.
    }
    window.dispatchEvent(new CustomEvent("sticker-hunt:change", { detail: { found: list } }));
  }

  // For the sticker sheet component (it draws found stickers with this art).
  window.stickerHunt = { art, names, order, daySet, nightSet, found };

  const theme = () => (document.documentElement.dataset.theme === "dark" ? "night" : "day");

  // ---------- The hidden sticker on this page ----------

  let sticker = null;

  function currentId() {
    return pageStickers ? pageStickers[theme()] : null;
  }

  function placeSticker() {
    if (!sticker) return;
    const spot = spots[sticker.dataset.id]();
    if (!spot) { sticker.hidden = true; return; }
    sticker.hidden = false;
    sticker.style.left = `${Math.round(spot.left + window.scrollX)}px`;
    sticker.style.top = `${Math.round(spot.top + window.scrollY)}px`;
  }

  function syncSticker() {
    const id = currentId();
    const show = id && !found().includes(id);
    if (sticker && (!show || sticker.dataset.id !== id)) {
      sticker.remove();
      sticker = null;
    }
    if (!show) return;
    if (!sticker) {
      const set = daySet.includes(id) ? "day" : "night";
      sticker = document.createElement("button");
      sticker.type = "button";
      sticker.className = `hunt-sticker hunt-sticker--${set}`;
      sticker.dataset.id = id;
      sticker.setAttribute("aria-label", `Hidden ${names[id]} sticker. Collect it`);
      sticker.innerHTML = art[id];
      sticker.style.setProperty("--near", "0");
      sticker.addEventListener("click", collect);
      // Keyboard users get the full reveal while it's focused.
      sticker.addEventListener("focus", () => sticker?.style.setProperty("--near", "1"));
      sticker.addEventListener("blur", () => sticker?.style.setProperty("--near", "0"));
      document.body.append(sticker);
    }
    sticker.classList.toggle("hunt-sticker--touch", !finePointer.matches && !reduceMotion.matches);
    placeSticker();
  }

  // How close the mouse is: 0 far away, 1 right on top of it.
  let pointer = null;
  let nearFrame = 0;
  function updateNear() {
    nearFrame = 0;
    if (!sticker || !pointer) return;
    const r = sticker.getBoundingClientRect();
    const distance = Math.hypot(pointer.x - (r.left + r.width / 2), pointer.y - (r.top + r.height / 2));
    sticker.style.setProperty("--near", Math.max(0, Math.min(1, 1 - distance / nearRadius)).toFixed(3));
  }
  window.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || !sticker) return;
    pointer = { x: event.clientX, y: event.clientY };
    if (!nearFrame) nearFrame = requestAnimationFrame(updateNear);
  }, { passive: true });

  // ---------- Collecting ----------

  function collect() {
    if (!sticker) return;
    const id = sticker.dataset.id;
    const list = [...new Set([...found(), id])];
    // Keep the cat's unprompted bubbles (e.g. "say hi" at the end of the page) from covering the count.
    window.miamMascot?.hushUnprompted?.();
    saveFound(list);

    // Peel it off and fly it to the cat.
    const flying = sticker;
    sticker = null;
    flying.disabled = true;
    const cat = document.querySelector(".mc-root .mc-cat")?.getBoundingClientRect();
    const from = flying.getBoundingClientRect();
    if (cat && !reduceMotion.matches) {
      const dx = cat.left + cat.width / 2 - (from.left + from.width / 2);
      const dy = cat.top + cat.height * 0.3 - (from.top + from.height / 2);
      Object.assign(flying.style, { position: "fixed", left: `${from.left}px`, top: `${from.top}px`, opacity: "1", filter: "none" });
      flying.animate(
        [
          { transform: "translate(0, 0) scale(1) rotate(0deg)", opacity: 1 },
          { transform: "translate(0, -16px) scale(1.2) rotate(-12deg)", opacity: 1, offset: 0.25 },
          { transform: `translate(${dx}px, ${dy}px) scale(.35) rotate(20deg)`, opacity: 0.2 },
        ],
        { duration: 750, easing: "cubic-bezier(.5, 0, .3, 1)", fill: "forwards" },
      ).onfinish = () => flying.remove();
    } else {
      flying.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" }).onfinish = () => flying.remove();
    }
    setTimeout(() => react(list, id), reduceMotion.matches ? 0 : 650);
  }

  function react(list, id, attempts = 10) {
    const cat = window.miamMascot;
    if (!cat) return;
    // If the chat is mid-greeting, wait for it to finish so the count isn't lost.
    if (document.querySelector(".mc-panel, .mc-bubble:not(.mascot-bubble)")) {
      if (attempts > 0) setTimeout(() => react(list, id, attempts - 1), 700);
      return;
    }
    const count = `(${list.length}/${order.length})`;
    const set = daySet.includes(id) ? daySet : nightSet;
    if (list.length === order.length) {
      cat.hop(3);
      cat.burst("sparkle", 3);
      setTimeout(() => cat.burst("heart", 2), 400);
      cat.say(`You found every hidden sticker! ✦ ${count}`, { duration: 5000 });
    } else if (set.every((s) => list.includes(s))) {
      cat.hop(2);
      cat.burst("sparkle", 3);
      cat.say(set === daySet ? `That's every day sticker! ☀ ${count}` : `That's every night sticker! ☾ ${count}`, { duration: 4500 });
    } else {
      cat.hop(1);
      cat.burst("sparkle", 2);
      cat.say(`Ooh, a ${names[id]} sticker! ${count}`, { duration: 3500 });
    }
  }

  // ---------- A hint, once per session, for people who haven't found any ----------

  function hint() {
    if (!pageStickers || found().length > 0) return;
    window.miamMascot?.sayOnce(
      "hunt-hint",
      theme() === "night" ? "Psst… some things glow in the dark around here ☾" : "Psst… a few stickers peeled off and are hiding around here ✦",
    );
  }

  // ---------- Keeping it in sync ----------

  new MutationObserver(syncSticker).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  window.addEventListener("resize", placeSticker);
  if ("ResizeObserver" in window) new ResizeObserver(placeSticker).observe(document.body);
  // Framer renders the anchors after load; place the sticker once they appear.
  new MutationObserver(() => { if (sticker?.hidden) placeSticker(); }).observe(document.body, { childList: true, subtree: true });

  const start = () => {
    syncSticker();
    setTimeout(placeSticker, 1500);
    setTimeout(hint, 9000);
  };
  if (document.readyState === "complete") setTimeout(start, 0);
  else window.addEventListener("load", () => setTimeout(start, 0), { once: true });
})();
