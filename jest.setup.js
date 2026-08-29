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

// @react-native-community/netinfo touches the RNCNetInfo native module at
// import time (nativeInterface.ts), so any test that transitively imports
// NetworkInfoService.ts (App.tsx → RootNavigator → …AddPrinterModal) fails to
// load without a mock. `NetInfo.fetch()` is the ONLY member app code uses
// (NetworkInfoService.getCurrentWifiIp reads type/isConnected/details.ipAddress
// off its result). Tests needing finer control (NetworkInfoService.test.ts)
// override locally.
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(() => Promise.resolve({ type: 'wifi', isConnected: true, details: { ipAddress: '192.168.1.5' } })),
  },
}));

// react-native-view-shot ships untransformed ESM (src/index.tsx) and pulls a
// native module; useBillImageCapture.tsx imports `captureRef` at load time, so
// any test transitively importing AddPrinterModal fails to parse without this.
jest.mock('react-native-view-shot', () => ({
  __esModule: true,
  captureRef: jest.fn(() => Promise.resolve('file://mock-capture.png')),
}));

// Lớp JS của native module RN*Printer (adapters/native/ThermalPrinterNativeModule)
// gọi thẳng NativeModules.RN*Printer ở tầng namespace, nên bất kỳ test nào
// transitively import EscPosDriver.ts / UsbTransport.ts — kể cả không chạy —
// đều fail nếu không mock ở đây. Test cần kiểm soát chi tiết (EscPosDriver.test.ts,
// UsbTransport.test.ts...) override bằng jest.mock() cục bộ, ưu tiên hơn.
jest.mock('./src/features/printer/adapters/native/ThermalPrinterNativeModule', () => {
  const namespace = () => ({
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue(undefined),
    closeConn: jest.fn().mockResolvedValue(undefined),
    printText: jest.fn().mockImplementation((_text, _opts, cbSuccess) => cbSuccess?.('ok')),
    printBill: jest.fn().mockImplementation((_text, _opts, cbSuccess) => cbSuccess?.('ok')),
    printImageBase64: jest.fn().mockImplementation((_data, _opts, cbSuccess) => cbSuccess?.('ok')),
  });
  const USBPrinter = namespace();
  const BLEPrinter = namespace();
  const NetPrinter = namespace();
  const namespaces = { usb: USBPrinter, bluetooth: BLEPrinter, lan: NetPrinter };
  return {
    USBPrinter,
    BLEPrinter,
    NetPrinter,
    ThermalPrinterAdapter: {
      namespaceFor: (connectionType) => namespaces[connectionType],
      printTextAsync: jest.fn().mockResolvedValue(undefined),
    },
  };
});

// UsbPrinterNativeBridge gọi thẳng NativeModules.RNUSBPrinter.init/printRawData
// (không qua tầng namespace) — RN jest preset không có native module này, nên
// bất kỳ test nào chạm ensureUsbInitialized()/printRawDataUsb() sẽ nổ nếu không
// stub. Test cần kiểm soát chi tiết (UsbPrinterNativeBridge.test.ts) ghi đè
// NativeModules.RNUSBPrinter cục bộ rồi khôi phục.
{
  const { NativeModules } = require('react-native');
  NativeModules.RNUSBPrinter = {
    ...NativeModules.RNUSBPrinter,
    init: jest.fn((cbSuccess) => cbSuccess?.()),
    printRawData: jest.fn((_d, _k, cbSuccess) => cbSuccess?.('ok')),
  };
}
