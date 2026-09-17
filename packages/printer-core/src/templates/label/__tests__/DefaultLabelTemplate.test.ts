import { DefaultLabelTemplate } from '../DefaultLabelTemplate';
import { applyLabelTemplate } from '../../applyTemplate';

describe('DefaultLabelTemplate', () => {
  it('has a 40x30mm 203dpi config and no prefilled elements', () => {
    expect(DefaultLabelTemplate.config).toEqual({ width: 40, height: 30, unit: 'mm', dpi: 203 });
    expect(DefaultLabelTemplate.elements).toEqual([]);
  });

  it('applies to a resolvable blank label', () => {
    const doc = applyLabelTemplate(DefaultLabelTemplate).resolve();
    expect(doc.elements).toEqual([]);
    expect(doc.widthDots).toBeGreaterThan(0);
  });
});
