import { createDiscoverProtocol, resolveCandidates, type DiscoveryEvent } from './discoverProtocol';
import type { IPrinterDriver } from '../types/driver.types';
import type { PrinterDetectionRule } from '../constants/printerDetectionRules';
import type { Protocol } from '../types/printer.types';

const makeMockDriver = (overrides: Partial<jest.Mocked<IPrinterDriver>> = {}): jest.Mocked<IPrinterDriver> => ({
  scan: jest.fn().mockReturnValue(() => undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn().mockReturnValue('connected'),
  onStatusChange: jest.fn().mockReturnValue(() => undefined),
  testPrint: jest.fn().mockResolvedValue(undefined),
  identify: jest.fn().mockResolvedValue(null),
  ...overrides,
});

const collectEvents = (
  registry: Record<Protocol, IPrinterDriver>,
  input: Parameters<ReturnType<typeof createDiscoverProtocol>>[0],
): Promise<DiscoveryEvent[]> =>
  new Promise((resolve) => {
    const events: DiscoveryEvent[] = [];
    createDiscoverProtocol(registry)(input, (event) => {
      events.push(event);
      if (event.stage === 'identified' || event.stage === 'unknown_protocol' || event.stage === 'error') {
        resolve(events);
      }
    });
  });

describe('resolveCandidates', () => {
  const rules: PrinterDetectionRule[] = [
    { vendorMatch: /epson/i, candidates: ['escpos'], confidence: 'high' },
    { vendorMatch: /.*/, candidates: ['escpos', 'tspl'], confidence: 'low' },
  ];

  it('returns the matching rule candidates when the hint matches', () => {
    expect(resolveCandidates('Epson TM-T82', rules)).toEqual(['escpos']);
  });

  it('falls back to the catch-all rule when nothing else matches', () => {
    expect(resolveCandidates('Unknown Device', rules)).toEqual(['escpos', 'tspl']);
  });

  it('falls back to the catch-all rule when there is no hint at all (LAN)', () => {
    expect(resolveCandidates(undefined, rules)).toEqual(['escpos', 'tspl']);
  });
});

describe('discoverProtocol', () => {
  const baseInput = { printerId: 'p1', connectionType: 'lan' as const, lan: { ip: '192.168.1.10', port: 9100 } };

  it('emits identified when the first candidate connects and identifies successfully', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'TM-T82' }) });
    const tsplDriver = makeMockDriver();
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);

    expect(events.map((e) => e.stage)).toEqual(['connecting', 'identifying', 'identified']);
    expect(events[2].protocol).toBe('escpos');
    expect(events[2].deviceInfo).toEqual({ deviceName: 'TM-T82' });
    expect(escposDriver.disconnect).not.toHaveBeenCalled();
    expect(tsplDriver.connect).not.toHaveBeenCalled();
  });

  it('falls through to the next candidate when the first identify() returns null', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({}) });
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);

    const identified = events.find((e) => e.stage === 'identified');
    expect(identified?.protocol).toBe('tspl');
    expect(escposDriver.disconnect).toHaveBeenCalledWith('p1');
  });

  it('emits unknown_protocol when every candidate connects but none identifies', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);

    expect(events[events.length - 1].stage).toBe('unknown_protocol');
  });

  it('emits error when every candidate fails to even connect', async () => {
    const escposDriver = makeMockDriver({ connect: jest.fn().mockRejectedValue(new Error('down')) });
    const tsplDriver = makeMockDriver({ connect: jest.fn().mockRejectedValue(new Error('down')) });
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);

    const last = events[events.length - 1];
    expect(last.stage).toBe('error');
    expect(last.error?.code).toBe('CONNECTION_ERROR');
  });

  it('emits unknown_protocol immediately for a low-confidence rule with an explicit model match, without trying any candidate', async () => {
    const escposDriver = makeMockDriver();
    const tsplDriver = makeMockDriver();
    const dualModeInput = {
      printerId: 'p1',
      connectionType: 'bluetooth' as const,
      device: { deviceId: 'AA:BB', displayName: 'Xprinter XP-365B', rawDevice: {} },
    };
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, dualModeInput);

    expect(events).toEqual([{ stage: 'unknown_protocol' }]);
    expect(escposDriver.connect).not.toHaveBeenCalled();
    expect(tsplDriver.connect).not.toHaveBeenCalled();
  });

  it('does not short-circuit the catch-all fallback rule (no modelMatch) even though its confidence is also low', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'X' }) });
    const tsplDriver = makeMockDriver();
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);

    expect(events.map((e) => e.stage)).toEqual(['connecting', 'identifying', 'identified']);
  });

  it('unsubscribing before completion stops further events from being emitted', async () => {
    let resolveConnect: () => void = () => undefined;
    const escposDriver = makeMockDriver({
      connect: jest.fn().mockImplementation(() => new Promise<void>((resolve) => { resolveConnect = resolve; })),
    });
    const tsplDriver = makeMockDriver();
    const events: DiscoveryEvent[] = [];
    const unsubscribe = createDiscoverProtocol({ escpos: escposDriver, tspl: tsplDriver })(baseInput, (event) => {
      events.push(event);
    });
    unsubscribe();
    resolveConnect();
    await Promise.resolve();
    await Promise.resolve();
    expect(events.map((e) => e.stage)).toEqual(['connecting']);
  });
});
