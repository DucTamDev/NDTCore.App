// src/features/printer/schemas/printerFormSchema.ts
import { z } from 'zod';
import { getDriverDefinition } from '../definitions/PrinterDriverDefinitions';

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

const paperSizeSchema = z.union([z.literal(58), z.literal(80)]);

export const printerDisplaySchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên máy in'),
  paperSize: paperSizeSchema,
});

export type PrinterDisplayValues = z.infer<typeof printerDisplaySchema>;

const printContentTypeSchema = z.enum(['Receipt', 'Label']);

const tsplFontConfigSchema = z.object({
  name: z.string().regex(/^[A-Za-z0-9_-]+$/, 'Tên font chỉ được chứa chữ, số, gạch dưới, gạch ngang'),
  fileName: z.string().min(1),
  fontInstalled: z.boolean(),
});

const tsplDriverConfigSchema = z.object({
  type: z.literal('tspl'),
  renderMode: z.enum(['bitmap', 'truetype']),
  font: tsplFontConfigSchema.optional(),
  labelHeightMm: z.number().positive().optional(),
});

const escPosDriverConfigSchema = z.object({
  type: z.literal('escpos'),
});

const printerDriverConfigSchema = z.discriminatedUnion('type', [tsplDriverConfigSchema, escPosDriverConfigSchema]);

/**
 * Validate 1 `PrinterDriver`: `config.type` phải khớp `type`, và `contentTypes`
 * phải là tập con capability của `PrinterDriverDefinitions[type]` (invariant
 * doc — không phải chỉ disable checkbox ở UI, spec §8).
 */
export const printerDriverSchema = z
  .object({
    type: z.enum(['escpos', 'tspl']),
    source: z.enum(['auto', 'manual']),
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
 * Validate toàn bộ `Printer` trước khi persist — safety net ở service layer
 * (invariant #2, #3, #10, #13, spec §8), KHÔNG thay thế validation UI (UI đã
 * tự ngăn phần lớn state không hợp lệ trước khi tới đây).
 */
export const printerSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1),
    vendor: z.string().optional(),
    model: z.string().optional(),
    drivers: z.array(printerDriverSchema).min(1).max(2),
    connectionType: z.enum(['usb', 'bluetooth', 'lan']),
    device: printerDeviceSchema.optional(),
    lan: printerLanConfigSchema.optional(),
    identityKey: z.string().min(1),
    paperSize: paperSizeSchema,
    autoReconnect: z.boolean(),
    enabled: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine((printer, ctx) => {
    if (printer.connectionType === 'lan') {
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
