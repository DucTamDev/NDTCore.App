/**
 * Test double dùng chung cho adapters/ trong unit test — thay vì mỗi file
 * test tự viết lại `jest.fn()` boilerplate cho từng adapter. KHÔNG dùng cho
 * production code (chỉ import được từ file test, phụ thuộc global `jest`).
 */
export const createMockThermalPrinterModule = () => ({
  discoverPrinters: jest.fn().mockResolvedValue([]),
  connect: jest.fn().mockResolvedValue('mock-identity'),
  disconnect: jest.fn().mockResolvedValue(undefined),
  writeByBase64: jest.fn().mockResolvedValue('ok'),
});

/** Mock của subscribeConnectionLost — trả về unsubscribe rỗng, không tự bắn event nào. */
export const createMockSubscribeConnectionLost = () => jest.fn().mockReturnValue(() => undefined);
