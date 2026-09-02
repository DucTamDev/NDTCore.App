import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAddPrinterFlow, type UseAddPrinterFlow } from '../useAddPrinterFlow';
import { PrinterRepository } from '../../storage/PrinterRepository';
import { PrinterConnectionService } from '../../services/PrinterConnectionService';
import { PrinterConfigService } from '../../services/PrinterConfigService';
import { DeviceScanService } from '../../services/device/DeviceScanService';
import { DiscoveryStage } from '../../services/discovery/PrinterDiscoveryService';
import { ConnectionType } from '../../models/printer/PrinterDevice';
import { DriverSource, PrinterDriverType, TsplRenderMode } from '../../models/printer/PrinterDriver';
import { PrintType } from '../../models/printing/PrintType';
import type { Printer } from '../../models/printer/Printer';

jest.mock('../../storage/PrinterRepository', () => ({
  PrinterRepository: {
    getPrinters: jest.fn(() => []),
    addPrinter: jest.fn(),
    updatePrinter: jest.fn(),
  },
}));

jest.mock('../../services/PrinterConnectionService', () => ({
  PrinterConnectionService: {
    getStatusForDriver: jest.fn(() => 'idle'),
    onStatusChangeForDriver: jest.fn(() => () => undefined),
    disconnectForDriver: jest.fn(() => Promise.resolve()),
    connectDraft: jest.fn(() => Promise.resolve()),
    connect: jest.fn(() => Promise.resolve()),
    reconnect: jest.fn(() => Promise.resolve()),
    testPrint: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../../services/PrinterConfigService', () => ({
  PrinterConfigService: {
    installTsplFont: jest.fn(() => Promise.resolve()),
    setTsplRenderMode: jest.fn(),
    setTsplInternalFont: jest.fn(),
    setDriverMedia: jest.fn(),
  },
}));

jest.mock('../../services/device/DeviceScanService', () => ({
  DeviceScanService: {
    discoverDriver: jest.fn(() => () => undefined),
  },
}));

const mockCaptureBillImage = jest.fn(() => Promise.resolve(null));
jest.mock('../useBillImageCapture', () => ({
  useBillImageCapture: () => ({ captureNode: null, captureBillImage: mockCaptureBillImage }),
}));

jest.mock('../../services/device/NetworkInfoService', () => ({ getCurrentWifiIp: jest.fn(() => Promise.resolve(null)) }));

const savedTspl: Printer = {
  id: 'p1',
  name: 'Máy tem',
  drivers: [
    {
      type: PrinterDriverType.tspl,
      source: DriverSource.auto,
      contentTypes: [PrintType.Label],
      config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.truetype, media: { type: 'continuous', paperSize: 80 }, font: { name: 'VIETFONT', fileName: 'Roboto-Regular.ttf', fontInstalled: true } },
    },
  ],
  connection: { type: ConnectionType.lan, lan: { ip: '10.0.0.5', port: 9100 } },
  identityKey: 'lan:10.0.0.5:9100',
  capabilities: { cutter: false },
  autoReconnect: true,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
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
    (PrinterConnectionService.getStatusForDriver as jest.Mock).mockReturnValue('idle');
    (DeviceScanService.discoverDriver as jest.Mock).mockImplementation((_input: unknown, handler: (e: unknown) => void) => {
      capturedDiscoveryHandler = handler;
      return () => undefined;
    });
  });

  it('title reflects add vs edit', () => {
    expect(render({ visible: true, onSaved: jest.fn() }).get().title).toBe('Thêm máy in');
    expect(render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() }).get().title).toBe('Chỉnh sửa máy in');
  });

  it('edit mode seeds drivers and marks it saveable (not connectionDirty)', () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    expect(get().infoCard.drivers).toHaveLength(1);
    expect(get().infoCard.saveDisabled).toBe(false);
    expect(get().infoCard.locked).toBe(false);
  });

  it('onToggleContentType adds/removes a content type on the right driver', () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    act(() => get().infoCard.onToggleContentType(PrinterDriverType.tspl, PrintType.Receipt, true));
    expect(get().infoCard.drivers[0].contentTypes).toEqual(expect.arrayContaining([PrintType.Label, PrintType.Receipt]));
    act(() => get().infoCard.onToggleContentType(PrinterDriverType.tspl, PrintType.Label, false));
    expect(get().infoCard.drivers[0].contentTypes).toEqual([PrintType.Receipt]);
  });

  it('discovery "identified" event connects + appends the detected driver', () => {
    const { get } = render({ visible: true, onSaved: jest.fn() });
    act(() => get().connectionSection.onConnectPress());
    act(() => capturedDiscoveryHandler?.({ stage: DiscoveryStage.identified, protocol: PrinterDriverType.tspl }));
    expect(get().statusPanel.connectionState).toBe('connected');
    expect(get().statusPanel.protocolState).toBe('identified');
    expect(get().infoCard.drivers.map((d) => d.type)).toEqual([PrinterDriverType.tspl]);
  });

  it('discovery "unknown_protocol" event surfaces the manual-pick state', () => {
    const { get } = render({ visible: true, onSaved: jest.fn() });
    act(() => get().connectionSection.onConnectPress());
    act(() => capturedDiscoveryHandler?.({ stage: DiscoveryStage.unknown_protocol }));
    expect(get().statusPanel.protocolState).toBe('unknown');
  });

  it('purpose=Label prefill chỉ bật Tem cho driver TSPL mới thêm (không tự bật cả Hoá đơn)', () => {
    const { get } = render({ visible: true, onSaved: jest.fn(), purpose: PrintType.Label });
    act(() => get().connectionSection.onConnectPress());
    act(() => capturedDiscoveryHandler?.({ stage: DiscoveryStage.identified, protocol: PrinterDriverType.tspl }));
    expect(get().infoCard.drivers[0].contentTypes).toEqual([PrintType.Label]);
    expect(get().hasPurposeMismatchDriver).toBe(false);
  });

  it('purpose=Label + driver ESC/POS (không hỗ trợ Tem) → giữ contentTypes mặc định + báo mismatch', async () => {
    const { get } = render({ visible: true, onSaved: jest.fn(), purpose: PrintType.Label });
    act(() => get().connectionSection.onConnectPress());
    act(() => capturedDiscoveryHandler?.({ stage: DiscoveryStage.unknown_protocol }));
    await act(async () => { get().statusPanel.onChooseProtocol(PrinterDriverType.escpos); });
    expect(get().infoCard.drivers[0].contentTypes).toEqual([PrintType.Receipt]);
    expect(get().hasPurposeMismatchDriver).toBe(true);
    expect(get().infoCard.saveDisabled).toBe(false);
  });

  it('không có purpose (Sửa máy in) → hasPurposeMismatchDriver luôn false', () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    expect(get().hasPurposeMismatchDriver).toBe(false);
  });

  it('onSave (edit) calls PrinterRepository.updatePrinter with the full draft', async () => {
    const onSaved = jest.fn();
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved });
    await act(async () => { await get().infoCard.onSave(); });
    expect(PrinterRepository.updatePrinter).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'p1',
        connection: expect.objectContaining({ type: ConnectionType.lan }),
        capabilities: { cutter: false },
        drivers: expect.any(Array),
      }),
    );
    const saved = (PrinterRepository.updatePrinter as jest.Mock).mock.calls[0][0] as Printer;
    expect(saved.capabilities.cutter).toBe(false);
    expect(saved.drivers.every((d) => d.config.media.paperSize === 80)).toBe(true);
    expect(onSaved).toHaveBeenCalled();
  });

  it('onSave khi driver đang connected → reconnect (không connect) để context lấy media đã lưu', async () => {
    (PrinterConnectionService.getStatusForDriver as jest.Mock).mockReturnValue('connected');
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    await act(async () => { await get().infoCard.onSave(); });
    expect(PrinterConnectionService.reconnect).toHaveBeenCalledWith('p1');
    expect(PrinterConnectionService.connect).not.toHaveBeenCalled();
  });

  it('onSelectTsplRenderMode(bitmap) drops to bitmap and persists symmetrically', async () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    await act(async () => { await get().infoCard.onSelectTsplRenderMode(TsplRenderMode.bitmap); });
    expect(PrinterConfigService.setTsplRenderMode).toHaveBeenCalledWith('p1', TsplRenderMode.bitmap);
    const tspl = get().infoCard.drivers[0];
    expect(tspl.config.type === PrinterDriverType.tspl && tspl.config.renderMode).toBe(TsplRenderMode.bitmap);
  });

  it('onSelectTsplRenderMode(internalfont) sets config + persists via setTsplInternalFont', async () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    await act(async () => { await get().infoCard.onSelectTsplRenderMode(TsplRenderMode.internalfont); });
    expect(PrinterConfigService.setTsplInternalFont).toHaveBeenCalledWith('p1', { codepage: '1258', fontName: '3' });
    const tspl = get().infoCard.drivers[0];
    expect(tspl.config.type === PrinterDriverType.tspl && tspl.config.renderMode).toBe(TsplRenderMode.internalfont);
  });

  it('onChangeTsplInternalFont merges a patch and re-persists', async () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    await act(async () => { await get().infoCard.onSelectTsplRenderMode(TsplRenderMode.internalfont); });
    await act(async () => { get().infoCard.onChangeTsplInternalFont({ fontName: 'TSS24.BF2' }); });
    expect(PrinterConfigService.setTsplInternalFont).toHaveBeenLastCalledWith('p1', { codepage: '1258', fontName: 'TSS24.BF2' });
  });

  it('hiding the modal while connected disconnects each seeded driver without saving', () => {
    const { update } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    update({ visible: false, initialValues: savedTspl, onSaved: jest.fn() });
    expect(PrinterConnectionService.disconnectForDriver).toHaveBeenCalledWith(PrinterDriverType.tspl, 'p1');
  });

  it('does NOT disconnect on hide when the printer was just saved', async () => {
    const { get, update } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    await act(async () => { await get().infoCard.onSave(); });
    (PrinterConnectionService.disconnectForDriver as jest.Mock).mockClear();
    update({ visible: false, initialValues: savedTspl, onSaved: jest.fn() });
    expect(PrinterConnectionService.disconnectForDriver).not.toHaveBeenCalled();
  });

  it('unmount (phone backToList) khi đang connected disconnects each draft driver', () => {
    const { unmount } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    unmount();
    expect(PrinterConnectionService.disconnectForDriver).toHaveBeenCalledWith(PrinterDriverType.tspl, 'p1');
  });

  it('unmount sau khi Save thành công KHÔNG disconnect', async () => {
    const { get, unmount } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    await act(async () => { await get().infoCard.onSave(); });
    (PrinterConnectionService.disconnectForDriver as jest.Mock).mockClear();
    unmount();
    expect(PrinterConnectionService.disconnectForDriver).not.toHaveBeenCalled();
  });

  it('onChangeDriverMedia(die_cut) trên printer đã lưu → persist media ĐÃ MERGE, không phải raw patch', async () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    await act(async () => { get().infoCard.onChangeDriverMedia(PrinterDriverType.tspl, { type: 'die_cut' }); });
    expect(PrinterConfigService.setDriverMedia).toHaveBeenCalledWith(
      'p1',
      PrinterDriverType.tspl,
      expect.objectContaining({ type: 'die_cut', paperSize: 80, itemWidthMm: 30, itemHeightMm: 20, columns: 2, horizontalGapMm: 2, verticalGapMm: 3 }),
    );
  });

  it('draft handed to connectDraft carries per-driver config.media', async () => {
    const { get } = render({ visible: true, onSaved: jest.fn() });
    act(() => get().connectionSection.onConnectPress());
    act(() => capturedDiscoveryHandler?.({ stage: DiscoveryStage.unknown_protocol }));
    await act(async () => { get().statusPanel.onChooseProtocol(PrinterDriverType.escpos); });
    const draft = (PrinterConnectionService.connectDraft as jest.Mock).mock.calls[0][0] as Printer;
    expect(draft.drivers.length).toBeGreaterThan(0);
    expect(draft.drivers.every((d) => d.config.media?.type === 'continuous')).toBe(true);
  });

  it('manual protocol pick connects the draft and appends a "manual" driver', async () => {
    const { get } = render({ visible: true, onSaved: jest.fn() });
    act(() => get().connectionSection.onConnectPress());
    act(() => capturedDiscoveryHandler?.({ stage: DiscoveryStage.unknown_protocol }));
    await act(async () => { get().statusPanel.onChooseProtocol(PrinterDriverType.escpos); });
    expect(PrinterConnectionService.connectDraft).toHaveBeenCalled();
    expect(get().statusPanel.connectionState).toBe('connected');
    expect(get().infoCard.drivers[0]).toEqual(expect.objectContaining({ type: PrinterDriverType.escpos, source: DriverSource.manual }));
  });

  it('onChangeDriverMedia cập nhật media của driver đích và persist qua setDriverMedia', async () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    await act(async () => { get().infoCard.onChangeDriverMedia(PrinterDriverType.tspl, { paperSize: 100 }); });
    expect(get().infoCard.drivers[0].config.media.paperSize).toBe(100);
    expect(PrinterConfigService.setDriverMedia).toHaveBeenCalledWith('p1', PrinterDriverType.tspl, { type: 'continuous', paperSize: 100 });
  });

  it('onChangeDriverMedia chỉ đổi driver đích — draft giữ media per-driver, không bị đè', async () => {
    const twoDriver: Printer = {
      ...savedTspl,
      drivers: [
        { type: PrinterDriverType.escpos, source: DriverSource.auto, contentTypes: [PrintType.Receipt], config: { type: PrinterDriverType.escpos, media: { type: 'continuous', paperSize: 80 } } },
        savedTspl.drivers[0],
      ],
    };
    const { get } = render({ visible: true, initialValues: twoDriver, onSaved: jest.fn() });
    await act(async () => { get().infoCard.onChangeDriverMedia(PrinterDriverType.tspl, { paperSize: 100 }); });
    await act(async () => { await get().infoCard.onSave(); });
    const saved = (PrinterRepository.updatePrinter as jest.Mock).mock.calls[0][0] as Printer;
    expect(saved.drivers.find((d) => d.type === PrinterDriverType.tspl)?.config.media.paperSize).toBe(100);
    expect(saved.drivers.find((d) => d.type === PrinterDriverType.escpos)?.config.media.paperSize).toBe(80);
  });

  it('điền sẵn tên hiển thị bằng tên thiết bị sau khi kết nối (ô còn để user sửa)', async () => {
    const { get } = render({ visible: true, onSaved: jest.fn() });
    act(() => get().connectionSection.onSelectDevice({ deviceId: '11575:33751', displayName: 'XP-420B', rawDevice: { vendor_id: 11575, product_id: 33751 } }));
    act(() => get().connectionSection.onConnectPress());
    act(() => capturedDiscoveryHandler?.({ stage: DiscoveryStage.unknown_protocol }));
    await act(async () => { get().statusPanel.onChooseProtocol(PrinterDriverType.escpos); });
    expect((get().infoCard.control as unknown as { _formValues: { name: string } })._formValues.name).toBe('XP-420B');
  });

  it('KHÔNG ghi đè tên hiển thị nếu user đã gõ', async () => {
    const { get } = render({ visible: true, onSaved: jest.fn() });
    act(() => get().connectionSection.onSelectDevice({ deviceId: '11575:33751', displayName: 'XP-420B', rawDevice: { vendor_id: 11575, product_id: 33751 } }));
    act(() => { (get().infoCard.control as unknown as { _formValues: { name: string } })._formValues.name = 'Máy quầy 1'; });
    act(() => get().connectionSection.onConnectPress());
    act(() => capturedDiscoveryHandler?.({ stage: DiscoveryStage.unknown_protocol }));
    await act(async () => { get().statusPanel.onChooseProtocol(PrinterDriverType.escpos); });
    expect((get().infoCard.control as unknown as { _formValues: { name: string } })._formValues.name).toBe('Máy quầy 1');
  });

  it('discovery "error" stage shows the error message and no driver', () => {
    const { get } = render({ visible: true, onSaved: jest.fn() });
    act(() => get().connectionSection.onConnectPress());
    act(() => capturedDiscoveryHandler?.({ stage: DiscoveryStage.error, error: { code: 'X', message: 'mất kết nối' } }));
    expect(get().statusPanel.connectionState).toBe('error');
    expect(get().statusPanel.errorMessage).toBe('mất kết nối');
    expect(get().infoCard.drivers).toHaveLength(0);
  });

  it('add-mode save calls addPrinter and auto-connects when autoReconnect is on', async () => {
    const onSaved = jest.fn();
    const { get } = render({ visible: true, onSaved });
    act(() => get().connectionSection.onConnectPress());
    act(() => capturedDiscoveryHandler?.({ stage: DiscoveryStage.identified, protocol: PrinterDriverType.tspl }));
    act(() => get().infoCard.onToggleContentType(PrinterDriverType.tspl, PrintType.Receipt, true));
    await act(async () => { await get().infoCard.onSave(); });
    expect(PrinterRepository.addPrinter).toHaveBeenCalledWith(expect.objectContaining({ drivers: expect.any(Array) }));
    const added = (PrinterRepository.addPrinter as jest.Mock).mock.calls[0][0] as Printer;
    expect(added.capabilities.cutter).toBe(false);
    expect(added.drivers.every((d) => d.config.media.paperSize === 80)).toBe(true);
    expect(PrinterConnectionService.connect).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });

  it('runTestPrint routes the sample document to PrinterConnectionService.testPrint for the matching driver', async () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    await act(async () => { await get().infoCard.onTestPrintLabel(); });
    expect(PrinterConnectionService.testPrint).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1' }),
      expect.objectContaining({ type: PrinterDriverType.tspl }),
      expect.objectContaining({ text: expect.anything() }),
      PrintType.Label,
      { rows: 1 },
    );
  });

  it('onChangeDriverMedia type=die_cut điền 5 field default', async () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    await act(async () => { get().infoCard.onChangeDriverMedia(PrinterDriverType.tspl, { type: 'die_cut' }); });
    const tspl = get().infoCard.drivers[0];
    expect(tspl.config.media).toMatchObject({ type: 'die_cut', itemWidthMm: 30, columns: 2, verticalGapMm: 3 });
  });

  it('runTestPrint(Label) ở chế độ bitmap gọi captureBillImage với media của driver (die_cut)', async () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    await act(async () => { await get().infoCard.onSelectTsplRenderMode(TsplRenderMode.bitmap); });
    await act(async () => { get().infoCard.onChangeDriverMedia(PrinterDriverType.tspl, { type: 'die_cut' }); });
    await act(async () => { await get().infoCard.onTestPrintLabel(); });
    expect(mockCaptureBillImage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'die_cut', columns: expect.any(Number) }),
    );
  });

  it('runTestPrint(Label) với testPrintRowsText=3 → testPrint nhận { rows: 3 }', async () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    await act(async () => { get().infoCard.onTestPrintRowsChange('3'); });
    await act(async () => { await get().infoCard.onTestPrintLabel(); });
    expect(PrinterConnectionService.testPrint).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), PrintType.Label, { rows: 3 });
  });

  it('onSelectTsplRenderMode(truetype) installs the font and flips config to truetype', async () => {
    const bitmapTspl: Printer = {
      ...savedTspl,
      drivers: [{ ...savedTspl.drivers[0], config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap, media: { type: 'continuous', paperSize: 80 } } }],
    };
    const { get } = render({ visible: true, initialValues: bitmapTspl, onSaved: jest.fn() });
    await act(async () => { await get().infoCard.onSelectTsplRenderMode(TsplRenderMode.truetype); });
    expect(PrinterConfigService.installTsplFont).toHaveBeenCalledWith('p1', expect.objectContaining({ fileName: expect.any(String) }));
    const tspl = get().infoCard.drivers[0];
    expect(tspl.config.type === PrinterDriverType.tspl && tspl.config.renderMode).toBe(TsplRenderMode.truetype);
    expect(tspl.config.type === PrinterDriverType.tspl && tspl.config.font?.fontInstalled).toBe(true);
  });
});
