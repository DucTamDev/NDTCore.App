/**
 * Marker options for a page break — net-new, no portakal equivalent.
 * Carries no configuration, only a position in the element list.
 */
export type PageBreakOptions = Record<string, never>;

/** A page-break marker — carries no configuration, only a position in the element list. */
export interface PageBreakElement {
  type: 'pageBreak';
}
