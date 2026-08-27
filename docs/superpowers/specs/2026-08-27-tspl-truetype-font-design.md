# TSPL TrueType Font — Design Specification

## 1. Phạm vi & mục tiêu

Thêm khả năng in bằng font TrueType thật (thay vì bitmap chụp lại từ `useBillImageCapture`) cho driver TSPL, dưới dạng **tùy chọn cấu hình có thể bật/tắt lại (switchable), không phải thay thế cứng cơ chế bitmap hiện tại**. Đây là phần đã bị loại khỏi refactor kiến trúc trước đó (`docs/superpowers/specs/2026-08-26-printer-architecture-refactor-design.md` §1) vì chưa được xác nhận khả thi trên phần cứng thật — spec này mở lại phần đó với thiết kế cụ thể, nhưng **không** có xác nhận phần cứng thật đi kèm.

**Điều kiện triển khai:** không có máy in TSPL thật để test trong phiên thiết kế này, và không có tài liệu TSPL riêng của máy in đang dùng — thiết kế dựa trên cú pháp TSPL2 phổ biến (`DOWNLOAD`, `TEXT x,y,"tên_font",...`). **Toàn bộ phần gửi lệnh xuống máy in thật (DOWNLOAD có được chấp nhận, font có thật sự render đúng) là CHƯA XÁC NHẬN — chỉ được kiểm chứng khi người dùng tự test trên phần cứng thật của họ.**

**Nguyên tắc chốt, ràng buộc toàn bộ thiết kế:** TrueType là tính năng optional/experimental — lỗi ở bất kỳ bước nào của nó (cài font thất bại, config sai, DOWNLOAD không được máy in chấp nhận) **không bao giờ được làm fail toàn bộ print job**. Bitmap luôn là fallback an toàn, kể cả khi người dùng đã bật `renderMode: 'truetype'`.

---

## 2. Chuỗi rủi ro kỹ thuật (ghi rõ để không đánh giá thấp)

```text
TSPL command syntax hợp lệ (theo tài liệu chuẩn)
        ↓
Firmware máy in thật có hỗ trợ DOWNLOAD font custom không?
        ↓
Định dạng font máy in chấp nhận là gì? (không nhất thiết là .ttf thô —
nhiều máy in TSPL/clone chỉ nhận font đã convert sang định dạng nhị phân
riêng của hãng, tạo bằng tool Windows như BarTender/NiceLabel/tool riêng
của TSC — KHÔNG có gì đảm bảo DOWNLOAD 1 file .ttf thô sẽ được máy in
hiểu đúng)
        ↓
Font có được máy in "đăng ký"/nhận diện tên để gọi qua TEXT không?
        ↓
TEXT render ra đúng glyph tiếng Việt không?
```

Command hợp lệ về cú pháp **không đảm bảo** bất kỳ bước nào phía dưới thành công. Spec này chỉ có thể thiết kế đúng bước đầu tiên; các bước còn lại là ẩn số cho tới khi test trên phần cứng thật.

---

## 3. Data Model

```ts
// types/printer.types.ts — mở rộng TsplDriverConfig hiện có
export type TsplRenderMode = 'bitmap' | 'truetype'; // mở rộng từ literal đơn 'bitmap' của refactor trước

export interface TsplFontConfig {
  /**
   * Tên logical dùng trong lệnh `TEXT x,y,"<name>",...` để gọi font đã
   * DOWNLOAD — KHÔNG nhất thiết trùng `fileName`. Phải khớp
   * `/^[A-Za-z0-9_-]+$/` (validate ở schema) để không tạo ra command TSPL
   * hỏng nếu tên chứa ký tự đặc biệt/dấu ngoặc kép.
   */
  name: string;
  /** Tên file `.ttf` trong `assets/fonts/` của app — dùng để đọc nội dung gửi DOWNLOAD, không dùng để gọi TEXT. */
  fileName: string;
  /**
   * Chỉ có nghĩa: "lệnh DOWNLOAD đã gửi xong không lỗi ở tầng transport".
   * KHÔNG đảm bảo máy in thật sự lưu/nhận diện được font — không có cách
   * nào từ phần mềm xác nhận điều đó (giống hạn chế identityKey USB đã
   * ghi trong refactor trước — không tạo giải pháp giả cho việc không thể
   * biết chắc).
   */
  fontInstalled: boolean;
}

export interface TsplDriverConfig {
  type: 'tspl';
  renderMode: TsplRenderMode; // mặc định 'bitmap' — không đổi hành vi cũ nếu người dùng không bật
  font?: TsplFontConfig;       // chỉ có khi renderMode từng được đặt 'truetype' ít nhất 1 lần
  labelHeightMm?: number;
}
```

Không thêm `version`/`fontHash` ở phase này — hiện chỉ có đúng 1 file font bundle sẵn trong app, không có UI cho phép người dùng đổi font, nên "font bị đổi mà app không biết" chưa có đường xảy ra. Nếu sau này có UI chọn nhiều font, đây là việc cần làm thêm, không phải bây giờ.

---

## 4. Font asset

Đọc byte thô của file `.ttf` qua **`react-native-fs`** (dependency mới, chỉ dùng cho tính năng này) — `require()`/Metro bundler không cho truy cập byte thô của asset không phải ảnh, nên không dùng được `src/assets/`. `RNFS.readFileAssets(path, 'base64')` chỉ đọc được từ thư mục asset **native Android** (`android/app/src/main/assets/`), không phải thư mục JS — vì vậy file font phải đặt tại `android/app/src/main/assets/fonts/`, KHÔNG phải `src/assets/fonts/`. Tính năng này do đó chỉ verify được trên Android; iOS chưa có đường dẫn tương đương được thiết kế ở phase này (tương tự giới hạn "USB chỉ Android" đã có sẵn trong module).

Font mặc định đã bundle: **Roboto-Regular** (`android/app/src/main/assets/fonts/Roboto-Regular.ttf`, ~145KB) — người dùng chọn từ bộ font UI có sẵn của app, hỗ trợ tiếng Việt. `DEFAULT_TSPL_FONT.fileName` trong `TsplFontManager.ts` trỏ đúng file này.

---

## 5. `TsplFontManager` (mới — `drivers/tspl/TsplFontManager.ts`)

**Trách nhiệm DUY NHẤT: thực hiện hành động cài font, không quản lý state.**

```ts
export interface TsplFontManager {
  /**
   * Đọc file `.ttf` qua `react-native-fs` (`RNFS.readFileAssets`, chỉ
   * Android — xem §4), gửi qua lệnh `DOWNLOAD "<name>",<byteCount>` +
   * byte nhị phân thô theo sau (cú pháp TSPL2 phổ biến — CHƯA xác nhận
   * trên phần cứng thật, xem §2). Resolve nếu transport gửi xong không
   * lỗi. Throw nếu: platform không phải Android, không đọc được file
   * font từ assets, hoặc transport lỗi (mất kết nối, timeout...).
   * KHÔNG tự đặt `fontInstalled` — đó là việc của caller (xem §6).
   */
  ensureFontInstalled(transport: TsplTransport, font: TsplFontConfig): Promise<void>;
}
```

`ensureFontInstalled` không catch lỗi transport — để nguyên throw ra ngoài, caller tự quyết định xử lý (đúng nguyên tắc: driver/manager không nuốt lỗi, chỉ orchestration layer phía trên mới quyết định fallback UX).

### 5.1 Wiring — UI không được chạm thẳng vào transport

`transport` mà `ensureFontInstalled` cần là instance sống bên trong `TsplDriver.connections` (private) — không expose ra ngoài, đúng convention "UI không bao giờ gọi thẳng driver/transport, luôn qua `PrinterService`". Vì vậy:

- `TsplDriver` (class, `drivers/tspl/TsplDriver.ts`) thêm 1 method mới:
  ```ts
  async installTrueTypeFont(printerId: string, font: TsplFontConfig): Promise<void> {
    const transport = this.connections.get(printerId);
    if (!transport) throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Máy in chưa kết nối' });
    await this.fontManager.ensureFontInstalled(transport, font);
  }
  ```
  (`fontManager` là instance `TsplFontManager` được `TsplDriver` tự khởi tạo trong constructor, giống cách nó tự tạo `TsplEncoder` mỗi lần cần.)
- `PrinterService` (`printing/PrinterService.ts`) thêm 1 passthrough TSPL-riêng (không đưa vào `IPrinterDriver` chung — tính năng này chỉ có nghĩa với TSPL, ESC/POS không có khái niệm font custom):
  ```ts
  const installTsplFont = async (printerId: string, font: TsplFontConfig): Promise<void> => {
    const tsplDriver = getDriver('tspl') as TsplDriver;
    await tsplDriver.installTrueTypeFont(printerId, font);
  };
  ```
  Cast trực tiếp sang `TsplDriver` vì `PrinterService` đã biết cụ thể `DriverRegistry.tspl` luôn là instance `TsplDriver` (tương tự cách các nơi khác trong codebase đã chấp nhận biết cụ thể loại driver khi cần thao tác riêng theo protocol).
- `AddPrinterModal.tsx`/`PrinterInfoCard.tsx` gọi qua `PrinterService.installTsplFont(printerId, font)` — không import gì từ `drivers/tspl/` trực tiếp.

---

## 6. Luồng cập nhật state (gọi từ `AddPrinterModal.tsx`, qua `PrinterService.installTsplFont`)

```text
Người dùng bật switch "In bằng font TrueType (thử nghiệm)"
        ↓
validate TsplFontConfig.name khớp /^[A-Za-z0-9_-]+$/ (nếu sai, báo lỗi ngay, không gọi ensureFontInstalled)
        ↓
gọi TsplFontManager.ensureFontInstalled(transport, font)
        ↓
   ┌────────────┴────────────┐
   ▼                         ▼
resolve (thành công)      throw (thất bại)
   │                         │
   ▼                         ▼
setConfig({                setConfig({ renderMode: 'bitmap' })
  renderMode: 'truetype',  + hiện lỗi qua Snackbar sẵn có
  font: { ...font, fontInstalled: true }
})
```

`TsplFontManager` chỉ trả về thành công/thất bại của HÀNH ĐỘNG gửi lệnh — việc quyết định `renderMode`/`font.fontInstalled` cuối cùng là gì hoàn toàn nằm ở tầng gọi (component/state), không phải trong manager.

---

## 7. Render selection trong `TsplDriver` — fallback cứng, không có nhánh nào khác

```ts
// TsplDriver.ts — nội bộ, KHÔNG tách class riêng ở phase này (dự án còn nhỏ, spec chỉ định
// nghĩa ranh giới để dễ tách EscPosRenderer/TrueTypeRenderer sau này nếu có mode thứ 3)
private resolveEffectiveRenderMode(config: TsplDriverConfig): 'bitmap' | 'truetype' {
  return config.renderMode === 'truetype' && config.font?.fontInstalled ? 'truetype' : 'bitmap';
}

private renderBitmap(documents: PrintDocumentVariants, ...): Uint8Array { /* logic hiện tại — image ưu tiên, TEXT dùng font "3" */ }
private renderTrueType(documents: PrintDocumentVariants, font: TsplFontConfig, ...): Uint8Array { /* documents.text, TEXT dùng font.name */ }

encode(printer, driver, documents, printType) {
  const config = driver.config as TsplDriverConfig;
  return this.resolveEffectiveRenderMode(config) === 'truetype'
    ? this.renderTrueType(documents, config.font!, ...)
    : this.renderBitmap(documents, ...);
}
```

**Đây là fallback CỨNG, không phụ thuộc gì ngoài `config.renderMode` + `config.font?.fontInstalled`** — không có try/catch runtime nào khác cần thiết, vì mọi trạng thái lỗi đã được loại trừ TRƯỚC khi tới bước encode (§6 đảm bảo `renderMode` chỉ là `'truetype'` khi `fontInstalled` đã `true`).

### Bảng fallback đầy đủ

| Điều kiện | Kết quả render |
|---|---|
| `renderMode: 'bitmap'` | Bitmap (hành vi hiện tại, không đổi) |
| `renderMode: 'truetype'` + `font.fontInstalled: true` | TrueType |
| `renderMode: 'truetype'` + `font.fontInstalled: false`/`undefined` | Bitmap |
| Cài font thất bại (§6) | Bitmap — `renderMode` không bao giờ được set `'truetype'` nếu cài thất bại |
| `font.name` không khớp regex | Bitmap + báo lỗi ngay tại UI, không gọi `ensureFontInstalled` |
| Reconnect cùng printer, `font.fontInstalled` vẫn `true` | Không `DOWNLOAD` lại — dùng luôn `'truetype'` |
| Máy in mất điện/factory reset giữa 2 lần kết nối, `font.fontInstalled` vẫn `true` (app không biết) | Không phát hiện được — vẫn dùng `'truetype'`, có thể in sai/trắng. Giới hạn đã biết, chấp nhận được vì không có cách verify từ software (tương tự giới hạn identify() qua USB). Người dùng tự tắt/bật lại switch nếu nghi ngờ. |
| Đổi sang printer khác | Tính lại từ đầu — tự nhiên đúng vì `TsplDriverConfig` nằm trong từng `PrinterDriver` của từng `Printer` riêng, không có state global dùng chung |

---

## 8. UI (`PrinterInfoCard.tsx`)

Driver card TSPL: thay dòng tĩnh "Chế độ render: Bitmap" (từ refactor trước) bằng `AppSwitch` **"In bằng font TrueType (thử nghiệm)"**. Khi bật:
1. Validate `name` (nếu chưa có `font` config, dùng giá trị mặc định cố định trong code — `DEFAULT_TSPL_FONT`: `name: 'VIETFONT'`, `fileName: 'Roboto-Regular.ttf'` — không cần UI nhập tay tên font ở phase này, chỉ 1 font bundle sẵn).
2. Gọi `ensureFontInstalled` (hiện loading ngắn trên switch).
3. Theo luồng §6 — thành công thì giữ switch bật, thất bại thì switch tự tắt lại (revert) + Snackbar báo lỗi.

Khi tắt switch: chỉ đổi `renderMode: 'bitmap'`, giữ nguyên `font.fontInstalled` (không cần `DOWNLOAD` lại nếu bật lại sau đó trong cùng phiên kết nối).

---

## 9. Testing

- **Unit test được** (mock transport): `TsplFontManager.ensureFontInstalled` gửi đúng lệnh `DOWNLOAD` với payload base64/binary đúng định dạng đọc từ file test giả; `TsplDriver.resolveEffectiveRenderMode`/`renderTrueType`/`renderBitmap` — toàn bộ bảng fallback ở §7 cần có test riêng cho từng dòng.
- **KHÔNG unit test được** (và không giả vờ test được): máy in thật có chấp nhận `DOWNLOAD` không, font có thật sự render đúng dấu tiếng Việt không. Đây là giới hạn đã biết, ghi rõ trong code comment tại `TsplFontManager`, không che giấu bằng test giả.

---

## 10. Ngoài phạm vi

- Font version/hash tracking (chỉ cần khi có UI đổi font — chưa có).
- UI cho phép người dùng chọn/nhập nhiều font khác nhau (chỉ 1 font bundle sẵn ở phase này).
- Capability detection thật (hỏi máy in "bạn có hỗ trợ DOWNLOAD font không" trước khi thử) — TSPL không có lệnh chuẩn nào trả lời câu hỏi này một cách đáng tin, tương tự giới hạn `identify()` qua USB đã ghi trong refactor trước.
