// Microinteractions in the "maker's scrapbook" spirit (styles in assets/css/delight.css):
//  - the pencil cursor on paper props is pure CSS.
//  - Smiskis: on desktop, hovering a sticky note on the About page swaps the pointer for a Smiski.
//  - click stamps: on desktop, clicking empty space pops a little sticker that fades after ~1.5s.
//    Clicks on links, buttons, images, text, form fields or anything draggable are never stamped.
(() => {
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  // The site uses the system cursor. An older cached copy of Framer's runtime may still switch on its
  // custom-cursor mode, which hides the real cursor via this class; keep it off.
  // (Only touch the class when it's present: classList.remove always rewrites the attribute,
  // which would retrigger the observer forever.)
  const keepSystemCursor = () => {
    if (document.body.classList.contains("framer-cursor-none")) document.body.classList.remove("framer-cursor-none");
  };
  keepSystemCursor();
  new MutationObserver(keepSystemCursor).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  // ---------- Smiskis on the About cards ----------
  // Each sticky note on the About page has its own Smiski that replaces the pointer while hovering it.
  const smiskis = [
    { card: ".framer-fcQlC .framer-3slkwa", src: "./assets/media/6XyhtEblYP6bF6Zqf3TbesozaI.png", size: 87 }, // Why Design: thinking
    { card: ".framer-fcQlC .framer-1ps5ot5", src: "./assets/media/fXylVfAdIcGJaHuhE8Mr1Exyo7s.png", size: 119 }, // Work: laptop
    { card: ".framer-fcQlC .framer-1lkq3pr", src: "./assets/media/ffgb4NepLR7xxUdDwjatG4hBhFo.png", size: 112 }, // Out-of-Office
    { card: ".framer-fcQlC .framer-1759w0l", src: "./assets/media/62Q6ieNGx8R3apfTdqrvkglWs0.png", size: 127 }, // Education: presenting
  ];
  const smiskiCards = smiskis.map(({ card }) => card).join(", ");
  const forcedColors = window.matchMedia("(forced-colors: active)");
  let smiski = null;
  let activeSmiski = null;

  function showSmiski(entry, x, y) {
    if (!smiski?.isConnected) {
      smiski = document.createElement("img");
      smiski.className = "smiski-cursor";
      smiski.alt = "";
      smiski.setAttribute("aria-hidden", "true");
      smiski.draggable = false;
      document.body.append(smiski);
    }
    if (entry !== activeSmiski) {
      activeSmiski = entry;
      smiski.src = entry.src;
      smiski.style.width = `${entry.size}px`;
    }
    smiski.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    smiski.classList.add("is-visible");
    document.documentElement.classList.add("smiski-hover");
  }

  function hideSmiski() {
    smiski?.classList.remove("is-visible");
    document.documentElement.classList.remove("smiski-hover");
  }

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || !finePointer.matches || forcedColors.matches) return hideSmiski();
    const card = event.target instanceof Element && event.target.closest(smiskiCards);
    const entry = card && smiskis.find(({ card: selector }) => card.matches(selector));
    if (entry) showSmiski(entry, event.clientX, event.clientY);
    else hideSmiski();
  }, { passive: true });
  document.documentElement.addEventListener("mouseleave", hideSmiski);
  window.addEventListener("blur", hideSmiski);
  // Load the drawings before the first hover so they don't pop in late.
  if (document.querySelector(".framer-fcQlC") || location.pathname.includes("about")) {
    for (const { src } of smiskis) new Image().src = src;
  }

  // ---------- Click stamps ----------
  const outline = 'stroke="#222" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"';
  const stickers = [
    // heart
    `<svg viewBox="0 0 32 32"><path d="M16 27 C6 20 3 14.5 5.2 10.2 C7.4 6 12.8 6 16 10.6 C19.2 6 24.6 6 26.8 10.2 C29 14.5 26 20 16 27 Z" fill="#ec4242" ${outline}/><path d="M9.5 11.5 q1.4 -2 3.4 -1.6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/></svg>`,
    // star
    `<svg viewBox="0 0 32 32"><path d="M16 3.5 L19.6 11.4 L28.2 12.3 L21.7 18.1 L23.6 26.6 L16 22.2 L8.4 26.6 L10.3 18.1 L3.8 12.3 L12.4 11.4 Z" fill="#ffd24a" ${outline}/><circle cx="13.3" cy="16" r="1.1" fill="#222"/><circle cx="18.7" cy="16" r="1.1" fill="#222"/><path d="M14.4 18.6 q1.6 1.3 3.2 0" fill="none" stroke="#222" stroke-width="1.2" stroke-linecap="round"/></svg>`,
    // sparkle
    `<svg viewBox="0 0 32 32"><path d="M16 3 C17 11 21 15 29 16 C21 17 17 21 16 29 C15 21 11 17 3 16 C11 15 15 11 16 3 Z" fill="#9747ff" ${outline}/><path d="M26 4.5 L26.8 7.2 L29.5 8 L26.8 8.8 L26 11.5 L25.2 8.8 L22.5 8 L25.2 7.2 Z" fill="#ffd24a" stroke="#222" stroke-width="1.1" stroke-linejoin="round"/></svg>`,
    // flower
    `<svg viewBox="0 0 32 32"><g fill="#f4a3b3" ${outline}><circle cx="16" cy="8.5" r="5"/><circle cx="23.2" cy="13.7" r="5"/><circle cx="20.4" cy="22.3" r="5"/><circle cx="11.6" cy="22.3" r="5"/><circle cx="8.8" cy="13.7" r="5"/></g><circle cx="16" cy="16" r="4" fill="#ffd24a" ${outline}/></svg>`,
    // yarn ball
    `<svg viewBox="0 0 32 32"><circle cx="15" cy="16" r="10.5" fill="#8fb8de" ${outline}/><path d="M7 11 C12 13 17 19 18.5 26 M5.5 17 C11 18 15 22 16 26.4 M10 6.6 C15 9.5 21 16 24.5 22 M16.5 5.6 C20 9 23.5 13 25.4 16.8" fill="none" stroke="#222" stroke-width="1.1" stroke-linecap="round"/><path d="M25 20.5 C28 22 29.5 25 28 28" fill="none" ${outline}/></svg>`,
  ];

  // Anything a click would act on, plus areas that already have their own playful interaction.
  const interactive = [
    "a", "button", "input", "textarea", "select", "label", "summary", "video", "audio", "iframe", "img", "canvas",
    "[role=button]", "[role=tab]", "[role=link]", "[role=dialog]", "[contenteditable]", "[tabindex]:not([tabindex='-1'])",
    "[draggable=true]",
    ".mc-root", ".theme-toggle", ".site-mobile-header", ".site-mobile-menu", ".case-study-local-nav",
    ".ah-sticker", ".ah-note", ".ah-sheet", ".pa-root", "[data-framer-name='Sticky note']",
  ].join(",");

  function isOverText(x, y) {
    let node = null;
    if (document.caretPositionFromPoint) node = document.caretPositionFromPoint(x, y)?.offsetNode;
    else if (document.caretRangeFromPoint) node = document.caretRangeFromPoint(x, y)?.startContainer;
    if (!node || node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) return false;
    const range = document.createRange();
    range.selectNodeContents(node);
    return [...range.getClientRects()].some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
  }

  let layer = null;
  let down = null;
  let lastSticker = -1;

  document.addEventListener("pointerdown", (event) => {
    down = event.pointerType === "mouse" && event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
  }, { passive: true, capture: true });

  document.addEventListener("click", (event) => {
    if (!finePointer.matches || !down) return;
    const { clientX: x, clientY: y } = event;
    const dragged = Math.hypot(x - down.x, y - down.y) > 6;
    down = null;
    if (dragged || event.detail > 1 || event.defaultPrevented) return;
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!window.getSelection()?.isCollapsed) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(interactive)) return;
    // Anything with its own cursor (pointer, grab, the pencil on paper, text fields) isn't empty space.
    if (getComputedStyle(target).cursor !== "auto") return;
    if (isOverText(x, y)) return;
    stamp(x, y);
  });

  function stamp(x, y) {
    if (!layer?.isConnected) {
      layer = document.createElement("div");
      layer.className = "stamp-layer";
      layer.setAttribute("aria-hidden", "true");
      document.body.append(layer);
    }
    while (layer.childElementCount >= 8) layer.firstElementChild.remove();
    const el = document.createElement("div");
    el.className = "stamp";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.setProperty("--stamp-rot", `${Math.round(Math.random() * 36 - 18)}deg`);
    // Never the same sticker twice in a row.
    lastSticker = (lastSticker + 1 + Math.floor(Math.random() * (stickers.length - 1))) % stickers.length;
    el.innerHTML = stickers[lastSticker];
    el.addEventListener("animationend", () => el.remove(), { once: true });
    layer.append(el);
  }
})();
