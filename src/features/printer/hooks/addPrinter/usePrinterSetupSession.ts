import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PrinterError,
  PrinterErrorCode,
  printerSetup,
  SetupEventType,
  TransportType,
  type DeviceCandidate,
  type FieldError,
  type Printer,
  type PrinterKind,
  type PrinterSetupService,
} from '@ndtcore/printer';
import { printerErrorMessageOf } from '../../errors/PrinterErrorMessages';

/** Trạng thái kết nối của máy đang thêm. */
export type SetupConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

/** Phiên thêm máy in: tìm máy, kết nối, giữ bản nháp để form cấu hình rồi lưu. */
export interface UsePrinterSetupSession {
  /** Cách kết nối đang chọn. */
  transport: TransportType;

  /** Đổi cách kết nối; bỏ máy đang chọn và liệt kê lại. */
  setTransport: (transport: TransportType) => Promise<void>;

  /** Máy USB, Bluetooth tìm được; LAN nhập địa chỉ nên rỗng. */
  candidates: DeviceCandidate[];

  /** Đang liệt kê máy. */
  listing: boolean;

  /** Không liệt kê được (thiếu quyền, Bluetooth tắt). */
  listError?: string;

  /** Liệt kê lại máy của cách kết nối đang chọn. */
  refreshAsync: () => Promise<void>;

  /** Lỗi theo trường của IP, cổng LAN. */
  lanFieldErrors: FieldError[];

  /** Kết nối máy USB, Bluetooth đã chọn. */
  connectAsync: (candidate: DeviceCandidate) => Promise<void>;

  /** Kiểm tra IP, cổng rồi kết nối máy LAN. */
  connectLanAsync: (host: string, port: number) => Promise<void>;

  /** Trạng thái kết nối. */
  connectionState: SetupConnectionState;

  /** Câu lỗi khi kết nối hỏng. */
  errorMessage?: string;

  /** Bản nháp package trả khi kết nối xong; lang rỗng khi không dò được. */
  draft?: Printer;

  /** Máy mất kết nối trong lúc cấu hình; vẫn lưu được. */
  connectionLost: boolean;

  /** Bỏ kết quả kết nối để chọn máy khác. */
  resetConnection: () => void;
}

/** Câu tiếng Việt của lỗi package; lỗi lạ thì câu chung. */
const messageOf = (error: unknown): string =>
  printerErrorMessageOf(error instanceof PrinterError ? error.code : PrinterErrorCode.InternalError);

/** Phiên thêm máy theo kind; đóng (unmount) thì huỷ luồng thêm để package trả lại kết nối. */
export const usePrinterSetupSession = (
  kind: PrinterKind,
  setup: PrinterSetupService = printerSetup,
): UsePrinterSetupSession => {
  const [transport, setTransportState] = useState<TransportType>(TransportType.Usb);
  const [candidates, setCandidates] = useState<DeviceCandidate[]>([]);
  const [listing, setListing] = useState(false);
  const [listError, setListError] = useState<string | undefined>(undefined);
  const [lanFieldErrors, setLanFieldErrors] = useState<FieldError[]>([]);
  const [connectionState, setConnectionState] = useState<SetupConnectionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState<Printer | undefined>(undefined);
  const [connectionLost, setConnectionLost] = useState(false);

  /** Mỗi lần kết nối một mã; kết quả của lần đã bị bỏ (đổi máy, kết nối lần khác) không được áp vào. */
  const runRef = useRef(0);

  const resetConnection = useCallback(() => {
    runRef.current += 1;
    setConnectionState('idle');
    setErrorMessage(undefined);
    setDraft(undefined);
    setConnectionLost(false);
  }, []);

  const listAsync = useCallback(
    async (next: TransportType) => {
      setListError(undefined);

      if (next === TransportType.Lan) {
        setCandidates([]);
        return;
      }

      setListing(true);
      try {
        const found = next === TransportType.Usb ? setup.listUsbDevices() : await setup.listBluetoothDevicesAsync();
        setCandidates(found);
      } catch (error) {
        setCandidates([]);
        setListError(messageOf(error));
      } finally {
        setListing(false);
      }
    },
    [setup],
  );

  useEffect(() => {
    setup.start(kind);
    listAsync(TransportType.Usb).catch(() => undefined);
    const unsubscribe = setup.subscribe((event) => {
      if (event.type === SetupEventType.ConnectionLost) {
        setConnectionLost(true);
      }
    });

    return () => {
      unsubscribe();
      setup.cancelAsync().catch(() => undefined);
    };
  }, [kind, setup, listAsync]);

  const setTransport = useCallback(
    async (next: TransportType) => {
      setTransportState(next);
      setLanFieldErrors([]);
      resetConnection();
      await listAsync(next);
    },
    [listAsync, resetConnection],
  );

  const refreshAsync = useCallback(() => listAsync(transport), [listAsync, transport]);

  const connectAsync = useCallback(
    async (candidate: DeviceCandidate) => {
      resetConnection();
      const run = runRef.current;
      setConnectionState('connecting');

      try {
        const connected = await setup.connectAsync(candidate);

        if (run === runRef.current) {
          setDraft(connected);
          setConnectionState('connected');
        }
      } catch (error) {
        if (run === runRef.current) {
          setConnectionState('error');
          setErrorMessage(messageOf(error));
        }
      }
    },
    [setup, resetConnection],
  );

  const connectLanAsync = useCallback(
    async (host: string, port: number) => {
      setLanFieldErrors([]);

      try {
        const candidate = setup.checkLanAddress(host, port);
        await connectAsync(candidate);
      } catch (error) {
        if (error instanceof PrinterError && error.fieldErrors) {
          setLanFieldErrors(error.fieldErrors);
          return;
        }

        setConnectionState('error');
        setErrorMessage(messageOf(error));
      }
    },
    [setup, connectAsync],
  );

  return {
    transport,
    setTransport,
    candidates,
    listing,
    listError,
    refreshAsync,
    lanFieldErrors,
    connectAsync,
    connectLanAsync,
    connectionState,
    errorMessage,
    draft,
    connectionLost,
    resetConnection,
  };
};
