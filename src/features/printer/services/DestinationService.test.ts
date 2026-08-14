import { createDestinationService } from './DestinationService';
import { StorageService } from '../../../services/StorageService';
import type { PrintDestination } from '../types/destination.types';

const dest: PrintDestination = { id: 'd1', name: 'Bar', printerIds: ['p1', 'p2'], fanoutMode: 'failover', enabled: true };

describe('DestinationService', () => {
  beforeEach(() => StorageService.removeItem('printDestination.list'));

  it('addDestination() persists and getDestinations() returns it back', () => {
    const service = createDestinationService();
    service.addDestination(dest);
    expect(service.getDestinations()).toEqual([dest]);
  });

  it('updateDestination() replaces by id', () => {
    const service = createDestinationService();
    service.addDestination(dest);
    const renamed = { ...dest, name: 'Bar 2' };
    service.updateDestination(renamed);
    expect(service.getDestinations()).toEqual([renamed]);
  });

  it('removeDestination() removes by id', () => {
    const service = createDestinationService();
    service.addDestination(dest);
    service.removeDestination(dest.id);
    expect(service.getDestinations()).toEqual([]);
  });
});
