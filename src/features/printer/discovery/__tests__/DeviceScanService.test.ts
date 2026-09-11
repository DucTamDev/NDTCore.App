import { createDeviceScanService } from '../DeviceScanService';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import { DiscoveryStage } from '../PrinterDiscoveryService';
import { makeMockDriver, basePrinter } from '../../testing/printerServiceTestKit';

jest.mock('../../../../services/LoggerService', () => ({ LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() } }));

describe('DeviceScanService', () => {
  it('scanForConnectionType(usb) forwards to the escpos driver scan', () => {
    const escposDriver = makeMockDriver();
    const service = createDeviceScanService({ escpos: escposDriver, tspl: makeMockDriver() });
    const onEvent = jest.fn();
    service.scanForConnectionType(PrinterConnectionType.Usb, onEvent);
    expect(escposDriver.scan).toHaveBeenCalledWith(PrinterConnectionType.Usb, expect.any(Function));
  });

  it('scanForConnectionType(bluetooth) forwards to the tspl driver scan', () => {
    const tsplDriver = makeMockDriver();
    const service = createDeviceScanService({ escpos: makeMockDriver(), tspl: tsplDriver });
    const onEvent = jest.fn();
    service.scanForConnectionType(PrinterConnectionType.Bluetooth, onEvent);
    expect(tsplDriver.scan).toHaveBeenCalledWith(PrinterConnectionType.Bluetooth, expect.any(Function));
  });

  it('scan events pass through the logging tap to the caller unchanged', () => {
    const escposDriver = makeMockDriver();
    (escposDriver.scan as jest.Mock).mockImplementation((_ct, onEvent: (e: unknown) => void) => {
      onEvent({ type: 'found', devices: [{ deviceId: '11575:33751', displayName: '/dev/bus/usb/001/009', rawDevice: { vendor_id: '11575', product_id: '33751', device_name: '/dev/bus/usb/001/009' } }] });
      return () => undefined;
    });
    const service = createDeviceScanService({ escpos: escposDriver, tspl: makeMockDriver() });
    const onEvent = jest.fn();
    service.scanForConnectionType(PrinterConnectionType.Usb, onEvent);
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'found',
      devices: [expect.objectContaining({ deviceId: '11575:33751' })],
    }));
  });

  it('discoverDriver() forwards to createDiscoverDriver wired with the registry', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'X' }) });
    const service = createDeviceScanService({ escpos: makeMockDriver(), tspl: tsplDriver });
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      service.discoverDriver({ draftPrinter: { ...basePrinter, drivers: [] } }, (event) => {
        events.push(event.stage);
        if (event.stage === DiscoveryStage.Identified) resolve();
      });
    });
    expect(events).toEqual([DiscoveryStage.Connecting, DiscoveryStage.Identifying, DiscoveryStage.Identified]);
  });
});
