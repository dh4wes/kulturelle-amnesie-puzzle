# Kulturelle Amnesie Puzzle Gate

This repository ships a lightweight site with a full-screen entry-gate sliding puzzle that opens into a walkable 3D gallery built with `three.js`.

## Puzzle images

Puzzle source images live in [`public/puzzle-images/`](/Users/danyel-ii/coding_practice/kulturelle-amnesie-puzzle/public/puzzle-images). The current image list is declared in [`src/puzzle/imageManifest.js`](/Users/danyel-ii/coding_practice/kulturelle-amnesie-puzzle/src/puzzle/imageManifest.js) and is served at runtime from `/puzzle-images/...`.

Supported source formats are `.jpg`, `.jpeg`, `.png`, and `.webp`.

## Random image selection

On every full document load, the entry gate picks one image at random from the manifest. It does not reopen during the same in-memory app session because the gate sets a window-scoped session flag after the puzzle is solved.

If the number of discovered images does not match the expected count, the app logs a developer-facing warning and still uses the available assets.

The gallery itself uses the available manifest images as framed works on the room walls.

## Runtime puzzle generation

The puzzle is generated directly from the chosen source image at runtime:

1. The app loads the selected image in the browser.
2. It center-crops the image to a square using canvas.
3. The cropped square becomes the master image for all tile backgrounds.
4. The board is shuffled by applying valid moves from the solved state, which guarantees a solvable puzzle and avoids starting in a solved state.

If an image fails to load, the app retries with another available image before giving up and skipping the gate.

## Grid size

The default grid is `4x4`. Screens under `480px` switch to `3x3` for usability. This is controlled in [`src/puzzle/entryGate.js`](/Users/danyel-ii/coding_practice/kulturelle-amnesie-puzzle/src/puzzle/entryGate.js) via the `MOBILE_MEDIA` breakpoint and in the `shuffleBoard(size)` call.

## Disable or restyle the gate

To disable the gate later, remove the `initEntryGate()` call in [`main.js`](/Users/danyel-ii/coding_practice/kulturelle-amnesie-puzzle/main.js) or short-circuit `initEntryGate()` in [`src/puzzle/entryGate.js`](/Users/danyel-ii/coding_practice/kulturelle-amnesie-puzzle/src/puzzle/entryGate.js).

To restyle it, update the design tokens and gate classes in [`styles.css`](/Users/danyel-ii/coding_practice/kulturelle-amnesie-puzzle/styles.css). The walkable room is initialized from [`src/gallery/index.js`](/Users/danyel-ii/coding_practice/kulturelle-amnesie-puzzle/src/gallery/index.js) and movement/layout logic lives in [`src/gallery/logic.js`](/Users/danyel-ii/coding_practice/kulturelle-amnesie-puzzle/src/gallery/logic.js).

## Walkable gallery

After the puzzle is solved, the overlay animates away and the site drops into a first-person 3D gallery room. Controls:

1. `W A S D` to move.
2. `Left` and `Right` arrow keys or `Q E` to turn.
3. On touch devices, use the on-screen movement buttons.

## Development

Run the Vite dev server:

```bash
npm start
```

Build the production bundle:

```bash
npm run build
```

Run the lightweight logic tests:

```bash
npm test
```
