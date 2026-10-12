// Light/dark theme. Loaded as a blocking script in <head> so the theme is set before first paint.
// Follows the OS setting until the visitor picks a theme with the toggle; that choice is remembered.
(() => {
  const storageKey = "theme";
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
  const root = document.documentElement;
  const toggles = new Set();

  function readStored() {
    try {
      const value = localStorage.getItem(storageKey);
      return value === "light" || value === "dark" ? value : null;
    } catch {
      return null;
    }
  }

  function writeStored(value) {
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      // Storage can be blocked (private mode, disabled cookies); the choice then lasts for this page only.
    }
  }

  let stored = readStored();
  const current = () => stored || (systemDark.matches ? "dark" : "light");

  function syncFavicons(theme) {
    for (const link of document.querySelectorAll('link[rel~="icon"][data-theme-icon]')) {
      link.href = link.dataset[theme === "dark" ? "darkHref" : "lightHref"];
    }
  }

  function apply() {
    const theme = current();
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    for (const button of toggles) {
      // The nav rebuilds itself on resize, so drop toggles that have left the page.
      if (button.isConnected) syncToggle(button, theme);
      else toggles.delete(button);
    }
    syncFavicons(theme);
  }

  function syncToggle(button, theme) {
    const dark = theme === "dark";
    button.setAttribute("aria-pressed", String(dark));
    button.title = dark ? "Switch to light mode" : "Switch to dark mode";
  }

  // The button's name stays "Dark mode"; aria-pressed carries the state, so screen readers hear "Dark mode, toggle button, pressed".
  function createToggle(className = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `theme-toggle ${className}`.trim();
    button.setAttribute("aria-label", "Dark mode");
    button.innerHTML = `
      <svg class="theme-toggle-icon theme-toggle-sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="4.2"></circle>
        <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"></path>
      </svg>
      <svg class="theme-toggle-icon theme-toggle-moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M20.2 14.6A8.3 8.3 0 0 1 9.4 3.8a8.3 8.3 0 1 0 10.8 10.8Z"></path>
      </svg>`;
    button.addEventListener("click", () => {
      stored = current() === "dark" ? "light" : "dark";
      writeStored(stored);
      apply();
    });
    toggles.add(button);
    syncToggle(button, current());
    return button;
  }

  systemDark.addEventListener("change", () => {
    if (!stored) apply();
  });
  // Keep other open tabs in step.
  window.addEventListener("storage", (event) => {
    if (event.key !== storageKey) return;
    stored = readStored();
    apply();
  });

  apply();
  document.addEventListener("DOMContentLoaded", () => syncFavicons(current()));

  window.siteTheme = { createToggle, current };
})();
