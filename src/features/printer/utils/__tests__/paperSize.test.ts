import { PAPER_WIDTH_CHARS, PAPER_IMAGE_WIDTH_PX } from '../paperSize';

describe('PAPER_WIDTH_CHARS', () => {
  it('maps 58mm to 32 characters', () => {
    expect(PAPER_WIDTH_CHARS[58]).toBe(32);
  });

  it('maps 80mm to 48 characters', () => {
    expect(PAPER_WIDTH_CHARS[80]).toBe(48);
  });
});

describe('PAPER_IMAGE_WIDTH_PX', () => {
  it('maps 58mm to 384px and 80mm to 576px', () => {
    expect(PAPER_IMAGE_WIDTH_PX[58]).toBe(384);
    expect(PAPER_IMAGE_WIDTH_PX[80]).toBe(576);
  });
});
