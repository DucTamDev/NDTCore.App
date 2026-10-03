import { createDiscoverDriver, DiscoveryStage, type DiscoveryEvent } from '../PrinterDiscoveryService';
import type { IPrinterDriver } from '../../drivers/IPrinterDriver';
import { ConnectionType } from '../../models/printer/ConnectionType';
import { LanguageSelection, PrintLanguage, RasterSource, RenderMode } from '../../models/printer/PrinterLanguage';
import { PrinterLogger } from '../../logging/PrinterLogger';
import { PrinterErrorCode } from '../../errors/PrinterError';
import { makePrinter } from '../../testing/printerFixtures';
import { makeMockConnectionService, makeMockDriver } from '../../testing/printerServiceTestKit';
import { PrintKind } from '../../models/printer/PrintKind';

jest.mock('../../logging/PrinterLogger', () => ({
  PrinterLogger: {
    discoveryStarted: jest.fn(), discoveryCandidateRejected: jest.fn(), discoveryFailed: jest.fn(),
    protocolDetected: jest.fn(), protocolUnknown: jest.fn(),
  },
}));

let connectionService = makeMockConnectionService();

const collectEvents = (
  registry: Record<PrintLanguage, IPrinterDriver>,
  input: Parameters<ReturnType<typeof createDiscoverDriver>>[0],
): Promise<DiscoveryEvent[]> =>
  new Promise((resolve) => {
    const events: DiscoveryEvent[] = [];
    createDiscoverDriver(registry, connectionService)(input, (event) => {
      events.push(event);
      if (event.stage === DiscoveryStage.Identified || event.stage === DiscoveryStage.UnknownProtocol || event.stage === DiscoveryStage.Error) resolve(events);
    });
  });

describe('PrinterDiscoveryService', () => {
  // Draft `Printer` ĐẦY ĐỦ — `DiscoverPrinterInput.draftPrinter` là 1 Printer thật
  // (do caller tự dựng), gồm `type`/`paper`/`driver` placeholder theo shape mới.
  const baseDraftPrinter = makePrinter({ name: 'Máy in mới' });
  const baseInput = { draftPrinter: baseDraftPrinter };

  beforeEach(() => {
    connectionService = makeMockConnectionService();
  });

  afterEach(() => jest.clearAllMocks());

  it('emits identified when the first candidate connects and identifies successfully', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'TSC TE244' }) });
    const escposDriver = makeMockDriver();
    const events = await collectEvents({ EscPos: escposDriver, Tspl: tsplDriver }, baseInput);
    expect(events.map((e) => e.stage)).toEqual([DiscoveryStage.Connecting, DiscoveryStage.Identifying, DiscoveryStage.Identified]);
    expect(events[2].protocol).toBe(PrintLanguage.Tspl);
    expect(events[2].language).toEqual({
      type: PrintLanguage.Tspl,
      selection: LanguageSelection.Auto,
      renderMode: RenderMode.Raster,
      rasterSource: RasterSource.Image,
    });
    expect(events[2].deviceInfo).toEqual({ deviceName: 'TSC TE244' });
    expect(connectionService.disconnect).not.toHaveBeenCalled();
    expect(connectionService.connect).toHaveBeenCalledTimes(1);
    expect(escposDriver.identify).not.toHaveBeenCalled();
  });

  it('excludes EscPos from the candidate list when draftPrinter.type is Label (capability filter)', async () => {
    const labelDraftPrinter = makePrinter({ kind: PrintKind.Label });
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'TSC TE244' }) });
    const escposDriver = makeMockDriver();
    const events = await collectEvents({ EscPos: escposDriver, Tspl: tsplDriver }, { draftPrinter: labelDraftPrinter });
    expect(events.map((e) => e.stage)).toEqual([DiscoveryStage.Connecting, DiscoveryStage.Identifying, DiscoveryStage.Identified]);
    expect(events[2].protocol).toBe(PrintLanguage.Tspl);
    expect(connectionService.connect).toHaveBeenCalledTimes(1);
    expect(escposDriver.identify).not.toHaveBeenCalled();
    expect(PrinterLogger.discoveryStarted).toHaveBeenCalledWith(
      expect.objectContaining({ candidates: [PrintLanguage.Tspl] }),
    );
  });

  it('hands the candidate driver the default language config for that language', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'TSC TE244' }) });
    const escposDriver = makeMockDriver();
    await collectEvents({ EscPos: escposDriver, Tspl: tsplDriver }, baseInput);
    const [attemptPrinter] = connectionService.connect.mock.calls[0];
    expect(attemptPrinter.language.renderMode).toBe(RenderMode.Raster);
  });

  it('falls through to the next candidate when the first identify() returns null', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({}) });
    const events = await collectEvents({ EscPos: escposDriver, Tspl: tsplDriver }, baseInput);
    const identified = events.find((e) => e.stage === DiscoveryStage.Identified);
    expect(identified?.protocol).toBe(PrintLanguage.EscPos);
    expect(identified?.language?.type).toBe(PrintLanguage.EscPos);
    expect(connectionService.disconnect).toHaveBeenCalledWith('p1');
  });

  it('emits unknown_protocol when every remaining candidate connects but none identifies', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const events = await collectEvents({ EscPos: escposDriver, Tspl: tsplDriver }, baseInput);
    expect(events[events.length - 1].stage).toBe(DiscoveryStage.UnknownProtocol);
  });

  it('emits error when every remaining candidate fails to even connect', async () => {
    connectionService.connect.mockRejectedValue(new Error('down'));
    const escposDriver = makeMockDriver();
    const tsplDriver = makeMockDriver();
    const events = await collectEvents({ EscPos: escposDriver, Tspl: tsplDriver }, baseInput);
    const last = events[events.length - 1];
    expect(last.stage).toBe(DiscoveryStage.Error);
    expect(last.error?.code).toBe(PrinterErrorCode.PRINTER_CONNECTION_FAILED);
    expect(PrinterLogger.discoveryFailed).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: 'p1', connectionType: ConnectionType.Lan, candidatesTried: [PrintLanguage.Tspl, PrintLanguage.EscPos] }),
    );
  });

  // --- Ported from services/__tests__/discoverProtocol.test.ts (pre-existing cases) ---

  it('logs discoveryStarted and discoveryCandidateRejected for the full trace of a multi-candidate attempt', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'X' }) });
    await collectEvents({ EscPos: escposDriver, Tspl: tsplDriver }, baseInput);

    expect(PrinterLogger.discoveryStarted).toHaveBeenCalledWith({
      printerId: 'p1',
      connectionType: ConnectionType.Lan,
      candidates: [PrintLanguage.Tspl, PrintLanguage.EscPos],
    });
    expect(PrinterLogger.discoveryCandidateRejected).toHaveBeenCalledWith({
      printerId: 'p1',
      protocol: PrintLanguage.Tspl,
      connectionType: ConnectionType.Lan,
      reason: 'not_confirmed',
    });
  });

  it('unsubscribing before completion stops further events from being emitted', async () => {
    let resolveConnect: () => void = () => undefined;
    connectionService.connect.mockImplementation(() => new Promise<void>((resolve) => { resolveConnect = resolve; }));
    const tsplDriver = makeMockDriver();
    const escposDriver = makeMockDriver();
    const events: DiscoveryEvent[] = [];
    const unsubscribe = createDiscoverDriver({ EscPos: escposDriver, Tspl: tsplDriver }, connectionService)(baseInput, (event) => {
      events.push(event);
    });
    unsubscribe();
    resolveConnect();
    await Promise.resolve();
    await Promise.resolve();
    expect(events.map((e) => e.stage)).toEqual([DiscoveryStage.Connecting]);
  });

  it('disconnects when cancelled right after connect() succeeds (wizard closed mid-connect)', async () => {
    let resolveConnect: () => void = () => undefined;
    connectionService.connect.mockImplementation(() => new Promise<void>((resolve) => { resolveConnect = resolve; }));
    const tsplDriver = makeMockDriver();
    const escposDriver = makeMockDriver();
    const events: DiscoveryEvent[] = [];
    const unsubscribe = createDiscoverDriver({ EscPos: escposDriver, Tspl: tsplDriver }, connectionService)(baseInput, (event) => {
      events.push(event);
    });

    unsubscribe();
    resolveConnect();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(connectionService.disconnect).toHaveBeenCalledWith('p1');
    expect(events.map((e) => e.stage)).toEqual([DiscoveryStage.Connecting]);
  });

  it('disconnects when cancelled right after identify() resolves (wizard closed mid-identify)', async () => {
    let resolveIdentify: (value: null) => void = () => undefined;
    const tsplDriver = makeMockDriver({
      identify: jest.fn().mockImplementation(() => new Promise((resolve) => { resolveIdentify = resolve; })),
    });
    const escposDriver = makeMockDriver();
    const events: DiscoveryEvent[] = [];
    const unsubscribe = createDiscoverDriver({ EscPos: escposDriver, Tspl: tsplDriver }, connectionService)(baseInput, (event) => {
      events.push(event);
    });

    await Promise.resolve();
    await Promise.resolve();
    unsubscribe();
    resolveIdentify(null);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(connectionService.disconnect).toHaveBeenCalledWith('p1');
    expect(events.map((e) => e.stage)).toEqual([DiscoveryStage.Connecting, DiscoveryStage.Identifying]);
  });

  it('logs protocolDetected when identify() succeeds', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'TM-T82' }) });
    const tsplDriver = makeMockDriver();
    await collectEvents({ EscPos: escposDriver, Tspl: tsplDriver }, baseInput);
    expect(PrinterLogger.protocolDetected).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: 'p1', protocol: PrintLanguage.EscPos, connectionType: ConnectionType.Lan }),
    );
  });

  it('logs protocolUnknown when every candidate connects but none identifies', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    await collectEvents({ EscPos: escposDriver, Tspl: tsplDriver }, baseInput);
    expect(PrinterLogger.protocolUnknown).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: 'p1', connectionType: ConnectionType.Lan }),
    );
  });
});
