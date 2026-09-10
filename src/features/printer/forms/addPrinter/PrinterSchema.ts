import { z } from 'zod';
import { getDriverCapabilities } from '../../drivers/DriverCapabilities';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import { DriverSource, PrintRenderMode, PrinterDriverType, TsplCodepage } from '../../models/printer/PrinterDriver';
import { CutterMode, PrintPaperType } from '../../models/paper/PrintPaperConfig';
import type { PrintPaperConfig } from '../../models/paper/PrintPaperConfig';
import { PrintType } from '../../models/printing/PrintType';
import { dieCutRowOverflow } from '../../paper/validation';

const paperSizeSchema = z.union([z.literal(58), z.literal(80), z.literal(100), z.literal(104)]);

const DIE_CUT_REQUIRED = ['itemWidthMm', 'itemHeightMm', 'columns', 'horizontalGapMm', 'verticalGapMm'] as const;

const printMediaSchema = z
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
  .superRefine((m, ctx) => {
    if (m.type !== PrintPaperType.DieCut) {
      return;
    }

    for (const f of DIE_CUT_REQUIRED) {
      if (m[f] === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [f], message: `Giấy die-cut cần ${f}` });
      }
    }

    if (m.cutterMode && m.cutterMode !== CutterMode.None) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cutterMode'], message: 'Giấy die-cut không cắt được (răng cưa tự tách)' });
    }

    const overflow = dieCutRowOverflow(m as PrintPaperConfig);

    if (overflow) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['columns'], message: overflow });
    }
  });

const printerCapabilitiesSchema = z.object({ cutter: z.boolean() });

const printContentTypeSchema = z.enum([PrintType.Receipt, PrintType.Label]);

const tsplFontConfigSchema = z.object({
  name: z.string().regex(/^[A-Za-z0-9_-]+$/, 'Tên font chỉ được chứa chữ, số, gạch dưới, gạch ngang'),
  fileName: z.string().min(1),
  fontInstalled: z.boolean(),
});

const tsplInternalFontConfigSchema = z.object({
  codepage: z.enum([TsplCodepage.utf8, TsplCodepage.cp1258, TsplCodepage.cp1252]),
  fontName: z.string().regex(/^[A-Za-z0-9_.-]+$/, 'Tên font chỉ được chứa chữ, số, dấu chấm, gạch dưới, gạch ngang'),
});

const tsplDriverConfigSchema = z.object({
  type: z.literal(PrinterDriverType.tspl),
  renderMode: z.enum([PrintRenderMode.bitmap, PrintRenderMode.truetype, PrintRenderMode.internalfont]),
  font: tsplFontConfigSchema.optional(),
  internalFont: tsplInternalFontConfigSchema.optional(),
  media: printMediaSchema,
});

const escPosDriverConfigSchema = z.object({
  type: z.literal(PrinterDriverType.escpos),
  renderMode: z.enum([PrintRenderMode.encoder, PrintRenderMode.bitmap]).optional(),
  media: printMediaSchema,
});

const printerDriverConfigSchema = z.discriminatedUnion('type', [tsplDriverConfigSchema, escPosDriverConfigSchema]);

/** Invariant doc — không phải chỉ disable checkbox ở UI, spec §8. */
export const printerDriverSchema = z
  .object({
    type: z.enum([PrinterDriverType.escpos, PrinterDriverType.tspl]),
    source: z.enum([DriverSource.auto, DriverSource.manual]),
    contentTypes: z.array(printContentTypeSchema).min(1),
    config: printerDriverConfigSchema,
  })
  .superRefine((driver, ctx) => {
    if (driver.config.type !== driver.type) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'config.type phải khớp với driver.type' });
    }

    const allowed = getDriverCapabilities(driver.type).contentTypes;
    const invalid = driver.contentTypes.filter((ct) => !allowed.includes(ct));

    if (invalid.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Driver ${driver.type} không hỗ trợ content type: ${invalid.join(', ')}`,
      });
    }

    if (driver.config.type === PrinterDriverType.escpos && driver.config.media.type !== PrintPaperType.Continuous) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['config', 'media', 'type'], message: 'ESC/POS chỉ in giấy cuộn liên tục' });
    }
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
 * Safety net ở service layer (invariant #2, #3, #10, #13, spec §8), KHÔNG
 * thay thế validation UI (UI đã tự ngăn phần lớn state không hợp lệ trước
 * khi tới đây).
 */
export const printerSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1),
    vendor: z.string().optional(),
    model: z.string().optional(),
    drivers: z.array(printerDriverSchema).min(1).max(2),
    connection: printerConnectionSchema,
    identityKey: z.string().min(1),
    capabilities: printerCapabilitiesSchema,
    autoReconnect: z.boolean(),
    enabled: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine((printer, ctx) => {
    const seenContentTypes = new Set<string>();
    for (const driver of printer.drivers) {
      for (const contentType of driver.contentTypes) {
        if (seenContentTypes.has(contentType)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Content type "${contentType}" bị gán cho nhiều hơn 1 driver trong cùng printer`,
          });
        }
        seenContentTypes.add(contentType);
      }
    }

    const driverTypes = printer.drivers.map((d) => d.type);
    if (new Set(driverTypes).size !== driverTypes.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Printer không được có 2 driver cùng type' });
    }
  });

export type PrinterValidated = z.infer<typeof printerSchema>;
