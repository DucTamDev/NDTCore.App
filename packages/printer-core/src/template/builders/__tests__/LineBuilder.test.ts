import { line } from '../LineBuilder';
import { BuildContext } from '../BuildContext';
import { TemplateNodeIdGenerator } from '../BuildContext';

describe('LineBuilder', () => {
  it('line() builds a LineNode with default thickness undefined', () => {
    const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };
    const node = line().build(context);
    expect(node.type).toBe('line');
    expect(node.thickness).toBeUndefined();
  });

  it('thickness(value) sets thickness', () => {
    const context: BuildContext = { idGenerator: new TemplateNodeIdGenerator() };
    const node = line().thickness(2).build(context);
    expect(node.thickness).toBe(2);
  });
});
