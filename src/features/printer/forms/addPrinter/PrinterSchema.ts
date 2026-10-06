import { z } from 'zod';
import { ConnectionType } from '../../models/printer/ConnectionType';
import { LanguageSelection, PrintLanguage } from '../../models/printer/PrinterLanguage';
import { CutterMode } from '../../models/paper/CutterMode';
import { PaperSize } from '../../models/paper/PaperSize';
import { PaperType } from '../../models/paper/PaperType';
import { PrintKind } from '../../models/printer/PrintKind';
import { dieCutRowOverflow } from '../../utils/paperUtils';
import { canPrintKind } from './printerRules';

const paperSizeSchema = z.union([
  z.literal(PaperSize.Mm58),
  z.literal(PaperSize.Mm80),
  z.literal(PaperSize.Mm100),
  z.literal(PaperSize.Mm104),
]);

const continuousPaperSchema = z.object({
  type: z.literal(PaperType.Continuous),
  paperSize: paperSizeSchema,
  cutterMode: z.enum([CutterMode.None, CutterMode.PerJob, CutterMode.PerRow]),
});

const dieCutPaperSchema = z.object({
  type: z.literal(PaperType.DieCut),
  paperSize: paperSizeSchema,
  itemWidthMm: z.number().positive(),
  itemHeightMm: z.number().positive(),
  columns: z.number().int().min(1),
  horizontalGapMm: z.number().min(0),
  verticalGapMm: z.number().min(0),
});

const paperOptionsSchema = z.discriminatedUnion('type', [continuousPaperSchema, dieCutPaperSchema]).superRefine((paper, ctx) => {
  const overflow = dieCutRowOverflow(paper);

  if (overflow) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['columns'], message: overflow });
  }
});

const printerCapabilitiesSchema = z.object({
  cutter: z.boolean(),
  cashDrawer: z.boolean(),
  color: z.boolean(),
  image: z.boolean(),
});

const printerLanguageSchema = z.object({
  type: z.enum([PrintLanguage.EscPos, PrintLanguage.Tspl]),
  selection: z.enum([LanguageSelection.Auto, LanguageSelection.Manual]),
});

const usbPrinterConnectionSchema = z.object({
  type: z.literal(ConnectionType.Usb),
  vendorId: z.number(),
  productId: z.number(),
  serialNumber: z.string().optional(),
});

const bluetoothPrinterConnectionSchema = z.object({
  type: z.literal(ConnectionType.Bluetooth),
  mac: z.string(),
});

const lanPrinterConnectionSchema = z.object({
  type: z.literal(ConnectionType.Lan),
  host: z.string(),
  port: z.number(),
});

const printerConnectionSchema = z.discriminatedUnion('type', [
  usbPrinterConnectionSchema,
  bluetoothPrinterConnectionSchema,
  lanPrinterConnectionSchema,
]);

/** Lưới an toàn khi lưu ở tầng service; UI đã tự chặn phần lớn trạng thái sai trước khi tới đây. */
export const printerSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1),
    vendor: z.string().optional(),
    model: z.string().optional(),
    kind: z.enum([PrintKind.Receipt, PrintKind.Label]),
    language: printerLanguageSchema,
    connection: printerConnectionSchema,
    paper: paperOptionsSchema,
    deviceId: z.string().min(1),
    capabilities: printerCapabilitiesSchema,
    autoReconnect: z.boolean(),
    enabled: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine((printer, ctx) => {
    if (printer.language.type === PrintLanguage.EscPos && printer.paper.type !== PaperType.Continuous) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['paper', 'type'], message: 'ESC/POS chỉ in giấy cuộn liên tục' });
    }

    if (!canPrintKind(printer.language.type, printer.kind)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['language', 'type'],
        message: `Ngôn ngữ ${printer.language.type} không in được loại nội dung ${printer.kind}`,
      });
    }
  });

export type PrinterValidated = z.infer<typeof printerSchema>;
