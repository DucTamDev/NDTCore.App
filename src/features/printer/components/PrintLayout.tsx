import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/** Một dòng chữ trên bản in. */
export const PrintText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.text}>{children}</Text>
);

/** Nhãn bên trái, giá trị bên phải trên cùng một dòng (vd "Mã đơn ... #001"). */
export const PrintRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.text}>{label}</Text>
    <Text style={styles.text}>{value}</Text>
  </View>
);

/** Đường kẻ ngang ngăn các phần của bản in. */
export const PrintDivider: React.FC = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  // Ảnh in theo dot thật (8 dot/mm) nên cỡ 24 ≈ chữ cao 3mm, mức dễ đọc của hoá đơn nhiệt.
  text: { fontFamily: 'monospace', fontSize: 24, color: '#000000' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  divider: { borderTopWidth: 1, borderTopColor: '#000000', marginVertical: 8 },
});
