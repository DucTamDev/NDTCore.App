export class TemplateNodeIdGenerator {
  private sequence = 0;
  next(type: string): string {
    this.sequence += 1;
    return `${type}-${this.sequence}`;
  }
}

export interface BuildContext {
  readonly idGenerator: TemplateNodeIdGenerator;
}
