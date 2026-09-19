import type { VisibilityCondition } from '../style/VisibilityCondition';

export function exists(binding: string): VisibilityCondition { return { type: 'exists', binding }; }
export function equals(binding: string, value: unknown): VisibilityCondition { return { type: 'equals', binding, value }; }
