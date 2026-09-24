import { and, eq, exists, gt, gte, lt, lte, neq, not, notEmpty, or } from '..';

describe('helper điều kiện', () => {
  it('so sánh tạo đúng op, tên biến và hằng', () => {
    expect(eq('orderCode', 'X')).toEqual({ op: 'eq', var: 'orderCode', value: 'X' });
    expect(neq('orderCode', 'X')).toEqual({ op: 'neq', var: 'orderCode', value: 'X' });
    expect(gt('discount', 0)).toEqual({ op: 'gt', var: 'discount', value: 0 });
    expect(gte('discount', 0)).toEqual({ op: 'gte', var: 'discount', value: 0 });
    expect(lt('discount', 0)).toEqual({ op: 'lt', var: 'discount', value: 0 });
    expect(lte('discount', 0)).toEqual({ op: 'lte', var: 'discount', value: 0 });
  });

  it('lồng and/or/not thành data thuần', () => {
    const condition = and(exists('tableName'), or(gt('discount', 0), not(eq('orderCode', 'X'))), notEmpty('itemNote'));

    expect(condition).toEqual({
      op: 'and',
      conditions: [
        { op: 'exists', var: 'tableName' },
        {
          op: 'or',
          conditions: [
            { op: 'gt', var: 'discount', value: 0 },
            { op: 'not', condition: { op: 'eq', var: 'orderCode', value: 'X' } },
          ],
        },
        { op: 'notEmpty', var: 'itemNote' },
      ],
    });
  });
});
