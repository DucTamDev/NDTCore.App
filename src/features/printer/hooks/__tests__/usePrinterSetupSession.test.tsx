import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import {
  FieldErrorReason,
  PrinterError,
  PrinterErrorCode,
  PrinterKind,
  SetupEventType,
  TransportType,
  type DeviceCandidate,
  type Printer,
  type PrinterSetupService,
  type SetupEventListener,
} from '@ndtcore/printer';
import {
  usePrinterSetupSession,
  type UsePrinterSetupSession,
} from '../addPrinter/usePrinterSetupSession';
import { printerErrorMessageOf } from '../../errors/PrinterErrorMessages';

const usb: DeviceCandidate = {
  transportType: TransportType.Usb,
  displayName: 'Xprinter XP-80',
  device: { path: '/dev/usb/1', vendorId: 1, productId: 2 },
};

const bluetooth: DeviceCandidate = {
  transportType: TransportType.BluetoothClassic,
  displayName: 'BT-58',
  device: { mac: 'AA:BB:CC:DD:EE:01', name: 'BT-58' },
};

const lan: DeviceCandidate = {
  transportType: TransportType.Lan,
  displayName: '10.0.0.5:9100',
  host: '10.0.0.5',
  port: 9100,
};

/** Bản nháp giả với lang cho trước. */
const draftWith = (lang: string): Printer =>
  ({ id: '', config: { lang } } as unknown as Printer);

/** printerSetup giả, ghi lại lời gọi. */
const makeSetup = () => {
  let listener: SetupEventListener | undefined;
  const setup = {
    start: jest.fn(),
    listUsbDevices: jest.fn(() => [usb]),
    listBluetoothDevicesAsync: jest.fn(() => Promise.resolve([bluetooth])),
    checkLanAddress: jest.fn((_host: string, _port: number) => lan),
    connectAsync: jest.fn((_candidate: DeviceCandidate) =>
      Promise.resolve(draftWith('EscPos')),
    ),
    cancelAsync: jest.fn(() => Promise.resolve()),
    subscribe: jest.fn((next: SetupEventListener) => {
      listener = next;
      return jest.fn();
    }),
  };
  return {
    setup: setup as unknown as PrinterSetupService,
    mock: setup,
    emit: () => listener?.({ type: SetupEventType.ConnectionLost }),
  };
};

const render = (setup: PrinterSetupService) => {
  let hook!: UsePrinterSetupSession;
  let renderer: ReactTestRenderer | undefined;
  const Harness: React.FC = () => {
    hook = usePrinterSetupSession(PrinterKind.Receipt, { setup });
    return null;
  };
  act(() => {
    renderer = TestRenderer.create(<Harness />);
  });
  return { get: () => hook, unmount: () => act(() => renderer!.unmount()) };
};

describe('usePrinterSetupSession', () => {
  it('mở thì bắt đầu luồng thêm theo kind và liệt kê máy USB', () => {
    const { setup, mock } = makeSetup();
    const { get } = render(setup);

    expect(mock.start).toHaveBeenCalledWith(PrinterKind.Receipt);
    expect(get().candidates).toEqual([usb]);
  });

  it('đổi transport sang Bluetooth thì xin quyền rồi liệt kê máy đã ghép đôi', async () => {
    const { setup, mock } = makeSetup();
    const { get } = render(setup);

    await act(async () => get().setTransport(TransportType.BluetoothClassic));

    expect(mock.listBluetoothDevicesAsync).toHaveBeenCalled();
    expect(get().candidates).toEqual([bluetooth]);
  });

  it('Bluetooth tắt thì báo lỗi danh sách bằng câu tiếng Việt', async () => {
    const { setup, mock } = makeSetup();
    mock.listBluetoothDevicesAsync.mockRejectedValueOnce(
      new PrinterError(PrinterErrorCode.BluetoothDisabled, 'tắt'),
    );
    const { get } = render(setup);

    await act(async () => get().setTransport(TransportType.BluetoothClassic));

    expect(get().listError).toBe(
      printerErrorMessageOf(PrinterErrorCode.BluetoothDisabled),
    );
  });

  it('ứng viên trùng: connectAsync báo PRINTER_ALREADY_EXISTS thành error', async () => {
    const { setup, mock } = makeSetup();
    mock.connectAsync.mockRejectedValueOnce(
      new PrinterError(PrinterErrorCode.PrinterAlreadyExists, 'trùng'),
    );
    const { get } = render(setup);

    const duplicate = { id: 'p1', name: 'Quầy', kind: PrinterKind.Receipt };
    await act(async () => get().connectAsync({ ...usb, duplicate }));

    expect(get().connectionState).toBe('error');
    expect(get().errorMessage).toBe(
      printerErrorMessageOf(PrinterErrorCode.PrinterAlreadyExists),
    );
    expect(get().draft).toBeUndefined();
  });

  it('kết nối xong giữ bản nháp; lang lấy từ draft.config, rỗng thì chờ người dùng chọn', async () => {
    const { setup, mock } = makeSetup();
    const { get } = render(setup);

    await act(async () => get().connectAsync(usb));
    expect(get().connectionState).toBe('connected');
    expect(get().draft?.config.lang).toBe('EscPos');

    mock.connectAsync.mockResolvedValueOnce(draftWith(''));
    await act(async () => get().connectAsync(usb));
    expect(get().draft?.config.lang).toBe('');
  });

  it('LAN sai IP trả fieldErrors host, không kết nối', async () => {
    const { setup, mock } = makeSetup();
    mock.checkLanAddress.mockImplementationOnce(() => {
      throw new PrinterError(PrinterErrorCode.InputInvalid, 'sai', {
        fieldErrors: [
          { field: 'host', reason: FieldErrorReason.InvalidFormat },
        ],
      });
    });
    const { get } = render(setup);

    await act(async () => get().connectLanAsync('10.0.0', 9100));

    expect(get().lanFieldErrors).toEqual([
      { field: 'host', reason: FieldErrorReason.InvalidFormat },
    ]);
    expect(mock.connectAsync).not.toHaveBeenCalled();
  });

  it('LAN đúng thì kiểm tra rồi kết nối ứng viên LAN', async () => {
    const { setup, mock } = makeSetup();
    const { get } = render(setup);

    await act(async () => get().connectLanAsync('10.0.0.5', 9100));

    expect(mock.checkLanAddress).toHaveBeenCalledWith('10.0.0.5', 9100);
    expect(mock.connectAsync).toHaveBeenCalledWith(lan);
  });

  it('mất kết nối lúc cấu hình thì connectionLost', async () => {
    const { setup, emit } = makeSetup();
    const { get } = render(setup);
    await act(async () => get().connectAsync(usb));

    act(() => emit());

    expect(get().connectionLost).toBe(true);
  });

  it('đóng modal gọi cancelAsync', () => {
    const { setup, mock } = makeSetup();
    const { unmount } = render(setup);

    unmount();

    expect(mock.cancelAsync).toHaveBeenCalledTimes(1);
  });
});
