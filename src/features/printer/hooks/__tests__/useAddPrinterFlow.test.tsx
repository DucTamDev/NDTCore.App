import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAddPrinterFlow, type UseAddPrinterFlow } from '../useAddPrinterFlow';
import { PrinterService } from '../../printing/PrinterService';
import { DiscoveryStage } from '../../discovery/PrinterDiscoveryService';
import { ConnectionType, DriverSource, PrinterDriverType, TsplRenderMode } from '../../types/printer.types';
import { PrintType } from '../../types/printConfiguration.types';
import type { Printer } from '../../types/printer.types';

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
      config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.truetype, font: { name: 'VIETFONT', fileName: 'Roboto-Regular.ttf', fontInstalled: true } },
    },
  ],
  connectionType: ConnectionType.lan,
  lan: { ip: '10.0.0.5', port: 9100 },
  identityKey: 'lan:10.0.0.5:9100',
  paperSize: 80,
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
      expect.objectContaining({ id: 'p1', connectionType: ConnectionType.lan, paperSize: 80, drivers: expect.any(Array) }),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('onToggleTsplFont(false) drops to bitmap and persists symmetrically', async () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    await act(async () => { await get().infoCard.onToggleTsplFont(false); });
    expect(PrinterService.setTsplRenderMode).toHaveBeenCalledWith('p1', TsplRenderMode.bitmap);
    const tspl = get().infoCard.drivers[0];
    expect(tspl.config.type === PrinterDriverType.tspl && tspl.config.renderMode).toBe(TsplRenderMode.bitmap);
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
});
