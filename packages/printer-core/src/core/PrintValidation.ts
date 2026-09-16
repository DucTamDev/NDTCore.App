import type { ValidationResult } from '../validation/ValidationResult';

export interface PrintValidation {
  validate(source: string): ValidationResult;
}
