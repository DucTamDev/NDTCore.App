import { connectionResourceKey, createResourceLock } from './PrinterConnectionLock';

describe('connectionResourceKey', () => {
  it('joins protocol and connectionType with a colon', () => {
    expect(connectionResourceKey('escpos', 'lan')).toBe('escpos:lan');
    expect(connectionResourceKey('tspl', 'bluetooth')).toBe('tspl:bluetooth');
  });
});

describe('createResourceLock', () => {
  it('never runs two tasks for the same key concurrently', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const lock = createResourceLock();
    const task = async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
    };
    await Promise.all([
      lock.runExclusive('escpos:lan', task),
      lock.runExclusive('escpos:lan', task),
      lock.runExclusive('escpos:lan', task),
    ]);
    expect(maxInFlight).toBe(1);
  });

  it('runs tasks for different keys in parallel', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const lock = createResourceLock();
    const task = async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
    };
    await Promise.all([lock.runExclusive('escpos:lan', task), lock.runExclusive('tspl:bluetooth', task)]);
    expect(maxInFlight).toBe(2);
  });

  it('runs queued tasks in the order they were submitted', async () => {
    const order: string[] = [];
    const lock = createResourceLock();
    await Promise.all([
      lock.runExclusive('escpos:lan', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push('a');
      }),
      lock.runExclusive('escpos:lan', async () => {
        order.push('b');
      }),
    ]);
    expect(order).toEqual(['a', 'b']);
  });

  it('resolves with the task result and does not swallow the task error', async () => {
    const lock = createResourceLock();
    await expect(lock.runExclusive('escpos:lan', async () => undefined)).resolves.toBeUndefined();
    await expect(
      lock.runExclusive('escpos:lan', async () => {
        throw new Error('driver lỗi');
      }),
    ).rejects.toThrow('driver lỗi');
  });

  it('a rejecting task does not block the next queued task for the same key', async () => {
    const lock = createResourceLock();
    const order: string[] = [];
    const first = lock
      .runExclusive('escpos:lan', async () => {
        throw new Error('driver lỗi');
      })
      .catch(() => order.push('first-rejected'));
    const second = lock.runExclusive('escpos:lan', async () => {
      order.push('second-ran');
    });
    await Promise.all([first, second]);
    expect(order).toEqual(['first-rejected', 'second-ran']);
  });
});
