import type { ResolvedContainer, ResolvedText } from '../ResolvedNode';
import type { ResolvedPage } from '../ResolvedPage';
import type { PrintData } from '../PrintData';

describe('ResolvedNode', () => {
  it("ResolvedText carries a resolved `value`, not `text`/`binding`", () => {
    const node: ResolvedText = { type: 'text', id: 't1', value: 'Milk Tea' };
    expect(node.value).toBe('Milk Tea');
  });

  it('ResolvedContainer nests ResolvedNode children', () => {
    const tree: ResolvedContainer = {
      type: 'container',
      id: 'root',
      children: [{ type: 'text', id: 't1', value: 'A' }],
    };
    expect(tree.children).toHaveLength(1);
  });

  it("ResolvedPage discriminates ok/error by `status`", () => {
    const ok: ResolvedPage = { status: 'ok', pageIndex: 0, node: { type: 'text', id: 't1', value: 'A' } };
    const error: ResolvedPage = { status: 'error', pageIndex: 1, nodeId: 't2', message: 'missing binding' };
    expect(ok.status).toBe('ok');
    expect(error.status).toBe('error');
  });

  it('PrintData is a readonly record', () => {
    const data: PrintData = { product: { name: 'Milk Tea' } };
    expect(data.product).toEqual({ name: 'Milk Tea' });
  });
});
