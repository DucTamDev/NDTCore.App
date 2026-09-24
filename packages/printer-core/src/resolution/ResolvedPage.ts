import type { ResolvedNode } from './ResolvedNode';

/** Kết quả resolve 1 trang: thành công, hoặc lỗi cô lập trong trang đó (trang khác vẫn in được). */
export type ResolvedPage =
  | { readonly status: 'ok'; readonly pageIndex: number; readonly node: ResolvedNode }
  | { readonly status: 'error'; readonly pageIndex: number; readonly nodeId: string; readonly message: string };
