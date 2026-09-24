/** Lỗi resolve gắn với 1 node — `DocumentResolver` bắt lại và chuyển thành trang lỗi. */
export class ResolveError extends Error {
  constructor(
    readonly nodeId: string,
    message: string,
  ) {
    super(message);
    this.name = 'ResolveError';
  }
}

/** Lấy message của lỗi bất kỳ. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
