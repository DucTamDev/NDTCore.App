import type { PrintParser } from '../../core';
import type { PrintElement } from '../../document/elements';
import type { Alignment } from '../../types';
import { ZplFontMetrics } from './ZplFontMetrics';

/**
 * Một lệnh ZPL đã giải mã: mã lệnh có tiền tố `^`/`~`, phần text thô nằm giữa nó và
 * lệnh kế tiếp, tách theo dấu `,` cho tham số theo vị trí. Khác `TSPLCommand` của TSPL
 * (discriminated union riêng cho từng lệnh) — `tokenize()` không cần biết hình dạng
 * tham số để tách lệnh khỏi lệnh liền kề, nên mọi lệnh dùng chung một hình dạng này.
 */
export interface ZPLCommand {
  code: string;
  rawParams: string;
  params: string[];
}

export interface ZPLParseResult {
  commands: ZPLCommand[];
  widthDots: number;
  heightDots: number;
  elements: PrintElement[];
  warnings: string[];
}

const DEFAULT_WIDTH_DOTS = 812; // 4in @ 203dpi
const DEFAULT_HEIGHT_DOTS = 1218; // 6in @ 203dpi

/**
 * `^FD`/`^FV` (dữ liệu field) đọc đến đúng marker `^FS` vì payload có thể chứa ký tự
 * `^`/`~`. `^GF`/`~DG`/`^FX` đọc như nhánh mặc định nhưng không dừng ở `\r`/`\n`, vì
 * payload (dữ liệu graphic, comment) có thể chứa xuống dòng.
 */
export function tokenize(code: string): ZPLCommand[] {
  const commands: ZPLCommand[] = [];
  let i = 0;

  while (i < code.length) {
    if (code[i] === ' ' || code[i] === '\r' || code[i] === '\n' || code[i] === '\t') {
      i++;
      continue;
    }

    if (code[i] === '^' || code[i] === '~') {
      const prefix = code[i];
      i++;

      let commandCode = prefix;
      if (i < code.length && /[A-Za-z]/.test(code[i])) {
        commandCode += code[i].toUpperCase();
        i++;
      }
      if (i < code.length && /[A-Za-z0-9@]/.test(code[i])) {
        commandCode += code[i].toUpperCase();
        i++;
      }

      let rawParams = '';

      if (commandCode === '^FD' || commandCode === '^FV') {
        const endMarker = '^FS';
        const endIdx = code.indexOf(endMarker, i);
        if (endIdx >= 0) {
          rawParams = code.slice(i, endIdx).trim();
          i = endIdx; // ^FS được tokenize như lệnh kế tiếp.
        } else {
          rawParams = code.slice(i).trim();
          i = code.length;
        }
      } else if (commandCode === '^GF' || commandCode === '~DG' || commandCode === '^FX') {
        const start = i;
        while (i < code.length && code[i] !== '^' && code[i] !== '~') i++;
        rawParams = code.slice(start, i).trim();
      } else {
        const start = i;
        while (i < code.length && code[i] !== '^' && code[i] !== '~') {
          if (code[i] === '\r' || code[i] === '\n') break;
          i++;
        }
        rawParams = code.slice(start, i).trim();
      }

      const params = rawParams ? rawParams.split(',').map((param) => param.trim()) : [];
      commands.push({ code: commandCode, rawParams, params });
    } else {
      i++;
    }
  }

  return commands;
}

/**
 * Trạng thái field tích luỹ qua chuỗi lệnh `^FO`/`^FT`...`^FS` của `parseZPL()`. Gom
 * thành object để mỗi lệnh xử lý bằng một hàm `applyXxx`/`buildXxx` riêng nhận state
 * làm tham số, thay vì đóng (closure) trên nhiều biến `let` trong thân `parseZPL()`.
 */
interface ZplParserState {
  fieldX: number;
  fieldY: number;
  labelHomeX: number;
  labelHomeY: number;
  labelShift: number;
  labelTop: number;
  currentFontHeight: number;
  fieldReverse: boolean;
  fieldData: string;
  barcodeType: string;
  barcodeHeight: number;
  barcodeModuleWidth: number;
  fieldBaseline: boolean;
  fieldBlockWidth: number;
  fieldBlockJustify: string;
}

function createInitialParserState(): ZplParserState {
  return {
    fieldX: 0,
    fieldY: 0,
    labelHomeX: 0,
    labelHomeY: 0,
    labelShift: 0,
    labelTop: 0,
    currentFontHeight: 30,
    fieldReverse: false,
    fieldData: '',
    barcodeType: '',
    // Khớp giá trị fallback mặc định của chính ^BY khi chưa có lệnh ^BY nào chạy.
    barcodeHeight: 10,
    barcodeModuleWidth: 2,
    fieldBaseline: false,
    fieldBlockWidth: 0,
    fieldBlockJustify: 'L',
  };
}

/** `^A0`/`^AA`.../`^AZ` — chữ cái font nằm ngay trong mã lệnh. */
function applyFontSizeCommand(state: ZplParserState, command: ZPLCommand): void {
  const parts = command.rawParams.split(',');
  if (!parts[1]) return;
  state.currentFontHeight = Number(parts[1]) || state.currentFontHeight;
}

/**
 * `^B0`-`^B9`/`^BA`-`^BZ` — loại barcode nằm ngay trong mã lệnh, trừ `^BY`
 * (bar code field default, xử lý trong switch).
 */
function applyBarcodeTypeCommand(state: ZplParserState, command: ZPLCommand): void {
  state.barcodeType = command.code;
  const height = Number(command.params[1]);
  if (height > 0) state.barcodeHeight = height;
}

function applyFieldOriginCommand(state: ZplParserState, command: ZPLCommand): void {
  state.fieldX = Number(command.params[0] ?? 0) + state.labelHomeX + state.labelShift;
  state.fieldY = Number(command.params[1] ?? 0) + state.labelHomeY + state.labelTop;
  state.fieldReverse = false;
  state.fieldBaseline = false;
  state.fieldBlockWidth = 0;
}

// `^FT` định vị theo baseline (đáy chữ) thay vì góc trên-trái — được quy đổi
// lại về góc trên-trái khi field đóng, trong `buildClosedFieldElement()`.
function applyFieldTypesetCommand(state: ZplParserState, command: ZPLCommand): void {
  state.fieldX = Number(command.params[0] ?? 0) + state.labelHomeX + state.labelShift;
  state.fieldY = Number(command.params[1] ?? 0) + state.labelHomeY + state.labelTop;
  state.fieldBaseline = true;
  state.fieldBlockWidth = 0;
}

/**
 * Dựng `PrintElement` cho field vừa đóng bởi `^FS` — chỉ được gọi khi
 * `state.fieldData` khác rỗng (do nơi gọi đã guard). Không có shape
 * `PrintElement` riêng cho barcode ở phía parse (khác các case
 * `barcode`/`qrcode` của `ZplCompiler`) — barcode giữ nguyên dạng text ZPL
 * thô `raw`.
 */
function buildClosedFieldElement(state: ZplParserState): PrintElement {
  const adjustedY = state.fieldBaseline ? state.fieldY - state.currentFontHeight : state.fieldY;

  if (state.barcodeType) {
    const rawCommand =
      `^BY${state.barcodeModuleWidth}^FO${state.fieldX},${adjustedY}${state.barcodeType}N,${state.barcodeHeight},Y` +
      `^FD${state.fieldData}^FS`;
    return { type: 'raw', content: rawCommand };
  }

  const align: Alignment | undefined =
    state.fieldBlockWidth > 0 && state.fieldBlockJustify === 'C'
      ? 'center'
      : state.fieldBlockWidth > 0 && state.fieldBlockJustify === 'R'
        ? 'right'
        : undefined;

  return {
    type: 'text',
    content: state.fieldData,
    options: {
      x: state.fieldX,
      y: adjustedY,
      fontSize: ZplFontMetrics.nativeToFontSize(state.currentFontHeight),
      reverse: state.fieldReverse || undefined,
      maxWidth: state.fieldBlockWidth || undefined,
      align,
    },
  };
}

function applyConfigureFontCommand(state: ZplParserState, command: ZPLCommand): void {
  if (!command.params[1]) return;
  state.currentFontHeight = Number(command.params[1]);
}

// `^FBwidth,maxLines,lineSpacing,justify,hangingIndent` — chỉ `width`/`justify`
// được dùng, `maxLines`/`lineSpacing`/`hangingIndent` không có gì đọc lại.
function applyFieldBlockCommand(state: ZplParserState, command: ZPLCommand): void {
  state.fieldBlockWidth = Number(command.params[0] ?? 0);
  state.fieldBlockJustify = (command.params[3] ?? 'L').toUpperCase();
}

// `^BYw,r,h` — bar code field default; `r` (tỉ lệ vạch rộng/hẹp) không được
// theo dõi vì không áp dụng cho Code 128 và không được đọc lại ở đâu khác.
function applyBarcodeFieldDefaultCommand(state: ZplParserState, command: ZPLCommand): void {
  if (command.params[0]) state.barcodeModuleWidth = Number(command.params[0]) || state.barcodeModuleWidth;
  if (command.params[2]) state.barcodeHeight = Number(command.params[2]) || state.barcodeHeight;
}

function buildGraphicBoxElement(state: ZplParserState, command: ZPLCommand): PrintElement {
  const width = Number(command.params[0] ?? 1);
  const height = Number(command.params[1] ?? 1);
  const thickness = Number(command.params[2] ?? 1);
  const color = (command.params[3] ?? 'B').toUpperCase();
  const cornerIndex = Number(command.params[4] ?? 0);
  const radius = cornerIndex > 0 ? (cornerIndex / 8) * (Math.min(width, height) / 2) : 0;
  // Hai nguồn đảo màu độc lập kết hợp ở đây: một `^FR` đang bật sẽ đảo cực
  // của field đang vẽ, còn tham số màu `W` nghĩa là box đã được yêu cầu vẽ
  // trắng ngay từ đầu.
  const isWhite = state.fieldReverse ? color !== 'W' : color === 'W';
  const isFilled = thickness >= Math.min(width, height);

  if (isWhite && isFilled) {
    return { type: 'erase', options: { x: state.fieldX, y: state.fieldY, width, height } };
  }
  return { type: 'box', options: { x: state.fieldX, y: state.fieldY, width, height, thickness, radius } };
}

function buildGraphicCircleElement(state: ZplParserState, command: ZPLCommand): PrintElement {
  const diameter = Number(command.params[0] ?? 1);
  const thickness = Number(command.params[1] ?? 1);
  const color = (command.params[2] ?? 'B').toUpperCase();
  const isWhite = state.fieldReverse ? color !== 'W' : color === 'W';

  if (isWhite && thickness >= diameter / 2) {
    return { type: 'erase', options: { x: state.fieldX, y: state.fieldY, width: diameter, height: diameter } };
  }
  return { type: 'circle', options: { x: state.fieldX, y: state.fieldY, diameter, thickness } };
}

// `^GD` luôn là đường chéo trong ZPL (khác `BAR` của TSPL, có thể vẽ cả
// đường thẳng axis-aligned) nên ánh xạ thẳng sang `PrintElement` `'diagonal'`.
function buildGraphicDiagonalElement(state: ZplParserState, command: ZPLCommand): PrintElement {
  const width = Number(command.params[0] ?? 1);
  const height = Number(command.params[1] ?? 1);
  const thickness = Number(command.params[2] ?? 1);
  const direction = (command.params[4] ?? 'R').toUpperCase();

  if (direction === 'R') {
    return {
      type: 'diagonal',
      options: { x1: state.fieldX, y1: state.fieldY, x2: state.fieldX + width, y2: state.fieldY + height, thickness },
    };
  }
  return {
    type: 'diagonal',
    options: { x1: state.fieldX + width, y1: state.fieldY, x2: state.fieldX, y2: state.fieldY + height, thickness },
  };
}

/**
 * Hai kiểm tra tiền tố `^A`/`^B` chạy trước switch chính vì font/loại barcode
 * nằm ngay trong mã lệnh (`^A0`, `^B3`...), không phải trong `rawParams`. Ký
 * tự orientation trong tham số của `^A` được tách ra nhưng không áp dụng vào
 * element — bỏ qua có chủ đích, không giữ làm trạng thái chết.
 */
export function parseZPL(code: string): ZPLParseResult {
  const commands = tokenize(code);
  const elements: PrintElement[] = [];
  const warnings: string[] = [];
  let widthDots = DEFAULT_WIDTH_DOTS;
  let heightDots = DEFAULT_HEIGHT_DOTS;
  const state = createInitialParserState();

  for (const command of commands) {
    if (command.code.startsWith('^A') && command.code.length === 3 && command.code !== '^A@') {
      applyFontSizeCommand(state, command);
      continue;
    }

    if (command.code.startsWith('^B') && command.code.length === 3 && command.code !== '^BY') {
      applyBarcodeTypeCommand(state, command);
      continue;
    }

    switch (command.code) {
      case '^XA':
        state.fieldX = 0;
        state.fieldY = 0;
        state.fieldReverse = false;
        break;

      case '^XZ':
        break;

      case '^PW':
        if (command.params[0]) widthDots = Number(command.params[0]);
        break;

      case '^LL':
        if (command.params[0]) heightDots = Number(command.params[0]);
        break;

      case '^LH':
        state.labelHomeX = Number(command.params[0] ?? 0);
        state.labelHomeY = Number(command.params[1] ?? 0);
        break;

      case '^LS':
        state.labelShift = Number(command.params[0] ?? 0);
        break;

      case '^LT':
        state.labelTop = Number(command.params[0] ?? 0);
        break;

      case '^LR':
      case '^PQ':
      case '^PR':
      case '^MD':
      case '~SD':
      case '^MM':
      case '^MT':
      case '^MN':
      case '^PO':
      case '^PM':
      case '^MU':
        break;

      case '^FO':
        applyFieldOriginCommand(state, command);
        break;

      case '^FT':
        applyFieldTypesetCommand(state, command);
        break;

      case '^FD':
      case '^FV':
        state.fieldData = command.rawParams;
        break;

      case '^FS': {
        if (state.fieldData) {
          elements.push(buildClosedFieldElement(state));
          state.fieldData = '';
          state.barcodeType = '';
        }
        state.fieldReverse = false;
        state.fieldBaseline = false;
        break;
      }

      case '^FR':
        state.fieldReverse = true;
        break;

      case '^FN':
      case '^FH':
      case '^FP':
      case '^FW':
      case '^FX':
      case '^A@':
        break;

      case '^CF':
        applyConfigureFontCommand(state, command);
        break;

      case '^CI':
      case '^CW':
        break;

      case '^FB':
        applyFieldBlockCommand(state, command);
        break;

      case '^TB':
        break;

      case '^BY':
        applyBarcodeFieldDefaultCommand(state, command);
        break;

      case '^GB':
        elements.push(buildGraphicBoxElement(state, command));
        state.fieldReverse = false;
        break;

      case '^GC':
        elements.push(buildGraphicCircleElement(state, command));
        state.fieldReverse = false;
        break;

      case '^GD':
        elements.push(buildGraphicDiagonalElement(state, command));
        state.fieldReverse = false;
        break;

      case '^GE':
      case '^GF':
      case '^GS':
      case '~DG':
      case '^ID':
      case '^IL':
      case '^IM':
      case '^IS':
      case '^XG':
      case '^DF':
      case '^XF':
      case '^SN':
      case '^JM':
      case '^JU':
      case '^JZ':
      case '^SZ':
      case '^SC':
      case '^SE':
      case '^SF':
      case '^SI':
      case '^SL':
      case '^SO':
      case '^SP':
      case '^SQ':
      case '^SR':
      case '^SS':
      case '^ST':
      case '^SX':
      case '~HI':
      case '~HS':
      case '~HM':
      case '~HU':
      case '~HB':
      case '~HD':
      case '~HQ':
      case '^HH':
      case '^HF':
      case '^HG':
      case '^HL':
      case '^HR':
      case '^HT':
      case '^HV':
      case '^HW':
      case '^HY':
      case '^HZ':
      case '^NC':
      case '^ND':
      case '^NI':
      case '^NN':
      case '^NP':
      case '^NS':
      case '^NT':
      case '^NW':
      case '~NC':
      case '~NR':
      case '~NT':
      case '^NB':
      case '^RF':
      case '^RL':
      case '^RB':
      case '^RS':
      case '^RU':
      case '^RW':
      case '^WD':
      case '^WA':
      case '^WE':
      case '^WL':
      case '^WP':
      case '^WR':
      case '^WS':
      case '^WX':
      case '~WC':
      case '~WL':
      case '~WQ':
      case '~WR':
      case '^MC':
      case '^MF':
      case '^MI':
      case '^ML':
      case '^MP':
      case '^MW':
      case '^MA':
      case '^CC':
      case '^CD':
      case '^CM':
      case '^CN':
      case '^CO':
      case '^CP':
      case '^CT':
      case '^CV':
      case '^FC':
      case '^FE':
      case '^FL':
      case '^FM':
      case '^JB':
      case '^JH':
      case '^JI':
      case '^JJ':
      case '^JS':
      case '^JT':
      case '^JW':
      case '^KC':
      case '^KD':
      case '^KL':
      case '^KN':
      case '^KP':
      case '^KV':
      case '^LF':
      case '^PA':
      case '^PF':
      case '^PH':
      case '^PN':
      case '^PP':
      case '^TO':
      case '^XB':
      case '^XS':
      case '^ZZ':
      case '~DB':
      case '~DE':
      case '~DN':
      case '~DS':
      case '~DT':
      case '~DU':
      case '~DY':
      case '~EG':
      case '~JA':
      case '~JB':
      case '~JC':
      case '~JD':
      case '~JE':
      case '~JF':
      case '~JG':
      case '~JI':
      case '~JL':
      case '~JN':
      case '~JO':
      case '~JP':
      case '~JQ':
      case '~JR':
      case '~JS':
      case '~JX':
      case '~KB':
      case '~PL':
      case '~PM':
      case '~PR':
      case '~PS':
      case '~RO':
      case '~TA':
        break;

      default:
        if (command.code !== '^FS') {
          warnings.push(`Unknown command: ${command.code}`);
        }
        break;
    }
  }

  return { commands, widthDots, heightDots, elements, warnings };
}

export class ZplParser implements PrintParser<{ commands: unknown[]; warnings: string[] }> {
  parse(source: string | Uint8Array): { commands: unknown[]; warnings: string[] } {
    const code = typeof source === 'string' ? source : new TextDecoder().decode(source);
    return parseZPL(code);
  }
}
