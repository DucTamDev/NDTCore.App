import { markup } from '../MarkupBuilder';

describe('markup', () => {
  it('parses a <label> root with a <text> child into a resolved document', () => {
    const doc = markup(`
      <label width="40mm" height="30mm">
        <text x="10" y="10" size="2" bold>Hello World</text>
      </label>
    `).resolve();
    expect(doc.elements).toHaveLength(1);
    expect(doc.elements[0]).toMatchObject({ type: 'text', content: 'Hello World' });
  });

  it('throws when there is no <label> root element', () => {
    expect(() => markup('<text>oops</text>')).toThrow();
  });
});
