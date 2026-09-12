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

// @shopify/react-native-skia touches native bindings at import time.
// renderDocumentToBitmap.ts (and anything importing it, e.g. OrderPrintTrigger.ts)
// needs this mocked globally, same reasoning as react-native-view-shot above.
// The mock canvas RECORDS every draw call (`ops` array) instead of trying to
// render real pixels — dedicated tests assert against `ops`, matching this
// project's existing convention of testing "did we call the native API
// correctly" rather than "is the native output visually correct" (see
// renderDocumentToBitmap.test.ts for the fine-grained per-test override of
// this same mock).
jest.mock('@shopify/react-native-skia', () => {
  const makeRecordingCanvas = () => {
    const ops = [];
    return {
      ops,
      clear: (...args) => ops.push({ op: 'clear', args }),
      drawText: (...args) => ops.push({ op: 'drawText', args }),
      drawLine: (...args) => ops.push({ op: 'drawLine', args }),
      drawRect: (...args) => ops.push({ op: 'drawRect', args }),
      drawImage: (...args) => ops.push({ op: 'drawImage', args }),
    };
  };

  return {
    __esModule: true,
    Skia: {
      Surface: {
        MakeOffscreen: jest.fn((width, height) => {
          const canvas = makeRecordingCanvas();
          return {
            width: () => width,
            height: () => height,
            getCanvas: () => canvas,
            makeImageSnapshot: () => ({
              encodeToBytes: jest.fn(() => new Uint8Array([1, 2, 3])),
            }),
          };
        }),
      },
      Color: jest.fn((value) => value),
      Paint: jest.fn(() => ({ setColor: jest.fn(), setStrokeWidth: jest.fn() })),
      FontMgr: { System: jest.fn(() => ({ matchFamilyStyle: jest.fn(() => null) })) },
      // Ghi lại `size` truyền vào thay vì hardcode — renderDocumentToBitmap.test.ts
      // cần assert đúng cỡ chữ (24 = LINE_HEIGHT_DOTS) được truyền cho Skia.Font.
      Font: jest.fn((_typeface, size) => ({ measureText: jest.fn(() => ({ width: 0 })), getSize: jest.fn(() => size ?? 24) })),
    },
    ImageFormat: { PNG: 'png' },
  };
});

// qrcode does synchronous QR-matrix math with no native dependency — mocked
// here only for deterministic, fast tests (drawQrCode.test.ts overrides
// locally with a tiny real matrix when it needs to assert actual pixel
// placement; other tests just need `create()` to not throw).
jest.mock('qrcode', () => ({
  create: jest.fn(() => ({ modules: { size: 1, data: new Uint8Array([1]) } })),
}));

// Lớp JS của native module RN*Printer (adapters/native/PrinterNativeModule)
// gọi thẳng NativeModules.ThermalPrinterModule, nên bất kỳ test nào
// transitively import EscPosDriver.ts / UsbTransport.ts — kể cả không chạy —
// đều fail nếu không mock ở đây. Test cần kiểm soát chi tiết (EscPosDriver.test.ts,
// UsbTransport.test.ts...) override bằng jest.mock() cục bộ, ưu tiên hơn.
jest.mock('./src/features/printer/adapters/native/PrinterNativeModule', () => ({
  ThermalPrinterModule: {
    discoverPrinters: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue(undefined),
    reconnect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    writeByBase64: jest.fn().mockResolvedValue('Print SuccessFully'),
    getPrinterInfo: jest.fn().mockResolvedValue(undefined),
    getPrinterCapabilities: jest.fn().mockResolvedValue(undefined),
    getConnectionState: jest.fn().mockResolvedValue('CONNECTED'),
    cancelPrintJob: jest.fn().mockResolvedValue(false),
    getQueueStatus: jest.fn().mockResolvedValue({ pendingCount: 0, runningJobId: null }),
  },
}));

// PrinterNativeModule.test.ts dùng requireActual để test bản THẬT — cần
// NativeModules.ThermalPrinterModule tồn tại vì RN jest preset không có.
{
  const { NativeModules } = require('react-native');
  NativeModules.ThermalPrinterModule = {
    ...NativeModules.ThermalPrinterModule,
    connect: jest.fn().mockResolvedValue(undefined),
    writeByBase64: jest.fn().mockResolvedValue('ok'),
  };
}
