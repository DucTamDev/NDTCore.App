import { z } from 'zod';
import { ConnectionType } from '../../models/printer/ConnectionType';
import { LanguageSelection, RenderMode, PrintLanguage, RasterSource } from '../../models/printer/PrinterLanguage';
import { CutterMode, PaperSize, PaperType } from '../../models/paper/PaperOptions';
import type { PaperOptions } from '../../models/paper/PaperOptions';
import { PrintKind } from '../../models/printer/PrintKind';
import { dieCutRowOverflow } from '../../paper/validation';
import { getDriverCapabilities } from '../../drivers/DriverCapabilities';

const paperSizeSchema = z.union([
  z.literal(PaperSize.Mm58),
  z.literal(PaperSize.Mm80),
  z.literal(PaperSize.Mm100),
  z.literal(PaperSize.Mm104),
]);

const DIE_CUT_REQUIRED = ['itemWidthMm', 'itemHeightMm', 'columns', 'horizontalGapMm', 'verticalGapMm'] as const;

const printPaperConfigSchema = z
  .object({
    type: z.enum([PaperType.Continuous, PaperType.DieCut]),
    paperSize: paperSizeSchema,
    itemWidthMm: z.number().positive().optional(),
    itemHeightMm: z.number().positive().optional(),
    columns: z.number().int().min(1).optional(),
    horizontalGapMm: z.number().min(0).optional(),
    verticalGapMm: z.number().min(0).optional(),
    cutterMode: z.enum([CutterMode.None, CutterMode.PerJob, CutterMode.PerRow]).optional(),
  })
  .superRefine((paper, ctx) => {
    if (paper.type !== PaperType.DieCut) {
      return;
    }

    for (const f of DIE_CUT_REQUIRED) {
      if (paper[f] === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [f], message: `Giấy die-cut cần ${f}` });
      }
    }

    if (paper.cutterMode && paper.cutterMode !== CutterMode.None) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cutterMode'], message: 'Giấy die-cut không cắt được (răng cưa tự tách)' });
    }

    const overflow = dieCutRowOverflow(paper as PaperOptions);

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
  renderMode: z.enum([RenderMode.Command, RenderMode.Raster]),
  rasterSource: z.enum([RasterSource.Image, RasterSource.Ast]),
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
    paper: printPaperConfigSchema,
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

    if (!getDriverCapabilities(printer.language.type).contentTypes.includes(printer.kind)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['language', 'type'],
        message: `Ngôn ngữ ${printer.language.type} không in được loại nội dung ${printer.kind}`,
      });
    }
  });

export type PrinterValidated = z.infer<typeof printerSchema>;
