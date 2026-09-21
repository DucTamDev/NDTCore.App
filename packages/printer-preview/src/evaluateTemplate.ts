import * as ts from 'typescript';
import * as PrinterCore from 'printer-core';
import type { PrintTemplate } from 'printer-core';

export type EvaluateResult =
  | { readonly status: 'ok'; readonly template: PrintTemplate }
  | { readonly status: 'error'; readonly stage: 'transpile' | 'runtime'; readonly message: string };

const EXPORT_DEFAULT_HINT =
  'Code phải export default 1 PrintTemplate (ví dụ: export default labelTemplate().size(...).root(...).build();).';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function transpile(code: string): { readonly js: string } | { readonly error: EvaluateResult } {
  try {
    const result = ts.transpileModule(code, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
      reportDiagnostics: true,
    });
    if (result.diagnostics && result.diagnostics.length > 0) {
      const message = result.diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n');
      return { error: { status: 'error', stage: 'transpile', message } };
    }
    return { js: result.outputText };
  } catch (error) {
    return { error: { status: 'error', stage: 'transpile', message: errorMessage(error) } };
  }
}

function requireShim(name: string): unknown {
  if (name === 'printer-core') return PrinterCore;
  throw new Error(`Cannot require "${name}" — only "printer-core" is available here.`);
}

function isPrintTemplateShape(value: unknown): value is PrintTemplate {
  return typeof value === 'object' && value !== null && 'root' in value && 'config' in value;
}

function executeAndValidate(js: string): EvaluateResult {
  try {
    const moduleObj: { exports: { default?: unknown } } = { exports: {} };
    // eslint-disable-next-line no-new-func -- deliberately executes user-authored template code; documented non-sandboxed dev-tool behavior
    const fn = new Function('module', 'exports', 'require', js);
    fn(moduleObj, moduleObj.exports, requireShim);

    const template = moduleObj.exports.default;
    if (!isPrintTemplateShape(template)) {
      return { status: 'error', stage: 'runtime', message: EXPORT_DEFAULT_HINT };
    }
    return { status: 'ok', template };
  } catch (error) {
    return { status: 'error', stage: 'runtime', message: errorMessage(error) };
  }
}

export function evaluateTemplate(code: string): EvaluateResult {
  const transpiled = transpile(code);
  if ('error' in transpiled) return transpiled.error;
  return executeAndValidate(transpiled.js);
}
