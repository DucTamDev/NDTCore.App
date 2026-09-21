export interface ErrorPanelProps {
  readonly message: string | null;
}

export function ErrorPanel({ message }: ErrorPanelProps) {
  if (!message) return null;
  return <div style={{ color: 'red', whiteSpace: 'pre-wrap' }}>{message}</div>;
}
