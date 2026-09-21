import Editor from '@monaco-editor/react';

export interface MonacoEditorProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly language: string;
}

export function MonacoEditor({ value, onChange, language }: MonacoEditorProps) {
  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      onChange={(next) => onChange(next ?? '')}
      options={{ minimap: { enabled: false }, fontSize: 13 }}
    />
  );
}
