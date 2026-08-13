/* eslint-env jest */

// react-native-config ships an ESM build ("export const Config = ...") that
// the react-native preset's transformIgnorePatterns does not cover, so any
// test that transitively imports a module referencing `Config` (e.g.
// src/config/appConfig.ts, which HttpClient.ts and refreshTokenRequest.ts
// both import) fails to parse unless the module is mocked here. Jest's
// module resolution (unlike Webpack's) does not prioritize `.web.ts`, so
// `appConfig.ts` (not `appConfig.web.ts`) is the file under test.
jest.mock('react-native-config', () => ({
  __esModule: true,
  default: { API_BASE_URL: 'https://api.soliteavn.com/api', TENANT_ID: '00000000-0000-0000-0000-000000000001' },
}));

jest.mock('react-native-mmkv', () => {
  const store = new Map();
  return {
    createMMKV: jest.fn().mockImplementation(() => ({
      getString: (key) => store.get(key),
      set: (key, value) => store.set(key, value),
      remove: (key) => store.delete(key),
    })),
  };
});

jest.mock('react-native-bluetooth-classic', () => ({
  __esModule: true,
  default: {
    startDiscovery: jest.fn().mockResolvedValue([]),
    cancelDiscovery: jest.fn().mockResolvedValue(true),
    connectToDevice: jest.fn(),
  },
}));

// react-native-tcp-socket, like react-native-bluetooth-classic above, needs a
// global mock for the same reason: LanTransport.ts (used by TsplDriver) pulls
// it in at import time, and any test that transitively imports TsplDriver.ts
// (e.g. via DriverRegistry) would otherwise fail to parse it.
jest.mock('react-native-tcp-socket', () => ({
  __esModule: true,
  default: {
    createConnection: jest.fn().mockImplementation((_options, callback) => {
      if (callback) callback();
      return {
        on: jest.fn(),
        write: jest.fn(),
        destroy: jest.fn(),
      };
    }),
  },
}));

// @poriyaalar/react-native-thermal-receipt-printer ships an ESM build that Jest
// cannot transform, so ThermalReceiptDriver imports (which are transitively
// imported via DriverRegistry in tests) would fail unless mocked here. Individual
// test files can override this global mock with their own jest.mock() — local
// mocks take precedence over global ones.
jest.mock('@poriyaalar/react-native-thermal-receipt-printer', () => ({
  USBPrinter: {
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue(undefined),
    printText: jest.fn().mockImplementation((text, opts, cbSuccess, cbErr) => {
      if (cbSuccess) cbSuccess();
    }),
    printTextAsync: jest.fn().mockResolvedValue(undefined),
    printRawData: jest.fn().mockResolvedValue(undefined),
    lineWrap: jest.fn().mockResolvedValue(undefined),
    closeConn: jest.fn().mockResolvedValue(undefined),
  },
  BLEPrinter: {
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue(undefined),
    printText: jest.fn().mockImplementation((text, opts, cbSuccess, cbErr) => {
      if (cbSuccess) cbSuccess();
    }),
    printTextAsync: jest.fn().mockResolvedValue(undefined),
    printRawData: jest.fn().mockResolvedValue(undefined),
    lineWrap: jest.fn().mockResolvedValue(undefined),
    closeConn: jest.fn().mockResolvedValue(undefined),
  },
  NetPrinter: {
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue(undefined),
    printText: jest.fn().mockImplementation((text, opts, cbSuccess, cbErr) => {
      if (cbSuccess) cbSuccess();
    }),
    printTextAsync: jest.fn().mockResolvedValue(undefined),
    printRawData: jest.fn().mockResolvedValue(undefined),
    lineWrap: jest.fn().mockResolvedValue(undefined),
    closeConn: jest.fn().mockResolvedValue(undefined),
  },
}));
