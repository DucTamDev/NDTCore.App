import { labelTemplate } from '../LabelTemplateBuilder';
import { column } from '../ContainerBuilder';
import { text } from '../TextBuilder';
import { PrintTemplateType } from '../../PrintTemplateType';

describe('labelTemplate()', () => {
  it('builds a frozen LabelTemplate with sequential ids', () => {
    const t = labelTemplate()
      .size({ widthDots: 400, heightDots: 240, dpi: 203 })
      .root(column().children(text.literal('Hello')))
      .build();

    expect(t.type).toBe(PrintTemplateType.Label);
    expect(t.config).toEqual({ widthDots: 400, heightDots: 240, dpi: 203 });
    expect(t.root).toMatchObject({ type: 'container', children: [{ type: 'text', text: 'Hello' }] });
    expect(Object.isFrozen(t)).toBe(true);
  });

  it('throws when .size(...) is missing', () => {
    expect(() => labelTemplate().root(text.literal('X')).build()).toThrow(/requires \.size/);
  });

  it('throws when .root(...) is missing', () => {
    expect(() => labelTemplate().size({ widthDots: 1, heightDots: 1, dpi: 1 }).build()).toThrow(/requires \.root/);
  });
});
