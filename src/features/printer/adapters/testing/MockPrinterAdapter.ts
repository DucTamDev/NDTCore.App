/**
 * Test double dùng chung cho adapters/ trong unit test — thay vì mỗi file
 * test tự viết lại `jest.fn()` boilerplate cho từng adapter. KHÔNG dùng cho
 * production code (chỉ import được từ file test, phụ thuộc global `jest`).
 */
export const createMockThermalPrinterModule = () => ({
  discoverPrinters: jest.fn().mockResolvedValue([]),
  connect: jest.fn().mockResolvedValue(undefined),
  reconnect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  writeByBase64: jest.fn().mockResolvedValue('ok'),
  getPrinterInfo: jest.fn().mockResolvedValue(undefined),
  getPrinterCapabilities: jest.fn().mockResolvedValue(undefined),
  getConnectionState: jest.fn().mockResolvedValue('CONNECTED'),
  cancelPrintJob: jest.fn().mockResolvedValue(false),
  getQueueStatus: jest.fn().mockResolvedValue({ pendingCount: 0, runningJobId: null }),
});
