import type { Unsubscribe } from '../adapters/IPrinterAdapter';
import { ConnectionType } from '../models/printer/ConnectionType';
import { LanguageSelection, PrintLanguage, type PrinterLanguage } from '../models/printer/PrinterLanguage';
import type { Printer } from '../models/printer/Printer';
import { DeviceErrorCode } from '../errors';
import { DeviceErrorException, errorCodeOf, type PrinterFeatureException } from '../exceptions';
import { printerLogger } from '../logging/PrinterLogger';
import { getPrintLanguage } from '../languages';
import { printerConnectionService, type PrinterConnectionService } from '../connection/PrinterConnectionService';
import { canPrintKind } from '../forms/addPrinter/printerRules';
import { createPrinterLanguage } from '../management/PrinterDefaults';

/** Máy TSPL trả lời lệnh dò trong vài trăm mili giây; quá hạn coi như không phải ngôn ngữ đó. */
const IDENTIFY_TIMEOUT_MS = 1000;

/** TSPL có lệnh dò là phép thử thật nên chạy trước; ESC/POS chỉ xác nhận yếu nên để cuối. */
const CANDIDATE_ORDER: PrintLanguage[] = [PrintLanguage.Tspl, PrintLanguage.EscPos];

/** Giai đoạn của quá trình dò ngôn ngữ. */
export const PrinterDetectionStage = {
  Connecting: 'Connecting',
  Identifying: 'Identifying',
  Detected: 'Detected',
  Unknown: 'Unknown',
  Error: 'Error',
} as const;

export type PrinterDetectionStage = (typeof PrinterDetectionStage)[keyof typeof PrinterDetectionStage];

/** Một cập nhật trong lúc dò ngôn ngữ của máy in. */
export type PrinterDetectionEvent =
  | { stage: typeof PrinterDetectionStage.Connecting }
  | { stage: typeof PrinterDetectionStage.Identifying; language: PrintLanguage }
  | { stage: typeof PrinterDetectionStage.Detected; language: PrinterLanguage }
  | { stage: typeof PrinterDetectionStage.Unknown }
  | { stage: typeof PrinterDetectionStage.Error; error: PrinterFeatureException };

/** Máy in cần dò ngôn ngữ. */
export interface PrinterDetectionInput {
  /** Bản nháp đủ field; chỉ dùng `id`, `kind` và `connection`. */
  draftPrinter: Printer;
}

type DetectionConnectionService = Pick<PrinterConnectionService, 'connect' | 'disconnect' | 'send' | 'read'>;

/** Những thứ một lần dò cần, gom lại để tách các bước ra hàm riêng. */
interface DetectionContext {
  printer: Printer;

  connectionService: DetectionConnectionService;

  onEvent: (event: PrinterDetectionEvent) => void;

  isCancelled: () => boolean;
}

/**
 * Ngôn ngữ có lệnh dò thì máy phải trả lời. ESC/POS không có lệnh dò nên kết nối được qua Bluetooth/LAN là đủ;
 * USB thì không, vì kết nối USB thành công với mọi máy.
 */
const confirmLanguage = async (context: DetectionContext, type: PrintLanguage): Promise<boolean> => {
  const { printer, connectionService } = context;
  const probe = getPrintLanguage(type).identifyProbe;

  if (!probe) {
    return printer.connection.type !== ConnectionType.Usb;
  }

  try {
    await connectionService.send(printer.id, probe.command);
    const response = await connectionService.read(printer.id, IDENTIFY_TIMEOUT_MS);
    return response !== null && probe.matches(response);
  } catch {
    return false;
  }
};

/** Thử lần lượt trên kết nối đã mở; `undefined` khi không ngôn ngữ nào khớp hoặc đã huỷ. */
const findLanguage = async (
  context: DetectionContext,
  candidates: PrintLanguage[],
): Promise<PrintLanguage | undefined> => {
  const { printer } = context;

  for (const type of candidates) {
    if (context.isCancelled()) {
      return undefined;
    }

    context.onEvent({ stage: PrinterDetectionStage.Identifying, language: type });

    if (await confirmLanguage(context, type)) {
      return type;
    }

    const connectionType = printer.connection.type;
    printerLogger.detectionCandidateRejected({ printerId: printer.id, language: type, connectionType });
  }

  return undefined;
};

/** Dò ngôn ngữ của máy in mới trên một lần kết nối duy nhất. */
export class PrinterDetectionService {
  constructor(private readonly connectionService: DetectionConnectionService = printerConnectionService) {}

  /** Huỷ giữa chừng thì ngắt kết nối và không báo thêm sự kiện nào. */
  detect(input: PrinterDetectionInput, onEvent: (event: PrinterDetectionEvent) => void): Unsubscribe {
    let cancelled = false;
    const isCancelled = (): boolean => cancelled;
    const guardedOnEvent = (event: PrinterDetectionEvent): void => {
      if (!cancelled) {
        onEvent(event);
      }
    };

    this.run({
      printer: input.draftPrinter,
      connectionService: this.connectionService,
      onEvent: guardedOnEvent,
      isCancelled,
    });

    return () => {
      cancelled = true;
    };
  }

  private async run(context: DetectionContext): Promise<void> {
    const { printer, onEvent, isCancelled, connectionService } = context;
    const logFields = { printerId: printer.id, connectionType: printer.connection.type };
    const candidates = CANDIDATE_ORDER.filter((type) => canPrintKind(type, printer.kind));
    const startedAt = Date.now();
    const disconnectQuietly = (): Promise<void> => connectionService.disconnect(printer.id).catch(() => undefined);

    printerLogger.detectionStarted({ ...logFields, candidates });
    onEvent({ stage: PrinterDetectionStage.Connecting });

    try {
      await connectionService.connect(printer);
    } catch (error) {
      if (!isCancelled()) {
        const failure = new DeviceErrorException({
          code: DeviceErrorCode.CONNECTION_FAILED,
          message: 'Không thể kết nối tới máy in',
          cause: error,
        });
        onEvent({ stage: PrinterDetectionStage.Error, error: failure });
        const errorCode = errorCodeOf(error);
        printerLogger.detectionFailed({ ...logFields, errorCode, durationMs: Date.now() - startedAt });
      }

      return;
    }

    const detected = await findLanguage(context, candidates);

    if (isCancelled()) {
      await disconnectQuietly();
      return;
    }

    const candidatesTried = detected ? candidates.slice(0, candidates.indexOf(detected) + 1) : candidates;
    const durationMs = Date.now() - startedAt;

    if (detected) {
      const language = createPrinterLanguage(detected, LanguageSelection.Auto);
      onEvent({ stage: PrinterDetectionStage.Detected, language });
      printerLogger.languageDetected({ ...logFields, language: detected, candidatesTried, durationMs });
      return;
    }

    await disconnectQuietly();
    onEvent({ stage: PrinterDetectionStage.Unknown });
    printerLogger.languageUnknown({ ...logFields, candidatesTried, durationMs });
  }
}

export const printerDetectionService = new PrinterDetectionService();
