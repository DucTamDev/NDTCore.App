import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  PrinterDpi,
  PrinterKind,
  printService,
  type PrintRenderContext,
  renderWithContext,
  usePrintRenderContext,
} from '@ndtcore/printer';

/** Context hoá đơn 80 mm, 1 dot chuẩn = 1 dp. */
const context: PrintRenderContext = {
  kind: PrinterKind.Receipt,
  widthMm: 80,
  dpi: PrinterDpi.Dpi203,
  toDp: (dots) => dots,
};

/** Đọc toDp(8) từ context của package. */
function Probe() {
  return <Text>{usePrintRenderContext().toDp(8)}</Text>;
}

describe('package máy in trong App', () => {
  it('smoke: hook của package chạy trong cây React của App', () => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(renderWithContext(() => <Probe />, context));
    });

    expect(tree!.root.findByType(Text).props.children).toBe(context.toDp(8));
  });

  it('smoke: PrinterKind và printService có từ package', () => {
    expect(PrinterKind.Label).toBe('Label');
    expect(typeof printService.printAsync).toBe('function');
  });
});
