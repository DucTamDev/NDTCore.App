import { line, mm } from '..';
import { TemplateNodeIdGenerator, type BuildContext } from '../BuildContext';

function newContext(): BuildContext {
  return { idGenerator: new TemplateNodeIdGenerator() };
}

describe('line', () => {
  it('độ dày + nét đứt', () => {
    expect(line().thickness(mm(0.3)).dashed().build(newContext())).toEqual({
      type: 'line',
      id: 'line-1',
      thickness: mm(0.3),
      pattern: 'dashed',
    });
  });

  it('mặc định không có field thừa', () => {
    expect(line().build(newContext())).toEqual({ type: 'line', id: 'line-1' });
  });
});
