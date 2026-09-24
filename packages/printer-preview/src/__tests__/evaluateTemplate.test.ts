import { describe, it, expect } from 'vitest';
import { evaluateTemplate } from '../evaluateTemplate';

const CATALOG_CODE = `
  import { defineCatalog, defineCollection } from 'printer-core';

  const items = defineCollection({
    label: 'Món',
    get: (data: { readonly items: readonly { readonly name: string }[] }) => data.items,
    variables: { itemName: { label: 'Tên món', type: 'string', get: (item) => item.name } },
  });

  export const catalog = defineCatalog({
    id: 'demo',
    version: 1,
    sample: { title: 'Xin chào', items: [{ name: 'A' }] },
    variables: { title: { label: 'Tiêu đề', type: 'string', get: (data) => data.title } },
    collections: { items },
  });
`;

describe('evaluateTemplate', () => {
  it('trả template + catalog khi code export đúng', () => {
    const code = `${CATALOG_CODE}
      import { labelTemplate, text } from 'printer-core';
      export default labelTemplate(catalog)
        .id('label')
        .name('Tem')
        .paper({ widthMm: 50, heightMm: 30 })
        .root((scope) => text([scope.var('title')]))
        .build();
    `;
    const result = evaluateTemplate(code);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.template.media).toBe('label');
    expect(result.template.paper).toEqual({ widthMm: 50, heightMm: 30 });
    expect(result.catalog.id).toBe('demo');
  });

  it('báo lỗi transpile khi cú pháp TypeScript sai', () => {
    const result = evaluateTemplate('export default labelTemplate(');

    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.stage).toBe('transpile');
  });

  it('báo lỗi runtime khi thiếu export catalog', () => {
    const result = evaluateTemplate('export default { notATemplate: true };');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.stage).toBe('runtime');
      expect(result.message).toContain('export const catalog');
    }
  });

  it('báo lỗi runtime kèm vị trí khi default export không phải TemplateDocument', () => {
    const result = evaluateTemplate(`${CATALOG_CODE}\nexport default { notATemplate: true };`);

    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.message).toContain('schemaVersion');
  });

  it('báo lỗi build khi template dùng biến sai scope', () => {
    const code = `${CATALOG_CODE}
      import { labelTemplate, text } from 'printer-core';
      export default labelTemplate(catalog)
        .id('label')
        .name('Tem')
        .paper({ widthMm: 50, heightMm: 30 })
        .root(text([{ var: 'itemName' }]))
        .build();
    `;
    const result = evaluateTemplate(code);

    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.message).toContain('chỉ dùng được trong vòng lặp "Món"');
  });

  it('báo lỗi khi code throw', () => {
    const result = evaluateTemplate(`throw new Error('boom');`);

    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.message).toContain('boom');
  });

  it('chặn require() module khác "printer-core"', () => {
    const result = evaluateTemplate(`const fs = require('fs'); export default fs;`);

    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.message).toContain('Cannot require');
  });
});
