import printerReducer, {
  printersLoaded,
  printerUpserted,
  printerRemoved,
  printerStatusChanged,
  printerEnabledChanged,
  selectPrinters,
  selectPrinterStatus,
} from '../printerSlice';
import type { Printer, PrinterDriver } from '../../types/printer.types';

const drivers: PrinterDriver[] = [
  {
    type: 'escpos',
    source: 'auto',
    contentTypes: ['Receipt'],
    config: { type: 'escpos' },
  },
];

const printer: Printer = {
  id: 'p1',
  name: 'Máy in hóa đơn quầy 1',
  drivers,
  connectionType: 'lan',
  lan: { ip: '192.168.1.10', port: 9100 },
  identityKey: 'lan:192.168.1.10:9100',
  paperSize: 80,
  autoReconnect: false,
  enabled: true,
  createdAt: '2026-08-26T00:00:00.000Z',
  updatedAt: '2026-08-26T00:00:00.000Z',
};

describe('printerSlice', () => {
  it('printersLoaded replaces the printer list', () => {
    const state = printerReducer(undefined, printersLoaded([printer]));
    expect(selectPrinters({ printer: state })).toEqual([printer]);
  });

  it('printerUpserted adds a new printer, updates an existing one', () => {
    let state = printerReducer(undefined, printerUpserted(printer));
    expect(selectPrinters({ printer: state })).toHaveLength(1);
    const renamed = { ...printer, name: 'Đổi tên' };
    state = printerReducer(state, printerUpserted(renamed));
    expect(selectPrinters({ printer: state })).toEqual([renamed]);
  });

  it('printerRemoved removes by id', () => {
    let state = printerReducer(undefined, printerUpserted(printer));
    state = printerReducer(state, printerRemoved(printer.id));
    expect(selectPrinters({ printer: state })).toEqual([]);
  });

  it('printerStatusChanged updates statusById for that printer only', () => {
    const state = printerReducer(undefined, printerStatusChanged({ printerId: 'p1', status: 'connected' }));
    expect(selectPrinterStatus({ printer: state }, 'p1')).toBe('connected');
    expect(selectPrinterStatus({ printer: state }, 'p2')).toBe('idle');
  });

  it('printerEnabledChanged updates enabled for that printer only', () => {
    const other = { ...printer, id: 'p2', enabled: true };
    let state = printerReducer(undefined, printersLoaded([printer, other]));
    state = printerReducer(state, printerEnabledChanged({ printerId: 'p1', enabled: false }));
    expect(selectPrinters({ printer: state }).find((p) => p.id === 'p1')?.enabled).toBe(false);
    expect(selectPrinters({ printer: state }).find((p) => p.id === 'p2')?.enabled).toBe(true);
  });
});
