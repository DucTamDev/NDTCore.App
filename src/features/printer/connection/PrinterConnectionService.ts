import type { IPrinterAdapter, Unsubscribe } from '../adapters/IPrinterAdapter';
import { ConnectionType } from '../models/printer/ConnectionType';
import type { Printer } from '../models/printer/Printer';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import { DeviceErrorCode } from '../errors';
import { DeviceErrorException, errorCodeOf } from '../exceptions';
import { printerLogger } from '../logging/PrinterLogger';
import { ensureBluetoothPermission } from '../permissions/PrinterPermissionService';
import { printerRepository, type PrinterRepository } from '../storage/PrinterRepository';
import { LoggerService } from '../../../services/LoggerService';
import { createPrinterAdapter } from './PrinterAdapterFactory';
import { printerConnectionLock, lockKeyOf, ResourceLock } from './PrinterConnectionLock';

/** Nơi nhận trạng thái mới của một máy in. */
type StatusListener = (status: PrinterStatus) => void;

/** Phụ thuộc của service, tách ra để test thay được. */
export interface PrinterConnectionServiceDeps {
  /** Tạo adapter mới cho mỗi máy vật lý được mở. */
  createAdapter: () => IPrinterAdapter;

  /** `true` khi app đã có quyền Bluetooth. */
  ensureBluetoothPermission: () => Promise<boolean>;

  /** Nguồn máy in đã lưu cho `reconnect` và tự kết nối lại. */
  repository: PrinterRepository;

  /** Khoá dùng chung với tầng in. */
  lock: ResourceLock;
}

/** Kết nối đang mở tới một máy vật lý, dùng chung cho mọi máy in (đã lưu hoặc bản nháp) trỏ tới máy đó. */
interface DeviceConnection {
  /** Adapter giữ kết nối này. */
  adapter: IPrinterAdapter;

  /** Máy in đang dùng kết nối, kèm lượt `connect` đã gắn nó vào; hết máy in thì đóng kết nối. */
  users: Map<string, number>;

  /** Huỷ lắng nghe mất kết nối của `adapter`. */
  stopWatchingLost: Unsubscribe;
}

/** Máy in vừa gắn vào máy vật lý mới thì phải gỡ khỏi máy cũ; `attempt` là lượt đã gắn nó vào máy cũ. */
interface PreviousAttachment {
  lockKey: string;

  attempt: number;
}

const notConnected = (): DeviceErrorException =>
  new DeviceErrorException({ code: DeviceErrorCode.NOT_CONNECTED, message: 'Máy in chưa kết nối' });

const bluetoothDenied = (): DeviceErrorException =>
  new DeviceErrorException({ code: DeviceErrorCode.PERMISSION_DENIED, message: 'Chưa được cấp quyền Bluetooth' });

/**
 * Kết nối theo máy vật lý (`lockKeyOf`) và trạng thái theo từng máy in: hai máy in (vd hoá đơn và tem) trỏ cùng một
 * máy dùng chung một kết nối, máy in cuối cùng ngắt thì mới đóng. Không biết ngôn ngữ in; khoá in do tầng in giữ.
 */
export class PrinterConnectionService {
  /** Kết nối đang mở theo khoá máy vật lý. */
  private readonly devices = new Map<string, DeviceConnection>();

  /** Máy vật lý (khoá) mà từng máy in đang dùng. */
  private readonly sessions = new Map<string, string>();

  /** Trạng thái theo `printerId`; máy chưa từng kết nối không có mục nào (coi là `Idle`). */
  private readonly statuses = new Map<string, PrinterStatus>();

  /** Nơi nghe đổi trạng thái theo `printerId`. */
  private readonly listeners = new Map<string, Set<StatusListener>>();

  /**
   * Lượt kết nối mới nhất theo `printerId`. `connect` nhớ lượt của mình; lượt bị thay (có `connect` mới hơn hoặc
   * `disconnect`) thì không được đổi trạng thái hay giữ kết nối nữa.
   */
  private readonly attempts = new Map<string, number>();

  /** Bộ đếm sinh mã lượt, tăng dần cho mọi máy. */
  private attemptCounter = 0;

  /**
   * Mở/gắn và gỡ/đóng cùng một máy vật lý chạy lần lượt, để một lần mở gửi trước lệnh đóng không nhận phải kết nối
   * sắp đóng. Riêng với khoá in vì `connect` chạy bên trong khoá in.
   */
  private readonly deviceQueue = new ResourceLock();

  constructor(private readonly deps: PrinterConnectionServiceDeps) {}

  /**
   * Máy vật lý đã mở thì chỉ gắn thêm máy in, không mở lại. Kết nối thất bại thì phiên cũ (nếu có) vẫn giữ nguyên.
   * Lượt bị thay (bởi `connect` mới hơn hoặc `disconnect`) thì gỡ phần mình đã gắn và không đổi trạng thái.
   */
  async connect(printer: Printer): Promise<void> {
    const printerId = printer.id;
    const connectionType = printer.connection.type;
    const startedAt = Date.now();
    const attempt = this.beginAttempt(printerId);
    const lockKey = lockKeyOf(printer);
    this.setStatus(printerId, PrinterStatus.Connecting);

    try {
      await this.ensurePermission(connectionType);
      const previous = await this.deviceQueue.runExclusive(lockKey, () => this.attach(printer, lockKey, attempt));

      if (previous) {
        await this.deps.lock.runExclusive(previous.lockKey, () => this.detachQuietly(printerId, previous));
      }

      if (!this.isCurrentAttempt(printerId, attempt)) {
        await this.detachQuietly(printerId, { lockKey, attempt });
        return;
      }

      this.setStatus(printerId, PrinterStatus.Connected);
      printerLogger.connectSucceeded({ printerId, connectionType, durationMs: Date.now() - startedAt });
    } catch (error) {
      if (this.isCurrentAttempt(printerId, attempt)) {
        this.setStatus(printerId, PrinterStatus.Error);
      }

      printerLogger.connectFailed({
        printerId,
        connectionType,
        errorCode: errorCodeOf(error),
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }

  /**
   * Chờ lệnh in đang chạy trên cùng máy xong rồi mới gỡ máy in; còn máy in khác dùng chung thì giữ kết nối. Chỉ ngắt
   * mới khoá in: `connect` được `print` gọi bên trong khoá in và khoá không tái nhập nên khoá ở đó sẽ tự kẹt.
   */
  async disconnect(printerId: string): Promise<void> {
    const attempt = this.beginAttempt(printerId);
    const lockKey = this.sessions.get(printerId);

    if (!lockKey) {
      this.setStatus(printerId, PrinterStatus.Disconnected);
      return;
    }

    await this.deps.lock.runExclusive(lockKey, () =>
      this.deviceQueue.runExclusive(lockKey, () => this.disconnectNow(printerId, lockKey, attempt)),
    );
  }

  /** Chưa kết nối (hoặc đã mất kết nối) thì báo `NOT_CONNECTED`. */
  async send(printerId: string, bytes: Uint8Array): Promise<void> {
    return this.requireAdapter(printerId).write(bytes);
  }

  /** `null` khi hết `timeoutMs` mà máy in chưa trả lời. */
  async read(printerId: string, timeoutMs: number): Promise<Uint8Array | null> {
    return this.requireAdapter(printerId).read(timeoutMs);
  }

  /** Máy chưa từng kết nối là `Idle`. */
  getStatus(printerId: string): PrinterStatus {
    return this.statuses.get(printerId) ?? PrinterStatus.Idle;
  }

  /** Chỉ nhận các lần đổi trạng thái sau khi đăng ký, không nhận trạng thái hiện tại. */
  onStatusChange(printerId: string, listener: StatusListener): Unsubscribe {
    const listeners = this.listeners.get(printerId) ?? new Set<StatusListener>();
    listeners.add(listener);
    this.listeners.set(printerId, listeners);

    return () => {
      listeners.delete(listener);

      if (listeners.size === 0 && this.listeners.get(printerId) === listeners) {
        this.listeners.delete(printerId);
      }
    };
  }

  /**
   * Ngắt (bỏ qua lỗi ngắt) rồi kết nối lại bằng cấu hình đã lưu. Còn máy in khác dùng chung máy vật lý thì kết nối
   * không đóng nên cũng không được mở lại.
   */
  async reconnect(printerId: string): Promise<void> {
    await this.disconnect(printerId).catch(() => undefined);
    await this.connect(this.deps.repository.findOrThrow(printerId));
  }

  /** Gọi khi app khởi động: kết nối mọi máy đang bật và cho phép tự kết nối lại; lỗi từng máy bỏ qua. */
  reconnectAutoPrinters(): void {
    this.deps.repository
      .getPrinters()
      .filter((printer) => printer.enabled && printer.autoReconnect)
      .forEach((printer) => {
        this.connect(printer).catch(() => undefined);
      });
  }

  private beginAttempt(printerId: string): number {
    this.attemptCounter += 1;
    this.attempts.set(printerId, this.attemptCounter);
    return this.attemptCounter;
  }

  private isCurrentAttempt(printerId: string, attempt: number): boolean {
    return this.attempts.get(printerId) === attempt;
  }

  /** Một listener lỗi không được làm hỏng việc kết nối đang chạy hay chặn các listener khác. */
  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((listener) => {
      try {
        listener(status);
      } catch (error) {
        LoggerService.warning('printer.connection.status-listener-failed', {
          printerId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  private async ensurePermission(connectionType: ConnectionType): Promise<void> {
    if (connectionType !== ConnectionType.Bluetooth) {
      return;
    }

    if (!(await this.deps.ensureBluetoothPermission())) {
      throw bluetoothDenied();
    }
  }

  /**
   * Chạy trong hàng đợi của máy: mở máy nếu chưa mở rồi gắn máy in vào. Lượt đã bị thay thì không gắn (và đóng máy
   * vừa mở nếu không ai dùng). Trả nơi máy in đang gắn trước đó nếu là máy vật lý khác, để gỡ ra.
   */
  private async attach(printer: Printer, lockKey: string, attempt: number): Promise<PreviousAttachment | undefined> {
    const printerId = printer.id;
    const device = this.devices.get(lockKey) ?? (await this.open(printer, lockKey));

    if (!this.isCurrentAttempt(printerId, attempt)) {
      if (device.users.size === 0) {
        await this.closeQuietly(printerId, lockKey, device);
      }

      return undefined;
    }

    const previousKey = this.sessions.get(printerId);
    const previousAttempt = previousKey ? this.devices.get(previousKey)?.users.get(printerId) : undefined;
    device.users.set(printerId, attempt);
    this.sessions.set(printerId, lockKey);

    if (previousKey === undefined || previousKey === lockKey || previousAttempt === undefined) {
      return undefined;
    }

    return { lockKey: previousKey, attempt: previousAttempt };
  }

  private async open(printer: Printer, lockKey: string): Promise<DeviceConnection> {
    const adapter = this.deps.createAdapter();
    await adapter.connect(printer.connection);

    const device: DeviceConnection = {
      adapter,
      users: new Map(),
      stopWatchingLost: adapter.onLost(() => this.handleLost(lockKey, adapter)),
    };
    this.devices.set(lockKey, device);
    return device;
  }

  /**
   * Chạy trong khoá in và hàng đợi của máy. Trong lúc chờ, máy in có thể đã được `connect` lại (lệnh ngắt này hết
   * hiệu lực) hoặc đã chuyển sang máy vật lý khác; khi đó không gỡ gì.
   */
  private async disconnectNow(printerId: string, lockKey: string, attempt: number): Promise<void> {
    const device = this.devices.get(lockKey);

    if (!this.isCurrentAttempt(printerId, attempt) || this.sessions.get(printerId) !== lockKey || !device) {
      return;
    }

    this.setStatus(printerId, PrinterStatus.Disconnecting);
    device.users.delete(printerId);
    this.sessions.delete(printerId);

    if (device.users.size === 0) {
      this.devices.delete(lockKey);
      device.stopWatchingLost();

      try {
        await device.adapter.disconnect();
      } catch (error) {
        this.setStatus(printerId, PrinterStatus.Error);
        printerLogger.disconnectFailed({ printerId, errorCode: errorCodeOf(error) });
        throw error;
      }
    }

    this.setStatus(printerId, PrinterStatus.Disconnected);
    printerLogger.disconnectSucceeded({ printerId });
  }

  /** Gỡ đúng phần lượt `attempt` đã gắn (lượt mới hơn gắn lại thì giữ nguyên); máy không còn ai dùng thì đóng. */
  private detachQuietly(printerId: string, attachment: PreviousAttachment): Promise<void> {
    const { lockKey, attempt } = attachment;

    return this.deviceQueue.runExclusive(lockKey, async () => {
      const device = this.devices.get(lockKey);

      if (!device || device.users.get(printerId) !== attempt) {
        return;
      }

      device.users.delete(printerId);

      if (this.sessions.get(printerId) === lockKey) {
        this.sessions.delete(printerId);
      }

      if (device.users.size === 0) {
        await this.closeQuietly(printerId, lockKey, device);
      }
    });
  }

  /** Lỗi khi đóng kết nối không ai còn dùng không được làm hỏng việc đang chạy nên chỉ ghi log. */
  private async closeQuietly(printerId: string, lockKey: string, device: DeviceConnection): Promise<void> {
    if (this.devices.get(lockKey) === device) {
      this.devices.delete(lockKey);
    }

    device.stopWatchingLost();

    try {
      await device.adapter.disconnect();
    } catch (error) {
      printerLogger.disconnectFailed({ printerId, errorCode: errorCodeOf(error) });
    }
  }

  /**
   * Bỏ kết nối ngay để `send`/`read` báo `NOT_CONNECTED` thay vì gọi vào kết nối đã chết; mọi máy in dùng chung đều
   * chuyển `Disconnected`. Adapter đã bị thay thì bỏ qua.
   */
  private handleLost(lockKey: string, adapter: IPrinterAdapter): void {
    const device = this.devices.get(lockKey);

    if (device?.adapter !== adapter) {
      return;
    }

    const users = [...device.users.keys()];

    for (const printerId of users) {
      if (this.sessions.get(printerId) === lockKey) {
        this.sessions.delete(printerId);
      }

      this.setStatus(printerId, PrinterStatus.Disconnected);
    }

    this.closeQuietly(users[0] ?? lockKey, lockKey, device);
  }

  private requireAdapter(printerId: string): IPrinterAdapter {
    const lockKey = this.sessions.get(printerId);
    const device = lockKey ? this.devices.get(lockKey) : undefined;

    if (!device) {
      throw notConnected();
    }

    return device.adapter;
  }
}

export const printerConnectionService = new PrinterConnectionService({
  createAdapter: createPrinterAdapter,
  ensureBluetoothPermission,
  repository: printerRepository,
  lock: printerConnectionLock,
});
