/** Giữ 8 bit thấp của mã ký tự, tức đúng 1 byte. */
const BYTE_MASK = 0xff;

/**
 * Đổi chuỗi nhị phân (1 ký tự = 1 byte, 0-255) thành byte. Không giải mã UTF-8 vì như vậy mọi byte >= 0x80 sẽ bị
 * đọc thành ký tự nhiều byte và hỏng.
 */
export function binaryStringToBytes(source: string): Uint8Array {
  const bytes = new Uint8Array(source.length);
  // eslint-disable-next-line no-bitwise -- giữ đúng 1 byte cho mỗi ký tự
  for (let index = 0; index < source.length; index++) bytes[index] = source.charCodeAt(index) & BYTE_MASK;
  return bytes;
}
