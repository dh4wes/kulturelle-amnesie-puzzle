export const AR_MODEL_SRC = "/models/Splat_Test_textured_mesh_glb.glb";
export const AR_MODEL_SOURCE_SRC = "/models/Splat_Test_textured_mesh_obj.zip";

export const NAVIGATION_ITEMS = [
  { label: "Horch mal", href: "/featured", icon: "/icons/menu-1.png" },
  { label: "Texte/Gedichte", href: "/works", icon: "/icons/menu-2.png" },
  { label: "Projekte", href: "/archive", icon: "/icons/menu-3.png" },
  { label: "Nachrichten", href: "/guestbook", icon: "/icons/menu-4.png" },
  {
    label: "begehbare Ausstellung",
    href: "https://kulturelle-amnesie-puzzle.vercel.app/",
    icon: "/icons/menu-5.png",
  },
  { label: "Kontakt", href: "/kontakt", icon: "/icons/menu-6.png" },
  { label: "Lebenslauf", href: "/lebenslauf", icon: "/icons/menu-7.png" },
  { label: "Fragen; des Monats? des Tages?", href: "/fragen", icon: "/icons/menu-8.png" },
  { label: "Tattoo", href: "/tattoo", icon: "/icons/menu-9.png" },
];

export const MENU_ICON_PATHS = NAVIGATION_ITEMS.map((item) => item.icon);
