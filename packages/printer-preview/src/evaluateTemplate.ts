import * as ts from 'typescript';
import * as PrinterCore from 'printer-core';
import type { PrintTemplate } from 'printer-core';

export type EvaluateResult =
  | { readonly status: 'ok'; readonly template: PrintTemplate }
  | { readonly status: 'error'; readonly stage: 'transpile' | 'runtime'; readonly message: string };

export function evaluateTemplate(code: string): EvaluateResult {
  let js: string;
  try {
    const result = ts.transpileModule(code, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
      reportDiagnostics: true,
    });
    if (result.diagnostics && result.diagnostics.length > 0) {
      const message = result.diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n');
      return { status: 'error', stage: 'transpile', message };
    }
    js = result.outputText;
  } catch (error) {
    return { status: 'error', stage: 'transpile', message: error instanceof Error ? error.message : String(error) };
  }

  try {
    const moduleObj: { exports: { default?: unknown } } = { exports: {} };
    const requireShim = (name: string): unknown => {
      if (name === 'printer-core') return PrinterCore;
      throw new Error(`Cannot require "${name}" — only "printer-core" is available here.`);
    };
    const fn = new Function('module', 'exports', 'require', js);
    fn(moduleObj, moduleObj.exports, requireShim);

    const template = moduleObj.exports.default;
    if (!template || typeof template !== 'object' || !('root' in template) || !('config' in template)) {
      return { status: 'error', stage: 'runtime', message: 'Code phải export default 1 PrintTemplate (ví dụ: export default labelTemplate().size(...).root(...).build();).' };
    }
    return { status: 'ok', template: template as PrintTemplate };
  } catch (error) {
    return { status: 'error', stage: 'runtime', message: error instanceof Error ? error.message : String(error) };
  }
}
