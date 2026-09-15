export interface PrintValidation {
  validate(source: string): {
    valid: boolean;
    errors: number;
    warnings: number;
    issues: Array<{
      level: "error" | "warning" | "info";
      message: string;
    }>;
  };
}
