import Editor from '@monaco-editor/react';

export interface CodeEditorProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
}

export function CodeEditor({ value, onChange }: CodeEditorProps) {
  return (
    <Editor
      height="100%"
      language="typescript"
      value={value}
      onChange={(next) => onChange(next ?? '')}
      options={{ minimap: { enabled: false }, fontSize: 13 }}
    />
  );
}
