import { createMockThermalPrinterModule } from '../MockPrinterAdapter';

describe('MockPrinterAdapter', () => {
  it('createMockThermalPrinterModule trả stub cho toàn bộ method của ThermalPrinterModule', async () => {
    const mock = createMockThermalPrinterModule();
    await expect(mock.discoverPrinters('usb' as never)).resolves.toEqual([]);
    await expect(mock.connect({} as never)).resolves.toBeUndefined();
    await expect(mock.disconnect('p1')).resolves.toBeUndefined();
    await expect(mock.writeByBase64('p1', 'QUI=')).resolves.toBe('ok');
    await expect(mock.getConnectionState('p1')).resolves.toBe('CONNECTED');
    await expect(mock.getQueueStatus('p1')).resolves.toEqual({ pendingCount: 0, runningJobId: null });
  });
});
