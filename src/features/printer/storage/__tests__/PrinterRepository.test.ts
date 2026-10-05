import { PrinterRepository } from '../PrinterRepository';
import { printerStorage } from '../PrinterStorage';
import { type Printer } from '../../models/printer/Printer';
import { PrintKind } from '../../models/printer/PrintKind';
import { basePrinter, tsplLanguage } from '../../testing/printerServiceTestKit';

jest.mock('../../../../services/LoggerService', () => ({ LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() } }));

describe('PrinterRepository', () => {
  beforeEach(() => {
    printerStorage.savePrinters([]);
  });

  it('addPrinter() persists and getPrinters() returns it back', () => {
    const repository = new PrinterRepository();
    repository.addPrinter(basePrinter);
    expect(repository.getPrinters()).toEqual([basePrinter]);
  });

  it('addPrinter() throws when (deviceId, type) collides with a different existing printer', () => {
    const repository = new PrinterRepository();
    repository.addPrinter(basePrinter);
    const duplicate: Printer = { ...basePrinter, id: 'p2', name: 'Máy in khác' };
    expect(() => repository.addPrinter(duplicate)).toThrow();
    expect(repository.getPrinters()).toHaveLength(1);
  });

  it('addPrinter() allows the same deviceId when kind differs (one device printing two kinds)', () => {
    const repository = new PrinterRepository();
    repository.addPrinter(basePrinter);
    // Tem đòi ngôn ngữ in được PrintKind.Label (EscPos chỉ phục vụ Receipt) — dùng Tspl để record thứ 2 hợp lệ.
    const labelPrinter: Printer = { ...basePrinter, id: 'p2', name: 'Máy in tem', kind: PrintKind.Label, language: tsplLanguage };
    expect(() => repository.addPrinter(labelPrinter)).not.toThrow();
    expect(repository.getPrinters()).toHaveLength(2);
  });

  it('updatePrinter() does not throw against its own deviceId', () => {
    const repository = new PrinterRepository();
    repository.addPrinter(basePrinter);
    const updated: Printer = { ...basePrinter, name: 'Tên mới' };
    expect(() => repository.updatePrinter(updated)).not.toThrow();
    expect(repository.getPrinters()[0].name).toBe('Tên mới');
  });

  it('addPrinter() recomputes deviceId from connection fields, overriding a wrong caller-supplied value', () => {
    const repository = new PrinterRepository();
    const staleIdentity: Printer = { ...basePrinter, deviceId: 'lan:9.9.9.9:1' };
    repository.addPrinter(staleIdentity);
    expect(repository.getPrinters()[0].deviceId).toBe('lan:192.168.1.10:9100');
  });

  it('removePrinter() removes it from the list', () => {
    const repository = new PrinterRepository();
    repository.addPrinter(basePrinter);
    repository.removePrinter(basePrinter.id);
    expect(repository.getPrinters()).toEqual([]);
  });

  it('setEnabled() updates enabled for that printer only', () => {
    const repository = new PrinterRepository();
    const second: Printer = { ...basePrinter, id: 'p2', deviceId: 'lan:1.1.1.2:9100', connection: { type: 'Lan', host: '1.1.1.2', port: 9100 } };
    repository.addPrinter(basePrinter);
    repository.addPrinter(second);
    repository.setEnabled('p1', false);
    expect(repository.getPrinters().find((p) => p.id === 'p1')?.enabled).toBe(false);
    expect(repository.getPrinters().find((p) => p.id === 'p2')?.enabled).toBe(true);
  });
});
