import { NodeBuilder } from '../NodeBuilder';
import type { BuildContext } from '../BuildContext';
import { TemplateNodeIdGenerator } from '../BuildContext';
import type { LineNode } from '../../nodes/LineNode';
import { fixed } from '../dimensions';
import { exists } from '../conditions';

class TestLineBuilder extends NodeBuilder<LineNode> {
  build(context: BuildContext): LineNode {
    return {
      type: 'line',
      id: this.nodeId ?? context.idGenerator.next('line'),
      style: this.boxStyle,
      ...(this.visibility ? { visibleWhen: this.visibility } : {}),
    };
  }
}

describe('NodeBuilder', () => {
  it('chains width/height/margin/padding into boxStyle', () => {
    const builder = new TestLineBuilder().width(fixed(100)).height(fixed(2)).margin({ top: 1, right: 1, bottom: 1, left: 1 });
    const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };
    const node = builder.build(context);
    expect(node.style).toEqual({ width: { type: 'fixed', value: 100 }, height: { type: 'fixed', value: 2 }, margin: { top: 1, right: 1, bottom: 1, left: 1 } });
  });

  it('applies visibleWhen only when set', () => {
    const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };
    const withCondition = new TestLineBuilder().visibleWhen(exists('discount')).build(context);
    const withoutCondition = new TestLineBuilder().build(context);
    expect(withCondition.visibleWhen).toEqual({ type: 'exists', binding: 'discount' });
    expect(withoutCondition.visibleWhen).toBeUndefined();
  });

  it('uses explicit .id() over the generated one', () => {
    const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };
    const node = new TestLineBuilder().id('my-line').build(context);
    expect(node.id).toBe('my-line');
  });

  it('generates sequential ids from a shared context', () => {
    const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };
    const first = new TestLineBuilder().build(context);
    const second = new TestLineBuilder().build(context);
    expect(first.id).toBe('line-1');
    expect(second.id).toBe('line-2');
  });
});
