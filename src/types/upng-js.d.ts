// `upng-js` ships no TypeScript types — declare only the surface this app
// actually calls. `encode` is only used to build fixtures in tests (real
// bill PNGs come from `react-native-view-shot`, never from `UPNG.encode`).
declare module 'upng-js' {
  interface UPNGImage {
    width: number;
    height: number;
  }

  interface UPNGStatic {
    decode(buffer: ArrayLike<number> | ArrayBuffer): UPNGImage;
    toRGBA8(image: UPNGImage): ArrayBuffer[];
    encode(
      frames: ArrayBuffer[],
      width: number,
      height: number,
      paletteSize: number,
      delays?: number[],
      forbidPalette?: boolean,
    ): ArrayBuffer;
  }

  const UPNG: UPNGStatic;
  export default UPNG;
}
