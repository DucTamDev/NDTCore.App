import { parseCPCL } from '../../parser/cpcl/CpclParser';
import type { PrintValidation } from '../../core';
import type { ValidationIssue } from '../ValidationIssue';
import type { ValidationResult } from '../ValidationResult';

const MIN_TONE = 0;
const MAX_TONE = 200;
const MIN_SPEED = 1;
const MAX_SPEED = 6;

/**
 * Command verbs `CpclParser`'s `parseCPCL()` recognizes — the ones it decodes
 * into elements/dimensions plus the ones it only records without turning
 * into an element — anything outside this set is flagged
 * below as unrecognized, the same category of finding `EplValidator`/
 * `ZplValidator` forward from their own parsers' `warnings` array. `TEXT`-
 * family verbs (`TEXT`, `TEXT90`, `TEXT180`, `TEXT270`) are matched by prefix
 * rather than listed individually, mirroring `CpclParser`'s own
 * `cmd.startsWith('TEXT')` check. `parseCPCL` itself doesn't collect this
 * list (ported faithfully from portakal's own `parseCPCL()`, which has no
 * unrecognized-command warning either), so this check is computed directly
 * here instead.
 */
const KNOWN_CPCL_COMMANDS = new Set(['!', 'T', 'VTEXT', 'BOX', 'LINE', 'PAGE-WIDTH', 'TONE', 'SPEED', 'BARCODE', 'EG', 'CG', 'PRINT', 'CENTER', 'LEFT', 'RIGHT']);

/**
 * Validates CPCL source — net new, since portakal has no real CPCL
 * validation logic to port: `src/validate.ts`'s `default:` branch (which
 * every not-TSC/not-ZPL language falls into, CPCL included) just pushes one
 * generic info message. Follows `EscPosValidator.ts`'s precedent of real,
 * useful checks instead of a stub: command presence/ordering (`!` first,
 * `PAGE-WIDTH` present, `PRINT` present), `TONE`/`SPEED` range checks per the
 * CPCL Programmer's Manual, and unrecognized commands. Re-parses the source
 * via `parseCPCL()` to inspect the same structured commands `CpclParser`
 * produces, same pattern `EplValidator`/`ZplValidator` use for their own
 * checks.
 */
export class CpclValidator implements PrintValidation {
  validate(source: string): ValidationResult {
    if (!source.trim()) {
      return { valid: false, issues: [{ level: 'error', message: 'Empty input' }], errors: 1, warnings: 0, infos: 0 };
    }

    const issues: ValidationIssue[] = [];
    const { commands } = parseCPCL(source);

    if (commands.length === 0 || commands[0].cmd !== '!') {
      issues.push({ level: 'warning', command: '!', message: '! (session header) should be the first command' });
    }

    if (!commands.some((c) => c.cmd === 'PAGE-WIDTH')) {
      issues.push({ level: 'warning', command: 'PAGE-WIDTH', message: 'PAGE-WIDTH not found — label width undefined' });
    }

    if (!commands.some((c) => c.cmd === 'PRINT')) {
      issues.push({ level: 'warning', command: 'PRINT', message: 'No PRINT command found — label will not print' });
    }

    for (const c of commands) {
      if (c.cmd === 'TONE') {
        const tone = Number(c.params[0]);
        if (tone < MIN_TONE || tone > MAX_TONE) {
          issues.push({ level: 'error', command: 'TONE', message: `TONE value ${tone} out of range (0-200)` });
        }
      }

      if (c.cmd === 'SPEED') {
        const speed = Number(c.params[0]);
        if (speed < MIN_SPEED || speed > MAX_SPEED) {
          issues.push({ level: 'warning', command: 'SPEED', message: `SPEED value ${speed} may be out of range (1-6, model-dependent)` });
        }
      }

      if (!c.cmd.startsWith('TEXT') && !KNOWN_CPCL_COMMANDS.has(c.cmd)) {
        issues.push({ level: 'warning', command: c.cmd, message: `Unrecognized command: ${c.cmd}` });
      }
    }

    const errors = issues.filter((i) => i.level === 'error').length;
    const warningCount = issues.filter((i) => i.level === 'warning').length;
    const infos = issues.filter((i) => i.level === 'info').length;

    return { valid: errors === 0, issues, errors, warnings: warningCount, infos };
  }
}
