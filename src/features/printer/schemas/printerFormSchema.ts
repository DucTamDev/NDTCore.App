import { z } from 'zod';
import { getDriverDefinition } from '../drivers/driverDefinitions';
import { ConnectionType, DriverSource, PrinterDriverType, TsplCodepage, TsplRenderMode } from '../types/printer.types';
import { CutterMode, PrintMediaType } from '../models/media/PrintMedia';
import type { PrintMedia } from '../models/media/PrintMedia';
import { PrintType } from '../models/printing/PrintType';
import { dieCutRowOverflow } from '../media/validation';

const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

const isValidIpv4 = (value: string): boolean => {
  if (!ipv4Regex.test(value)) return false;
  return value.split('.').every((segment) => Number(segment) >= 0 && Number(segment) <= 255);
};

const isValidPort = (value: string): boolean => {
  const port = Number(value);
  return value.length > 0 && !Number.isNaN(port) && port >= 1 && port <= 65535;
};

export const lanConnectionSchema = z.object({
  lanIp: z.string().refine(isValidIpv4, 'Địa chỉ IP không hợp lệ'),
  lanPort: z.string().refine(isValidPort, 'Cổng không hợp lệ (1-65535)'),
});

export type LanConnectionValues = z.infer<typeof lanConnectionSchema>;

const paperSizeSchema = z.union([z.literal(58), z.literal(80), z.literal(100), z.literal(104)]);

export const printerDisplaySchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên máy in'),
});

const DIE_CUT_REQUIRED = ['itemWidthMm', 'itemHeightMm', 'columns', 'horizontalGapMm', 'verticalGapMm'] as const;

const printMediaSchema = z
  .object({
    type: z.enum([PrintMediaType.continuous, PrintMediaType.dieCut]),
    paperSize: paperSizeSchema,
    itemWidthMm: z.number().positive().optional(),
    itemHeightMm: z.number().positive().optional(),
    columns: z.number().int().min(1).optional(),
    horizontalGapMm: z.number().min(0).optional(),
    verticalGapMm: z.number().min(0).optional(),
    cutterMode: z.enum([CutterMode.none, CutterMode.perJob, CutterMode.perRow]).optional(),
  })
  .superRefine((m, ctx) => {
    if (m.type !== PrintMediaType.dieCut) return;
    for (const f of DIE_CUT_REQUIRED) {
      if (m[f] === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [f], message: `Giấy die-cut cần ${f}` });
    }
    if (m.cutterMode && m.cutterMode !== CutterMode.none) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cutterMode'], message: 'Giấy die-cut không cắt được (răng cưa tự tách)' });
    }
    const overflow = dieCutRowOverflow(m as PrintMedia);
    if (overflow) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['columns'], message: overflow });
  });

const printerCapabilitiesSchema = z.object({ cutter: z.boolean() });

export type PrinterDisplayValues = z.infer<typeof printerDisplaySchema>;

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
  renderMode: z.enum([TsplRenderMode.bitmap, TsplRenderMode.truetype, TsplRenderMode.internalfont]),
  font: tsplFontConfigSchema.optional(),
  internalFont: tsplInternalFontConfigSchema.optional(),
  media: printMediaSchema,
});

const escPosDriverConfigSchema = z.object({
  type: z.literal(PrinterDriverType.escpos),
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
    const allowed = getDriverDefinition(driver.type).contentTypes;
    const invalid = driver.contentTypes.filter((ct) => !allowed.includes(ct));
    if (invalid.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Driver ${driver.type} không hỗ trợ content type: ${invalid.join(', ')}`,
      });
    }
    if (driver.config.type === PrinterDriverType.escpos && driver.config.media.type !== PrintMediaType.continuous) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['config', 'media', 'type'], message: 'ESC/POS chỉ in giấy cuộn liên tục' });
    }
  });

const printerDeviceSchema = z.object({
  deviceId: z.string(),
  displayName: z.string(),
  rawDevice: z.record(z.unknown()),
});

const printerLanConfigSchema = z.object({
  ip: z.string(),
  port: z.number(),
});

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
    connectionType: z.enum([ConnectionType.usb, ConnectionType.bluetooth, ConnectionType.lan]),
    device: printerDeviceSchema.optional(),
    lan: printerLanConfigSchema.optional(),
    identityKey: z.string().min(1),
    capabilities: printerCapabilitiesSchema,
    autoReconnect: z.boolean(),
    enabled: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine((printer, ctx) => {
    if (printer.connectionType === ConnectionType.lan) {
      if (!printer.lan) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'connectionType lan bắt buộc phải có lan' });
      if (printer.device) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'connectionType lan không được có device' });
    } else {
      if (!printer.device) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `connectionType ${printer.connectionType} bắt buộc phải có device` });
      }
      if (printer.lan) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `connectionType ${printer.connectionType} không được có lan` });
      }
    }

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
