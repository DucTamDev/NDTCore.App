/** Sinh `id` node dạng `<loại>-<số thứ tự>` cho node không tự đặt `id`. */
export class TemplateNodeIdGenerator {
  private sequence = 0;

  next(nodeType: string): string {
    this.sequence += 1;
    return `${nodeType}-${this.sequence}`;
  }
}

/** Trạng thái dùng chung trong 1 lần build template. */
export interface BuildContext {
  /** Sinh id tự động, dùng chung cho mọi node build trong cùng 1 lần gọi `.build()`. */
  readonly idGenerator: TemplateNodeIdGenerator;
}
