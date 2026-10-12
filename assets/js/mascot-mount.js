// Mounts Miam Miam (the cat chat) on pages where Framer didn't place it: the case studies and their
// password screens. Uses the same component and settings as the Home page.
import { n as initReactDom, r as createRoot, d as createElement } from "./react.iNMCLRE--641ec93c.js";
import { n as initCatChat, t as CatChat } from "./Miam_miam_chat.BvtybjM2-62b17f0c.js";

const props = {
  accent: "rgb(164, 69, 44)",
  bottomGap: 58,
  catSize: 88,
  customFaqs: [],
  edge: 20,
  feedbackEmail: "",
  feedbackEnabled: true,
  feedbackUrl: "",
  footerText: "Made with Claude <3",
  greeting: "Hey there, I'm Miam Miam.",
  returnGreeting: "Welcome back!",
  side: "right",
  startOpen: false,
  teaser: "Psst. Tap me to see what Alice is building!",
  timeGreeting: true,
};

function mount() {
  if (document.querySelector(".mc-root")) return; // the page already has the cat
  initReactDom();
  initCatChat();
  const host = document.createElement("div");
  host.id = "mascot-host";
  document.body.append(host);
  createRoot(host).render(createElement(CatChat, props));
}

// Let Framer hydrate the page first so the two React roots don't compete during load.
if (document.readyState === "complete") setTimeout(mount, 0);
else window.addEventListener("load", () => setTimeout(mount, 0), { once: true });
