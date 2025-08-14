# Method Swatch

![Method Swatch logo](./logo.svg)

Method Swatch is a React web app that extracts refined color palettes from one or more uploaded images.

## Features
- Upload images via file picker, drag & drop, or clipboard paste.
- K‑means color quantization (3–20 colors) with Dominant, Vibrant, and Unique modes.
- Option to ignore near‑neutral colors and merge similar shades.
- Lock swatches, drag to reorder, copy HEX codes.
- Export palettes as JSON, CSS variables, or a PNG palette sheet.
- Animated transitions powered by Framer Motion and a responsive layout.

## Development
```bash
npm install
npm run dev    # starts Vite's dev server
```

## Build and Preview
Build the app with Vite; the production assets are emitted to `dist/`.

```bash
npm run build
```

Serve the built output with Vite's preview server or any static file server:

```bash
npm run preview        # preview locally
# or
npx serve dist         # example static server
```

When deploying, serve `dist/index.html`, which references the generated JavaScript
bundle, rather than `src/main.jsx`. If a custom server must serve the uncompiled
source, ensure it returns the `application/javascript` MIME type for `.jsx`
files or rename the entry file to `.js`.
