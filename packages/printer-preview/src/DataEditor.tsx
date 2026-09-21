import { MonacoEditor, type MonacoEditorProps } from './MonacoEditor';

export type DataEditorProps = Omit<MonacoEditorProps, 'language'>;

export function DataEditor(props: DataEditorProps) {
  return <MonacoEditor {...props} language="json" />;
}
