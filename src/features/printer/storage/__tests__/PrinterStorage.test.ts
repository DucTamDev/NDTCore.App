import { PrinterStorage } from '../PrinterStorage';
import { StorageService } from '../../../../services/StorageService';
import { ConnectionType, DriverSource, PrinterDriverType, type Printer } from '../../types/printer.types';
import { PrintType } from '../../types/printConfiguration.types';

const printer: Printer = {
  id: 'p1',
  name: 'Máy in',
  drivers: [{ type: PrinterDriverType.escpos, source: DriverSource.auto, contentTypes: [PrintType.Receipt], config: { type: PrinterDriverType.escpos, media: { type: 'continuous', paperSize: 80 } } }],
  connectionType: ConnectionType.lan,
  lan: { ip: '192.168.1.10', port: 9100 },
  identityKey: 'lan:192.168.1.10:9100',
  capabilities: { cutter: false },
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('PrinterStorage', () => {
  beforeEach(() => {
    StorageService.removeItem('printer.list');
    StorageService.removeItem('printer.storageVersion');
    StorageService.removeItem('printer.defaultId');
  });

  it('getPrinters() returns an empty array when nothing was saved yet', () => {
    expect(PrinterStorage.getPrinters()).toEqual([]);
  });

  it('savePrinters() then getPrinters() round-trips the list', () => {
    PrinterStorage.savePrinters([printer]);
    expect(PrinterStorage.getPrinters()).toEqual([printer]);
  });

  it('stamps the current storage version (4) after a save + read', () => {
    PrinterStorage.savePrinters([printer]);
    PrinterStorage.getPrinters();
    expect(StorageService.getItem('printer.storageVersion')).toBe(4);
  });

  it('discards a legacy (pre-refactor) printer.list written under a missing/older storage version', () => {
    StorageService.setItem('printer.list', [{ id: 'legacy', printerName: 'Old shape', protocol: 'escpos' }]);
    expect(PrinterStorage.getPrinters()).toEqual([]);
  });

  it('also clears the legacy printer.defaultId key on reset', () => {
    StorageService.setItem('printer.defaultId', 'old-id');
    PrinterStorage.getPrinters();
    expect(StorageService.getItem('printer.defaultId')).toBeNull();
  });

  it('does not wipe printer.list again on a second call once the version has been stamped', () => {
    PrinterStorage.savePrinters([printer]);
    expect(PrinterStorage.getPrinters()).toEqual([printer]);
    expect(PrinterStorage.getPrinters()).toEqual([printer]);
  });
});
