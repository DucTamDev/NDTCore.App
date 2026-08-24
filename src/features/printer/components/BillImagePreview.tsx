// src/features/printer/components/BillImagePreview.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PrintDocument, PrintElement } from '../types/printDocument.types';

export interface BillImagePreviewProps {
  document: PrintDocument;
  widthPx: number;
}

/**
 * Render `PrintDocument` thành View RN thuần (không style căn giữa/đậm —
 * `PrintElement` chưa có field align/bold) để `useBillImageCapture` chụp
 * lại thành ảnh cho TSPL. `image`/`barcode`/`qrCode` không render gì — bill
 * nguồn cho luồng này chỉ build từ `text`/`line`/`row`/`table`
 * (`OrderPrintTrigger.buildBillElements`), không đưa các loại phần tử đó
 * vào document nguồn để render ảnh.
 */
const renderElement = (element: PrintElement, index: number): React.ReactNode => {
  if (element.type === 'text') {
    return (
      <Text key={index} style={styles.text}>
        {element.content}
      </Text>
    );
  }
  if (element.type === 'line') {
    return <View key={index} style={styles.divider} />;
  }
  if (element.type === 'row') {
    return (
      <View key={index} style={styles.row}>
        <Text style={styles.text}>{element.left}</Text>
        <Text style={styles.text}>{element.right}</Text>
      </View>
    );
  }
  if (element.type === 'table') {
    return (
      <View key={index}>
        {element.rows.map((row, rowIndex) => (
          <Text key={rowIndex} style={styles.text}>
            {row.join('  ')}
          </Text>
        ))}
      </View>
    );
  }
  return null;
};

export const BillImagePreview: React.FC<BillImagePreviewProps> = ({ document, widthPx }) => (
  <View style={[styles.container, { width: widthPx }]}>
    {document.elements.map(renderElement)}
  </View>
);

const styles = StyleSheet.create({
  // Nền để trong suốt (không set `backgroundColor`) thay vì '#ffffff' đặc —
  // `rgbaToMonochromeBitmap` đã coi pixel alpha=0 là trắng (không in), nên
  // vùng nền không cần vẽ pixel trắng đặc mà vẫn ra kết quả đúng; đồng thời
  // né trường hợp nền trắng đặc bị chụp/convert sai màu trên 1 số thiết bị
  // (từng gặp: nền in ra đen dù style là trắng).
  container: { padding: 16 },
  text: { fontFamily: 'monospace', fontSize: 16, color: '#000000' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  divider: { borderTopWidth: 1, borderTopColor: '#000000', marginVertical: 8 },
});
