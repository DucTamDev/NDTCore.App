import { MonacoEditor, type MonacoEditorProps } from './MonacoEditor';

export type CodeEditorProps = Omit<MonacoEditorProps, 'language'>;

export function CodeEditor(props: CodeEditorProps) {
  return <MonacoEditor {...props} language="typescript" />;
}
