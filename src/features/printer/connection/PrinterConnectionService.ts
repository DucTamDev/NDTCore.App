import type { IPrinterAdapter, Unsubscribe } from '../adapters/IPrinterAdapter';
import { ConnectionType } from '../models/connections/ConnectionType';
import type { Printer } from '../models/printer/Printer';
import type { ConnectedDevice } from '../models/device/ConnectedDevice';
import { ConnectionStatus } from '../models/connections/ConnectionStatus';
import { DeviceErrorCode, type ErrorCode } from '../errors';
import { DeviceErrorException, errorCodeOf } from '../exceptions';
import { printerLogger } from '../logging/PrinterLogger';
import { ensureBluetoothPermission } from '../permissions/PrinterPermissionService';
import { printerRepository, type PrinterRepository } from '../storage/PrinterRepository';
import { LoggerService } from '../../../services/LoggerService';
import { createPrinterAdapter } from './PrinterAdapterFactory';
import { printerConnectionLock, PrinterConnectionLock } from './PrinterConnectionLock';

/** Nơi nhận trạng thái mới của một máy in. */
type StatusListener = (status: ConnectionStatus) => void;

/** Một kết nối native đang mở, dùng chung cho mọi máy in (đã lưu hoặc bản nháp) trỏ tới cùng máy vật lý. */
interface DeviceConnection {
  /** Adapter giữ kết nối này. */
  adapter: IPrinterAdapter;

  /** Thông tin native trả khi mở; `connectionId` là khoá của kết nối, `deviceId` là khoá in. */
  device: ConnectedDevice;

  /** Máy in đang dùng kết nối, kèm lượt `connect` đã gắn nó vào; hết máy in thì đóng kết nối. */
  users: Map<string, number>;

  /** Huỷ lắng nghe mất kết nối của `adapter`. */
  stopWatchingLost: Unsubscribe;
}

/** Máy in vừa gắn vào kết nối mới thì phải gỡ khỏi kết nối cũ; `attempt` là lượt đã gắn nó vào kết nối cũ. */
interface PreviousAttachment {
  connectionId: string;

  attempt: number;
}

/** Việc sổ sách (gắn, gỡ, đóng) chạy lần lượt; mở kết nối chạy ngoài hàng nên máy khác nhau mở song song. */
const BOOKKEEPING_KEY = 'devices';

/** Lỗi ghi cho thấy kết nối đã hỏng dù native chưa báo mất (hay gặp với LAN): bỏ kết nối để lần sau mở lại. */
const BROKEN_CONNECTION_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  DeviceErrorCode.NOT_CONNECTED,
  DeviceErrorCode.CONNECTION_LOST,
  DeviceErrorCode.WRITE_FAILED,
  DeviceErrorCode.WRITE_TIMEOUT,
]);

const notConnected = (): DeviceErrorException =>
  new DeviceErrorException({ code: DeviceErrorCode.NOT_CONNECTED, message: 'Máy in chưa kết nối' });

const bluetoothDenied = (): DeviceErrorException =>
  new DeviceErrorException({ code: DeviceErrorCode.PERMISSION_DENIED, message: 'Chưa được cấp quyền Bluetooth' });

/**
 * Kết nối theo máy vật lý và trạng thái theo từng máy in: hai máy in (vd hoá đơn và tem) trỏ cùng một máy dùng chung
 * một kết nối, máy in cuối cùng ngắt thì mới đóng. Máy nào là máy nào do native quyết (cùng `connectionId`), JS không
 * tự đoán từ địa chỉ. Không biết ngôn ngữ in; khoá in do tầng in giữ.
 */
export class PrinterConnectionService {
  /** Kết nối đang mở theo `connectionId` của native. */
  private readonly devices = new Map<string, DeviceConnection>();

  /** Kết nối (`connectionId`) mà từng máy in đang dùng. */
  private readonly sessions = new Map<string, string>();

  /** Trạng thái theo `printerId`; máy chưa từng kết nối không có mục nào (coi là `Idle`). */
  private readonly statuses = new Map<string, ConnectionStatus>();

  /** Nơi nghe đổi trạng thái theo `printerId`. */
  private readonly listeners = new Map<string, Set<StatusListener>>();

  /**
   * Lượt kết nối mới nhất theo `printerId`. `connect` nhớ lượt của mình; lượt bị thay (có `connect` mới hơn hoặc
   * `disconnect`) thì không được đổi trạng thái hay giữ kết nối nữa.
   */
  private readonly attempts = new Map<string, number>();

  /** Bộ đếm sinh mã lượt, tăng dần cho mọi máy. */
  private attemptCounter = 0;

  /** Lượt `connect` đang chạy theo `printerId`, để `ensureConnected` chờ lượt đó thay vì mở lượt mới. */
  private readonly pendingConnects = new Map<string, Promise<ConnectedDevice>>();

  /** Đếm số lần đóng kết nối, để biết một kết nối có bị đóng trong lúc `connect` khác đang mở dở không. */
  private closeCounter = 0;

  /** Lần đóng gần nhất (theo `closeCounter`) của từng `connectionId`. */
  private readonly lastClosedAt = new Map<string, number>();

  /** Hàng sổ sách, riêng với khoá in vì `connect` chạy bên trong khoá in. */
  private readonly bookkeeping = new PrinterConnectionLock();

  constructor(
    /** Tạo adapter mới cho mỗi lần mở. */
    private readonly createAdapter: () => IPrinterAdapter = createPrinterAdapter,

    /** Xin quyền Bluetooth; `true` khi app đã có quyền. */
    private readonly requestBluetoothPermission: () => Promise<boolean> = ensureBluetoothPermission,

    /** Nguồn máy in đã lưu cho `reconnect` và kết nối khi mở app. */
    private readonly repository: PrinterRepository = printerRepository,

    /** Khoá in dùng chung với tầng in, theo `deviceId`. */
    private readonly lock: PrinterConnectionLock = printerConnectionLock,
  ) {}

  /**
   * Trả thông tin máy native đọc được sau khi mở. Máy đã mở thì native trả lại đúng kết nối đó và máy in chỉ được gắn
   * thêm. Kết nối thất bại thì phiên cũ (nếu có) vẫn giữ nguyên. Lượt bị thay (bởi `connect` mới hơn hoặc
   * `disconnect`) thì gỡ phần mình đã gắn và không đổi trạng thái.
   */
  connect(printer: Printer): Promise<ConnectedDevice> {
    const pending = this.connectNow(printer);
    const clear = (): void => {
      if (this.pendingConnects.get(printer.id) === pending) {
        this.pendingConnects.delete(printer.id);
      }
    };
    this.pendingConnects.set(printer.id, pending);
    pending.then(clear, clear);
    return pending;
  }

  /**
   * Dùng trước khi in: đã kết nối thì thôi; đang có lượt kết nối (vd lúc mở app) thì chờ lượt đó, vì mở lượt mới sẽ
   * làm lượt kia đóng rồi mở lại kết nối; lượt đó lỗi hoặc chưa kết nối thì mới kết nối.
   */
  async ensureConnected(printer: Printer): Promise<void> {
    await this.pendingConnects.get(printer.id)?.catch(() => undefined);

    if (this.getStatus(printer.id) === ConnectionStatus.Connected && this.sessions.has(printer.id)) {
      return;
    }

    await this.connect(printer);
  }

  /**
   * Bỏ trạng thái của máy in không còn dùng (đã xoá, bản nháp đã đóng), gọi sau khi đã ngắt. Máy còn đang gắn vào kết
   * nối thì giữ nguyên.
   */
  forget(printerId: string): void {
    if (this.sessions.has(printerId)) {
      return;
    }

    this.statuses.delete(printerId);
    this.attempts.delete(printerId);
  }

  private async connectNow(printer: Printer): Promise<ConnectedDevice> {
    const printerId = printer.id;
    const connectionType = printer.connection.type;
    const startedAt = Date.now();
    const attempt = this.beginAttempt(printerId);
    this.setStatus(printerId, ConnectionStatus.Connecting);

    try {
      await this.ensurePermission(connectionType);
      const { opened, previous } = await this.openAndAttach(printer, attempt);

      if (previous) {
        await this.detachFromPrevious(printerId, previous);
      }

      if (!this.isCurrentAttempt(printerId, attempt)) {
        await this.detachQuietly(printerId, { connectionId: opened.connectionId, attempt });
        return opened;
      }

      this.setStatus(printerId, ConnectionStatus.Connected);
      printerLogger.connectSucceeded({ printerId, connectionType, durationMs: Date.now() - startedAt });
      return opened;
    } catch (error) {
      if (this.isCurrentAttempt(printerId, attempt)) {
        this.setStatus(printerId, ConnectionStatus.Error);
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
    const connectionId = this.sessions.get(printerId);
    const device = connectionId ? this.devices.get(connectionId) : undefined;

    if (!connectionId || !device) {
      this.setStatus(printerId, ConnectionStatus.Disconnected);
      return;
    }

    await this.lock.runExclusive(device.device.deviceId, () =>
      this.bookkeeping.runExclusive(BOOKKEEPING_KEY, () => this.disconnectNow(printerId, connectionId, attempt)),
    );
  }

  /**
   * Chưa kết nối (hoặc đã mất kết nối) thì báo `NOT_CONNECTED`. Ghi lỗi do kết nối hỏng thì bỏ kết nối như khi mất,
   * để lần in sau tự kết nối lại thay vì gửi mãi vào kết nối chết. Không thử lại ở đây vì máy có thể đã in một phần.
   */
  async send(printerId: string, bytes: Uint8Array): Promise<void> {
    const connectionId = this.sessions.get(printerId);
    const device = connectionId ? this.devices.get(connectionId) : undefined;

    if (!connectionId || !device) {
      throw notConnected();
    }

    try {
      await device.adapter.write(bytes);
    } catch (error) {
      if (BROKEN_CONNECTION_CODES.has(errorCodeOf(error))) {
        this.handleLost(connectionId, device.adapter);
      }

      throw error;
    }
  }

  /** `null` khi quá hạn mà máy in chưa trả lời. */
  async read(printerId: string): Promise<Uint8Array | null> {
    return this.requireAdapter(printerId).read();
  }

  /** Máy chưa từng kết nối là `Idle`. */
  getStatus(printerId: string): ConnectionStatus {
    return this.statuses.get(printerId) ?? ConnectionStatus.Idle;
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
   * không đóng nên cũng không được mở lại. Máy in đã bị xoá thì chỉ ngắt.
   */
  async reconnect(printerId: string): Promise<void> {
    await this.disconnect(printerId).catch(() => undefined);
    const printer = this.repository.findById(printerId);

    if (printer) {
      await this.connect(printer);
    }
  }

  /**
   * Gọi khi app khởi động: trạng thái kết nối chỉ sống trong bộ nhớ nên kết nối lại mọi máy đang bật để trạng thái
   * khớp thực tế. Lỗi từng máy bỏ qua; máy đó hiện `Error`.
   */
  connectEnabledPrinters(): void {
    this.repository
      .getPrinters()
      .filter((printer) => printer.enabled)
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
  private setStatus(printerId: string, status: ConnectionStatus): void {
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

    if (!(await this.requestBluetoothPermission())) {
      throw bluetoothDenied();
    }
  }

  /**
   * Luôn hỏi native: máy đã mở thì native trả lại đúng kết nối đó (cùng `connectionId`) mà không mở lại, khi đó dùng
   * kết nối JS đang có và bỏ adapter mới (không ngắt, vì nó trỏ vào cùng kết nối native). Mở chạy ngoài hàng sổ sách;
   * nếu trong lúc mở, JS vừa đóng đúng kết nối này thì kết nối native trả về có thể đã đóng, nên mở lại trong hàng.
   */
  private async openAndAttach(
    printer: Printer,
    attempt: number,
  ): Promise<{ opened: ConnectedDevice; previous?: PreviousAttachment }> {
    const adapter = this.createAdapter();
    const closeMark = this.closeCounter;
    const opened = await adapter.connect(printer.connection);

    return this.bookkeeping.runExclusive(BOOKKEEPING_KEY, async () => {
      const existing = this.devices.get(opened.connectionId);
      const device = existing ?? (await this.register(adapter, opened, closeMark, printer));
      return { opened: device.device, previous: await this.attach(printer.id, device, attempt) };
    });
  }

  /** Chạy trong hàng sổ sách. Kết nối vừa bị JS đóng trong lúc mở thì kết nối native trả về có thể đã chết: mở lại. */
  private async register(
    adapter: IPrinterAdapter,
    opened: ConnectedDevice,
    closeMark: number,
    printer: Printer,
  ): Promise<DeviceConnection> {
    const closedMeanwhile = (this.lastClosedAt.get(opened.connectionId) ?? -1) > closeMark;
    const device = closedMeanwhile ? await adapter.connect(printer.connection) : opened;
    const connection: DeviceConnection = {
      adapter,
      device,
      users: new Map(),
      stopWatchingLost: adapter.onLost(() => this.handleLost(device.connectionId, adapter)),
    };
    this.devices.set(device.connectionId, connection);
    return connection;
  }

  /**
   * Chạy trong hàng sổ sách: gắn máy in vào kết nối. Lượt đã bị thay thì không gắn (và đóng kết nối nếu không ai
   * dùng). Trả kết nối máy in đang gắn trước đó nếu khác, để gỡ ra.
   */
  private async attach(
    printerId: string,
    device: DeviceConnection,
    attempt: number,
  ): Promise<PreviousAttachment | undefined> {
    const opened = device.device;

    if (!this.isCurrentAttempt(printerId, attempt)) {
      if (device.users.size === 0) {
        await this.close(opened.connectionId, device, printerId);
      }

      return undefined;
    }

    const previousId = this.sessions.get(printerId);
    const previousAttempt = previousId ? this.devices.get(previousId)?.users.get(printerId) : undefined;
    device.users.set(printerId, attempt);
    this.sessions.set(printerId, opened.connectionId);

    if (previousId === undefined || previousId === opened.connectionId || previousAttempt === undefined) {
      return undefined;
    }

    return { connectionId: previousId, attempt: previousAttempt };
  }

  /** Gỡ khỏi kết nối cũ trong khoá in của máy cũ, để không cắt ngang lệnh in đang chạy trên đó. */
  private async detachFromPrevious(printerId: string, previous: PreviousAttachment): Promise<void> {
    const device = this.devices.get(previous.connectionId);

    if (!device) {
      return;
    }

    await this.lock.runExclusive(device.device.deviceId, () => this.detachQuietly(printerId, previous));
  }

  /**
   * Chạy trong khoá in và hàng sổ sách. Trong lúc chờ, máy in có thể đã được `connect` lại (lệnh ngắt này hết
   * hiệu lực) hoặc đã chuyển sang kết nối khác; khi đó không gỡ gì.
   */
  private async disconnectNow(printerId: string, connectionId: string, attempt: number): Promise<void> {
    const device = this.devices.get(connectionId);

    if (!this.isCurrentAttempt(printerId, attempt) || this.sessions.get(printerId) !== connectionId || !device) {
      return;
    }

    this.setStatus(printerId, ConnectionStatus.Disconnecting);
    device.users.delete(printerId);
    this.sessions.delete(printerId);

    if (device.users.size === 0) {
      this.unregister(connectionId, device);

      try {
        await device.adapter.disconnect();
      } catch (error) {
        this.setStatus(printerId, ConnectionStatus.Error);
        printerLogger.disconnectFailed({ printerId, errorCode: errorCodeOf(error) });
        throw error;
      }
    }

    this.setStatus(printerId, ConnectionStatus.Disconnected);
    printerLogger.disconnectSucceeded({ printerId });
  }

  /** Gỡ đúng phần lượt `attempt` đã gắn (lượt mới hơn gắn lại thì giữ nguyên); kết nối không còn ai dùng thì đóng. */
  private detachQuietly(printerId: string, attachment: PreviousAttachment): Promise<void> {
    const { connectionId, attempt } = attachment;

    return this.bookkeeping.runExclusive(BOOKKEEPING_KEY, async () => {
      const device = this.devices.get(connectionId);

      if (!device || device.users.get(printerId) !== attempt) {
        return;
      }

      device.users.delete(printerId);

      if (this.sessions.get(printerId) === connectionId) {
        this.sessions.delete(printerId);
      }

      if (device.users.size === 0) {
        await this.close(connectionId, device, printerId);
      }
    });
  }

  /** Bỏ kết nối khỏi sổ sách và ghi lần đóng, để `connect` đang mở dở biết kết nối native có thể đã đóng. */
  private unregister(connectionId: string, device: DeviceConnection): void {
    if (this.devices.get(connectionId) === device) {
      this.devices.delete(connectionId);
    }

    this.closeCounter += 1;
    this.lastClosedAt.set(connectionId, this.closeCounter);
    device.stopWatchingLost();
  }

  /**
   * Lỗi khi đóng kết nối không ai còn dùng không được làm hỏng việc đang chạy nên chỉ ghi log. Không có máy in nào
   * để gắn vào log thì bỏ qua log chứ không ghi khoá kết nối, vì khoá chứa IP/MAC.
   */
  private async close(connectionId: string, device: DeviceConnection, printerId?: string): Promise<void> {
    this.unregister(connectionId, device);

    try {
      await device.adapter.disconnect();
    } catch (error) {
      if (printerId) {
        printerLogger.disconnectFailed({ printerId, errorCode: errorCodeOf(error) });
      }
    }
  }

  /**
   * Bỏ kết nối ngay để `send`/`read` báo `NOT_CONNECTED` thay vì gọi vào kết nối đã chết; mọi máy in dùng chung đều
   * chuyển `Disconnected`. Adapter đã bị thay thì bỏ qua.
   */
  private handleLost(connectionId: string, adapter: IPrinterAdapter): void {
    const device = this.devices.get(connectionId);

    if (device?.adapter !== adapter) {
      return;
    }

    const users = [...device.users.keys()];

    for (const printerId of users) {
      if (this.sessions.get(printerId) === connectionId) {
        this.sessions.delete(printerId);
      }

      this.setStatus(printerId, ConnectionStatus.Disconnected);
    }

    this.close(connectionId, device, users[0]);
  }

  private requireAdapter(printerId: string): IPrinterAdapter {
    const connectionId = this.sessions.get(printerId);
    const device = connectionId ? this.devices.get(connectionId) : undefined;

    if (!device) {
      throw notConnected();
    }

    return device.adapter;
  }
}

export const printerConnectionService = new PrinterConnectionService();
