import { onSessionExpired, emitSessionExpired } from '../sessionEvents';

describe('sessionEvents', () => {
  it('calls registered listeners when session expires', () => {
    const listener = jest.fn();
    const unsubscribe = onSessionExpired(listener);
    emitSessionExpired();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('unsubscribe stops future notifications', () => {
    const listener = jest.fn();
    const unsubscribe = onSessionExpired(listener);
    unsubscribe();
    emitSessionExpired();
    expect(listener).not.toHaveBeenCalled();
  });

  it('supports multiple independent listeners', () => {
    const first = jest.fn();
    const second = jest.fn();
    const unsubscribeFirst = onSessionExpired(first);
    const unsubscribeSecond = onSessionExpired(second);
    emitSessionExpired();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    unsubscribeFirst();
    unsubscribeSecond();
  });

  it('still notifies later listeners when an earlier one throws', () => {
    const throwing = jest.fn(() => {
      throw new Error('lỗi trong listener');
    });
    const second = jest.fn();
    const unsubscribeThrowing = onSessionExpired(throwing);
    const unsubscribeSecond = onSessionExpired(second);
    emitSessionExpired();
    expect(second).toHaveBeenCalledTimes(1);
    unsubscribeThrowing();
    unsubscribeSecond();
  });
});
