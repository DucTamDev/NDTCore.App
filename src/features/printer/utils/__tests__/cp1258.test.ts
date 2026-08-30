import { encodeCp1258 } from '../cp1258';

describe('encodeCp1258', () => {
  it('giữ nguyên ASCII', () => {
    expect(encodeCp1258('Ban 3 - Hoa don')).toEqual(Array.from('Ban 3 - Hoa don').map((c) => c.charCodeAt(0)));
  });

  it('ký tự có dấu mũ/breve/móc dùng slot 1 byte của CP1258', () => {
    expect(encodeCp1258('â')).toEqual([0xe2]);
    expect(encodeCp1258('ă')).toEqual([0xe3]);
    expect(encodeCp1258('ê')).toEqual([0xea]);
    expect(encodeCp1258('ô')).toEqual([0xf4]);
    expect(encodeCp1258('ơ')).toEqual([0xf5]);
    expect(encodeCp1258('ư')).toEqual([0xfd]);
    expect(encodeCp1258('đ')).toEqual([0xf0]);
    expect(encodeCp1258('Đ')).toEqual([0xd0]);
  });

  it('grave/acute có slot 1 byte (kế thừa 1252) → giữ nguyên 1 byte', () => {
    expect(encodeCp1258('à')).toEqual([0xe0]);
    expect(encodeCp1258('á')).toEqual([0xe1]);
    expect(encodeCp1258('è')).toEqual([0xe8]);
    expect(encodeCp1258('é')).toEqual([0xe9]);
    expect(encodeCp1258('ù')).toEqual([0xf9]);
  });

  it('các tổ hợp CP1258 không có sẵn 1 byte → byte nền + byte thanh tổ hợp', () => {
    // ì: slot 0xEC bị CP1258 đổi thành "combining acute" → phải tách
    expect(encodeCp1258('ì')).toEqual([0x69, 0xcc]);
    // ò: slot 0xF2 bị đổi thành "combining dot below" → phải tách
    expect(encodeCp1258('ò')).toEqual([0x6f, 0xcc]);
    // ạ = a + combining dot below
    expect(encodeCp1258('ạ')).toEqual([0x61, 0xf2]);
    // ệ = ê (0xEA) + combining dot below (0xF2)
    expect(encodeCp1258('ệ')).toEqual([0xea, 0xf2]);
    // ữ = ư (0xFD) + combining tilde (0xDE)
    expect(encodeCp1258('ữ')).toEqual([0xfd, 0xde]);
    // ớ = ơ (0xF5) + combining acute (0xEC)
    expect(encodeCp1258('ớ')).toEqual([0xf5, 0xec]);
    // ã = a + combining tilde
    expect(encodeCp1258('ã')).toEqual([0x61, 0xde]);
  });

  it('mã hoá 1 câu tiếng Việt đầy đủ dấu', () => {
    // T r à(0xE0) ' ' s ữ(0xFD,0xDE) a
    expect(encodeCp1258('Trà sữa')).toEqual([0x54, 0x72, 0xe0, 0x20, 0x73, 0xfd, 0xde, 0x61]);
  });

  it('ký tự ngoài dải hỗ trợ → "?" (0x3f)', () => {
    expect(encodeCp1258('₫')).toEqual([0x3f]);
    expect(encodeCp1258('😀')).toEqual([0x3f]);
  });
});
