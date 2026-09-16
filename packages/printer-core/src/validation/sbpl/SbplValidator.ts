import { parseSBPL } from '../../parser/sbpl/SbplParser';
import type { PrintValidation } from '../../core';
import type { ValidationIssue } from '../ValidationIssue';
import type { ValidationResult } from '../ValidationResult';

/**
 * Command types `SbplParser`'s `parseSBPL()` recognizes — anything outside
 * this set fell through to its `default:` branch (a raw, unmapped `<ESC>`
 * letter) and is flagged below as unrecognized, the same category of
 * finding `CpclValidator`/`DplValidator` compute from their own parsers'
 * command lists.
 */
const KNOWN_SBPL_COMMANDS = new Set(['START', 'END', 'CLEAR', 'H', 'V', 'L', 'ROTATION', 'TEXT', 'K', 'BARCODE_B', 'BARCODE_D', 'GRAPHIC', 'DRAW', 'QUANTITY', '2D_BARCODE']);

/**
 * Validates SBPL source — net new, since portakal has no real SBPL
 * validation logic to port (`src/validate.ts`'s `default:` branch, which
 * every not-TSC/not-ZPL language falls into, SBPL included, just pushes one
 * generic info message). Follows `EscPosValidator.ts`'s precedent of real,
 * useful checks instead of a stub: command presence/ordering (`<ESC>A`
 * first, `<ESC>CS`/`<ESC>Z` present), a sanity check on the `Q` (quantity)
 * field's value, and unrecognized commands. Re-parses the source via
 * `parseSBPL()` to inspect the same structured commands `SbplParser`
 * produces, same pattern `CpclValidator`/`DplValidator` use for their own
 * checks.
 */
export class SbplValidator implements PrintValidation {
  validate(source: string): ValidationResult {
    if (!source.trim()) {
      return { valid: false, issues: [{ level: 'error', message: 'Empty input' }], errors: 1, warnings: 0, infos: 0 };
    }

    const issues: ValidationIssue[] = [];
    const { commands } = parseSBPL(source);

    if (commands.length === 0 || commands[0].cmd !== 'START') {
      issues.push({ level: 'warning', command: 'A', message: '<ESC>A (start of format) should be the first command' });
    }

    if (!commands.some((c) => c.cmd === 'CLEAR')) {
      issues.push({ level: 'warning', command: 'CS', message: '<ESC>CS (clear buffer) not found' });
    }

    if (!commands.some((c) => c.cmd === 'END')) {
      issues.push({ level: 'warning', command: 'Z', message: '<ESC>Z (end of format) not found — label will not print' });
    }

    for (const c of commands) {
      if (c.cmd === 'QUANTITY') {
        const quantity = Number(c.params);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          issues.push({ level: 'error', command: 'Q', message: `Q value ${c.params} is not a positive copy count` });
        }
      }

      if (!KNOWN_SBPL_COMMANDS.has(c.cmd)) {
        issues.push({ level: 'warning', command: c.cmd, message: `Unrecognized command: ${c.cmd}` });
      }
    }

    const errors = issues.filter((i) => i.level === 'error').length;
    const warningCount = issues.filter((i) => i.level === 'warning').length;
    const infos = issues.filter((i) => i.level === 'info').length;

    return { valid: errors === 0, issues, errors, warnings: warningCount, infos };
  }
}
