import type { CutOptions, PrintElement } from '../document';

/**
 * Gom cảnh báo trong 1 lần compile. Trùng nội dung thì chỉ giữ 1, để document có nhiều element
 * cùng loại không làm ngập danh sách cảnh báo.
 */
export class CompileWarnings {
  private readonly messages = new Set<string>();

  /** `languageName` là tên hiển thị của ngôn ngữ trong câu cảnh báo, VD `ESC/POS`. */
  constructor(private readonly languageName: string) {}

  /** Thêm 1 cảnh báo tuỳ ý (field bị bỏ qua, giá trị bị gộp...). */
  add(message: string): void {
    this.messages.add(message);
  }

  /** Cảnh báo cả element bị bỏ qua vì ngôn ngữ không có lệnh tương ứng. */
  unsupportedElement(elementType: PrintElement['type']): void {
    this.add(`Element "${elementType}" bị bỏ qua — ${this.languageName} không có lệnh tương ứng.`);
  }

  /** Cảnh báo element `cut` bị bỏ qua; `mode: 'off'` nghĩa là không cần cắt nên không có gì để báo. */
  unsupportedCut(options: CutOptions | undefined): void {
    if (options?.mode === 'off') return;

    this.unsupportedElement('cut');
  }

  /** Danh sách cảnh báo theo thứ tự xuất hiện. */
  toArray(): readonly string[] {
    return [...this.messages];
  }
}
