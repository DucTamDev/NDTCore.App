import type { CurrencyFormat, CurrencySymbol } from '../content/ValueFormat';
import { formatNumber } from './formatNumber';

/** Ký hiệu tiền tệ mặc định khi `CurrencyFormat.symbol` bỏ trống. */
const DEFAULT_CURRENCY_SYMBOL: CurrencySymbol = 'đ';

/** Format số tiền theo vi-VN, VD `45.000đ`, `45.000 VND`. */
export function formatCurrency(
  value: number,
  format: CurrencyFormat
): string {
  const amount = formatNumber(value, format.decimals ?? 0);
  const symbol = format.symbol ?? DEFAULT_CURRENCY_SYMBOL;
  if (symbol === '') return amount;

  // Ký hiệu dạng chữ cần khoảng trắng; ký hiệu 1 ký tự viết liền theo thói quen hoá đơn VN.
  return symbol === 'VND' ? `${amount} ${symbol}` : `${amount}${symbol}`;
}
