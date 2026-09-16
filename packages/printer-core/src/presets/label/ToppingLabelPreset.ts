import type { PrintElement } from '../../builder';
import type { LabelPreset } from '../LabelPreset';

export interface ToppingLabelVars {
  toppingName: string;
  drinkName?: string;
  sweetness?: string;
  ice?: string;
  note?: string;
}

function sweetnessIceLine(vars: Pick<ToppingLabelVars, 'sweetness' | 'ice'>): string | undefined {
  const parts: string[] = [];
  if (vars.sweetness) parts.push(`Ngọt: ${vars.sweetness}`);
  if (vars.ice) parts.push(`Đá: ${vars.ice}`);
  return parts.length > 0 ? parts.join(' | ') : undefined;
}

/**
 * 40x30mm topping label — same paper as `ProductLabelPreset`, different
 * layout: topping name, optional drink name, optional sweetness/ice line,
 * optional note. Dot positions are a reasonable starting layout, not yet
 * verified against real hardware.
 */
export const ToppingLabelPreset: LabelPreset<ToppingLabelVars> = {
  config: { width: 40, height: 30, unit: 'mm', dpi: 203 },
  build: (vars) => {
    const elements: PrintElement[] = [
      { type: 'text', content: vars.toppingName, options: { x: 8, y: 8, bold: true, size: 2 } },
    ];
    if (vars.drinkName) elements.push({ type: 'text', content: vars.drinkName, options: { x: 8, y: 40 } });
    const line = sweetnessIceLine(vars);
    if (line) elements.push({ type: 'text', content: line, options: { x: 8, y: 70 } });
    if (vars.note) elements.push({ type: 'text', content: vars.note, options: { x: 8, y: 100 } });
    return elements;
  },
};
