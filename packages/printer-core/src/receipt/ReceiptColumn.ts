/**
 * Column definition for table layout
 */
export interface ReceiptColumn {
  /**
   * Column width in characters
   */
  width: number;
  /**
   * Text alignment within column
   */
  align?: "left" | "center" | "right";
}
