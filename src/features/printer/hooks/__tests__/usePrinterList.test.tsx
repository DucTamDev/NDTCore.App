import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { usePrinterList, type UsePrinterList } from '../usePrinterList';
import printerReducer from '../../store/printerSlice';
import { printerRepository } from '../../storage/PrinterRepository';
import { printerConnectionService } from '../../connection/PrinterConnectionService';
import type { Printer } from '../../models/printer/Printer';
import { ConnectionType } from '../../models/connections/ConnectionType';
import { makePrinter } from '../../testing/printerFixtures';

jest.mock('../../../../services/LoggerService', () => ({ LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() } }));

jest.mock('../../storage/PrinterRepository', () => ({
  printerRepository: {
    getPrinters: jest.fn(() => []),
    setEnabled: jest.fn(),
    removePrinter: jest.fn(),
  },
}));

jest.mock('../../connection/PrinterConnectionService', () => ({
  printerConnectionService: {
    connect: jest.fn(() => Promise.resolve()),
    disconnect: jest.fn(() => Promise.resolve()),
    reconnect: jest.fn(() => Promise.resolve()),
  },
}));

const printer = (over: Partial<Printer> = {}): Printer =>
  makePrinter({
    name: 'M1',
    connection: { type: ConnectionType.Lan, host: '1.2.3.4', port: 9100 },
    deviceId: 'lan:1.2.3.4:9100',
    createdAt: '',
    updatedAt: '',
    ...over,
  });

const makeStore = () => configureStore({ reducer: { printer: printerReducer } });

const Harness: React.FC<{ onHook: (h: UsePrinterList) => void }> = ({ onHook }) => {
  onHook(usePrinterList());
  return null;
};

const render = () => {
  const store = makeStore();
  let hook!: UsePrinterList;
  act(() => {
    TestRenderer.create(
      <Provider store={store}>
        <Harness onHook={(h) => { hook = h; }} />
      </Provider>,
    );
  });
  return { store, get: () => hook };
};

describe('usePrinterList', () => {
  afterEach(() => jest.clearAllMocks());

  it('loads printers from printerRepository into the store on mount', () => {
    (printerRepository.getPrinters as jest.Mock).mockReturnValue([printer()]);
    const { get } = render();
    expect(printerRepository.getPrinters).toHaveBeenCalled();
    expect(get().printers).toEqual([printer()]);
  });

  it('reload() re-reads storage into the store', () => {
    (printerRepository.getPrinters as jest.Mock).mockReturnValue([]);
    const { get } = render();
    expect(get().printers).toEqual([]);
    (printerRepository.getPrinters as jest.Mock).mockReturnValue([printer(), printer({ id: 'p2' })]);
    act(() => get().reload());
    expect(get().printers).toHaveLength(2);
  });

  it('setEnabled() writes through printerRepository and updates the store', () => {
    (printerRepository.getPrinters as jest.Mock).mockReturnValue([printer({ enabled: true })]);
    const { get } = render();
    act(() => get().setEnabled('p1', false));
    expect(printerRepository.setEnabled).toHaveBeenCalledWith('p1', false);
    expect(get().printers.find((p) => p.id === 'p1')?.enabled).toBe(false);
  });

  it('remove() ngắt kết nối, xoá khỏi storage rồi bỏ khỏi store', async () => {
    (printerRepository.getPrinters as jest.Mock).mockReturnValue([printer(), printer({ id: 'p2' })]);
    const { get } = render();
    await act(async () => {
      await get().remove('p1');
    });
    expect(printerConnectionService.disconnect).toHaveBeenCalledWith('p1');
    expect(printerRepository.removePrinter).toHaveBeenCalledWith('p1');
    expect(get().printers.map((p) => p.id)).toEqual(['p2']);
  });

  it('connect/disconnect/reconnect delegate to printerConnectionService and swallow rejections', async () => {
    const saved = printer({ id: 'p1' });
    (printerRepository.getPrinters as jest.Mock).mockReturnValue([saved]);
    (printerConnectionService.connect as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const { get } = render();
    await act(async () => {
      get().connect('p1');
      await get().disconnect('p1');
      get().reconnect('p1');
    });
    expect(printerConnectionService.connect).toHaveBeenCalledWith(saved);
    expect(printerConnectionService.disconnect).toHaveBeenCalledWith('p1');
    expect(printerConnectionService.reconnect).toHaveBeenCalledWith('p1');
  });
});
