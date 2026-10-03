/** Loại nội dung một máy in đảm nhận. */
export const PrintKind = {
  Receipt: 'Receipt',
  Label: 'Label',
} as const;

export type PrintKind = (typeof PrintKind)[keyof typeof PrintKind];
