// packages/printer-preview/src/App.tsx
import { useEffect, useState } from 'react';
import type { PrinterLanguage } from 'printer-core';
import { CodeEditor } from './components/CodeEditor';
import { DataEditor } from './components/DataEditor';
import { PreviewPanel } from './components/PreviewPanel';
import { ErrorPanel } from './components/ErrorPanel';
import { evaluateTemplate } from './evaluateTemplate';
import { renderPreviews, defaultLanguageFor, type PagePreview } from './pipeline';
import { defaultCode, defaultData } from './defaultSample';

const LANGUAGES: readonly PrinterLanguage[] = ['tspl', 'escpos'];
const RENDER_DEBOUNCE_MS = 500;

interface RenderOutcome {
  readonly error: string | null;
  readonly previews: readonly PagePreview[];
  readonly language?: PrinterLanguage;
}

function parseData(dataText: string): { readonly data: unknown } | { readonly error: string } {
  try {
    return { data: JSON.parse(dataText) };
  } catch (parseError) {
    return { error: parseError instanceof Error ? parseError.message : String(parseError) };
  }
}

function renderOutcome(
  code: string,
  dataText: string,
  language: PrinterLanguage,
  languageTouched: boolean,
): RenderOutcome {
  const evaluated = evaluateTemplate(code);
  if (evaluated.status === 'error') {
    return { error: `[${evaluated.stage}] ${evaluated.message}`, previews: [] };
  }

  const parsed = parseData(dataText);
  if ('error' in parsed) {
    return { error: `[data] ${parsed.error}`, previews: [] };
  }

  const languageToUse = languageTouched ? language : defaultLanguageFor(evaluated.template);
  try {
    const previews = renderPreviews(evaluated.template, evaluated.catalog, parsed.data, languageToUse);
    return { error: null, previews, language: languageToUse };
  } catch (pipelineError) {
    const message = pipelineError instanceof Error ? pipelineError.message : String(pipelineError);
    return { error: `[pipeline] ${message}`, previews: [], language: languageToUse };
  }
}

export function App() {
  const [code, setCode] = useState(defaultCode);
  const [dataText, setDataText] = useState(defaultData);
  const [language, setLanguage] = useState<PrinterLanguage>('tspl');
  const [languageTouched, setLanguageTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<readonly PagePreview[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const outcome = renderOutcome(code, dataText, language, languageTouched);
      setError(outcome.error);
      setPreviews(outcome.previews);
      if (!languageTouched && outcome.language) setLanguage(outcome.language);
    }, RENDER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [code, dataText, language, languageTouched]);

  function handleLanguageChange(next: PrinterLanguage) {
    setLanguage(next);
    setLanguageTouched(true);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', height: '100vh' }}>
      <div style={{ borderRight: '1px solid #ccc' }}>
        <CodeEditor value={code} onChange={setCode} />
      </div>
      <div style={{ borderRight: '1px solid #ccc' }}>
        <DataEditor value={dataText} onChange={setDataText} />
      </div>
      <div style={{ overflow: 'auto', padding: 8 }}>
        <select value={language} onChange={(event) => handleLanguageChange(event.target.value as PrinterLanguage)}>
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
        <ErrorPanel message={error} />
        <PreviewPanel previews={previews} />
      </div>
    </div>
  );
}
