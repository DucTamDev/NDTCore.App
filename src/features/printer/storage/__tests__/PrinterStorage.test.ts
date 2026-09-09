import { PrinterStorage } from '../PrinterStorage';
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
    expect(PrinterStorage.getPrinters()).toEqual([]);
  });

  it('savePrinters() then getPrinters() round-trips the list', () => {
    PrinterStorage.savePrinters([printer]);
    expect(PrinterStorage.getPrinters()).toEqual([printer]);
  });

  it('stamps the current storage version (6) after a save + read', () => {
    PrinterStorage.savePrinters([printer]);
    PrinterStorage.getPrinters();
    expect(StorageService.getItem('printer.storageVersion')).toBe(6);
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
