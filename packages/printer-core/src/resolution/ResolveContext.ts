import type { Catalog, CatalogIndex } from '../catalog';
import type { AssetProvider } from './AssetProvider';

/** Phần catalog mà resolver cần — không phụ thuộc kiểu data. */
export type CatalogReader = Pick<Catalog<unknown>, 'id' | 'describe' | 'readVariable' | 'readCollection'>;

/** 1 tầng scope: data gốc, hoặc 1 phần tử đang lặp. */
export interface ScopeFrame {
  /** Collection của phần tử; `null` là data gốc. */
  readonly collection: string | null;

  /** Data gốc hoặc phần tử hiện tại. */
  readonly item: unknown;

  /** Thứ tự phần tử (từ 1) trong danh sách sau expand; 0 ở tầng gốc. */
  readonly position: number;

  /** Tổng số phần tử sau expand; 0 ở tầng gốc. */
  readonly total: number;

  /** Thứ tự bản sao (từ 1) của phần tử khi expand; 1 nếu không expand, 0 ở tầng gốc. */
  readonly unit: number;

  /** Tổng số bản sao của phần tử; 1 nếu không expand, 0 ở tầng gốc. */
  readonly unitCount: number;

  /** `repeat` của tầng này có `expand` hay không; `false` ở tầng gốc. */
  readonly expanded: boolean;
}

/** Thông tin trang đang resolve. */
export interface PageInfo {
  /** Số trang, đếm từ 1. */
  readonly pageNumber: number;

  /** Tổng số trang. */
  readonly pageCount: number;
}

/** Trạng thái khi resolve 1 node. */
export interface ResolveContext {
  /** Catalog dùng để đọc biến/collection từ data. */
  readonly catalog: CatalogReader;

  /** Bảng tra biến/collection dựng từ `catalog.describe()`. */
  readonly index: CatalogIndex;

  /** Nguồn tra bitmap ảnh. */
  readonly assets: AssetProvider;

  /** Stack scope tường minh: `[data gốc, phần tử cấp 1, phần tử cấp 2...]`. */
  readonly frames: readonly ScopeFrame[];

  /** Thông tin trang đang resolve. */
  readonly page: PageInfo;
}

/** Tầng scope gốc chứa data của cả document. */
export function createRootFrame(data: unknown): ScopeFrame {
  return { collection: null, item: data, position: 0, total: 0, unit: 0, unitCount: 0, expanded: false };
}

/** Context mới với thêm 1 tầng scope ở trong cùng. */
export function pushFrame(context: ResolveContext, frame: ScopeFrame): ResolveContext {
  return { ...context, frames: [...context.frames, frame] };
}

/** Tầng scope trong cùng của `collection` (`null` là tầng gốc); `undefined` nếu không nằm trong vòng lặp đó. */
export function findScopeFrame(context: ResolveContext, collection: string | null): ScopeFrame | undefined {
  for (let index = context.frames.length - 1; index >= 0; index--) {
    if (context.frames[index].collection === collection) return context.frames[index];
  }
  return undefined;
}

/** Tầng scope trong cùng. */
export function innermostFrame(context: ResolveContext): ScopeFrame {
  return context.frames[context.frames.length - 1];
}
