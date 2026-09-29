/** Tham chiếu 1 style có tên trong `settings` — tạo qua `scope.style(...)`, dùng với `text(...).style(...)`. */
export interface StyleReference {
  /** Tên style trong `settings.styles`. */
  readonly styleName: string;
}
