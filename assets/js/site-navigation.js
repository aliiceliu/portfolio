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
      /* Sit above the cat chatbot (.mc-root, z-index 2147483000). */
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
        background: #fff;
        border-bottom: 1px solid rgba(0, 0, 0, .08);
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
        color: #8c8c8c;
        cursor: pointer;
      }
      .site-mobile-menu-trigger:hover,
      .site-mobile-menu-trigger:focus-visible { color: #222; }
      .site-mobile-menu-trigger:focus-visible { outline: 2px solid #8c8c8c; outline-offset: 2px; }
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
        background: #fff;
        font-family: Poppins, sans-serif;
      }
      .site-mobile-menu[hidden] { display: none; }
      .site-mobile-menu a {
        display: block;
        padding: 0;
        color: #8c8c8c;
        font-size: 15px;
        font-weight: 500;
        line-height: 30px;
        letter-spacing: -0.2px;
        text-decoration: none;
      }
      .site-mobile-menu a:hover,
      .site-mobile-menu a:focus-visible,
      .site-mobile-menu a[aria-current="page"] { color: #000; }
      .site-mobile-menu a:focus-visible { outline: 2px solid #8c8c8c; outline-offset: 2px; }
      @media (min-width: 901px) {
        .site-mobile-header, .site-mobile-menu { display: none !important; }
      }
      .mc-root:not(.static) {
        bottom: calc(12px + env(safe-area-inset-bottom, 0px)) !important;
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
      ["Resume", "https://drive.google.com/file/d/10OwSysfJ5Ad-Htz0iCXrmG625JjAbVpe/view?usp=sharing"],
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

  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    window.setTimeout(() => {
      scanScheduled = false;
      syncHeader();
    }, 0);
  }

  new MutationObserver(scheduleScan).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  document.addEventListener("click", handleLocalNavigation, true);
  window.addEventListener("popstate", scheduleScan);
  window.addEventListener("hashchange", scheduleScan);
  window.matchMedia("(max-width: 900px)").addEventListener("change", scheduleScan);
  // Pages restored from the back/forward cache could otherwise come back with the menu open.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) closeMobileMenu?.();
  });
  scheduleScan();
})();
