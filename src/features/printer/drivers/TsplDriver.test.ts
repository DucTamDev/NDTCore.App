// src/features/printer/drivers/TsplDriver.test.ts
import { TsplDriver } from './TsplDriver';
import type { PrinterConfig } from '../types/printer.types';
import type { PrintDocument, PrintElement } from '../types/printDocument.types';

jest.mock('../transports/LanTransport', () => ({
  LanTransport: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    write: jest.fn(),
    readOnce: jest.fn().mockResolvedValue(null),
    close: jest.fn(),
  })),
}));

jest.mock('../transports/BluetoothTransport', () => ({
  BluetoothTransport: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    write: jest.fn().mockResolvedValue(undefined),
    readOnce: jest.fn().mockResolvedValue(null),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

const lanConfig: PrinterConfig = {
  id: 'label-1',
  printerName: 'Máy in tem',
  protocol: 'tspl',
  protocolSource: 'auto',
  connectionType: 'lan',
  paperSize: '58mm',
  autoReconnect: false,
  isDefault: false,
  lan: { ip: '192.168.1.60', port: 9100 },
};

const usbConfig: PrinterConfig = { ...lanConfig, id: 'label-usb', connectionType: 'usb', device: undefined };

describe('TsplDriver', () => {
  it('connect() over LAN transitions status idle -> connecting -> connected', async () => {
    const driver = new TsplDriver();
    const statuses: string[] = [];
    driver.onStatusChange(lanConfig.id, (status) => statuses.push(status));
    expect(driver.getStatus(lanConfig.id)).toBe('idle');
    await driver.connect(lanConfig);
    expect(statuses).toEqual(['connecting', 'connected']);
    expect(driver.getStatus(lanConfig.id)).toBe('connected');
  });

  it('disconnect() transitions to disconnected and clears the connection', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanConfig);
    await driver.disconnect(lanConfig.id);
    expect(driver.getStatus(lanConfig.id)).toBe('disconnected');
  });

  it('connect() over USB rejects with UNSUPPORTED_CONNECTION and sets status error', async () => {
    const driver = new TsplDriver();
    await expect(driver.connect(usbConfig)).rejects.toMatchObject({ code: 'UNSUPPORTED_CONNECTION' });
    expect(driver.getStatus(usbConfig.id)).toBe('error');
  });

  it('scan() on lan immediately reports empty (no scan for LAN)', () => {
    const driver = new TsplDriver();
    const events: string[] = [];
    driver.scan('lan', (event) => events.push(event.type));
    expect(events).toEqual(['empty']);
  });

  it('scan() on usb immediately reports error', () => {
    const driver = new TsplDriver();
    const events: string[] = [];
    driver.scan('usb', (event) => events.push(event.type));
    expect(events).toEqual(['error']);
  });

  it('testPrint() reuses an already-open connection instead of reconnecting', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanConfig);
    const { LanTransport } = jest.requireMock('../transports/LanTransport') as { LanTransport: jest.Mock };
    const callsBeforeTestPrint = LanTransport.mock.calls.length;
    await driver.testPrint(lanConfig);
    expect(LanTransport.mock.calls.length).toBe(callsBeforeTestPrint);
  });

  it('identify() returns null when not connected', async () => {
    const driver = new TsplDriver();
    const result = await driver.identify('never-connected');
    expect(result).toBeNull();
  });

  it('identify() returns null when the transport does not respond in time', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanConfig);
    const result = await driver.identify(lanConfig.id);
    expect(result).toBeNull();
  });

  it('print() encodes every element kind and writes once', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanConfig);
    const document: PrintDocument = {
      elements: [
        { type: 'text', content: 'Trà sữa', x: 0, y: 0 },
        { type: 'line', x: 0, y: 10 },
        { type: 'table', rows: [['Trà sữa', '2']], x: 0, y: 20 },
        { type: 'image', data: 'AAAA', x: 0, y: 40 },
        { type: 'barcode', content: '123', x: 0, y: 60 },
        { type: 'qrCode', content: 'https://x', x: 0, y: 80 },
      ],
    };
    await expect(driver.print(lanConfig.id, document)).resolves.toBeUndefined();
  });

  it('print() rejects with ENCODING_FAILED for an unsupported element', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanConfig);
    const badElement = { type: 'unknown-kind', x: 0, y: 0 } as unknown as PrintElement;
    await expect(driver.print(lanConfig.id, { elements: [badElement] })).rejects.toMatchObject({
      code: 'ENCODING_FAILED',
    });
  });

  it('identify() returns a non-null PrinterDeviceInfo when the transport responds', async () => {
    const { LanTransport } = jest.requireMock('../transports/LanTransport') as {
      LanTransport: jest.Mock;
    };
    LanTransport.mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      write: jest.fn(),
      readOnce: jest.fn().mockResolvedValue(new Uint8Array([0x01])),
      close: jest.fn(),
    }));
    const driver = new TsplDriver();
    await driver.connect(lanConfig);
    const result = await driver.identify(lanConfig.id);
    expect(result).not.toBeNull();
  });
});
