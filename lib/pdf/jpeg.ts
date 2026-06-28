/**
 * Minimal JPEG header reader. We use it during PDF compression to decide whether
 * an embedded JPEG (DCTDecode) image is safe to recompress in the browser:
 * canvas can faithfully re-encode 1- (grayscale) and 3-component (YCbCr/RGB)
 * JPEGs, but mangles 4-component (CMYK/YCCK) ones, so those must be skipped.
 *
 * Reads the Start-Of-Frame (SOFn) marker for the component count and dimensions.
 * Pure and dependency-free, so it is unit-tested directly.
 */
export interface JpegInfo {
  components: number;
  width: number;
  height: number;
}

export function readJpegInfo(bytes: Uint8Array): JpegInfo | null {
  // Must start with SOI (FFD8).
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let i = 2;
  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    // Collapse fill bytes (0xFF 0xFF ...).
    let marker = bytes[i + 1];
    while (marker === 0xff && i + 2 < bytes.length) {
      i++;
      marker = bytes[i + 1];
    }
    i += 2;

    // Standalone markers without a length payload.
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (i + 1 >= bytes.length) break;

    const len = (bytes[i] << 8) | bytes[i + 1];
    if (len < 2) break;

    // SOF0..SOF15, excluding DHT (C4), JPG (C8) and DAC (CC).
    const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) {
      const p = i + 2; // skip the 2 length bytes
      if (p + 5 >= bytes.length) break;
      const height = (bytes[p + 1] << 8) | bytes[p + 2];
      const width = (bytes[p + 3] << 8) | bytes[p + 4];
      const components = bytes[p + 5];
      return { components, width, height };
    }

    i += len; // skip this segment's payload
  }
  return null;
}
