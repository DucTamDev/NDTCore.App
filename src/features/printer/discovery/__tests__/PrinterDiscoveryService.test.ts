import { createDiscoverDriver, DiscoveryStage, type DiscoveryEvent } from '../PrinterDiscoveryService';
import type { IPrinterDriver } from '../../drivers/IPrinterDriver';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import { DriverSource, PrinterDriverType, RenderMode } from '../../models/printer/PrinterDriver';
import { PrinterStatus } from '../../models/printer/PrinterStatus';
import { PrinterLogger } from '../../logging/PrinterLogger';
import { PrinterErrorCode } from '../../errors/PrinterError';
import { makePrinter } from '../../testing/printerFixtures';
import { getDriverCapabilities } from '../../drivers/DriverCapabilities';
import { PrintType } from '../../models/printing/PrintType';

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
  // (do caller tự dựng), gồm `type`/`paper`/`driver` placeholder theo shape mới.
  const baseDraftPrinter = makePrinter({ name: 'Máy in mới' });
  const baseInput = { draftPrinter: baseDraftPrinter };

  afterEach(() => jest.clearAllMocks());

  it('emits identified when the first candidate connects and identifies successfully', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'TSC TE244' }) });
    const escposDriver = makeMockDriver();
    const events = await collectEvents({ EscPos: escposDriver, Tspl: tsplDriver }, baseInput);
    expect(events.map((e) => e.stage)).toEqual([DiscoveryStage.Connecting, DiscoveryStage.Identifying, DiscoveryStage.Identified]);
    expect(events[2].protocol).toBe(PrinterDriverType.Tspl);
    expect(events[2].driver).toEqual({
      type: PrinterDriverType.Tspl,
      source: DriverSource.Auto,
      config: getDriverCapabilities(PrinterDriverType.Tspl).defaultConfig,
    });
    expect(events[2].deviceInfo).toEqual({ deviceName: 'TSC TE244' });
    expect(tsplDriver.disconnect).not.toHaveBeenCalled();
    expect(escposDriver.connect).not.toHaveBeenCalled();
  });

  it('excludes EscPos from the candidate list when draftPrinter.type is Label (capability filter)', async () => {
    const labelDraftPrinter = makePrinter({ type: PrintType.Label });
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'TSC TE244' }) });
    const escposDriver = makeMockDriver();
    const events = await collectEvents({ EscPos: escposDriver, Tspl: tsplDriver }, { draftPrinter: labelDraftPrinter });
    expect(events.map((e) => e.stage)).toEqual([DiscoveryStage.Connecting, DiscoveryStage.Identifying, DiscoveryStage.Identified]);
    expect(events[2].protocol).toBe(PrinterDriverType.Tspl);
    expect(tsplDriver.connect).toHaveBeenCalledTimes(1);
    expect(escposDriver.connect).not.toHaveBeenCalled();
    expect(PrinterLogger.discoveryStarted).toHaveBeenCalledWith(
      expect.objectContaining({ candidates: [PrinterDriverType.Tspl] }),
    );
  });

  it('hands the candidate driver its own defaultConfig (no leftover state from a previous attempt)', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'TSC TE244' }) });
    const escposDriver = makeMockDriver();
    await collectEvents({ EscPos: escposDriver, Tspl: tsplDriver }, baseInput);
    const [attemptPrinter] = tsplDriver.connect.mock.calls[0] as [{ driver: { config: { renderMode: RenderMode } } }];
    expect(attemptPrinter.driver.config.renderMode).toBe(getDriverCapabilities(PrinterDriverType.Tspl).defaultConfig.renderMode);
  });

  it('does not mutate the shared defaultConfig when building the candidate driver', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    await collectEvents({ EscPos: escposDriver, Tspl: tsplDriver }, baseInput);
    expect(getDriverCapabilities(PrinterDriverType.Tspl).defaultConfig.renderMode).toBe(RenderMode.Bitmap);
    expect(getDriverCapabilities(PrinterDriverType.EscPos).defaultConfig.renderMode).toBe(RenderMode.Encoder);
  });

  it('falls through to the next candidate when the first identify() returns null', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({}) });
    const events = await collectEvents({ EscPos: escposDriver, Tspl: tsplDriver }, baseInput);
    const identified = events.find((e) => e.stage === DiscoveryStage.Identified);
    expect(identified?.protocol).toBe(PrinterDriverType.EscPos);
    expect(identified?.driver?.type).toBe(PrinterDriverType.EscPos);
    expect(tsplDriver.disconnect).toHaveBeenCalledWith('p1');
  });

  it('emits unknown_protocol when every remaining candidate connects but none identifies', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const events = await collectEvents({ EscPos: escposDriver, Tspl: tsplDriver }, baseInput);
    expect(events[events.length - 1].stage).toBe(DiscoveryStage.UnknownProtocol);
  });

  it('emits error when every remaining candidate fails to even connect', async () => {
    const escposDriver = makeMockDriver({ connect: jest.fn().mockRejectedValue(new Error('down')) });
    const tsplDriver = makeMockDriver({ connect: jest.fn().mockRejectedValue(new Error('down')) });
    const events = await collectEvents({ EscPos: escposDriver, Tspl: tsplDriver }, baseInput);
    const last = events[events.length - 1];
    expect(last.stage).toBe(DiscoveryStage.Error);
    expect(last.error?.code).toBe(PrinterErrorCode.PRINTER_CONNECTION_FAILED);
    expect(PrinterLogger.discoveryFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: 'p1', connectionType: PrinterConnectionType.Lan, candidatesTried: [PrinterDriverType.Tspl, PrinterDriverType.EscPos] }),
    );
  });

  // --- Ported from services/__tests__/discoverProtocol.test.ts (pre-existing cases) ---

  it('logs discoveryStarted and discoveryCandidateRejected for the full trace of a multi-candidate attempt', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'X' }) });
    await collectEvents({ EscPos: escposDriver, Tspl: tsplDriver }, baseInput);

    expect(PrinterLogger.discoveryStarted).toHaveBeenCalledWith({
      printerId: 'p1',
      connectionType: PrinterConnectionType.Lan,
      candidates: [PrinterDriverType.Tspl, PrinterDriverType.EscPos],
    });
    expect(PrinterLogger.discoveryCandidateRejected).toHaveBeenCalledWith({
      printerId: 'p1',
      protocol: PrinterDriverType.Tspl,
      connectionType: PrinterConnectionType.Lan,
      reason: 'not_confirmed',
    });
  });

  it('unsubscribing before completion stops further events from being emitted', async () => {
    let resolveConnect: () => void = () => undefined;
    const tsplDriver = makeMockDriver({
      connect: jest.fn().mockImplementation(() => new Promise<void>((resolve) => { resolveConnect = resolve; })),
    });
    const escposDriver = makeMockDriver();
    const events: DiscoveryEvent[] = [];
    const unsubscribe = createDiscoverDriver({ EscPos: escposDriver, Tspl: tsplDriver })(baseInput, (event) => {
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
    const unsubscribe = createDiscoverDriver({ EscPos: escposDriver, Tspl: tsplDriver })(baseInput, (event) => {
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
    const unsubscribe = createDiscoverDriver({ EscPos: escposDriver, Tspl: tsplDriver })(baseInput, (event) => {
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
    await collectEvents({ EscPos: escposDriver, Tspl: tsplDriver }, baseInput);
    expect(PrinterLogger.protocolDetected).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: 'p1', protocol: PrinterDriverType.EscPos, connectionType: PrinterConnectionType.Lan }),
    );
  });

  it('logs protocolUnknown when every candidate connects but none identifies', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    await collectEvents({ EscPos: escposDriver, Tspl: tsplDriver }, baseInput);
    expect(PrinterLogger.protocolUnknown).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: 'p1', connectionType: PrinterConnectionType.Lan }),
    );
  });
});
