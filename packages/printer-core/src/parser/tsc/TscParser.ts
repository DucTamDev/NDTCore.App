import type { PrintParser } from '../../core';
import type { PrintElement } from '../../document';

/**
 * Every TSPL/TSPL2 command this parser recognizes, ported from portakal's
 * `parsers/tsc.ts` field-for-field against TSC's vendor command reference.
 * Several fields (e.g. `BLOCK`'s `space`/`align`/`fit`) are declared here
 * because the command grammar supports them, but the parser below doesn't
 * currently populate them — same gap as upstream.
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
  | { cmd: 'CODABLOCK'; x: number; y: number; rotation: number; rowHeight?: number; moduleWidth?: number; content: string }
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
  | { cmd: 'PDF417'; x: number; y: number; width: number; height: number; rotation: number; options: string[]; content: string }
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
  | { cmd: 'TEXT'; x: number; y: number; font: string; rotation: number; xMul: number; yMul: number; alignment?: number; content: string }
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

/** Full result of parsing a TSPL/TSPL2 source string. */
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

function splitParams(s: string): string[] {
  const params: string[] = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') {
      inQuote = !inQuote;
      current += ch;
    } else if (ch === ',' && !inQuote) {
      params.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) params.push(current.trim());
  return params;
}

function unquote(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  return s;
}

/**
 * Parses TSPL/TSPL2 source into structured commands, one physical line at a
 * time. Several `startsWith` checks below only work because of the order
 * they run in (e.g. `GAP` before `GAPDETECT`'s own exclusion, `SET ` before
 * the later GPIO `SET GPO`/`SET GPI` checks, `DOWNLOAD` before the broader
 * `DO` check) — that order is preserved exactly as portakal's `parseTSPL()`
 * has it, since reordering would silently change which branch a line falls
 * into.
 */
export function parseTSPL(code: string): TSPLParseResult {
  const commands: TSPLCommand[] = [];
  const warnings: string[] = [];
  const elements: PrintElement[] = [];
  let widthDots = 320;
  let heightDots = 240;
  const dpi = FIXED_PARSE_DPI;

  const lines = code.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const upperLine = line.toUpperCase();

    if (upperLine.startsWith('SIZE')) {
      const args = line.slice(4).trim();
      const parts = args.split(',').map((s) => s.trim());
      if (parts.length >= 2) {
        const w = parseUnit(parts[0]);
        const h = parseUnit(parts[1]);
        widthDots = toDotsFromUnit(w.value, w.unit, dpi);
        heightDots = toDotsFromUnit(h.value, h.unit, dpi);
        commands.push({ cmd: 'SIZE', widthMM: w.value, heightMM: h.value, unit: w.unit });
      }
      continue;
    }

    if (upperLine.startsWith('GAP') && !upperLine.startsWith('GAPDETECT')) {
      const args = line.slice(3).trim();
      const parts = args.split(',').map((s) => s.trim());
      if (parts.length >= 2) {
        const d = parseUnit(parts[0]);
        const o = parseUnit(parts[1]);
        commands.push({ cmd: 'GAP', distanceMM: d.value, offsetMM: o.value, unit: d.unit });
      }
      continue;
    }

    if (upperLine.startsWith('GAPDETECT')) {
      const args = line.slice(9).trim();
      if (args) {
        const parts = args.split(',').map(Number);
        commands.push({ cmd: 'GAPDETECT', paperLen: parts[0], gapLen: parts[1] });
      } else {
        commands.push({ cmd: 'GAPDETECT' });
      }
      continue;
    }

    if (upperLine.startsWith('BLINEDETECT')) {
      const args = line.slice(11).trim();
      if (args) {
        const parts = args.split(',').map(Number);
        commands.push({ cmd: 'BLINEDETECT', paperLen: parts[0], gapLen: parts[1] });
      } else {
        commands.push({ cmd: 'BLINEDETECT' });
      }
      continue;
    }

    if (upperLine.startsWith('AUTODETECT')) {
      const args = line.slice(10).trim();
      if (args) {
        const parts = args.split(',').map(Number);
        commands.push({ cmd: 'AUTODETECT', paperLen: parts[0], gapLen: parts[1] });
      } else {
        commands.push({ cmd: 'AUTODETECT' });
      }
      continue;
    }

    if (upperLine.startsWith('BLINE') && !upperLine.startsWith('BLINEDETECT')) {
      const args = line.slice(5).trim();
      const parts = args.split(',').map((s) => s.trim());
      if (parts.length >= 2) {
        const h = parseUnit(parts[0]);
        const o = parseUnit(parts[1]);
        commands.push({ cmd: 'BLINE', height: h.value, offset: o.value, unit: h.unit });
      }
      continue;
    }

    if (upperLine.startsWith('OFFSET')) {
      const args = line.slice(6).trim();
      const o = parseUnit(args);
      commands.push({ cmd: 'OFFSET', distance: o.value, unit: o.unit });
      continue;
    }

    if (upperLine.startsWith('SPEED')) {
      const n = Number(line.slice(5).trim());
      commands.push({ cmd: 'SPEED', value: n });
      continue;
    }

    if (upperLine.startsWith('DENSITY')) {
      const n = Number(line.slice(7).trim());
      commands.push({ cmd: 'DENSITY', value: n });
      continue;
    }

    if (upperLine.startsWith('DIRECTION')) {
      const args = line.slice(9).trim().split(',').map(Number);
      commands.push({
        cmd: 'DIRECTION',
        direction: (args[0] ?? 0) as 0 | 1,
        mirror: args.length > 1 ? (args[1] as 0 | 1) : undefined,
      });
      continue;
    }

    if (upperLine.startsWith('REFERENCE')) {
      const args = line.slice(9).trim().split(',').map(Number);
      commands.push({ cmd: 'REFERENCE', x: args[0] ?? 0, y: args[1] ?? 0 });
      continue;
    }

    if (upperLine.startsWith('SHIFT')) {
      const args = line.slice(5).trim().split(',').map(Number);
      if (args.length >= 2) {
        commands.push({ cmd: 'SHIFT', x: args[0], y: args[1] });
      } else {
        commands.push({ cmd: 'SHIFT', y: args[0] ?? 0 });
      }
      continue;
    }

    if (upperLine.startsWith('COUNTRY')) {
      commands.push({ cmd: 'COUNTRY', code: line.slice(7).trim() });
      continue;
    }

    if (upperLine.startsWith('CODEPAGE')) {
      commands.push({ cmd: 'CODEPAGE', codepage: line.slice(8).trim() });
      continue;
    }

    if (upperLine === 'CLS') {
      commands.push({ cmd: 'CLS' });
      continue;
    }

    if (upperLine.startsWith('FEED') && !upperLine.startsWith('FEED_LEN')) {
      commands.push({ cmd: 'FEED', dots: Number(line.slice(4).trim()) });
      continue;
    }

    if (upperLine.startsWith('BACKFEED')) {
      commands.push({ cmd: 'BACKFEED', dots: Number(line.slice(8).trim()) });
      continue;
    }

    if (upperLine.startsWith('BACKUP')) {
      commands.push({ cmd: 'BACKUP', dots: Number(line.slice(6).trim()) });
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
      const args = line.slice(5).trim().split(',').map(Number);
      commands.push({ cmd: 'PRINT', sets: args[0] ?? 1, copies: args.length > 1 ? args[1] : undefined });
      continue;
    }

    if (upperLine.startsWith('SOUND')) {
      const args = line.slice(5).trim().split(',').map(Number);
      commands.push({ cmd: 'SOUND', level: args[0] ?? 0, interval: args[1] ?? 1 });
      continue;
    }

    if (upperLine === 'CUT') {
      commands.push({ cmd: 'CUT' });
      continue;
    }

    if (upperLine.startsWith('LIMITFEED')) {
      const args = line.slice(9).trim();
      const parts = args.split(',').map((s) => s.trim());
      const main = parseUnit(parts[0]);
      commands.push({
        cmd: 'LIMITFEED',
        maxLen: main.value,
        minPaper: parts.length > 1 ? Number(parts[1].replace(/\s*(mm|dot)/i, '')) : undefined,
        maxGap: parts.length > 2 ? Number(parts[2].replace(/\s*(mm|dot)/i, '')) : undefined,
        unit: main.unit,
      });
      continue;
    }

    if (upperLine.startsWith('SELFTEST')) {
      const page = line.slice(8).trim();
      commands.push({ cmd: 'SELFTEST', page: page || undefined });
      continue;
    }

    if (upperLine === 'EOJ') {
      commands.push({ cmd: 'EOJ' });
      continue;
    }

    if (upperLine.startsWith('DELAY')) {
      commands.push({ cmd: 'DELAY', ms: Number(line.slice(5).trim()) });
      continue;
    }

    if (upperLine.startsWith('DISPLAY')) {
      commands.push({ cmd: 'DISPLAY', params: line.slice(7).trim() });
      continue;
    }

    if (upperLine === 'INITIALPRINTER') {
      commands.push({ cmd: 'INITIALPRINTER' });
      continue;
    }

    if (upperLine.startsWith('TEXT ')) {
      const args = line.slice(5).trim();
      const params = splitParams(args);
      if (params.length >= 7) {
        const x = Number(params[0]);
        const y = Number(params[1]);
        const font = unquote(params[2]);
        const rotation = Number(params[3]);
        const xMul = Number(params[4]);
        const yMul = Number(params[5]);
        let alignment: number | undefined;
        let content: string;

        if (params.length >= 8) {
          const possibleAlign = Number(params[6]);
          if (!Number.isNaN(possibleAlign) && possibleAlign >= 0 && possibleAlign <= 3 && params.length >= 8) {
            alignment = possibleAlign;
            content = unquote(params[7]);
          } else {
            content = unquote(params[6]);
          }
        } else {
          content = unquote(params[6]);
        }

        commands.push({ cmd: 'TEXT', x, y, font, rotation, xMul, yMul, alignment, content });
        elements.push({ type: 'text', content, options: { x, y, font, rotation, size: xMul } });
      }
      continue;
    }

    if (upperLine.startsWith('BLOCK ')) {
      const args = line.slice(6).trim();
      const params = splitParams(args);
      if (params.length >= 9) {
        const x = Number(params[0]);
        const y = Number(params[1]);
        const width = Number(params[2]);
        const height = Number(params[3]);
        const font = unquote(params[4]);
        const rotation = Number(params[5]);
        const xMul = Number(params[6]);
        const yMul = Number(params[7]);
        const content = unquote(params[params.length - 1]);

        commands.push({ cmd: 'BLOCK', x, y, width, height, font, rotation, xMul, yMul, content });
        elements.push({ type: 'text', content, options: { x, y, font, rotation, size: xMul, maxWidth: width } });
      }
      continue;
    }

    if (upperLine.startsWith('BARCODE ')) {
      const args = line.slice(8).trim();
      const params = splitParams(args);
      if (params.length >= 9) {
        const x = Number(params[0]);
        const y = Number(params[1]);
        const type = unquote(params[2]);
        const height = Number(params[3]);
        const readable = Number(params[4]);
        const rotation = Number(params[5]);
        const narrow = Number(params[6]);
        const wide = Number(params[7]);
        let alignment: number | undefined;
        let content: string;

        if (params.length >= 10) {
          const possibleAlign = Number(params[8]);
          if (!Number.isNaN(possibleAlign) && possibleAlign >= 0 && possibleAlign <= 3 && params.length >= 10) {
            alignment = possibleAlign;
            content = unquote(params[9]);
          } else {
            content = unquote(params[8]);
          }
        } else {
          content = unquote(params[8]);
        }

        commands.push({ cmd: 'BARCODE', x, y, type, height, readable, rotation, narrow, wide, alignment, content });
      }
      continue;
    }

    if (upperLine.startsWith('BAR ')) {
      const args = line.slice(4).trim().split(',').map(Number);
      if (args.length >= 4) {
        const x = args[0];
        const y = args[1];
        const w = args[2];
        const h = args[3];
        commands.push({ cmd: 'BAR', x, y, width: w, height: h });
        elements.push({
          type: 'line',
          options: {
            x1: x,
            y1: y,
            x2: x + (w > h ? w : 0),
            y2: y + (h > w ? h : 0),
            thickness: Math.min(w, h),
          },
        });
      }
      continue;
    }

    if (upperLine.startsWith('BOX ')) {
      const args = line.slice(4).trim().split(',').map(Number);
      if (args.length >= 5) {
        const x = args[0];
        const y = args[1];
        const xEnd = args[2];
        const yEnd = args[3];
        const t = args[4];
        const r = args.length >= 6 ? args[5] : undefined;
        commands.push({ cmd: 'BOX', x, y, xEnd, yEnd, thickness: t, radius: r });
        elements.push({ type: 'box', options: { x, y, width: xEnd - x, height: yEnd - y, thickness: t, radius: r } });
      }
      continue;
    }

    if (upperLine.startsWith('CIRCLE ')) {
      const args = line.slice(7).trim().split(',').map(Number);
      if (args.length >= 4) {
        commands.push({ cmd: 'CIRCLE', x: args[0], y: args[1], diameter: args[2], thickness: args[3] });
        elements.push({ type: 'circle', options: { x: args[0], y: args[1], diameter: args[2], thickness: args[3] } });
      }
      continue;
    }

    if (upperLine.startsWith('ELLIPSE ')) {
      const args = line.slice(8).trim().split(',').map(Number);
      if (args.length >= 5) {
        commands.push({ cmd: 'ELLIPSE', x: args[0], y: args[1], width: args[2], height: args[3], thickness: args[4] });
      }
      continue;
    }

    if (upperLine.startsWith('DIAGONAL ')) {
      const args = line.slice(9).trim().split(',').map(Number);
      if (args.length >= 5) {
        commands.push({ cmd: 'DIAGONAL', x1: args[0], y1: args[1], x2: args[2], y2: args[3], thickness: args[4] });
        elements.push({ type: 'line', options: { x1: args[0], y1: args[1], x2: args[2], y2: args[3], thickness: args[4] } });
      }
      continue;
    }

    if (upperLine.startsWith('REVERSE ')) {
      const args = line.slice(8).trim().split(',').map(Number);
      if (args.length >= 4) {
        commands.push({ cmd: 'REVERSE', x: args[0], y: args[1], width: args[2], height: args[3] });
      }
      continue;
    }

    if (upperLine.startsWith('ERASE ')) {
      const args = line.slice(6).trim().split(',').map(Number);
      if (args.length >= 4) {
        commands.push({ cmd: 'ERASE', x: args[0], y: args[1], width: args[2], height: args[3] });
      }
      continue;
    }

    if (upperLine.startsWith('BITMAP ')) {
      const args = line.slice(7).trim();
      const params = args.split(',');
      if (params.length >= 5) {
        commands.push({
          cmd: 'BITMAP',
          x: Number(params[0]),
          y: Number(params[1]),
          widthBytes: Number(params[2]),
          height: Number(params[3]),
          mode: Number(params[4]),
        });
      }
      continue;
    }

    if (upperLine.startsWith('QRCODE ')) {
      const args = line.slice(7).trim();
      const params = splitParams(args);
      if (params.length >= 7) {
        const x = Number(params[0]);
        const y = Number(params[1]);
        const ecc = params[2];
        const cellWidth = Number(params[3]);
        const mode = params[4];
        const rotation = Number(params[5]);
        let model: string | undefined;
        let mask: string | undefined;
        let content: string;

        if (params.length >= 9) {
          model = params[6];
          mask = params[7];
          content = unquote(params[8]);
        } else {
          content = unquote(params[6]);
        }

        commands.push({ cmd: 'QRCODE', x, y, ecc, cellWidth, mode, rotation, model, mask, content });
      }
      continue;
    }

    if (upperLine.startsWith('DMATRIX ')) {
      const args = line.slice(8).trim();
      const params = splitParams(args);
      if (params.length >= 5) {
        commands.push({
          cmd: 'DMATRIX',
          x: Number(params[0]),
          y: Number(params[1]),
          width: Number(params[2]),
          height: Number(params[3]),
          content: unquote(params[params.length - 1]),
        });
      }
      continue;
    }

    if (upperLine.startsWith('PDF417 ')) {
      const args = line.slice(7).trim();
      const params = splitParams(args);
      if (params.length >= 6) {
        commands.push({
          cmd: 'PDF417',
          x: Number(params[0]),
          y: Number(params[1]),
          width: Number(params[2]),
          height: Number(params[3]),
          rotation: Number(params[4]),
          options: params.slice(5, -1),
          content: unquote(params[params.length - 1]),
        });
      }
      continue;
    }

    if (upperLine.startsWith('AZTEC ')) {
      const args = line.slice(6).trim();
      const params = splitParams(args);
      if (params.length >= 4) {
        commands.push({
          cmd: 'AZTEC',
          x: Number(params[0]),
          y: Number(params[1]),
          rotation: Number(params[2]),
          content: unquote(params[params.length - 1]),
        });
      }
      continue;
    }

    if (upperLine.startsWith('MAXICODE ')) {
      const args = line.slice(9).trim();
      const params = splitParams(args);
      if (params.length >= 4) {
        commands.push({
          cmd: 'MAXICODE',
          x: Number(params[0]),
          y: Number(params[1]),
          mode: Number(params[2]),
          params: params.slice(3, -1).join(','),
          content: unquote(params[params.length - 1]),
        });
      }
      continue;
    }

    if (upperLine.startsWith('MPDF417 ')) {
      const args = line.slice(8).trim();
      const params = splitParams(args);
      if (params.length >= 4) {
        commands.push({
          cmd: 'MPDF417',
          x: Number(params[0]),
          y: Number(params[1]),
          rotation: Number(params[2]),
          options: params.slice(3, -1),
          content: unquote(params[params.length - 1]),
        });
      }
      continue;
    }

    if (upperLine.startsWith('RSS ')) {
      const args = line.slice(4).trim();
      const params = splitParams(args);
      if (params.length >= 7) {
        commands.push({
          cmd: 'RSS',
          x: Number(params[0]),
          y: Number(params[1]),
          sym: unquote(params[2]),
          rotation: Number(params[3]),
          pixMult: Number(params[4]),
          sepHt: Number(params[5]),
          content: unquote(params[params.length - 1]),
        });
      }
      continue;
    }

    if (upperLine.startsWith('CODABLOCK ')) {
      const args = line.slice(10).trim();
      const params = splitParams(args);
      if (params.length >= 4) {
        commands.push({
          cmd: 'CODABLOCK',
          x: Number(params[0]),
          y: Number(params[1]),
          rotation: Number(params[2]),
          content: unquote(params[params.length - 1]),
        });
      }
      continue;
    }

    if (upperLine.startsWith('TLC39 ')) {
      const args = line.slice(6).trim();
      const params = splitParams(args);
      if (params.length >= 4) {
        commands.push({
          cmd: 'TLC39',
          x: Number(params[0]),
          y: Number(params[1]),
          rotation: Number(params[2]),
          content: unquote(params[params.length - 1]),
        });
      }
      continue;
    }

    if (upperLine.startsWith('PUTBMP ')) {
      const args = line.slice(7).trim();
      const params = splitParams(args);
      if (params.length >= 3) {
        commands.push({
          cmd: 'PUTBMP',
          x: Number(params[0]),
          y: Number(params[1]),
          filename: unquote(params[2]),
          bpp: params.length > 3 ? Number(params[3]) : undefined,
          contrast: params.length > 4 ? Number(params[4]) : undefined,
        });
      }
      continue;
    }

    if (upperLine.startsWith('PUTPCX ')) {
      const args = line.slice(7).trim();
      const params = splitParams(args);
      if (params.length >= 3) {
        commands.push({ cmd: 'PUTPCX', x: Number(params[0]), y: Number(params[1]), filename: unquote(params[2]) });
      }
      continue;
    }

    if (line.startsWith('\x1b!') || line.startsWith('~!')) {
      commands.push({ cmd: 'STATUS_QUERY', type: line });
      continue;
    }

    if (upperLine.startsWith('SET ')) {
      const rest = line.slice(4).trim();
      const spaceIdx = rest.indexOf(' ');
      if (spaceIdx > 0) {
        commands.push({ cmd: 'SET', key: rest.slice(0, spaceIdx), value: rest.slice(spaceIdx + 1).trim() });
      } else {
        commands.push({ cmd: 'SET', key: rest, value: '' });
      }
      continue;
    }

    if (upperLine.startsWith('DOWNLOAD')) {
      const args = line.slice(8).trim();
      const params = splitParams(args);
      commands.push({ cmd: 'DOWNLOAD', filename: unquote(params[params.length - 1] ?? '') });
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
      const args = line.slice(4).trim();
      commands.push({ cmd: 'KILL', filename: unquote(args) });
      continue;
    }

    if (upperLine === 'MOVE') {
      commands.push({ cmd: 'MOVE' });
      continue;
    }

    if (upperLine.startsWith('RUN')) {
      commands.push({ cmd: 'RUN', filename: unquote(line.slice(3).trim()) });
      continue;
    }

    if (upperLine.startsWith('FOR ')) {
      const m = line.match(/^FOR\s+(\w+)\s*=\s*(.+?)\s+TO\s+(.+?)(?:\s+STEP\s+(.+))?$/i);
      if (m) {
        commands.push({ cmd: 'FOR', variable: m[1], start: m[2], end: m[3], step: m[4] });
      }
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
      commands.push({ cmd: 'IF', condition: line.slice(3).replace(/\s+THEN\s*$/i, '').trim() });
      continue;
    }

    if (upperLine.startsWith('THEN ') || upperLine === 'THEN') {
      commands.push({ cmd: 'THEN', statement: line.slice(5).trim() });
      continue;
    }

    if (upperLine.startsWith('ELSE') && (upperLine === 'ELSE' || upperLine.startsWith('ELSE ') || upperLine.startsWith('ELSEIF'))) {
      commands.push({ cmd: 'ELSE', statement: line.slice(4).trim() || undefined });
      continue;
    }

    if (upperLine.startsWith('WHILE ')) {
      commands.push({ cmd: 'WHILE', condition: line.slice(6).trim() });
      continue;
    }

    if (upperLine.startsWith('DO')) {
      commands.push({ cmd: 'DO', condition: line.slice(2).trim() || undefined });
      continue;
    }

    if (upperLine.startsWith('LOOP')) {
      commands.push({ cmd: 'LOOP', condition: line.slice(4).trim() || undefined });
      continue;
    }

    if (upperLine.startsWith('GOTO ')) {
      commands.push({ cmd: 'GOTO', label: line.slice(5).trim() });
      continue;
    }

    if (upperLine.startsWith('GOSUB ')) {
      commands.push({ cmd: 'GOSUB', label: line.slice(6).trim() });
      continue;
    }

    if (upperLine.startsWith('REM ') || upperLine === 'REM') {
      commands.push({ cmd: 'REM', comment: line.slice(3).trim() });
      continue;
    }

    if (upperLine.startsWith('INPUT ')) {
      commands.push({ cmd: 'INPUT', prompt: undefined, variable: line.slice(6).trim() });
      continue;
    }

    if (upperLine.startsWith('OUT ')) {
      commands.push({ cmd: 'OUT', port: undefined, data: line.slice(4).trim() });
      continue;
    }

    if (upperLine.startsWith('OPEN ')) {
      commands.push({ cmd: 'OPEN', params: line.slice(5).trim() });
      continue;
    }

    if (upperLine.startsWith('CLOSE ')) {
      commands.push({ cmd: 'CLOSE', handle: line.slice(6).trim() });
      continue;
    }

    if (upperLine.startsWith('WRITE ')) {
      const parts = line.slice(6).trim().split(',', 2);
      commands.push({ cmd: 'WRITE', handle: parts[0].trim(), data: (parts[1] ?? '').trim() });
      continue;
    }

    if (upperLine.startsWith('READ ')) {
      const parts = line.slice(5).trim().split(',', 2);
      commands.push({ cmd: 'READ', handle: parts[0].trim(), variable: (parts[1] ?? '').trim() });
      continue;
    }

    if (upperLine.startsWith('SEEK ')) {
      const parts = line.slice(5).trim().split(',', 2);
      commands.push({ cmd: 'SEEK', handle: parts[0].trim(), offset: (parts[1] ?? '').trim() });
      continue;
    }

    if (upperLine.startsWith('COPY ')) {
      commands.push({ cmd: 'COPY', params: line.slice(5).trim() });
      continue;
    }

    if (line.endsWith(':') && !line.includes(',')) {
      commands.push({ cmd: 'LABEL', name: line.slice(0, -1).trim() });
      continue;
    }

    if (upperLine.startsWith('NET ')) {
      const parts = line.slice(4).trim().split(/\s+/, 2);
      commands.push({ cmd: 'NET', subcommand: parts[0], params: parts[1] ?? '' });
      continue;
    }

    if (upperLine.startsWith('WLAN ')) {
      const parts = line.slice(5).trim().split(/\s+/, 2);
      commands.push({ cmd: 'WLAN', subcommand: parts[0], params: parts[1] ?? '' });
      continue;
    }

    if (upperLine.startsWith('NFC ')) {
      const parts = line.slice(4).trim().split(/\s+/, 2);
      commands.push({ cmd: 'NFC', subcommand: parts[0], params: parts[1] });
      continue;
    }

    if (upperLine.startsWith('SET GPO')) {
      commands.push({ cmd: 'SET_GPO', params: line.slice(7).trim() });
      continue;
    }

    if (upperLine.startsWith('SET GPI')) {
      commands.push({ cmd: 'SET_GPI', params: line.slice(7).trim() });
      continue;
    }

    if (upperLine.startsWith('GETSENSOR')) {
      commands.push({ cmd: 'GETSENSOR', params: line.slice(9).trim() });
      continue;
    }

    if (upperLine.startsWith('GETSETTING')) {
      commands.push({ cmd: 'GETSETTING', params: line.slice(10).trim() });
      continue;
    }

    if (line.includes('=') && !upperLine.startsWith('SET ') && /^[@\w$]+\s*=/.test(line)) {
      const eqIdx = line.indexOf('=');
      commands.push({ cmd: 'ASSIGNMENT', variable: line.slice(0, eqIdx).trim(), value: line.slice(eqIdx + 1).trim() });
      continue;
    }

    commands.push({ cmd: 'UNKNOWN', raw: line });
  }

  return { commands, widthDots, heightDots, dpi, elements, warnings };
}

/** Simplified parse — just the label dimensions and preview-renderable elements, for callers that don't need every raw command. */
export function parseTSC(code: string): { widthDots: number; heightDots: number; elements: PrintElement[] } {
  const result = parseTSPL(code);
  return { widthDots: result.widthDots, heightDots: result.heightDots, elements: result.elements };
}

/** Decodes a TSPL/TSPL2 command string into structured commands (line-oriented, per-command grammar). */
export class TscParser implements PrintParser<{ commands: unknown[]; warnings: string[] }> {
  parse(source: string | Uint8Array): { commands: unknown[]; warnings: string[] } {
    const code = typeof source === 'string' ? source : new TextDecoder().decode(source);
    return parseTSPL(code);
  }
}
