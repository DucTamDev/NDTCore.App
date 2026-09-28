import * as ts from 'typescript';
import * as PrinterCore from 'printer-core';
import { parseTemplate, type TemplateDataDefinition, type TemplateDocument } from 'printer-core';

export type EvaluateResult =
  | {
      readonly status: 'ok';
      readonly template: TemplateDocument;
      readonly templateData: TemplateDataDefinition<unknown>;
    }
  | { readonly status: 'error'; readonly stage: 'transpile' | 'runtime'; readonly message: string };

/** Module mà code người dùng xuất ra: `export const templateData` + `export default` template. */
interface EvaluatedModule {
  default?: unknown;
  templateData?: unknown;
}

const EXPORT_HINT =
  'Code phải `export const templateData = defineTemplateData(...)` và ' +
  '`export default labelTemplate(templateData)...build()` ' +
  '(hoặc receiptTemplate) — default export phải là 1 TemplateDocument.';

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

function isTemplateDataDefinition(value: unknown): value is TemplateDataDefinition<unknown> {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Partial<Record<keyof TemplateDataDefinition<unknown>, unknown>>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.describe === 'function' &&
    typeof candidate.readVariable === 'function' &&
    typeof candidate.readCollection === 'function'
  );
}

function toEvaluateResult(exported: EvaluatedModule): EvaluateResult {
  if (!isTemplateDataDefinition(exported.templateData)) {
    return { status: 'error', stage: 'runtime', message: EXPORT_HINT };
  }

  const parsed = parseTemplate(exported.default);
  if (!parsed.ok) {
    const issues = parsed.issues.map((issue) => `- ${issue.path}: ${issue.message}`).join('\n');
    return { status: 'error', stage: 'runtime', message: `${EXPORT_HINT}\n${issues}` };
  }
  return { status: 'ok', template: parsed.template, templateData: exported.templateData };
}

function executeAndValidate(js: string): EvaluateResult {
  try {
    const moduleObj: { exports: EvaluatedModule } = { exports: {} };
    // eslint-disable-next-line no-new-func -- công cụ dev, chủ đích chạy code template người dùng viết (không sandbox)
    const fn = new Function('module', 'exports', 'require', js);
    fn(moduleObj, moduleObj.exports, requireShim);
    return toEvaluateResult(moduleObj.exports);
  } catch (error) {
    return { status: 'error', stage: 'runtime', message: errorMessage(error) };
  }
}

export function evaluateTemplate(code: string): EvaluateResult {
  const transpiled = transpile(code);
  if ('error' in transpiled) return transpiled.error;
  return executeAndValidate(transpiled.js);
}
