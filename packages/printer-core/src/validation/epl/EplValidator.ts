import { parseEPL } from '../../parser/epl/EplParser';
import type { PrintValidation } from '../../core';
import type { ValidationIssue } from '../ValidationIssue';
import type { ValidationResult } from '../ValidationResult';

const MIN_DENSITY = 0;
const MAX_DENSITY = 15;
const MIN_SPEED = 1;
const MAX_SPEED = 12;

/**
 * Command chars `EplParser`'s `parseEPL()` recognizes (the full single-letter
 * command set from the EPL2 Programmer's Guide it either decodes into an
 * element or intentionally reads-and-discards) — anything outside this set
 * is flagged below as unrecognized, the same category of finding
 * `ZplValidator`/`TscValidator` forward from their own parsers' `warnings`
 * array. `parseEPL` itself doesn't collect that list (ported faithfully from
 * portakal's own `parseEPL()`, which silently skips an unmatched command
 * char rather than warning about it — see `EplParser.ts`'s doc comment), so
 * this check is computed directly here instead.
 */
const KNOWN_EPL_COMMANDS = new Set(['N', 'q', 'Q', 'A', 'X', 'L', 'P', 'B', 'b', 'G', 'S', 'D', 'R', 'Z', 'O', 'J', 'f', 'r', 'I', 'U', 'W', 'e', 'E', 'F', 'K', 'M', 'V', 'C']);

/**
 * Validates EPL2 source — net new, since portakal has no real EPL validation
 * logic to port: `src/validate.ts`'s `default:` branch (which every
 * not-TSC/not-ZPL language falls into, EPL included) just pushes one generic
 * info message ("Validation for EPL is basic"). Follows `EscPosValidator.ts`'s
 * precedent of real, useful checks instead of a stub: command
 * presence/ordering (`N` first, `q` present, `P` present), `S`/`D` range
 * checks per the EPL2 Programmer's Guide, and unrecognized commands. Re-parses
 * the source via `parseEPL()` to inspect the same structured commands
 * `EplParser` produces, same pattern `ZplValidator`/`TscValidator` use for
 * their own (portakal-sourced) checks.
 */
export class EplValidator implements PrintValidation {
  validate(source: string): ValidationResult {
    if (!source.trim()) {
      return { valid: false, issues: [{ level: 'error', message: 'Empty input' }], errors: 1, warnings: 0, infos: 0 };
    }

    const issues: ValidationIssue[] = [];
    const { commands } = parseEPL(source);

    if (commands.length === 0 || commands[0].cmd !== 'N') {
      issues.push({ level: 'warning', command: 'N', message: 'N (clear image buffer) should be the first command' });
    }

    if (!commands.some((c) => c.cmd === 'q')) {
      issues.push({ level: 'warning', command: 'q', message: 'q (label width) not found — label width undefined' });
    }

    if (!commands.some((c) => c.cmd === 'P')) {
      issues.push({ level: 'warning', command: 'P', message: 'No P command found — label will not print' });
    }

    for (const c of commands) {
      if (c.cmd === 'S') {
        const speed = Number(c.raw);
        if (speed < MIN_SPEED || speed > MAX_SPEED) {
          issues.push({ level: 'warning', command: 'S', message: `S value ${speed} may be out of range (1-12, model-dependent)` });
        }
      }

      if (c.cmd === 'D') {
        const density = Number(c.raw);
        if (density < MIN_DENSITY || density > MAX_DENSITY) {
          issues.push({ level: 'error', command: 'D', message: `D value ${density} out of range (0-15)` });
        }
      }

      if (!KNOWN_EPL_COMMANDS.has(c.cmd)) {
        issues.push({ level: 'warning', command: c.cmd, message: `Unrecognized command: ${c.cmd}` });
      }
    }

    const errors = issues.filter((i) => i.level === 'error').length;
    const warningCount = issues.filter((i) => i.level === 'warning').length;
    const infos = issues.filter((i) => i.level === 'info').length;

    return { valid: errors === 0, issues, errors, warnings: warningCount, infos };
  }
}
