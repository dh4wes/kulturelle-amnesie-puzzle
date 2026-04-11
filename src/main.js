import "./styles.css";

import { initGallery } from "./gallery/index.js";
import { initEntryGate } from "./puzzle/entryGate.js";
import { getAvailablePuzzleImages } from "./puzzle/imageManifest.js";

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
