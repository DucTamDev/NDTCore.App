import type { Unsubscribe } from '../adapters/IPrinterAdapter';
import { ConnectionType } from '../models/printer/ConnectionType';
import { LanguageSelection, PrintLanguage, type PrinterLanguage } from '../models/printer/PrinterLanguage';
import type { Printer } from '../models/printer/Printer';
import { PrinterErrorCode, errorCodeOf, type PrinterError } from '../errors/PrinterError';
import { PrinterLogger } from '../logging/PrinterLogger';
import { getPrintLanguage } from '../languages/getPrintLanguage';
import { PrinterConnectionService } from '../connection/PrinterConnectionService';
import { canPrintKind } from '../forms/addPrinter/printerRules';
import { createPrinterLanguage } from '../management/createPrinterDraft';

/** Máy TSPL trả lời lệnh dò trong vài trăm mili giây; quá hạn coi như không phải ngôn ngữ đó. */
const IDENTIFY_TIMEOUT_MS = 1000;

/** TSPL có lệnh dò là phép thử thật nên chạy trước; ESC/POS chỉ xác nhận yếu nên để cuối. */
const CANDIDATE_ORDER: PrintLanguage[] = [PrintLanguage.Tspl, PrintLanguage.EscPos];

export const LanguageDetectionStage = {
  Connecting: 'Connecting',
  Identifying: 'Identifying',
  Detected: 'Detected',
  Unknown: 'Unknown',
  Error: 'Error',
} as const;

export type LanguageDetectionStage = (typeof LanguageDetectionStage)[keyof typeof LanguageDetectionStage];

/** Một cập nhật trong lúc dò ngôn ngữ của máy in. */
export type LanguageDetectionEvent =
  | { stage: typeof LanguageDetectionStage.Connecting }
  | { stage: typeof LanguageDetectionStage.Identifying; language: PrintLanguage }
  | { stage: typeof LanguageDetectionStage.Detected; language: PrinterLanguage }
  | { stage: typeof LanguageDetectionStage.Unknown }
  | { stage: typeof LanguageDetectionStage.Error; error: PrinterError };

/** Máy in cần dò ngôn ngữ. */
export interface LanguageDetectionInput {
  /** Bản nháp đủ field; chỉ dùng `id`, `kind` và `connection`. */
  draftPrinter: Printer;
}

type DetectionConnectionService = Pick<typeof PrinterConnectionService, 'connect' | 'disconnect' | 'send' | 'read'>;

/** Những thứ một lần dò cần, gom lại để tách các bước ra hàm riêng. */
interface DetectionContext {
  printer: Printer;

  connectionService: DetectionConnectionService;

  onEvent: (event: LanguageDetectionEvent) => void;

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

    context.onEvent({ stage: LanguageDetectionStage.Identifying, language: type });

    if (await confirmLanguage(context, type)) {
      return type;
    }

    const connectionType = printer.connection.type;
    PrinterLogger.detectionCandidateRejected({ printerId: printer.id, language: type, connectionType });
  }

  return undefined;
};

/** Dò ngôn ngữ của máy in mới trên một lần kết nối duy nhất. */
export const createLanguageDetectionService = (
  connectionService: DetectionConnectionService = PrinterConnectionService,
) => {
  const run = async (context: DetectionContext): Promise<void> => {
    const { printer, onEvent, isCancelled } = context;
    const logFields = { printerId: printer.id, connectionType: printer.connection.type };
    const candidates = CANDIDATE_ORDER.filter((type) => canPrintKind(type, printer.kind));
    const startedAt = Date.now();
    const disconnectQuietly = (): Promise<void> => connectionService.disconnect(printer.id).catch(() => undefined);

    PrinterLogger.detectionStarted({ ...logFields, candidates });
    onEvent({ stage: LanguageDetectionStage.Connecting });

    try {
      await connectionService.connect(printer);
    } catch (error) {
      if (!isCancelled()) {
        const failure = { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Không thể kết nối tới máy in' };
        onEvent({ stage: LanguageDetectionStage.Error, error: failure });
        const errorCode = errorCodeOf(error);
        PrinterLogger.detectionFailed({ ...logFields, errorCode, durationMs: Date.now() - startedAt });
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
      onEvent({ stage: LanguageDetectionStage.Detected, language });
      PrinterLogger.languageDetected({ ...logFields, language: detected, candidatesTried, durationMs });
      return;
    }

    await disconnectQuietly();
    onEvent({ stage: LanguageDetectionStage.Unknown });
    PrinterLogger.languageUnknown({ ...logFields, candidatesTried, durationMs });
  };

  /** Huỷ giữa chừng thì ngắt kết nối và không báo thêm sự kiện nào. */
  const detect = (input: LanguageDetectionInput, onEvent: (event: LanguageDetectionEvent) => void): Unsubscribe => {
    let cancelled = false;
    const isCancelled = (): boolean => cancelled;
    const guardedOnEvent = (event: LanguageDetectionEvent): void => {
      if (!cancelled) {
        onEvent(event);
      }
    };

    run({ printer: input.draftPrinter, connectionService, onEvent: guardedOnEvent, isCancelled });

    return () => {
      cancelled = true;
    };
  };

  return { detect };
};

export const LanguageDetectionService = createLanguageDetectionService();
