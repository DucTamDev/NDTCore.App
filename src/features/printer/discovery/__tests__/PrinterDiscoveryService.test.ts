import { createDiscoverDriver, type DiscoveryEvent } from '../PrinterDiscoveryService';
import type { IPrinterDriver } from '../../types/driver.types';
import type { PrinterDriverType } from '../../types/printer.types';
import { PrinterLogger } from '../../services/PrinterLogger';

jest.mock('../../services/PrinterLogger', () => ({
  PrinterLogger: {
    discoveryStarted: jest.fn(), discoveryCandidateRejected: jest.fn(), discoveryFailed: jest.fn(),
    protocolDetected: jest.fn(), protocolUnknown: jest.fn(),
  },
}));

const makeMockDriver = (overrides: Partial<jest.Mocked<IPrinterDriver>> = {}): jest.Mocked<IPrinterDriver> => ({
  scan: jest.fn().mockReturnValue(() => undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn().mockReturnValue('connected'),
  onStatusChange: jest.fn().mockReturnValue(() => undefined),
  testPrint: jest.fn().mockResolvedValue(undefined),
  print: jest.fn().mockResolvedValue(undefined),
  identify: jest.fn().mockResolvedValue(null),
  encode: jest.fn().mockReturnValue(new Uint8Array()),
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
      if (event.stage === 'identified' || event.stage === 'unknown_protocol' || event.stage === 'error') resolve(events);
    });
  });

describe('PrinterDiscoveryService', () => {
  const baseInput = { printerId: 'p1', connectionType: 'lan' as const, lan: { ip: '192.168.1.10', port: 9100 } };

  afterEach(() => jest.clearAllMocks());

  it('emits identified when the first candidate connects and identifies successfully', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'TSC TE244' }) });
    const escposDriver = makeMockDriver();
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);
    expect(events.map((e) => e.stage)).toEqual(['connecting', 'identifying', 'identified']);
    expect(events[2].protocol).toBe('tspl');
  });

  it('excludedDrivers removes a driver type from the candidate list even if it would have identified', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'TSC TE244' }) });
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'X' }) });
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, { ...baseInput, excludedDrivers: ['tspl'] });
    const identified = events.find((e) => e.stage === 'identified');
    expect(identified?.protocol).toBe('escpos');
    expect(tsplDriver.connect).not.toHaveBeenCalled();
  });

  it('emits error (not unknown_protocol) when excludedDrivers removes every candidate', async () => {
    const events = await collectEvents(
      { escpos: makeMockDriver(), tspl: makeMockDriver() },
      { ...baseInput, excludedDrivers: ['escpos', 'tspl'] },
    );
    expect(events[events.length - 1].stage).toBe('error');
  });

  it('falls through to the next candidate when the first identify() returns null', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({}) });
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);
    expect(events.find((e) => e.stage === 'identified')?.protocol).toBe('escpos');
  });

  it('emits unknown_protocol when every remaining candidate connects but none identifies', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);
    expect(events[events.length - 1].stage).toBe('unknown_protocol');
  });

  it('emits error when every remaining candidate fails to even connect', async () => {
    const escposDriver = makeMockDriver({ connect: jest.fn().mockRejectedValue(new Error('down')) });
    const tsplDriver = makeMockDriver({ connect: jest.fn().mockRejectedValue(new Error('down')) });
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);
    expect(events[events.length - 1].stage).toBe('error');
  });

  // --- Ported from services/__tests__/discoverProtocol.test.ts (pre-existing cases) ---

  it('logs discoveryStarted and discoveryCandidateRejected for the full trace of a multi-candidate attempt', async () => {
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'X' }) });
    await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);

    expect(PrinterLogger.discoveryStarted).toHaveBeenCalledWith({
      printerId: 'p1',
      connectionType: 'lan',
      candidates: ['tspl', 'escpos'],
    });
    expect(PrinterLogger.discoveryCandidateRejected).toHaveBeenCalledWith({
      printerId: 'p1',
      protocol: 'tspl',
      connectionType: 'lan',
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
    expect(events.map((e) => e.stage)).toEqual(['connecting']);
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
    expect(events.map((e) => e.stage)).toEqual(['connecting']);
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
    expect(events.map((e) => e.stage)).toEqual(['connecting', 'identifying']);
  });

  it('logs protocolDetected when identify() succeeds', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'TM-T82' }) });
    const tsplDriver = makeMockDriver();
    await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);
    expect(PrinterLogger.protocolDetected).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: 'p1', protocol: 'escpos', connectionType: 'lan' }),
    );
  });

  it('logs protocolUnknown when every candidate connects but none identifies', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);
    expect(PrinterLogger.protocolUnknown).toHaveBeenCalledWith(
      expect.objectContaining({ printerId: 'p1', connectionType: 'lan' }),
    );
  });
});
