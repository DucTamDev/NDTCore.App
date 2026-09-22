/** Options đánh dấu ngắt trang — không mang cấu hình, chỉ đánh dấu vị trí trong danh sách element. */
export type PageBreakOptions = Record<string, never>;

/** Một dấu ngắt trang — không mang cấu hình, chỉ đánh dấu vị trí trong danh sách element. */
export interface PageBreakElement {
  type: 'pageBreak';
}
