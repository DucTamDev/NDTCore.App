# Printer Media UI + Add-Printer Screen (SP-C) — Design Specification

## 0. Bối cảnh

SP-C của nỗ lực `PrintMedia` (xem `2026-08-30-print-media-domain-design.md` §0 — A→(B∥C)→D). SP-A có domain `PrintMedia` per `PrinterDriver.config` + Zod schema; SP-B có engine TSPL đọc trọn `PrintMedia` (die-cut nhiều cột, cutter, số hàng). Nhưng **chưa có UI** để cấu hình `media` — `useAddPrinterFlow.buildDraftPrinter` đang stamp `paperSize` từ 1 field RHF chung cho mọi driver, `die_cut` chưa cấu hình được, ô số hàng "In tem thử" chưa có, và `AddPrinterModal` hiện là `<Portal><Modal>` overlay trên mọi thiết bị.

SP-C làm toàn bộ UI + wiring:
1. Form cấu hình `PrintMedia` **per-driver** trong `PrinterInfoCard`.
2. Cross-field validation (die-cut vừa khổ giấy).
3. Ô nhập số hàng "In tem thử" cho driver TSPL + thread `PrintOptions` qua `PrinterService.testPrint`.
4. `AddPrinterModal` → **inline content-swap** trên điện thoại (tablet giữ Modal).

Không đụng engine (SP-B đã xong). Không làm UI cho `capabilities.cutter` / `media.cutterMode` (giữ dormant — quyết định 2026-08-30).

---

## 1. Phạm vi SP-C

**Trong phạm vi:**

1. `PrinterService.setDriverMedia(printerId, driverType, patch: Partial<PrintMedia>)` — persist media cho 1 driver của printer ĐÃ LƯU (no-op cho draft), nhận CẢ escpos lẫn tspl.
2. `PrinterInfoCard`: bỏ field `paperSize` RHF top-level; mỗi driver card thêm section media.
3. `printerFormSchema`: bỏ `paperSize` khỏi `printerDisplaySchema`; thêm cross-field validate vào `printMediaSchema` (row-width ≤ printable width).
4. `useAddPrinterFlow`: `onChangeDriverMedia` callback; state `testPrintRows`; `runTestPrint` truyền `{ rows }`; `buildDraftPrinter` bỏ stamp `paperSize`; bỏ `paperSize` khỏi `displayForm` defaultValues.
5. `PrinterService.testPrint` + `options?: PrintOptions`, forward xuống driver.
6. `AddPrinterModal` tách `AddPrinterForm` (nội dung) + wrapper Modal.
7. `PrinterManagementPanel`: `useLayoutMode()` → phone dùng `AddPrinterForm` inline, tablet dùng `AddPrinterModal`.
8. Dọn nợ SP-B: `useAddPrinterFlow.test.tsx` capture-arg assertion; `ARCHITECTURE.md` `paperSize` → `media`.
9. Tests.

**Ngoài phạm vi:**
- UI cho `cutterMode` / `capabilities.cutter` (dormant).
- Thread `PrintOptions` qua đường **routing** (`PrintService.print` → `PrintScheduler` → `driver.print`) — SP-D (flow POS). SP-C chỉ đường `testPrint`.
- Nav stack thật (React Navigation) — dùng inline content-swap, không đụng nav lib.
- Flow in tem từ POS (chọn loại tem + số lượng) — **SP-D**.

---

## 2. `PrinterService.setDriverMedia`

`printing/PrinterService.ts` — cạnh `setTsplRenderMode` / `setTsplInternalFont`:

```ts
/**
 * Persist `media` cho 1 driver (escpos HOẶC tspl) của printer ĐÃ LƯU — draft
 * chưa lưu → no-op (state trong `useAddPrinterFlow` mang vào `buildDraftPrinter`
 * lúc Save). `patch` merge nông vào `config.media` hiện có.
 */
const setDriverMedia = (printerId: string, driverType: PrinterDriverType, patch: Partial<PrintMedia>): void => {
  const printers = getPrinters();
  const printer = printers.find((p) => p.id === printerId);
  const entry = printer?.drivers.find((d) => d.type === driverType);
  if (!printer || !entry) return;
  savePrinters(
    printers.map((p) =>
      p.id !== printerId ? p : {
        ...p,
        drivers: p.drivers.map((d) =>
          d.type !== driverType ? d : { ...d, config: { ...d.config, media: { ...d.config.media, ...patch } } },
        ),
      },
    ),
  );
};
```
Export trong object trả về. `d.config.media` chắc chắn có (SP-A: bắt buộc cả 2 config).

**Lưu ý escpos + die_cut:** `printMediaSchema` (SP-A) cấm escpos `media.type !== 'continuous'`. UI escpos KHÔNG hiện selector "Loại giấy" → `patch` từ escpos chỉ có `paperSize`. Không có đường nào set escpos sang die_cut.

---

## 3. `PrinterInfoCard` — media form per-driver

### 3.1 Bỏ `paperSize` RHF top-level

- `printerFormSchema.ts`: `printerDisplaySchema` bỏ `paperSize` → còn `{ name }`. `PrinterDisplayValues` mất `paperSize`.
- `PrinterInfoCard`: xoá `<Controller name="paperSize">` block + import `AppSelect` giữ (còn dùng chỗ khác).
- `useAddPrinterFlow`: `displayForm` `defaultValues` bỏ `paperSize: initialValues?.paperSize ?? 80`.

### 3.2 Section media trong mỗi driver card

Thêm vào `PrinterInfoCard` (trong `drivers.map`, đầu mỗi `driverCard`, trước content-type switches), quản qua props mới:

```ts
// PrinterInfoCardProps thêm:
onChangeDriverMedia: (driverType: PrinterDriverType, patch: Partial<PrintMedia>) => void;
```

Render (dùng `mediaOf(driver)` để đọc giá trị hiện tại):

```tsx
const media = mediaOf(driver);
// AppSelect "Khổ giấy": 58/80/100/104 → onChangeDriverMedia(driver.type, { paperSize: Number(v) as PaperSize })
// TSPL only:
//   AppSelect "Loại giấy": continuous | die_cut → onChangeDriverMedia(driver.type, { type: v })
//   nếu media.type === 'die_cut':
//     AppInput số × 5 (itemWidthMm, itemHeightMm, columns, horizontalGapMm, verticalGapMm)
//       → onChangeDriverMedia(driver.type, { itemWidthMm: parseNum(v) })  ...
//     cảnh báo inline đỏ nếu vượt khổ (xem §4)
```

- `PaperSize` options: `[58, 80, 100, 104]` với label `'58mm'`...`'104mm'`.
- `parseNum(v: string): number | undefined` — `v.trim() === '' ? undefined : Number(v)` (giữ `undefined` khi xoá trắng để schema báo thiếu; `NaN` khi gõ chữ → schema `.positive()` reject).
- die_cut fields hiển thị **có điều kiện** (`media.type === 'die_cut'`) — nhất quán với cách `internalfont` fields đã làm (`renderMode === 'internalfont' ? ... : null`).
- `disabled={locked}` như các field khác.

### 3.3 Chuyển giá trị media khi đổi `type`

`onChangeDriverMedia(type, { type: 'die_cut' })`: nếu media hiện chưa có 5 field → hook tự điền default die_cut khi patch (xem §5). `{ type: 'continuous' }`: giữ nguyên các field die_cut trong config (không xoá — đổi lại không mất), schema bỏ qua chúng khi continuous.

---

## 4. Cross-field validation (die-cut vừa khổ giấy)

`printerFormSchema.ts` — `printMediaSchema.superRefine` (SP-A) thêm nhánh:

```ts
if (m.type === PrintMediaType.dieCut && m.columns && m.itemWidthMm != null && m.horizontalGapMm != null) {
  const rowWidthMm = m.columns * m.itemWidthMm + (m.columns - 1) * m.horizontalGapMm;
  const printableMm = PRINTABLE_WIDTH_MM[m.paperSize];
  if (rowWidthMm > printableMm) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['columns'],
      message: `Hàng ${m.columns} cột rộng ${rowWidthMm}mm, vượt khổ in ${printableMm}mm — giảm số cột / kích thước tem / gap.` });
  }
}
```
### 4.1 Nơi đặt hằng số + helper (chốt)

- **`PRINTABLE_WIDTH_MM`** (`{ 58: 50, 80: 72, 100: 96, 104: 104 }`) — hiện module-local trong `TsplEncoder.ts` → **chuyển sang `utils/paperWidth.ts`** (cùng chỗ `PAPER_WIDTH_CHARS`/`PAPER_IMAGE_WIDTH_PX`/`DOTS_PER_MM`; đúng nghĩa "hằng số khổ giấy"). `TsplEncoder.ts` import từ đó (bỏ bản local). `contentWidthChars` (SP-B, dùng `PRINTABLE_WIDTH_MM`) đổi import theo.
- **`dieCutRowOverflow(media: PrintMedia): string | null`** — util mới `printer/utils/mediaValidation.ts`, import `PRINTABLE_WIDTH_MM` từ `paperWidth.ts`. Trả message tiếng Việt nếu `columns·itemWidthMm + (columns-1)·horizontalGapMm > PRINTABLE_WIDTH_MM[paperSize]`, ngược lại `null`. Chỉ tính khi `media.type === 'die_cut'` và đủ `columns`/`itemWidthMm`/`horizontalGapMm`.
- `printerFormSchema.ts` `printMediaSchema.superRefine` gọi `dieCutRowOverflow` (hoặc lặp lại công thức — chọn gọi để 1 nguồn).
- `PrinterInfoCard` import `dieCutRowOverflow` (util nhẹ, không kéo `TsplEncoder`).

### 4.2 Inline warning trong `PrinterInfoCard`

Hiện `<Text style={{color:'#B91C1C'}}>{dieCutRowOverflow(media)}</Text>` dưới field `columns` khi `!= null`. `saveDisabled` thêm điều kiện `drivers.some((d) => dieCutRowOverflow(mediaOf(d)) != null)`.

---

## 5. `useAddPrinterFlow` — media callback + số hàng

### 5.1 `onChangeDriverMedia`

```ts
const onChangeDriverMedia = (driverType: PrinterDriverType, patch: Partial<PrintMedia>): void => {
  setDrivers((prev) => prev.map((d) => {
    if (d.type !== driverType) return d;
    let media = { ...d.config.media, ...patch };
    // đổi sang die_cut lần đầu → điền default 5 field nếu thiếu
    if (media.type === PrintMediaType.dieCut) {
      media = { itemWidthMm: 30, itemHeightMm: 20, columns: 2, horizontalGapMm: 2, verticalGapMm: 3, ...media };
    }
    return { ...d, config: { ...d.config, media } };
  }));
  PrinterService.setDriverMedia(printerId, driverType, patch);  // no-op nếu draft
};
```
(default die_cut giá trị: 30×20mm, 2 cột, gap 2/3mm — 2·30 + 1·2 = 62mm, vừa khổ 80.)

### 5.2 Số hàng "In tem thử"

- State: `const [testPrintRowsText, setTestPrintRowsText] = useState('1');`
- `runTestPrint` (không thêm param — đọc thẳng state): nhánh Label truyền `options`:
  ```ts
  const options = printType === PrintType.Label ? { rows: Number(testPrintRowsText) } : undefined;
  await PrinterService.testPrint(printer, driver, documents, printType, options);
  ```
  `TsplDriver.resolveRows` (SP-B) đã guard `NaN`/âm/thập phân → không cần validate ở UI.
- Expose trong return: `infoCard.testPrintRowsText`, `infoCard.onTestPrintRowsChange`, và `infoCard.hasTsplDriver` (để `PrinterInfoCard` biết có hiện ô không).

### 5.3 `buildDraftPrinter`

Bỏ dòng `.map(... media: { ...d.config.media, paperSize: displayForm.getValues('paperSize') })` → chỉ `drivers,` (driver đã mang media đúng từ state qua `onChangeDriverMedia` + `addDriverToList`/discovery đã stamp — SP-A finalfix). `capabilities` giữ `initialValues?.capabilities ?? { cutter: false }` (SP-A finalfix).

---

## 6. `PrinterService.testPrint` — `options`

```ts
const testPrint = async (printer, driver, documents, printType, options?: PrintOptions): Promise<void> => {
  await lock.runExclusive(resourceKeyFor(printer, driver.type),
    () => getDriver(driver.type).testPrint(printer, driver, documents, printType, options));
};
```
Import `PrintOptions` từ `../types/driver.types`.

---

## 7. `AddPrinterModal` → `AddPrinterForm` + inline

### 7.1 Tách `AddPrinterForm`

`components/AddPrinterForm.tsx` (mới) — toàn bộ nội dung bên trong `<ScrollView>` của `AddPrinterModal` + 2 `<Snackbar>`:

```ts
export interface AddPrinterFormProps {
  visible: boolean;             // "đang active" — reset flow khi bật
  initialValues?: Printer;
  onSaved: () => void;
  onBack: () => void;           // nút "‹ Quay lại" / dismiss
}
```
Bên trong: `const flow = useAddPrinterFlow({ visible, initialValues, onSaved });` + JSX hiện tại + 1 header row có nút back:
```tsx
<View style={styles.header}>
  <AppButton mode="text" label="‹ Quay lại" onPress={onBack} />
  <Text variant="titleMedium">{flow.title}</Text>
</View>
```
`<ScrollView>` giữ nguyên (form dài). Không có `<Portal>`/`<Modal>` ở đây.

### 7.2 `AddPrinterModal` = wrapper tablet

```tsx
export const AddPrinterModal: React.FC<AddPrinterModalProps> = ({ visible, initialValues, onDismiss, onSaved }) => (
  <Portal>
    <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
      <AddPrinterForm visible={visible} initialValues={initialValues} onSaved={onSaved} onBack={onDismiss} />
    </Modal>
  </Portal>
);
```
Style container giữ (`margin`, `maxHeight: '85%'`...).

### 7.3 `PrinterManagementPanel`

```tsx
const layout = useLayoutMode();
const isPhone = layout === 'phone';
// state: mode: 'list' | 'form'  (thay modalVisible)
if (isPhone && mode === 'form') {
  return <AddPrinterForm visible key={...} initialValues={editingPrinter} onSaved={onSaved} onBack={() => setMode('list')} />;
}
return (
  <View>
    <header/> <PrinterList/>
    {!isPhone && <AddPrinterModal visible={mode === 'form'} initialValues={editingPrinter} onDismiss={() => setMode('list')} onSaved={onSaved} />}
  </View>
);
```
`onSaved` → `setMode('list')` + `reload()`. `key` giữ logic reset (`editingPrinter?.id ?? add-${addSessionId}`).

---

## 8. Dọn nợ SP-B

- **`useAddPrinterFlow.test.tsx`**: `useBillImageCapture` mock hiện trả `jest.fn()` mới mỗi lần, không assert được arg. Refactor: hoist `const captureBillImageMock = jest.fn(() => Promise.resolve(null));` ra ngoài factory, mock trả `{ captureNode: null, captureBillImage: captureBillImageMock }`. Thêm test: test-print Label bitmap-mode → `expect(captureBillImageMock).toHaveBeenCalledWith(sampleDoc, expect.objectContaining({ type: 'die_cut', columns: expect.any(Number) }))` (sau khi cấu hình media die_cut).
- **`ARCHITECTURE.md`** (~dòng 451): `paperSize: 58 | 80` trên shape `Printer` → cập nhật: bỏ `paperSize`, thêm `capabilities: PrinterCapabilities` + note `media` nằm trong `PrinterDriver.config`.

---

## 9. Testing

| Test | Kiểm |
|------|------|
| `printerFormSchema.test.ts` | `printerDisplaySchema` KHÔNG còn `paperSize` (parse `{ name }` ok; `{ name, paperSize: 80 }` — extra key stripped, vẫn ok); die_cut `columns·itemW + gaps > printable` → fail với message "vượt khổ in"; vừa khổ → pass |
| `PrinterService.test.ts` | `setDriverMedia(id, 'tspl', { paperSize: 100 })` → persist; `setDriverMedia(id, 'escpos', { paperSize: 58 })` → persist; draft (chưa lưu) → no-op; `testPrint(..., { rows: 3 })` → driver.testPrint nhận `{ rows: 3 }` |
| `useAddPrinterFlow.test.tsx` | `onChangeDriverMedia('tspl', { type: 'die_cut' })` → driver state có 5 field default; `onChangeDriverMedia('tspl', { paperSize: 100 })` → media.paperSize=100; `buildDraftPrinter` output drivers giữ media từ state (không bị paperSize form đè); `runTestPrint(Label)` với `testPrintRowsText='3'` → `PrinterService.testPrint` nhận `{ rows: 3 }`; capture-arg assertion (dọn nợ §8) |
| `mediaValidation.test.ts` (mới) | `dieCutRowOverflow`: 3×30 gap 2 trên 100mm (printable 96) → 94 ≤ 96 → null; 4×30 gap 2 trên 100 → 126 > 96 → message |
| `PrinterManagementPanel` | KHÔNG test riêng (component UI thuần) — verify type-check + thủ công. Nếu có logic swap đáng test → tách hook `usePrinterManagementView` (không bắt buộc). |
| `AddPrinterModal` / `AddPrinterForm` / `PrinterInfoCard` | Component UI thuần — không test riêng (convention). |

Chạy: `npm run type-check` + `npx jest` + `npm run lint`.

---

## 10. Rủi ro / lưu ý

- **`PrinterInfoCard` phình to** — đã có render-mode + internalfont block; thêm media block × mỗi driver. Nếu vượt ~250 dòng → tách `DriverMediaSection` component con (không test riêng). Plan quyết.
- **`printerDisplaySchema` mất `paperSize`** đụng mọi test dựng `PrinterDisplayValues` / form fixture — mechanical, đếm trước (`grep "paperSize" schemas/__tests__ hooks/__tests__`).
- **`useLayoutMode` trong `PrinterManagementPanel`** — `useWindowDimensions` re-render khi xoay máy; đang giữa form mà xoay phone↔tablet → chuyển inline↔modal, `key` giữ nên state `useAddPrinterFlow` không mất (cùng `editingPrinter?.id`). Chấp nhận (hiếm).
- **Không có nav back cứng** (inline dùng nút "‹ Quay lại" custom, không phải header nav) — nút Android back vật lý trên phone sẽ thoát tab/app thay vì về list. Nice-to-have: `BackHandler` trong `PrinterManagementPanel` khi `mode === 'form'`. Plan quyết (mình nghiêng: thêm, ~5 dòng).
- Sau SP-C: cấu hình `die_cut` được, in thử N hàng được. Vẫn **chưa test thiết bị thật** (không có máy die-cut) — verify khi có hardware (checklist ở spec SP-B §10 note).
- `cutterMode`/`capabilities.cutter` vẫn dormant — người dùng muốn tắt cắt phải sửa storage (chưa UI). Ghi nhận, SP sau.
