import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PrintDocument, PrintElement } from '../models/printing/PrintDocument';

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
  // Nền trắng đặc thay vì để trong suốt — nền trong suốt (alpha=0) từng bị
  // nghi là nguyên nhân "nền in ra đen dù style là trắng", nhưng root cause
  // thật là TsplEncoder.image() gửi bit ngược chuẩn TSPL2 cho firmware clone
  // (xem comment ở đó) — đã sửa tận gốc ở tầng encode, không cần né bằng
  // cách để nền trong suốt nữa. Nền trắng đặc tường minh giúp `captureRef()`
  // luôn chụp ra đúng pixel trắng thật, không phụ thuộc việc 1 số thiết bị
  // có xử lý đúng alpha=0 hay không.
  container: { padding: 16, backgroundColor: '#ffffff' },
  text: { fontFamily: 'monospace', fontSize: 16, color: '#000000' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  divider: { borderTopWidth: 1, borderTopColor: '#000000', marginVertical: 8 },
});
