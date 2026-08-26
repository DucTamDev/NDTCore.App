import type { IPrinterDriver } from '../types/driver.types';
import type { ConnectionType, PrinterDevice, PrinterDeviceInfo, PrinterDriverType, PrinterLanConfig } from '../types/printer.types';
import type { AppError } from '../types/AppError';
import { PrinterLogger } from '../services/PrinterLogger';

/**
 * Thử `tspl` trước `escpos` — xem lý do ở lịch sử `discoverProtocol.ts`
 * (giữ nguyên): `TsplDriver.identify()` là 1 discriminator thật (gửi lệnh dò
 * `~!T`), trong khi ESC/POS's `identify()` chỉ chứng minh "đã connect thành
 * công". Qua USB cả 2 driver luôn trả `null` — cố ý, không phải thiếu rule.
 */
const CANDIDATE_ORDER: PrinterDriverType[] = ['tspl', 'escpos'];

export type DiscoveryStage = 'connecting' | 'identifying' | 'identified' | 'unknown_protocol' | 'error';

export interface DiscoveryEvent {
  stage: DiscoveryStage;
  protocol?: PrinterDriverType;
  deviceInfo?: PrinterDeviceInfo;
  error?: AppError;
}

export interface DiscoveryInput {
  printerId: string;
  connectionType: ConnectionType;
  device?: PrinterDevice;
  lan?: PrinterLanConfig;
  /**
   * Driver type đã có trong printer đang thêm/sửa — do `AddPrinterModal` tự
   * tính (spec §5.1). Service này chỉ NHẬN constraint, không tự biết
   * business rule "driver này đã được add vào Printer".
   */
  excludedDrivers?: PrinterDriverType[];
}

const buildDraftPrinter = (input: DiscoveryInput) => ({
  id: input.printerId,
  connectionType: input.connectionType,
  device: input.device,
  lan: input.lan,
});

export type Unsubscribe = () => void;

export const createDiscoverDriver =
  (registry: Record<PrinterDriverType, IPrinterDriver>) =>
  (input: DiscoveryInput, onEvent: (event: DiscoveryEvent) => void): Unsubscribe => {
    let cancelled = false;

    const run = async (): Promise<void> => {
      const startedAt = Date.now();
      const excluded = new Set(input.excludedDrivers ?? []);
      const candidates = CANDIDATE_ORDER.filter((type) => Boolean(registry[type]) && !excluded.has(type));
      const candidatesTried: PrinterDriverType[] = [];
      let connectFailures = 0;

      PrinterLogger.discoveryStarted({ printerId: input.printerId, connectionType: input.connectionType, candidates });

      for (const type of candidates) {
        if (cancelled) return;
        candidatesTried.push(type);
        const driver = registry[type];
        const draftPrinter = buildDraftPrinter(input);
        const draftDriver = { type, source: 'auto' as const, contentTypes: [], config: type === 'tspl' ? { type: 'tspl' as const, renderMode: 'bitmap' as const } : { type: 'escpos' as const } };
        const disconnectQuietly = (): Promise<void> => driver.disconnect(input.printerId).catch(() => undefined);
        onEvent({ stage: 'connecting', protocol: type });
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- draft Printer/PrinterDriver during discovery, before a real one is persisted
          await driver.connect(draftPrinter as any, draftDriver);
        } catch {
          connectFailures += 1;
          PrinterLogger.discoveryCandidateRejected({ printerId: input.printerId, protocol: type, connectionType: input.connectionType, reason: 'connect_failed' });
          continue;
        }
        if (cancelled) {
          await disconnectQuietly();
          return;
        }
        onEvent({ stage: 'identifying', protocol: type });
        const deviceInfo = await driver.identify(input.printerId).catch(() => null);
        if (cancelled) {
          await disconnectQuietly();
          return;
        }
        if (deviceInfo) {
          onEvent({ stage: 'identified', protocol: type, deviceInfo });
          PrinterLogger.protocolDetected({ printerId: input.printerId, protocol: type, connectionType: input.connectionType, candidatesTried, durationMs: Date.now() - startedAt });
          return;
        }
        PrinterLogger.discoveryCandidateRejected({ printerId: input.printerId, protocol: type, connectionType: input.connectionType, reason: 'not_confirmed' });
        await disconnectQuietly();
      }

      if (cancelled) return;
      if (candidates.length === 0 || connectFailures === candidates.length) {
        onEvent({ stage: 'error', error: { code: 'CONNECTION_ERROR', message: 'Không thể kết nối tới máy in' } });
        PrinterLogger.discoveryFailed({ printerId: input.printerId, connectionType: input.connectionType, candidatesTried, durationMs: Date.now() - startedAt });
        return;
      }
      onEvent({ stage: 'unknown_protocol' });
      PrinterLogger.protocolUnknown({ printerId: input.printerId, connectionType: input.connectionType, candidatesTried, durationMs: Date.now() - startedAt });
    };

    run();

    return () => { cancelled = true; };
  };
