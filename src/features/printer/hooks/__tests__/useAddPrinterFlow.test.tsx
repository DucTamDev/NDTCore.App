import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAddPrinterFlow, type UseAddPrinterFlow } from '../useAddPrinterFlow';
import { PrinterService } from '../../printing/PrinterService';
import { DiscoveryStage } from '../../discovery/PrinterDiscoveryService';
import { ConnectionType, DriverSource, PrinterDriverType, TsplRenderMode } from '../../types/printer.types';
import { PrintType } from '../../types/printConfiguration.types';
import type { Printer, PrinterDriver } from '../../types/printer.types';

jest.mock('../../printing/PrinterService', () => ({
  PrinterService: {
    getPrinters: jest.fn(() => []),
    getStatusForDriver: jest.fn(() => 'idle'),
    onStatusChangeForDriver: jest.fn(() => () => undefined),
    disconnectForDriver: jest.fn(() => Promise.resolve()),
    discoverDriver: jest.fn(() => () => undefined),
    connectDraft: jest.fn(() => Promise.resolve()),
    connect: jest.fn(() => Promise.resolve()),
    addPrinter: jest.fn(),
    updatePrinter: jest.fn(),
    installTsplFont: jest.fn(() => Promise.resolve()),
    setTsplRenderMode: jest.fn(),
    setTsplInternalFont: jest.fn(),
    testPrint: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../useBillImageCapture', () => ({
  useBillImageCapture: () => ({ captureNode: null, captureBillImage: jest.fn(() => Promise.resolve(null)) }),
}));

jest.mock('../../services/NetworkInfoService', () => ({ getCurrentWifiIp: jest.fn(() => Promise.resolve(null)) }));

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
  connectionType: ConnectionType.lan,
  lan: { ip: '10.0.0.5', port: 9100 },
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
  };
};

describe('useAddPrinterFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (PrinterService.getPrinters as jest.Mock).mockReturnValue([]);
    (PrinterService.discoverDriver as jest.Mock).mockImplementation((_input: unknown, handler: (e: unknown) => void) => {
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

  it('onSave (edit) calls PrinterService.updatePrinter with the full draft', async () => {
    const onSaved = jest.fn();
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved });
    await act(async () => { await get().infoCard.onSave(); });
    expect(PrinterService.updatePrinter).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1', connectionType: ConnectionType.lan, capabilities: { cutter: false }, drivers: expect.any(Array) }),
    );
    const saved = (PrinterService.updatePrinter as jest.Mock).mock.calls[0][0] as Printer;
    expect(saved.capabilities.cutter).toBe(false);
    expect(saved.drivers.every((d) => d.config.media.paperSize === 80)).toBe(true);
    expect(onSaved).toHaveBeenCalled();
  });

  it('onSelectTsplRenderMode(bitmap) drops to bitmap and persists symmetrically', async () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    await act(async () => { await get().infoCard.onSelectTsplRenderMode(TsplRenderMode.bitmap); });
    expect(PrinterService.setTsplRenderMode).toHaveBeenCalledWith('p1', TsplRenderMode.bitmap);
    const tspl = get().infoCard.drivers[0];
    expect(tspl.config.type === PrinterDriverType.tspl && tspl.config.renderMode).toBe(TsplRenderMode.bitmap);
  });

  it('onSelectTsplRenderMode(internalfont) sets config + persists via setTsplInternalFont', async () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    await act(async () => { await get().infoCard.onSelectTsplRenderMode(TsplRenderMode.internalfont); });
    expect(PrinterService.setTsplInternalFont).toHaveBeenCalledWith('p1', { codepage: '1258', fontName: '3' });
    const tspl = get().infoCard.drivers[0];
    expect(tspl.config.type === PrinterDriverType.tspl && tspl.config.renderMode).toBe(TsplRenderMode.internalfont);
  });

  it('onChangeTsplInternalFont merges a patch and re-persists', async () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    await act(async () => { await get().infoCard.onSelectTsplRenderMode(TsplRenderMode.internalfont); });
    await act(async () => { get().infoCard.onChangeTsplInternalFont({ fontName: 'TSS24.BF2' }); });
    expect(PrinterService.setTsplInternalFont).toHaveBeenLastCalledWith('p1', { codepage: '1258', fontName: 'TSS24.BF2' });
  });

  it('hiding the modal while connected disconnects each seeded driver without saving', () => {
    const { update } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    update({ visible: false, initialValues: savedTspl, onSaved: jest.fn() });
    expect(PrinterService.disconnectForDriver).toHaveBeenCalledWith(PrinterDriverType.tspl, 'p1');
  });

  it('does NOT disconnect on hide when the printer was just saved', async () => {
    const { get, update } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    await act(async () => { await get().infoCard.onSave(); });
    (PrinterService.disconnectForDriver as jest.Mock).mockClear();
    update({ visible: false, initialValues: savedTspl, onSaved: jest.fn() });
    expect(PrinterService.disconnectForDriver).not.toHaveBeenCalled();
  });

  it('manual protocol pick connects the draft and appends a "manual" driver', async () => {
    const { get } = render({ visible: true, onSaved: jest.fn() });
    act(() => get().connectionSection.onConnectPress());
    act(() => capturedDiscoveryHandler?.({ stage: DiscoveryStage.unknown_protocol }));
    await act(async () => { get().statusPanel.onChooseProtocol(PrinterDriverType.escpos); });
    expect(PrinterService.connectDraft).toHaveBeenCalled();
    expect(get().statusPanel.connectionState).toBe('connected');
    expect(get().infoCard.drivers[0]).toEqual(expect.objectContaining({ type: PrinterDriverType.escpos, source: DriverSource.manual }));
  });

  it('manual protocol pick hands connectDraft a draft whose every driver.config.media.paperSize matches the form', async () => {
    const { get } = render({ visible: true, onSaved: jest.fn() });
    act(() => { (get().infoCard.control as unknown as { _formValues: { paperSize: number } })._formValues.paperSize = 58; });
    act(() => get().connectionSection.onConnectPress());
    act(() => capturedDiscoveryHandler?.({ stage: DiscoveryStage.unknown_protocol }));
    await act(async () => { get().statusPanel.onChooseProtocol(PrinterDriverType.escpos); });
    const [draft, draftDriver] = (PrinterService.connectDraft as jest.Mock).mock.calls[0] as [Printer, PrinterDriver];
    expect(draft.drivers.length).toBeGreaterThan(0);
    expect(draft.drivers.every((d) => d.config.media.paperSize === 58)).toBe(true);
    expect(draftDriver.config.media.paperSize).toBe(58);
  });

  it('manual protocol pick with a driver ALREADY in the list hands connectDraft both entries at the form paperSize', async () => {
    const { get } = render({ visible: true, onSaved: jest.fn() });
    act(() => { (get().infoCard.control as unknown as { _formValues: { paperSize: number } })._formValues.paperSize = 58; });
    act(() => get().connectionSection.onConnectPress());
    act(() => capturedDiscoveryHandler?.({ stage: DiscoveryStage.unknown_protocol }));
    await act(async () => { await get().statusPanel.onChooseProtocol(PrinterDriverType.escpos); });
    await act(async () => { await get().statusPanel.onChooseProtocol(PrinterDriverType.tspl); });
    const calls = (PrinterService.connectDraft as jest.Mock).mock.calls as [Printer, PrinterDriver][];
    const [draft] = calls[calls.length - 1];
    expect(draft.drivers).toHaveLength(2);
    expect(draft.drivers.map((d) => d.type)).toEqual([PrinterDriverType.escpos, PrinterDriverType.tspl]);
    expect(draft.drivers.every((d) => d.config.media.paperSize === 58)).toBe(true);
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
    expect(PrinterService.addPrinter).toHaveBeenCalledWith(expect.objectContaining({ drivers: expect.any(Array) }));
    const added = (PrinterService.addPrinter as jest.Mock).mock.calls[0][0] as Printer;
    expect(added.capabilities.cutter).toBe(false);
    expect(added.drivers.every((d) => d.config.media.paperSize === 80)).toBe(true);
    expect(PrinterService.connect).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });

  it('runTestPrint routes the sample document to PrinterService.testPrint for the matching driver', async () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    await act(async () => { await get().infoCard.onTestPrintLabel(); });
    expect(PrinterService.testPrint).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1' }),
      expect.objectContaining({ type: PrinterDriverType.tspl }),
      expect.objectContaining({ text: expect.anything() }),
      PrintType.Label,
    );
  });

  it('onSelectTsplRenderMode(truetype) installs the font and flips config to truetype', async () => {
    const bitmapTspl: Printer = {
      ...savedTspl,
      drivers: [{ ...savedTspl.drivers[0], config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap, media: { type: 'continuous', paperSize: 80 } } }],
    };
    const { get } = render({ visible: true, initialValues: bitmapTspl, onSaved: jest.fn() });
    await act(async () => { await get().infoCard.onSelectTsplRenderMode(TsplRenderMode.truetype); });
    expect(PrinterService.installTsplFont).toHaveBeenCalledWith('p1', expect.objectContaining({ fileName: expect.any(String) }));
    const tspl = get().infoCard.drivers[0];
    expect(tspl.config.type === PrinterDriverType.tspl && tspl.config.renderMode).toBe(TsplRenderMode.truetype);
    expect(tspl.config.type === PrinterDriverType.tspl && tspl.config.font?.fontInstalled).toBe(true);
  });
});
