import {
  DeviceModule,
  subscribeDeviceDisconnected,
  type DeviceDisconnectedEvent,
  type DeviceModuleApi,
  type NativeConnectedDevice,
  type NativeDeviceAddress,
  type Unsubscribe,
} from './DeviceModule';

/** Quyền dùng một kết nối native; `release()` chỉ có tác dụng ở lần gọi đầu. */
export interface NativeConnectionLease {
  readonly connectionId: string;

  readonly serialNumber: string | null;

  release(): Promise<void>;
}

/** Số nơi đang dùng một kết nối; mỗi phiên kết nối là một đối tượng mới để lease cũ không trừ nhầm phiên mới. */
interface ConnectionUsage {
  count: number;
}

type DisconnectSubscriber = (callback: (event: DeviceDisconnectedEvent) => void) => Unsubscribe;

/**
 * Nơi duy nhất đếm số máy in đang dùng chung một kết nối native: người đầu tiên mở, người cuối cùng đóng.
 * Các `acquire` chạy song song (máy này chờ hộp thoại quyền USB không chặn máy khác). Mọi thay đổi bộ đếm là đồng bộ;
 * chỉ lệnh native được chờ.
 */
export class NativeConnectionPool {
  private readonly usageByConnectionId = new Map<string, ConnectionUsage>();

  /**
   * Lệnh native `disconnect` đang chạy theo `connectionId`. Native có thể trả về đúng kết nối sắp bị đóng cho một
   * `acquire` gửi đi trước lệnh đóng, nên `acquire` nhận id này phải chờ đóng xong rồi kết nối lại.
   */
  private readonly closingByConnectionId = new Map<string, Promise<void>>();

  constructor(
    private readonly deviceModule: DeviceModuleApi = DeviceModule,
    subscribe: DisconnectSubscriber = subscribeDeviceDisconnected,
  ) {
    subscribe((event) => this.usageByConnectionId.delete(event.connectionId));
  }

  /** Kiểm tra "đang đóng" và tăng bộ đếm trong cùng một bước đồng bộ để `release` không chen vào giữa. */
  async acquire(address: NativeDeviceAddress): Promise<NativeConnectionLease> {
    for (;;) {
      const connected = await this.deviceModule.connect(address);
      const closing = this.closingByConnectionId.get(connected.connectionId);

      if (!closing) {
        return this.register(connected);
      }

      await closing.catch(() => undefined);
    }
  }

  private register(connected: NativeConnectedDevice): NativeConnectionLease {
    const usage = this.usageByConnectionId.get(connected.connectionId) ?? { count: 0 };
    usage.count += 1;
    this.usageByConnectionId.set(connected.connectionId, usage);
    return this.createLease(connected, usage);
  }

  private createLease(connected: NativeConnectedDevice, usage: ConnectionUsage): NativeConnectionLease {
    let released = false;

    return {
      connectionId: connected.connectionId,
      serialNumber: connected.serialNumber,
      release: () => {
        if (released) {
          return Promise.resolve();
        }

        released = true;
        return this.release(connected.connectionId, usage);
      },
    };
  }

  /** Kết nối đã mất (sự kiện native) hoặc đã thành phiên mới thì lease cũ không còn gì để trả. */
  private async release(connectionId: string, usage: ConnectionUsage): Promise<void> {
    if (this.usageByConnectionId.get(connectionId) !== usage) {
      return;
    }

    usage.count -= 1;

    if (usage.count > 0) {
      return;
    }

    this.usageByConnectionId.delete(connectionId);
    const closing = this.deviceModule.disconnect(connectionId);
    this.closingByConnectionId.set(connectionId, closing);

    try {
      await closing;
    } finally {
      if (this.closingByConnectionId.get(connectionId) === closing) {
        this.closingByConnectionId.delete(connectionId);
      }
    }
  }
}

export const nativeConnectionPool = new NativeConnectionPool();
