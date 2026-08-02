// src/features/printer/schemas/printerFormSchema.ts
import { z } from 'zod';

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

export const printerDisplaySchema = z.object({
  printerName: z.string().min(1, 'Vui lòng nhập tên máy in'),
  paperSize: z.enum(['58mm', '80mm']),
});

export type PrinterDisplayValues = z.infer<typeof printerDisplaySchema>;
