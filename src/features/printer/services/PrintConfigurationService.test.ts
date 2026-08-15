import { createPrintConfigurationService } from './PrintConfigurationService';
import { StorageService } from '../../../services/StorageService';
import type { PrintConfiguration } from '../types/printConfiguration.types';

const receiptConfig: PrintConfiguration = { id: 'c1', printType: 'Receipt', printerId: 'p1', isDefault: true, isEnabled: true };
const labelConfig: PrintConfiguration = { id: 'c2', printType: 'Label', printerId: 'p2', isDefault: true, isEnabled: true };

describe('PrintConfigurationService', () => {
  beforeEach(() => StorageService.removeItem('printConfiguration.list'));

  it('returns an empty list when nothing is stored', () => {
    const service = createPrintConfigurationService();
    expect(service.getAll()).toEqual([]);
  });

  it('upsert() adds a new configuration, and updates an existing one by id', () => {
    const service = createPrintConfigurationService();
    service.upsert(receiptConfig);
    expect(service.getAll()).toEqual([receiptConfig]);
    const updated = { ...receiptConfig, isDefault: false };
    service.upsert(updated);
    expect(service.getAll()).toEqual([updated]);
  });

  it('remove() removes by id', () => {
    const service = createPrintConfigurationService();
    service.upsert(receiptConfig);
    service.remove(receiptConfig.id);
    expect(service.getAll()).toEqual([]);
  });

  it('getDefaultPrinterIdsForType() filters by printType, isDefault, and isEnabled', () => {
    const service = createPrintConfigurationService();
    service.upsert(receiptConfig);
    service.upsert(labelConfig);
    service.upsert({ id: 'c3', printType: 'Receipt', printerId: 'p3', isDefault: false, isEnabled: true });
    service.upsert({ id: 'c4', printType: 'Receipt', printerId: 'p4', isDefault: true, isEnabled: false });
    expect(service.getDefaultPrinterIdsForType('Receipt')).toEqual(['p1']);
    expect(service.getDefaultPrinterIdsForType('Label')).toEqual(['p2']);
  });
});
