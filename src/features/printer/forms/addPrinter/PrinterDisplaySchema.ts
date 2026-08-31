import { z } from 'zod';

export const printerDisplaySchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên máy in'),
});

export type PrinterDisplayValues = z.infer<typeof printerDisplaySchema>;
