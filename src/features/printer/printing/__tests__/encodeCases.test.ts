import { Buffer } from 'buffer';
import { PrinterService } from '../PrinterService';
import { ENCODE_CASES, fingerprintOf } from '../../testing/encodeCases';

jest.mock('../../logging/PrinterLogger', () => ({
  printerLogger: new Proxy({}, { get: () => jest.fn() }),
}));

type WriteMock = jest.Mock<Promise<void>, [string, string, number]>;

const { DeviceModule } = jest.requireMock('../../adapters/native/DeviceModule') as {
  DeviceModule: { write: WriteMock };
};

/** Gộp mọi lần ghi native thành một dãy byte để so với dấu vân tay. */
const writtenBytes = (): Uint8Array =>
  new Uint8Array(Buffer.concat(DeviceModule.write.mock.calls.map(([, base64]) => Buffer.from(base64, 'base64'))));

describe('byte in thử gửi tới máy in', () => {
  afterEach(() => jest.clearAllMocks());

  it.each(ENCODE_CASES.map((encodeCase) => [encodeCase.name, encodeCase] as const))('%s', async (_name, encodeCase) => {
    await new PrinterService().testPrint(encodeCase.printer, encodeCase.image, encodeCase.options);

    expect(fingerprintOf(writtenBytes())).toBe(encodeCase.fingerprint);
  });
});
