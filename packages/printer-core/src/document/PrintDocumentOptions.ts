import type { Unit, Direction } from '../types';

export interface PrintDocumentOptions {
  unit?: Unit;
  dpi?: number;
  gap?: number;
  speed?: number;
  density?: number;
  direction?: Direction;
  copies?: number;
  printer?: string;
}
