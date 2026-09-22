import { describe, it, expect } from 'vitest';
import { labelTemplate, receiptTemplate, column, text, repeat } from 'printer-core';
import { renderPreviews, defaultLanguageFor } from '../pipeline';

describe('renderPreviews', () => {
  it('renders a single-page SVG for a simple label', () => {
    const template = labelTemplate()
      .size({ widthDots: 400, heightDots: 240, dpi: 203 })
      .root(column().children(text.binding('name')))
      .build();
    const previews = renderPreviews(template, { name: 'Hello' }, 'tspl');
    expect(previews).toHaveLength(1);
    expect(previews[0].status).toBe('ok');
    if (previews[0].status === 'ok') expect(previews[0].svg).toContain('<svg');
  });

  it('isolates a per-page resolve error without affecting other pages', () => {
    const template = labelTemplate()
      .size({ widthDots: 400, heightDots: 240, dpi: 203 })
      .root(repeat('items').maxItemsPerPage(1).template(column().children(text.binding('name'))))
      .build();
    const previews = renderPreviews(template, { items: [{ name: 'A' }, {}, { name: 'C' }] }, 'tspl');
    expect(previews).toHaveLength(3);
    expect(previews[0].status).toBe('ok');
    expect(previews[1].status).toBe('error');
    expect(previews[2].status).toBe('ok');
  });

  it('defaultLanguageFor picks escpos for receipts, tspl for labels', () => {
    const label = labelTemplate().size({ widthDots: 1, heightDots: 1, dpi: 1 }).root(text.literal('x')).build();
    const receipt = receiptTemplate().size({ widthDots: 1, dpi: 1 }).root(text.literal('x')).build();
    expect(defaultLanguageFor(label)).toBe('tspl');
    expect(defaultLanguageFor(receipt)).toBe('escpos');
  });
});
