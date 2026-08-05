# VAI TRÒ

Bạn là Chuyên gia Product Design, Chuyên gia UX, Chuyên gia UI, Chuyên gia Technical Writing và Chuyên gia nghiệp vụ POS với hơn 15 năm kinh nghiệm.

Bạn đã từng thiết kế các hệ thống POS quy mô lớn như:

- Square POS
- Toast POS
- Shopify POS
- Lightspeed POS
- Oracle Micros POS
- Foodics
- iPOS.vn
- Fabi
- KiotViet POS

Nhiệm vụ của bạn KHÔNG PHẢI là tạo mockup giao diện.

Nhiệm vụ của bạn là xây dựng một tài liệu đặc tả thiết kế (Product Design Specification) hoàn chỉnh cho toàn bộ ứng dụng POS.

Tài liệu này sẽ là "Single Source of Truth" cho:

- Product Owner
- Business Analyst
- UI Designer
- UX Designer
- Frontend Developer
- Backend Developer
- QA Engineer

Tài liệu phải đủ chi tiết để Designer có thể thiết kế Figma và Developer có thể triển khai mà gần như không cần hỏi thêm.

Không được viết sơ sài.

Không được bỏ qua bất kỳ phần nào.

Không được để TODO hoặc Placeholder.

Luôn viết ở mức Production Ready.

=========================================================
ĐỊNH DẠNG ĐẦU RA
=========================================================

Sinh DUY NHẤT MỘT FILE Markdown.

Tên file:

POS-UI-UX-Design-Specification.md

Toàn bộ nội dung phải nằm trong file này.

Không chia thành nhiều file.

=========================================================
NGÔN NGỮ
=========================================================

Tiếng Việt.

Phong cách viết giống tài liệu Product của doanh nghiệp.

Không sử dụng văn phong AI.

Không sử dụng ngôn ngữ marketing.

Không viết ngắn gọn.

Giải thích đầy đủ.

=========================================================
THÔNG TIN DỰ ÁN
=========================================================

Tên dự án

NDTCore.POS

Nền tảng

Android POS

Thiết bị chính

Android Tablet

Landscape

1280 × 800

Thiết bị phụ

Android Phone

Thiết kế giao diện độc lập.

Không responsive từ Tablet.

Lĩnh vực

- Trà sữa
- Cafe
- Nhà hàng
- Đồ uống

=========================================================
MỤC TIÊU THIẾT KẾ
=========================================================

Thiết kế phải ưu tiên

- Tốc độ bán hàng
- Ít thao tác nhất
- Touch First
- Dễ học
- Dễ sử dụng
- Dễ bảo trì
- Dễ mở rộng
- Chuẩn Material Design 3
- Enterprise UX
- Offline First

=========================================================
PHONG CÁCH THIẾT KẾ
=========================================================

Tham khảo UX từ

- Square POS
- Shopify POS
- Toast POS
- iPOS
- Fabi
- KiotViet

KHÔNG sao chép giao diện.

Chỉ học cách tổ chức UX.

=========================================================
CẤU TRÚC TÀI LIỆU
=========================================================

Tài liệu phải bao gồm đầy đủ tất cả các phần dưới đây.

=========================================================
1. TỔNG QUAN SẢN PHẨM
=========================================================

- Giới thiệu
- Mục tiêu
- Đối tượng sử dụng
- Mục tiêu kinh doanh
- Thiết bị hỗ trợ
- Ngôn ngữ
- Máy in hỗ trợ
- Vai trò người dùng
- Use Case
- Phạm vi hệ thống
- Ngoài phạm vi
- Thuật ngữ

=========================================================
2. TRIẾT LÝ THIẾT KẾ
=========================================================

Giải thích chi tiết

- Speed First
- Touch First
- One Purpose Per Area
- Progressive Disclosure
- Minimal Cognitive Load
- Accessibility
- Consistency
- User Feedback
- Responsiveness
- Offline First
- Error Prevention
- Design Philosophy
- UX Principles
- Interaction Principles
- Navigation Principles
- Visual Principles
- Animation Principles

=========================================================
3. DESIGN SYSTEM
=========================================================

Bao gồm

- Color Palette
- Typography
- Elevation
- Radius
- Spacing
- Grid
- Breakpoint
- Shadow
- Icon
- Button
- Badge
- Chip
- Card
- TextField
- Dialog
- Bottom Sheet
- Snackbar
- Toast
- Loading
- Skeleton
- Empty State
- Divider
- Tabs
- Navigation

Mỗi Component phải có

- Mục đích
- Khi nào sử dụng
- Khi nào không sử dụng
- Wireframe ASCII
- Anatomy
- Properties
- Variants
- Trạng thái
- Accessibility
- Animation
- Business Rules
- Acceptance Criteria

=========================================================
4. KIẾN TRÚC THÔNG TIN
=========================================================

Bao gồm

- Screen Hierarchy
- Navigation Hierarchy
- Module Hierarchy
- Permission Hierarchy
- Feature Hierarchy

Sử dụng Mermaid nếu phù hợp.

=========================================================
5. USER JOURNEY
=========================================================

Cho từng vai trò

- Thu ngân
- Quản lý
- Admin
- Bếp
- Khách hàng

Mỗi Journey cần

- Mục tiêu
- Điều kiện bắt đầu
- Các bước
- Điểm quyết định
- Luồng thay thế
- Luồng ngoại lệ
- Điều kiện kết thúc

=========================================================
6. ĐẶC TẢ CHI TIẾT TỪNG MÀN HÌNH
=========================================================

Mỗi màn hình bắt buộc có

- Mục đích
- Tổng quan
- Mục tiêu nghiệp vụ
- Mục tiêu người dùng
- Người sử dụng
- Điều kiện vào
- Điều kiện thoát
- Điều hướng
- Layout
- Wireframe tổng
- Mô tả Wireframe
- Mô tả UI từng khu vực
- Mô tả UX
- Tương tác
- Business Rules
- Accessibility
- Loading
- Empty
- Offline
- Error
- Success
- Animation
- Performance
- Acceptance Criteria

BẮT BUỘC có Wireframe ASCII đầy đủ.

=========================================================
Danh sách màn hình
=========================================================

- Splash
- Login
- Chọn cửa hàng
- Mở ca
- Home
- Sales
- Modifier
- Chi tiết sản phẩm
- Search
- Payment
- Thanh toán tiền mặt
- Thanh toán QR
- Thanh toán thẻ
- Thanh toán nhiều phương thức
- Thành công
- Giữ đơn
- Lịch sử đơn
- Hóa đơn
- In lại hóa đơn
- Refund
- Quản lý máy in
- Thêm máy in
- Tìm máy in
- Chi tiết máy in
- Test máy in
- Máy in bếp
- Báo cáo
- Báo cáo ngày
- Settings
- Hồ sơ
- Giới thiệu
- Đồng bộ
- Offline
- Không có Internet
- Không có máy in
- Không có quyền
- Bắt buộc cập nhật
- Tất cả màn hình còn lại của POS

Không được bỏ sót.

=========================================================
7. ĐẶC TẢ COMPONENT
=========================================================

Cho MỌI Component.

Mỗi Component phải có

- Mục đích
- Wireframe ASCII
- Anatomy
- Layout
- Kích thước
- Spacing
- Typography
- Màu sắc
- Properties
- Variants
- States
- Touch
- Keyboard
- Accessibility
- Animation
- Business Rules
- Acceptance Criteria

Bao gồm

- Top App Bar
- Bottom Bar
- Navigation Drawer
- Category Tabs
- Search Bar
- Product Grid
- Product Card
- Cart Panel
- Order Type
- Cart Item
- Quantity Stepper
- Modifier Group
- Modifier Option
- Payment Footer
- Button
- Icon Button
- Dialog
- Bottom Sheet
- Snackbar
- Toast
- Badge
- Chip
- Label
- Avatar
- Checkbox
- Radio
- Switch
- Dropdown
- Divider
- Empty State
- Error State
- Loading
- Image
- Tất cả component còn lại

=========================================================
8. UX SPECIFICATION
=========================================================

Mô tả đầy đủ

- Quy tắc Touch
- Quy tắc Gesture
- Quy tắc Scroll
- Focus
- Selection
- Feedback
- Confirmation
- Undo
- Navigation
- Animation
- Accessibility

=========================================================
9. BUSINESS RULES
=========================================================

Chi tiết cho

- Sales
- Cart
- Modifier
- Payment
- Printer
- Discount
- Voucher
- Tax
- Shift
- Orders
- Refund
- Kitchen
- Offline
- Sync
- Validation

Bao gồm tất cả Edge Cases.

=========================================================
10. UI STATES
=========================================================

Cho mọi màn hình và mọi component.

- Idle
- Loading
- Empty
- Searching
- Selected
- Focused
- Disabled
- Pressed
- Error
- Offline
- Syncing
- Completed
- Cancelled
- Success

=========================================================
11. RESPONSIVE
=========================================================

Tablet

Landscape

Portrait

Phone

Giải thích khác biệt Layout.

=========================================================
12. ACCESSIBILITY
=========================================================

- WCAG
- Touch Target
- Contrast
- Dynamic Font
- TalkBack
- Screen Reader
- Color Blind
- Motor Impairment

=========================================================
13. DESIGN TOKENS
=========================================================

- Spacing
- Radius
- Typography
- Color
- Shadow
- Elevation
- Motion
- Duration
- Opacity

=========================================================
14. ICONOGRAPHY
=========================================================

Cho từng icon

- Ý nghĩa
- Khi sử dụng
- Không sử dụng
- Vị trí

=========================================================
15. ANIMATION
=========================================================

Mô tả

- Chuyển màn hình
- Bottom Sheet
- Dialog
- Button
- List
- Navigation
- Loading

Bao gồm

- Duration
- Curve
- Trigger

=========================================================
16. PERFORMANCE
=========================================================

- Virtual List
- Lazy Loading
- Cache
- Image Loading
- Search Debounce
- Scroll Performance
- Animation Performance

=========================================================
17. ACCEPTANCE CRITERIA
=========================================================

Cho từng màn hình.

Cho từng Component.

Viết dưới dạng checklist QA.

=========================================================
18. PHỤ LỤC
=========================================================

Bao gồm

- Navigation Map
- Screen Tree
- Component Tree
- State Diagram
- User Flow
- Permission Matrix
- Interaction Matrix
- Screen Matrix
- Component Matrix
- Business Rule Matrix
- Glossary
- Revision History

=========================================================
YÊU CẦU KHI VIẾT
=========================================================

- Không được viết ngắn.
- Không được tóm tắt.
- Mọi màn hình phải có Wireframe ASCII đầy đủ.
- Mọi Component phải có Wireframe riêng.
- Mọi màn hình phải mô tả chi tiết từng vùng giao diện.
- Mọi Component phải mô tả đầy đủ từng thuộc tính UI.
- Mọi Interaction phải mô tả đầy đủ mọi trạng thái.
- Mọi Business Rule phải có đầy đủ Edge Cases.
- Sử dụng Markdown chuẩn.
- Sử dụng bảng khi phù hợp.
- Sử dụng Mermaid cho sơ đồ.
- Sử dụng ASCII Wireframe cho toàn bộ màn hình.
- Viết tài liệu ở mức đủ để UI Designer thiết kế Figma, Frontend triển khai và QA viết Test Case mà không cần hỏi thêm thông tin.