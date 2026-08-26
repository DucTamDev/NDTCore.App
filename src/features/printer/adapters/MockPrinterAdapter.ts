/**
 * Test double dùng chung cho adapters/ trong unit test — thay vì mỗi file
 * test tự viết lại `jest.fn()` boilerplate cho từng adapter. KHÔNG dùng cho
 * production code (chỉ import được từ file test, phụ thuộc global `jest`).
 */
export const createMockUsbPrinterNativeAdapter = () => ({
  ensureUsbInitialized: jest.fn().mockResolvedValue(undefined),
  printRawDataUsb: jest.fn().mockResolvedValue(undefined),
});

export const createMockThermalPrinterLibraryAdapter = () => ({
  namespaceFor: jest.fn().mockReturnValue({
    init: jest.fn().mockResolvedValue(undefined),
    getDeviceList: jest.fn().mockResolvedValue([]),
    connectPrinter: jest.fn().mockResolvedValue({ device_name: 'Mock' }),
    closeConn: jest.fn().mockResolvedValue(undefined),
  }),
  printTextAsync: jest.fn().mockResolvedValue(undefined),
});
