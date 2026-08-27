import type { IPrinterDriver } from '../types/driver.types';
import { DriverSource, PrinterDriverType } from '../types/printer.types';
import type { Printer, PrinterDeviceInfo } from '../types/printer.types';
import { AppErrorCode, type AppError } from '../types/AppError';
import { PrinterLogger } from '../services/PrinterLogger';
import { getDriverDefinition } from '../definitions/PrinterDriverDefinitions';

/**
 * Thử `tspl` trước `escpos` — xem lý do ở lịch sử `discoverProtocol.ts`
 * (giữ nguyên): `TsplDriver.identify()` là 1 discriminator thật (gửi lệnh dò
 * `~!T`), trong khi ESC/POS's `identify()` chỉ chứng minh "đã connect thành
 * công". Qua USB cả 2 driver luôn trả `null` — cố ý, không phải thiếu rule.
 */
const CANDIDATE_ORDER: PrinterDriverType[] = [PrinterDriverType.tspl, PrinterDriverType.escpos];

export type DiscoveryStage = 'connecting' | 'identifying' | 'identified' | 'unknown_protocol' | 'error';

export interface DiscoveryEvent {
  stage: DiscoveryStage;
  protocol?: PrinterDriverType;
  deviceInfo?: PrinterDeviceInfo;
  error?: AppError;
}

export interface DiscoveryInput {
  /**
   * Draft `Printer` ĐẦY ĐỦ (id, connectionType, device/lan, paperSize, name,
   * v.v.) do caller (`AddPrinterModal.buildDraftPrinter()`) tự dựng — service
   * này KHÔNG tự tổng hợp draft từ các field rời rạc nữa, để tránh tạo ra 1
   * draft thiếu field (từng gây bug: driver.connect() lưu context với
   * `paperSize: undefined`, sản xuất bản in sai lặng lẽ khi có print thật xảy
   * ra đồng thời trong lúc discovery còn đang mở — xem final-review finding #2).
   */
  draftPrinter: Printer;
  /**
   * Driver type đã có trong printer đang thêm/sửa — do `AddPrinterModal` tự
   * tính (spec §5.1). Service này chỉ NHẬN constraint, không tự biết
   * business rule "driver này đã được add vào Printer".
   */
  excludedDrivers?: PrinterDriverType[];
}

export type Unsubscribe = () => void;

export const createDiscoverDriver =
  (registry: Record<PrinterDriverType, IPrinterDriver>) =>
  (input: DiscoveryInput, onEvent: (event: DiscoveryEvent) => void): Unsubscribe => {
    let cancelled = false;

    const run = async (): Promise<void> => {
      const startedAt = Date.now();
      const { draftPrinter } = input;
      const printerId = draftPrinter.id;
      const connectionType = draftPrinter.connectionType;
      const excluded = new Set(input.excludedDrivers ?? []);
      const candidates = CANDIDATE_ORDER.filter((type) => Boolean(registry[type]) && !excluded.has(type));
      const candidatesTried: PrinterDriverType[] = [];
      let connectFailures = 0;

      PrinterLogger.discoveryStarted({ printerId, connectionType, candidates });

      for (const type of candidates) {
        if (cancelled) return;
        candidatesTried.push(type);
        const driver = registry[type];
        const draftDriver = { type, source: DriverSource.auto, contentTypes: [], config: getDriverDefinition(type).defaultConfig };
        const disconnectQuietly = (): Promise<void> => driver.disconnect(printerId).catch(() => undefined);
        onEvent({ stage: 'connecting', protocol: type });
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
        onEvent({ stage: 'identifying', protocol: type });
        const deviceInfo = await driver.identify(printerId).catch(() => null);
        if (cancelled) {
          await disconnectQuietly();
          return;
        }
        if (deviceInfo) {
          onEvent({ stage: 'identified', protocol: type, deviceInfo });
          PrinterLogger.protocolDetected({ printerId, protocol: type, connectionType, candidatesTried, durationMs: Date.now() - startedAt });
          return;
        }
        PrinterLogger.discoveryCandidateRejected({ printerId, protocol: type, connectionType, reason: 'not_confirmed' });
        await disconnectQuietly();
      }

      if (cancelled) return;
      if (candidates.length === 0 || connectFailures === candidates.length) {
        onEvent({ stage: 'error', error: { code: AppErrorCode.CONNECTION_ERROR, message: 'Không thể kết nối tới máy in' } });
        PrinterLogger.discoveryFailed({ printerId, connectionType, candidatesTried, durationMs: Date.now() - startedAt });
        return;
      }
      onEvent({ stage: 'unknown_protocol' });
      PrinterLogger.protocolUnknown({ printerId, connectionType, candidatesTried, durationMs: Date.now() - startedAt });
    };

    run();

    return () => { cancelled = true; };
  };
