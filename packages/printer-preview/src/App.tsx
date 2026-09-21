// packages/printer-preview/src/App.tsx
import { useEffect, useState } from 'react';
import type { PrinterLanguage } from 'printer-core';
import { CodeEditor } from './CodeEditor';
import { DataEditor } from './DataEditor';
import { PreviewPanel } from './PreviewPanel';
import { ErrorPanel } from './ErrorPanel';
import { evaluateTemplate } from './evaluateTemplate';
import { renderPreviews, defaultLanguageFor, type PagePreview } from './pipeline';
import { defaultCode, defaultData } from './defaultSample';

const LANGUAGES: readonly PrinterLanguage[] = ['tsc', 'zpl', 'epl', 'cpcl', 'dpl', 'sbpl', 'escpos', 'starprnt', 'ipl'];

export function App() {
  const [code, setCode] = useState(defaultCode);
  const [dataText, setDataText] = useState(defaultData);
  const [language, setLanguage] = useState<PrinterLanguage>('tsc');
  const [languageTouched, setLanguageTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<readonly PagePreview[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const evaluated = evaluateTemplate(code);
      if (evaluated.status === 'error') {
        setError(`[${evaluated.stage}] ${evaluated.message}`);
        setPreviews([]);
        return;
      }
      let data: unknown;
      try {
        data = JSON.parse(dataText);
      } catch (parseError) {
        setError(`[data] ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        setPreviews([]);
        return;
      }
      const languageToUse = languageTouched ? language : defaultLanguageFor(evaluated.template);
      if (!languageTouched) {
        setLanguage(languageToUse);
      }
      try {
        setError(null);
        setPreviews(renderPreviews(evaluated.template, data as Record<string, unknown>, languageToUse));
      } catch (pipelineError) {
        setError(`[pipeline] ${pipelineError instanceof Error ? pipelineError.message : String(pipelineError)}`);
        setPreviews([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [code, dataText, language, languageTouched]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', height: '100vh' }}>
      <div style={{ borderRight: '1px solid #ccc' }}>
        <CodeEditor value={code} onChange={setCode} />
      </div>
      <div style={{ borderRight: '1px solid #ccc' }}>
        <DataEditor value={dataText} onChange={setDataText} />
      </div>
      <div style={{ overflow: 'auto', padding: 8 }}>
        <select
          value={language}
          onChange={(event) => {
            setLanguage(event.target.value as PrinterLanguage);
            setLanguageTouched(true);
          }}
        >
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
