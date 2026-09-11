import { DriverRegistry } from '../DriverRegistry.web';
import { PrinterErrorCode } from '../../errors/PrinterError';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import { PrinterDriverType } from '../../models/printer/PrinterDriver';
import { PrinterStatus } from '../../models/printer/PrinterStatus';

describe('DriverRegistry (web)', () => {
  it('registers both driver types', () => {
    expect(DriverRegistry[PrinterDriverType.EscPos]).toBeDefined();
    expect(DriverRegistry[PrinterDriverType.Tspl]).toBeDefined();
  });

  it('scan returns a no-op unsubscribe and never reports a device', () => {
    const onEvent = jest.fn();
    const unsubscribe = DriverRegistry[PrinterDriverType.EscPos].scan(PrinterConnectionType.Usb, onEvent);
    expect(onEvent).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  it('connect rejects with PRINTER_UNSUPPORTED_CONNECTION', async () => {
    // @ts-expect-error -- web stub ignores its arguments entirely
    await expect(DriverRegistry[PrinterDriverType.Tspl].connect()).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION });
  });

  it('testPrint rejects with PRINTER_UNSUPPORTED_CONNECTION', async () => {
    // @ts-expect-error -- web stub ignores its arguments entirely
    await expect(DriverRegistry[PrinterDriverType.EscPos].testPrint()).rejects.toMatchObject({ code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION });
  });

  it('disconnect resolves without throwing', async () => {
    await expect(DriverRegistry[PrinterDriverType.EscPos].disconnect('p1')).resolves.toBeUndefined();
  });

  it('getStatus always returns "error"', () => {
    expect(DriverRegistry[PrinterDriverType.EscPos].getStatus('p1')).toBe(PrinterStatus.Error);
  });

  it('onStatusChange returns a no-op unsubscribe', () => {
    const callback = jest.fn();
    const unsubscribe = DriverRegistry[PrinterDriverType.Tspl].onStatusChange('p1', callback);
    expect(callback).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  it('identify resolves null', async () => {
    await expect(DriverRegistry[PrinterDriverType.Tspl].identify('p1')).resolves.toBeNull();
  });
});
