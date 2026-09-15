import { parseZPL } from '../../parser/zpl/ZplParser';
import type { PrintValidation } from '../../core';
import type { ValidationIssue } from '../ValidationIssue';
import type { ValidationResult } from '../ValidationResult';

const MIN_PRINT_WIDTH = 2;
const MAX_PRINT_WIDTH = 65535;

/**
 * Validates ZPL II source: format bracketing (`^XA` first, `^XZ` last), an
 * `^FD` with no preceding `^FO`/`^FT` in the same field, `^PW`'s valid
 * range, and unrecognized commands forwarded from the parser — ported
 * directly from portakal's `validateZPL()` (`src/validate.ts` lines
 * 144-189), one of only two languages in portakal with real validation
 * logic (the other being TSC). It re-parses the source via `parseZPL()` to
 * inspect the same structured commands `ZplParser` produces.
 */
export class ZplValidator implements PrintValidation {
  validate(source: string): ValidationResult {
    if (!source.trim()) {
      return { valid: false, issues: [{ level: 'error', message: 'Empty input' }], errors: 1, warnings: 0, infos: 0 };
    }

    const issues: ValidationIssue[] = [];
    const { commands, warnings } = parseZPL(source);

    if (commands.length === 0 || commands[0].code !== '^XA') {
      issues.push({ level: 'error', command: '^XA', message: 'Label must start with ^XA' });
    }

    if (commands.length === 0 || commands[commands.length - 1].code !== '^XZ') {
      issues.push({ level: 'error', command: '^XZ', message: 'Label must end with ^XZ' });
    }

    let hasFieldOrigin = false;
    for (const c of commands) {
      if (c.code === '^FO' || c.code === '^FT') hasFieldOrigin = true;
      if (c.code === '^FD' && !hasFieldOrigin) {
        issues.push({ level: 'warning', command: '^FD', message: '^FD without preceding ^FO — field position undefined' });
      }
      if (c.code === '^FS') hasFieldOrigin = false;
    }

    const pw = commands.find((c) => c.code === '^PW');
    if (pw && pw.params[0]) {
      const w = Number(pw.params[0]);
      if (w < MIN_PRINT_WIDTH || w > MAX_PRINT_WIDTH) {
        issues.push({ level: 'error', command: '^PW', message: `^PW value ${w} out of range (2-65535)` });
      }
    }

    for (const w of warnings) {
      issues.push({ level: 'warning', message: w });
    }

    const errors = issues.filter((i) => i.level === 'error').length;
    const warningCount = issues.filter((i) => i.level === 'warning').length;
    const infos = issues.filter((i) => i.level === 'info').length;

    return { valid: errors === 0, issues, errors, warnings: warningCount, infos };
  }
}
