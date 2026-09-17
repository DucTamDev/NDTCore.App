import type { LabelTemplate } from './LabelTemplate';
import type { ReceiptTemplate } from './ReceiptTemplate';

/**
 * A real union, not a base interface `LabelTemplate`/`ReceiptTemplate`
 * extend — narrowing on `type` (e.g. `if (t.type === 'receipt')`) only
 * works when the two variants are alternatives of a union, not subtypes of
 * a shared parent interface.
 */
export type PrintTemplate = LabelTemplate | ReceiptTemplate;
