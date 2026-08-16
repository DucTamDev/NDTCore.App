import { DriverRegistry } from '../DriverRegistry.web';
import type { PrinterConfig } from '../../types/printer.types';

const tsplConfig: PrinterConfig = {
  id: 'p1',
  printerName: 'Test TSPL',
  protocol: 'tspl',
  protocolSource: 'manual',
  connectionType: 'lan',
  paperSize: '58mm',
  autoReconnect: false,
  isDefault: false,
};

const escposConfig: PrinterConfig = {
  id: 'p2',
  printerName: 'Test ESC/POS',
  protocol: 'escpos',
  protocolSource: 'manual',
  connectionType: 'usb',
  paperSize: '80mm',
  autoReconnect: false,
  isDefault: false,
};

describe('DriverRegistry (web)', () => {
  it('registers both protocols', () => {
    expect(DriverRegistry.escpos).toBeDefined();
    expect(DriverRegistry.tspl).toBeDefined();
  });

  it('scan returns a no-op unsubscribe and never reports a device', () => {
    const onEvent = jest.fn();
    const unsubscribe = DriverRegistry.escpos.scan('usb', onEvent);
    expect(onEvent).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  it('connect rejects with UNSUPPORTED_CONNECTION', async () => {
    await expect(DriverRegistry.tspl.connect(tsplConfig)).rejects.toMatchObject({
      code: 'UNSUPPORTED_CONNECTION',
    });
  });

  it('testPrint rejects with UNSUPPORTED_CONNECTION', async () => {
    await expect(DriverRegistry.escpos.testPrint(escposConfig)).rejects.toMatchObject({
      code: 'UNSUPPORTED_CONNECTION',
    });
  });

  it('disconnect resolves without throwing', async () => {
    await expect(DriverRegistry.escpos.disconnect('p1')).resolves.toBeUndefined();
  });

  it('getStatus always returns "error"', () => {
    expect(DriverRegistry.escpos.getStatus('p1')).toBe('error');
  });

  it('onStatusChange returns a no-op unsubscribe', () => {
    const callback = jest.fn();
    const unsubscribe = DriverRegistry.tspl.onStatusChange('p1', callback);
    expect(callback).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  it('identify resolves null', async () => {
    await expect(DriverRegistry.tspl.identify('p1')).resolves.toBeNull();
  });
});
