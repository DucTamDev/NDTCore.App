import { LoggerService } from '../LoggerService';

describe('LoggerService', () => {
  const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;

  afterEach(() => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
    jest.restoreAllMocks();
  });

  describe('in __DEV__', () => {
    beforeEach(() => {
      (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    });

    it('writes debug/info/warning/error to the matching console method', () => {
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => undefined);
      const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      LoggerService.debug('d');
      LoggerService.info('i');
      LoggerService.warning('w');
      LoggerService.error('e');

      expect(debugSpy).toHaveBeenCalledWith('[DEBUG] d', '');
      expect(infoSpy).toHaveBeenCalledWith('[INFO] i', '');
      expect(warnSpy).toHaveBeenCalledWith('[WARNING] w', '');
      expect(errorSpy).toHaveBeenCalledWith('[ERROR] e', '');
    });
  });

  describe('outside __DEV__ (production)', () => {
    beforeEach(() => {
      (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    });

    it('still writes warning and error so production incidents are not completely silent', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      LoggerService.warning('w');
      LoggerService.error('e');

      expect(warnSpy).toHaveBeenCalledWith('[WARNING] w', '');
      expect(errorSpy).toHaveBeenCalledWith('[ERROR] e', '');
    });

    it('suppresses debug and info as noise', () => {
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => undefined);
      const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);

      LoggerService.debug('d');
      LoggerService.info('i');

      expect(debugSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
    });
  });
});
