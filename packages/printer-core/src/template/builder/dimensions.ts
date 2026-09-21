import type { Dimension } from '../style/Dimension';

export function fixed(value: number): Dimension { return { type: 'fixed', value }; }
export function fill(): Dimension { return { type: 'fill' }; }
export function auto(): Dimension { return { type: 'auto' }; }
