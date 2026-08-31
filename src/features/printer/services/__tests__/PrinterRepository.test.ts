import { createPrinterRepository } from '../PrinterRepository';
import { PrinterStorage } from '../../storage/PrinterStorage';
import { type Printer } from '../../models/printer/Printer';
import { basePrinter } from '../../testing/printerServiceTestKit';

jest.mock('../../../../services/LoggerService', () => ({ LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() } }));

describe('PrinterRepository', () => {
  beforeEach(() => {
    PrinterStorage.savePrinters([]);
  });

  it('addPrinter() persists and getPrinters() returns it back', () => {
    const repository = createPrinterRepository();
    repository.addPrinter(basePrinter);
    expect(repository.getPrinters()).toEqual([basePrinter]);
  });

  it('addPrinter() throws when identityKey collides with a different existing printer', () => {
    const repository = createPrinterRepository();
    repository.addPrinter(basePrinter);
    const duplicate: Printer = { ...basePrinter, id: 'p2', name: 'Máy in khác' };
    expect(() => repository.addPrinter(duplicate)).toThrow();
    expect(repository.getPrinters()).toHaveLength(1);
  });

  it('updatePrinter() does not throw against its own identityKey', () => {
    const repository = createPrinterRepository();
    repository.addPrinter(basePrinter);
    const updated: Printer = { ...basePrinter, name: 'Tên mới' };
    expect(() => repository.updatePrinter(updated)).not.toThrow();
    expect(repository.getPrinters()[0].name).toBe('Tên mới');
  });

  it('addPrinter() recomputes identityKey from connection fields, overriding a wrong caller-supplied value', () => {
    const repository = createPrinterRepository();
    const staleIdentity: Printer = { ...basePrinter, identityKey: 'lan:9.9.9.9:1' };
    repository.addPrinter(staleIdentity);
    expect(repository.getPrinters()[0].identityKey).toBe('lan:192.168.1.10:9100');
  });

  it('removePrinter() removes it from the list', () => {
    const repository = createPrinterRepository();
    repository.addPrinter(basePrinter);
    repository.removePrinter(basePrinter.id);
    expect(repository.getPrinters()).toEqual([]);
  });

  it('setEnabled() updates enabled for that printer only', () => {
    const repository = createPrinterRepository();
    const second: Printer = { ...basePrinter, id: 'p2', identityKey: 'lan:1.1.1.2:9100', connection: { ...basePrinter.connection, lan: { ip: '1.1.1.2', port: 9100 } } };
    repository.addPrinter(basePrinter);
    repository.addPrinter(second);
    repository.setEnabled('p1', false);
    expect(repository.getPrinters().find((p) => p.id === 'p1')?.enabled).toBe(false);
    expect(repository.getPrinters().find((p) => p.id === 'p2')?.enabled).toBe(true);
  });
});
