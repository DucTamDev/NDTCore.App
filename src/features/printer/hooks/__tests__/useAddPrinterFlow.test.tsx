import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAddPrinterFlow, type UseAddPrinterFlow } from '../useAddPrinterFlow';
import { printerRepository } from '../../storage/PrinterRepository';
import { printerConnectionService } from '../../connection/PrinterConnectionService';
import { printerService } from '../../printing/PrinterService';
import { printerConfigService } from '../../management/PrinterConfigService';
import { printerDetectionService } from '../../detection/PrinterDetectionService';
import type { PrinterDetection } from '../../detection/PrinterDetection';
import { ConnectionType } from '../../models/printer/ConnectionType';
import { LanguageSelection, PrintLanguage } from '../../models/printer/PrinterLanguage';
import { CutterMode } from '../../models/paper/CutterMode';
import { PaperType } from '../../models/paper/PaperType';
import { PaperSize } from '../../models/paper/PaperSize';
import { PrintKind } from '../../models/printer/PrintKind';
import { PrinterConnectionStatus } from '../../models/printer/PrinterConnectionStatus';
import { deviceIdOf } from '../../models/printer/PrinterConnection';
import type { Printer } from '../../models/printer/Printer';
import type { DiscoverResult } from '../../models/discovery/DiscoverResult';

// Đặt tên bắt đầu bằng "mock" — babel-plugin-jest-hoist chỉ cho phép factory
// của jest.mock() tham chiếu biến out-of-scope theo pattern này.
const mockIdleStatus = PrinterConnectionStatus.Idle;

jest.mock('../../storage/PrinterRepository', () => ({
  printerRepository: {
    getPrinters: jest.fn(() => []),
    addPrinter: jest.fn(),
    updatePrinter: jest.fn(),
    findOrThrow: jest.fn((printerId: string) => ({ id: printerId })),
  },
}));

jest.mock('../../connection/PrinterConnectionService', () => ({
  printerConnectionService: {
    getStatus: jest.fn(() => mockIdleStatus),
    onStatusChange: jest.fn(() => () => undefined),
    disconnect: jest.fn(() => Promise.resolve()),
    connect: jest.fn(() => Promise.resolve()),
    reconnect: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../../printing/PrinterService', () => ({
  printerService: {
    testPrint: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../../management/PrinterConfigService', () => ({
  printerConfigService: {
    setPaper: jest.fn(),
  },
}));

jest.mock('../../detection/PrinterDetectionService', () => ({
  printerDetectionService: {
    detect: jest.fn(() => undefined),
  },
}));

const mockCaptureImage = jest.fn((): Promise<string | null> => Promise.resolve('base64-png'));
jest.mock('../usePrintImageCapture', () => ({
  usePrintImageCapture: () => ({ captureNode: null, captureImage: mockCaptureImage }),
}));

jest.mock('../../discovery/NetworkDiscoveryService', () => ({ getCurrentWifiIp: jest.fn(() => Promise.resolve(null)) }));

const savedTspl: Printer = {
  id: 'p1',
  kind: PrintKind.Label,
  name: 'Máy tem',
  language: {
    type: PrintLanguage.Tspl,
    selection: LanguageSelection.Auto,
  },
  paper: { type: PaperType.Continuous, paperSize: PaperSize.Mm80, cutterMode: CutterMode.PerJob },
  connection: { type: ConnectionType.Lan, host: '10.0.0.5', port: 9100 },
  deviceId: 'lan:10.0.0.5:9100',
  capabilities: { cutter: false, cashDrawer: false, color: false, image: false },
  autoReconnect: true,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const savedEscpos: Printer = {
  ...savedTspl,
  id: 'p2',
  kind: PrintKind.Receipt,
  name: 'Máy hoá đơn',
  language: {
    type: PrintLanguage.EscPos,
    selection: LanguageSelection.Auto,
  },
  connection: { type: ConnectionType.Lan, host: '10.0.0.6', port: 9100 },
  deviceId: 'lan:10.0.0.6:9100',
};

/** Model có trong bảng máy in, khớp `usbDevice`. */
const xprinterDetection: PrinterDetection = {
  vendor: 'Xprinter',
  model: 'XP-420B',
  identifiers: { vendorId: 11575, productId: 33751 },
  language: { type: PrintLanguage.Tspl, selection: LanguageSelection.Auto },
  capabilities: { cutter: true, cashDrawer: false, color: false, image: true },
};

/** Lần tra bảng tới trả về `xprinterDetection`. */
const detectXprinter = (): void => {
  (printerDetectionService.detect as jest.Mock).mockReturnValueOnce(xprinterDetection);
};

/** Máy USB vừa quét, chưa có quyền nên chưa có serial. */
const usbDevice: DiscoverResult = {
  device: { deviceId: 'usb:/dev/bus/usb/001/009', name: 'XP-420B', hasPermission: true },
  connection: { type: ConnectionType.Usb, vendorId: 11575, productId: 33751 },
};

type FlowProps = Parameters<typeof useAddPrinterFlow>[0];

const render = (props: FlowProps) => {
  let flow!: UseAddPrinterFlow;
  const Harness: React.FC<FlowProps> = (p) => {
    flow = useAddPrinterFlow(p);
    return null;
  };
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<Harness {...props} />);
  });
  return {
    get: () => flow,
    update: (next: FlowProps) => act(() => renderer.update(<Harness {...next} />)),
    unmount: () => act(() => renderer.unmount()),
  };
};

describe('useAddPrinterFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCaptureImage.mockClear();
    (printerRepository.getPrinters as jest.Mock).mockReturnValue([]);
    (printerConnectionService.getStatus as jest.Mock).mockReturnValue(PrinterConnectionStatus.Idle);
    (printerDetectionService.detect as jest.Mock).mockReturnValue(undefined);
  });

  it('title reflects add vs edit', () => {
    expect(render({ visible: true, onSaved: jest.fn(), kind: PrintKind.Receipt }).get().title).toBe('Thêm máy in');
    expect(render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), kind: savedTspl.kind }).get().title).toBe(
      'Chỉnh sửa máy in',
    );
  });

  it('edit mode seeds the language and marks it saveable (not connectionDirty, not locked)', () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), kind: savedTspl.kind });
    expect(get().infoCard.language).toEqual(savedTspl.language);
    expect(get().infoCard.saveDisabled).toBe(false);
    expect(get().infoCard.locked).toBe(false);
  });

  it('chọn thiết bị → tra bảng → kết nối → lưu, lấy ngôn ngữ, khả năng, hãng và model từ bảng', async () => {
    const onSaved = jest.fn();
    const { get } = render({ visible: true, onSaved, kind: PrintKind.Label });
    expect(get().infoCard.locked).toBe(true);
    act(() => get().connectionSection.onSelectDevice(usbDevice));
    detectXprinter();

    await act(async () => {
      get().connectionSection.onConnectPress();
    });

    expect(printerDetectionService.detect).toHaveBeenCalledWith(usbDevice);
    expect(get().statusPanel.connectionState).toBe('connected');
    expect(get().statusPanel.languageState).toBe('identified');
    expect(get().infoCard.language).toEqual(xprinterDetection.language);
    expect(get().infoCard.locked).toBe(false);

    await act(async () => {
      await get().infoCard.onSave();
    });

    expect(printerRepository.addPrinter).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: PrintKind.Label,
        language: xprinterDetection.language,
        capabilities: xprinterDetection.capabilities,
        vendor: 'Xprinter',
        model: 'XP-420B',
      }),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('không nhận ra ngôn ngữ → chọn tay, kết nối bản nháp và gán ngôn ngữ "manual"', async () => {
    const { get } = render({ visible: true, onSaved: jest.fn(), kind: PrintKind.Receipt });
    act(() => get().connectionSection.onConnectPress());
    expect(get().statusPanel.languageState).toBe('unknown');

    await act(async () => {
      get().statusPanel.onChooseLanguage(PrintLanguage.EscPos);
    });

    expect(printerConnectionService.connect).toHaveBeenCalled();
    expect(get().statusPanel.connectionState).toBe('connected');
    expect(get().infoCard.language).toEqual(expect.objectContaining({ type: PrintLanguage.EscPos, selection: LanguageSelection.Manual }));
  });

  it('cleanup: đóng modal trong lúc đang connected mà chưa Save → disconnect language', () => {
    const { update } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), kind: savedTspl.kind });
    update({ visible: false, initialValues: savedTspl, onSaved: jest.fn(), kind: savedTspl.kind });
    expect(printerConnectionService.disconnect).toHaveBeenCalledWith('p1');
  });

  it('KHÔNG disconnect khi đóng modal ngay sau khi vừa Save', async () => {
    const { get, update } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), kind: savedTspl.kind });
    await act(async () => {
      await get().infoCard.onSave();
    });
    (printerConnectionService.disconnect as jest.Mock).mockClear();
    update({ visible: false, initialValues: savedTspl, onSaved: jest.fn(), kind: savedTspl.kind });
    expect(printerConnectionService.disconnect).not.toHaveBeenCalled();
  });

  it('unmount (phone backToList) trong lúc đang connected mà chưa Save → disconnect', () => {
    const { unmount } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), kind: savedTspl.kind });
    unmount();
    expect(printerConnectionService.disconnect).toHaveBeenCalledWith('p1');
  });

  it('unmount sau khi Save thành công KHÔNG disconnect', async () => {
    const { get, unmount } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), kind: savedTspl.kind });
    await act(async () => {
      await get().infoCard.onSave();
    });
    (printerConnectionService.disconnect as jest.Mock).mockClear();
    unmount();
    expect(printerConnectionService.disconnect).not.toHaveBeenCalled();
  });

  it('onSave khi language KHÔNG đang connected (autoReconnect bật) → connect (không reconnect)', async () => {
    const onSaved = jest.fn();
    const { get } = render({ visible: true, onSaved, kind: PrintKind.Label });
    act(() => get().connectionSection.onSelectDevice(usbDevice));
    detectXprinter();
    await act(async () => {
      get().connectionSection.onConnectPress();
    });
    (printerConnectionService.connect as jest.Mock).mockClear();

    await act(async () => {
      await get().infoCard.onSave();
    });
    expect(printerConnectionService.connect).toHaveBeenCalled();
    expect(printerConnectionService.reconnect).not.toHaveBeenCalled();
  });

  it('onSave khi language đang connected → reconnect (không connect) để context lấy paper đã lưu', async () => {
    (printerConnectionService.getStatus as jest.Mock).mockReturnValue(PrinterConnectionStatus.Connected);
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), kind: savedTspl.kind });
    await act(async () => {
      await get().infoCard.onSave();
    });
    expect(printerConnectionService.reconnect).toHaveBeenCalledWith('p1');
    expect(printerConnectionService.connect).not.toHaveBeenCalled();
  });

  it('identity trùng (deviceId, type) — cùng key + cùng type → báo lỗi', () => {
    (printerRepository.getPrinters as jest.Mock).mockReturnValue([{ ...savedTspl, id: 'other-id' }]);
    const { get } = render({ visible: true, onSaved: jest.fn(), kind: PrintKind.Label });
    act(() => get().connectionSection.onConnectionTypeChange(ConnectionType.Lan));
    act(() => get().connectionSection.onLanIpChange('10.0.0.5'));
    act(() => get().connectionSection.onLanPortChange('9100'));
    expect(get().identityErrorMessage).toBeDefined();
  });

  it('identity cùng key nhưng KHÁC type → không báo lỗi (2 Printer cùng máy vật lý, khác nội dung)', () => {
    (printerRepository.getPrinters as jest.Mock).mockReturnValue([{ ...savedTspl, id: 'other-id', kind: PrintKind.Receipt }]);
    const { get } = render({ visible: true, onSaved: jest.fn(), kind: PrintKind.Label });
    act(() => get().connectionSection.onConnectionTypeChange(ConnectionType.Lan));
    act(() => get().connectionSection.onLanIpChange('10.0.0.5'));
    act(() => get().connectionSection.onLanPortChange('9100'));
    expect(get().identityErrorMessage).toBeUndefined();
  });

  it('kết nối máy tra được trong bảng thất bại → hiển thị lỗi và không có language', async () => {
    (printerConnectionService.connect as jest.Mock).mockRejectedValueOnce({ message: 'mất kết nối' });
    const { get } = render({ visible: true, onSaved: jest.fn(), kind: PrintKind.Receipt });
    act(() => get().connectionSection.onSelectDevice(usbDevice));
    detectXprinter();

    await act(async () => {
      get().connectionSection.onConnectPress();
    });

    expect(get().statusPanel.connectionState).toBe('error');
    expect(get().statusPanel.errorMessage).toBe('mất kết nối');
    expect(get().infoCard.language).toBeUndefined();
  });

  it('model trong bảng dùng ESC/POS mà đang thêm máy tem → để người dùng chọn ngôn ngữ', async () => {
    (printerDetectionService.detect as jest.Mock).mockReturnValueOnce({
      ...xprinterDetection,
      language: { type: PrintLanguage.EscPos, selection: LanguageSelection.Auto },
    });
    const { get } = render({ visible: true, onSaved: jest.fn(), kind: PrintKind.Label });
    act(() => get().connectionSection.onSelectDevice(usbDevice));

    await act(async () => {
      get().connectionSection.onConnectPress();
    });

    expect(get().statusPanel.languageState).toBe('unknown');
    expect(printerConnectionService.connect).not.toHaveBeenCalled();
  });

  it('LAN không có thiết bị quét nên luôn để người dùng chọn ngôn ngữ', async () => {
    const { get } = render({ visible: true, onSaved: jest.fn(), kind: PrintKind.Receipt });
    act(() => get().connectionSection.onConnectionTypeChange(ConnectionType.Lan));
    act(() => get().connectionSection.onLanIpChange('10.0.0.9'));
    act(() => get().connectionSection.onLanPortChange('9100'));

    await act(async () => {
      get().connectionSection.onConnectPress();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(printerDetectionService.detect).not.toHaveBeenCalled();
    expect(get().statusPanel.languageState).toBe('unknown');
    expect(printerConnectionService.connect).not.toHaveBeenCalled();
  });

  it('điền sẵn tên hiển thị bằng tên thiết bị sau khi kết nối (ô còn để user sửa)', async () => {
    const { get } = render({ visible: true, onSaved: jest.fn(), kind: PrintKind.Receipt });
    act(() => get().connectionSection.onSelectDevice(usbDevice));
    act(() => get().connectionSection.onConnectPress());
    await act(async () => {
      get().statusPanel.onChooseLanguage(PrintLanguage.EscPos);
    });
    expect((get().infoCard.control as unknown as { _formValues: { name: string } })._formValues.name).toBe('XP-420B');
  });

  it('USB: sau khi kết nối đọc lại serial theo mã quét của native để lưu đúng máy', async () => {
    const { DeviceModule } = jest.requireMock('../../adapters/native/DeviceModule') as {
      DeviceModule: { discover: jest.Mock };
    };
    DeviceModule.discover.mockResolvedValueOnce([
      {
        type: 'usb',
        deviceId: 'usb:/dev/bus/usb/001/003',
        name: 'XP-420B',
        address: {
          type: 'usb',
          vendorId: 11575,
          productId: 33751,
          serialNumber: 'OTHER',
          devicePath: '/dev/bus/usb/001/003',
        },
        manufacturerName: null,
        productName: null,
        hasPermission: true,
      },
      {
        type: 'usb',
        deviceId: 'usb:/dev/bus/usb/001/009',
        name: 'XP-420B',
        address: { type: 'usb', vendorId: 11575, productId: 33751, serialNumber: 'SN1', devicePath: '/dev/bus/usb/001/009' },
        manufacturerName: null,
        productName: null,
        hasPermission: true,
      },
    ]);
    const { get } = render({ visible: true, onSaved: jest.fn(), kind: PrintKind.Label });
    act(() => get().connectionSection.onSelectDevice(usbDevice));
    detectXprinter();
    await act(async () => {
      get().connectionSection.onConnectPress();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      await get().infoCard.onSave();
    });

    expect(printerRepository.addPrinter).toHaveBeenCalledWith(
      expect.objectContaining({
        connection: { type: ConnectionType.Usb, vendorId: 11575, productId: 33751, serialNumber: 'SN1' },
        deviceId: 'usb:11575:33751:SN1',
      }),
    );
  });

  it('KHÔNG ghi đè tên hiển thị nếu user đã gõ', async () => {
    const { get } = render({ visible: true, onSaved: jest.fn(), kind: PrintKind.Receipt });
    act(() => get().connectionSection.onSelectDevice(usbDevice));
    act(() => {
      (get().infoCard.control as unknown as { _formValues: { name: string } })._formValues.name = 'Máy quầy 1';
    });
    act(() => get().connectionSection.onConnectPress());
    await act(async () => {
      get().statusPanel.onChooseLanguage(PrintLanguage.EscPos);
    });
    expect((get().infoCard.control as unknown as { _formValues: { name: string } })._formValues.name).toBe('Máy quầy 1');
  });

  it('onChangePaper merge patch và persist qua printerConfigService.setPaper', () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), kind: savedTspl.kind });
    act(() => get().infoCard.onChangePaper({ paperSize: PaperSize.Mm100 }));
    expect(get().infoCard.paper.paperSize).toBe(PaperSize.Mm100);
    expect(printerConfigService.setPaper).toHaveBeenCalledWith('p1', expect.objectContaining({ paperSize: PaperSize.Mm100 }));
  });

  it('onChangePaper type=DieCut điền sẵn 5 field default', () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), kind: savedTspl.kind });
    act(() => get().infoCard.onChangePaper({ type: PaperType.DieCut }));
    expect(get().infoCard.paper).toMatchObject({ type: PaperType.DieCut, itemWidthMm: 30, columns: 2, verticalGapMm: 3 });
  });

  it('onTestPrint gọi printerService.testPrint với printer.type cố định (Label → copies)', async () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), kind: savedTspl.kind });
    act(() => get().infoCard.onTestPrintRowsChange('3'));
    await act(async () => {
      await get().infoCard.onTestPrint();
    });
    expect(printerService.testPrint).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1', kind: PrintKind.Label }),
      'base64-png',
      { copies: 3 },
    );
  });

  it('onTestPrint khi giấy tem thiếu kích thước → báo lỗi giấy, không gửi lệnh in', async () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), kind: savedTspl.kind });
    act(() => get().infoCard.onChangePaper({ type: PaperType.DieCut, itemWidthMm: undefined }));
    await act(async () => {
      await get().infoCard.onTestPrint();
    });
    expect(printerService.testPrint).not.toHaveBeenCalled();
    expect(get().testPrintErrorMessage).toContain('itemWidthMm');
  });

  it('onChangePaper giấy tem thiếu kích thước → không ghi vào máy in đã lưu', () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), kind: savedTspl.kind });
    act(() => get().infoCard.onChangePaper({ type: PaperType.DieCut, itemWidthMm: undefined }));
    expect(printerConfigService.setPaper).not.toHaveBeenCalled();
  });

  it('onTestPrint chụp bản in mẫu theo giấy của máy rồi in đúng ảnh đó', async () => {
    const { get } = render({ visible: true, initialValues: savedEscpos, onSaved: jest.fn(), kind: savedEscpos.kind });
    await act(async () => {
      await get().infoCard.onTestPrint();
    });
    expect(mockCaptureImage).toHaveBeenCalledWith(expect.anything(), savedEscpos.paper);
    expect(printerService.testPrint).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p2' }),
      'base64-png',
      undefined,
    );
  });

  it('onTestPrint chụp thất bại → báo lỗi, không gửi lệnh in', async () => {
    mockCaptureImage.mockResolvedValueOnce(null);
    const { get } = render({ visible: true, initialValues: savedEscpos, onSaved: jest.fn(), kind: savedEscpos.kind });
    await act(async () => {
      await get().infoCard.onTestPrint();
    });
    expect(printerService.testPrint).not.toHaveBeenCalled();
    expect(get().testPrintErrorMessage).toBe('Không chụp được bản in thử');
  });

  it('onSave (edit) gọi printerRepository.updatePrinter với draft đầy đủ', async () => {
    const onSaved = jest.fn();
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved, kind: savedTspl.kind });
    await act(async () => {
      await get().infoCard.onSave();
    });
    expect(printerRepository.updatePrinter).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'p1',
        kind: PrintKind.Label,
        connection: expect.objectContaining({ type: ConnectionType.Lan }),
        capabilities: { cutter: false, cashDrawer: false, color: false, image: false },
        language: savedTspl.language,
        paper: savedTspl.paper,
      }),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('saveDisabled true khi paper die-cut thiếu field (hasDieCutMediaError)', () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), kind: savedTspl.kind });
    act(() => get().infoCard.onChangePaper({ type: PaperType.DieCut, itemWidthMm: undefined }));
    expect(get().hasDieCutMediaError).toBe(true);
    expect(get().infoCard.saveDisabled).toBe(true);
  });

  it('edit mode USB printer có selectedConnectionKey bằng deviceIdOf kết nối đã lưu', () => {
    const savedUsbPrinter: Printer = {
      id: 'p3',
      kind: PrintKind.Label,
      name: 'Máy USB',
      language: savedTspl.language,
      paper: savedTspl.paper,
      connection: { type: ConnectionType.Usb, vendorId: 11575, productId: 33751, serialNumber: 'SN1' },
      deviceId: 'usb:11575:33751:SN1',
      capabilities: { cutter: false, cashDrawer: false, color: false, image: false },
      autoReconnect: true,
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const { get } = render({ visible: true, initialValues: savedUsbPrinter, onSaved: jest.fn(), kind: savedUsbPrinter.kind });
    expect(get().connectionSection.selectedConnectionKey).toBe('usb:11575:33751:SN1');
  });

  it('sau onSelectDevice quét được thiết bị → selectedConnectionKey bằng deviceIdOf thiết bị đó', () => {
    const { get } = render({ visible: true, onSaved: jest.fn(), kind: PrintKind.Receipt });
    act(() => get().connectionSection.onSelectDevice(usbDevice));
    expect(get().connectionSection.selectedConnectionKey).toBe(deviceIdOf(usbDevice.connection));
    expect(get().connectionSection.selectedScanId).toBe(usbDevice.device.deviceId);
  });
});
