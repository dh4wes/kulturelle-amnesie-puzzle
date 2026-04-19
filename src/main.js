import "./styles.css";

import { applySiteAppearance } from "./appearance.js";
import { initGallery } from "./gallery/index.js";
import { initEntryGate } from "./puzzle/entryGate.js";
import { getAvailablePuzzleImages } from "./puzzle/imageManifest.js";

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const appearance = await applySiteAppearance();

  const images = getAvailablePuzzleImages();
  const gallery = initGallery({
    root: document.getElementById("gallery-root"),
    images,
    wallpaper: appearance?.galleryWallpaper,
    wallpaperColor: appearance?.galleryWallpaperColor,
    wallpaperImages: appearance?.galleryWallpaperImages,
    galleryImages: appearance?.galleryImages,
  });

  initEntryGate({
    onSolved: () => gallery.activate(),
  });
}
