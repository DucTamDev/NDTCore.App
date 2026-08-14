import { createPrintRuleService } from './PrintRuleService';
import { StorageService } from '../../../services/StorageService';
import type { PrintRoutingConfiguration } from '../types/printRule.types';

const config: PrintRoutingConfiguration = {
  rules: [
    { id: 'r1', conditions: [{ field: 'categoryId', value: 1 }], destinationId: 'd1', priority: 100, enabled: true },
  ],
  defaultDestinationId: 'd0',
};

describe('PrintRuleService', () => {
  beforeEach(() => StorageService.removeItem('printRule.routingConfiguration'));

  it('returns an empty configuration when nothing is stored', () => {
    const service = createPrintRuleService();
    expect(service.getRoutingConfiguration()).toEqual({ rules: [] });
  });

  it('saveRoutingConfiguration() persists and getRoutingConfiguration() returns it back', () => {
    const service = createPrintRuleService();
    service.saveRoutingConfiguration(config);
    expect(service.getRoutingConfiguration()).toEqual(config);
  });
});
