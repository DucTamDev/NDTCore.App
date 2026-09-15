/** A single finding from validating printer source (bytes or command text). */
export interface ValidationIssue {
  level: 'error' | 'warning' | 'info';
  line?: number;
  command?: string;
  message: string;
}
