import { PrinterStorage } from '../PrinterStorage';
import { StorageService } from '../../../../services/StorageService';
import type { Printer } from '../../types/printer.types';

const printer: Printer = {
  id: 'p1',
  name: 'Máy in',
  drivers: [{ type: 'escpos', source: 'auto', contentTypes: ['Receipt'], config: { type: 'escpos' } }],
  connectionType: 'lan',
  lan: { ip: '192.168.1.10', port: 9100 },
  identityKey: 'lan:192.168.1.10:9100',
  paperSize: 80,
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
