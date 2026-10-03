import { Buffer } from 'buffer';
import { Platform } from 'react-native';
import { EscPosDriver } from '../escpos/EscPosDriver';
import { TsplDriver } from '../tspl/TsplDriver';
import { PrintLanguage } from '../../models/printer/PrinterLanguage';
import { ENCODE_CASES, fingerprintOf } from '../../testing/encodeCases';

jest.mock('../../logging/PrinterLogger', () => ({
  PrinterLogger: new Proxy({}, { get: () => jest.fn() }),
}));

type WriteMock = jest.Mock<Promise<void>, [string, string, number]>;

const { DeviceModule } = jest.requireMock('../../adapters/native/DeviceModule') as {
  DeviceModule: { write: WriteMock };
};

/** Gộp mọi lần ghi native thành một dãy byte để so với dấu vân tay. */
const writtenBytes = (): Uint8Array =>
  new Uint8Array(Buffer.concat(DeviceModule.write.mock.calls.map(([, base64]) => Buffer.from(base64, 'base64'))));

// Nhánh iOS của ESC/POS gọi module in cũ; ép Android để đi đúng đường native.
const originalPlatformOS = Platform.OS;

beforeAll(() => {
  Platform.OS = 'android';
});

afterAll(() => {
  Platform.OS = originalPlatformOS;
});

describe('byte driver gửi tới máy in', () => {
  afterEach(() => jest.clearAllMocks());

  it.each(ENCODE_CASES.map((encodeCase) => [encodeCase.name, encodeCase] as const))('%s', async (_name, encodeCase) => {
    const driver = encodeCase.printer.language.type === PrintLanguage.EscPos ? new EscPosDriver() : new TsplDriver();

    await driver.testPrint(encodeCase.printer, encodeCase.documents, encodeCase.options);

    expect(fingerprintOf(writtenBytes())).toBe(encodeCase.fingerprint);
  });
});
