import type { TextFormat } from '../content/ValueFormat';

/** Format chuỗi: đổi hoa/thường rồi cắt theo `maxLength` (đếm theo ký tự, không theo byte). */
export function formatText(value: unknown, format: TextFormat): string {
  const text = applyTransform(String(value), format.transform);
  if (format.maxLength === undefined) return text;
  return Array.from(text).slice(0, format.maxLength).join('');
}

function applyTransform(
  text: string,
  transform: TextFormat['transform']
): string {
  if (transform === 'upper') return text.toUpperCase();
  if (transform === 'lower') return text.toLowerCase();
  return text;
}
