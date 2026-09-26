import type { PrintParser } from '../../core';
import type { PrintElement } from '../../document/elements';
import type { Rotation } from '../../types';
import { TsplFontMetrics } from './TsplFontMetrics';

/**
 * Toàn bộ lệnh TSPL/TSPL2 mà parser nhận diện.
 * Một số field (vd. `space`/`align`/`fit` của `BLOCK`) được khai báo theo ngữ pháp lệnh
 * nhưng parser hiện chưa đọc giá trị của chúng.
 */
export type TSPLCommand =
  | { cmd: 'SIZE'; widthMM: number; heightMM: number; unit: 'mm' | 'inch' | 'dot' }
  | { cmd: 'GAP'; distanceMM: number; offsetMM: number; unit: 'mm' | 'inch' | 'dot' }
  | { cmd: 'GAPDETECT'; paperLen?: number; gapLen?: number }
  | { cmd: 'BLINEDETECT'; paperLen?: number; gapLen?: number }
  | { cmd: 'AUTODETECT'; paperLen?: number; gapLen?: number }
  | { cmd: 'BLINE'; height: number; offset: number; unit: 'mm' | 'inch' | 'dot' }
  | { cmd: 'OFFSET'; distance: number; unit: 'mm' | 'inch' | 'dot' }
  | { cmd: 'SPEED'; value: number }
  | { cmd: 'DENSITY'; value: number }
  | { cmd: 'DIRECTION'; direction: 0 | 1; mirror?: 0 | 1 }
  | { cmd: 'REFERENCE'; x: number; y: number }
  | { cmd: 'SHIFT'; x?: number; y: number }
  | { cmd: 'COUNTRY'; code: string }
  | { cmd: 'CODEPAGE'; codepage: string }
  | { cmd: 'CLS' }
  | { cmd: 'FEED'; dots: number }
  | { cmd: 'BACKFEED'; dots: number }
  | { cmd: 'BACKUP'; dots: number }
  | { cmd: 'FORMFEED' }
  | { cmd: 'HOME' }
  | { cmd: 'PRINT'; sets: number; copies?: number }
  | { cmd: 'SOUND'; level: number; interval: number }
  | { cmd: 'CUT' }
  | { cmd: 'LIMITFEED'; maxLen: number; minPaper?: number; maxGap?: number; unit: 'mm' | 'inch' | 'dot' }
  | { cmd: 'SELFTEST'; page?: string }
  | { cmd: 'EOJ' }
  | { cmd: 'DELAY'; ms: number }
  | { cmd: 'DISPLAY'; params: string }
  | { cmd: 'INITIALPRINTER' }
  | { cmd: 'BAR'; x: number; y: number; width: number; height: number }
  | {
      cmd: 'BARCODE';
      x: number;
      y: number;
      type: string;
      height: number;
      readable: number;
      rotation: number;
      narrow: number;
      wide: number;
      alignment?: number;
      content: string;
    }
  | {
      cmd: 'TLC39';
      x: number;
      y: number;
      rotation: number;
      height?: number;
      narrow?: number;
      wide?: number;
      cellWidth?: number;
      cellHeight?: number;
      content: string;
    }
  | { cmd: 'BITMAP'; x: number; y: number; widthBytes: number; height: number; mode: number }
  | { cmd: 'BOX'; x: number; y: number; xEnd: number; yEnd: number; thickness: number; radius?: number }
  | { cmd: 'CIRCLE'; x: number; y: number; diameter: number; thickness: number }
  | { cmd: 'ELLIPSE'; x: number; y: number; width: number; height: number; thickness: number }
  | {
      cmd: 'CODABLOCK';
      x: number;
      y: number;
      rotation: number;
      rowHeight?: number;
      moduleWidth?: number;
      content: string;
    }
  | {
      cmd: 'DMATRIX';
      x: number;
      y: number;
      width: number;
      height: number;
      escChar?: number;
      moduleSize?: number;
      rotation?: number;
      shape?: number;
      row?: number;
      col?: number;
      content: string;
    }
  | { cmd: 'ERASE'; x: number; y: number; width: number; height: number }
  | { cmd: 'MAXICODE'; x: number; y: number; mode: number; params: string; content: string }
  | {
      cmd: 'PDF417';
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      options: string[];
      content: string;
    }
  | {
      cmd: 'AZTEC';
      x: number;
      y: number;
      rotation: number;
      size?: number;
      ecp?: number;
      flg?: number;
      menu?: number;
      multi?: number;
      rev?: number;
      content: string;
    }
  | { cmd: 'MPDF417'; x: number; y: number; rotation: number; options: string[]; content: string }
  | { cmd: 'PUTBMP'; x: number; y: number; filename: string; bpp?: number; contrast?: number }
  | { cmd: 'PUTPCX'; x: number; y: number; filename: string }
  | {
      cmd: 'QRCODE';
      x: number;
      y: number;
      ecc: string;
      cellWidth: number;
      mode: string;
      rotation: number;
      model?: string;
      mask?: string;
      content: string;
    }
  | {
      cmd: 'RSS';
      x: number;
      y: number;
      sym: string;
      rotation: number;
      pixMult: number;
      sepHt: number;
      segWidth?: number;
      linHeight?: number;
      content: string;
    }
  | { cmd: 'REVERSE'; x: number; y: number; width: number; height: number }
  | { cmd: 'DIAGONAL'; x1: number; y1: number; x2: number; y2: number; thickness: number }
  | {
      cmd: 'TEXT';
      x: number;
      y: number;
      font: string;
      rotation: number;
      xMul: number;
      yMul: number;
      alignment?: number;
      content: string;
    }
  | {
      cmd: 'BLOCK';
      x: number;
      y: number;
      width: number;
      height: number;
      font: string;
      rotation: number;
      xMul: number;
      yMul: number;
      space?: number;
      align?: number;
      fit?: number;
      content: string;
    }
  | { cmd: 'STATUS_QUERY'; type: string }
  | { cmd: 'SET'; key: string; value: string }
  | { cmd: 'DOWNLOAD'; target?: string; filename: string; size?: number }
  | { cmd: 'EOP' }
  | { cmd: 'FILES' }
  | { cmd: 'KILL'; target?: string; filename: string }
  | { cmd: 'MOVE' }
  | { cmd: 'RUN'; filename: string }
  | { cmd: 'FOR'; variable: string; start: string; end: string; step?: string }
  | { cmd: 'NEXT' }
  | { cmd: 'IF'; condition: string }
  | { cmd: 'THEN'; statement: string }
  | { cmd: 'ELSE'; statement?: string }
  | { cmd: 'ENDIF' }
  | { cmd: 'WHILE'; condition: string }
  | { cmd: 'WEND' }
  | { cmd: 'DO'; condition?: string }
  | { cmd: 'LOOP'; condition?: string }
  | { cmd: 'GOTO'; label: string }
  | { cmd: 'GOSUB'; label: string }
  | { cmd: 'RETURN' }
  | { cmd: 'END' }
  | { cmd: 'REM'; comment: string }
  | { cmd: 'LABEL'; name: string }
  | { cmd: 'INPUT'; prompt?: string; variable: string }
  | { cmd: 'OUT'; port?: string; data: string }
  | { cmd: 'OPEN'; params: string }
  | { cmd: 'CLOSE'; handle: string }
  | { cmd: 'WRITE'; handle: string; data: string }
  | { cmd: 'READ'; handle: string; variable: string }
  | { cmd: 'SEEK'; handle: string; offset: string }
  | { cmd: 'COPY'; params: string }
  | { cmd: 'BEEP' }
  | { cmd: 'ASSIGNMENT'; variable: string; value: string }
  | { cmd: 'NET'; subcommand: string; params: string }
  | { cmd: 'WLAN'; subcommand: string; params: string }
  | { cmd: 'NFC'; subcommand: string; params?: string }
  | { cmd: 'SET_GPO'; params: string }
  | { cmd: 'SET_GPI'; params: string }
  | { cmd: 'PEEL_SENSOR' }
  | { cmd: 'GETSENSOR'; params: string }
  | { cmd: 'GETSETTING'; params: string }
  | { cmd: 'UNKNOWN'; raw: string };

/** Toàn bộ kết quả parse một chuỗi nguồn TSPL/TSPL2. */
export interface TSPLParseResult {
  commands: TSPLCommand[];
  widthDots: number;
  heightDots: number;
  dpi: number;
  elements: PrintElement[];
  warnings: string[];
}

const FIXED_PARSE_DPI = 203;

function parseUnit(raw: string): { value: number; unit: 'mm' | 'inch' | 'dot' } {
  const mmMatch = raw.match(/^([\d.]+)\s*mm$/i);
  if (mmMatch) return { value: Number(mmMatch[1]), unit: 'mm' };
  const dotMatch = raw.match(/^([\d.]+)\s*dot$/i);
  if (dotMatch) return { value: Number(dotMatch[1]), unit: 'dot' };
  return { value: Number(raw), unit: 'inch' };
}

function toDotsFromUnit(value: number, unit: 'mm' | 'inch' | 'dot', dpi: number): number {
  if (unit === 'dot') return Math.round(value);
  if (unit === 'mm') return Math.round((value / 25.4) * dpi);
  return Math.round(value * dpi);
}

function splitParams(source: string): string[] {
  const params: string[] = [];
  let current = '';
  let inQuote = false;
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (character === '"') {
      inQuote = !inQuote;
      current += character;
    } else if (character === ',' && !inQuote) {
      params.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim()) params.push(current.trim());
  return params;
}

function unquote(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
  return value;
}

/**
 * Trường rotation của `TEXT`/`BLOCK` trong TSPL là text tự do nên có thể ra giá trị
 * dị dạng hoặc `NaN`; những trường hợp đó rơi về `0` thay vì một bội số hợp lệ của 90.
 */
function normalizeRotation(value: number): Rotation {
  return value === 90 || value === 180 || value === 270 ? value : 0;
}

/**
 * TSPL không đánh dấu rõ field alignment (0-3) tuỳ chọn đứng trước content cuối —
 * chỉ phân biệt được bằng cách thử parse số rồi kiểm tra có nằm trong [0,3] hay không.
 * `baseIndex` là vị trí param đầu tiên có thể là alignment; nếu không hợp lệ thì chính nó là content.
 */
function resolveTrailingAlignmentAndContent(
  params: string[],
  baseIndex: number,
): { alignment?: number; content: string } {
  if (params.length > baseIndex + 1) {
    const possibleAlignment = Number(params[baseIndex]);
    if (!Number.isNaN(possibleAlignment) && possibleAlignment >= 0 && possibleAlignment <= 3) {
      return { alignment: possibleAlignment, content: unquote(params[baseIndex + 1]) };
    }
  }
  return { content: unquote(params[baseIndex]) };
}

function parseSizeCommand(
  line: string,
  dpi: number,
): { command: Extract<TSPLCommand, { cmd: 'SIZE' }>; widthDots: number; heightDots: number } | null {
  const parts = line
    .slice('SIZE'.length)
    .trim()
    .split(',')
    .map((part) => part.trim());
  if (parts.length < 2) return null;

  const width = parseUnit(parts[0]);
  const height = parseUnit(parts[1]);
  return {
    command: { cmd: 'SIZE', widthMM: width.value, heightMM: height.value, unit: width.unit },
    widthDots: toDotsFromUnit(width.value, width.unit, dpi),
    heightDots: toDotsFromUnit(height.value, height.unit, dpi),
  };
}

function parseGapCommand(line: string): Extract<TSPLCommand, { cmd: 'GAP' }> | null {
  const parts = line
    .slice('GAP'.length)
    .trim()
    .split(',')
    .map((part) => part.trim());
  if (parts.length < 2) return null;

  const distance = parseUnit(parts[0]);
  const offset = parseUnit(parts[1]);
  return { cmd: 'GAP', distanceMM: distance.value, offsetMM: offset.value, unit: distance.unit };
}

function parseGapDetectCommand(line: string): Extract<TSPLCommand, { cmd: 'GAPDETECT' }> {
  const args = line.slice('GAPDETECT'.length).trim();
  if (!args) return { cmd: 'GAPDETECT' };
  const parts = args.split(',').map(Number);
  return { cmd: 'GAPDETECT', paperLen: parts[0], gapLen: parts[1] };
}

function parseBlineDetectCommand(line: string): Extract<TSPLCommand, { cmd: 'BLINEDETECT' }> {
  const args = line.slice('BLINEDETECT'.length).trim();
  if (!args) return { cmd: 'BLINEDETECT' };
  const parts = args.split(',').map(Number);
  return { cmd: 'BLINEDETECT', paperLen: parts[0], gapLen: parts[1] };
}

function parseAutoDetectCommand(line: string): Extract<TSPLCommand, { cmd: 'AUTODETECT' }> {
  const args = line.slice('AUTODETECT'.length).trim();
  if (!args) return { cmd: 'AUTODETECT' };
  const parts = args.split(',').map(Number);
  return { cmd: 'AUTODETECT', paperLen: parts[0], gapLen: parts[1] };
}

function parseBlineCommand(line: string): Extract<TSPLCommand, { cmd: 'BLINE' }> | null {
  const parts = line
    .slice('BLINE'.length)
    .trim()
    .split(',')
    .map((part) => part.trim());
  if (parts.length < 2) return null;

  const height = parseUnit(parts[0]);
  const offset = parseUnit(parts[1]);
  return { cmd: 'BLINE', height: height.value, offset: offset.value, unit: height.unit };
}

function parseOffsetCommand(line: string): Extract<TSPLCommand, { cmd: 'OFFSET' }> {
  const offset = parseUnit(line.slice('OFFSET'.length).trim());
  return { cmd: 'OFFSET', distance: offset.value, unit: offset.unit };
}

function parseSpeedCommand(line: string): Extract<TSPLCommand, { cmd: 'SPEED' }> {
  return { cmd: 'SPEED', value: Number(line.slice('SPEED'.length).trim()) };
}

function parseDensityCommand(line: string): Extract<TSPLCommand, { cmd: 'DENSITY' }> {
  return { cmd: 'DENSITY', value: Number(line.slice('DENSITY'.length).trim()) };
}

function parseDirectionCommand(line: string): Extract<TSPLCommand, { cmd: 'DIRECTION' }> {
  const args = line
    .slice('DIRECTION'.length)
    .trim()
    .split(',')
    .map(Number);
  return {
    cmd: 'DIRECTION',
    direction: (args[0] ?? 0) as 0 | 1,
    mirror: args.length > 1 ? (args[1] as 0 | 1) : undefined,
  };
}

function parseReferenceCommand(line: string): Extract<TSPLCommand, { cmd: 'REFERENCE' }> {
  const args = line
    .slice('REFERENCE'.length)
    .trim()
    .split(',')
    .map(Number);
  return { cmd: 'REFERENCE', x: args[0] ?? 0, y: args[1] ?? 0 };
}

function parseShiftCommand(line: string): Extract<TSPLCommand, { cmd: 'SHIFT' }> {
  const args = line
    .slice('SHIFT'.length)
    .trim()
    .split(',')
    .map(Number);
  if (args.length >= 2) return { cmd: 'SHIFT', x: args[0], y: args[1] };
  return { cmd: 'SHIFT', y: args[0] ?? 0 };
}

function parseCountryCommand(line: string): Extract<TSPLCommand, { cmd: 'COUNTRY' }> {
  return { cmd: 'COUNTRY', code: line.slice('COUNTRY'.length).trim() };
}

function parseCodepageCommand(line: string): Extract<TSPLCommand, { cmd: 'CODEPAGE' }> {
  return { cmd: 'CODEPAGE', codepage: line.slice('CODEPAGE'.length).trim() };
}

function parseFeedCommand(line: string): Extract<TSPLCommand, { cmd: 'FEED' }> {
  return { cmd: 'FEED', dots: Number(line.slice('FEED'.length).trim()) };
}

function parseBackfeedCommand(line: string): Extract<TSPLCommand, { cmd: 'BACKFEED' }> {
  return { cmd: 'BACKFEED', dots: Number(line.slice('BACKFEED'.length).trim()) };
}

function parseBackupCommand(line: string): Extract<TSPLCommand, { cmd: 'BACKUP' }> {
  return { cmd: 'BACKUP', dots: Number(line.slice('BACKUP'.length).trim()) };
}

function parsePrintCommand(line: string): Extract<TSPLCommand, { cmd: 'PRINT' }> {
  const args = line
    .slice('PRINT'.length)
    .trim()
    .split(',')
    .map(Number);
  return { cmd: 'PRINT', sets: args[0] ?? 1, copies: args.length > 1 ? args[1] : undefined };
}

function parseSoundCommand(line: string): Extract<TSPLCommand, { cmd: 'SOUND' }> {
  const args = line
    .slice('SOUND'.length)
    .trim()
    .split(',')
    .map(Number);
  return { cmd: 'SOUND', level: args[0] ?? 0, interval: args[1] ?? 1 };
}

function parseLimitFeedCommand(line: string): Extract<TSPLCommand, { cmd: 'LIMITFEED' }> {
  const parts = line
    .slice('LIMITFEED'.length)
    .trim()
    .split(',')
    .map((part) => part.trim());
  const main = parseUnit(parts[0]);
  return {
    cmd: 'LIMITFEED',
    maxLen: main.value,
    minPaper: parts.length > 1 ? Number(parts[1].replace(/\s*(mm|dot)/i, '')) : undefined,
    maxGap: parts.length > 2 ? Number(parts[2].replace(/\s*(mm|dot)/i, '')) : undefined,
    unit: main.unit,
  };
}

function parseSelfTestCommand(line: string): Extract<TSPLCommand, { cmd: 'SELFTEST' }> {
  const page = line.slice('SELFTEST'.length).trim();
  return { cmd: 'SELFTEST', page: page || undefined };
}

function parseDelayCommand(line: string): Extract<TSPLCommand, { cmd: 'DELAY' }> {
  return { cmd: 'DELAY', ms: Number(line.slice('DELAY'.length).trim()) };
}

function parseDisplayCommand(line: string): Extract<TSPLCommand, { cmd: 'DISPLAY' }> {
  return { cmd: 'DISPLAY', params: line.slice('DISPLAY'.length).trim() };
}

function parseTextCommand(
  line: string,
): { command: Extract<TSPLCommand, { cmd: 'TEXT' }>; element: PrintElement } | null {
  const params = splitParams(line.slice('TEXT '.length).trim());
  if (params.length < 7) return null;

  const x = Number(params[0]);
  const y = Number(params[1]);
  const font = unquote(params[2]);
  const rotation = Number(params[3]);
  const xMul = Number(params[4]);
  const yMul = Number(params[5]);
  const { alignment, content } = resolveTrailingAlignmentAndContent(params, 6);

  return {
    command: { cmd: 'TEXT', x, y, font, rotation, xMul, yMul, alignment, content },
    element: {
      type: 'text',
      content,
      options: { x, y, fontSize: TsplFontMetrics.nativeToFontSize(font, yMul), rotation: normalizeRotation(rotation) },
    },
  };
}

function parseBlockCommand(
  line: string,
): { command: Extract<TSPLCommand, { cmd: 'BLOCK' }>; element: PrintElement } | null {
  const params = splitParams(line.slice('BLOCK '.length).trim());
  if (params.length < 9) return null;

  const x = Number(params[0]);
  const y = Number(params[1]);
  const width = Number(params[2]);
  const height = Number(params[3]);
  const font = unquote(params[4]);
  const rotation = Number(params[5]);
  const xMul = Number(params[6]);
  const yMul = Number(params[7]);
  const content = unquote(params[params.length - 1]);

  return {
    command: { cmd: 'BLOCK', x, y, width, height, font, rotation, xMul, yMul, content },
    element: {
      type: 'text',
      content,
      options: {
        x,
        y,
        fontSize: TsplFontMetrics.nativeToFontSize(font, yMul),
        rotation: normalizeRotation(rotation),
        maxWidth: width,
      },
    },
  };
}

function parseBarcodeCommand(line: string): Extract<TSPLCommand, { cmd: 'BARCODE' }> | null {
  const params = splitParams(line.slice('BARCODE '.length).trim());
  if (params.length < 9) return null;

  const x = Number(params[0]);
  const y = Number(params[1]);
  const type = unquote(params[2]);
  const height = Number(params[3]);
  const readable = Number(params[4]);
  const rotation = Number(params[5]);
  const narrow = Number(params[6]);
  const wide = Number(params[7]);
  const { alignment, content } = resolveTrailingAlignmentAndContent(params, 8);

  return { cmd: 'BARCODE', x, y, type, height, readable, rotation, narrow, wide, alignment, content };
}

function parseBarCommand(
  line: string,
): { command: Extract<TSPLCommand, { cmd: 'BAR' }>; element: PrintElement } | null {
  const args = line
    .slice('BAR '.length)
    .trim()
    .split(',')
    .map(Number);
  if (args.length < 4) return null;

  const [x, y, width, height] = args;
  return {
    command: { cmd: 'BAR', x, y, width, height },
    element: {
      type: 'line',
      options: {
        x1: x,
        y1: y,
        x2: x + (width > height ? width : 0),
        y2: y + (height > width ? height : 0),
        thickness: Math.min(width, height),
      },
    },
  };
}

function parseBoxCommand(
  line: string,
): { command: Extract<TSPLCommand, { cmd: 'BOX' }>; element: PrintElement } | null {
  const args = line
    .slice('BOX '.length)
    .trim()
    .split(',')
    .map(Number);
  if (args.length < 5) return null;

  const [x, y, xEnd, yEnd, thickness, radius] = args;
  return {
    command: { cmd: 'BOX', x, y, xEnd, yEnd, thickness, radius },
    element: { type: 'box', options: { x, y, width: xEnd - x, height: yEnd - y, thickness, radius } },
  };
}

function parseCircleCommand(
  line: string,
): { command: Extract<TSPLCommand, { cmd: 'CIRCLE' }>; element: PrintElement } | null {
  const args = line
    .slice('CIRCLE '.length)
    .trim()
    .split(',')
    .map(Number);
  if (args.length < 4) return null;

  const [x, y, diameter, thickness] = args;
  return {
    command: { cmd: 'CIRCLE', x, y, diameter, thickness },
    element: { type: 'circle', options: { x, y, diameter, thickness } },
  };
}

function parseEllipseCommand(line: string): Extract<TSPLCommand, { cmd: 'ELLIPSE' }> | null {
  const args = line
    .slice('ELLIPSE '.length)
    .trim()
    .split(',')
    .map(Number);
  if (args.length < 5) return null;

  const [x, y, width, height, thickness] = args;
  return { cmd: 'ELLIPSE', x, y, width, height, thickness };
}

function parseDiagonalCommand(
  line: string,
): { command: Extract<TSPLCommand, { cmd: 'DIAGONAL' }>; element: PrintElement } | null {
  const args = line
    .slice('DIAGONAL '.length)
    .trim()
    .split(',')
    .map(Number);
  if (args.length < 5) return null;

  const [x1, y1, x2, y2, thickness] = args;
  return {
    command: { cmd: 'DIAGONAL', x1, y1, x2, y2, thickness },
    element: { type: 'diagonal', options: { x1, y1, x2, y2, thickness } },
  };
}

function parseReverseCommand(line: string): Extract<TSPLCommand, { cmd: 'REVERSE' }> | null {
  const args = line
    .slice('REVERSE '.length)
    .trim()
    .split(',')
    .map(Number);
  if (args.length < 4) return null;

  const [x, y, width, height] = args;
  return { cmd: 'REVERSE', x, y, width, height };
}

function parseEraseCommand(line: string): Extract<TSPLCommand, { cmd: 'ERASE' }> | null {
  const args = line
    .slice('ERASE '.length)
    .trim()
    .split(',')
    .map(Number);
  if (args.length < 4) return null;

  const [x, y, width, height] = args;
  return { cmd: 'ERASE', x, y, width, height };
}

function parseBitmapCommand(line: string): Extract<TSPLCommand, { cmd: 'BITMAP' }> | null {
  const params = line.slice('BITMAP '.length).trim().split(',');
  if (params.length < 5) return null;

  return {
    cmd: 'BITMAP',
    x: Number(params[0]),
    y: Number(params[1]),
    widthBytes: Number(params[2]),
    height: Number(params[3]),
    mode: Number(params[4]),
  };
}

function parseQrCodeCommand(line: string): Extract<TSPLCommand, { cmd: 'QRCODE' }> | null {
  const params = splitParams(line.slice('QRCODE '.length).trim());
  if (params.length < 7) return null;

  const x = Number(params[0]);
  const y = Number(params[1]);
  const ecc = params[2];
  const cellWidth = Number(params[3]);
  const mode = params[4];
  const rotation = Number(params[5]);

  if (params.length >= 9) {
    const model = params[6];
    const mask = params[7];
    const content = unquote(params[8]);
    return { cmd: 'QRCODE', x, y, ecc, cellWidth, mode, rotation, model, mask, content };
  }
  return { cmd: 'QRCODE', x, y, ecc, cellWidth, mode, rotation, content: unquote(params[6]) };
}

function parseDMatrixCommand(line: string): Extract<TSPLCommand, { cmd: 'DMATRIX' }> | null {
  const params = splitParams(line.slice('DMATRIX '.length).trim());
  if (params.length < 5) return null;

  return {
    cmd: 'DMATRIX',
    x: Number(params[0]),
    y: Number(params[1]),
    width: Number(params[2]),
    height: Number(params[3]),
    content: unquote(params[params.length - 1]),
  };
}

function parsePdf417Command(line: string): Extract<TSPLCommand, { cmd: 'PDF417' }> | null {
  const params = splitParams(line.slice('PDF417 '.length).trim());
  if (params.length < 6) return null;

  return {
    cmd: 'PDF417',
    x: Number(params[0]),
    y: Number(params[1]),
    width: Number(params[2]),
    height: Number(params[3]),
    rotation: Number(params[4]),
    options: params.slice(5, -1),
    content: unquote(params[params.length - 1]),
  };
}

function parseAztecCommand(line: string): Extract<TSPLCommand, { cmd: 'AZTEC' }> | null {
  const params = splitParams(line.slice('AZTEC '.length).trim());
  if (params.length < 4) return null;

  return {
    cmd: 'AZTEC',
    x: Number(params[0]),
    y: Number(params[1]),
    rotation: Number(params[2]),
    content: unquote(params[params.length - 1]),
  };
}

function parseMaxiCodeCommand(line: string): Extract<TSPLCommand, { cmd: 'MAXICODE' }> | null {
  const params = splitParams(line.slice('MAXICODE '.length).trim());
  if (params.length < 4) return null;

  return {
    cmd: 'MAXICODE',
    x: Number(params[0]),
    y: Number(params[1]),
    mode: Number(params[2]),
    params: params.slice(3, -1).join(','),
    content: unquote(params[params.length - 1]),
  };
}

function parseMpdf417Command(line: string): Extract<TSPLCommand, { cmd: 'MPDF417' }> | null {
  const params = splitParams(line.slice('MPDF417 '.length).trim());
  if (params.length < 4) return null;

  return {
    cmd: 'MPDF417',
    x: Number(params[0]),
    y: Number(params[1]),
    rotation: Number(params[2]),
    options: params.slice(3, -1),
    content: unquote(params[params.length - 1]),
  };
}

function parseRssCommand(line: string): Extract<TSPLCommand, { cmd: 'RSS' }> | null {
  const params = splitParams(line.slice('RSS '.length).trim());
  if (params.length < 7) return null;

  return {
    cmd: 'RSS',
    x: Number(params[0]),
    y: Number(params[1]),
    sym: unquote(params[2]),
    rotation: Number(params[3]),
    pixMult: Number(params[4]),
    sepHt: Number(params[5]),
    content: unquote(params[params.length - 1]),
  };
}

function parseCodablockCommand(line: string): Extract<TSPLCommand, { cmd: 'CODABLOCK' }> | null {
  const params = splitParams(line.slice('CODABLOCK '.length).trim());
  if (params.length < 4) return null;

  return {
    cmd: 'CODABLOCK',
    x: Number(params[0]),
    y: Number(params[1]),
    rotation: Number(params[2]),
    content: unquote(params[params.length - 1]),
  };
}

function parseTlc39Command(line: string): Extract<TSPLCommand, { cmd: 'TLC39' }> | null {
  const params = splitParams(line.slice('TLC39 '.length).trim());
  if (params.length < 4) return null;

  return {
    cmd: 'TLC39',
    x: Number(params[0]),
    y: Number(params[1]),
    rotation: Number(params[2]),
    content: unquote(params[params.length - 1]),
  };
}

function parsePutBmpCommand(line: string): Extract<TSPLCommand, { cmd: 'PUTBMP' }> | null {
  const params = splitParams(line.slice('PUTBMP '.length).trim());
  if (params.length < 3) return null;

  return {
    cmd: 'PUTBMP',
    x: Number(params[0]),
    y: Number(params[1]),
    filename: unquote(params[2]),
    bpp: params.length > 3 ? Number(params[3]) : undefined,
    contrast: params.length > 4 ? Number(params[4]) : undefined,
  };
}

function parsePutPcxCommand(line: string): Extract<TSPLCommand, { cmd: 'PUTPCX' }> | null {
  const params = splitParams(line.slice('PUTPCX '.length).trim());
  if (params.length < 3) return null;

  return { cmd: 'PUTPCX', x: Number(params[0]), y: Number(params[1]), filename: unquote(params[2]) };
}

/**
 * Lệnh `SET` tổng quát (`SET <key> <value>`).
 * Trong `parseTSPL`, `startsWith('SET ')` khớp cả `SET GPO`/`SET GPI` và chạy trước hai nhánh
 * chuyên biệt đó, nên `parseSetGpoCommand`/`parseSetGpiCommand` không bao giờ được gọi — có chủ đích.
 */
function parseSetCommand(line: string): Extract<TSPLCommand, { cmd: 'SET' }> {
  const rest = line.slice('SET '.length).trim();
  const spaceIndex = rest.indexOf(' ');
  if (spaceIndex > 0) {
    return { cmd: 'SET', key: rest.slice(0, spaceIndex), value: rest.slice(spaceIndex + 1).trim() };
  }
  return { cmd: 'SET', key: rest, value: '' };
}

function parseDownloadCommand(line: string): Extract<TSPLCommand, { cmd: 'DOWNLOAD' }> {
  const params = splitParams(line.slice('DOWNLOAD'.length).trim());
  return { cmd: 'DOWNLOAD', filename: unquote(params[params.length - 1] ?? '') };
}

function parseKillCommand(line: string): Extract<TSPLCommand, { cmd: 'KILL' }> {
  return { cmd: 'KILL', filename: unquote(line.slice('KILL'.length).trim()) };
}

function parseRunCommand(line: string): Extract<TSPLCommand, { cmd: 'RUN' }> {
  return { cmd: 'RUN', filename: unquote(line.slice('RUN'.length).trim()) };
}

function parseForCommand(line: string): Extract<TSPLCommand, { cmd: 'FOR' }> | null {
  const match = line.match(/^FOR\s+(\w+)\s*=\s*(.+?)\s+TO\s+(.+?)(?:\s+STEP\s+(.+))?$/i);
  if (!match) return null;
  return { cmd: 'FOR', variable: match[1], start: match[2], end: match[3], step: match[4] };
}

function parseIfCommand(line: string): Extract<TSPLCommand, { cmd: 'IF' }> {
  return { cmd: 'IF', condition: line.slice('IF '.length).replace(/\s+THEN\s*$/i, '').trim() };
}

function parseThenCommand(line: string): Extract<TSPLCommand, { cmd: 'THEN' }> {
  return { cmd: 'THEN', statement: line.slice('THEN '.length).trim() };
}

function parseElseCommand(line: string): Extract<TSPLCommand, { cmd: 'ELSE' }> {
  const statement = line.slice('ELSE'.length).trim();
  return { cmd: 'ELSE', statement: statement || undefined };
}

function parseWhileCommand(line: string): Extract<TSPLCommand, { cmd: 'WHILE' }> {
  return { cmd: 'WHILE', condition: line.slice('WHILE '.length).trim() };
}

function parseDoCommand(line: string): Extract<TSPLCommand, { cmd: 'DO' }> {
  const condition = line.slice('DO'.length).trim();
  return { cmd: 'DO', condition: condition || undefined };
}

function parseLoopCommand(line: string): Extract<TSPLCommand, { cmd: 'LOOP' }> {
  const condition = line.slice('LOOP'.length).trim();
  return { cmd: 'LOOP', condition: condition || undefined };
}

function parseGotoCommand(line: string): Extract<TSPLCommand, { cmd: 'GOTO' }> {
  return { cmd: 'GOTO', label: line.slice('GOTO '.length).trim() };
}

function parseGosubCommand(line: string): Extract<TSPLCommand, { cmd: 'GOSUB' }> {
  return { cmd: 'GOSUB', label: line.slice('GOSUB '.length).trim() };
}

function parseRemCommand(line: string): Extract<TSPLCommand, { cmd: 'REM' }> {
  return { cmd: 'REM', comment: line.slice('REM'.length).trim() };
}

function parseInputCommand(line: string): Extract<TSPLCommand, { cmd: 'INPUT' }> {
  return { cmd: 'INPUT', prompt: undefined, variable: line.slice('INPUT '.length).trim() };
}

function parseOutCommand(line: string): Extract<TSPLCommand, { cmd: 'OUT' }> {
  return { cmd: 'OUT', port: undefined, data: line.slice('OUT '.length).trim() };
}

function parseOpenCommand(line: string): Extract<TSPLCommand, { cmd: 'OPEN' }> {
  return { cmd: 'OPEN', params: line.slice('OPEN '.length).trim() };
}

function parseCloseCommand(line: string): Extract<TSPLCommand, { cmd: 'CLOSE' }> {
  return { cmd: 'CLOSE', handle: line.slice('CLOSE '.length).trim() };
}

function parseWriteCommand(line: string): Extract<TSPLCommand, { cmd: 'WRITE' }> {
  const parts = line.slice('WRITE '.length).trim().split(',', 2);
  return { cmd: 'WRITE', handle: parts[0].trim(), data: (parts[1] ?? '').trim() };
}

function parseReadCommand(line: string): Extract<TSPLCommand, { cmd: 'READ' }> {
  const parts = line.slice('READ '.length).trim().split(',', 2);
  return { cmd: 'READ', handle: parts[0].trim(), variable: (parts[1] ?? '').trim() };
}

function parseSeekCommand(line: string): Extract<TSPLCommand, { cmd: 'SEEK' }> {
  const parts = line.slice('SEEK '.length).trim().split(',', 2);
  return { cmd: 'SEEK', handle: parts[0].trim(), offset: (parts[1] ?? '').trim() };
}

function parseCopyCommand(line: string): Extract<TSPLCommand, { cmd: 'COPY' }> {
  return { cmd: 'COPY', params: line.slice('COPY '.length).trim() };
}

function parseLabelCommand(line: string): Extract<TSPLCommand, { cmd: 'LABEL' }> {
  return { cmd: 'LABEL', name: line.slice(0, -1).trim() };
}

function parseNetCommand(line: string): Extract<TSPLCommand, { cmd: 'NET' }> {
  const parts = line.slice('NET '.length).trim().split(/\s+/, 2);
  return { cmd: 'NET', subcommand: parts[0], params: parts[1] ?? '' };
}

function parseWlanCommand(line: string): Extract<TSPLCommand, { cmd: 'WLAN' }> {
  const parts = line.slice('WLAN '.length).trim().split(/\s+/, 2);
  return { cmd: 'WLAN', subcommand: parts[0], params: parts[1] ?? '' };
}

function parseNfcCommand(line: string): Extract<TSPLCommand, { cmd: 'NFC' }> {
  const parts = line.slice('NFC '.length).trim().split(/\s+/, 2);
  return { cmd: 'NFC', subcommand: parts[0], params: parts[1] };
}

/** Không bao giờ được gọi — xem ghi chú dead-code ở `parseSetCommand`. */
function parseSetGpoCommand(line: string): Extract<TSPLCommand, { cmd: 'SET_GPO' }> {
  return { cmd: 'SET_GPO', params: line.slice('SET GPO'.length).trim() };
}

/** Không bao giờ được gọi — xem ghi chú dead-code ở `parseSetCommand`. */
function parseSetGpiCommand(line: string): Extract<TSPLCommand, { cmd: 'SET_GPI' }> {
  return { cmd: 'SET_GPI', params: line.slice('SET GPI'.length).trim() };
}

function parseGetSensorCommand(line: string): Extract<TSPLCommand, { cmd: 'GETSENSOR' }> {
  return { cmd: 'GETSENSOR', params: line.slice('GETSENSOR'.length).trim() };
}

function parseGetSettingCommand(line: string): Extract<TSPLCommand, { cmd: 'GETSETTING' }> {
  return { cmd: 'GETSETTING', params: line.slice('GETSETTING'.length).trim() };
}

function parseAssignmentCommand(line: string): Extract<TSPLCommand, { cmd: 'ASSIGNMENT' }> {
  const equalsIndex = line.indexOf('=');
  return { cmd: 'ASSIGNMENT', variable: line.slice(0, equalsIndex).trim(), value: line.slice(equalsIndex + 1).trim() };
}

/**
 * Thứ tự các nhánh `startsWith` bên dưới có ý nghĩa: `GAP` phải chạy trước phần loại trừ
 * `GAPDETECT` của chính nó, `SET ` chạy trước `SET GPO`/`SET GPI`, `DOWNLOAD` chạy trước `DO` —
 * đổi thứ tự sẽ âm thầm làm một dòng rơi vào nhánh khác.
 */
export function parseTSPL(code: string): TSPLParseResult {
  const commands: TSPLCommand[] = [];
  const warnings: string[] = [];
  const elements: PrintElement[] = [];
  let widthDots = 320;
  let heightDots = 240;
  const dpi = FIXED_PARSE_DPI;

  const lines = code.split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex].trim();
    if (!line) continue;

    const upperLine = line.toUpperCase();

    if (upperLine.startsWith('SIZE')) {
      const parsed = parseSizeCommand(line, dpi);
      if (parsed) {
        commands.push(parsed.command);
        widthDots = parsed.widthDots;
        heightDots = parsed.heightDots;
      }
      continue;
    }

    if (upperLine.startsWith('GAP') && !upperLine.startsWith('GAPDETECT')) {
      const parsed = parseGapCommand(line);
      if (parsed) commands.push(parsed);
      continue;
    }

    if (upperLine.startsWith('GAPDETECT')) {
      commands.push(parseGapDetectCommand(line));
      continue;
    }

    if (upperLine.startsWith('BLINEDETECT')) {
      commands.push(parseBlineDetectCommand(line));
      continue;
    }

    if (upperLine.startsWith('AUTODETECT')) {
      commands.push(parseAutoDetectCommand(line));
      continue;
    }

    if (upperLine.startsWith('BLINE') && !upperLine.startsWith('BLINEDETECT')) {
      const parsed = parseBlineCommand(line);
      if (parsed) commands.push(parsed);
      continue;
    }

    if (upperLine.startsWith('OFFSET')) {
      commands.push(parseOffsetCommand(line));
      continue;
    }

    if (upperLine.startsWith('SPEED')) {
      commands.push(parseSpeedCommand(line));
      continue;
    }

    if (upperLine.startsWith('DENSITY')) {
      commands.push(parseDensityCommand(line));
      continue;
    }

    if (upperLine.startsWith('DIRECTION')) {
      commands.push(parseDirectionCommand(line));
      continue;
    }

    if (upperLine.startsWith('REFERENCE')) {
      commands.push(parseReferenceCommand(line));
      continue;
    }

    if (upperLine.startsWith('SHIFT')) {
      commands.push(parseShiftCommand(line));
      continue;
    }

    if (upperLine.startsWith('COUNTRY')) {
      commands.push(parseCountryCommand(line));
      continue;
    }

    if (upperLine.startsWith('CODEPAGE')) {
      commands.push(parseCodepageCommand(line));
      continue;
    }

    if (upperLine === 'CLS') {
      commands.push({ cmd: 'CLS' });
      continue;
    }

    if (upperLine.startsWith('FEED') && !upperLine.startsWith('FEED_LEN')) {
      commands.push(parseFeedCommand(line));
      continue;
    }

    if (upperLine.startsWith('BACKFEED')) {
      commands.push(parseBackfeedCommand(line));
      continue;
    }

    if (upperLine.startsWith('BACKUP')) {
      commands.push(parseBackupCommand(line));
      continue;
    }

    if (upperLine === 'FORMFEED') {
      commands.push({ cmd: 'FORMFEED' });
      continue;
    }

    if (upperLine === 'HOME') {
      commands.push({ cmd: 'HOME' });
      continue;
    }

    if (upperLine.startsWith('PRINT') && !upperLine.startsWith('PRINTKEY')) {
      commands.push(parsePrintCommand(line));
      continue;
    }

    if (upperLine.startsWith('SOUND')) {
      commands.push(parseSoundCommand(line));
      continue;
    }

    if (upperLine === 'CUT') {
      commands.push({ cmd: 'CUT' });
      continue;
    }

    if (upperLine.startsWith('LIMITFEED')) {
      commands.push(parseLimitFeedCommand(line));
      continue;
    }

    if (upperLine.startsWith('SELFTEST')) {
      commands.push(parseSelfTestCommand(line));
      continue;
    }

    if (upperLine === 'EOJ') {
      commands.push({ cmd: 'EOJ' });
      continue;
    }

    if (upperLine.startsWith('DELAY')) {
      commands.push(parseDelayCommand(line));
      continue;
    }

    if (upperLine.startsWith('DISPLAY')) {
      commands.push(parseDisplayCommand(line));
      continue;
    }

    if (upperLine === 'INITIALPRINTER') {
      commands.push({ cmd: 'INITIALPRINTER' });
      continue;
    }

    if (upperLine.startsWith('TEXT ')) {
      const parsed = parseTextCommand(line);
      if (parsed) {
        commands.push(parsed.command);
        elements.push(parsed.element);
      }
      continue;
    }

    if (upperLine.startsWith('BLOCK ')) {
      const parsed = parseBlockCommand(line);
      if (parsed) {
        commands.push(parsed.command);
        elements.push(parsed.element);
      }
      continue;
    }

    if (upperLine.startsWith('BARCODE ')) {
      const parsed = parseBarcodeCommand(line);
      if (parsed) commands.push(parsed);
      continue;
    }

    if (upperLine.startsWith('BAR ')) {
      const parsed = parseBarCommand(line);
      if (parsed) {
        commands.push(parsed.command);
        elements.push(parsed.element);
      }
      continue;
    }

    if (upperLine.startsWith('BOX ')) {
      const parsed = parseBoxCommand(line);
      if (parsed) {
        commands.push(parsed.command);
        elements.push(parsed.element);
      }
      continue;
    }

    if (upperLine.startsWith('CIRCLE ')) {
      const parsed = parseCircleCommand(line);
      if (parsed) {
        commands.push(parsed.command);
        elements.push(parsed.element);
      }
      continue;
    }

    if (upperLine.startsWith('ELLIPSE ')) {
      const parsed = parseEllipseCommand(line);
      if (parsed) commands.push(parsed);
      continue;
    }

    if (upperLine.startsWith('DIAGONAL ')) {
      const parsed = parseDiagonalCommand(line);
      if (parsed) {
        commands.push(parsed.command);
        elements.push(parsed.element);
      }
      continue;
    }

    if (upperLine.startsWith('REVERSE ')) {
      const parsed = parseReverseCommand(line);
      if (parsed) commands.push(parsed);
      continue;
    }

    if (upperLine.startsWith('ERASE ')) {
      const parsed = parseEraseCommand(line);
      if (parsed) commands.push(parsed);
      continue;
    }

    // GIỚI HẠN ĐÃ BIẾT: chỉ đọc 5 tham số header, không tiêu thụ payload nhị phân
    // widthBytes*height theo sau (TsplEncoder nối vào lúc compile). Nguồn được tách dòng bằng
    // `code.split(/\r?\n/)` trước khi parse, nên byte payload trùng 0x0D/0x0A sẽ bị tách thành
    // các dòng giả, làm hỏng phần lệnh còn lại — ảnh hưởng dữ liệu bitmap đơn sắc thực tế.
    // TsplParser vì vậy không round-trip được (compile -> parse) tài liệu có element image, nhưng
    // không ảnh hưởng máy in thật: transport gửi nguyên byte đã compile, không qua parser này.
    if (upperLine.startsWith('BITMAP ')) {
      const parsed = parseBitmapCommand(line);
      if (parsed) commands.push(parsed);
      continue;
    }

    if (upperLine.startsWith('QRCODE ')) {
      const parsed = parseQrCodeCommand(line);
      if (parsed) commands.push(parsed);
      continue;
    }

    if (upperLine.startsWith('DMATRIX ')) {
      const parsed = parseDMatrixCommand(line);
      if (parsed) commands.push(parsed);
      continue;
    }

    if (upperLine.startsWith('PDF417 ')) {
      const parsed = parsePdf417Command(line);
      if (parsed) commands.push(parsed);
      continue;
    }

    if (upperLine.startsWith('AZTEC ')) {
      const parsed = parseAztecCommand(line);
      if (parsed) commands.push(parsed);
      continue;
    }

    if (upperLine.startsWith('MAXICODE ')) {
      const parsed = parseMaxiCodeCommand(line);
      if (parsed) commands.push(parsed);
      continue;
    }

    if (upperLine.startsWith('MPDF417 ')) {
      const parsed = parseMpdf417Command(line);
      if (parsed) commands.push(parsed);
      continue;
    }

    if (upperLine.startsWith('RSS ')) {
      const parsed = parseRssCommand(line);
      if (parsed) commands.push(parsed);
      continue;
    }

    if (upperLine.startsWith('CODABLOCK ')) {
      const parsed = parseCodablockCommand(line);
      if (parsed) commands.push(parsed);
      continue;
    }

    if (upperLine.startsWith('TLC39 ')) {
      const parsed = parseTlc39Command(line);
      if (parsed) commands.push(parsed);
      continue;
    }

    if (upperLine.startsWith('PUTBMP ')) {
      const parsed = parsePutBmpCommand(line);
      if (parsed) commands.push(parsed);
      continue;
    }

    if (upperLine.startsWith('PUTPCX ')) {
      const parsed = parsePutPcxCommand(line);
      if (parsed) commands.push(parsed);
      continue;
    }

    if (line.startsWith('\x1b!') || line.startsWith('~!')) {
      commands.push({ cmd: 'STATUS_QUERY', type: line });
      continue;
    }

    if (upperLine.startsWith('SET ')) {
      commands.push(parseSetCommand(line));
      continue;
    }

    if (upperLine.startsWith('DOWNLOAD')) {
      commands.push(parseDownloadCommand(line));
      continue;
    }

    if (upperLine === 'EOP') {
      commands.push({ cmd: 'EOP' });
      continue;
    }

    if (upperLine === 'FILES') {
      commands.push({ cmd: 'FILES' });
      continue;
    }

    if (upperLine.startsWith('KILL')) {
      commands.push(parseKillCommand(line));
      continue;
    }

    if (upperLine === 'MOVE') {
      commands.push({ cmd: 'MOVE' });
      continue;
    }

    if (upperLine.startsWith('RUN')) {
      commands.push(parseRunCommand(line));
      continue;
    }

    if (upperLine.startsWith('FOR ')) {
      const parsed = parseForCommand(line);
      if (parsed) commands.push(parsed);
      continue;
    }

    if (upperLine === 'NEXT') {
      commands.push({ cmd: 'NEXT' });
      continue;
    }
    if (upperLine === 'ENDIF') {
      commands.push({ cmd: 'ENDIF' });
      continue;
    }
    if (upperLine === 'WEND') {
      commands.push({ cmd: 'WEND' });
      continue;
    }
    if (upperLine === 'RETURN') {
      commands.push({ cmd: 'RETURN' });
      continue;
    }
    if (upperLine === 'END') {
      commands.push({ cmd: 'END' });
      continue;
    }
    if (upperLine === 'BEEP') {
      commands.push({ cmd: 'BEEP' });
      continue;
    }
    if (upperLine === 'PEEL') {
      commands.push({ cmd: 'PEEL_SENSOR' });
      continue;
    }
    if (upperLine === 'EXITFOR') {
      commands.push({ cmd: 'NEXT' });
      continue;
    }
    if (upperLine === 'EXITDO') {
      commands.push({ cmd: 'LOOP' });
      continue;
    }

    if (upperLine.startsWith('IF ')) {
      commands.push(parseIfCommand(line));
      continue;
    }

    if (upperLine.startsWith('THEN ') || upperLine === 'THEN') {
      commands.push(parseThenCommand(line));
      continue;
    }

    const isElseLine = upperLine === 'ELSE' || upperLine.startsWith('ELSE ') || upperLine.startsWith('ELSEIF');
    if (isElseLine) {
      commands.push(parseElseCommand(line));
      continue;
    }

    if (upperLine.startsWith('WHILE ')) {
      commands.push(parseWhileCommand(line));
      continue;
    }

    if (upperLine.startsWith('DO')) {
      commands.push(parseDoCommand(line));
      continue;
    }

    if (upperLine.startsWith('LOOP')) {
      commands.push(parseLoopCommand(line));
      continue;
    }

    if (upperLine.startsWith('GOTO ')) {
      commands.push(parseGotoCommand(line));
      continue;
    }

    if (upperLine.startsWith('GOSUB ')) {
      commands.push(parseGosubCommand(line));
      continue;
    }

    if (upperLine.startsWith('REM ') || upperLine === 'REM') {
      commands.push(parseRemCommand(line));
      continue;
    }

    if (upperLine.startsWith('INPUT ')) {
      commands.push(parseInputCommand(line));
      continue;
    }

    if (upperLine.startsWith('OUT ')) {
      commands.push(parseOutCommand(line));
      continue;
    }

    if (upperLine.startsWith('OPEN ')) {
      commands.push(parseOpenCommand(line));
      continue;
    }

    if (upperLine.startsWith('CLOSE ')) {
      commands.push(parseCloseCommand(line));
      continue;
    }

    if (upperLine.startsWith('WRITE ')) {
      commands.push(parseWriteCommand(line));
      continue;
    }

    if (upperLine.startsWith('READ ')) {
      commands.push(parseReadCommand(line));
      continue;
    }

    if (upperLine.startsWith('SEEK ')) {
      commands.push(parseSeekCommand(line));
      continue;
    }

    if (upperLine.startsWith('COPY ')) {
      commands.push(parseCopyCommand(line));
      continue;
    }

    if (line.endsWith(':') && !line.includes(',')) {
      commands.push(parseLabelCommand(line));
      continue;
    }

    if (upperLine.startsWith('NET ')) {
      commands.push(parseNetCommand(line));
      continue;
    }

    if (upperLine.startsWith('WLAN ')) {
      commands.push(parseWlanCommand(line));
      continue;
    }

    if (upperLine.startsWith('NFC ')) {
      commands.push(parseNfcCommand(line));
      continue;
    }

    if (upperLine.startsWith('SET GPO')) {
      commands.push(parseSetGpoCommand(line));
      continue;
    }

    if (upperLine.startsWith('SET GPI')) {
      commands.push(parseSetGpiCommand(line));
      continue;
    }

    if (upperLine.startsWith('GETSENSOR')) {
      commands.push(parseGetSensorCommand(line));
      continue;
    }

    if (upperLine.startsWith('GETSETTING')) {
      commands.push(parseGetSettingCommand(line));
      continue;
    }

    if (line.includes('=') && !upperLine.startsWith('SET ') && /^[@\w$]+\s*=/.test(line)) {
      commands.push(parseAssignmentCommand(line));
      continue;
    }

    commands.push({ cmd: 'UNKNOWN', raw: line });
  }

  return { commands, widthDots, heightDots, dpi, elements, warnings };
}

/**
 * Giải mã một chuỗi lệnh TSPL/TSPL2 thành các lệnh có cấu trúc (theo dòng,
 * theo ngữ pháp từng lệnh).
 */
export class TsplParser implements PrintParser<{ commands: unknown[]; warnings: string[] }> {
  parse(source: string | Uint8Array): { commands: unknown[]; warnings: string[] } {
    const code = typeof source === 'string' ? source : new TextDecoder().decode(source);
    return parseTSPL(code);
  }
}
