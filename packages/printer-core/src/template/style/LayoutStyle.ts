import type { BoxStyle } from './BoxStyle';

export interface LayoutStyle extends BoxStyle {
  readonly direction?: 'row' | 'column';
  readonly gap?: number;
  readonly justifyContent?: 'start' | 'center' | 'end' | 'space-between';
  readonly alignItems?: 'start' | 'center' | 'end';
}
