import { initGallery } from "./src/gallery/index.js";
import { initEntryGate } from "./src/puzzle/entryGate.js";
import { getAvailablePuzzleImages } from "./src/puzzle/imageManifest.js";

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const images = getAvailablePuzzleImages();
  const gallery = initGallery({
    root: document.getElementById("gallery-root"),
    images,
  });

  initEntryGate({
    onSolved: () => gallery.activate(),
  });
}
