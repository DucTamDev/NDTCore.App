import { describe, it, expect } from 'vitest';
import { evaluateTemplate } from '../evaluateTemplate';

describe('evaluateTemplate', () => {
  it('evaluates valid code into a PrintTemplate', () => {
    const code = `
      import { labelTemplate, column, text } from 'printer-core';
      export default labelTemplate()
        .size({ widthDots: 400, heightDots: 240, dpi: 203 })
        .root(column().children(text.literal('Hello')))
        .build();
    `;
    const result = evaluateTemplate(code);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.template.type).toBe('label');
      expect(result.template.config).toEqual({ widthDots: 400, heightDots: 240, dpi: 203 });
    }
  });

  it('returns a transpile-stage error for invalid TypeScript syntax', () => {
    const code = `export default labelTemplate(`; // unbalanced parens
    const result = evaluateTemplate(code);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.stage).toBe('transpile');
  });

  it('returns a runtime-stage error when the code does not export a valid PrintTemplate', () => {
    const code = `export default { notATemplate: true };`;
    const result = evaluateTemplate(code);
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.stage).toBe('runtime');
      expect(result.message).toContain('PrintTemplate');
    }
  });

  it('returns a runtime-stage error when the code throws', () => {
    const code = `throw new Error('boom');`;
    const result = evaluateTemplate(code);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.message).toContain('boom');
  });

  it('blocks require() of anything other than "printer-core"', () => {
    const code = `const fs = require('fs'); export default fs;`;
    const result = evaluateTemplate(code);
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.message).toContain('Cannot require');
  });
});
