import { parseTSPL } from '../../parser/tsc/TscParser';
import type { PrintValidation } from '../../core';
import type { ValidationIssue } from '../ValidationIssue';
import type { ValidationResult } from '../ValidationResult';

const MIN_DENSITY = 0;
const MAX_DENSITY = 15;
const MIN_SPEED = 1;
const MAX_SPEED = 18;

/** How much of an `UNKNOWN` command's raw text to surface, for the `command` field vs. the full `message`. */
const UNKNOWN_COMMAND_PREVIEW_LENGTH = 20;
const UNKNOWN_MESSAGE_PREVIEW_LENGTH = 40;

/** Commands that draw something on the label — used to check `CLS` comes before the first one. */
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
 * Validates TSC/TSPL2 source: command order (`SIZE` first, `CLS` before any
 * label element, `PRINT` present), `DENSITY`/`SPEED` ranges, and unrecognized
 * commands — ported from portakal's `validateTSC()` (`src/validate.ts` lines
 * 64-142), which itself re-parses the source via `parseTSPL()` to inspect
 * the same structured commands `TscParser` produces.
 */
export class TscValidator implements PrintValidation {
  validate(source: string): ValidationResult {
    if (!source.trim()) {
      return { valid: false, issues: [{ level: 'error', message: 'Empty input' }], errors: 1, warnings: 0, infos: 0 };
    }

    const issues: ValidationIssue[] = [];
    const { commands } = parseTSPL(source);

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
