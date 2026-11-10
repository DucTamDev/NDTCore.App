import type { ReactElement } from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { PrinterDpi, PrinterKind, renderWithContext } from '@ndtcore/printer';

/** Mặc định 1 dot chuẩn = 0,5 dp, để test thấy rõ mọi kích thước đều qua toDp. */
const HALF = (dots: number): number => dots / 2;

/** Dựng mẫu in trong context của package như khi package chụp; toDp tuỳ chọn để thử phép đổi. */
export function renderTemplate(element: ReactElement, toDp: (dots: number) => number = HALF): ReactTestRenderer {
  const context = { kind: PrinterKind.Receipt, widthMm: 80, dpi: PrinterDpi.Dpi203, toDp };
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(renderWithContext(() => element, context));
  });
  return renderer as ReactTestRenderer;
}

/** Không đổi đơn vị: 1 dot chuẩn = 1 dp, để so số dot trực tiếp. */
export const IDENTITY = (dots: number): number => dots;
