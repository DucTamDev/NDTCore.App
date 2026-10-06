import { PrinterDetectionService } from '../PrinterDetectionService';
import type { PrinterDefinition } from '../PrinterDefinition';
import { PRINTER_TABLE } from '../PrinterTable';
import { printerLogger } from '../../logging/PrinterLogger';
import { ConnectionType } from '../../models/printer/ConnectionType';
import { LanguageSelection, PrintLanguage } from '../../models/printer/PrinterLanguage';
import type { DiscoverResult } from '../../models/discovery/DiscoverResult';

jest.mock('../../logging/PrinterLogger', () => ({
  printerLogger: { printerDetected: jest.fn(), printerNotDetected: jest.fn() },
}));

const capabilities = { cutter: false, cashDrawer: false, color: false, image: true };

const tsplUsb: PrinterDefinition = {
  vendor: 'Xprinter',
  model: 'XP-420B',
  identifiers: { vendorId: 11575, productId: 33751 },
  language: { type: PrintLanguage.Tspl, selection: LanguageSelection.Auto },
  capabilities,
};

const escPosByName: PrinterDefinition = {
  vendor: 'Epson',
  model: 'TM-T82',
  identifiers: { manufacturer: 'EPSON', product: 'TM-T82' },
  language: { type: PrintLanguage.EscPos, selection: LanguageSelection.Auto },
  capabilities: { ...capabilities, cutter: true, cashDrawer: true },
};

const usbDevice = (vendorId: number, productId: number, names: { manufacturer?: string; model?: string } = {}) =>
  ({
    device: { deviceId: 'usb:/dev/bus/usb/001/004', name: 'X', hasPermission: true, ...names },
    connection: { type: ConnectionType.Usb, vendorId, productId },
  }) satisfies DiscoverResult;

const bluetoothDevice = (name: string): DiscoverResult => ({
  device: { deviceId: 'bluetooth:AA:BB', name, hasPermission: true },
  connection: { type: ConnectionType.Bluetooth, mac: 'AA:BB' },
});

describe('PrinterDetectionService', () => {
  const service = new PrinterDetectionService([tsplUsb, escPosByName]);

  beforeEach(() => jest.clearAllMocks());

  it('USB khớp vendorId và productId → trả định nghĩa của model', () => {
    expect(service.detect(usbDevice(11575, 33751))).toBe(tsplUsb);
    expect(printerLogger.printerDetected).toHaveBeenCalledWith({
      connectionType: ConnectionType.Usb,
      language: PrintLanguage.Tspl,
    });
  });

  it('chỉ khớp một phần các trường đã khai báo thì không nhận', () => {
    expect(service.detect(usbDevice(11575, 1))).toBeUndefined();
    expect(printerLogger.printerNotDetected).toHaveBeenCalledWith({ connectionType: ConnectionType.Usb });
  });

  it('so tên hãng và sản phẩm không phân biệt hoa thường, bỏ khoảng trắng thừa', () => {
    expect(service.detect(usbDevice(1, 2, { manufacturer: ' Epson ', model: 'tm-t82' }))).toBe(escPosByName);
  });

  it('Bluetooth không có tên sản phẩm riêng thì so bằng tên thiết bị', () => {
    const byName = new PrinterDetectionService([{ ...escPosByName, identifiers: { product: 'TM-T82' } }]);

    expect(byName.detect(bluetoothDevice('TM-T82'))?.model).toBe('TM-T82');
  });

  it('định nghĩa không khai báo trường nhận diện nào thì không khớp thiết bị nào', () => {
    const empty = new PrinterDetectionService([{ ...tsplUsb, identifiers: {} }]);

    expect(empty.detect(usbDevice(11575, 33751))).toBeUndefined();
  });

  it('nhiều định nghĩa khớp thì lấy cái đầu tiên trong bảng', () => {
    const both = new PrinterDetectionService([tsplUsb, { ...escPosByName, identifiers: { vendorId: 11575 } }]);

    expect(both.detect(usbDevice(11575, 33751))).toBe(tsplUsb);
  });

  it('mặc định tra PRINTER_TABLE', () => {
    expect(new PrinterDetectionService().detect(usbDevice(0, 0))).toBe(
      PRINTER_TABLE.find((definition) => definition.identifiers.vendorId === 0),
    );
  });
});
