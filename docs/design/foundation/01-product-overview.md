# NDTCore.POS

# Product Overview

> Version: 1.0.0

---

# 1. Giới thiệu

## 1.1 Mục đích

Tài liệu này mô tả tổng quan về sản phẩm **NDTCore.POS**, bao gồm mục tiêu, phạm vi, người dùng, nghiệp vụ và định hướng thiết kế.

Đây là tài liệu đầu tiên cần đọc trước khi nghiên cứu các tài liệu về UI, UX, Design System hoặc Business Rules.

---

## 1.2 Giới thiệu sản phẩm

NDTCore.POS là ứng dụng Point of Sale (POS) chạy trên Android Tablet, phục vụ hoạt động bán hàng tại cửa hàng.

Ứng dụng tập trung vào:

- Bán hàng nhanh
- Quản lý đơn hàng
- Thanh toán
- In hóa đơn
- In bếp
- Quản lý ca làm việc
- Hoạt động ổn định khi mất Internet
- Đồng bộ dữ liệu với hệ thống Cloud

---

## 1.3 Định hướng sản phẩm

NDTCore.POS được xây dựng theo mô hình SaaS Multi-Tenant.

Một hệ thống có thể phục vụ nhiều doanh nghiệp khác nhau.

Mỗi doanh nghiệp có:

- Chuỗi cửa hàng
- Menu riêng
- Giá riêng
- Thuế riêng
- Máy in riêng
- Khuyến mãi riêng
- Người dùng riêng
- Phân quyền riêng

---

# 2. Mục tiêu sản phẩm

## 2.1 Mục tiêu chính

Xây dựng hệ thống POS hiện đại với các tiêu chí:

- Tốc độ thao tác nhanh
- Giao diện trực quan
- Dễ học
- Dễ sử dụng
- Dễ mở rộng
- Hoạt động Offline
- Hỗ trợ nhiều thiết bị
- Hỗ trợ nhiều loại máy in
- Hỗ trợ nhiều hình thức thanh toán

---

## 2.2 Mục tiêu UX

Thu ngân có thể hoàn thành một đơn hàng chỉ với:

1. Chọn danh mục
2. Chọn món
3. Chọn Modifier (nếu có)
4. Thanh toán

Không có bước trung gian không cần thiết.

---

## 2.3 Mục tiêu kỹ thuật

Ứng dụng phải:

- Khởi động nhanh
- Scroll mượt
- Không giật khi có nhiều sản phẩm
- Không mất dữ liệu khi Offline
- Đồng bộ tự động khi Online
- Hỗ trợ nhiều máy in cùng lúc

---

# 3. Đối tượng sử dụng

## 3.1 Thu ngân (Cashier)

### Nhiệm vụ

- Tạo đơn hàng
- Chọn món
- Thanh toán
- In hóa đơn
- Giữ đơn
- Tìm đơn

### Mục tiêu

Hoàn thành giao dịch nhanh nhất.

---

## 3.2 Quản lý cửa hàng

### Nhiệm vụ

- Theo dõi doanh thu
- Quản lý ca
- Quản lý đơn
- Quản lý máy in
- Quản lý nhân viên

---

## 3.3 Quản trị hệ thống

### Nhiệm vụ

- Cấu hình hệ thống
- Quản lý tenant
- Quản lý menu
- Quản lý quyền
- Quản lý cửa hàng

---

# 4. Thiết bị hỗ trợ

## 4.1 Thiết bị chính

Android Tablet

Landscape

Độ phân giải thiết kế:

1280 × 800

---

## 4.2 Thiết bị phụ

Android Phone

Thiết kế giao diện riêng.

Không scale từ Tablet.

---

## 4.3 Thiết bị ngoại vi

- Máy in hóa đơn
- Máy in bếp
- Máy quét mã vạch (tùy chọn)
- Ngăn kéo đựng tiền
- Màn hình khách hàng (tùy chọn)

---

# 5. Đối tượng kinh doanh

Ứng dụng được thiết kế cho:

- Trà sữa
- Cafe
- Nhà hàng
- Đồ uống
- Bakery
- Fast Food

---

# 6. Phạm vi chức năng

## Bao gồm

- Đăng nhập
- Chọn cửa hàng
- Mở ca
- Bán hàng
- Modifier
- Giỏ hàng
- Thanh toán
- In hóa đơn
- In bếp
- Giữ đơn
- Lịch sử đơn
- Refund
- Quản lý máy in
- Báo cáo
- Cài đặt

---

## Không bao gồm

- Quản lý kho
- Quản lý công thức
- CRM
- Kế toán
- Marketing
- Quản lý nhân sự

Các chức năng này thuộc hệ thống Back Office.

---

# 7. Kiến trúc chức năng

```text
Đăng nhập
    │
    ▼
Chọn cửa hàng
    │
    ▼
Mở ca
    │
    ▼
Màn hình bán hàng
    │
    ├── Chọn món
    ├── Modifier
    ├── Giỏ hàng
    ├── Thanh toán
    └── In hóa đơn
```

---

# 8. Danh sách module

| Module | Mô tả |
|---------|------|
| Authentication | Đăng nhập |
| Store | Cửa hàng |
| Shift | Ca làm việc |
| Sales | Bán hàng |
| Cart | Giỏ hàng |
| Product | Sản phẩm |
| Modifier | Tùy chọn |
| Payment | Thanh toán |
| Receipt | Hóa đơn |
| Kitchen | In bếp |
| Printer | Máy in |
| Reports | Báo cáo |
| Settings | Cài đặt |

---

# 9. Vai trò người dùng

| Vai trò | Quyền chính |
|----------|-------------|
| Cashier | Bán hàng |
| Supervisor | Quản lý ca |
| Manager | Quản lý cửa hàng |
| Admin | Quản trị hệ thống |

---

# 10. Luồng sử dụng chính

```text
Đăng nhập
      │
      ▼
Chọn cửa hàng
      │
      ▼
Mở ca
      │
      ▼
Bán hàng
      │
      ▼
Thanh toán
      │
      ▼
In hóa đơn
      │
      ▼
Hoàn thành
```

---

# 11. Chỉ tiêu trải nghiệm người dùng

| Tiêu chí | Mục tiêu |
|----------|----------|
| Thời gian tạo đơn | < 30 giây |
| Thời gian thanh toán | < 10 giây |
| Thời gian tìm sản phẩm | < 3 giây |
| Thời gian mở ứng dụng | < 5 giây |
| Thời gian in hóa đơn | < 3 giây |

---

# 12. Thuật ngữ

| Thuật ngữ | Giải thích |
|-----------|------------|
| POS | Point of Sale |
| Cart | Giỏ hàng |
| Modifier | Tùy chọn sản phẩm |
| Variant | Biến thể sản phẩm |
| Hold Order | Giữ đơn |
| Receipt | Hóa đơn |
| Kitchen Ticket | Phiếu bếp |
| Shift | Ca làm việc |
| Tenant | Doanh nghiệp trong hệ thống đa tenant |

---

# 13. Tài liệu liên quan

Tài liệu tiếp theo cần đọc:

1. `02-design-principles.md`
2. `03-information-architecture.md`
3. `04-navigation.md`

Sau khi hiểu tổng quan sản phẩm mới chuyển sang các tài liệu đặc tả UI, UX và màn hình.