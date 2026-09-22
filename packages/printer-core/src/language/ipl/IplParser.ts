import type { PrintParser } from '../../core';
import type { PrintElement } from '../../document/elements/PrintElement';

/**
 * Một lệnh IPL đã decode: type tag đã nhận diện và phần text params thô mà
 * nó được match ra, khớp shape `{type, params}` của portakal trong
 * `parsers/ipl.ts`.
 */
export interface IPLCommand {
  type: string;
  params: string;
}

/** Kết quả đầy đủ của việc parse một chuỗi nguồn IPL. */
export interface IPLParseResult {
  commands: IPLCommand[];
  widthDots: number;
  heightDots: number;
  elements: PrintElement[];
  warnings: string[];
}

const STX = '\x02';
const ETX = '\x03';
const ESC = '\x1b';

/** Khớp giá trị fallback trong chính parser IPL của portakal. */
const DEFAULT_WIDTH_DOTS = 832;
/** Khớp giá trị fallback trong chính parser IPL của portakal. */
const DEFAULT_HEIGHT_DOTS = 400;

/** Độ dày nét mặc định (dots) khi field `W`/`L` không mang clause `w`. */
const DEFAULT_STROKE_WEIGHT = 1;

/** Mã hướng của field `L` khi nằm ngang (clause `f` vắng mặt hoặc bằng giá trị này). */
const LINE_DIRECTION_HORIZONTAL = 0;

/**
 * Các chữ cái loại field mà parser nhận diện — `B` (barcode) chỉ được ghi
 * nhận thô thành lệnh, chưa có hằng số tương ứng trong `IplCommand.ts` vì
 * compiler chưa hỗ trợ field này.
 */
const FIELD_FRAME_TYPE_CHARS = ['H', 'B', 'L', 'W', 'G'] as const;

const ORIGIN_PATTERN = /o(-?\d+),(-?\d+)/;
const LENGTH_PATTERN = /l(\d+)/;
const HEIGHT_PATTERN = /h(\d+)/;
const WEIGHT_PATTERN = /w(\d+)/;
const DIRECTION_PATTERN = /f(\d+)/;
const TEXT_DATA_PATTERN = /d\d+,(.+)$/;

/** Tách chuỗi nguồn IPL thành các frame theo cặp `STX`/`ETX` (bỏ `STX`/`ETX` khỏi mỗi frame). */
function splitFramesByStxEtx(code: string): string[] {
  const frames: string[] = [];
  let pos = 0;
  while (pos < code.length) {
    const stxIndex = code.indexOf(STX, pos);
    if (stxIndex < 0) break;
    const etxIndex = code.indexOf(ETX, stxIndex);
    if (etxIndex < 0) {
      frames.push(code.slice(stxIndex + 1));
      break;
    }
    frames.push(code.slice(stxIndex + 1, etxIndex));
    pos = etxIndex + 1;
  }
  return frames;
}

/** Nhận diện một frame có tiền tố `ESC` — lệnh vòng đời format (`C`/`E`/`P`/`M`). */
function parseEscFrame(frame: string): IPLCommand {
  const cmdChar = frame[1];
  const params = frame.slice(2);

  switch (cmdChar) {
    case 'C':
      return { type: 'CREATE_FORMAT', params };
    case 'E':
      return { type: 'END_FORMAT', params };
    case 'P':
      return { type: 'PROGRAM_MODE', params };
    case 'M':
      return { type: 'COPIES', params };
    default:
      return { type: `ESC_${cmdChar}`, params };
  }
}

/**
 * Kết quả parse một frame cấu hình `<SI>` — `widthDots`/`heightDots` chỉ
 * có giá trị khi frame thật sự cập nhật chúng.
 */
interface ConfigFrameResult {
  command: IPLCommand;
  widthDots?: number;
  heightDots?: number;
}

/** Nhận diện một frame cấu hình `<SI>` (label length/width, speed, darkness). */
function parseConfigFrame(frame: string): ConfigFrameResult {
  const rest = frame.replace(/^<?SI>/, '');
  const key = rest[0];
  const value = rest.slice(1);

  switch (key) {
    case 'L':
      return { command: { type: 'LABEL_LENGTH', params: value }, heightDots: Number(value) || undefined };
    case 'W':
      return { command: { type: 'LABEL_WIDTH', params: value }, widthDots: Number(value) || undefined };
    case 'S':
      return { command: { type: 'SPEED', params: value } };
    case 'd':
      return { command: { type: 'DARKNESS', params: value } };
    default:
      return { command: { type: `SI_${key}`, params: value } };
  }
}

/**
 * Khôi phục một `text` element từ params của field `H`, hoặc `undefined`
 * nếu thiếu clause `o`/`d` bắt buộc.
 */
function recoverTextElement(fieldParams: string): PrintElement | undefined {
  const originMatch = fieldParams.match(ORIGIN_PATTERN);
  const dataMatch = fieldParams.match(TEXT_DATA_PATTERN);
  if (!originMatch || !dataMatch) return undefined;

  return {
    type: 'text',
    content: dataMatch[1]!,
    options: { x: Number(originMatch[1]), y: Number(originMatch[2]) },
  };
}

/**
 * Khôi phục một `box` element từ params của field `W`, hoặc `undefined`
 * nếu thiếu clause `o`/`l`/`h` bắt buộc.
 */
function recoverBoxElement(fieldParams: string): PrintElement | undefined {
  const originMatch = fieldParams.match(ORIGIN_PATTERN);
  const lengthMatch = fieldParams.match(LENGTH_PATTERN);
  const heightMatch = fieldParams.match(HEIGHT_PATTERN);
  if (!originMatch || !lengthMatch || !heightMatch) return undefined;

  const weightMatch = fieldParams.match(WEIGHT_PATTERN);

  return {
    type: 'box',
    options: {
      x: Number(originMatch[1]),
      y: Number(originMatch[2]),
      width: Number(lengthMatch[1]),
      height: Number(heightMatch[1]),
      thickness: weightMatch ? Number(weightMatch[1]) : DEFAULT_STROKE_WEIGHT,
    },
  };
}

/**
 * Khôi phục một `line` element (ngang hoặc dọc) từ params của field `L`,
 * hoặc `undefined` nếu thiếu clause `o`/`l` bắt buộc.
 */
function recoverLineElement(fieldParams: string): PrintElement | undefined {
  const originMatch = fieldParams.match(ORIGIN_PATTERN);
  const lengthMatch = fieldParams.match(LENGTH_PATTERN);
  if (!originMatch || !lengthMatch) return undefined;

  const weightMatch = fieldParams.match(WEIGHT_PATTERN);
  const directionMatch = fieldParams.match(DIRECTION_PATTERN);
  const x = Number(originMatch[1]);
  const y = Number(originMatch[2]);
  const length = Number(lengthMatch[1]);
  const thickness = weightMatch ? Number(weightMatch[1]) : DEFAULT_STROKE_WEIGHT;
  const direction = directionMatch ? Number(directionMatch[1]) : LINE_DIRECTION_HORIZONTAL;

  if (direction === LINE_DIRECTION_HORIZONTAL) {
    return { type: 'line', options: { x1: x, y1: y, x2: x + length, y2: y, thickness } };
  }
  return { type: 'line', options: { x1: x, y1: y, x2: x, y2: y + length, thickness } };
}

/**
 * Định tuyến việc khôi phục `PrintElement` theo chữ cái loại field — chỉ
 * `H`/`W`/`L` khôi phục được element, `B`/`G` chưa có logic decode nên trả
 * `undefined`.
 */
function recoverElementFromField(fieldType: string, fieldParams: string): PrintElement | undefined {
  switch (fieldType) {
    case 'H':
      return recoverTextElement(fieldParams);
    case 'W':
      return recoverBoxElement(fieldParams);
    case 'L':
      return recoverLineElement(fieldParams);
    default:
      return undefined;
  }
}

/** Kết quả parse một frame field (`H`/`B`/`L`/`W`/`G`). */
interface FieldFrameResult {
  command: IPLCommand;
  element: PrintElement | undefined;
}

/**
 * Nhận diện một frame field, tách field number khỏi phần params còn lại
 * rồi thử khôi phục `PrintElement` tương ứng.
 */
function parseFieldFrame(frame: string): FieldFrameResult {
  const fieldType = frame[0];
  const rest = frame.slice(1);

  const semiIdx = rest.indexOf(';');
  const fieldNum = semiIdx >= 0 ? rest.slice(0, semiIdx) : rest;
  const fieldParams = semiIdx >= 0 ? rest.slice(semiIdx + 1) : '';

  return {
    command: { type: `FIELD_${fieldType}`, params: `${fieldNum};${fieldParams}` },
    element: recoverElementFromField(fieldType, fieldParams),
  };
}

function isFieldFrame(frame: string): boolean {
  return FIELD_FRAME_TYPE_CHARS.some((fieldType) => frame.startsWith(fieldType));
}

/**
 * Parse mã nguồn IPL (Intermec/Honeywell) thành các lệnh có cấu trúc cộng
 * thêm việc khôi phục best-effort các `PrintElement` — port trực tiếp từ
 * `parseIPL()` của portakal (`parsers/ipl.ts`). IPL đóng khung mỗi lệnh
 * giữa `STX`/`ETX`; parser này tách theo khung đó trước, sau đó phân loại
 * mỗi frame là một lệnh vòng đời format tiền tố `ESC`, một lệnh cấu hình
 * `<SI>`, một trong các field command `H`/`B`/`L`/`W`/`G`, lệnh `R` (print)
 * trơn, hoặc `UNKNOWN`.
 */
export function parseIPL(code: string): IPLParseResult {
  const commands: IPLCommand[] = [];
  const elements: PrintElement[] = [];
  const warnings: string[] = [];
  let widthDots = DEFAULT_WIDTH_DOTS;
  let heightDots = DEFAULT_HEIGHT_DOTS;

  const frames = splitFramesByStxEtx(code);

  for (const frame of frames) {
    if (frame.startsWith(ESC)) {
      commands.push(parseEscFrame(frame));
      continue;
    }

    if (frame.startsWith('<SI>') || frame.startsWith('SI>')) {
      const configResult = parseConfigFrame(frame);
      commands.push(configResult.command);
      if (configResult.widthDots !== undefined) widthDots = configResult.widthDots;
      if (configResult.heightDots !== undefined) heightDots = configResult.heightDots;
      continue;
    }

    if (isFieldFrame(frame)) {
      const fieldResult = parseFieldFrame(frame);
      commands.push(fieldResult.command);
      if (fieldResult.element) elements.push(fieldResult.element);
      continue;
    }

    if (frame === 'R') {
      commands.push({ type: 'PRINT', params: '' });
      continue;
    }

    commands.push({ type: 'UNKNOWN', params: frame });
  }

  return { commands, widthDots, heightDots, elements, warnings };
}

/** Decode mã nguồn IPL thành các lệnh có cấu trúc. */
export class IplParser implements PrintParser<{ commands: unknown[]; warnings: string[] }> {
  parse(source: string | Uint8Array): { commands: unknown[]; warnings: string[] } {
    const code = typeof source === 'string' ? source : new TextDecoder().decode(source);
    return parseIPL(code);
  }
}
