import { printerStorage } from '../PrinterStorage';
import { StorageService } from '../../../../services/StorageService';
import { makePrinter } from '../../testing/printerFixtures';

const printer = makePrinter({ name: 'Máy in' });

describe('PrinterStorage', () => {
  beforeEach(() => {
    StorageService.removeItem('printer.list');
    StorageService.removeItem('printer.storageVersion');
    StorageService.removeItem('printer.defaultId');
  });

  it('getPrinters() returns an empty array when nothing was saved yet', () => {
    expect(printerStorage.getPrinters()).toEqual([]);
  });

  it('savePrinters() then getPrinters() round-trips the list', () => {
    printerStorage.savePrinters([printer]);
    expect(printerStorage.getPrinters()).toEqual([printer]);
  });

  it('stamps the current storage version (9) after a save + read', () => {
    printerStorage.savePrinters([printer]);
    printerStorage.getPrinters();
    expect(StorageService.getItem('printer.storageVersion')).toBe(9);
  });

  it('discards printers saved under storage version 7 (driver-based model)', () => {
    StorageService.setItem('printer.storageVersion', 7);
    StorageService.setItem('printer.list', [{ id: 'old', identityKey: 'lan:1.2.3.4:9100', driver: { type: 'EscPos' } }]);
    expect(printerStorage.getPrinters()).toEqual([]);
  });

  it('discards a legacy (pre-refactor) printer.list written under a missing/older storage version', () => {
    StorageService.setItem('printer.list', [{ id: 'legacy', printerName: 'Old shape', protocol: 'escpos' }]);
    expect(printerStorage.getPrinters()).toEqual([]);
  });

  it('also clears the legacy printer.defaultId key on reset', () => {
    StorageService.setItem('printer.defaultId', 'old-id');
    printerStorage.getPrinters();
    expect(StorageService.getItem('printer.defaultId')).toBeNull();
  });

  it('does not wipe printer.list again on a second call once the version has been stamped', () => {
    printerStorage.savePrinters([printer]);
    expect(printerStorage.getPrinters()).toEqual([printer]);
    expect(printerStorage.getPrinters()).toEqual([printer]);
  });
});
