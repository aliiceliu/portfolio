(() => {
  const localRoutes = new Map([
    ["/", "./index.html"],
    ["/index", "./index.html"],
    ["/index.html", "./index.html"],
    ["/about", "./about.html"],
    ["/about.html", "./about.html"],
    ["/play", "./play.html"],
    ["/play.html", "./play.html"],
    ["/respulse", "./respulse.html"],
    ["/respulse.html", "./respulse.html"],
    ["/questionnaire", "./questionnaire.html"],
    ["/questionnaire.html", "./questionnaire.html"],
    ["/urban-design-system", "./urban-design-system.html"],
    ["/urban-design-system.html", "./urban-design-system.html"],
  ]);

  // The site may be served from a subfolder (e.g. GitHub Pages project sites); this script lives at <root>/assets/js/.
  const siteRootPath = new URL("../../", document.currentScript?.src || location.href).pathname;

  let scanScheduled = false;
  let localHeader = null;
  let mobileHeader = null;
  let mobileCleanup = null;
  let sourceHeader = null;
  let sourceSignature = "";
  let closeMobileMenu = null;
  let savedOverflow = null;
  let floatingToggle = null;

  function createThemeToggle(className) {
    return window.siteTheme?.createToggle(className) ?? null;
  }

  // Pages without the site nav (the password screens) still need a way to switch themes.
  function syncFloatingToggle() {
    const hasNav = Boolean(localHeader?.isConnected || mobileHeader?.isConnected);
    if (hasNav && floatingToggle) {
      floatingToggle.remove();
      floatingToggle = null;
    } else if (!hasNav && !floatingToggle?.isConnected) {
      addStyles();
      floatingToggle = createThemeToggle("theme-toggle-floating");
      if (floatingToggle) document.body.append(floatingToggle);
    }
  }

  // The cat chatbot is fixed to the bottom corner. Reserve that much room at the end of the page so
  // scrolling to the bottom always leaves the last content (the footer notes) above the cat.
  let observedCat = null;
  const catResizeObserver = new ResizeObserver(() => syncCatClearance());
  function syncCatClearance() {
    const cat = document.querySelector(".mc-root:not(.static) .mc-cat");
    // "Shrink" in the chat resizes the cat without adding or removing elements.
    if (cat !== observedCat) {
      if (observedCat) catResizeObserver.unobserve(observedCat);
      if (cat) catResizeObserver.observe(cat);
      observedCat = cat;
    }
    const clearance = cat ? Math.ceil(cat.offsetHeight + parseFloat(getComputedStyle(cat.parentElement).bottom) + 16) : 0;
    const value = `${clearance}px`;
    if (document.documentElement.style.getPropertyValue("--cat-clearance") !== value) {
      document.documentElement.style.setProperty("--cat-clearance", value);
    }
  }

  // Stop the page behind the open mobile menu from scrolling.
  function setScrollLocked(locked) {
    const root = document.documentElement;
    const body = document.body;
    if (locked && !savedOverflow) {
      savedOverflow = [root.style.overflow, body.style.overflow];
      root.style.overflow = "hidden";
      body.style.overflow = "hidden";
    } else if (!locked && savedOverflow) {
      [root.style.overflow, body.style.overflow] = savedOverflow;
      savedOverflow = null;
    }
  }

  function addStyles() {
    if (document.getElementById("site-local-navigation-styles")) return;

    const style = document.createElement("style");
    style.id = "site-local-navigation-styles";
    style.textContent = `
      nav.framer-xMBmL[data-local-header-replaced="true"] { display: none !important; }
      /* Sit above the cat chatbot (.mc-root, z-index 2147483000). The Play album's photo viewer
         (.pa-lb, 2147483602) sits above this so its close button stays reachable. */
      .site-mobile-header {
        position: fixed;
        z-index: 2147483601;
        top: 0;
        left: 0;
        display: flex;
        align-items: center;
        width: 100vw;
        height: 56px;
        padding: 0;
        box-sizing: border-box;
        background: var(--site-bg, #fff);
        border-bottom: 1px solid var(--site-hairline, rgba(0, 0, 0, .08));
        font-family: Poppins, sans-serif;
      }
      .site-mobile-header[data-open="true"] { border-bottom-color: transparent; }
      .site-mobile-menu-trigger {
        display: grid;
        place-items: center start;
        width: 48px;
        height: 44px;
        padding: 0 0 0 16px;
        border: 0;
        background: transparent;
        color: var(--site-nav-text, #8c8c8c);
        cursor: pointer;
      }
      .site-mobile-menu-trigger:hover,
      .site-mobile-menu-trigger:focus-visible { color: var(--site-nav-text-strong, #222); }
      .site-mobile-menu-trigger:focus-visible { outline: 2px solid var(--site-focus, #8c8c8c); outline-offset: 2px; }
      .site-mobile-menu-icon { display: grid; gap: 5px; width: 24px; }
      .site-mobile-menu-icon span { display: block; height: 1px; background: currentColor; transition: transform .16s ease; }
      .site-mobile-header[data-open="true"] .site-mobile-menu-icon span:first-child { transform: translateY(3px) rotate(45deg); }
      .site-mobile-header[data-open="true"] .site-mobile-menu-icon span:last-child { transform: translateY(-3px) rotate(-45deg); }
      .site-mobile-menu {
        position: fixed;
        z-index: 2147483600;
        inset: 0;
        width: 100vw;
        height: 100vh;
        height: 100dvh;
        max-height: 100dvh;
        overflow-y: auto;
        overscroll-behavior: contain;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: flex-start;
        gap: 36px;
        padding: 77px 26px 32px;
        box-sizing: border-box;
        background: var(--site-bg, #fff);
        font-family: Poppins, sans-serif;
      }
      .site-mobile-menu[hidden] { display: none; }
      .site-mobile-menu a {
        display: block;
        padding: 0;
        color: var(--site-nav-text, #8c8c8c);
        font-size: 15px;
        font-weight: 500;
        line-height: 30px;
        letter-spacing: -0.2px;
        text-decoration: none;
      }
      .site-mobile-menu a:hover,
      .site-mobile-menu a:focus-visible,
      .site-mobile-menu a[aria-current="page"] { color: var(--site-nav-text-strong, #000); }
      .site-mobile-menu a:focus-visible { outline: 2px solid var(--site-focus, #8c8c8c); outline-offset: 2px; }
      .site-mobile-header .theme-toggle { margin-left: auto; margin-right: 6px; }
      nav[data-site-local-header] .theme-toggle {
        position: absolute;
        top: 50%;
        right: 24px;
        transform: translateY(-50%);
      }
      .theme-toggle.theme-toggle-floating {
        position: fixed;
        z-index: 2147483601;
        top: 12px;
        right: 12px;
      }
      @media (min-width: 901px) {
        .site-mobile-header, .site-mobile-menu { display: none !important; }
      }
      .mc-root:not(.static) {
        bottom: calc(12px + env(safe-area-inset-bottom, 0px)) !important;
      }
      #main { padding-bottom: var(--cat-clearance, 0px); }
      /* Next/Previous Project card at the end of the case studies (tagged by markProjectCards). */
      /* Hover (and keyboard focus): the card lifts with a soft shadow. Its Framer wrapper clips to the
         card's exact box, so that one wrapper is opened up (tagged by markProjectCards) to give the lift
         room. The wrappers above clip at the card's sides, so the shadow is tucked underneath (negative
         spread) instead of spreading sideways. */
      .project-card-frame { overflow: visible !important; }
      .project-card {
        border-radius: 12px;
        transition: transform .3s cubic-bezier(.2, .8, .2, 1), box-shadow .3s ease;
      }
      @media (hover: hover) {
        .project-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 16px 24px -12px rgba(20, 20, 20, .38), 0 3px 8px -4px rgba(20, 20, 20, .14);
        }
        [data-theme="dark"] .project-card:hover { box-shadow: 0 16px 24px -12px rgba(0, 0, 0, .8), 0 0 0 1px var(--c-border-strong); }
      }
      :focus-visible > .project-card,
      :focus-visible .project-card { outline: 2px solid var(--site-focus, #8c8c8c); outline-offset: 4px; }
      @media (prefers-reduced-motion: reduce) {
        .project-card { transition: box-shadow .3s ease; }
        .project-card:hover { transform: none; }
      }
    `;
    document.head.append(style);
  }

  function localHref(href) {
    if (!href || href.startsWith("#") || /^(?:https?:|mailto:|tel:|javascript:)/i.test(href)) return null;

    let url;
    try {
      url = new URL(href, location.href);
    } catch {
      return null;
    }

    if (url.origin !== location.origin) return null;
    // Framer emits root-absolute routes like "/about"; also accept paths under the site folder.
    const path = url.pathname.startsWith(siteRootPath) ? `/${url.pathname.slice(siteRootPath.length)}` : url.pathname;
    const destination = localRoutes.get(path);
    if (!destination) return null;

    const destinationPath = new URL(destination, location.href).pathname;
    if (url.hash && destinationPath === location.pathname) return url.hash;
    return `${destination}${url.search}${url.hash}`;
  }

  function getSourceHeader() {
    return document.querySelector("nav.framer-xMBmL:not([data-site-local-header])");
  }

  function headerSignature(header) {
    const links = [...header.querySelectorAll("a")]
      .map((link) => `${link.innerText.trim()}=${link.getAttribute("href")}`)
      .join("|");
    return `${header.className}|${header.innerText.trim()}|${links}`;
  }

  function mountLocalHeader(source) {
    addStyles();

    const clone = source.cloneNode(true);
    clone.removeAttribute("data-local-header-replaced");
    clone.setAttribute("data-site-local-header", "true");
    clone.setAttribute("aria-label", "Site navigation");
    const toggle = createThemeToggle();
    if (toggle) clone.append(toggle);

    for (const link of clone.querySelectorAll("a")) {
      const destination = localHref(link.getAttribute("href"));
      if (destination) link.setAttribute("href", destination);
    }

    source.setAttribute("data-local-header-replaced", "true");
    source.parentNode.insertBefore(clone, source);
    localHeader = clone;
    sourceHeader = source;
    sourceSignature = headerSignature(source);
  }

  function mountMobileHeader(source) {
    addStyles();

    const header = document.createElement("header");
    header.className = "site-mobile-header";
    header.setAttribute("aria-label", "Site navigation");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "site-mobile-menu-trigger";
    button.setAttribute("aria-label", "Open navigation");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "site-mobile-menu");
    button.innerHTML = '<span class="site-mobile-menu-icon" aria-hidden="true"><span></span><span></span></span>';

    const menu = document.createElement("nav");
    menu.id = "site-mobile-menu";
    menu.className = "site-mobile-menu";
    menu.setAttribute("aria-label", "Main navigation");
    menu.hidden = true;

    const menuItems = [
      ["Work", "./index.html"],
      ["About", "./about.html"],
      ["Play", "./play.html"],
      ["Resume", "./assets/Resume_Alice_Liu.pdf"],
    ];
    for (const [label, href] of menuItems) {
      const link = document.createElement("a");
      link.href = href;
      link.textContent = label;
      if (href.startsWith("./") && new URL(href, location.href).pathname === location.pathname) {
        link.setAttribute("aria-current", "page");
      }
      menu.append(link);
    }

    header.append(button);
    const toggle = createThemeToggle();
    if (toggle) header.append(toggle);
    // Mount on <body> so Framer's stacking contexts can't put the header under the menu.
    document.body.append(header);
    source.setAttribute("data-local-header-replaced", "true");
    document.body.append(menu);

    const abortController = new AbortController();
    function setMenuOpen(expanded) {
      menu.hidden = !expanded;
      header.dataset.open = String(expanded);
      button.setAttribute("aria-expanded", String(expanded));
      button.setAttribute("aria-label", expanded ? "Close navigation" : "Open navigation");
      setScrollLocked(expanded);
    }
    function closeMenu() {
      setMenuOpen(false);
    }

    button.addEventListener("click", () => {
      setMenuOpen(menu.hidden);
    });
    menu.addEventListener("click", (event) => {
      if (event.target.closest?.("a[href]")) closeMenu();
    });
    document.addEventListener("pointerdown", (event) => {
      if (!header.contains(event.target) && !menu.contains(event.target)) closeMenu();
    }, { capture: true, signal: abortController.signal });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    }, { signal: abortController.signal });

    mobileHeader = header;
    closeMobileMenu = closeMenu;
    mobileCleanup = () => {
      closeMenu();
      closeMobileMenu = null;
      abortController.abort();
      menu.remove();
      header.remove();
    };
    sourceHeader = source;
    sourceSignature = headerSignature(source);
  }

  function syncHeader() {
    const source = getSourceHeader();
    if (!source) {
      if (localHeader && !localHeader.isConnected) {
        localHeader = null;
        sourceHeader = null;
        sourceSignature = "";
      }
      if (mobileHeader && !mobileHeader.isConnected) {
        mobileCleanup?.();
        mobileHeader = null;
        mobileCleanup = null;
        sourceHeader = null;
        sourceSignature = "";
      }
      return;
    }

    const mobile = window.matchMedia("(max-width: 900px)").matches;
    if (mobile) {
      localHeader?.remove();
      localHeader = null;
      if (mobileHeader?.isConnected && source === sourceHeader) {
        normalizeLocalLinks();
        return;
      }
      mobileCleanup?.();
      mobileHeader = null;
      source.removeAttribute("data-local-header-replaced");
      mountMobileHeader(source);
      normalizeLocalLinks();
      return;
    }

    if (mobileHeader) {
      mobileCleanup?.();
      mobileHeader = null;
      mobileCleanup = null;
      source.removeAttribute("data-local-header-replaced");
    }

    const signature = headerSignature(source);
    if (localHeader?.isConnected && source === sourceHeader && signature === sourceSignature) {
      normalizeLocalLinks();
      return;
    }

    localHeader?.remove();
    source.removeAttribute("data-local-header-replaced");
    mountLocalHeader(source);
    normalizeLocalLinks();
  }

  // The Next/Previous Project card is a video inside a link, exported with different class names per
  // page and breakpoint; find it from its label so one style can give it a hover state.
  function markProjectCards() {
    for (const label of document.querySelectorAll("p, h2, h3")) {
      if (!/^(next|previous) project$/i.test(label.textContent.trim())) continue;
      let section = label.parentElement;
      for (let i = 0; i < 4 && section && !section.querySelector("video"); i += 1) section = section.parentElement;
      const card = section?.querySelector("video")?.parentElement;
      if (card && card.closest("a[href], [data-nested-link]")) {
        card.classList.add("project-card");
        card.parentElement.classList.add("project-card-frame");
      }
    }
  }

  function normalizeLocalLinks() {
    for (const link of document.querySelectorAll("a[href], [data-nested-link][href]")) {
      const destination = localHref(link.getAttribute("href"));
      if (destination && destination !== link.getAttribute("href")) link.setAttribute("href", destination);
    }
  }

  function handleLocalNavigation(event) {
    const link = event.target.closest?.("a[href], [data-nested-link][href]");
    if (!link) return;

    const destination = localHref(link.getAttribute("href"));
    if (!destination) return;

    // This capture listener stops propagation, so the menu's own click handler never sees local links.
    closeMobileMenu?.();
    event.preventDefault();
    event.stopImmediatePropagation();
    location.assign(new URL(destination, location.href).href);
  }

  // "↑ Back to top" buttons. Framer exported them as different things per page (a link that reloads
  // Home, section-anchor jumps on the case studies), so every one is handled here the same way:
  // one smooth scroll to the very top, without touching the URL.
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let backToTopFrame = 0;

  function findBackToTop(target) {
    // Every Framer "Back to top" button is a layer with this name.
    const named = target.closest?.('[data-framer-name="back to top asset"]');
    if (named) return named;
    // Fallback for buttons added later. The case studies' Next Project card is a link that also wraps
    // the Back to top button, so a link only counts when it holds nothing but the label.
    const control = target.closest?.("a[href], button, [data-nested-link]");
    if (control && !control.querySelector("img, video, picture, svg, [data-framer-background-image-wrapper]")
      && /^\W*back to top\W*$/i.test(control.textContent.trim())) return control;
    return null;
  }

  function stopBackToTop() {
    cancelAnimationFrame(backToTopFrame);
    backToTopFrame = 0;
    for (const type of ["wheel", "touchstart", "keydown"]) window.removeEventListener(type, stopBackToTop);
  }

  function scrollToTop() {
    stopBackToTop();
    if (reduceMotion.matches) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    const startY = window.scrollY;
    // Long pages take a little longer, but never more than a second.
    const duration = Math.min(1000, Math.max(450, startY / 8));
    const startTime = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    // The visitor can take over by scrolling or pressing a key.
    for (const type of ["wheel", "touchstart", "keydown"]) window.addEventListener(type, stopBackToTop, { passive: true });
    const step = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      // Aims at 0 rather than a section, so images loading mid-scroll can't leave it short of the top.
      window.scrollTo({ top: startY * (1 - ease(progress)), behavior: "instant" });
      if (progress < 1) backToTopFrame = requestAnimationFrame(step);
      else stopBackToTop();
    };
    backToTopFrame = requestAnimationFrame(step);
  }

  function handleBackToTop(event) {
    if (!(event.target instanceof Element) || event.target.closest(".mc-root")) return;
    if (!findBackToTop(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    scrollToTop();
  }

  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    window.setTimeout(() => {
      scanScheduled = false;
      syncHeader();
      markProjectCards();
      syncFloatingToggle();
      syncCatClearance();
    }, 0);
  }

  new MutationObserver(scheduleScan).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  // Registered first so a "Back to top" link is never treated as a page navigation.
  document.addEventListener("click", handleBackToTop, true);
  document.addEventListener("click", handleLocalNavigation, true);
  window.addEventListener("popstate", scheduleScan);
  window.addEventListener("hashchange", scheduleScan);
  window.matchMedia("(max-width: 900px)").addEventListener("change", scheduleScan);
  // The cat scales with the viewport width.
  window.addEventListener("resize", scheduleScan);
  // Pages restored from the back/forward cache could otherwise come back with the menu open.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) closeMobileMenu?.();
  });
  scheduleScan();
})();
