import { createDiscoverDriver, DiscoveryStage, type DiscoveryEvent } from '../PrinterDiscoveryService';
import type { IPrinterDriver } from '../../drivers/IPrinterDriver';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import { PrinterDriverType, type PrinterDriver } from '../../models/printer/PrinterDriver';
import { PrinterStatus } from '../../models/printer/PrinterStatus';
import { PrinterLogger } from '../../logging/PrinterLogger';
import { PrinterErrorCode } from '../../errors/PrinterError';
import { makePrinter } from '../../testing/printerFixtures';
import { getDriverCapabilities } from '../../drivers/DriverCapabilities';

jest.mock('../../logging/PrinterLogger', () => ({
  PrinterLogger: {
    discoveryStarted: jest.fn(), discoveryCandidateRejected: jest.fn(), discoveryFailed: jest.fn(),
    protocolDetected: jest.fn(), protocolUnknown: jest.fn(),
  },
}));

const makeMockDriver = (overrides: Partial<jest.Mocked<IPrinterDriver>> = {}): jest.Mocked<IPrinterDriver> => ({
  scan: jest.fn().mockReturnValue(() => undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn().mockReturnValue(PrinterStatus.Connected),
  onStatusChange: jest.fn().mockReturnValue(() => undefined),
  testPrint: jest.fn().mockResolvedValue(undefined),
  print: jest.fn().mockResolvedValue(undefined),
  identify: jest.fn().mockResolvedValue(null),
  ...overrides,
});

const collectEvents = (
  registry: Record<PrinterDriverType, IPrinterDriver>,
  input: Parameters<ReturnType<typeof createDiscoverDriver>>[0],
): Promise<DiscoveryEvent[]> =>
  new Promise((resolve) => {
    const events: DiscoveryEvent[] = [];
    createDiscoverDriver(registry)(input, (event) => {
      events.push(event);
      if (event.stage === DiscoveryStage.Identified || event.stage === DiscoveryStage.UnknownProtocol || event.stage === DiscoveryStage.Error) resolve(events);
    });
  });

describe('PrinterDiscoveryService', () => {
  // Draft `Printer` ĐẦY ĐỦ — `DiscoverPrinterInput.draftPrinter` là 1 Printer thật
  // (do caller tự dựng), không phải mấy field rời rạc nữa.
  const baseDraftPrinter = makePrinter({ name: 'Máy in mới', drivers: [] });
  const baseInput = { draftPrinter: baseDraftPrinter };

  afterEach(() => jest.clearAllMocks());

  it('emits identified when the first candidate connects and identifies successfully', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'TSC TE244' }) });
    const escposDriver = makeMockDriver();
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);
    expect(events.map((e) => e.stage)).toEqual([DiscoveryStage.Connecting, DiscoveryStage.Identifying, DiscoveryStage.Identified]);
    expect(events[2].protocol).toBe(PrinterDriverType.tspl);
    expect(events[2].deviceInfo).toEqual({ deviceName: 'TSC TE244' });
    expect(tsplDriver.disconnect).not.toHaveBeenCalled();
    expect(escposDriver.connect).not.toHaveBeenCalled();
  });

  it('hands the candidate driver its own defaultConfig media (no form threading — SP-C)', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'TSC TE244' }) });
    const escposDriver = makeMockDriver();
    await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);
    const [, candidateDriver] = tsplDriver.connect.mock.calls[0] as [unknown, PrinterDriver];
    expect(candidateDriver.config.media.paperSize).toBe(getDriverCapabilities(PrinterDriverType.tspl).defaultConfig.media.paperSize);
  });

  it('does not mutate the shared defaultConfig when building candidate media', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);
    expect(getDriverCapabilities(PrinterDriverType.tspl).defaultConfig.media.paperSize).toBe(80);
    expect(getDriverCapabilities(PrinterDriverType.escpos).defaultConfig.media.paperSize).toBe(80);
  });

  it('excludedDrivers removes a driver type from the candidate list even if it would have identified', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'TSC TE244' }) });
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'X' }) });
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, { ...baseInput, excludedDrivers: [PrinterDriverType.tspl] });
    const identified = events.find((e) => e.stage === DiscoveryStage.Identified);
    expect(identified?.protocol).toBe(PrinterDriverType.escpos);
    expect(tsplDriver.connect).not.toHaveBeenCalled();
  });

  it('emits error (not unknown_protocol) when excludedDrivers removes every candidate', async () => {
    const events = await collectEvents(
      { escpos: makeMockDriver(), tspl: makeMockDriver() },
      { ...baseInput, excludedDrivers: [PrinterDriverType.escpos, PrinterDriverType.tspl] },
    );
    expect(events[events.length - 1].stage).toBe(DiscoveryStage.Error);
  });

  it('falls through to the next candidate when the first identify() returns null', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({}) });
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);
    expect(events.find((e) => e.stage === DiscoveryStage.Identified)?.protocol).toBe(PrinterDriverType.escpos);
    expect(tsplDriver.disconnect).toHaveBeenCalledWith('p1');
  });

  it('emits unknown_protocol when every remaining candidate connects but none identifies', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);
    expect(events[events.length - 1].stage).toBe(DiscoveryStage.UnknownProtocol);
  });

  it('emits error when every remaining candidate fails to even connect', async () => {
    const escposDriver = makeMockDriver({ connect: jest.fn().mockRejectedValue(new Error('down')) });
    const tsplDriver = makeMockDriver({ connect: jest.fn().mockRejectedValue(new Error('down')) });
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);
    const last = events[events.length - 1];
    expect(last.stage).toBe(DiscoveryStage.Error);
    expect(last.error?.code).toBe(PrinterErrorCode.PRINTER_CONNECTION_FAILED);
    expect(PrinterLogger.discoveryFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: 'p1', connectionType: PrinterConnectionType.Lan, candidatesTried: [PrinterDriverType.tspl, PrinterDriverType.escpos] }),
    );
  });

  // --- Ported from services/__tests__/discoverProtocol.test.ts (pre-existing cases) ---

  it('logs discoveryStarted and discoveryCandidateRejected for the full trace of a multi-candidate attempt', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'X' }) });
    await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);

    expect(PrinterLogger.discoveryStarted).toHaveBeenCalledWith({
      printerId: 'p1',
      connectionType: PrinterConnectionType.Lan,
      candidates: [PrinterDriverType.tspl, PrinterDriverType.escpos],
    });
    expect(PrinterLogger.discoveryCandidateRejected).toHaveBeenCalledWith({
      printerId: 'p1',
      protocol: PrinterDriverType.tspl,
      connectionType: PrinterConnectionType.Lan,
      reason: 'not_confirmed',
    });
  });

  it('unsubscribing before completion stops further events from being emitted', async () => {
    let resolveConnect: () => void = () => undefined;
    const escposDriver = makeMockDriver({
      connect: jest.fn().mockImplementation(() => new Promise<void>((resolve) => { resolveConnect = resolve; })),
    });
    const tsplDriver = makeMockDriver();
    const events: DiscoveryEvent[] = [];
    const unsubscribe = createDiscoverDriver({ escpos: escposDriver, tspl: tsplDriver })(baseInput, (event) => {
      events.push(event);
    });
    unsubscribe();
    resolveConnect();
    await Promise.resolve();
    await Promise.resolve();
    expect(events.map((e) => e.stage)).toEqual([DiscoveryStage.Connecting]);
  });

  it('disconnects the driver when cancelled right after connect() succeeds (wizard closed mid-connect)', async () => {
    let resolveConnect: () => void = () => undefined;
    const tsplDriver = makeMockDriver({
      connect: jest.fn().mockImplementation(() => new Promise<void>((resolve) => { resolveConnect = resolve; })),
    });
    const escposDriver = makeMockDriver();
    const events: DiscoveryEvent[] = [];
    const unsubscribe = createDiscoverDriver({ escpos: escposDriver, tspl: tsplDriver })(baseInput, (event) => {
      events.push(event);
    });

    unsubscribe();
    resolveConnect();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(tsplDriver.disconnect).toHaveBeenCalledWith('p1');
    expect(events.map((e) => e.stage)).toEqual([DiscoveryStage.Connecting]);
  });

  it('disconnects the driver when cancelled right after identify() resolves (wizard closed mid-identify)', async () => {
    let resolveIdentify: (value: null) => void = () => undefined;
    const tsplDriver = makeMockDriver({
      identify: jest.fn().mockImplementation(() => new Promise((resolve) => { resolveIdentify = resolve; })),
    });
    const escposDriver = makeMockDriver();
    const events: DiscoveryEvent[] = [];
    const unsubscribe = createDiscoverDriver({ escpos: escposDriver, tspl: tsplDriver })(baseInput, (event) => {
      events.push(event);
    });

    await Promise.resolve();
    await Promise.resolve();
    unsubscribe();
    resolveIdentify(null);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(tsplDriver.disconnect).toHaveBeenCalledWith('p1');
    expect(events.map((e) => e.stage)).toEqual([DiscoveryStage.Connecting, DiscoveryStage.Identifying]);
  });

  it('logs protocolDetected when identify() succeeds', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'TM-T82' }) });
    const tsplDriver = makeMockDriver();
    await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);
    expect(PrinterLogger.protocolDetected).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: 'p1', protocol: PrinterDriverType.escpos, connectionType: PrinterConnectionType.Lan }),
    );
  });

  it('logs protocolUnknown when every candidate connects but none identifies', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);
    expect(PrinterLogger.protocolUnknown).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: 'p1', connectionType: PrinterConnectionType.Lan }),
    );
  });
});
