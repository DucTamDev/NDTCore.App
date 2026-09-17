import { DefaultLabelTemplate, DefaultReceiptTemplate, applyLabelTemplate, applyReceiptTemplate } from '../../index';

describe('templates barrel', () => {
  it('re-exports both default templates and both apply helpers through the package root', () => {
    expect(DefaultLabelTemplate).toBeDefined();
    expect(DefaultReceiptTemplate).toBeDefined();
    expect(typeof applyLabelTemplate).toBe('function');
    expect(typeof applyReceiptTemplate).toBe('function');
  });
});
