export async function loadAndCropToSquare(url, size = 1200) {
  const image = await loadImage(url);
  const squareSize = Math.min(image.naturalWidth, image.naturalHeight);
  const offsetX = (image.naturalWidth - squareSize) / 2;
  const offsetY = (image.naturalHeight - squareSize) / 2;

  // Center-crop the source image into a square before the puzzle uses it for tiles.
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  context.drawImage(
    image,
    offsetX,
    offsetY,
    squareSize,
    squareSize,
    0,
    0,
    size,
    size,
  );

  return canvas.toDataURL("image/jpeg", 0.92);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    image.src = url;
  });
}
