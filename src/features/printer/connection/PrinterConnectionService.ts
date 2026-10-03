import type { IPrinterAdapter, Unsubscribe } from '../adapters/IPrinterAdapter';
import { ConnectionType } from '../models/printer/ConnectionType';
import type { Printer } from '../models/printer/Printer';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import { PrinterErrorCode, PrinterErrorException, errorCodeOf } from '../errors/PrinterError';
import { PrinterLogger } from '../logging/PrinterLogger';
import { ensureBluetoothPermission } from '../permissions/PrinterPermissionService';
import { PrinterRepository, type createPrinterRepository } from '../storage/PrinterRepository';
import { createPrinterAdapter } from './createPrinterAdapter';

type StatusListener = (status: PrinterStatus) => void;

/** Phụ thuộc của service, tách ra để test thay được. */
export interface PrinterConnectionServiceDeps {
  /** Tạo adapter mới cho mỗi lần kết nối. */
  createAdapter: () => IPrinterAdapter;

  /** `true` khi app đã có quyền Bluetooth. */
  ensureBluetoothPermission: () => Promise<boolean>;

  /** Nguồn máy in đã lưu cho `reconnect` và tự kết nối lại. */
  repository: Pick<ReturnType<typeof createPrinterRepository>, 'findOrThrow' | 'getPrinters'>;
}

/** Kết nối đang mở của một máy in. */
interface ConnectionSession {
  adapter: IPrinterAdapter;

  /** Huỷ lắng nghe mất kết nối của `adapter`. */
  stopWatchingLost: Unsubscribe;
}

const notConnected = (): PrinterErrorException =>
  new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in chưa kết nối' });

const bluetoothDenied = (): PrinterErrorException =>
  new PrinterErrorException({
    code: PrinterErrorCode.PRINTER_CONNECTION_FAILED,
    message: 'Chưa được cấp quyền Bluetooth',
  });

/**
 * Kết nối của từng máy in (đã lưu hoặc bản nháp) theo `printerId`: mở, đóng, gửi byte, đọc phản hồi và trạng thái.
 * Không biết ngôn ngữ in; khoá theo máy vật lý do tầng in giữ.
 */
export const createPrinterConnectionService = (deps: PrinterConnectionServiceDeps) => {
  const sessions = new Map<string, ConnectionSession>();
  const statuses = new Map<string, PrinterStatus>();
  const listeners = new Map<string, Set<StatusListener>>();

  const setStatus = (printerId: string, status: PrinterStatus): void => {
    statuses.set(printerId, status);
    listeners.get(printerId)?.forEach((listener) => listener(status));
  };

  const ensurePermission = async (connectionType: ConnectionType): Promise<void> => {
    if (connectionType !== ConnectionType.Bluetooth) {
      return;
    }

    if (!(await deps.ensureBluetoothPermission())) {
      throw bluetoothDenied();
    }
  };

  /** Lỗi khi trả kết nối cũ không được làm hỏng kết nối mới nên chỉ ghi log. */
  const closeQuietly = async (printerId: string, session: ConnectionSession): Promise<void> => {
    session.stopWatchingLost();

    try {
      await session.adapter.disconnect();
    } catch (error) {
      PrinterLogger.disconnectFailed({ printerId, errorCode: errorCodeOf(error) });
    }
  };

  /** Chỉ phiên còn hiệu lực mới được đổi trạng thái; adapter đã bị thay thì bỏ qua. */
  const openSession = async (printerId: string, adapter: IPrinterAdapter): Promise<void> => {
    const previous = sessions.get(printerId);
    const stopWatchingLost = adapter.onLost(() => {
      if (sessions.get(printerId)?.adapter === adapter) {
        setStatus(printerId, PrinterStatus.Disconnected);
      }
    });

    sessions.set(printerId, { adapter, stopWatchingLost });

    if (previous) {
      await closeQuietly(printerId, previous);
    }
  };

  const requireAdapter = (printerId: string): IPrinterAdapter => {
    const session = sessions.get(printerId);

    if (!session) {
      throw notConnected();
    }

    return session.adapter;
  };

  /** Kết nối thất bại thì phiên cũ (nếu có) vẫn giữ nguyên. */
  const connect = async (printer: Printer): Promise<void> => {
    const connectionType = printer.connection.type;
    const startedAt = Date.now();
    setStatus(printer.id, PrinterStatus.Connecting);

    try {
      await ensurePermission(connectionType);
      const adapter = deps.createAdapter();
      await adapter.connect(printer.connection);
      await openSession(printer.id, adapter);
      setStatus(printer.id, PrinterStatus.Connected);
      PrinterLogger.connectSucceeded({ printerId: printer.id, connectionType, durationMs: Date.now() - startedAt });
    } catch (error) {
      setStatus(printer.id, PrinterStatus.Error);
      PrinterLogger.connectFailed({
        printerId: printer.id,
        connectionType,
        errorCode: errorCodeOf(error),
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  };

  const disconnect = async (printerId: string): Promise<void> => {
    const session = sessions.get(printerId);

    if (!session) {
      setStatus(printerId, PrinterStatus.Disconnected);
      return;
    }

    setStatus(printerId, PrinterStatus.Disconnecting);
    sessions.delete(printerId);
    session.stopWatchingLost();

    try {
      await session.adapter.disconnect();
    } catch (error) {
      setStatus(printerId, PrinterStatus.Error);
      PrinterLogger.disconnectFailed({ printerId, errorCode: errorCodeOf(error) });
      throw error;
    }

    setStatus(printerId, PrinterStatus.Disconnected);
    PrinterLogger.disconnectSucceeded({ printerId });
  };

  const send = async (printerId: string, bytes: Uint8Array): Promise<void> => requireAdapter(printerId).write(bytes);

  /** `null` khi hết `timeoutMs` mà máy in chưa trả lời. */
  const read = async (printerId: string, timeoutMs: number): Promise<Uint8Array | null> =>
    requireAdapter(printerId).read(timeoutMs);

  const getStatus = (printerId: string): PrinterStatus => statuses.get(printerId) ?? PrinterStatus.Idle;

  const onStatusChange = (printerId: string, listener: StatusListener): Unsubscribe => {
    if (!listeners.has(printerId)) {
      listeners.set(printerId, new Set());
    }

    listeners.get(printerId)?.add(listener);
    return () => listeners.get(printerId)?.delete(listener);
  };

  const reconnect = async (printerId: string): Promise<void> => {
    await disconnect(printerId).catch(() => undefined);
    await connect(deps.repository.findOrThrow(printerId));
  };

  const reconnectAutoPrinters = (): void => {
    deps.repository
      .getPrinters()
      .filter((printer) => printer.enabled && printer.autoReconnect)
      .forEach((printer) => {
        connect(printer).catch(() => undefined);
      });
  };

  return { connect, disconnect, send, read, getStatus, onStatusChange, reconnect, reconnectAutoPrinters };
};

export const PrinterConnectionService = createPrinterConnectionService({
  createAdapter: createPrinterAdapter,
  ensureBluetoothPermission,
  repository: PrinterRepository,
});
