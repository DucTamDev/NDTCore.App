/**
 * Căn 1 dòng "nhãn trái ... giá trị phải" cho đúng `width` ký tự — chèn khoảng
 * trắng vào giữa, luôn giữ tối thiểu 1 khoảng cách kể cả khi `left`+`right` đã
 * đầy/vượt `width`. Dùng cho element `row` của `PrintDocument` (ESC/POS text,
 * TSPL TrueType/InternalFont).
 */
export const formatRow = (left: string, right: string, width: number): string => {
  const gap = Math.max(1, width - left.length - right.length);
  return `${left}${' '.repeat(gap)}${right}`;
};
