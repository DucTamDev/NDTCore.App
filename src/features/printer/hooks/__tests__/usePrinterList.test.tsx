import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { usePrinterList, type UsePrinterList } from '../usePrinterList';
import printerReducer from '../../store/printerSlice';
import { PrinterRepository } from '../../services/PrinterRepository';
import { PrinterConnectionService } from '../../services/PrinterConnectionService';
import type { Printer } from '../../types/printer.types';
import { makePrinter } from '../../testing/printerFixtures';

jest.mock('../../../../services/LoggerService', () => ({ LoggerService: { debug: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() } }));

jest.mock('../../services/PrinterRepository', () => ({
  PrinterRepository: {
    getPrinters: jest.fn(() => []),
    setEnabled: jest.fn(),
    removePrinter: jest.fn(),
  },
}));

jest.mock('../../services/PrinterConnectionService', () => ({
  PrinterConnectionService: {
    connect: jest.fn(() => Promise.resolve()),
    disconnect: jest.fn(() => Promise.resolve()),
    reconnect: jest.fn(() => Promise.resolve()),
  },
}));

const printer = (over: Partial<Printer> = {}): Printer =>
  makePrinter({
    name: 'M1',
    drivers: [],
    lan: { ip: '1.2.3.4', port: 9100 },
    identityKey: 'lan:1.2.3.4:9100',
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

  it('loads printers from PrinterRepository into the store on mount', () => {
    (PrinterRepository.getPrinters as jest.Mock).mockReturnValue([printer()]);
    const { get } = render();
    expect(PrinterRepository.getPrinters).toHaveBeenCalled();
    expect(get().printers).toEqual([printer()]);
  });

  it('reload() re-reads storage into the store', () => {
    (PrinterRepository.getPrinters as jest.Mock).mockReturnValue([]);
    const { get } = render();
    expect(get().printers).toEqual([]);
    (PrinterRepository.getPrinters as jest.Mock).mockReturnValue([printer(), printer({ id: 'p2' })]);
    act(() => get().reload());
    expect(get().printers).toHaveLength(2);
  });

  it('setEnabled() writes through PrinterRepository and updates the store', () => {
    (PrinterRepository.getPrinters as jest.Mock).mockReturnValue([printer({ enabled: true })]);
    const { get } = render();
    act(() => get().setEnabled('p1', false));
    expect(PrinterRepository.setEnabled).toHaveBeenCalledWith('p1', false);
    expect(get().printers.find((p) => p.id === 'p1')?.enabled).toBe(false);
  });

  it('remove() writes through PrinterRepository and drops it from the store', () => {
    (PrinterRepository.getPrinters as jest.Mock).mockReturnValue([printer(), printer({ id: 'p2' })]);
    const { get } = render();
    act(() => get().remove('p1'));
    expect(PrinterRepository.removePrinter).toHaveBeenCalledWith('p1');
    expect(get().printers.map((p) => p.id)).toEqual(['p2']);
  });

  it('connect/disconnect/reconnect delegate to PrinterConnectionService and swallow rejections', async () => {
    (PrinterRepository.getPrinters as jest.Mock).mockReturnValue([]);
    (PrinterConnectionService.connect as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const { get } = render();
    await act(async () => {
      get().connect('p1');
      await get().disconnect('p1');
      get().reconnect('p1');
    });
    expect(PrinterConnectionService.connect).toHaveBeenCalledWith('p1');
    expect(PrinterConnectionService.disconnect).toHaveBeenCalledWith('p1');
    expect(PrinterConnectionService.reconnect).toHaveBeenCalledWith('p1');
  });
});
