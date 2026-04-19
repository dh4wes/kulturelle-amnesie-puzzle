Kulturelle Amnesie Puzzle

This repository contains the Vite app for the sliding puzzle entry gate and the walkable gallery experience.

Project layout

- index.html: Vite HTML entry.
- src/main.js: Browser entry that wires appearance, puzzle gate, and gallery.
- src/config/: Shared constants for site URLs, wallpaper options, navigation, and gallery model assets.
- src/puzzle/: Puzzle gate logic, image manifest, and image processing.
- src/gallery/: Walkable gallery rendering and movement logic.
- public/: Static assets served at root paths.
- tests/: Node test suite for puzzle and gallery logic.

Common commands

- npm install: install dependencies.
- npm test: run unit tests.
- npm run build: create a production build.
- npm start: run the local Vite server on port 4173.
- npm run preview: preview a production build locally.

Deployment

Production deployments are handled with the Vercel CLI:

vercel --prod --yes

Notes

- Generated output belongs in dist/ and is ignored by git.
- Local Vercel metadata belongs in .vercel/ and is ignored by git.
- The AR viewer uses the GLB in public/models/ and keeps the OBJ zip as a downloadable source file.
