import "./styles.css";

import { applySiteAppearance } from "./appearance.js";
import { initGallery } from "./gallery/index.js";
import { initEntryGate } from "./puzzle/entryGate.js";
import { getAvailablePuzzleImages } from "./puzzle/imageManifest.js";

if (typeof window !== "undefined" && typeof document !== "undefined") {
  void applySiteAppearance();

  const images = getAvailablePuzzleImages();
  const gallery = initGallery({
    root: document.getElementById("gallery-root"),
    images,
  });

  initEntryGate({
    onSolved: () => gallery.activate(),
  });
}
