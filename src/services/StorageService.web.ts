import { LoggerService } from './LoggerService';

class StorageServiceImpl {
  getItem<T>(key: string): T | null {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  setItem<T>(key: string, value: T): void {
    // localStorage.setItem có thể throw (Safari private mode, vượt quota) —
    // không có tương ứng ở bản native (StorageService.ts dùng MMKV), nên
    // bọc riêng ở đây thay vì để lỗi văng lên tận UI.
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      LoggerService.warning(`Không thể lưu vào localStorage: ${String(err)}`);
    }
  }

  removeItem(key: string): void {
    window.localStorage.removeItem(key);
  }
}

export const StorageService = new StorageServiceImpl();
