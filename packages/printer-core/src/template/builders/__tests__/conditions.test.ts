import { exists, equals } from '../conditions';

describe('visibility condition factories', () => {
  it('exists(binding) returns an exists condition', () => {
    expect(exists('discount')).toEqual({ type: 'exists', binding: 'discount' });
  });
  it('equals(binding, value) returns an equals condition', () => {
    expect(equals('status', 'paid')).toEqual({ type: 'equals', binding: 'status', value: 'paid' });
  });
});
