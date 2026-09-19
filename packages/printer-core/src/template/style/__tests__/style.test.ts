import type { Dimension } from '../Dimension';
import type { Insets } from '../Insets';
import type { BoxStyle } from '../BoxStyle';
import type { LayoutStyle } from '../LayoutStyle';
import type { TextStyle } from '../TextStyle';
import type { VisibilityCondition } from '../VisibilityCondition';
import type { LayoutConfig } from '../../../layout/LayoutConfig';

describe('style primitives', () => {
  it('Dimension accepts fixed/fill/auto', () => {
    const values: Dimension[] = [{ type: 'fixed', value: 120 }, { type: 'fill' }, { type: 'auto' }];
    expect(values).toHaveLength(3);
  });

  it('LayoutStyle extends BoxStyle with container-only fields', () => {
    const style: LayoutStyle = {
      width: { type: 'fill' },
      padding: { top: 8, right: 8, bottom: 8, left: 8 },
      direction: 'column',
      gap: 4,
      justifyContent: 'space-between',
      alignItems: 'center',
    };
    const box: BoxStyle = style; // must be assignable
    expect(box.width).toEqual({ type: 'fill' });
  });

  it('TextStyle has font fields only', () => {
    const style: TextStyle = { fontSize: 24, fontWeight: 'bold', lineHeight: 28, textAlign: 'center' };
    expect(style.fontWeight).toBe('bold');
  });

  it('VisibilityCondition is a closed union', () => {
    const a: VisibilityCondition = { type: 'exists', binding: 'discount' };
    const b: VisibilityCondition = { type: 'equals', binding: 'status', value: 'paid' };
    expect(a.type).toBe('exists');
    expect(b.type).toBe('equals');
  });

  it('LayoutConfig requires widthDots/dpi, heightDots optional', () => {
    const label: LayoutConfig = { widthDots: 400, heightDots: 240, dpi: 203 };
    const receipt: Omit<LayoutConfig, 'heightDots'> = { widthDots: 576, dpi: 203 };
    expect(label.heightDots).toBe(240);
    expect(receipt.widthDots).toBe(576);
  });

  it('Insets has all four sides required', () => {
    const insets: Insets = { top: 1, right: 2, bottom: 3, left: 4 };
    expect(insets.left).toBe(4);
  });
});
