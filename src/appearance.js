import { normalizeGalleryWallpaper, SITE_FALLBACK_URL } from "./config/site.js";

const SELECTED_FONT_FAMILY = "SelectedSiteFont";
const SYSTEM_FONT_STACK =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

function getSiteBaseUrl() {
  const params = new URLSearchParams(window.location.search);
  const returnUrl = params.get("returnUrl");

  if (returnUrl) {
    try {
      return new URL(returnUrl).origin;
    } catch {
      return SITE_FALLBACK_URL;
    }
  }

  return SITE_FALLBACK_URL;
}

function getFontStyleElement() {
  const existing = document.getElementById("site-font-appearance");

  if (existing) {
    return existing;
  }

  const style = document.createElement("style");
  style.id = "site-font-appearance";
  document.head.appendChild(style);
  return style;
}

function applySystemFont() {
  const style = document.getElementById("site-font-appearance");
  style?.remove();
  document.documentElement.style.removeProperty("--font-body");
  document.documentElement.style.removeProperty("--font-display");
}

function applySelectedFont(siteBaseUrl, fontId) {
  const fontUrl = new URL("/api/appearance/font", siteBaseUrl);
  fontUrl.searchParams.set("font", fontId);

  getFontStyleElement().textContent = `@font-face{font-family:"${SELECTED_FONT_FAMILY}";src:url("${fontUrl.toString()}");font-style:normal;font-weight:400;font-display:swap;}`;

  const fontStack = `"${SELECTED_FONT_FAMILY}", ${SYSTEM_FONT_STACK}`;
  document.documentElement.style.setProperty("--font-body", fontStack);
  document.documentElement.style.setProperty("--font-display", fontStack);
}

function applyBackgroundColor(value) {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    return;
  }

  document.documentElement.style.setProperty("--site-background", value);
}

function resolveSiteAssetSrc(siteBaseUrl, value) {
  if (typeof value !== "string") {
    return "";
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/")) {
    return new URL(value, siteBaseUrl).toString();
  }

  return value;
}

function normalizeGalleryImages(siteBaseUrl, value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const input = typeof item === "object" && item ? item : {};
      const src = resolveSiteAssetSrc(siteBaseUrl, input.src);

      if (!src) {
        return null;
      }

      return {
        id: typeof input.id === "string" ? input.id : src,
        src,
        title: typeof input.title === "string" ? input.title : "Werk",
        body: typeof input.body === "string" ? input.body : "",
      };
    })
    .filter(Boolean);
}

function normalizeGalleryWallpaperImages(siteBaseUrl, value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const input = typeof item === "object" && item ? item : {};
      const src = resolveSiteAssetSrc(siteBaseUrl, input.src);

      if (!src) {
        return null;
      }

      return {
        id: typeof input.id === "string" ? input.id : src,
        src,
      };
    })
    .filter(Boolean)
    .slice(0, 4);
}

export async function applySiteAppearance() {
  const siteBaseUrl = getSiteBaseUrl();
  const appearanceUrl = new URL("/api/appearance", siteBaseUrl);

  try {
    const response = await fetch(appearanceUrl.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const appearance = payload?.appearance;
    const fontId = appearance?.fontId;

    applyBackgroundColor(appearance?.desktopBackgroundColor);

    if (typeof fontId !== "string" || fontId === "system") {
      applySystemFont();
      return {
        galleryWallpaper: normalizeGalleryWallpaper(appearance?.galleryWallpaper),
        galleryWallpaperColor: appearance?.galleryWallpaperColor,
        galleryImages: normalizeGalleryImages(siteBaseUrl, appearance?.galleryImages),
        galleryWallpaperImages: normalizeGalleryWallpaperImages(siteBaseUrl, appearance?.galleryWallpaperImages),
      };
    }

    applySelectedFont(siteBaseUrl, fontId);
    return {
      galleryWallpaper: normalizeGalleryWallpaper(appearance?.galleryWallpaper),
      galleryWallpaperColor: appearance?.galleryWallpaperColor,
      galleryImages: normalizeGalleryImages(siteBaseUrl, appearance?.galleryImages),
      galleryWallpaperImages: normalizeGalleryWallpaperImages(siteBaseUrl, appearance?.galleryWallpaperImages),
    };
  } catch (error) {
    console.warn("[appearance] Failed to load site appearance.", error);
  }

  return {
    galleryWallpaper: "botanical",
    galleryWallpaperColor: "#efe8dc",
    galleryImages: [],
    galleryWallpaperImages: [],
  };
}
