import type { ValidationIssue } from './ValidationIssue';

/** Outcome of validating printer source: whether it's error-free, plus every issue found and severity counts. */
export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  errors: number;
  warnings: number;
  infos: number;
}
