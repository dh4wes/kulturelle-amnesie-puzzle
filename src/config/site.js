export const SITE_FALLBACK_URL = "https://webauftritt.vercel.app";

export const GALLERY_WALLPAPERS = ["botanical", "damask", "art-nouveau", "icons", "custom-images"];

export function normalizeGalleryWallpaper(value) {
  return GALLERY_WALLPAPERS.includes(value) ? value : "botanical";
}
