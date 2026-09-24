import type { Segment } from '../content/Segment';

/** Nội dung truyền vào builder: chuỗi cố định hoặc mảng segment. */
export type SegmentInput = string | readonly Segment[];

/** Chuẩn hoá nội dung thành mảng segment; chuỗi cố định thành 1 segment `text`. */
export function toSegments(content: SegmentInput): readonly Segment[] {
  return typeof content === 'string' ? [{ text: content }] : content;
}
