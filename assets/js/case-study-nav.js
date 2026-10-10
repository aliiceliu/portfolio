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
      @media (min-width: 1360px) {
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
          color: #8c8c8c;
          font: 500 13px/1.35 Poppins, sans-serif;
          text-decoration: none;
          cursor: pointer;
        }
        .case-study-local-nav__dot {
          flex: none;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(43, 41, 38, .32);
        }
        .case-study-local-nav a:focus-visible {
          outline: 2px solid rgba(43, 41, 38, .4);
          outline-offset: 2px;
        }
      }
      @media (max-width: 1359px) {
        .case-study-local-nav { display: none !important; }
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
    window.removeEventListener("resize", activeMount.scheduleUpdate);
    activeMount.nav.remove();
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
      link.append(dot, document.createTextNode(label));
      linkList.append(link);
      return link;
    });
    nav.append(linkList);
    document.body.append(nav);

    const legacyElements = [...document.querySelectorAll(config.legacySelector)];
    legacyElements.forEach((element) => element.setAttribute("data-local-nav-replaced", "true"));
    document.documentElement.dataset.caseStudyScroll = "true";

    function updateLinkAppearance(link) {
      const isCurrent = link.dataset.current === "true";
      const isHovered = link.dataset.hover === "true";
      link.style.setProperty("color", isCurrent ? "#000" : isHovered ? "#666" : "#8c8c8c", "important");
      link.style.setProperty("font-weight", isCurrent ? "700" : "500", "important");
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
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    nav.addEventListener("click", scheduleUpdate);
    activeMount = { config, items, nav, legacyElements, scheduleUpdate };
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
