/**
 * Downscale an image file in the browser before it is stored.
 *
 * A 6 MB phone photo as a wallpaper would eat the whole LocalStorage budget, so
 * wallpapers are re-encoded to at most `maxSize` px on the long edge as JPEG.
 * Everything happens locally in a canvas — the file never leaves the tab.
 */
export const MAX_WALLPAPER_BYTES = 8 * 1024 * 1024;

export async function compressImage(file: File, maxSize = 1920, quality = 0.82): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not an image');
  if (file.size > MAX_WALLPAPER_BYTES) throw new Error('image too large');

  const dataUrl = await readAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));

  // Small enough already and not a PNG with transparency: keep the original.
  if (scale === 1 && file.size < 400 * 1024) return dataUrl;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) return dataUrl;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  try {
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return dataUrl;
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('decode failed'));
    image.src = src;
  });
}
