import {
  LanguageDetectionService,
  LanguageDetectionStage,
  type LanguageDetectionEvent,
} from '../LanguageDetectionService';
import { ConnectionType } from '../../models/printer/ConnectionType';
import { LanguageSelection, PrintLanguage } from '../../models/printer/PrinterLanguage';
import { PrintKind } from '../../models/printer/PrintKind';
import type { Printer } from '../../models/printer/Printer';
import { printerLogger } from '../../logging/PrinterLogger';
import { makePrinter } from '../../testing/printerFixtures';
import { makeMockConnectionService } from '../../testing/printerServiceTestKit';
import { DeviceErrorCode } from '../../errors/DeviceErrorCode';

jest.mock('../../logging/PrinterLogger', () => ({
  printerLogger: {
    detectionStarted: jest.fn(),
    detectionCandidateRejected: jest.fn(),
    detectionFailed: jest.fn(),
    languageDetected: jest.fn(),
    languageUnknown: jest.fn(),
  },
}));

const TSPL_REPLY = new Uint8Array([0x54, 0x53, 0x43]);

const lanDraft: Printer = makePrinter({ name: 'Máy in mới' });

const usbDraft: Printer = makePrinter({ connection: { type: ConnectionType.Usb, vendorId: 1155, productId: 22222 } });

const isFinal = (event: LanguageDetectionEvent): boolean =>
  event.stage === LanguageDetectionStage.Detected ||
  event.stage === LanguageDetectionStage.Unknown ||
  event.stage === LanguageDetectionStage.Error;

/** Dò và chờ tới sự kiện kết thúc. */
const detectUntilDone = (
  connectionService: ReturnType<typeof makeMockConnectionService>,
  draftPrinter: Printer,
): Promise<LanguageDetectionEvent[]> =>
  new Promise((resolve) => {
    const events: LanguageDetectionEvent[] = [];
    new LanguageDetectionService(connectionService).detect({ draftPrinter }, (event) => {
      events.push(event);

      if (isFinal(event)) {
        resolve(events);
      }
    });
  });

/** Chờ các promise đang treo chạy xong. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('LanguageDetectionService', () => {
  afterEach(() => jest.clearAllMocks());

  it('TSPL trả lời lệnh dò → Detected TSPL, giữ kết nối, chỉ kết nối một lần', async () => {
    const connectionService = makeMockConnectionService({ read: jest.fn().mockResolvedValue(TSPL_REPLY) });

    const events = await detectUntilDone(connectionService, lanDraft);

    expect(events.map((event) => event.stage)).toEqual([
      LanguageDetectionStage.Connecting,
      LanguageDetectionStage.Identifying,
      LanguageDetectionStage.Detected,
    ]);
    expect(events[2]).toEqual({
      stage: LanguageDetectionStage.Detected,
      language: {
        type: PrintLanguage.Tspl,
        selection: LanguageSelection.Auto,
      },
    });
    expect(connectionService.connect).toHaveBeenCalledTimes(1);
    expect(connectionService.connect).toHaveBeenCalledWith(lanDraft);
    expect(connectionService.send).toHaveBeenCalledWith(lanDraft.id, new Uint8Array([0x7e, 0x21, 0x54, 0x0d, 0x0a]));
    expect(connectionService.disconnect).not.toHaveBeenCalled();
    expect(printerLogger.languageDetected).toHaveBeenCalledWith(
      expect.objectContaining({ language: PrintLanguage.Tspl, candidatesTried: [PrintLanguage.Tspl] }),
    );
  });

  it('TSPL không trả lời, qua LAN thì xác nhận yếu ESC/POS trên cùng kết nối', async () => {
    const connectionService = makeMockConnectionService();

    const events = await detectUntilDone(connectionService, lanDraft);

    expect(events[events.length - 1]).toEqual(
      { stage: LanguageDetectionStage.Detected, language: expect.objectContaining({ type: PrintLanguage.EscPos }) },
    );
    expect(connectionService.connect).toHaveBeenCalledTimes(1);
    expect(printerLogger.detectionCandidateRejected).toHaveBeenCalledWith(
      expect.objectContaining({ language: PrintLanguage.Tspl, connectionType: ConnectionType.Lan }),
    );
  });

  it('USB không bao giờ tự xác nhận ESC/POS → Unknown và ngắt kết nối', async () => {
    const connectionService = makeMockConnectionService();

    const events = await detectUntilDone(connectionService, usbDraft);

    expect(events[events.length - 1]).toEqual({ stage: LanguageDetectionStage.Unknown });
    expect(connectionService.disconnect).toHaveBeenCalledWith(usbDraft.id);
    expect(printerLogger.languageUnknown).toHaveBeenCalledWith(
      expect.objectContaining({ candidatesTried: [PrintLanguage.Tspl, PrintLanguage.EscPos] }),
    );
  });

  it('in tem chỉ thử TSPL vì ESC/POS không in được tem', async () => {
    const connectionService = makeMockConnectionService();

    const events = await detectUntilDone(connectionService, { ...lanDraft, kind: PrintKind.Label });

    expect(events.filter((event) => event.stage === LanguageDetectionStage.Identifying)).toEqual([
      { stage: LanguageDetectionStage.Identifying, language: PrintLanguage.Tspl },
    ]);
    expect(events[events.length - 1]).toEqual({ stage: LanguageDetectionStage.Unknown });
    expect(printerLogger.detectionStarted).toHaveBeenCalledWith(
      expect.objectContaining({ candidates: [PrintLanguage.Tspl] }),
    );
  });

  it('gửi lệnh dò lỗi thì coi như không khớp, thử ngôn ngữ tiếp theo', async () => {
    const send = jest.fn().mockRejectedValue(new Error('write failed'));
    const connectionService = makeMockConnectionService({ send });

    const events = await detectUntilDone(connectionService, lanDraft);

    expect(events[events.length - 1]).toEqual(
      { stage: LanguageDetectionStage.Detected, language: expect.objectContaining({ type: PrintLanguage.EscPos }) },
    );
  });

  it('không kết nối được → Error, ghi log detectionFailed', async () => {
    const connectionService = makeMockConnectionService({ connect: jest.fn().mockRejectedValue(new Error('down')) });

    const events = await detectUntilDone(connectionService, lanDraft);

    expect(events[events.length - 1]).toMatchObject({
      stage: LanguageDetectionStage.Error,
      error: { code: DeviceErrorCode.CONNECTION_FAILED, message: 'Không thể kết nối tới máy in' },
    });
    expect(printerLogger.detectionFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: lanDraft.id, connectionType: ConnectionType.Lan }),
    );
  });

  it('huỷ trong lúc kết nối: kết nối xong thì ngắt, không báo thêm sự kiện', async () => {
    let finishConnect: () => void = () => undefined;
    const connectionService = makeMockConnectionService({
      connect: jest.fn().mockImplementation(() => new Promise<void>((resolve) => (finishConnect = resolve))),
    });
    const events: LanguageDetectionEvent[] = [];

    const unsubscribe = new LanguageDetectionService(connectionService).detect({ draftPrinter: lanDraft }, (event) =>
      events.push(event),
    );
    unsubscribe();
    finishConnect();
    await flush();

    expect(events.map((event) => event.stage)).toEqual([LanguageDetectionStage.Connecting]);
    expect(connectionService.send).not.toHaveBeenCalled();
    expect(connectionService.disconnect).toHaveBeenCalledWith(lanDraft.id);
  });

  it('huỷ trong lúc chờ phản hồi lệnh dò: ngắt kết nối, không báo Detected', async () => {
    let reply: (response: Uint8Array | null) => void = () => undefined;
    const connectionService = makeMockConnectionService({
      read: jest.fn().mockImplementation(() => new Promise((resolve) => (reply = resolve))),
    });
    const events: LanguageDetectionEvent[] = [];

    const unsubscribe = new LanguageDetectionService(connectionService).detect({ draftPrinter: lanDraft }, (event) =>
      events.push(event),
    );
    await flush();
    unsubscribe();
    reply(TSPL_REPLY);
    await flush();

    expect(events.map((event) => event.stage)).toEqual([
      LanguageDetectionStage.Connecting,
      LanguageDetectionStage.Identifying,
    ]);
    expect(connectionService.disconnect).toHaveBeenCalledWith(lanDraft.id);
  });
});
