---
description: Testing file organization and naming conventions (frontend, framework-agnostic)
paths:
  - "**/__tests__/**"
  - "**/*.test.*"
  - "**/*.spec.*"
---

# Testing File Organization

Áp dụng chung cho mọi frontend project (Vue, React, React Native, Angular, TypeScript thuần...), không ràng buộc theo framework cụ thể.

## Nguyên tắc

- Test files KHÔNG được colocate cùng thư mục với implementation file.
- Test files PHẢI nằm trong thư mục `__tests__/` riêng, đặt bên trong module/folder tương ứng.
- Dùng một đuôi thống nhất cho toàn project: `.test.*` HOẶC `.spec.*` — chọn một, không trộn lẫn.
  (Ví dụ: Jest/Vitest thường dùng `.test.*`; Angular/Karma thường dùng `.spec.*`. Theo convention sẵn có của project, không tự đổi giữa chừng.)

## Cấu trúc

❌ Không dùng (colocated):
```
src/components/
├── Button.tsx        (hoặc .vue, .ts)
└── Button.test.tsx
```

✅ Dùng:
```
src/components/
├── Button.tsx
└── __tests__/
    └── Button.test.tsx
```

Feature-based (khuyến nghị khi project chia theo feature/module):
```
src/features/printer/
├── components/
│   ├── PrinterCard.tsx        (hoặc .vue)
│   └── __tests__/PrinterCard.test.tsx
├── services/
│   ├── PrinterService.ts
│   └── __tests__/PrinterService.test.ts
├── composables|hooks/
│   ├── usePrinter.ts
│   └── __tests__/usePrinter.test.ts
└── __tests__/printer.test.ts
```

## Naming

Dùng: `<Tên file gốc>.test.<ext>` — ví dụ `Button.test.tsx`, `PrinterCard.test.vue.ts`, `PrinterService.test.ts`, `usePrinter.test.ts`.

Không dùng:
- `ButtonTest.tsx` — thiếu dấu chấm phân tách, sai vị trí "Test"
- `testButton.tsx` — thiếu suffix `.test.`, không rõ là file test
- Trộn lẫn `.test.*` và `.spec.*` trong cùng project

## Phân tầng unit/integration/e2e

Tùy chọn, chỉ áp dụng khi project đủ lớn để cần phân biệt rõ các loại test:
```
__tests__/
├── unit/
├── integration/
└── e2e/
```
Không ép buộc project nhỏ phải có đủ 3 tầng này — tránh over-engineering.