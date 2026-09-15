import { parseDPL } from '../../parser/dpl/DplParser';
import type { PrintValidation } from '../../core';
import type { ValidationIssue } from '../ValidationIssue';
import type { ValidationResult } from '../ValidationResult';

const MIN_DENSITY = 0;
/** DPL's `D` command is a 1-2 digit field (`DplParser`'s own `/^D\d{1,2}$/` gate caps it at 99), but Datamax/Honeywell hardware's actual documented darkness range is narrower — 0-30 — so this check can still catch a parseable-but-out-of-hardware-range value like `D50`. */
const MAX_DENSITY = 30;
const MIN_SPEED = 1;
const MAX_SPEED = 12;

/**
 * Validates DPL source — net new, since portakal has no real DPL validation
 * logic to port (its `src/validate.ts` `default:` branch, which DPL falls
 * into, just pushes one generic info message). Follows `EscPosValidator.ts`'s
 * precedent of real, useful checks instead of a stub: command
 * presence/ordering (`<STX>L` first, `A` present, `E` present), `S`/`D`
 * range checks, and unrecognized command lines. Re-parses the source via
 * `parseDPL()` to inspect the same structured commands `DplParser` produces
 * — unlike `EplValidator`, no separate known-command set is needed here,
 * since `parseDPL()` already buckets anything it doesn't recognize into an
 * `'OTHER'` command.
 */
export class DplValidator implements PrintValidation {
  validate(source: string): ValidationResult {
    if (!source.trim()) {
      return { valid: false, issues: [{ level: 'error', message: 'Empty input' }], errors: 1, warnings: 0, infos: 0 };
    }

    const issues: ValidationIssue[] = [];
    const { commands } = parseDPL(source);

    if (commands.length === 0 || commands[0].type !== 'STX_L') {
      issues.push({ level: 'warning', command: 'STX_L', message: '<STX>L (enter label format) should be the first command' });
    }

    if (!commands.some((c) => c.type === 'WIDTH')) {
      issues.push({ level: 'warning', command: 'A', message: 'A (label width) not found — label width undefined' });
    }

    if (!commands.some((c) => c.type === 'E')) {
      issues.push({ level: 'warning', command: 'E', message: 'No E command found — label will not print' });
    }

    for (const c of commands) {
      if (c.type === 'SPEED') {
        const speed = Number(c.params);
        if (speed < MIN_SPEED || speed > MAX_SPEED) {
          issues.push({ level: 'warning', command: 'S', message: `S value ${speed} may be out of range (1-12, model-dependent)` });
        }
      }

      if (c.type === 'DENSITY') {
        const density = Number(c.params);
        if (density < MIN_DENSITY || density > MAX_DENSITY) {
          issues.push({ level: 'error', command: 'D', message: `D value ${density} out of range (0-30)` });
        }
      }

      if (c.type === 'OTHER') {
        issues.push({ level: 'warning', command: c.params, message: `Unrecognized command: ${c.params}` });
      }
    }

    const errors = issues.filter((i) => i.level === 'error').length;
    const warningCount = issues.filter((i) => i.level === 'warning').length;
    const infos = issues.filter((i) => i.level === 'info').length;

    return { valid: errors === 0, issues, errors, warnings: warningCount, infos };
  }
}
