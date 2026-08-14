import { evaluatePrintRules } from './evaluatePrintRules';
import type { PrintRoutingConfiguration } from '../types/printRule.types';

describe('evaluatePrintRules', () => {
  it('matches a rule whose single condition matches the subject', () => {
    const routing: PrintRoutingConfiguration = {
      rules: [{ id: 'r1', conditions: [{ field: 'categoryId', value: 1 }], destinationId: 'bar', priority: 100, enabled: true }],
    };
    expect(evaluatePrintRules({ categoryId: 1, serviceType: 'DineIn' }, routing)).toBe('bar');
  });

  it('requires all conditions in a rule to match (AND)', () => {
    const routing: PrintRoutingConfiguration = {
      rules: [{
        id: 'r1',
        conditions: [{ field: 'categoryId', value: 1 }, { field: 'serviceType', value: 'DineIn' }],
        destinationId: 'bar',
        priority: 100,
        enabled: true,
      }],
    };
    expect(evaluatePrintRules({ categoryId: 1, serviceType: 'TakeAway' }, routing)).toBeNull();
  });

  it('evaluates rules in priority order, higher first', () => {
    const routing: PrintRoutingConfiguration = {
      rules: [
        { id: 'low', conditions: [{ field: 'categoryId', value: 1 }], destinationId: 'kitchen', priority: 10, enabled: true },
        { id: 'high', conditions: [{ field: 'categoryId', value: 1 }], destinationId: 'bar', priority: 100, enabled: true },
      ],
    };
    expect(evaluatePrintRules({ categoryId: 1, serviceType: 'DineIn' }, routing)).toBe('bar');
  });

  it('skips disabled rules', () => {
    const routing: PrintRoutingConfiguration = {
      rules: [{ id: 'r1', conditions: [{ field: 'categoryId', value: 1 }], destinationId: 'bar', priority: 100, enabled: false }],
      defaultDestinationId: 'fallback',
    };
    expect(evaluatePrintRules({ categoryId: 1, serviceType: 'DineIn' }, routing)).toBe('fallback');
  });

  it('falls through to defaultDestinationId when nothing matches', () => {
    const routing: PrintRoutingConfiguration = { rules: [], defaultDestinationId: 'fallback' };
    expect(evaluatePrintRules({ categoryId: 99, serviceType: 'DineIn' }, routing)).toBe('fallback');
  });

  it('returns null when nothing matches and there is no default', () => {
    const routing: PrintRoutingConfiguration = { rules: [] };
    expect(evaluatePrintRules({ categoryId: 99, serviceType: 'DineIn' }, routing)).toBeNull();
  });
});
