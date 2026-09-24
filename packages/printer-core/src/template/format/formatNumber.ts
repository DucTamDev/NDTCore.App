/** Dấu phân cách hàng nghìn theo vi-VN. */
const THOUSANDS_SEPARATOR = '.';

/** Dấu phân cách thập phân theo vi-VN. */
const DECIMAL_SEPARATOR = ',';

/** Chèn dấu phân cách trước mỗi nhóm 3 chữ số tính từ phải sang. */
const THOUSANDS_GROUP_PATTERN = /\B(?=(\d{3})+(?!\d))/g;

/** Chữ số khác 0 — dùng để biết số âm sau khi làm tròn có còn khác 0 không. */
const NON_ZERO_DIGIT_PATTERN = /[1-9]/;

/**
 * Format số theo vi-VN (`1.234.567,89`). Tự cài đặt thay vì dùng `Intl` vì `Intl` trên Hermes
 * không đồng nhất với trình duyệt, dễ làm preview web khác bản in trên máy thật.
 */
export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) throw new Error(`Không format được số "${value}"`);

  const fixed = Math.abs(value).toFixed(decimals);
  const [integerDigits, fractionDigits] = fixed.split('.');
  const grouped = integerDigits.replace(
    THOUSANDS_GROUP_PATTERN,
    THOUSANDS_SEPARATOR
  );
  const unsigned =
    fractionDigits === undefined
      ? grouped
      : `${grouped}${DECIMAL_SEPARATOR}${fractionDigits}`;

  // Số âm làm tròn về 0 (VD -0,001 với 0 chữ số thập phân) in "0", không in "-0".
  const isNegative =
    value < 0 && NON_ZERO_DIGIT_PATTERN.test(fixed);
  return isNegative ? `-${unsigned}` : unsigned;
}
