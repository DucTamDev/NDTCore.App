import { generateId } from '../../../utils/id';
import { CutterMode, PaperSize, PaperType } from '../models/paper/PaperOptions';
import type { ContinuousPaper } from '../models/paper/PaperOptions';
import { deviceIdOf } from '../models/printer/PrinterConnection';
import type { Printer } from '../models/printer/Printer';
import type { PrinterCapabilities } from '../models/printer/PrinterCapabilities';
import { PrintLanguage, RenderMode } from '../models/printer/PrinterLanguage';
import type { LanguageSelection, PrinterLanguage } from '../models/printer/PrinterLanguage';

/** Giấy mặc định khi tạo máy in mới: cuộn 80mm, cắt cuối job. */
export const DEFAULT_PAPER: ContinuousPaper = {
  type: PaperType.Continuous,
  paperSize: PaperSize.Mm80,
  cutterMode: CutterMode.PerJob,
};

/** ESC/POS in lệnh văn bản nhanh và đủ dấu khi đúng codepage; TSPL dùng font máy thường thiếu dấu nên in ảnh. */
const DEFAULT_RENDER_MODE: Record<PrintLanguage, RenderMode> = {
  [PrintLanguage.EscPos]: RenderMode.Command,
  [PrintLanguage.Tspl]: RenderMode.Raster,
};

/** Khả năng phổ biến theo dòng máy: máy hoá đơn ESC/POS có dao cắt và cổng ngăn kéo, máy tem TSPL thì không. */
const DEFAULT_CAPABILITIES: Record<PrintLanguage, PrinterCapabilities> = {
  [PrintLanguage.EscPos]: { cutter: true, cashDrawer: true, color: false, image: true },
  [PrintLanguage.Tspl]: { cutter: false, cashDrawer: false, color: false, image: true },
};

/** Tên tạm cho máy in mới khi người dùng chưa đặt. */
const DEFAULT_PRINTER_NAME = 'Máy in mới';

/** Cấu hình ngôn ngữ ban đầu cho máy in mới. */
export const createPrinterLanguage = (type: PrintLanguage, selection: LanguageSelection): PrinterLanguage => ({
  type,
  selection,
  renderMode: DEFAULT_RENDER_MODE[type],
});

/** Khả năng mặc định theo ngôn ngữ. */
export const defaultCapabilitiesOf = (type: PrintLanguage): PrinterCapabilities => ({ ...DEFAULT_CAPABILITIES[type] });

/** Máy in mới với mọi giá trị mặc định (thiếu `id` thì sinh mới); nơi gọi ghi đè các field người dùng đã chỉnh. */
export const createPrinterDraft = ({
  id,
  kind,
  connection,
  language,
}: Pick<Printer, 'kind' | 'connection' | 'language'> & Partial<Pick<Printer, 'id'>>): Printer => {
  const now = new Date().toISOString();

  return {
    id: id ?? generateId(),
    deviceId: deviceIdOf(connection),
    kind,
    name: DEFAULT_PRINTER_NAME,
    connection,
    language,
    paper: { ...DEFAULT_PAPER },
    capabilities: defaultCapabilitiesOf(language.type),
    autoReconnect: true,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
};
