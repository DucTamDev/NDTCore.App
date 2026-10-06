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
  /** Đang mở kết nối tới máy in. */
  Connecting: 'Connecting',

  /** Đang thử một ngôn ngữ. */
  Identifying: 'Identifying',

  /** Đã xác định được ngôn ngữ. */
  Detected: 'Detected',

  /** Không ngôn ngữ nào khớp; người dùng phải chọn tay. */
  Unknown: 'Unknown',

  /** Không kết nối được máy in. */
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

/** Trạng thái của một lần dò, truyền qua các bước. */
interface DetectionRun {
  /** Máy in đang dò; chỉ dùng `id`, `kind` và `connection`. */
  printer: Printer;

  /** Đã bọc để không báo gì sau khi huỷ. */
  onEvent: (event: PrinterDetectionEvent) => void;

  isCancelled: () => boolean;

  /** Thời điểm bắt đầu, để log thời lượng. */
  startedAt: number;
}

/** Dò ngôn ngữ của máy in mới trên một lần kết nối duy nhất. */
export class PrinterDetectionService {
  constructor(private readonly connectionService: PrinterConnectionService = printerConnectionService) {}

  /** Huỷ giữa chừng thì ngắt kết nối và không báo thêm sự kiện nào. */
  detect(printer: Printer, onEvent: (event: PrinterDetectionEvent) => void): Unsubscribe {
    let cancelled = false;

    this.run({
      printer,
      onEvent: (event) => {
        if (!cancelled) {
          onEvent(event);
        }
      },
      isCancelled: () => cancelled,
      startedAt: Date.now(),
    });

    return () => {
      cancelled = true;
    };
  }

  private async run(run: DetectionRun): Promise<void> {
    const { printer } = run;
    const candidates = CANDIDATE_ORDER.filter((type) => canPrintKind(type, printer.kind));

    printerLogger.detectionStarted({ printerId: printer.id, connectionType: printer.connection.type, candidates });
    run.onEvent({ stage: PrinterDetectionStage.Connecting });

    if (!(await this.connect(run))) {
      return;
    }

    const detected = await this.findLanguage(run, candidates);

    if (run.isCancelled()) {
      await this.disconnectQuietly(printer);
      return;
    }

    await this.report(run, candidates, detected);
  }

  /** `false` khi không kết nối được; lỗi đã được báo (trừ khi đã huỷ). */
  private async connect(run: DetectionRun): Promise<boolean> {
    const { printer } = run;

    try {
      await this.connectionService.connect(printer);
      return true;
    } catch (error) {
      if (!run.isCancelled()) {
        const failure = new DeviceErrorException({
          code: DeviceErrorCode.CONNECTION_FAILED,
          message: 'Không thể kết nối tới máy in',
          cause: error,
        });
        run.onEvent({ stage: PrinterDetectionStage.Error, error: failure });
        printerLogger.detectionFailed({
          printerId: printer.id,
          connectionType: printer.connection.type,
          errorCode: errorCodeOf(error),
          durationMs: Date.now() - run.startedAt,
        });
      }

      return false;
    }
  }

  /** Thử lần lượt trên kết nối đã mở; `undefined` khi không ngôn ngữ nào khớp hoặc đã huỷ. */
  private async findLanguage(run: DetectionRun, candidates: PrintLanguage[]): Promise<PrintLanguage | undefined> {
    const { printer } = run;

    for (const type of candidates) {
      if (run.isCancelled()) {
        return undefined;
      }

      run.onEvent({ stage: PrinterDetectionStage.Identifying, language: type });

      if (await this.confirmLanguage(printer, type)) {
        return type;
      }

      printerLogger.detectionCandidateRejected({
        printerId: printer.id,
        language: type,
        connectionType: printer.connection.type,
      });
    }

    return undefined;
  }

  /**
   * Ngôn ngữ có lệnh dò thì máy phải trả lời. ESC/POS không có lệnh dò nên kết nối được qua Bluetooth/LAN là đủ;
   * USB thì không, vì kết nối USB thành công với mọi máy.
   */
  private async confirmLanguage(printer: Printer, type: PrintLanguage): Promise<boolean> {
    const probe = getPrintLanguage(type).identifyProbe;

    if (!probe) {
      return printer.connection.type !== ConnectionType.Usb;
    }

    try {
      await this.connectionService.send(printer.id, probe.command);
      const response = await this.connectionService.read(printer.id, IDENTIFY_TIMEOUT_MS);
      return response !== null && probe.matches(response);
    } catch {
      return false;
    }
  }

  /** Dò được thì giữ kết nối để người dùng in thử và lưu máy ngay, không phải kết nối lại. */
  private async report(run: DetectionRun, candidates: PrintLanguage[], detected?: PrintLanguage): Promise<void> {
    const { printer } = run;
    const candidatesTried = detected ? candidates.slice(0, candidates.indexOf(detected) + 1) : candidates;
    const logFields = {
      printerId: printer.id,
      connectionType: printer.connection.type,
      candidatesTried,
      durationMs: Date.now() - run.startedAt,
    };

    if (detected) {
      const language = createPrinterLanguage(detected, LanguageSelection.Auto);
      run.onEvent({ stage: PrinterDetectionStage.Detected, language });
      printerLogger.languageDetected({ ...logFields, language: detected });
      return;
    }

    await this.disconnectQuietly(printer);
    run.onEvent({ stage: PrinterDetectionStage.Unknown });
    printerLogger.languageUnknown(logFields);
  }

  private disconnectQuietly(printer: Printer): Promise<void> {
    return this.connectionService.disconnect(printer.id).catch(() => undefined);
  }
}

export const printerDetectionService = new PrinterDetectionService();
