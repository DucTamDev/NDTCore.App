import Editor from '@monaco-editor/react';

export interface DataEditorProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
}

export function DataEditor({ value, onChange }: DataEditorProps) {
  return (
    <Editor
      height="100%"
      language="json"
      value={value}
      onChange={(next) => onChange(next ?? '')}
      options={{ minimap: { enabled: false }, fontSize: 13 }}
    />
  );
}
