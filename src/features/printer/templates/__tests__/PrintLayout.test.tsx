import React from 'react';
import { Text, View } from 'react-native';
import { renderTemplate } from '../__testing__/renderTemplate';
import { PrintDivider, PrintText } from '../PrintLayout';

/** Style gộp của một phần tử. */
const styleOf = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...[style].flat(Infinity).filter(Boolean)) as Record<string, unknown>;

describe('PrintLayout', () => {
  it('PrintText: cỡ chữ và line-height qua toDp', () => {
    const renderer = renderTemplate(<PrintText size={27}>Xin chào</PrintText>);
    const style = styleOf(renderer.root.findByType(Text).props.style);
    expect(style.fontSize).toBe(13.5);
    expect(style.lineHeight).toBe(Math.round(27 * 1.3) / 2);
  });

  it('PrintDivider: nét liền dày 2 dot qua toDp', () => {
    const renderer = renderTemplate(<PrintDivider />);
    expect(styleOf(renderer.root.findAllByType(View)[0]!.props.style).height).toBe(1);
  });
});
