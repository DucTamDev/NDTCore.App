import { DriverRegistry } from '../DriverRegistry.web';
import { ConnectionType } from '../../models/printer/ConnectionType';
import { PrintLanguage } from '../../models/printer/PrinterLanguage';
import { makePrinter } from '../../testing/printerFixtures';

describe('DriverRegistry (web)', () => {
  it('có đủ hai ngôn ngữ', () => {
    expect(DriverRegistry[PrintLanguage.EscPos]).toBeDefined();
    expect(DriverRegistry[PrintLanguage.Tspl]).toBeDefined();
  });

  it('quét không báo thiết bị nào và trả hàm huỷ rỗng', () => {
    const onEvent = jest.fn();
    const unsubscribe = DriverRegistry[PrintLanguage.EscPos].scan(ConnectionType.Usb, onEvent);

    expect(onEvent).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  it('không xác nhận ngôn ngữ nào', async () => {
    await expect(DriverRegistry[PrintLanguage.Tspl].identify(makePrinter())).resolves.toBeNull();
  });
});
