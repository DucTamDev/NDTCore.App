import { parseIPL } from '../../parser/ipl/IplParser';
import type { PrintValidation } from '../../core';
import type { ValidationIssue } from '../ValidationIssue';
import type { ValidationResult } from '../ValidationResult';

/**
 * `<SI>S` is a raw two-character numeral in practice (`IplCompiler` emits
 * `speed` followed by a fixed trailing `0`, e.g. speed 6 -> `"60"`), so the
 * broadest sane bound for a hand-authored or round-tripped value is a plain
 * two-digit range — not a re-derivation of the original single speed digit,
 * which this validator has no reliable way to recover from the raw text.
 */
const MIN_SPEED = 0;
const MAX_SPEED = 99;
/** Approximate, model-dependent darkness scale — same hedge as `DplValidator`'s, since no Intermec-specific manual confirmed this exact bound. */
const MIN_DENSITY = 0;
const MAX_DENSITY = 30;

/**
 * Validates IPL source — net new, since portakal has no real IPL validation
 * logic to port (its `src/validate.ts` `default:` branch, which IPL falls
 * into, just pushes one generic info message). Follows `EscPosValidator.ts`'s
 * /`DplValidator.ts`'s precedent of real, useful checks instead of a stub:
 * command presence/ordering (`ESC C` first, `<SI>W` present, `R` present,
 * `ESC E` present), `S`/`d` range checks, and unrecognized frames.
 * Re-parses the source via `parseIPL()` to inspect the same structured
 * commands `IplParser` produces.
 */
export class IplValidator implements PrintValidation {
  validate(source: string): ValidationResult {
    if (!source.trim()) {
      return { valid: false, issues: [{ level: 'error', message: 'Empty input' }], errors: 1, warnings: 0, infos: 0 };
    }

    const issues: ValidationIssue[] = [];
    const { commands } = parseIPL(source);

    if (commands.length === 0 || commands[0]?.type !== 'CREATE_FORMAT') {
      issues.push({ level: 'warning', command: 'C', message: 'ESC C (create format) should be the first command' });
    }

    if (!commands.some((c) => c.type === 'LABEL_WIDTH')) {
      issues.push({ level: 'warning', command: 'W', message: '<SI>W (label width) not found — label width undefined' });
    }

    if (!commands.some((c) => c.type === 'PRINT')) {
      issues.push({ level: 'warning', command: 'R', message: 'No R (print) command found — label will not print' });
    }

    if (!commands.some((c) => c.type === 'END_FORMAT')) {
      issues.push({ level: 'warning', command: 'E', message: 'No ESC E (end format) command found — format is never closed' });
    }

    for (const c of commands) {
      if (c.type === 'SPEED') {
        const speed = Number(c.params);
        if (Number.isNaN(speed) || speed < MIN_SPEED || speed > MAX_SPEED) {
          issues.push({ level: 'warning', command: 'S', message: `S value ${c.params} may be out of range (0-99)` });
        }
      }

      if (c.type === 'DARKNESS') {
        const density = Number(c.params);
        if (Number.isNaN(density) || density < MIN_DENSITY || density > MAX_DENSITY) {
          issues.push({ level: 'error', command: 'd', message: `d value ${c.params} out of range (0-30)` });
        }
      }

      if (c.type === 'UNKNOWN') {
        issues.push({ level: 'warning', command: c.params, message: `Unrecognized command: ${c.params}` });
      }
    }

    const errors = issues.filter((i) => i.level === 'error').length;
    const warningCount = issues.filter((i) => i.level === 'warning').length;
    const infos = issues.filter((i) => i.level === 'info').length;

    return { valid: errors === 0, issues, errors, warnings: warningCount, infos };
  }
}
