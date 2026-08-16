import { getTodayRange } from '../useOrderHistory';

describe('getTodayRange', () => {
  it('returns an ISO range from local midnight of the given date to the given date itself', () => {
    const now = new Date(2026, 7, 16, 14, 30, 0, 0); // 2026-08-16 14:30 local
    const { fromDate, toDate } = getTodayRange(now);

    expect(new Date(fromDate).getTime()).toBe(new Date(2026, 7, 16, 0, 0, 0, 0).getTime());
    expect(toDate).toBe(now.toISOString());
  });
});
