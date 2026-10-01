/**
 * Test double dùng chung cho adapters/ trong unit test — thay vì mỗi file
 * test tự viết lại `jest.fn()` boilerplate cho từng adapter. KHÔNG dùng cho
 * production code (chỉ import được từ file test, phụ thuộc global `jest`).
 */
export const createMockDeviceModule = () => ({
  discover: jest.fn().mockResolvedValue([]),
  connect: jest.fn().mockResolvedValue({ connectionId: 'mock-connection', serialNumber: null }),
  write: jest.fn().mockResolvedValue(undefined),
  read: jest.fn().mockResolvedValue(null),
  disconnect: jest.fn().mockResolvedValue(undefined),
});

/** Mock của subscribeDeviceDisconnected — trả về unsubscribe rỗng, không tự bắn event nào. */
export const createMockSubscribeDeviceDisconnected = () => jest.fn().mockReturnValue(() => undefined);
