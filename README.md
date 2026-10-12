# Static Website Clone

This is a standalone static HTML, CSS, and JS export cloned from **https://aliceliudesign.framer.website/** using [Uncage](https://github.com/Nightteye/uncage).

## 📁 Exported Pages
- [index.html](./index.html) (Source route: `/index`)
- [about.html](./about.html) (Source route: `/about`)
- [play.html](./play.html) (Source route: `/play`)
- [respulse.html](./respulse.html) (Source route: `/respulse`)
- [questionnaire.html](./questionnaire.html) (Source route: `/questionnaire`)
- [urban-design-system.html](./urban-design-system.html) (Source route: `/urban-design-system`)

## 🚀 How to Run & Preview

### Option 1: Direct File Opening
You can open `index.html` directly in any browser (or via VS Code "Live Server" extension).

### Option 2: Local Static Server
```bash
npm run preview
# or
npx serve .
```

## 🌐 Deployment
This folder is 100% static and ready to drag-and-drop to:
- **Netlify** / **Vercel**
- **GitHub Pages**
- **Nginx / Apache** or S3 / Cloudflare Pages

## 🌗 Light & Dark Mode
The site follows the visitor's system setting until they pick a theme with the sun/moon button in the nav; that choice is remembered across pages and visits.

- `assets/js/theme.js` sets `<html data-theme>` before first paint and builds the toggle.
- `assets/css/theme.css` holds the dark palette and the hand-tuned overrides.
- `assets/css/theme-framer-dark.css` is generated from the Framer export. After re-exporting from Framer, run:

```bash
npm run build:theme
```
