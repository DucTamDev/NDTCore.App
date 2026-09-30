import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAddPrinterFlow, type UseAddPrinterFlow } from '../useAddPrinterFlow';
import { PrinterRepository } from '../../storage/PrinterRepository';
import { PrinterConnectionService } from '../../connection/PrinterConnectionService';
import { PrinterPrintService } from '../../printing/PrinterPrintService';
import { PrinterConfigService } from '../../management/PrinterConfigService';
import { DeviceScanService } from '../../discovery/DeviceScanService';
import { DiscoveryStage } from '../../discovery/PrinterDiscoveryService';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import { DriverSource, PrinterDriverType, RenderMode } from '../../models/printer/PrinterDriver';
import { PrintPaperType, PaperSize } from '../../models/paper/PrintPaperConfig';
import { PrintType } from '../../models/printing/PrintType';
import { PrinterStatus } from '../../models/printer/PrinterStatus';
import type { Printer } from '../../models/printer/Printer';

// Đặt tên bắt đầu bằng "mock" — babel-plugin-jest-hoist chỉ cho phép factory
// của jest.mock() tham chiếu biến out-of-scope theo pattern này.
const mockIdleStatus = PrinterStatus.Idle;

jest.mock('../../storage/PrinterRepository', () => ({
  PrinterRepository: {
    getPrinters: jest.fn(() => []),
    addPrinter: jest.fn(),
    updatePrinter: jest.fn(),
  },
}));

jest.mock('../../connection/PrinterConnectionService', () => ({
  PrinterConnectionService: {
    getStatusForDriver: jest.fn(() => mockIdleStatus),
    onStatusChangeForDriver: jest.fn(() => () => undefined),
    disconnectForDriver: jest.fn(() => Promise.resolve()),
    connectDraft: jest.fn(() => Promise.resolve()),
    connect: jest.fn(() => Promise.resolve()),
    reconnect: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../../printing/PrinterPrintService', () => ({
  PrinterPrintService: {
    testPrint: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../../management/PrinterConfigService', () => ({
  PrinterConfigService: {
    setRenderMode: jest.fn(),
    setPaper: jest.fn(),
  },
}));

jest.mock('../../discovery/DeviceScanService', () => ({
  DeviceScanService: {
    discoverDriver: jest.fn(() => () => undefined),
  },
}));

const mockCaptureBillImage = jest.fn(() => Promise.resolve(null));
jest.mock('../useBillImageCapture', () => ({
  useBillImageCapture: () => ({ captureNode: null, captureBillImage: mockCaptureBillImage }),
}));

jest.mock('../../discovery/NetworkInfoService', () => ({ getCurrentWifiIp: jest.fn(() => Promise.resolve(null)) }));

const savedTspl: Printer = {
  id: 'p1',
  type: PrintType.Label,
  name: 'Máy tem',
  driver: { type: PrinterDriverType.Tspl, source: DriverSource.Auto, config: { renderMode: RenderMode.Bitmap } },
  paper: { type: PrintPaperType.Continuous, paperSize: PaperSize.Mm80 },
  connection: { type: PrinterConnectionType.Lan, host: '10.0.0.5', port: 9100 },
  identityKey: 'lan:10.0.0.5:9100',
  capabilities: { cutter: false },
  autoReconnect: true,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const savedEscpos: Printer = {
  ...savedTspl,
  id: 'p2',
  type: PrintType.Receipt,
  name: 'Máy hoá đơn',
  driver: { type: PrinterDriverType.EscPos, source: DriverSource.Auto, config: { renderMode: RenderMode.Encoder } },
  connection: { type: PrinterConnectionType.Lan, host: '10.0.0.6', port: 9100 },
  identityKey: 'lan:10.0.0.6:9100',
};

let capturedDiscoveryHandler: ((event: unknown) => void) | undefined;

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
    mockCaptureBillImage.mockClear();
    (PrinterRepository.getPrinters as jest.Mock).mockReturnValue([]);
    (PrinterConnectionService.getStatusForDriver as jest.Mock).mockReturnValue(PrinterStatus.Idle);
    (DeviceScanService.discoverDriver as jest.Mock).mockImplementation((_input: unknown, handler: (e: unknown) => void) => {
      capturedDiscoveryHandler = handler;
      return () => undefined;
    });
  });

  it('title reflects add vs edit', () => {
    expect(render({ visible: true, onSaved: jest.fn(), printType: PrintType.Receipt }).get().title).toBe('Thêm máy in');
    expect(render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), printType: savedTspl.type }).get().title).toBe(
      'Chỉnh sửa máy in',
    );
  });

  it('edit mode seeds the driver and marks it saveable (not connectionDirty, not locked)', () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), printType: savedTspl.type });
    expect(get().infoCard.driver).toEqual(savedTspl.driver);
    expect(get().infoCard.saveDisabled).toBe(false);
    expect(get().infoCard.locked).toBe(false);
  });

  it('connect → identify → save đi hết luồng với đúng 1 driver', async () => {
    const onSaved = jest.fn();
    const { get } = render({ visible: true, onSaved, printType: PrintType.Label });
    expect(get().infoCard.locked).toBe(true);

    act(() => get().connectionSection.onConnectPress());
    const detectedDriver = { type: PrinterDriverType.Tspl, source: DriverSource.Auto, config: { renderMode: RenderMode.Bitmap } };
    act(() =>
      capturedDiscoveryHandler?.({ stage: DiscoveryStage.Identified, protocol: PrinterDriverType.Tspl, driver: detectedDriver }),
    );

    expect(get().statusPanel.connectionState).toBe('connected');
    expect(get().statusPanel.protocolState).toBe('identified');
    expect(get().infoCard.driver).toEqual(detectedDriver);
    expect(get().infoCard.locked).toBe(false);

    await act(async () => {
      await get().infoCard.onSave();
    });

    expect(PrinterRepository.addPrinter).toHaveBeenCalledWith(
      expect.objectContaining({ type: PrintType.Label, driver: detectedDriver }),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('unknown_protocol → chọn tay protocol connect draft và gán driver "manual"', async () => {
    const { get } = render({ visible: true, onSaved: jest.fn(), printType: PrintType.Receipt });
    act(() => get().connectionSection.onConnectPress());
    act(() => capturedDiscoveryHandler?.({ stage: DiscoveryStage.UnknownProtocol }));
    expect(get().statusPanel.protocolState).toBe('unknown');

    await act(async () => {
      get().statusPanel.onChooseProtocol(PrinterDriverType.EscPos);
    });

    expect(PrinterConnectionService.connectDraft).toHaveBeenCalled();
    expect(get().statusPanel.connectionState).toBe('connected');
    expect(get().infoCard.driver).toEqual(expect.objectContaining({ type: PrinterDriverType.EscPos, source: DriverSource.Manual }));
  });

  it('cleanup: đóng modal trong lúc đang connected mà chưa Save → disconnect driver', () => {
    const { update } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), printType: savedTspl.type });
    update({ visible: false, initialValues: savedTspl, onSaved: jest.fn(), printType: savedTspl.type });
    expect(PrinterConnectionService.disconnectForDriver).toHaveBeenCalledWith(PrinterDriverType.Tspl, 'p1');
  });

  it('KHÔNG disconnect khi đóng modal ngay sau khi vừa Save', async () => {
    const { get, update } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), printType: savedTspl.type });
    await act(async () => {
      await get().infoCard.onSave();
    });
    (PrinterConnectionService.disconnectForDriver as jest.Mock).mockClear();
    update({ visible: false, initialValues: savedTspl, onSaved: jest.fn(), printType: savedTspl.type });
    expect(PrinterConnectionService.disconnectForDriver).not.toHaveBeenCalled();
  });

  it('unmount (phone backToList) trong lúc đang connected mà chưa Save → disconnect', () => {
    const { unmount } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), printType: savedTspl.type });
    unmount();
    expect(PrinterConnectionService.disconnectForDriver).toHaveBeenCalledWith(PrinterDriverType.Tspl, 'p1');
  });

  it('unmount sau khi Save thành công KHÔNG disconnect', async () => {
    const { get, unmount } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), printType: savedTspl.type });
    await act(async () => {
      await get().infoCard.onSave();
    });
    (PrinterConnectionService.disconnectForDriver as jest.Mock).mockClear();
    unmount();
    expect(PrinterConnectionService.disconnectForDriver).not.toHaveBeenCalled();
  });

  it('onSave khi driver KHÔNG đang connected (autoReconnect bật) → connect (không reconnect)', async () => {
    const onSaved = jest.fn();
    const { get } = render({ visible: true, onSaved, printType: PrintType.Label });
    act(() => get().connectionSection.onConnectPress());
    act(() =>
      capturedDiscoveryHandler?.({
        stage: DiscoveryStage.Identified,
        protocol: PrinterDriverType.Tspl,
        driver: { type: PrinterDriverType.Tspl, source: DriverSource.Auto, config: { renderMode: RenderMode.Bitmap } },
      }),
    );
    await act(async () => {
      await get().infoCard.onSave();
    });
    expect(PrinterConnectionService.connect).toHaveBeenCalled();
    expect(PrinterConnectionService.reconnect).not.toHaveBeenCalled();
  });

  it('onSave khi driver đang connected → reconnect (không connect) để context lấy paper đã lưu', async () => {
    (PrinterConnectionService.getStatusForDriver as jest.Mock).mockReturnValue(PrinterStatus.Connected);
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), printType: savedTspl.type });
    await act(async () => {
      await get().infoCard.onSave();
    });
    expect(PrinterConnectionService.reconnect).toHaveBeenCalledWith('p1');
    expect(PrinterConnectionService.connect).not.toHaveBeenCalled();
  });

  it('identity trùng (identityKey, type) — cùng key + cùng type → báo lỗi', () => {
    (PrinterRepository.getPrinters as jest.Mock).mockReturnValue([{ ...savedTspl, id: 'other-id' }]);
    const { get } = render({ visible: true, onSaved: jest.fn(), printType: PrintType.Label });
    act(() => get().connectionSection.onConnectionTypeChange(PrinterConnectionType.Lan));
    act(() => get().connectionSection.onLanIpChange('10.0.0.5'));
    act(() => get().connectionSection.onLanPortChange('9100'));
    expect(get().identityErrorMessage).toBeDefined();
  });

  it('identity cùng key nhưng KHÁC type → không báo lỗi (2 Printer cùng máy vật lý, khác nội dung)', () => {
    (PrinterRepository.getPrinters as jest.Mock).mockReturnValue([{ ...savedTspl, id: 'other-id', type: PrintType.Receipt }]);
    const { get } = render({ visible: true, onSaved: jest.fn(), printType: PrintType.Label });
    act(() => get().connectionSection.onConnectionTypeChange(PrinterConnectionType.Lan));
    act(() => get().connectionSection.onLanIpChange('10.0.0.5'));
    act(() => get().connectionSection.onLanPortChange('9100'));
    expect(get().identityErrorMessage).toBeUndefined();
  });

  it('discovery "error" stage hiển thị lỗi và không có driver', () => {
    const { get } = render({ visible: true, onSaved: jest.fn(), printType: PrintType.Receipt });
    act(() => get().connectionSection.onConnectPress());
    act(() => capturedDiscoveryHandler?.({ stage: DiscoveryStage.Error, error: { code: 'X', message: 'mất kết nối' } }));
    expect(get().statusPanel.connectionState).toBe('error');
    expect(get().statusPanel.errorMessage).toBe('mất kết nối');
    expect(get().infoCard.driver).toBeUndefined();
  });

  it('điền sẵn tên hiển thị bằng tên thiết bị sau khi kết nối (ô còn để user sửa)', async () => {
    const { get } = render({ visible: true, onSaved: jest.fn(), printType: PrintType.Receipt });
    act(() => get().connectionSection.onSelectDevice({ deviceId: '11575:33751', displayName: 'XP-420B', rawDevice: { vendor_id: 11575, product_id: 33751 } }));
    act(() => get().connectionSection.onConnectPress());
    act(() => capturedDiscoveryHandler?.({ stage: DiscoveryStage.UnknownProtocol }));
    await act(async () => {
      get().statusPanel.onChooseProtocol(PrinterDriverType.EscPos);
    });
    expect((get().infoCard.control as unknown as { _formValues: { name: string } })._formValues.name).toBe('XP-420B');
  });

  it('KHÔNG ghi đè tên hiển thị nếu user đã gõ', async () => {
    const { get } = render({ visible: true, onSaved: jest.fn(), printType: PrintType.Receipt });
    act(() => get().connectionSection.onSelectDevice({ deviceId: '11575:33751', displayName: 'XP-420B', rawDevice: { vendor_id: 11575, product_id: 33751 } }));
    act(() => {
      (get().infoCard.control as unknown as { _formValues: { name: string } })._formValues.name = 'Máy quầy 1';
    });
    act(() => get().connectionSection.onConnectPress());
    act(() => capturedDiscoveryHandler?.({ stage: DiscoveryStage.UnknownProtocol }));
    await act(async () => {
      get().statusPanel.onChooseProtocol(PrinterDriverType.EscPos);
    });
    expect((get().infoCard.control as unknown as { _formValues: { name: string } })._formValues.name).toBe('Máy quầy 1');
  });

  it('onSelectRenderMode cập nhật driver.config và persist qua PrinterConfigService.setRenderMode', () => {
    const { get } = render({ visible: true, initialValues: savedEscpos, onSaved: jest.fn(), printType: savedEscpos.type });
    act(() => get().infoCard.onSelectRenderMode(RenderMode.Bitmap));
    expect(PrinterConfigService.setRenderMode).toHaveBeenCalledWith('p2', RenderMode.Bitmap);
    expect(get().infoCard.driver?.config.renderMode).toBe(RenderMode.Bitmap);
  });

  it('onChangePaper merge patch và persist qua PrinterConfigService.setPaper', () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), printType: savedTspl.type });
    act(() => get().infoCard.onChangePaper({ paperSize: PaperSize.Mm100 }));
    expect(get().infoCard.paper.paperSize).toBe(PaperSize.Mm100);
    expect(PrinterConfigService.setPaper).toHaveBeenCalledWith('p1', expect.objectContaining({ paperSize: PaperSize.Mm100 }));
  });

  it('onChangePaper type=DieCut điền sẵn 5 field default', () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), printType: savedTspl.type });
    act(() => get().infoCard.onChangePaper({ type: PrintPaperType.DieCut }));
    expect(get().infoCard.paper).toMatchObject({ type: PrintPaperType.DieCut, itemWidthMm: 30, columns: 2, verticalGapMm: 3 });
  });

  it('onTestPrint gọi PrinterPrintService.testPrint với printer.type cố định (Label → rows)', async () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), printType: savedTspl.type });
    act(() => get().infoCard.onTestPrintRowsChange('3'));
    await act(async () => {
      await get().infoCard.onTestPrint();
    });
    expect(PrinterPrintService.testPrint).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1', type: PrintType.Label }),
      expect.objectContaining({ text: expect.anything() }),
      { rows: 3 },
    );
  });

  it('onTestPrint ở chế độ Bitmap gọi captureBillImage trước khi in; ở Encoder thì không', async () => {
    const bitmapEscpos: Printer = { ...savedEscpos, driver: { ...savedEscpos.driver, config: { renderMode: RenderMode.Bitmap } } };
    const { get: getBitmap } = render({ visible: true, initialValues: bitmapEscpos, onSaved: jest.fn(), printType: bitmapEscpos.type });
    await act(async () => {
      await getBitmap().infoCard.onTestPrint();
    });
    expect(mockCaptureBillImage).toHaveBeenCalledWith(expect.anything(), bitmapEscpos.paper);

    mockCaptureBillImage.mockClear();
    const { get: getEncoder } = render({ visible: true, initialValues: savedEscpos, onSaved: jest.fn(), printType: savedEscpos.type });
    await act(async () => {
      await getEncoder().infoCard.onTestPrint();
    });
    expect(mockCaptureBillImage).not.toHaveBeenCalled();
  });

  it('onSave (edit) gọi PrinterRepository.updatePrinter với draft đầy đủ', async () => {
    const onSaved = jest.fn();
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved, printType: savedTspl.type });
    await act(async () => {
      await get().infoCard.onSave();
    });
    expect(PrinterRepository.updatePrinter).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'p1',
        type: PrintType.Label,
        connection: expect.objectContaining({ type: PrinterConnectionType.Lan }),
        capabilities: { cutter: false },
        driver: savedTspl.driver,
        paper: savedTspl.paper,
      }),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('saveDisabled true khi paper die-cut thiếu field (hasDieCutMediaError)', () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn(), printType: savedTspl.type });
    act(() => get().infoCard.onChangePaper({ type: PrintPaperType.DieCut, itemWidthMm: undefined }));
    expect(get().hasDieCutMediaError).toBe(true);
    expect(get().infoCard.saveDisabled).toBe(true);
  });
});
