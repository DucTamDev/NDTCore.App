import type { TemplateIssue } from './TemplateIssue';

/** Object JSON đã kiểm tra là object (không phải mảng, không phải null). */
export type JsonObject = Readonly<Record<string, unknown>>;

/** Kiểm tra giá trị là object JSON thường. */
export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Con trỏ tới 1 giá trị trong JSON đang validate: biết đường dẫn của mình và ghi lỗi vào danh sách chung.
 * Nhờ vậy mỗi hàm validate chỉ cần 1 tham số.
 */
export class JsonCursor {
  private constructor(
    readonly value: unknown,
    readonly path: string,
    private readonly issues: TemplateIssue[],
  ) {}

  /** Tạo con trỏ gốc; mọi lỗi ghi vào `issues`. */
  static root(value: unknown, issues: TemplateIssue[]): JsonCursor {
    return new JsonCursor(value, '', issues);
  }

  /** Con trỏ tới field `key` (giá trị `undefined` nếu không có). */
  field(key: string): JsonCursor {
    const fieldValue = isJsonObject(this.value) ? this.value[key] : undefined;
    const fieldPath = this.path === '' ? key : `${this.path}.${key}`;
    return new JsonCursor(fieldValue, fieldPath, this.issues);
  }

  /** Field `key` có giá trị (khác `undefined`) hay không. */
  has(key: string): boolean {
    return isJsonObject(this.value) && this.value[key] !== undefined;
  }

  /** Ghi 1 lỗi tại vị trí hiện tại. */
  report(message: string): void {
    this.issues.push({ path: this.path, message });
  }

  /** Trả object nếu đúng kiểu, ngược lại ghi lỗi và trả `undefined`. */
  expectObject(): JsonObject | undefined {
    if (isJsonObject(this.value)) return this.value;
    this.report('phải là object');
    return undefined;
  }

  /** Trả con trỏ của từng phần tử nếu là mảng, ngược lại ghi lỗi và trả mảng rỗng. */
  expectItems(): readonly JsonCursor[] {
    if (!Array.isArray(this.value)) {
      this.report('phải là mảng');
      return [];
    }
    return this.value.map((item, index) => new JsonCursor(item, `${this.path}[${index}]`, this.issues));
  }

  /** Trả con trỏ của từng giá trị nếu là object (theo thứ tự key), ngược lại ghi lỗi và trả mảng rỗng. */
  expectEntries(): readonly JsonCursor[] {
    const object = this.expectObject();
    if (!object) return [];
    return Object.keys(object).map((key) => this.field(key));
  }

  /** Ghi lỗi nếu không phải chuỗi khác rỗng. */
  expectNonEmptyString(): void {
    if (typeof this.value !== 'string' || this.value === '') this.report('phải là chuỗi khác rỗng');
  }

  /** Trả `true` nếu giá trị nằm trong danh sách cho phép, ngược lại ghi lỗi (kể cả khi bỏ trống). */
  expectOneOf(allowed: readonly string[]): boolean {
    if (typeof this.value === 'string' && allowed.includes(this.value)) return true;
    this.report(`phải là 1 trong: ${allowed.map((value) => `"${value}"`).join(', ')}`);
    return false;
  }

  /** Như `expectOneOf` nhưng cho phép bỏ trống. */
  expectOptionalOneOf(allowed: readonly string[]): void {
    if (this.value !== undefined) this.expectOneOf(allowed);
  }

  /** Ghi lỗi nếu có giá trị nhưng không phải số nguyên trong khoảng [min, max]. */
  expectOptionalInteger(min: number, max: number): void {
    const value = this.value;
    if (value === undefined) return;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
      this.report(`phải là số nguyên từ ${min} đến ${max}`);
    }
  }
}
