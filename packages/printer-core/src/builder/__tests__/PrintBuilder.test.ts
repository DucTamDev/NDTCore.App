import { LabelBuilder } from '../LabelBuilder';

describe('PrintBuilder.append', () => {
  it('pushes every element from the array, in order', () => {
    const doc = new LabelBuilder({ width: 40, height: 30 })
      .append([
        { type: 'text', content: 'a', options: {} },
        { type: 'text', content: 'b', options: {} },
      ])
      .resolve();
    expect(doc.elements.map((e) => (e.type === 'text' ? e.content : undefined))).toEqual(['a', 'b']);
  });

  it('is chainable with other builder methods', () => {
    const doc = new LabelBuilder({ width: 40, height: 30 })
      .text('first', {})
      .append([{ type: 'text', content: 'second', options: {} }])
      .resolve();
    expect(doc.elements).toHaveLength(2);
  });
});
