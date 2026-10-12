/** Mức cỡ chữ đặt nhanh cho cả mẫu in. */
export const FontSizePreset = {
  Small: 'Small',
  Normal: 'Normal',
  Large: 'Large',
} as const;

export type FontSizePreset = (typeof FontSizePreset)[keyof typeof FontSizePreset];

/** Hệ số nhân với cỡ chữ mức `Normal`. */
export const FONT_SIZE_PRESET_SCALE: Record<FontSizePreset, number> = {
  Small: 0.85,
  Normal: 1,
  Large: 1.2,
};

/** Nhân mọi cỡ chữ theo mức, làm tròn vì ảnh in tính theo dot nguyên. */
export const scaleFontSizes = <T extends { [K in keyof T]: number }>(normal: T, preset: FontSizePreset): T => {
  const scale = FONT_SIZE_PRESET_SCALE[preset];
  const entries = Object.entries<number>(normal).map(([key, size]) => [key, Math.round(size * scale)]);
  return Object.fromEntries(entries) as T;
};
