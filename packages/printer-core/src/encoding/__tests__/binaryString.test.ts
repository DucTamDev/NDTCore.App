import { binaryStringToBytes } from '../binaryStringToBytes';
import { bytesToBinaryString } from '../bytesToBinaryString';

describe('binaryStringToBytes', () => {
  it('đổi mỗi ký tự thành đúng 1 byte, kể cả byte >= 0x80', () => {
    const bytes = binaryStringToBytes('\x1b\x40\x80\xe1\xff');

    expect(Array.from(bytes)).toEqual([0x1b, 0x40, 0x80, 0xe1, 0xff]);
  });

  it('chỉ giữ 8 bit thấp khi ký tự vượt quá 1 byte', () => {
    expect(Array.from(binaryStringToBytes('Ł'))).toEqual([0x41]);
  });
});

describe('bytesToBinaryString', () => {
  it('đổi mỗi byte thành đúng 1 ký tự, kể cả byte >= 0x80', () => {
    const binary = bytesToBinaryString(new Uint8Array([0x1b, 0x40, 0x80, 0xe1, 0xff]));

    expect(binary).toBe('\x1b\x40\x80\xe1\xff');
  });

  it('là nghịch đảo của binaryStringToBytes', () => {
    const bytes = new Uint8Array(Array.from({ length: 256 }, (_, value) => value));

    expect(Array.from(binaryStringToBytes(bytesToBinaryString(bytes)))).toEqual(Array.from(bytes));
  });
});
