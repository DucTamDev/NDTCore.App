import { DriverRegistry } from '../DriverRegistry.web';
import { AppErrorCode } from '../../types/AppError';
import { ConnectionType, PrinterStatus } from '../../types/printer.types';

describe('DriverRegistry (web)', () => {
  it('registers both driver types', () => {
    expect(DriverRegistry.escpos).toBeDefined();
    expect(DriverRegistry.tspl).toBeDefined();
  });

  it('scan returns a no-op unsubscribe and never reports a device', () => {
    const onEvent = jest.fn();
    const unsubscribe = DriverRegistry.escpos.scan(ConnectionType.usb, onEvent);
    expect(onEvent).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  it('connect rejects with UNSUPPORTED_CONNECTION', async () => {
    // @ts-expect-error -- web stub ignores its arguments entirely
    await expect(DriverRegistry.tspl.connect()).rejects.toMatchObject({ code: AppErrorCode.UNSUPPORTED_CONNECTION });
  });

  it('testPrint rejects with UNSUPPORTED_CONNECTION', async () => {
    // @ts-expect-error -- web stub ignores its arguments entirely
    await expect(DriverRegistry.escpos.testPrint()).rejects.toMatchObject({ code: AppErrorCode.UNSUPPORTED_CONNECTION });
  });

  it('disconnect resolves without throwing', async () => {
    await expect(DriverRegistry.escpos.disconnect('p1')).resolves.toBeUndefined();
  });

  it('getStatus always returns "error"', () => {
    expect(DriverRegistry.escpos.getStatus('p1')).toBe(PrinterStatus.error);
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

  it('encode returns an empty Uint8Array', () => {
    // @ts-expect-error -- web stub ignores its arguments entirely
    expect(DriverRegistry.escpos.encode()).toEqual(new Uint8Array());
  });
});
