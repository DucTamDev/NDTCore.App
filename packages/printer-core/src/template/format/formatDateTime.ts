/** Các token pattern hỗ trợ; `yyyy` đứng trước `yy` để khớp token dài trước. */
const DATETIME_TOKEN_PATTERN = /yyyy|yy|dd|MM|HH|mm|ss/g;

/** Số chữ số tối thiểu của token 2 chữ số (`dd`, `MM`, `HH`...). */
const TWO_DIGIT_WIDTH = 2;

/** Lấy 2 chữ số cuối của năm cho token `yy`. */
const SHORT_YEAR_MODULO = 100;

type TokenFormatter = (date: Date) => string;

// Dùng giờ địa phương của thiết bị: máy POS và trình duyệt preview cùng múi giờ cửa hàng.
const TOKEN_FORMATTERS: Readonly<Record<string, TokenFormatter>> = {
  yyyy: (date) => String(date.getFullYear()),
  yy: (date) => padTwoDigits(date.getFullYear() % SHORT_YEAR_MODULO),
  MM: (date) => padTwoDigits(date.getMonth() + 1),
  dd: (date) => padTwoDigits(date.getDate()),
  HH: (date) => padTwoDigits(date.getHours()),
  mm: (date) => padTwoDigits(date.getMinutes()),
  ss: (date) => padTwoDigits(date.getSeconds()),
};

/** Format ngày giờ theo pattern. Input là chuỗi ISO 8601 hoặc số epoch ms. */
export function formatDateTime(value: unknown, pattern: string): string {
  const date = toDate(value);
  return pattern.replace(DATETIME_TOKEN_PATTERN, (token) =>
    TOKEN_FORMATTERS[token](date)
  );
}

function toDate(value: unknown): Date {
  const date =
    typeof value === 'string' || typeof value === 'number'
      ? new Date(value)
      : undefined;
  if (date === undefined || Number.isNaN(date.getTime())) {
    throw new Error(
      `Giá trị "${String(value)}" không phải ngày giờ hợp lệ (cần chuỗi ISO 8601 hoặc epoch ms)`
    );
  }
  return date;
}

function padTwoDigits(value: number): string {
  return String(value).padStart(TWO_DIGIT_WIDTH, '0');
}
