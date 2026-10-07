import { PrinterManagementService } from '../PrinterManagementService';
import { PrinterRepository } from '../../storage/PrinterRepository';
import { printerStorage } from '../../storage/PrinterStorage';
import { basePrinter, makeMockConnectionService } from '../../testing/printerServiceTestKit';

jest.mock('../../../../services/LoggerService', () => ({
  LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() },
}));

/** Service với repository thật trên storage đã xoá sạch và kết nối giả. */
const setup = (disconnect: jest.Mock = jest.fn().mockResolvedValue(undefined)) => {
  const repository = new PrinterRepository();
  const connectionService = makeMockConnectionService({ disconnect });
  const service = new PrinterManagementService(repository, connectionService);
  return { service, repository, connectionService };
};

describe('PrinterManagementService', () => {
  beforeEach(() => printerStorage.savePrinters([]));

  it('save: máy in mới thì thêm', () => {
    const { service, repository } = setup();
    service.save(basePrinter);
    expect(repository.getPrinters()).toEqual([expect.objectContaining({ id: basePrinter.id })]);
  });

  it('save: máy in đã có cùng id thì sửa, không thêm bản thứ hai', () => {
    const { service, repository } = setup();
    service.save(basePrinter);
    service.save({ ...basePrinter, name: 'Tên mới' });
    expect(repository.getPrinters()).toEqual([expect.objectContaining({ id: basePrinter.id, name: 'Tên mới' })]);
  });

  it('remove: ngắt kết nối trước rồi mới xoá', async () => {
    const order: string[] = [];
    const { service, repository } = setup(
      jest.fn().mockImplementation(async () => {
        order.push(`disconnect:${repository.getPrinters().length}`);
      }),
    );
    service.save(basePrinter);

    await service.remove(basePrinter.id);

    expect(order).toEqual(['disconnect:1']);
    expect(repository.getPrinters()).toEqual([]);
  });

  it('remove: ngắt lỗi vẫn xoá', async () => {
    const { service, repository } = setup(jest.fn().mockRejectedValue(new Error('io')));
    service.save(basePrinter);

    await service.remove(basePrinter.id);

    expect(repository.getPrinters()).toEqual([]);
  });

  it('setEnabled: ghi trạng thái bật/tắt, không đụng tới kết nối', () => {
    const { service, repository, connectionService } = setup();
    service.save(basePrinter);

    service.setEnabled(basePrinter.id, false);

    expect(repository.findById(basePrinter.id)?.enabled).toBe(false);
    expect(connectionService.disconnect).not.toHaveBeenCalled();
  });
});
