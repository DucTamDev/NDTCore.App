import type { ResolvedNode } from './ResolvedNode';

/** Kết quả resolve 1 trang: thành công, hoặc lỗi cô lập trong trang đó (trang khác vẫn in được). */
export type ResolvedPage = ResolvedPageSuccess | ResolvedPageError;

/** Trang resolve thành công. */
export interface ResolvedPageSuccess {
  readonly status: 'ok';

  /** Thứ tự trang, từ 0. */
  readonly pageIndex: number;

  /** Cây node đã resolve của trang. */
  readonly node: ResolvedNode;
}

/** Trang lỗi — lỗi cô lập trong trang này, các trang khác vẫn in được. */
export interface ResolvedPageError {
  readonly status: 'error';

  /** Thứ tự trang, từ 0. */
  readonly pageIndex: number;

  /** Id của node gây lỗi. */
  readonly nodeId: string;

  /** Mô tả lỗi. */
  readonly message: string;
}
