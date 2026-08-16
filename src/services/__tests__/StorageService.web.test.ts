/**
 * @jest-environment jsdom
 */
import { StorageService } from '../StorageService.web';
import { LoggerService } from '../LoggerService';

jest.mock('../LoggerService', () => ({ LoggerService: { warning: jest.fn() } }));

describe('StorageService (web)', () => {
  const key = 'test.key';

  afterEach(() => {
    StorageService.removeItem(key);
  });

  it('returns null when key is missing', () => {
    expect(StorageService.getItem(key)).toBeNull();
  });

  it('round-trips an object through setItem/getItem', () => {
    const value = { a: 1, b: 'two' };
    StorageService.setItem(key, value);
    expect(StorageService.getItem(key)).toEqual(value);
  });

  it('removeItem clears the key', () => {
    StorageService.setItem(key, { a: 1 });
    StorageService.removeItem(key);
    expect(StorageService.getItem(key)).toBeNull();
  });

  it('persists through window.localStorage directly', () => {
    StorageService.setItem(key, 'raw-value');
    expect(window.localStorage.getItem(key)).toBe(JSON.stringify('raw-value'));
  });

  it('does not throw when window.localStorage.setItem throws (private mode / quota exceeded)', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => StorageService.setItem(key, 'raw-value')).not.toThrow();
    expect(LoggerService.warning).toHaveBeenCalled();

    spy.mockRestore();
  });
});
