import printRuleReducer, {
  routingConfigurationLoaded,
  selectRules,
  selectDefaultDestinationId,
} from './printRuleSlice';
import type { PrintRoutingConfiguration } from '../types/printRule.types';

const config: PrintRoutingConfiguration = {
  rules: [{ id: 'r1', conditions: [{ field: 'categoryId', value: 1 }], destinationId: 'd1', priority: 100, enabled: true }],
  defaultDestinationId: 'd0',
};

describe('printRuleSlice', () => {
  it('routingConfigurationLoaded replaces rules and defaultDestinationId', () => {
    const state = printRuleReducer(undefined, routingConfigurationLoaded(config));
    expect(selectRules({ printRule: state })).toEqual(config.rules);
    expect(selectDefaultDestinationId({ printRule: state })).toBe('d0');
  });
});
