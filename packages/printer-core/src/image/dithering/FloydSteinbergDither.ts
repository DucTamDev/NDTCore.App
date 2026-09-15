/** Floyd-Steinberg error diffusion dithering (serpentine scan). */
export function ditherFloydSteinberg(gray: Uint8Array, width: number, height: number): Uint8Array {
  const err = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) err[i] = gray[i]!;

  for (let y = 0; y < height; y++) {
    // eslint-disable-next-line no-bitwise -- parity check for serpentine scan direction
    const ltr = (y & 1) === 0;
    const xStart = ltr ? 0 : width - 1;
    const xEnd = ltr ? width : -1;
    const xStep = ltr ? 1 : -1;

    for (let x = xStart; x !== xEnd; x += xStep) {
      const idx = y * width + x;
      const oldVal = err[idx]!;
      const newVal = oldVal < 128 ? 0 : 255;
      err[idx] = newVal;
      const e = oldVal - newVal;

      const nx = x + xStep;
      if (nx >= 0 && nx < width) err[y * width + nx] += (e * 7) / 16;
      if (y + 1 < height) {
        if (x - xStep >= 0 && x - xStep < width) err[(y + 1) * width + x - xStep] += (e * 3) / 16;
        err[(y + 1) * width + x] += (e * 5) / 16;
        if (nx >= 0 && nx < width) err[(y + 1) * width + nx] += (e * 1) / 16;
      }
    }
  }

  const out = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) out[i] = err[i]! < 128 ? 0 : 255;
  return out;
}
