import { PrinterConnectionLock } from '../PrinterConnectionLock';

describe('PrinterConnectionLock', () => {
  it('runs two tasks under the same key sequentially, never overlapping', async () => {
    const lock = new PrinterConnectionLock();
    let inFlight = 0;
    let maxInFlight = 0;
    const task = () =>
      lock.runExclusive('k', async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
      });
    await Promise.all([task(), task()]);
    expect(maxInFlight).toBe(1);
  });

  it('runs tasks under different keys concurrently', async () => {
    const lock = new PrinterConnectionLock();
    let inFlight = 0;
    let maxInFlight = 0;
    const task = (key: string) =>
      lock.runExclusive(key, async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
      });
    await Promise.all([task('a'), task('b')]);
    expect(maxInFlight).toBe(2);
  });

  it('runs queued tasks in the order they were submitted', async () => {
    const order: string[] = [];
    const lock = new PrinterConnectionLock();
    await Promise.all([
      lock.runExclusive('k', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push('a');
      }),
      lock.runExclusive('k', async () => {
        order.push('b');
      }),
    ]);
    expect(order).toEqual(['a', 'b']);
  });

  it('resolves with the task result and does not swallow the task error', async () => {
    const lock = new PrinterConnectionLock();
    await expect(lock.runExclusive('k', async () => undefined)).resolves.toBeUndefined();
    await expect(
      lock.runExclusive('k', async () => {
        throw new Error('tác vụ lỗi');
      }),
    ).rejects.toThrow('tác vụ lỗi');
  });

  it('a rejecting task does not block the next queued task for the same key', async () => {
    const lock = new PrinterConnectionLock();
    const order: string[] = [];
    const first = lock
      .runExclusive('k', async () => {
        throw new Error('tác vụ lỗi');
      })
      .catch(() => order.push('first-rejected'));
    const second = lock.runExclusive('k', async () => {
      order.push('second-ran');
    });
    await Promise.all([first, second]);
    expect(order).toEqual(['first-rejected', 'second-ran']);
  });
});
