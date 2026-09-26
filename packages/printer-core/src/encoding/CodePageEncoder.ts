import type { CodePage } from './CodePage';
import type { EncodingResult } from './EncodingResult';
import { CP437 } from './encoders/Cp437Encoder';
import { CP858 } from './encoders/Cp858Encoder';
import { Windows1252 } from './encoders/Windows1252Encoder';
import { CP866 } from './encoders/Cp866Encoder';
import { CP857 } from './encoders/Cp857Encoder';
import { encodeUtf8Passthrough } from './encoders/Utf8Encoder';

/** Byte thay cho ký tự không có trong code page nào: dấu '?'. */
const REPLACEMENT_BYTE = 0x3f;

/** Code page theo thứ tự ưu tiên khi tự dò. */
const CODE_PAGE_LIST: CodePage[] = [CP437, CP858, Windows1252, CP866, CP857];

/** Mọi code page đã đăng ký, theo số hiệu. */
export const CODE_PAGES: Record<number, CodePage> = Object.fromEntries(
  CODE_PAGE_LIST.map((codePage) => [codePage.id, codePage])
);

/** Bảng tra ký tự → byte của từng code page, dựng 1 lần để không phải quét `chars` cho mỗi ký tự. */
const REVERSE_INDEX: ReadonlyMap<CodePage, ReadonlyMap<string, number>> = new Map(
  CODE_PAGE_LIST.map((codePage) => [
    codePage,
    new Map(Object.entries(codePage.chars).map(([byte, char]) => [char, Number(byte)])),
  ])
);

/** Tìm code page đã đăng ký theo số hiệu. */
export function findCodePage(id: number): CodePage | undefined {
  return CODE_PAGES[id];
}

function findByte(char: string, codePages: readonly CodePage[]): { codePage: CodePage; byte: number } | null {
  for (const codePage of codePages) {
    const byte = REVERSE_INDEX.get(codePage)?.get(char);
    if (byte !== undefined) return { codePage, byte };
  }
  return null;
}

/**
 * Mã hoá chữ thành byte máy in; ký tự ngoài ASCII tra theo code page.
 *
 * Có `preferredCodePage` (đã đăng ký) thì luôn trả đúng code page đó, kể cả khi chữ toàn ASCII, để nơi gọi ép máy in
 * chuyển sang code page này. Không có thì dò theo ký tự ngoài ASCII đầu tiên; chữ toàn ASCII thì `codePage` là null.
 * Chỉ trả 1 code page cho cả chuỗi: chữ cần nhiều code page khác nhau cùng lúc thì ký tự thiếu thành '?'.
 */
export function encodeText(text: string, preferredCodePage?: number): EncodingResult {
  const forcedCodePage = preferredCodePage !== undefined ? findCodePage(preferredCodePage) : undefined;
  const searchOrder = forcedCodePage ? [forcedCodePage] : CODE_PAGE_LIST;

  const bytes: number[] = [];
  const unmappedChars: string[] = [];
  let usedCodePage: CodePage | null = forcedCodePage ?? null;

  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;

    if ((codePoint >= 0x20 && codePoint <= 0x7e) || codePoint === 0x0a || codePoint === 0x0d) {
      bytes.push(codePoint);
      continue;
    }

    const hit = findByte(char, searchOrder);
    if (hit) {
      bytes.push(hit.byte);
      if (!forcedCodePage && usedCodePage === null) usedCodePage = hit.codePage;
    } else {
      bytes.push(REPLACEMENT_BYTE);
      unmappedChars.push(char);
    }
  }

  return { bytes: new Uint8Array(bytes), codePage: usedCodePage, unmappedChars };
}

/**
 * Mã hoá chữ theo năng lực của máy in: máy nhận UTF-8 thì gửi thẳng UTF-8, không chuyển code page; ngược lại dùng
 * code page đầu tiên máy khai báo.
 */
export function encodeTextForPrinter(text: string, encoding: { nativeUtf8: boolean; codePages: number[] }): EncodingResult {
  if (encoding.nativeUtf8) {
    return { bytes: encodeUtf8Passthrough(text), codePage: null, unmappedChars: [] };
  }

  return encodeText(text, encoding.codePages[0]);
}
