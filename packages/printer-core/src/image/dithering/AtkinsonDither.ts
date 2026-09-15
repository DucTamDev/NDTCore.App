/** Atkinson dithering — propagates only 75% of the quantization error to 6 neighbors (1/8 each). */
export function ditherAtkinson(gray: Uint8Array, width: number, height: number): Uint8Array {
  const err = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) err[i] = gray[i]!;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldVal = err[idx]!;
      const newVal = oldVal < 128 ? 0 : 255;
      err[idx] = newVal;
      const e = (oldVal - newVal) / 8;

      if (x + 1 < width) err[idx + 1] += e;
      if (x + 2 < width) err[idx + 2] += e;
      if (y + 1 < height) {
        if (x - 1 >= 0) err[(y + 1) * width + x - 1] += e;
        err[(y + 1) * width + x] += e;
        if (x + 1 < width) err[(y + 1) * width + x + 1] += e;
      }
      if (y + 2 < height) {
        err[(y + 2) * width + x] += e;
      }
    }
  }

  const out = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) out[i] = err[i]! < 128 ? 0 : 255;
  return out;
}
