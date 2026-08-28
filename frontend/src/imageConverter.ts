/**
 * Helper to convert a standard web image to monochrome Zebra Hex format.
 */
export interface ZplImageData {
  width: number;
  height: number;
  rowBytes: number;
  totalBytes: number;
  hexString: string;
}

export function convertImageToZplHex(imgElement: HTMLImageElement): ZplImageData {
  const width = imgElement.naturalWidth || imgElement.width;
  const height = imgElement.naturalHeight || imgElement.height;

  // Create a canvas to extract image pixel data
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get 2D canvas context');
  }

  // Draw image on canvas
  ctx.drawImage(imgElement, 0, 0);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Calculate bytes per row (each pixel is 1 bit, 8 pixels per byte, rounded up)
  const rowBytes = Math.ceil(width / 8);
  const totalBytes = rowBytes * height;

  let hexString = '';

  for (let y = 0; y < height; y++) {
    let currentByte = 0;
    let bitCount = 0;

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      // Convert to grayscale
      let isBlack = false;
      if (a < 128) {
        // Transparent is treated as white (0)
        isBlack = false;
      } else {
        const grayscale = 0.299 * r + 0.587 * g + 0.114 * b;
        // Threshold: less than 128 is black
        isBlack = grayscale < 128;
      }

      if (isBlack) {
        // Set bit in byte (MSB is left-most pixel)
        currentByte |= (1 << (7 - bitCount));
      }

      bitCount++;

      if (bitCount === 8) {
        // Add byte as 2-character hex
        hexString += currentByte.toString(16).padStart(2, '0').toUpperCase();
        currentByte = 0;
        bitCount = 0;
      }
    }

    // Handle remaining bits in the row (padding with 0s)
    if (bitCount > 0) {
      hexString += currentByte.toString(16).padStart(2, '0').toUpperCase();
    }
  }

  return {
    width,
    height,
    rowBytes,
    totalBytes,
    hexString
  };
}
