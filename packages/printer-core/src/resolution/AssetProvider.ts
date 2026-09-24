import type { Bitmap } from '../types';

/** Nguồn ảnh đã decode sẵn, tra đồng bộ theo mã asset. App tự tải + decode trước khi resolve. */
export interface AssetProvider {
  /** Bitmap của asset; `undefined` nếu chưa tải được. */
  get(assetId: string): Bitmap | undefined;
}
