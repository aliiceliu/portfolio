(() => {
  const pageConfigs = [
    {
      key: "uds",
      route: "urban-design-system",
      navTop: 82,
      navLeft: 0,
      navWidth: "min(15vw, 216px)",
      legacySelector: ".framer-k490ak-container",
      sections: [
        ["Overview", "uds-overview"],
        ["Impact", "uds-reflections"],
        ["Challenge", "uds-challenge"],
        ["Sneak Peek", "uds-sneak-peek"],
        ["Approach", "uds-approach"],
        ["Design", "uds-design"],
        ["Pivot", "uds-pivot"],
        ["Where are we now", "uds-where-are-we-now"],
        ["Final Solution", "uds-final-solution"],
        ["Reflection", "uds-reflections-1"],
        ["What's next", "uds-whats-next"],
      ],
    },
    {
      key: "questionnaire",
      route: "questionnaire",
      navTop: 135,
      navLeft: 7,
      navWidth: "216px",
      legacySelector: ".framer-hApqU",
      sections: [
        ["Overview", "questionnaire-overview"],
        ["Impact", "uds-reflections"],
        ["Challenge", "questionnaire-challenge"],
        ["Sneak Peek", "questionnaire-sneak-peek"],
        ["Approach", "questionnaire-approach"],
        ["Design", "questionnaire-design"],
        ["Final Solution", "questionnaire-final-solution"],
        ["Reflection", "questionnaire-reflections"],
        ["What's next", "questionnaire-whats-next"],
      ],
    },
  ];
  let activeMount = null;
  let scanScheduled = false;

  function addStyles() {
    if (document.getElementById("case-study-local-nav-styles")) return;

    const style = document.createElement("style");
    style.id = "case-study-local-nav-styles";
    style.textContent = `
      /* Replaces Framer's section nav at every width; Framer's version overlapped the content on narrower windows. */
      .framer-k490ak-container[data-local-nav-replaced="true"],
      .framer-hApqU[data-local-nav-replaced="true"] { display: none !important; }
      .case-study-local-nav {
        position: fixed;
        z-index: 100;
        max-height: calc(100vh - 164px);
        overflow-y: auto;
        padding: 18px;
        box-sizing: border-box;
        background: transparent;
        font-family: Poppins, sans-serif;
      }
      .case-study-local-nav__links {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: min-content;
      }
      .case-study-local-nav a {
        display: flex;
        flex: none;
        align-items: center;
        gap: 10px;
        width: 114px;
        min-height: 32px;
        padding: 8px 10px;
        box-sizing: border-box;
        border: 0;
        border-radius: 10px;
        background: transparent;
        color: var(--case-nav-text, #8c8c8c);
        font: 500 13px/1.35 Poppins, sans-serif;
        text-decoration: none;
        cursor: pointer;
      }
      .case-study-local-nav__dot {
        flex: none;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--case-nav-dot, rgba(43, 41, 38, .32));
      }
      .case-study-local-nav a:focus-visible {
        outline: 2px solid var(--case-nav-focus, rgba(43, 41, 38, .4));
        outline-offset: 2px;
      }
      /*
       * The nav lives in the left gutter beside the content column and never overlaps it.
       * When the labeled list fits there it shows in full (see updateLayout). Otherwise
       * (narrow windows, tablets, phones) it collapses to a small strip of dots on the left
       * edge that shows reading progress; tapping it opens a drawer with the section list.
       */
      .case-study-local-nav__label { min-width: 0; }
      .case-study-local-nav__rail { display: none; }
      .case-study-local-nav[data-mode="drawer"] {
        top: 50% !important;
        left: max(4px, env(safe-area-inset-left, 0px)) !important;
        width: auto !important;
        padding: 0;
        overflow: visible;
        transform: translateY(-50%);
        z-index: 2147482000; /* above page content, below the site header and the cat */
      }
      .case-study-local-nav[data-mode="drawer"] .case-study-local-nav__links { display: none; }
      .case-study-local-nav[data-mode="drawer"] .case-study-local-nav__rail {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 7px;
        padding: 10px 6px;
        border: 0;
        border-radius: 999px;
        background: color-mix(in srgb, var(--site-bg, #fff) 88%, transparent);
        box-shadow: 0 0 0 1px var(--site-hairline, rgba(0, 0, 0, .08)), 0 4px 14px rgba(0, 0, 0, .1);
        -webkit-backdrop-filter: blur(6px);
        backdrop-filter: blur(6px);
        color: var(--case-nav-text, #707070);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .case-study-local-nav__rail:hover { color: var(--case-nav-hover, #666); }
      .case-study-local-nav__rail:focus-visible { outline: 2px solid var(--case-nav-focus, rgba(43, 41, 38, .4)); outline-offset: 2px; }
      /* The dots are the rail's only content, so they're drawn in the text color (3:1+). */
      .case-study-local-nav__rail .case-study-local-nav__dot { width: 5px; height: 5px; background: currentColor; opacity: .55; transition: transform .2s ease, opacity .2s ease; }
      .case-study-local-nav__rail .case-study-local-nav__dot[data-current="true"] { opacity: 1; color: var(--case-nav-current, #000); transform: scale(1.6); }

      /* Drawer: slides in from the left over a dimmed page. */
      .case-study-drawer { position: fixed; inset: 0; z-index: 2147483605; visibility: hidden; transition: visibility 0s .3s; }
      .case-study-drawer[data-open="true"] { visibility: visible; transition: none; }
      .case-study-drawer__backdrop { position: absolute; inset: 0; background: rgba(20, 20, 18, .35); opacity: 0; transition: opacity .3s ease; }
      .case-study-drawer[data-open="true"] .case-study-drawer__backdrop { opacity: 1; }
      .case-study-drawer__panel {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        width: min(320px, 82vw);
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: calc(20px + env(safe-area-inset-top, 0px)) 22px 28px calc(22px + env(safe-area-inset-left, 0px));
        box-sizing: border-box;
        background: var(--site-bg, #fff);
        box-shadow: 0 0 40px rgba(0, 0, 0, .18);
        font-family: Poppins, sans-serif;
        transform: translateX(-100%);
        transition: transform .3s cubic-bezier(.2, .8, .2, 1);
      }
      .case-study-drawer[data-open="true"] .case-study-drawer__panel { transform: none; }
      .case-study-drawer__close {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        margin: 0 -8px 12px auto;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: var(--case-nav-current, #000);
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
      }
      .case-study-drawer__close:hover { background: var(--site-hairline, rgba(0, 0, 0, .08)); }
      .case-study-drawer__toc { padding: 16px 12px 12px; border-radius: 14px; background: var(--case-drawer-box, rgba(0, 0, 0, .04)); }
      .case-study-drawer__title { margin: 0 0 10px 10px; color: var(--case-nav-text, #707070); font: 500 12px/1.4 ui-monospace, "SF Mono", Menlo, monospace; letter-spacing: .12em; text-transform: uppercase; }
      .case-study-drawer__toc a {
        display: block;
        padding: 9px 10px;
        border-radius: 10px;
        color: var(--case-nav-text, #707070);
        font: 500 15px/1.4 Poppins, sans-serif;
        text-decoration: none;
      }
      .case-study-drawer__toc a:hover { color: var(--case-nav-hover, #444); }
      .case-study-drawer__toc a[aria-current] { background: var(--case-drawer-current-bg, rgba(0, 0, 0, .07)); color: var(--case-nav-current, #000); font-weight: 600; }
      .case-study-drawer :focus-visible { outline: 2px solid var(--case-nav-focus, rgba(43, 41, 38, .4)); outline-offset: 2px; }
      [data-theme="dark"] .case-study-drawer { --case-drawer-box: rgba(255, 255, 255, .05); --case-drawer-current-bg: rgba(255, 255, 255, .1); }
      [data-theme="dark"] .case-study-drawer__backdrop { background: rgba(0, 0, 0, .55); }
      @media (prefers-reduced-motion: reduce) {
        .case-study-local-nav__label, .case-study-local-nav__rail .case-study-local-nav__dot,
        .case-study-drawer, .case-study-drawer__backdrop, .case-study-drawer__panel { transition: none !important; }
      }
      html[data-case-study-scroll="true"] { scroll-behavior: smooth; }
      @media (prefers-reduced-motion: reduce) {
        html[data-case-study-scroll="true"] { scroll-behavior: auto; }
      }
    `;
    document.head.append(style);
  }

  function configForLocation() {
    const path = location.pathname.toLowerCase();
    return pageConfigs.find((config) => path.includes(config.route)) || null;
  }

  function findItems(config) {
    return config.sections.map(([label, id]) => {
      const target = [...document.querySelectorAll(`[id="${id}"]`)].find((element) => {
        return getComputedStyle(element).display !== "none" && element.getClientRects().length > 0;
      });
      return target ? { label, id, target } : null;
    });
  }

  function clearCurrentMount() {
    if (!activeMount) return;
    window.removeEventListener("scroll", activeMount.scheduleUpdate);
    window.removeEventListener("resize", activeMount.handleResize);
    activeMount.closeDrawer();
    activeMount.nav.remove();
    activeMount.drawer.remove();
    activeMount.legacyElements.forEach((element) => element.removeAttribute("data-local-nav-replaced"));
    activeMount = null;
    delete document.documentElement.dataset.caseStudyScroll;
  }

  function mountLocalNav(config) {
    const items = findItems(config);
    if (items.some((item) => !item)) return;

    if (activeMount?.config.key === config.key) {
      const sameTargets = items.every((item, index) => item.target === activeMount.items[index].target);
      if (sameTargets) return;
    }
    clearCurrentMount();
    addStyles();

    const nav = document.createElement("nav");
    nav.id = "case-study-local-nav";
    nav.className = "case-study-local-nav";
    nav.dataset.page = config.key;
    nav.setAttribute("aria-label", "Case study sections");
    nav.style.top = `${config.navTop}px`;
    nav.style.left = `${config.navLeft}px`;
    nav.style.width = config.navWidth;

    const linkList = document.createElement("div");
    linkList.className = "case-study-local-nav__links";
    const links = items.map(({ label, id }) => {
      const link = document.createElement("a");
      const dot = document.createElement("span");
      dot.className = "case-study-local-nav__dot";
      dot.setAttribute("aria-hidden", "true");
      link.href = `#${id}`;
      link.setAttribute("aria-label", label);
      link.dataset.targetId = id;
      const text = document.createElement("span");
      text.className = "case-study-local-nav__label";
      text.textContent = label;
      link.append(dot, text);
      linkList.append(link);
      return link;
    });
    // Collapsed form: a strip of dots that opens the drawer.
    const rail = document.createElement("button");
    rail.type = "button";
    rail.className = "case-study-local-nav__rail";
    rail.setAttribute("aria-label", "Open table of contents");
    rail.setAttribute("aria-expanded", "false");
    rail.setAttribute("aria-controls", "case-study-drawer");
    const railDots = items.map(() => {
      const dot = document.createElement("span");
      dot.className = "case-study-local-nav__dot";
      dot.setAttribute("aria-hidden", "true");
      rail.append(dot);
      return dot;
    });
    nav.append(linkList, rail);
    document.body.append(nav);

    const drawer = document.createElement("div");
    drawer.id = "case-study-drawer";
    drawer.className = "case-study-drawer";
    drawer.innerHTML = `
      <div class="case-study-drawer__backdrop"></div>
      <div class="case-study-drawer__panel" role="dialog" aria-modal="true" aria-label="Table of contents">
        <button type="button" class="case-study-drawer__close" aria-label="Close table of contents">&times;</button>
        <nav class="case-study-drawer__toc" aria-label="Case study sections">
          <p class="case-study-drawer__title">Table of contents</p>
        </nav>
      </div>`;
    const toc = drawer.querySelector(".case-study-drawer__toc");
    const drawerLinks = items.map(({ label, id }) => {
      const link = document.createElement("a");
      link.href = `#${id}`;
      link.textContent = label;
      toc.append(link);
      return link;
    });
    document.body.append(drawer);
    const panel = drawer.querySelector(".case-study-drawer__panel");
    const closeButton = drawer.querySelector(".case-study-drawer__close");

    let drawerOpen = false;
    let savedOverflow = "";
    function openDrawer() {
      if (drawerOpen) return;
      drawerOpen = true;
      drawer.dataset.open = "true";
      rail.setAttribute("aria-expanded", "true");
      savedOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
      closeButton.focus({ preventScroll: true });
    }
    function closeDrawer({ restoreFocus = false } = {}) {
      if (!drawerOpen) return;
      drawerOpen = false;
      delete drawer.dataset.open;
      rail.setAttribute("aria-expanded", "false");
      document.documentElement.style.overflow = savedOverflow;
      if (restoreFocus) rail.focus({ preventScroll: true });
    }
    rail.addEventListener("click", openDrawer);
    closeButton.addEventListener("click", () => closeDrawer({ restoreFocus: true }));
    drawer.querySelector(".case-study-drawer__backdrop").addEventListener("click", () => closeDrawer({ restoreFocus: true }));
    drawer.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer({ restoreFocus: true });
      } else if (event.key === "Tab") {
        // Keep keyboard focus inside the open drawer.
        const focusable = [closeButton, ...drawerLinks];
        const index = focusable.indexOf(document.activeElement);
        if (event.shiftKey && index <= 0) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
        else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0].focus(); }
      }
    });
    // Close first (it unlocks scrolling), then glide to the section below the fixed phone header.
    drawerLinks.forEach((link, index) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        closeDrawer();
        const header = document.querySelector(".site-mobile-header");
        const offset = (header && header.getClientRects().length ? header.getBoundingClientRect().height : 0) + 16;
        const top = items[index].target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        history.replaceState(null, "", `#${items[index].id}`);
        scheduleUpdate();
      });
    });

    const legacyElements = [...document.querySelectorAll(config.legacySelector)];
    legacyElements.forEach((element) => element.setAttribute("data-local-nav-replaced", "true"));
    document.documentElement.dataset.caseStudyScroll = "true";

    function updateLinkAppearance(link) {
      const isCurrent = link.dataset.current === "true";
      const isHovered = link.dataset.hover === "true";
      const color = isCurrent ? "var(--case-nav-current, #000)" : isHovered ? "var(--case-nav-hover, #666)" : "var(--case-nav-text, #8c8c8c)";
      link.style.setProperty("color", color, "important");
      link.style.setProperty("font-weight", isCurrent ? "700" : "500", "important");
    }

    // The full labeled list when it clears the content column by 24px; the dots + drawer otherwise.
    function updateLayout() {
      const contentLeft = Math.min(...items.map((item) => item.target.getBoundingClientRect().left));
      nav.dataset.mode = "full";
      const linksRight = Math.max(...links.map((link) => link.getBoundingClientRect().right));
      if (linksRight + 24 > contentLeft) nav.dataset.mode = "drawer";
      else closeDrawer();
    }

    function updateActive() {
      const trigger = window.innerHeight * 0.32;
      let activeIndex = 0;

      for (let index = 0; index < items.length; index += 1) {
        if (items[index].target.getBoundingClientRect().top <= trigger) activeIndex = index;
      }
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
        activeIndex = items.length - 1;
      }

      links.forEach((link, index) => {
        if (index === activeIndex) {
          link.dataset.current = "true";
          link.setAttribute("aria-current", "location");
        } else {
          delete link.dataset.current;
          link.removeAttribute("aria-current");
        }
        updateLinkAppearance(link);
      });
      railDots.forEach((dot, index) => {
        if (index === activeIndex) dot.dataset.current = "true";
        else delete dot.dataset.current;
      });
      drawerLinks.forEach((link, index) => {
        if (index === activeIndex) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
      rail.setAttribute("aria-label", `Open table of contents (current section: ${items[activeIndex].label})`);
    }

    links.forEach((link) => {
      link.addEventListener("pointerenter", () => { link.dataset.hover = "true"; updateLinkAppearance(link); });
      link.addEventListener("pointerleave", () => { delete link.dataset.hover; updateLinkAppearance(link); });
      link.addEventListener("focus", () => { link.dataset.hover = "true"; updateLinkAppearance(link); });
      link.addEventListener("blur", () => { delete link.dataset.hover; updateLinkAppearance(link); });
    });

    let updateScheduled = false;
    function scheduleUpdate() {
      if (updateScheduled) return;
      updateScheduled = true;
      window.setTimeout(() => {
        updateScheduled = false;
        updateActive();
      }, 0);
    }
    function handleResize() {
      updateLayout();
      scheduleUpdate();
    }
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", handleResize);
    nav.addEventListener("click", scheduleUpdate);
    activeMount = { config, items, nav, drawer, closeDrawer, legacyElements, scheduleUpdate, handleResize };
    updateLayout();
    updateActive();
  }

  function scan() {
    const config = configForLocation();
    if (!config) {
      clearCurrentMount();
      return;
    }
    if (activeMount && activeMount.config.key !== config.key) clearCurrentMount();
    mountLocalNav(config);
  }

  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    window.setTimeout(() => {
      scanScheduled = false;
      scan();
    }, 0);
  }

  new MutationObserver(scheduleScan).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  window.addEventListener("popstate", scheduleScan);
  window.addEventListener("hashchange", scheduleScan);
  scheduleScan();
})();
