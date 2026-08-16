import { finishReprint, getTodayRange, startReprint } from '../useOrderHistory';

describe('getTodayRange', () => {
  it('returns an ISO range from local midnight of the given date to the given date itself', () => {
    const now = new Date(2026, 7, 16, 14, 30, 0, 0); // 2026-08-16 14:30 local
    const { fromDate, toDate } = getTodayRange(now);

    expect(new Date(fromDate).getTime()).toBe(new Date(2026, 7, 16, 0, 0, 0, 0).getTime());
    expect(toDate).toBe(now.toISOString());
  });
});

describe('startReprint / finishReprint', () => {
  it('tracks overlapping reprints on different orders independently', () => {
    // Bấm "In lại" ở đơn 1, rồi bấm tiếp đơn 2 trước khi đơn 1 xong — cả 2
    // phải cùng ở trạng thái loading, không được ghi đè lẫn nhau.
    let ids = startReprint(new Set<number>(), 1);
    ids = startReprint(ids, 2);
    expect(ids.has(1)).toBe(true);
    expect(ids.has(2)).toBe(true);

    // Đơn 1 xong trước — chỉ đơn 1 được xoá khỏi trạng thái loading, đơn 2
    // vẫn phải giữ nguyên loading vì request của nó chưa xong.
    ids = finishReprint(ids, 1);
    expect(ids.has(1)).toBe(false);
    expect(ids.has(2)).toBe(true);
  });

  it('does not mutate the set passed in', () => {
    const original = new Set<number>([1]);
    startReprint(original, 2);
    finishReprint(original, 1);
    expect(original).toEqual(new Set([1]));
  });
});
