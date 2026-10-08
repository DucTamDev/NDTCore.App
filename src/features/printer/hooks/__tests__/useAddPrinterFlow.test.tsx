import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAddPrinterFlow, type UseAddPrinterFlow } from '../useAddPrinterFlow';
import { printerRepository } from '../../storage/PrinterRepository';
import { printerConnectionService } from '../../connection/PrinterConnectionService';
import { printerService } from '../../printing/PrinterService';
import { printerDetectionService } from '../../detection/PrinterDetectionService';
import type { PrinterDetection } from '../../detection/PrinterDetection';
import { ConnectionType } from '../../models/connections/ConnectionType';
import { LanguageSelection, PrintLanguage } from '../../models/printer/PrinterLanguage';
import { CutterMode } from '../../models/paper/CutterMode';
import { PaperType } from '../../models/paper/PaperType';
import { PaperSize } from '../../models/paper/PaperSize';
import { PrintKind } from '../../models/printer/PrintKind';
import { ConnectionStatus } from '../../models/connections/ConnectionStatus';
import type { Printer } from '../../models/printer/Printer';
import type { DeviceInfo } from '../../models/device/DeviceInfo';
import { fakeConnectedDevice } from '../../testing/printerServiceTestKit';

// Đặt tên bắt đầu bằng "mock" — babel-plugin-jest-hoist chỉ cho phép factory
// của jest.mock() tham chiếu biến out-of-scope theo pattern này.
const mockIdleStatus = ConnectionStatus.Idle;

/** Native trả thông tin máy theo đúng địa chỉ bản nháp kết nối tới. */
const mockConnectedDeviceOf = (printer: Printer) => fakeConnectedDevice(printer.connection);

jest.mock('../../storage/PrinterRepository', () => ({
  printerRepository: {
    getPrinters: jest.fn(() => []),
    addPrinter: jest.fn(),
    updatePrinter: jest.fn(),
    findById: jest.fn(() => undefined),
  },
}));

jest.mock('../../connection/PrinterConnectionService', () => ({
  printerConnectionService: {
    getStatus: jest.fn(() => mockIdleStatus),
    onStatusChange: jest.fn(() => () => undefined),
    disconnect: jest.fn(() => Promise.resolve()),
    connect: jest.fn((printer: Printer) => Promise.resolve(mockConnectedDeviceOf(printer))),
    reconnect: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../../printing/PrinterService', () => ({
  printerService: {
    testPrint: jest.fn(() => Promise.resolve()),
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
const usbDevice: DeviceInfo = {
  deviceId: 'usb:/dev/bus/usb/001/009',
  name: 'XP-420B',
  hasPermission: true,
  address: { type: ConnectionType.Usb, vendorId: 11575, productId: 33751 },
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
    (printerConnectionService.getStatus as jest.Mock).mockReturnValue(ConnectionStatus.Idle);
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

  it('sửa máy in rồi đóng mà không kết nối gì → không đụng tới máy đang chạy', () => {
    (printerConnectionService.getStatus as jest.Mock).mockReturnValue(ConnectionStatus.Connected);
    const props = { visible: true, initialValues: savedTspl, onSaved: jest.fn(), kind: savedTspl.kind };
    const { update, unmount } = render(props);
    update({ ...props, visible: false });
    unmount();
    expect(printerConnectionService.disconnect).not.toHaveBeenCalled();
    expect(printerConnectionService.reconnect).not.toHaveBeenCalled();
  });

  it('thêm máy: đã kết nối bản nháp rồi đóng chưa lưu → ngắt bản nháp', async () => {
    const { get, update } = render({ visible: true, onSaved: jest.fn(), kind: PrintKind.Label });
    act(() => get().connectionSection.onSelectDevice(usbDevice));
    detectXprinter();
    await act(async () => {
      get().connectionSection.onConnectPress();
    });
    const draftId = (printerConnectionService.connect as jest.Mock).mock.calls[0][0].id;

    update({ visible: false, onSaved: jest.fn(), kind: PrintKind.Label });

    expect(printerConnectionService.disconnect).toHaveBeenCalledWith(draftId);
  });

  it('thêm máy: unmount (phone backToList) chưa lưu sau khi kết nối → ngắt bản nháp', async () => {
    const { get, unmount } = render({ visible: true, onSaved: jest.fn(), kind: PrintKind.Label });
    act(() => get().connectionSection.onSelectDevice(usbDevice));
    detectXprinter();
    await act(async () => {
      get().connectionSection.onConnectPress();
    });
    const draftId = (printerConnectionService.connect as jest.Mock).mock.calls[0][0].id;

    unmount();

    expect(printerConnectionService.disconnect).toHaveBeenCalledWith(draftId);
  });

  it('lưu xong rồi đóng / unmount → không ngắt', async () => {
    const { get, update, unmount } = render({ visible: true, onSaved: jest.fn(), kind: PrintKind.Label });
    act(() => get().connectionSection.onSelectDevice(usbDevice));
    detectXprinter();
    await act(async () => {
      get().connectionSection.onConnectPress();
    });
    await act(async () => {
      await get().infoCard.onSave();
    });

    update({ visible: false, onSaved: jest.fn(), kind: PrintKind.Label });
    unmount();

    expect(printerConnectionService.disconnect).not.toHaveBeenCalled();
  });

  it('Đổi kết nối: bỏ ngôn ngữ, mở khoá phần kết nối, chưa lưu được', () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), kind: savedTspl.kind });
    expect(get().connectionSection.disabled).toBe(true);

    act(() => get().connectionSection.onChangeConnection());

    expect(get().connectionSection.disabled).toBe(false);
    expect(get().infoCard.language).toBeUndefined();
    expect(get().infoCard.saveDisabled).toBe(true);
  });

  it('sửa máy đang kết nối, đổi kết nối rồi huỷ → kết nối lại bằng cấu hình đã lưu', async () => {
    (printerConnectionService.getStatus as jest.Mock).mockReturnValue(ConnectionStatus.Connected);
    const { get, unmount } = render({
      visible: true,
      initialValues: savedTspl,
      onSaved: jest.fn(),
      kind: savedTspl.kind,
    });
    act(() => get().connectionSection.onChangeConnection());
    act(() => get().connectionSection.onLanIpChange('10.0.0.9'));
    await act(async () => {
      get().connectionSection.onConnectPress();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      get().statusPanel.onChooseLanguage(PrintLanguage.Tspl);
    });

    unmount();

    expect(printerConnectionService.reconnect).toHaveBeenCalledWith('p1');
    expect(printerConnectionService.disconnect).not.toHaveBeenCalled();
  });

  it('sửa máy chưa kết nối, kết nối thử trong form rồi huỷ → ngắt', async () => {
    const { get, unmount } = render({
      visible: true,
      initialValues: savedTspl,
      onSaved: jest.fn(),
      kind: savedTspl.kind,
    });
    act(() => get().connectionSection.onChangeConnection());
    await act(async () => {
      get().connectionSection.onConnectPress();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      get().statusPanel.onChooseLanguage(PrintLanguage.Tspl);
    });

    unmount();

    expect(printerConnectionService.disconnect).toHaveBeenCalledWith('p1');
    expect(printerConnectionService.reconnect).not.toHaveBeenCalled();
  });

  it('onSave khi máy in KHÔNG đang kết nối → không kết nối (mở app mới kết nối)', async () => {
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
    expect(printerConnectionService.connect).not.toHaveBeenCalled();
    expect(printerConnectionService.reconnect).not.toHaveBeenCalled();
  });

  it('onSave khi máy đang kết nối → giữ nguyên kết nối, không ngắt hay kết nối lại', async () => {
    (printerConnectionService.getStatus as jest.Mock).mockReturnValue(ConnectionStatus.Connected);
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), kind: savedTspl.kind });
    await act(async () => {
      await get().infoCard.onSave();
    });
    expect(printerConnectionService.reconnect).not.toHaveBeenCalled();
    expect(printerConnectionService.disconnect).not.toHaveBeenCalled();
    expect(printerConnectionService.connect).not.toHaveBeenCalled();
  });

  /** Thêm máy tem LAN 10.0.0.5:9100: kết nối rồi chọn TSPL (LAN luôn chọn tay). */
  const connectLanLabel = async (get: () => UseAddPrinterFlow): Promise<void> => {
    act(() => get().connectionSection.onConnectionTypeChange(ConnectionType.Lan));
    act(() => get().connectionSection.onLanIpChange('10.0.0.5'));
    act(() => get().connectionSection.onLanPortChange('9100'));
    await act(async () => {
      get().connectionSection.onConnectPress();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      get().statusPanel.onChooseLanguage(PrintLanguage.Tspl);
    });
  };

  it('trùng (deviceId native trả, kind) với máy đã lưu → báo lỗi sau khi kết nối, chưa lưu được', async () => {
    (printerRepository.getPrinters as jest.Mock).mockReturnValue([{ ...savedTspl, id: 'other-id' }]);
    const { get } = render({ visible: true, onSaved: jest.fn(), kind: PrintKind.Label });
    expect(get().identityErrorMessage).toBeUndefined();

    await connectLanLabel(get);

    expect(get().identityErrorMessage).toBeDefined();
    expect(get().infoCard.saveDisabled).toBe(true);
  });

  it('cùng máy vật lý nhưng KHÁC loại nội dung → không báo lỗi (2 máy in cùng máy vật lý)', async () => {
    (printerRepository.getPrinters as jest.Mock).mockReturnValue([{ ...savedTspl, id: 'other-id', kind: PrintKind.Receipt }]);
    const { get } = render({ visible: true, onSaved: jest.fn(), kind: PrintKind.Label });

    await connectLanLabel(get);

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

  it('USB: lưu địa chỉ có serial, deviceId và tên native đọc được khi kết nối', async () => {
    const withSerial = { type: ConnectionType.Usb, vendorId: 11575, productId: 33751, serialNumber: 'SN1' } as const;
    (printerConnectionService.connect as jest.Mock).mockResolvedValueOnce(
      fakeConnectedDevice(withSerial, { name: 'XP-420B (USB)', manufacturer: 'Xprinter' }),
    );
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
        connection: withSerial,
        deviceId: 'usb:11575:33751:SN1',
        name: 'XP-420B (USB)',
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

  it('đổi giấy chưa ghi vào máy in đã lưu, bấm Lưu mới ghi', async () => {
    jest.mocked(printerRepository.findById).mockReturnValueOnce(savedTspl);
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), kind: savedTspl.kind });
    act(() => get().infoCard.paperForm.setValue('paperSize', PaperSize.Mm100));
    expect(printerRepository.updatePrinter).not.toHaveBeenCalled();

    await act(async () => {
      await get().infoCard.onSave();
    });

    expect(printerRepository.updatePrinter).toHaveBeenCalledWith(
      expect.objectContaining({ paper: expect.objectContaining({ paperSize: PaperSize.Mm100 }) }),
    );
  });

  it('chuyển sang giấy tem thì các ô kích thước có sẵn giá trị mặc định', () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), kind: savedTspl.kind });
    act(() => get().infoCard.paperForm.setValue('type', PaperType.DieCut));
    expect(get().infoCard.paperForm.getValues()).toMatchObject({
      type: PaperType.DieCut,
      itemWidthMm: '30',
      columns: '2',
      verticalGapMm: '3',
    });
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
    act(() => get().infoCard.paperForm.setValue('type', PaperType.DieCut));
    act(() => get().infoCard.paperForm.setValue('itemWidthMm', ''));
    await act(async () => {
      await get().infoCard.onTestPrint();
    });
    expect(printerService.testPrint).not.toHaveBeenCalled();
    expect(get().testPrintErrorMessage).toBe('Rộng tem phải là số lớn hơn 0');
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
    jest.mocked(printerRepository.findById).mockReturnValueOnce(savedTspl);
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

  it('saveDisabled true khi giấy tem thiếu kích thước (hasDieCutMediaError)', () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), kind: savedTspl.kind });
    act(() => get().infoCard.paperForm.setValue('type', PaperType.DieCut));
    act(() => get().infoCard.paperForm.setValue('itemWidthMm', ''));
    expect(get().hasDieCutMediaError).toBe(true);
    expect(get().infoCard.saveDisabled).toBe(true);
  });

  it('sau onSelectDevice quét được thiết bị → đánh dấu theo mã quét của thiết bị đó', () => {
    const { get } = render({ visible: true, onSaved: jest.fn(), kind: PrintKind.Receipt });
    act(() => get().connectionSection.onSelectDevice(usbDevice));
    expect(get().connectionSection.selectedScanId).toBe(usbDevice.deviceId);
  });
});
