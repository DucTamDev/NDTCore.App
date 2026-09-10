import React, { useCallback, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { BillImagePreview } from '../components/BillImagePreview';
import { PAPER_SIZE_SPECS, DOTS_PER_MM } from '../paper/paperSpec';
import type { PrintDocument } from '../models/printing/PrintDocument';
import type { PrintPaperConfig } from '../models/paper/PrintPaperConfig';
import { PrintPaperType } from '../models/paper/PrintPaperConfig';

export interface UseBillImageCapture {
  /** Render `{captureNode}` vào JSX của component gọi hook này — capture cần 1 View thật đã mount, không tự tạo tree được từ tầng service. */
  captureNode: React.ReactNode;
  /** Trả base64 PNG (không tiền tố `data:...`) — trả `null` nếu capture thất bại thay vì throw, để nơi gọi tự quyết định fallback (vd dùng document text thay thế). */
  captureBillImage: (document: PrintDocument, media: PrintPaperConfig) => Promise<string | null>;
}

/**
 * `react-native-view-shot` yêu cầu View đã thật sự layout xong trước khi
 * `captureRef()` — hook này chờ đúng 1 lần `onLayout` sau khi set nội dung
 * mới rồi mới chụp, nhưng chưa có cách nào chắc chắn ngoài test tay rằng
 * `onLayout` luôn fire sau khi `Text` bên trong đã đo xong kích thước thật
 * (rủi ro race hiếm gặp trên Android nếu font chưa load xong lúc đo).
 * `collapsable={false}` bắt buộc trên Android — thiếu nó, native view có thể
 * bị tối ưu loại khỏi cây view vì không có sibling nào cần tới, khiến
 * `captureRef()` chụp ra ảnh rỗng.
 *
 * **Cố tình KHÔNG truyền `width`/`height` cho `captureRef()`** — từng thử lấy
 * 2 số đó từ `event.nativeEvent.layout` của chính `onLayout` kích hoạt capture,
 * nhưng `height` phụ thuộc `Text` con đo xong nội dung nên Android có thể bắn
 * `onLayout` nhiều lần với kích thước tạm/chưa ổn định trước lần đúng cuối —
 * capture ngay ở lần đầu (đang chờ) kèm resize theo số đo tạm đó ra ảnh
 * trắng trơn hoặc lẫn nội dung/kích thước của lần chụp trước. Hệ quả: ảnh
 * xuất ra theo pixel vật lý thật của máy (dp × devicePixelRatio), gấp 2-3
 * lần kích thước `PAPER_SIZE_SPECS[...].imageWidthPx` mà `TsplEncoder`/`monochromeBitmap`
 * giả định — bù lại bằng cách resize RGBA đã decode xuống đúng
 * `PAPER_SIZE_SPECS[...].imageWidthPx` trong `decodePngBase64ToMonochrome()`
 * (`pngToMonochrome.ts`), không phụ thuộc timing của layout.
 */
export const useBillImageCapture = (): UseBillImageCapture => {
  const viewRef = useRef<View>(null);
  const resolverRef = useRef<((base64: string | null) => void) | null>(null);
  const [pending, setPending] = useState<{ document: PrintDocument; widthPx: number } | null>(null);

  const captureBillImage = useCallback(
    (document: PrintDocument, media: PrintPaperConfig): Promise<string | null> =>
      new Promise((resolve) => {
        resolverRef.current = resolve;
        const widthPx =
          media.type === PrintPaperType.DieCut
            ? (media.itemWidthMm ?? 0) * DOTS_PER_MM
            : PAPER_SIZE_SPECS[media.paperSize].imageWidthPx;
        setPending({ document, widthPx });
      }),
    [],
  );

  const onLayout = useCallback(() => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    if (!resolve) return;
    captureRef(viewRef, { format: 'png', result: 'base64' })
      .then((base64) => resolve(base64))
      .catch(() => resolve(null))
      .finally(() => setPending(null));
  }, []);

  const captureNode = pending ? (
    <View ref={viewRef} onLayout={onLayout} collapsable={false} style={styles.offscreen}>
      <BillImagePreview document={pending.document} widthPx={pending.widthPx} />
    </View>
  ) : null;

  return { captureNode, captureBillImage };
};

const styles = StyleSheet.create({
  offscreen: { position: 'absolute', left: -9999, top: 0 },
});
