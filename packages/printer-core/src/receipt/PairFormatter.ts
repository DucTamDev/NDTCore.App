import { padRight } from './ReceiptFormatter';

export function formatPair(left: string, right: string, totalWidth: number): string {
  const rightLen = right.length;
  const leftLen = totalWidth - rightLen;
  if (leftLen <= 0) return right.slice(0, totalWidth);
  return padRight(left, leftLen) + right;
}
