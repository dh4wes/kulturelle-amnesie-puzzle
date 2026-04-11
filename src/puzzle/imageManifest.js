export const EXPECTED_PUZZLE_IMAGE_COUNT = 5;

export const PUZZLE_IMAGE_MANIFEST = [
  "/puzzle-images/IMG-20251115-WA0001.jpg",
  "/puzzle-images/IMG-20251115-WA0003.jpg",
  "/puzzle-images/IMG-20251115-WA0004(1).jpg",
  "/puzzle-images/IMG-20251115-WA0005(1).jpg",
  "/puzzle-images/IMG-20251115-WA0010.jpg",
  "/puzzle-images/IMG-20251115-WA0013.jpg",
  "/puzzle-images/IMG-20251115-WA0014.jpg",
];

const IMAGE_EXTENSION_PATTERN = /\.(jpg|jpeg|png|webp)$/i;

export function getAvailablePuzzleImages(manifest = PUZZLE_IMAGE_MANIFEST) {
  return manifest.filter((path) => IMAGE_EXTENSION_PATTERN.test(path));
}

export function pickRandomPuzzleImage(images, random = Math.random) {
  if (!images.length) {
    return null;
  }

  const index = Math.floor(random() * images.length);
  return images[index];
}
