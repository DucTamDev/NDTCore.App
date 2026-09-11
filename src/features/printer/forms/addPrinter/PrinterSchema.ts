import { z } from 'zod';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import { DriverSource, RenderMode, PrinterDriverType } from '../../models/printer/PrinterDriver';
import { CutterMode, PaperSize, PrintPaperType } from '../../models/paper/PrintPaperConfig';
import type { PrintPaperConfig } from '../../models/paper/PrintPaperConfig';
import { PrintType } from '../../models/printing/PrintType';
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
    type: z.enum([PrintPaperType.Continuous, PrintPaperType.DieCut]),
    paperSize: paperSizeSchema,
    itemWidthMm: z.number().positive().optional(),
    itemHeightMm: z.number().positive().optional(),
    columns: z.number().int().min(1).optional(),
    horizontalGapMm: z.number().min(0).optional(),
    verticalGapMm: z.number().min(0).optional(),
    cutterMode: z.enum([CutterMode.None, CutterMode.PerJob, CutterMode.PerRow]).optional(),
  })
  .superRefine((paper, ctx) => {
    if (paper.type !== PrintPaperType.DieCut) {
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

    const overflow = dieCutRowOverflow(paper as PrintPaperConfig);

    if (overflow) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['columns'], message: overflow });
    }
  });

const printerCapabilitiesSchema = z.object({ cutter: z.boolean() });

const printerDriverConfigSchema = z.object({ renderMode: z.enum([RenderMode.Encoder, RenderMode.Bitmap]) });

export const printerDriverSchema = z.object({
  type: z.enum([PrinterDriverType.EscPos, PrinterDriverType.Tspl]),
  source: z.enum([DriverSource.Auto, DriverSource.Manual]),
  config: printerDriverConfigSchema,
});

const usbPrinterConnectionSchema = z.object({
  type: z.literal(PrinterConnectionType.Usb),
  vendorId: z.number(),
  productId: z.number(),
  serialNumber: z.string().optional(),
});

const bluetoothPrinterConnectionSchema = z.object({
  type: z.literal(PrinterConnectionType.Bluetooth),
  deviceId: z.string(),
  name: z.string().optional(),
});

const lanPrinterConnectionSchema = z.object({
  type: z.literal(PrinterConnectionType.Lan),
  host: z.string(),
  port: z.number(),
});

const printerConnectionSchema = z.discriminatedUnion('type', [
  usbPrinterConnectionSchema,
  bluetoothPrinterConnectionSchema,
  lanPrinterConnectionSchema,
]);

/**
 * Safety net ở service layer (spec §3), KHÔNG thay thế validation UI (UI đã
 * tự ngăn phần lớn state không hợp lệ trước khi tới đây).
 */
export const printerSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1),
    vendor: z.string().optional(),
    model: z.string().optional(),
    type: z.enum([PrintType.Receipt, PrintType.Label]),
    driver: printerDriverSchema,
    connection: printerConnectionSchema,
    paper: printPaperConfigSchema,
    identityKey: z.string().min(1),
    capabilities: printerCapabilitiesSchema,
    autoReconnect: z.boolean(),
    enabled: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine((printer, ctx) => {
    if (printer.driver.type === PrinterDriverType.EscPos && printer.paper.type !== PrintPaperType.Continuous) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['paper', 'type'], message: 'ESC/POS chỉ in giấy cuộn liên tục' });
    }

    if (printer.driver.type === PrinterDriverType.Tspl && printer.driver.config.renderMode !== RenderMode.Bitmap) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['driver', 'config', 'renderMode'], message: 'TSPL chỉ hỗ trợ chế độ Bitmap' });
    }

    if (!getDriverCapabilities(printer.driver.type).contentTypes.includes(printer.type)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['driver', 'type'], message: `Driver ${printer.driver.type} không hỗ trợ loại nội dung ${printer.type}` });
    }
  });

export type PrinterValidated = z.infer<typeof printerSchema>;
