import { NativeModules } from 'react-native';

const loadReal = () =>
  jest.requireActual('../PrinterNativeModule') as typeof import('../PrinterNativeModule');

const originalThermalPrinterModule = NativeModules.ThermalPrinterModule;

beforeEach(() => {
  NativeModules.ThermalPrinterModule = {
    discoverPrinters: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue(undefined),
    reconnect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    writeByBase64: jest.fn().mockResolvedValue('ok'),
    getPrinterInfo: jest.fn().mockResolvedValue(undefined),
    getPrinterCapabilities: jest.fn().mockResolvedValue(undefined),
    getConnectionState: jest.fn().mockResolvedValue('CONNECTED'),
    cancelPrintJob: jest.fn().mockResolvedValue(false),
    getQueueStatus: jest.fn().mockResolvedValue({ pendingCount: 0, runningJobId: null }),
  };
});

afterEach(() => {
  NativeModules.ThermalPrinterModule = originalThermalPrinterModule;
  jest.resetModules();
});

describe('ThermalPrinterModule', () => {
  it('discoverPrinters gọi native với đúng type', async () => {
    const { ThermalPrinterModule } = loadReal();
    await ThermalPrinterModule.discoverPrinters('usb' as never);
    expect(NativeModules.ThermalPrinterModule.discoverPrinters).toHaveBeenCalledWith('usb');
  });

  it('connect gọi native với đúng request (kèm printerId)', async () => {
    const { ThermalPrinterModule } = loadReal();
    await ThermalPrinterModule.connect({ printerId: 'p1', type: 'usb', vendorId: 1234, productId: 5678 });
    expect(NativeModules.ThermalPrinterModule.connect).toHaveBeenCalledWith({ printerId: 'p1', type: 'usb', vendorId: 1234, productId: 5678 });
  });

  it('disconnect gọi native với đúng printerId', async () => {
    const { ThermalPrinterModule } = loadReal();
    await ThermalPrinterModule.disconnect('p1');
    expect(NativeModules.ThermalPrinterModule.disconnect).toHaveBeenCalledWith('p1');
  });

  it('writeByBase64 gọi native với đúng printerId + base64Data', async () => {
    const { ThermalPrinterModule } = loadReal();
    await expect(ThermalPrinterModule.writeByBase64('p1', 'QUI=')).resolves.toBe('ok');
    expect(NativeModules.ThermalPrinterModule.writeByBase64).toHaveBeenCalledWith('p1', 'QUI=');
  });
});
