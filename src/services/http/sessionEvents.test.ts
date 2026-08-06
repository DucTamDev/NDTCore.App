import { onSessionExpired, emitSessionExpired } from './sessionEvents';

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
});
