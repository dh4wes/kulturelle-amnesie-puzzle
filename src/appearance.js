const SITE_FALLBACK_URL = "https://webauftritt.vercel.app";
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
    const fontId = payload?.appearance?.fontId;

    if (typeof fontId !== "string" || fontId === "system") {
      applySystemFont();
      return;
    }

    applySelectedFont(siteBaseUrl, fontId);
  } catch (error) {
    console.warn("[appearance] Failed to load site appearance.", error);
  }
}
