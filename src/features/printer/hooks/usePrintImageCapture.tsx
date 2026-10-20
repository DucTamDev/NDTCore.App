import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { PAPER_SIZE_SPECS, DOTS_PER_MM } from '../models/paper/paperSpec';
import type { PaperOptions } from '../models/paper/PaperOptions';
import { PaperType } from '../models/paper/PaperType';

/**
 * Chụp thường xong dưới một giây. Lần chụp không bao giờ xong (khung chụp không hiện lên) phải trả `null`, vì các đơn
 * in chờ nhau chụp: một lần treo sẽ chặn mọi lệnh in sau.
 */
export const CAPTURE_TIMEOUT_MS = 5000;

/** Chụp `content` thành PNG base64 (không tiền tố `data:`) rộng theo `paper`; `null` khi chụp thất bại. */
export type CaptureImage = (content: React.ReactElement, paper: PaperOptions) => Promise<string | null>;

export interface UsePrintImageCapture {
  /** Phải render vào JSX của component gọi hook: chỉ chụp được View đã mount thật. */
  captureNode: React.ReactNode;

  captureImage: CaptureImage;
}

/** Nội dung đang chờ chụp và bề rộng khung chụp. */
interface PendingCapture {
  /** Nội dung cần chụp. */
  content: React.ReactElement;

  /** Bề rộng khung (px = dot in). */
  widthPx: number;
}

/** Tem rời chụp theo bề rộng một con tem, giấy cuộn theo bề rộng vùng in. */
const widthPxOf = (paper: PaperOptions): number =>
  paper.type === PaperType.DieCut ? paper.itemWidthMm * DOTS_PER_MM : PAPER_SIZE_SPECS[paper.paperSize].imageWidthPx;

/**
 * Chụp ở `onLayout` vì `captureRef` cần View đã layout xong. Không truyền `width`/`height` cho `captureRef`: Android
 * có thể bắn `onLayout` vài lần với kích thước tạm, chụp theo số đo tạm ra ảnh trắng. Ảnh vì thế theo pixel vật lý
 * (lớn hơn `imageWidthPx`) và được thu nhỏ lúc giải mã ở `decodePngBase64ToMonochrome`.
 */
export const usePrintImageCapture = (): UsePrintImageCapture => {
  const viewRef = useRef<View>(null);
  const resolverRef = useRef<((base64: string | null) => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, setPending] = useState<PendingCapture | null>(null);

  /** Lấy lời hứa đang chờ ra khỏi ref để mỗi lần chụp chỉ được trả kết quả một lần. */
  const takeResolver = useCallback(() => {
    const resolve = resolverRef.current;
    resolverRef.current = null;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    return resolve;
  }, []);

  const captureImage = useCallback<CaptureImage>(
    (content, paper) =>
      new Promise((resolve) => {
        takeResolver()?.(null);
        resolverRef.current = resolve;
        timeoutRef.current = setTimeout(() => {
          takeResolver()?.(null);
          setPending(null);
        }, CAPTURE_TIMEOUT_MS);
        setPending({ content, widthPx: widthPxOf(paper) });
      }),
    [takeResolver],
  );

  // Màn hình chứa khung chụp đóng giữa chừng thì lần chụp đang chờ không bao giờ xong.
  useEffect(() => () => takeResolver()?.(null), [takeResolver]);

  const onLayout = useCallback(() => {
    const resolve = takeResolver();
    if (!resolve) return;
    captureRef(viewRef, { format: 'png', result: 'base64' })
      .then((base64) => resolve(base64))
      .catch(() => resolve(null))
      .finally(() => setPending(null));
  }, [takeResolver]);

  // `collapsable={false}`: thiếu nó Android có thể bỏ View khỏi cây native và chụp ra ảnh rỗng.
  const captureNode = pending ? (
    <View
      ref={viewRef}
      onLayout={onLayout}
      collapsable={false}
      style={[styles.page, { width: pending.widthPx }]}
    >
      {pending.content}
    </View>
  ) : null;

  return { captureNode, captureImage };
};

const styles = StyleSheet.create({
  // Nền trắng đặc để ảnh chụp luôn có pixel trắng thật, không phụ thuộc thiết bị xử lý nền trong suốt ra sao. Không
  // padding: lề do mẫu in tự đặt.
  page: { position: 'absolute', left: -9999, top: 0, backgroundColor: '#ffffff' },
});
