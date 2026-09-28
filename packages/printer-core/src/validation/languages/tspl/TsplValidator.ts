import type { PrintValidation } from '../../../core';
import { TsplParser } from '../../../language';
import type { ValidationIssue } from '../../ValidationIssue';
import type { ValidationResult } from '../../ValidationResult';

const MIN_DENSITY = 0;
const MAX_DENSITY = 15;
const MIN_SPEED = 1;
const MAX_SPEED = 18;

/** Số ký tự của lệnh `UNKNOWN` hiển thị ở field `command` (ngắn) so với `message` (đầy đủ hơn). */
const UNKNOWN_COMMAND_PREVIEW_LENGTH = 20;
const UNKNOWN_MESSAGE_PREVIEW_LENGTH = 40;

/** Lệnh vẽ lên tem — `CLS` phải đứng trước lệnh đầu tiên trong nhóm này. */
const LABEL_ELEMENT_COMMANDS = new Set([
  'TEXT',
  'BLOCK',
  'BAR',
  'BOX',
  'CIRCLE',
  'ELLIPSE',
  'BITMAP',
  'BARCODE',
  'QRCODE',
  'DMATRIX',
  'PDF417',
  'AZTEC',
  'MAXICODE',
  'RSS',
]);

/**
 * Kiểm tra lệnh TSPL/TSPL2: thứ tự lệnh (`SIZE` đầu tiên, `CLS` trước mọi element, có `PRINT`), khoảng giá trị
 * `DENSITY`/`SPEED` và lệnh không nhận ra. Parse lại bằng `TsplParser` để kiểm tra trên cùng cấu trúc lệnh với parser.
 */
export class TsplValidator implements PrintValidation {
  validate(source: string): ValidationResult {
    if (!source.trim()) {
      return { valid: false, issues: [{ level: 'error', message: 'Empty input' }], errors: 1, warnings: 0, infos: 0 };
    }

    const issues: ValidationIssue[] = [];
    const { commands } = new TsplParser().parse(source);

    const firstCmd = commands.find((c) => c.cmd !== 'UNKNOWN' && c.cmd !== 'REM');
    if (firstCmd && firstCmd.cmd !== 'SIZE') {
      issues.push({ level: 'warning', command: 'SIZE', message: 'SIZE should be the first command' });
    }

    const clsIdx = commands.findIndex((c) => c.cmd === 'CLS');
    const firstElement = commands.findIndex((c) => LABEL_ELEMENT_COMMANDS.has(c.cmd));
    if (firstElement >= 0 && (clsIdx < 0 || clsIdx > firstElement)) {
      issues.push({ level: 'error', command: 'CLS', message: 'CLS must appear before label elements (TEXT, BOX, etc.)' });
    }

    const printIdx = commands.findIndex((c) => c.cmd === 'PRINT');
    if (printIdx < 0) {
      issues.push({ level: 'warning', command: 'PRINT', message: 'No PRINT command found — label will not print' });
    }

    for (const c of commands) {
      if (c.cmd === 'DENSITY' && (c.value < MIN_DENSITY || c.value > MAX_DENSITY)) {
        issues.push({ level: 'error', command: 'DENSITY', message: `DENSITY value ${c.value} out of range (0-15)` });
      }
      if (c.cmd === 'SPEED' && (c.value < MIN_SPEED || c.value > MAX_SPEED)) {
        issues.push({ level: 'warning', command: 'SPEED', message: `SPEED value ${c.value} may be out of range (1-18, model-dependent)` });
      }
      if (c.cmd === 'UNKNOWN') {
        issues.push({
          level: 'warning',
          command: c.raw.slice(0, UNKNOWN_COMMAND_PREVIEW_LENGTH),
          message: `Unrecognized command: ${c.raw.slice(0, UNKNOWN_MESSAGE_PREVIEW_LENGTH)}`,
        });
      }
    }

    const errors = issues.filter((i) => i.level === 'error').length;
    const warnings = issues.filter((i) => i.level === 'warning').length;
    const infos = issues.filter((i) => i.level === 'info').length;

    return { valid: errors === 0, issues, errors, warnings, infos };
  }
}
