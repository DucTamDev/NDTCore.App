import type { Direction } from '../types';
import type { PrintElement } from './PrintElement';

export interface ResolvedPrintDocument {
  widthDots: number;
  heightDots: number;
  dpi: number;
  gapDots: number;
  speed: number;
  density: number;
  direction: Direction;
  copies: number;
  elements: PrintElement[];
}
