import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import type { Printer, PrinterKind } from '@ndtcore/printer';
import { AppButton } from '../../../components/AppButton';
import { useAddPrinterFlow } from '../hooks/useAddPrinterFlow';
import { ConnectionSection } from './ConnectionSection';
import { StatusPanel } from './StatusPanel';
import { PrinterInfoCard } from './PrinterInfoCard';

/** Thuộc tính form thêm, sửa máy in. */
export interface AddPrinterFormProps {
  /** Máy đã lưu khi sửa; không có là thêm mới. */
  initialPrinter?: Printer;

  /** Lưu xong. */
  onSaved: () => void;

  /** Quay lại danh sách. */
  onBack: () => void;

  /** Ẩn nút "‹ Quay lại" khi màn cha đã có nút back riêng. Mặc định hiện. */
  showBackButton?: boolean;

  /** Loại nội dung cố định: tab đang mở lúc thêm, kind của máy lúc sửa. */
  kind: PrinterKind;
}

/**
 * Nội dung form thêm, sửa máy in, không có Modal. Điện thoại render thẳng thay cho danh sách; tablet bọc trong
 * `AddPrinterModal`. Unmount là huỷ luồng thêm máy của package.
 */
export const AddPrinterForm: React.FC<AddPrinterFormProps> = props => {
  const {
    initialPrinter,
    onSaved,
    onBack,
    showBackButton = true,
    kind,
  } = props;
  const flow = useAddPrinterFlow({ kind, initialPrinter, onSaved });
  const { session, testPrint } = flow;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {showBackButton ? (
          <AppButton mode="text" label="‹ Quay lại" onPress={onBack} />
        ) : null}
        <Text variant="titleMedium">{flow.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {flow.isEdit ? null : (
          <>
            <ConnectionSection flow={flow} />
            <StatusPanel
              connectionState={session.connectionState}
              errorMessage={session.errorMessage}
              connectionLost={session.connectionLost}
              draft={session.draft}
            />
          </>
        )}
        <PrinterInfoCard flow={flow} kind={kind} />
      </ScrollView>

      <Snackbar
        visible={testPrint.errorMessage !== null}
        onDismiss={testPrint.clearError}
        duration={5000}
      >
        {testPrint.errorMessage}
      </Snackbar>
      <Snackbar
        visible={flow.saveErrorMessage !== null}
        onDismiss={flow.clearSaveError}
        duration={5000}
      >
        {flow.saveErrorMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scrollContent: { gap: 12, paddingBottom: 24 },
});
