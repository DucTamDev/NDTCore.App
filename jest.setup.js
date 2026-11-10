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

// @react-native-community/netinfo touches the RNCNetInfo native module at
// import time (nativeInterface.ts), so any test that transitively imports
// NetworkDiscoveryService.ts (App.tsx → RootNavigator → …AddPrinterModal) fails to
// load without a mock. `NetInfo.fetch()` is the ONLY member app code uses
// (NetworkDiscoveryService.getCurrentWifiIp reads type/isConnected/details.ipAddress
// off its result). Tests needing finer control (NetworkDiscoveryService.test.ts)
// override locally.
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(() => Promise.resolve({ type: 'wifi', isConnected: true, details: { ipAddress: '192.168.1.5' } })),
  },
}));

// react-native-view-shot ships untransformed ESM (src/index.tsx) and pulls a
// native module; package máy in imports `captureRef` at load time, so any test
// transitively importing it fails to parse without this.
jest.mock('react-native-view-shot', () => ({
  __esModule: true,
  captureRef: jest.fn(() => Promise.resolve('file://mock-capture.png')),
}));
