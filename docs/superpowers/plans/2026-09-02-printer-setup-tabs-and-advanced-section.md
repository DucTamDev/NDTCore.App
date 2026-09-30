# Printer Setup Tabs + Advanced Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tách màn "Thiết lập máy in" thành 2 tab Hoá đơn/Tem (prefill content type theo mục đích khi thêm mới) và gom field ít dùng vào "Cài đặt nâng cao" thu gọn, giảm số control hiện cùng lúc trên form Thêm/Sửa máy in.

**Architecture:** Thuần UI/state-threading trên kiến trúc hiện có — không đổi data model (`Printer`, `PrinterDriver.contentTypes`), không đổi state machine kết nối/discovery. `purpose?: PrintType` là 1 input mới, tuỳ chọn, chảy từ `PrinterManagementPanel` (tab đang mở) → `AddPrinterModal`/`AddPrinterForm` → `useAddPrinterFlow` (chỉ ảnh hưởng lúc `addDriverToList`, bỏ qua khi Sửa).

**Tech Stack:** React Native, react-native-paper (`SegmentedButtons`, `List.Accordion`), react-hook-form (không đổi).

**Spec:** `docs/superpowers/specs/2026-09-02-printer-setup-tabs-and-advanced-section-design.md`

## Global Constraints

- KHÔNG đổi `Printer`/`PrinterDriver` data model, KHÔNG đổi storage version.
- `purpose` CHỈ áp dụng khi thêm mới (`!initialValues`) — Sửa máy in bỏ qua hoàn toàn, giữ nguyên content type đã lưu.
- Máy in nhận CẢ 2 loại nội dung hiện ở CẢ 2 tab (không ép về 1 tab).
- Driver không hỗ trợ `purpose` đã chọn (vd ESC/POS ở tab Tem) → vẫn cho kết nối, CHỈ cảnh báo, KHÔNG chặn Save.
- 2 nút In thử luôn hiện, đặt NGAY TRÊN nút Lưu, KHÔNG vào "Cài đặt nâng cao".
- "Số hàng in thử" (ô nhập, khác với 2 nút In thử) VÀO "Cài đặt nâng cao".
- Không viết test file riêng cho component UI thuần (`PrinterManagementPanel`, `AddPrinterForm`, `AddPrinterModal`, `PrinterInfoCard`, `TestPrintPanel`) — theo quy ước có sẵn trong `CLAUDE.md`, verify qua `type-check`/`lint` + test thủ công. Chỉ `useAddPrinterFlow.ts` (có test sẵn) cần thêm test case.
- `npm run verify` (type-check + lint + test) phải pass trước mỗi commit.
- Commit message theo format `.claude/rules/git-workflow.md`: `<type>: <mô tả ngắn>`.

---

### Task 1: `useAddPrinterFlow` — `purpose` prefill content type + cờ cảnh báo mismatch

**Files:**
- Modify: `src/features/printer/hooks/useAddPrinterFlow.ts`
- Test: `src/features/printer/hooks/__tests__/useAddPrinterFlow.test.tsx`

**Interfaces:**
- Consumes: `PrintType` từ `../models/printing/PrintType` (đã có sẵn trong repo, `Receipt`/`Label`); `getDriverCapabilities` từ `../drivers/DriverCapabilities` (đã import sẵn trong file).
- Produces: `UseAddPrinterFlowInput.purpose?: PrintType`; `UseAddPrinterFlow.hasPurposeMismatchDriver: boolean` — Task 2 (AddPrinterForm) đọc field này để render cảnh báo.

- [ ] **Step 1: Đọc lại file hiện tại để xác nhận vị trí sửa**

File `src/features/printer/hooks/useAddPrinterFlow.ts` hiện tại (dòng 1-30, chỉ phần liên quan):

```ts
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PrinterRepository } from '../storage/PrinterRepository';
import type { PrinterWriteInput } from '../storage/PrinterWriteInput';
import { PrinterConnectionService } from '../services/PrinterConnectionService';
import { useBillImageCapture } from './useBillImageCapture';
import { generateId } from '../../../utils/id';
import { getDriverCapabilities } from '../drivers/DriverCapabilities';
import { printerDisplaySchema, type PrinterDisplayValues } from '../forms/addPrinter/PrinterDisplaySchema';
import type { ConnectionSectionProps } from '../components/ConnectionSection';
import type { StatusPanelProps, ConnectionState, ProtocolState } from '../components/StatusPanel';
import type { PrinterInfoCardProps } from '../components/PrinterInfoCard';
import { ConnectionType } from '../models/printer/PrinterDevice';
import { DriverSource, PrinterDriverType } from '../models/printer/PrinterDriver';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import { mediaOf } from '../drivers/driverConfig';
import type { Printer } from '../models/printer/Printer';
import type { PrinterDriver } from '../models/printer/PrinterDriver';
import type { UsbRawDevice } from '../models/printer/PrinterDevice';
import { dieCutMediaError } from '../media/validation';
import { useConnectionSetup } from './addPrinter/useConnectionSetup';
import { useProtocolDiscovery } from './addPrinter/useProtocolDiscovery';
import { useTestPrint } from './addPrinter/useTestPrint';
import { useDriverConfig } from './addPrinter/useDriverConfig';

export interface UseAddPrinterFlowInput {
  visible: boolean;
  initialValues?: Printer;
  onSaved: () => void;
}

export interface UseAddPrinterFlow {
  title: string;
  connectionSection: ConnectionSectionProps;
  identityErrorMessage?: string;
  statusPanel: StatusPanelProps;
  showAddDriverHint: boolean;
  hasEmptyContentTypeDriver: boolean;
  infoCard: PrinterInfoCardProps;
  captureNode: ReactNode;
  testPrintErrorMessage: string | null;
  saveErrorMessage: string | null;
  clearTestPrintError: () => void;
  clearSaveError: () => void;
}
```

- [ ] **Step 2: Thêm import `PrintType`**

Sửa dòng import `PrinterStatus`:

```ts
import { PrinterStatus } from '../models/printer/PrinterStatus';
import { PrintType } from '../models/printing/PrintType';
```

- [ ] **Step 3: Thêm `purpose` vào `UseAddPrinterFlowInput`, `hasPurposeMismatchDriver` vào `UseAddPrinterFlow`**

```ts
export interface UseAddPrinterFlowInput {
  visible: boolean;
  initialValues?: Printer;
  onSaved: () => void;
  /** Mục đích khi THÊM MỚI (tab Hoá đơn/Tem đang mở ở màn danh sách) — dùng để prefill content type mặc định cho driver mới thêm vào. Bỏ qua hoàn toàn khi Sửa (`initialValues` có giá trị). */
  purpose?: PrintType;
}

export interface UseAddPrinterFlow {
  title: string;
  connectionSection: ConnectionSectionProps;
  identityErrorMessage?: string;
  statusPanel: StatusPanelProps;
  showAddDriverHint: boolean;
  hasEmptyContentTypeDriver: boolean;
  /** true khi có `purpose` (thêm mới, chọn từ tab) nhưng driver vừa kết nối KHÔNG THỂ phục vụ purpose đó (vd ESC/POS ở tab Tem). Không chặn Save. */
  hasPurposeMismatchDriver: boolean;
  infoCard: PrinterInfoCardProps;
  captureNode: ReactNode;
  testPrintErrorMessage: string | null;
  saveErrorMessage: string | null;
  clearTestPrintError: () => void;
  clearSaveError: () => void;
}
```

- [ ] **Step 4: Nhận `purpose` trong tham số hàm**

Tìm dòng:
```ts
export const useAddPrinterFlow = ({ visible, initialValues, onSaved }: UseAddPrinterFlowInput): UseAddPrinterFlow => {
```
Sửa thành:
```ts
export const useAddPrinterFlow = ({ visible, initialValues, onSaved, purpose }: UseAddPrinterFlowInput): UseAddPrinterFlow => {
```

- [ ] **Step 5: Viết test THẤT BẠI trước — purpose prefill + mismatch**

Thêm vào `src/features/printer/hooks/__tests__/useAddPrinterFlow.test.tsx`, ngay sau test `'discovery "unknown_protocol" event surfaces the manual-pick state'` (dòng 138-143 hiện tại):

```ts
  it('purpose=Label prefill chỉ bật Tem cho driver TSPL mới thêm (không tự bật cả Hoá đơn)', () => {
    const { get } = render({ visible: true, onSaved: jest.fn(), purpose: PrintType.Label });
    act(() => get().connectionSection.onConnectPress());
    act(() => capturedDiscoveryHandler?.({ stage: DiscoveryStage.identified, protocol: PrinterDriverType.tspl }));
    expect(get().infoCard.drivers[0].contentTypes).toEqual([PrintType.Label]);
    expect(get().hasPurposeMismatchDriver).toBe(false);
  });

  it('purpose=Label + driver ESC/POS (không hỗ trợ Tem) → giữ contentTypes mặc định + báo mismatch', async () => {
    const { get } = render({ visible: true, onSaved: jest.fn(), purpose: PrintType.Label });
    act(() => get().connectionSection.onConnectPress());
    act(() => capturedDiscoveryHandler?.({ stage: DiscoveryStage.unknown_protocol }));
    await act(async () => { get().statusPanel.onChooseProtocol(PrinterDriverType.escpos); });
    expect(get().infoCard.drivers[0].contentTypes).toEqual([PrintType.Receipt]);
    expect(get().hasPurposeMismatchDriver).toBe(true);
  });

  it('không có purpose (Sửa máy in) → hasPurposeMismatchDriver luôn false', () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    expect(get().hasPurposeMismatchDriver).toBe(false);
  });
```

- [ ] **Step 6: Chạy test để xác nhận thất bại**

Run: `npx jest src/features/printer/hooks/__tests__/useAddPrinterFlow.test.tsx -t "purpose"`
Expected: FAIL — `hasPurposeMismatchDriver` undefined trên `UseAddPrinterFlow`, `contentTypes` vẫn là `['Receipt','Label']` thay vì `['Label']` cho case 1.

- [ ] **Step 7: Sửa `addDriverToList` để prefill theo `purpose`**

Tìm khối hiện tại (khoảng dòng 142-154):
```ts
  /** TRỪ content type đã thuộc driver khác (invariant #3). */
  const addDriverToList = (type: PrinterDriverType, source: DriverSource): void => {
    const alreadyClaimed = new Set(drivers.flatMap((d) => d.contentTypes));
    const contentTypes = getDriverCapabilities(type).contentTypes.filter((ct) => !alreadyClaimed.has(ct));
    const def = getDriverCapabilities(type).defaultConfig;
    const entry: PrinterDriver = {
      type,
      source,
      contentTypes,
      config: { ...def, media: { ...def.media } },
    };
    setDrivers((prev) => [...prev, entry]);
  };
```

Sửa thành:
```ts
  /**
   * TRỪ content type đã thuộc driver khác (invariant #3). Khi thêm mới có
   * `purpose` (chọn từ tab Hoá đơn/Tem) và driver này hỗ trợ được `purpose`
   * đó → chỉ prefill đúng `purpose`, không tự bật thêm loại khác mà user
   * chưa hỏi tới. Driver không hỗ trợ `purpose` (vd ESC/POS ở tab Tem) →
   * giữ hành vi cũ (mọi content type driver hỗ trợ, trừ đã bị claim) —
   * `hasPurposeMismatchDriver` báo cho UI biết để cảnh báo.
   */
  const addDriverToList = (type: PrinterDriverType, source: DriverSource): void => {
    const alreadyClaimed = new Set(drivers.flatMap((d) => d.contentTypes));
    const capable = getDriverCapabilities(type).contentTypes.filter((ct) => !alreadyClaimed.has(ct));
    const contentTypes = purpose && capable.includes(purpose) ? [purpose] : capable;
    const def = getDriverCapabilities(type).defaultConfig;
    const entry: PrinterDriver = {
      type,
      source,
      contentTypes,
      config: { ...def, media: { ...def.media } },
    };
    setDrivers((prev) => [...prev, entry]);
  };
```

- [ ] **Step 8: Thêm `hasPurposeMismatchDriver` + đưa vào object trả về**

Tìm dòng (khoảng 280):
```ts
  const hasEmptyContentTypeDriver = drivers.some((d) => d.contentTypes.length === 0);

  return {
    title: initialValues ? 'Chỉnh sửa máy in' : 'Thêm máy in',
    identityErrorMessage,
    showAddDriverHint: drivers.length > 0 && drivers.length < 2,
    hasEmptyContentTypeDriver,
```

Sửa thành:
```ts
  const hasEmptyContentTypeDriver = drivers.some((d) => d.contentTypes.length === 0);
  /**
   * true khi có `purpose` (thêm mới, chọn tab) nhưng ít nhất 1 driver đã
   * kết nối KHÔNG THỂ phục vụ `purpose` đó — vd ESC/POS ở tab Tem (ESC/POS
   * chỉ nhận Hoá đơn, xem `DriverCapabilities.ts`). Không chặn Save.
   */
  const hasPurposeMismatchDriver =
    purpose != null && drivers.some((d) => !getDriverCapabilities(d.type).contentTypes.includes(purpose));

  return {
    title: initialValues ? 'Chỉnh sửa máy in' : 'Thêm máy in',
    identityErrorMessage,
    showAddDriverHint: drivers.length > 0 && drivers.length < 2,
    hasEmptyContentTypeDriver,
    hasPurposeMismatchDriver,
```

- [ ] **Step 9: Chạy lại test để xác nhận pass**

Run: `npx jest src/features/printer/hooks/__tests__/useAddPrinterFlow.test.tsx`
Expected: PASS toàn bộ (kể cả 3 test mới + các test cũ không bị regress).

- [ ] **Step 10: Type-check**

Run: `npm run type-check`
Expected: PASS, không lỗi.

- [ ] **Step 11: Commit**

```bash
git add src/features/printer/hooks/useAddPrinterFlow.ts src/features/printer/hooks/__tests__/useAddPrinterFlow.test.tsx
git commit -m "feat: prefill content type theo purpose khi thêm máy in mới

purpose (tab Hoá đơn/Tem đang mở) chỉ áp dụng lúc thêm mới, prefill
đúng loại nội dung đó cho driver mới thay vì tự bật mọi loại driver hỗ
trợ. Driver không hỗ trợ purpose (vd ESC/POS ở tab Tem) vẫn cho kết
nối, chỉ báo qua hasPurposeMismatchDriver — không chặn Save."
```

---

### Task 2: `AddPrinterForm` / `AddPrinterModal` — nhận `purpose`, hiện cảnh báo mismatch

**Files:**
- Modify: `src/features/printer/components/AddPrinterForm.tsx`
- Modify: `src/features/printer/components/AddPrinterModal.tsx`

**Interfaces:**
- Consumes: `UseAddPrinterFlowInput.purpose`, `UseAddPrinterFlow.hasPurposeMismatchDriver` (Task 1).
- Produces: `AddPrinterFormProps.purpose?: PrintType`, `AddPrinterModalProps.purpose?: PrintType` — Task 3 (`PrinterManagementPanel`) truyền vào.

- [ ] **Step 1: Sửa `AddPrinterForm.tsx`**

Toàn bộ nội dung file mới:

```tsx
import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { useAddPrinterFlow } from '../hooks/useAddPrinterFlow';
import { ConnectionSection } from './ConnectionSection';
import { StatusPanel } from './StatusPanel';
import { PrinterInfoCard } from './PrinterInfoCard';
import { PRINT_TYPE_LABELS, type PrintType } from '../models/printing/PrintType';
import type { Printer } from '../models/printer/Printer';

/**
 * Nội dung form Thêm/Sửa máy in — không có `Modal`/`Portal`.
 * Trên điện thoại `PrinterManagementPanel` render thẳng component này thay cho danh sách;
 * trên tablet nó được bọc trong `AddPrinterModal`.
 */
export interface AddPrinterFormProps {
  visible: boolean;
  initialValues?: Printer;
  onSaved: () => void;
  onBack: () => void;
  /** Ẩn nút "‹ Quay lại" khi màn cha đã có sẵn nút back riêng (điện thoại — header ứng dụng đã có "← Thiết lập máy in"). Mặc định hiện — bắt buộc với `AddPrinterModal` vì đó là cách duy nhất đóng modal. */
  showBackButton?: boolean;
  /** Mục đích khi THÊM MỚI (tab Hoá đơn/Tem đang mở ở màn danh sách) — bỏ qua khi Sửa. */
  purpose?: PrintType;
}

export const AddPrinterForm: React.FC<AddPrinterFormProps> = ({
  visible,
  initialValues,
  onSaved,
  onBack,
  showBackButton = true,
  purpose,
}) => {
  const flow = useAddPrinterFlow({ visible, initialValues, onSaved, purpose });

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {showBackButton ? <AppButton mode="text" label="‹ Quay lại" onPress={onBack} /> : null}
        <Text variant="titleMedium">{flow.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ConnectionSection {...flow.connectionSection} />
        {flow.identityErrorMessage ? <Text style={styles.identityError}>{flow.identityErrorMessage}</Text> : null}

        <StatusPanel {...flow.statusPanel} />

        {flow.showAddDriverHint ? (
          <Text variant="bodySmall" style={styles.addDriverHint}>
            Máy in này còn hỗ trợ thêm driver khác — bấm "Kết nối" để dò tiếp.
          </Text>
        ) : null}

        {flow.hasEmptyContentTypeDriver ? (
          <Text variant="bodySmall" style={styles.identityError}>
            Mỗi driver phải nhận in ít nhất 1 loại nội dung (Hoá đơn/Tem) — chọn ở phần bên dưới trước khi lưu.
          </Text>
        ) : null}

        {flow.hasPurposeMismatchDriver && purpose ? (
          <Text variant="bodySmall" style={styles.addDriverHint}>
            Driver vừa thêm không hỗ trợ in {PRINT_TYPE_LABELS[purpose]} — vẫn dùng được cho loại nội dung khác.
          </Text>
        ) : null}

        <PrinterInfoCard {...flow.infoCard} />
        {flow.captureNode}
      </ScrollView>

      <Snackbar visible={flow.testPrintErrorMessage !== null} onDismiss={flow.clearTestPrintError} duration={5000}>
        {flow.testPrintErrorMessage}
      </Snackbar>
      <Snackbar visible={flow.saveErrorMessage !== null} onDismiss={flow.clearSaveError} duration={5000}>
        {flow.saveErrorMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scrollContent: { gap: 12, paddingBottom: 24 },
  identityError: { color: '#B91C1C' },
  addDriverHint: { color: '#6B7280' },
});
```

- [ ] **Step 2: Sửa `AddPrinterModal.tsx`**

Toàn bộ nội dung file mới:

```tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import { Modal, Portal } from 'react-native-paper';
import { AddPrinterForm } from './AddPrinterForm';
import type { PrintType } from '../models/printing/PrintType';
import type { Printer } from '../models/printer/Printer';

/**
 * Wrapper mỏng bọc `AddPrinterForm` trong `Modal` — chỉ dùng trên tablet.
 * Điện thoại render thẳng `AddPrinterForm` inline (xem `PrinterManagementPanel`).
 */
export interface AddPrinterModalProps {
  visible: boolean;
  initialValues?: Printer;
  onDismiss: () => void;
  onSaved: () => void;
  /** Mục đích khi THÊM MỚI (tab Hoá đơn/Tem đang mở ở màn danh sách) — bỏ qua khi Sửa. */
  purpose?: PrintType;
}

export const AddPrinterModal: React.FC<AddPrinterModalProps> = ({ visible, initialValues, onDismiss, onSaved, purpose }) => (
  <Portal>
    <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
      <AddPrinterForm visible={visible} initialValues={initialValues} onSaved={onSaved} onBack={onDismiss} purpose={purpose} />
    </Modal>
  </Portal>
);

const styles = StyleSheet.create({
  container: { backgroundColor: 'white', margin: 24, padding: 16, borderRadius: 16, maxHeight: '85%' },
});
```

- [ ] **Step 3: Type-check + lint**

Run: `npm run type-check && npm run lint`
Expected: PASS. (Không có test riêng cho 2 file UI thuần này — theo quy ước repo.)

- [ ] **Step 4: Commit**

```bash
git add src/features/printer/components/AddPrinterForm.tsx src/features/printer/components/AddPrinterModal.tsx
git commit -m "feat: AddPrinterForm/Modal nhận purpose + hiện cảnh báo driver không hợp mục đích"
```

---

### Task 3: `PrinterManagementPanel` — tab Hoá đơn/Tem, nút Thêm theo tab, lọc danh sách

**Files:**
- Modify: `src/features/printer/components/PrinterManagementPanel.tsx`

**Interfaces:**
- Consumes: `AddPrinterFormProps.purpose`, `AddPrinterModalProps.purpose` (Task 2); `PRINT_TYPE_LABELS`, `PrintType` từ `../models/printing/PrintType` (đã có sẵn trong repo).
- Produces: không có consumer khác trong plan này (component gốc của cây UI màn này).

- [ ] **Step 1: Sửa toàn bộ file**

Toàn bộ nội dung file mới:

```tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, BackHandler } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { useLayoutMode } from '../../../hooks/useLayoutMode';
import { usePrinterList } from '../hooks/usePrinterList';
import { PrinterList } from './PrinterList';
import { AddPrinterModal } from './AddPrinterModal';
import { AddPrinterForm } from './AddPrinterForm';
import { PrintType, PRINT_TYPE_LABELS } from '../models/printing/PrintType';
import type { Printer } from '../models/printer/Printer';

export const PrinterManagementPanel: React.FC = () => {
  const { printers, reload, ...actions } = usePrinterList();
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editingPrinter, setEditingPrinter] = useState<Printer | undefined>(undefined);
  const [addSessionId, setAddSessionId] = useState(0);
  const [activeTab, setActiveTab] = useState<PrintType>(PrintType.Receipt);
  const isPhone = useLayoutMode() === 'phone';

  const openAdd = (): void => {
    setAddSessionId((n) => n + 1);
    setEditingPrinter(undefined);
    setMode('form');
  };

  const openEdit = (printer: Printer): void => {
    setEditingPrinter(printer);
    setMode('form');
  };

  const backToList = (): void => setMode('list');

  const onSaved = (): void => {
    setMode('list');
    reload();
  };

  useEffect(() => {
    if (!(isPhone && mode === 'form')) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setMode('list');
      return true;
    });
    return () => sub.remove();
  }, [isPhone, mode]);

  const formKey = editingPrinter?.id ?? `add-${addSessionId}`;
  // Chỉ Thêm mới (không Sửa) mới mang purpose — Sửa giữ nguyên content type đã lưu.
  const purpose = editingPrinter ? undefined : activeTab;

  if (isPhone && mode === 'form') {
    return (
      <View style={styles.phoneForm}>
        <AddPrinterForm
          key={formKey}
          visible
          initialValues={editingPrinter}
          onSaved={onSaved}
          onBack={backToList}
          showBackButton={false}
          purpose={purpose}
        />
      </View>
    );
  }

  const printersForTab = printers.filter((p) => p.drivers.some((d) => d.contentTypes.includes(activeTab)));

  return (
    <View style={styles.container}>
      <Text variant="titleSmall">Thiết lập máy in</Text>

      <SegmentedButtons
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as PrintType)}
        buttons={[
          { value: PrintType.Receipt, label: PRINT_TYPE_LABELS.Receipt },
          { value: PrintType.Label, label: PRINT_TYPE_LABELS.Label },
        ]}
      />

      <AppButton label={`+ Thêm máy in ${PRINT_TYPE_LABELS[activeTab]}`} onPress={openAdd} />

      <PrinterList printers={printersForTab} actions={actions} onEdit={openEdit} />

      {!isPhone && (
        <AddPrinterModal
          key={formKey}
          visible={mode === 'form'}
          initialValues={editingPrinter}
          onDismiss={backToList}
          onSaved={onSaved}
          purpose={purpose}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  phoneForm: { flex: 1, padding: 16 },
});
```

Lưu ý: bỏ `styles.header` (row title+button cũ) vì title giờ đứng riêng 1 dòng trên tabs, nút "+ Thêm máy in..." xuống dưới tabs, full-width mặc định giống nút "Lưu máy in" (không có `alignItems` override trong `styles.container` → stretch mặc định).

- [ ] **Step 2: Type-check + lint**

Run: `npm run type-check && npm run lint`
Expected: PASS.

- [ ] **Step 3: Test thủ công trên thiết bị/emulator**

- Mở "Thiết lập máy in" → mặc định tab "Hoá đơn" active, nút ghi "+ Thêm máy in Hoá đơn".
- Bấm tab "Tem" → nút đổi thành "+ Thêm máy in Tem", danh sách lọc lại (chỉ máy in có driver nhận `Label`).
- Thêm 1 máy in TSPL mới ở tab Tem → sau khi kết nối, content type chỉ có Tem (không tự bật Hoá đơn) — quan sát switch trong `PrinterInfoCard`.
- Sửa 1 máy in đã lưu (bất kỳ tab nào) → xác nhận content type giữ nguyên như đã lưu, không bị `purpose` ghi đè.
- Máy in nhận cả 2 loại (nếu có) → xuất hiện ở cả 2 tab.

- [ ] **Step 4: Commit**

```bash
git add src/features/printer/components/PrinterManagementPanel.tsx
git commit -m "feat: tách tab Hoá đơn/Tem cho màn Thiết lập máy in

Lọc danh sách theo tab, nút Thêm máy in đổi label theo tab, truyền
purpose vào Add flow để prefill content type mặc định (Task 1-2)."
```

---

### Task 4: `TestPrintPanel` — chỉ còn 2 nút In thử, bỏ ô "Số hàng in thử"

**Files:**
- Modify: `src/features/printer/components/TestPrintPanel.tsx`

**Interfaces:**
- Consumes: không đổi so với hiện tại (props có sẵn).
- Produces: `TestPrintPanelProps` bỏ `hasTsplDriver`, `testPrintRowsText`, `onTestPrintRowsChange` — Task 5 (`PrinterInfoCard`) tự render ô "Số hàng in thử" trực tiếp trong "Cài đặt nâng cao", không còn truyền 3 prop này cho `TestPrintPanel` nữa.

- [ ] **Step 1: Sửa toàn bộ file**

Toàn bộ nội dung file mới:

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppButton } from '../../../components/AppButton';
import { PrinterStatus } from '../models/printer/PrinterStatus';

interface TestPrintPanelProps {
  status: PrinterStatus;
  canPrintReceipt: boolean;
  canPrintLabel: boolean;
  testPrintReceiptPending: boolean;
  testPrintLabelPending: boolean;
  onTestPrintReceipt: () => void;
  onTestPrintLabel: () => void;
  disabled: boolean;
}

export const TestPrintPanel: React.FC<TestPrintPanelProps> = ({
  status,
  canPrintReceipt,
  canPrintLabel,
  testPrintReceiptPending,
  testPrintLabelPending,
  onTestPrintReceipt,
  onTestPrintLabel,
  disabled,
}) => (
  <View style={styles.testPrintRow}>
    <AppButton
      label="In bill thử"
      mode="outlined"
      style={styles.testPrintButton}
      disabled={status !== PrinterStatus.connected || !canPrintReceipt || testPrintReceiptPending}
      loading={testPrintReceiptPending}
      onPress={onTestPrintReceipt}
    />
    <AppButton
      label="In tem thử"
      mode="outlined"
      style={styles.testPrintButton}
      disabled={status !== PrinterStatus.connected || !canPrintLabel || testPrintLabelPending}
      loading={testPrintLabelPending}
      onPress={onTestPrintLabel}
    />
  </View>
);

const styles = StyleSheet.create({
  testPrintRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  testPrintButton: { flex: 1 },
});
```

`disabled` prop giữ nguyên dù chưa dùng trong JSX — hành vi có từ trước khi sửa file này (không thuộc phạm vi task), không tự ý xoá prop khỏi interface public.

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: FAIL tạm thời — `PrinterInfoCard.tsx` (chưa sửa) đang truyền `hasTsplDriver`/`testPrintRowsText`/`onTestPrintRowsChange` cho `TestPrintPanel` (prop không còn tồn tại). Đây là lỗi TẠM THỜI, được giải quyết ở Task 5 — không commit Task 4 riêng, gộp commit với Task 5 (2 file đổi cùng lúc để không để lại trạng thái type-check đỏ giữa 2 commit).

---

### Task 5: `PrinterInfoCard` — "Cài đặt nâng cao" thu gọn (`List.Accordion`)

**Files:**
- Modify: `src/features/printer/components/PrinterInfoCard.tsx`

**Interfaces:**
- Consumes: `TestPrintPanelProps` mới (Task 4, không còn `hasTsplDriver`/`testPrintRowsText`/`onTestPrintRowsChange`).
- Produces: không đổi `PrinterInfoCardProps` (giữ nguyên toàn bộ prop hiện có — chỉ tổ chức lại JSX bên trong).

- [ ] **Step 1: Sửa toàn bộ file**

Toàn bộ nội dung file mới:

```tsx
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Chip, List } from 'react-native-paper';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { AppInput } from '../../../components/AppInput';
import { AppSwitch } from '../../../components/AppSwitch';
import { AppButton } from '../../../components/AppButton';
import { PrinterStatusBadge } from './PrinterStatusBadge';
import { DriverMediaSection } from './DriverMediaSection';
import { DriverRenderModeSection } from './DriverRenderModeSection';
import { TestPrintPanel } from './TestPrintPanel';
import { getDriverCapabilities } from '../drivers/DriverCapabilities';
import type { PrinterDisplayValues } from '../forms/addPrinter/PrinterDisplaySchema';
import { PrintType } from '../models/printing/PrintType';
import { DriverSource, PrinterDriverType, TsplRenderMode } from '../models/printer/PrinterDriver';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import { mediaOf } from '../drivers/driverConfig';
import type { ConnectionType, PrinterDeviceInfo } from '../models/printer/PrinterDevice';
import type { PrinterDriver, TsplInternalFontConfig } from '../models/printer/PrinterDriver';
import type { PrintMedia } from '../models/media/PrintMedia';

const connectionLabel: Record<ConnectionType, string> = {
  usb: 'USB',
  bluetooth: 'Bluetooth',
  lan: 'LAN',
};

const protocolLabel: Record<PrinterDriverType, string> = {
  escpos: 'ESC/POS',
  tspl: 'TSPL',
};

const contentTypeLabel: Record<PrintType, string> = {
  Receipt: 'In Hoá đơn',
  Label: 'In Tem',
};

export interface PrinterInfoCardProps {
  control: Control<PrinterDisplayValues>;
  errors: FieldErrors<PrinterDisplayValues>;
  connectionType: ConnectionType;
  drivers: PrinterDriver[];
  onToggleContentType: (type: PrinterDriverType, contentType: PrintType, value: boolean) => void;
  deviceInfo?: PrinterDeviceInfo;
  status: PrinterStatus;
  autoReconnect: boolean;
  onAutoReconnectChange: (value: boolean) => void;
  testPrintReceiptPending: boolean;
  onTestPrintReceipt: () => void;
  testPrintLabelPending: boolean;
  onTestPrintLabel: () => void;
  /** Chỉ có ý nghĩa khi có driver type 'tspl'. `truetype` kéo theo `installTsplFont`. */
  onSelectTsplRenderMode: (mode: TsplRenderMode) => void;
  /** Cập nhật 1 phần cấu hình font máy in (`renderMode: 'internalfont'`). */
  onChangeTsplInternalFont: (patch: Partial<TsplInternalFontConfig>) => void;
  /** Cập nhật `media` per-driver (khổ giấy, loại giấy, kích thước die-cut). */
  onChangeDriverMedia: (driverType: PrinterDriverType, patch: Partial<PrintMedia>) => void;
  /** Số hàng die-cut cho "In tem thử" — giữ dạng text để nhập dở. */
  testPrintRowsText: string;
  onTestPrintRowsChange: (text: string) => void;
  /** Có driver TSPL trong list — gate ô "Số hàng in thử". */
  hasTsplDriver: boolean;
  /** true trong lúc đang chạy `installTsplFont` — vô hiệu hoá selector để tránh double-tap. */
  tsplFontPending: boolean;
  onSave: () => void;
  saveDisabled: boolean;
  locked: boolean;
}

export const PrinterInfoCard: React.FC<PrinterInfoCardProps> = ({
  control,
  errors,
  connectionType,
  drivers,
  onToggleContentType,
  deviceInfo,
  status,
  autoReconnect,
  onAutoReconnectChange,
  testPrintReceiptPending,
  onTestPrintReceipt,
  testPrintLabelPending,
  onTestPrintLabel,
  onSelectTsplRenderMode,
  onChangeTsplInternalFont,
  onChangeDriverMedia,
  testPrintRowsText,
  onTestPrintRowsChange,
  hasTsplDriver,
  tsplFontPending,
  onSave,
  saveDisabled,
  locked,
}) => {
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  const claimedElsewhere = (type: PrinterDriverType, contentType: PrintType): boolean =>
    drivers.some((d) => d.type !== type && d.contentTypes.includes(contentType));

  const canPrint = (contentType: PrintType): boolean => drivers.some((d) => d.contentTypes.includes(contentType));

  return (
    <View style={styles.container}>
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <AppInput label="Tên hiển thị" value={field.value} onChangeText={field.onChange} errorMessage={errors.name?.message} disabled={locked} />
        )}
      />

      {deviceInfo?.deviceName ? <Text variant="bodySmall">Tên thiết bị: {deviceInfo.deviceName}</Text> : null}
      {deviceInfo?.vendor ? <Text variant="bodySmall">Hãng sản xuất: {deviceInfo.vendor}</Text> : null}
      {deviceInfo?.model ? <Text variant="bodySmall">Model: {deviceInfo.model}</Text> : null}
      <View style={styles.row}>
        <Text variant="bodySmall">Loại kết nối: {connectionLabel[connectionType]}</Text>
        <PrinterStatusBadge status={status} />
      </View>

      {drivers.map((driver) => (
        <View key={driver.type} style={styles.driverCard}>
          <View style={styles.row}>
            <Chip>{`Driver: ${protocolLabel[driver.type]}`}</Chip>
            <Chip>{driver.source === DriverSource.auto ? 'Tự động nhận diện' : 'Người dùng chọn'}</Chip>
          </View>
          {getDriverCapabilities(driver.type).contentTypes.map((contentType) => (
            <AppSwitch
              key={contentType}
              label={contentTypeLabel[contentType]}
              value={driver.contentTypes.includes(contentType)}
              onValueChange={(value) => onToggleContentType(driver.type, contentType, value)}
              disabled={locked || (!driver.contentTypes.includes(contentType) && claimedElsewhere(driver.type, contentType))}
            />
          ))}
        </View>
      ))}

      <List.Accordion
        title="Cài đặt nâng cao"
        expanded={advancedExpanded}
        onPress={() => setAdvancedExpanded((v) => !v)}
        style={styles.advancedAccordion}
      >
        <AppSwitch label="Tự động kết nối lại" value={autoReconnect} onValueChange={onAutoReconnectChange} disabled={locked} />
        {drivers.map((driver) => (
          <View key={driver.type} style={styles.advancedDriverBlock}>
            {drivers.length > 1 ? <Text variant="labelSmall">{protocolLabel[driver.type]}</Text> : null}
            <DriverMediaSection
              driverType={driver.type}
              media={mediaOf(driver)}
              disabled={locked}
              onChange={(patch) => onChangeDriverMedia(driver.type, patch)}
            />
            <DriverRenderModeSection
              driver={driver}
              disabled={locked}
              tsplFontPending={tsplFontPending}
              onSelectTsplRenderMode={onSelectTsplRenderMode}
              onChangeTsplInternalFont={onChangeTsplInternalFont}
            />
          </View>
        ))}
        {hasTsplDriver ? (
          <AppInput
            label="Số hàng in thử"
            keyboardType="numeric"
            value={testPrintRowsText}
            onChangeText={onTestPrintRowsChange}
            disabled={locked}
          />
        ) : null}
      </List.Accordion>

      <TestPrintPanel
        status={status}
        canPrintReceipt={canPrint(PrintType.Receipt)}
        canPrintLabel={canPrint(PrintType.Label)}
        testPrintReceiptPending={testPrintReceiptPending}
        testPrintLabelPending={testPrintLabelPending}
        onTestPrintReceipt={onTestPrintReceipt}
        onTestPrintLabel={onTestPrintLabel}
        disabled={locked}
      />
      <AppButton label="Lưu máy in" disabled={saveDisabled} onPress={onSave} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  driverCard: { gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F9FAFB' },
  advancedAccordion: { paddingHorizontal: 0 },
  advancedDriverBlock: { gap: 8, marginBottom: 12 },
});
```

Field `media`/`renderMode`/`autoReconnect` đều là state NÂNG từ `useAddPrinterFlow` (không phải local state trong `List.Accordion`'s subtree), nên `List.Accordion` unmount nội dung lúc đóng (hành vi mặc định của RN Paper) KHÔNG làm mất giá trị — mở lại vẫn đọc đúng từ hook. `Tên hiển thị` (dùng `Controller`/react-hook-form) vẫn nằm NGOÀI accordion, không bị ảnh hưởng.

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS (lỗi tạm thời từ Task 4 giờ hết vì `TestPrintPanel` được gọi đúng props mới).

- [ ] **Step 3: Chạy toàn bộ test suite**

Run: `npm test`
Expected: PASS toàn bộ (không có test riêng cho `PrinterInfoCard`/`TestPrintPanel`, nhưng `useAddPrinterFlow.test.tsx` và các test khác không được đụng tới bởi 2 file này không được regress).

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Test thủ công trên thiết bị/emulator**

- Mở Thêm/Sửa máy in đã có driver → "Cài đặt nâng cao" đóng mặc định.
- Bấm mở → thấy Auto-reconnect, Khổ giấy/die-cut, Chế độ render TSPL, Số hàng in thử (nếu có TSPL).
- Đổi 1 giá trị trong đó (vd đổi Khổ giấy) → đóng accordion lại → mở lại → giá trị vẫn giữ đúng (không mất/reset).
- 2 nút "In bill thử"/"In tem thử" vẫn hiện ngay cả khi accordion đóng, nằm trên nút "Lưu máy in".
- Kiểm tra field bên trong accordion không bị thụt lề bất thường so với field ngoài accordion (đã sửa vấn đề tương tự cho `driverCard` trước đó trong session này — xác nhận `List.Accordion` không tái tạo lỗi cũ).

- [ ] **Step 6: Commit (gộp Task 4 + Task 5)**

```bash
git add src/features/printer/components/TestPrintPanel.tsx src/features/printer/components/PrinterInfoCard.tsx
git commit -m "feat: gom field ít dùng vào \"Cài đặt nâng cao\" thu gọn

TestPrintPanel chỉ còn 2 nút In thử (luôn hiện, trên nút Lưu).
PrinterInfoCard gom Auto-reconnect, khổ giấy/die-cut, chế độ render
TSPL + codepage/font, Số hàng in thử vào List.Accordion đóng mặc định."
```

---

## Self-Review (đã chạy khi viết plan)

**1. Spec coverage:**
- §2.1 (UI danh sách, filter theo tab) — Task 3 ✅
- §2.2 (nút Thêm theo tab) — Task 3 ✅
- §2.3 (`purpose` prefill) — Task 1 ✅
- §2.4 (cảnh báo mismatch) — Task 1 (cờ) + Task 2 (hiển thị) ✅
- §3.1 (nhóm field luôn hiện/nâng cao, kể cả vị trí 2 nút In thử) — Task 4 + Task 5 ✅
- §3.2 (cơ chế thu gọn, rủi ro RHF) — Task 5 ✅ (xác nhận media/renderMode không dùng RHF nên an toàn)
- §4 (testing) — mỗi task có bước type-check/lint/test tương ứng ✅
- §5 (rủi ro font tiếng Việt — spec này KHÔNG có, đó là spec Skia riêng, không áp dụng ở đây)

**2. Placeholder scan:** không còn "TBD"/"tương tự Task N" — mọi step có code đầy đủ.

**3. Type consistency:** `purpose?: PrintType` dùng xuyên suốt `useAddPrinterFlow.ts` → `AddPrinterForm.tsx`/`AddPrinterModal.tsx` → `PrinterManagementPanel.tsx`, tên field khớp nhau ở mọi nơi. `hasPurposeMismatchDriver: boolean` định nghĩa 1 lần ở Task 1, tiêu thụ đúng tên ở Task 2. `TestPrintPanelProps` sau Task 4 khớp với lệnh gọi ở Task 5 (đã bỏ đúng 3 prop ở cả 2 phía).
