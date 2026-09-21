import type { PagePreview } from '../pipeline';

export interface PreviewPanelProps {
  readonly previews: readonly PagePreview[];
}

export function PreviewPanel({ previews }: PreviewPanelProps) {
  if (previews.length === 0) return <div>Chưa có preview</div>;
  return (
    <div>
      {previews.map((preview) =>
        preview.status === 'ok' ? (
          // previewFor() trả về chuỗi SVG do printer-core sinh ra, không phải markup từ người dùng.
          <div key={preview.pageIndex} dangerouslySetInnerHTML={{ __html: preview.svg }} />
        ) : (
          <div key={preview.pageIndex} style={{ color: 'red' }}>
            Trang {preview.pageIndex + 1}: {preview.message}
          </div>
        ),
      )}
    </div>
  );
}
