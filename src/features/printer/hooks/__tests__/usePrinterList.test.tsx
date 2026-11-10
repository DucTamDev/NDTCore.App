import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import type { Printer, PrinterListListener, PrinterManager } from '@ndtcore/printer';
import { usePrinterList, type UsePrinterList } from '../usePrinterList';

jest.mock('../../../../services/LoggerService', () => ({
  LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() },
}));

/** Printer giả, chỉ cần id để phân biệt. */
const printer = (id: string): Printer => ({ id }) as unknown as Printer;

/** printerManager giả: giữ listener để test phát danh sách mới. */
const makeManager = (initial: Printer[]) => {
  let listener: PrinterListListener | undefined;
  const manager = {
    getPrinters: jest.fn(() => initial),
    subscribe: jest.fn((next: PrinterListListener) => {
      listener = next;
      return jest.fn();
    }),
    removeAsync: jest.fn(() => Promise.resolve()),
    reconnectAsync: jest.fn(() => Promise.resolve()),
    listUsbDevicesForRebind: jest.fn(() => []),
    rebindUsbAsync: jest.fn(() => Promise.resolve()),
  };
  return { manager: manager as unknown as PrinterManager, mock: manager, emit: (list: Printer[]) => listener?.(list) };
};

const render = (manager: PrinterManager) => {
  let hook!: UsePrinterList;
  const Harness: React.FC = () => {
    hook = usePrinterList(manager);
    return null;
  };
  act(() => {
    TestRenderer.create(<Harness />);
  });
  return () => hook;
};

describe('usePrinterList', () => {
  it('đọc danh sách ban đầu từ printerManager', () => {
    const { manager } = makeManager([printer('a')]);
    expect(render(manager)().printers.map((item) => item.id)).toEqual(['a']);
  });

  it('nhận danh sách mới qua subscribe', () => {
    const { manager, emit } = makeManager([printer('a')]);
    const get = render(manager);

    act(() => emit([printer('a'), printer('b')]));

    expect(get().printers.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('các thao tác gọi đúng hàm của printerManager', async () => {
    const { manager, mock } = makeManager([printer('a')]);
    const hook = render(manager)();

    await hook.removeAsync('a');
    await hook.reconnectAsync('a');
    hook.listUsbDevicesForRebind('a');
    await hook.rebindUsbAsync('a', '/dev/usb/1');

    expect(mock.removeAsync).toHaveBeenCalledWith('a');
    expect(mock.reconnectAsync).toHaveBeenCalledWith('a');
    expect(mock.listUsbDevicesForRebind).toHaveBeenCalledWith('a');
    expect(mock.rebindUsbAsync).toHaveBeenCalledWith('a', '/dev/usb/1');
  });

  it('kết nối lại lỗi thì ghi log, không reject', async () => {
    const { manager, mock } = makeManager([printer('a')]);
    mock.reconnectAsync.mockRejectedValueOnce(new Error('ACTION_UNAVAILABLE'));

    await expect(render(manager)().reconnectAsync('a')).resolves.toBeUndefined();
  });
});
