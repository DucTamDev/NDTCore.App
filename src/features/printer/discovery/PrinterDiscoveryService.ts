import type { IPrinterDriver } from '../drivers/IPrinterDriver';
import { DriverSource, PrinterDriverType } from '../models/printer/PrinterDriver';
import type { Printer } from '../models/printer/Printer';
import type { PrinterDeviceInfo } from '../models/printer/PrinterDevice';
import type { PrinterDriver } from '../models/printer/PrinterDriver';
import { PrinterErrorCode, type PrinterError } from '../errors/PrinterError';
import { PrinterLogger } from '../logging/PrinterLogger';
import { getDriverCapabilities } from '../drivers/DriverCapabilities';

/**
 * Thử `tspl` trước `escpos` — xem lý do ở lịch sử `discoverProtocol.ts`
 * (giữ nguyên): `TsplDriver.identify()` là 1 discriminator thật (gửi lệnh dò
 * `~!T`), trong khi ESC/POS's `identify()` chỉ chứng minh "đã connect thành
 * công". Qua USB cả 2 driver luôn trả `null` — cố ý, không phải thiếu rule.
 */
const CANDIDATE_ORDER: PrinterDriverType[] = [PrinterDriverType.tspl, PrinterDriverType.escpos];

export const DiscoveryStage = {
  Connecting: 'Connecting',
  Identifying: 'Identifying',
  Identified: 'Identified',
  UnknownProtocol: 'UnknownProtocol',
  Error: 'Error',
} as const;

export type DiscoveryStage = (typeof DiscoveryStage)[keyof typeof DiscoveryStage];

export interface DiscoveryEvent {
  stage: DiscoveryStage;
  protocol?: PrinterDriverType;
  deviceInfo?: PrinterDeviceInfo;
  error?: PrinterError;
}

export interface DiscoverPrinterInput {
  /**
   * Draft `Printer` ĐẦY ĐỦ (id, connection, name, v.v.) do
   * caller (`useAddPrinterFlow.buildDraftPrinter()`) tự dựng — service này
   * KHÔNG tự tổng hợp draft từ các field rời rạc nữa, để tránh tạo ra 1 draft
   * thiếu field. `driver.connect()` lưu draft này làm context sống của driver.
   * Candidate driver chưa nằm trong `draftPrinter.drivers` lúc discovery nên
   * nhận `defaultConfig` của nó — media per-driver được cấu hình sau khi driver
   * đã vào list (SP-C: `onChangeDriverMedia`).
   */
  draftPrinter: Printer;
  excludedDrivers?: PrinterDriverType[];
}

export type Unsubscribe = () => void;

export const createDiscoverDriver =
  (registry: Record<PrinterDriverType, IPrinterDriver>) =>
  (input: DiscoverPrinterInput, onEvent: (event: DiscoveryEvent) => void): Unsubscribe => {
    let cancelled = false;

    const run = async (): Promise<void> => {
      const startedAt = Date.now();
      const { draftPrinter } = input;
      const printerId = draftPrinter.id;
      const connectionType = draftPrinter.connection.type;
      const excluded = new Set(input.excludedDrivers ?? []);
      const candidates = CANDIDATE_ORDER.filter((type) => Boolean(registry[type]) && !excluded.has(type));
      const candidatesTried: PrinterDriverType[] = [];
      let connectFailures = 0;

      PrinterLogger.discoveryStarted({ printerId, connectionType, candidates });

      for (const type of candidates) {
        if (cancelled) {
          return;
        }

        candidatesTried.push(type);
        const driver = registry[type];
        const def = getDriverCapabilities(type).defaultConfig;
        const draftDriver: PrinterDriver = {
          type,
          source: DriverSource.auto,
          contentTypes: [],
          config: { ...def, media: { ...def.media } },
        };
        const disconnectQuietly = (): Promise<void> => driver.disconnect(printerId).catch(() => undefined);
        onEvent({ stage: DiscoveryStage.Connecting, protocol: type });
        try {
          await driver.connect(draftPrinter, draftDriver);
        } catch {
          connectFailures += 1;
          PrinterLogger.discoveryCandidateRejected({ printerId, protocol: type, connectionType, reason: 'connect_failed' });
          continue;
        }
        if (cancelled) {
          await disconnectQuietly();
          return;
        }
        onEvent({ stage: DiscoveryStage.Identifying, protocol: type });
        const deviceInfo = await driver.identify(printerId).catch(() => null);
        if (cancelled) {
          await disconnectQuietly();
          return;
        }
        if (deviceInfo) {
          onEvent({ stage: DiscoveryStage.Identified, protocol: type, deviceInfo });
          PrinterLogger.protocolDetected({ printerId, protocol: type, connectionType, candidatesTried, durationMs: Date.now() - startedAt });
          return;
        }
        PrinterLogger.discoveryCandidateRejected({ printerId, protocol: type, connectionType, reason: 'not_confirmed' });
        await disconnectQuietly();
      }

      if (cancelled) {
        return;
      }

      if (candidates.length === 0 || connectFailures === candidates.length) {
        onEvent({ stage: DiscoveryStage.Error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Không thể kết nối tới máy in' } });
        PrinterLogger.discoveryFailed({ printerId, connectionType, candidatesTried, durationMs: Date.now() - startedAt });
        return;
      }

      onEvent({ stage: DiscoveryStage.UnknownProtocol });
      PrinterLogger.protocolUnknown({ printerId, connectionType, candidatesTried, durationMs: Date.now() - startedAt });
    };

    run();

    return () => {
      cancelled = true;
    };
  };
