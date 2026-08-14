Đúng. Nếu mục tiêu là **thiết kế implementation thực tế cho NDTCore.POS**, tôi sẽ bỏ hoàn toàn cách trình bày kiểu Clean Architecture với `domain/application/infrastructure` và cũng không biến tài liệu thành một architecture textbook.

Nên viết theo hướng **Printer System Design**: từ mục đích → khái niệm → data model → runtime flow → discovery → configuration → routing → driver → protocol → transport → SDK → queue → error → UI → implementation.

Dưới đây là bản viết lại theo hướng đó.

---

# Printer Management & Printing System Design

**Project:** NDTCore.POS
**Platform:** React Native
**Scope:** Printer Management, Printer Configuration, Print Routing và Print Execution

---

# 1. Mục đích

Hệ thống Printer cần giải quyết hai vấn đề độc lập:

### Printer Management

Quản lý máy in vật lý:

* Add printer
* Discover printer
* Connect printer
* Detect vendor/model
* Detect hoặc chọn protocol
* Test print
* Enable/disable
* Edit configuration
* Delete printer
* Reconnect printer

### Printing

Xử lý việc in:

* Xác định nội dung cần in
* Xác định nơi cần in
* Xác định printer thực tế
* Tạo print job
* Gửi job tới printer
* Queue
* Retry
* Failover
* Broadcast
* Reprint
* Tracking trạng thái

Hai phần này không nên trộn vào nhau.

---

# 2. Nguyên tắc quan trọng

## 2.1 Printer không có "loại nghiệp vụ"

Không tạo:

```ts
PrinterType
PrinterFamily
PrintContentType
```

để xác định printer dùng cho:

```text
Receipt
Kitchen
Bar
Label
```

Một printer có thể được dùng cho nhiều mục đích.

Ví dụ:

```text
Printer A
 ├── Receipt
 └── Bar
```

Do đó:

> Printer mô tả **máy in**.

Cấu hình in mô tả:

> **Nội dung nào được gửi đến máy in nào.**

---

# 3. Các khái niệm chính

Hệ thống chỉ cần các khái niệm chính sau:

```text
Printer
PrinterDefinition
PrinterConnection
IPrinterDriver
PrinterProtocol
PrinterTransport

PrintDestination
PrintRule
PrintPlan
PrintJob
```

Có thể hình dung:

```text
Printer
   │
   │ physical device
   │
   ├── Connection
   ├── Driver
   ├── Protocol
   └── Capabilities


PrintDestination
   │
   │ logical destination
   │
   └── Printers[]


PrintRule
   │
   └── Destination


Order
   │
   ▼
PrintPlan
   │
   ▼
PrintJob
   │
   ▼
Printer
```

---

# 4. Printer

`Printer` đại diện cho **một printer đã được cấu hình trên POS**.

```ts
interface Printer {
  id: string;

  name: string;

  vendor?: string;

  model?: string;

  connection: PrinterConnection;

  driver: PrinterDriverKind;

  protocol?: PrinterProtocolKind;

  capabilities: PrinterCapabilities;

  enabled: boolean;

  createdAt: string;

  updatedAt: string;
}
```

---

# 5. Printer ID

`id` là ID local của printer.

Ví dụ:

```text
printer_001
printer_002
```

Không dùng:

```text
IP
Bluetooth MAC
USB device path
```

làm ID.

Ví dụ:

```text
Printer ID
    printer_001

Connection
    LAN 192.168.1.100
```

Sau này IP thay đổi:

```text
Printer ID
    printer_001

Connection
    LAN 192.168.1.200
```

vẫn là cùng một printer configuration.

---

# 6. Printer Name

Tên để user nhận diện printer.

Ví dụ:

```text
Receipt Printer
Bar Printer
Kitchen Printer
Label Printer
```

Tên không có ý nghĩa routing.

Không được hiểu:

```text
name = "Kitchen Printer"
```

thì printer đó tự động là Kitchen printer.

Routing vẫn phải được cấu hình riêng.

---

# 7. Vendor

```ts
vendor?: string;
```

Ví dụ:

```text
Epson
Xprinter
Zjiang
```

Vendor có thể không tồn tại.

---

# 8. Model

```ts
model?: string;
```

Ví dụ:

```text
TM-T82
XP-80C
XP-420B
```

Model cũng có thể không xác định được.

---

# 9. Unknown Printer

Unknown printer là trường hợp hợp lệ.

Ví dụ:

```text
Vendor: Unknown
Model: Unknown
Protocol: TSPL
```

User vẫn có thể sử dụng printer nếu hệ thống biết cách giao tiếp.

Do đó:

> Vendor/Model không phải requirement bắt buộc để print.

---

# 10. Printer Connection

Connection mô tả **printer được kết nối như thế nào**.

```ts
type PrinterConnection =
  | UsbConnection
  | BluetoothConnection
  | LanConnection;
```

---

# 11. USB Connection

```ts
interface UsbConnection {
  type: 'usb';

  vendorId?: number;

  productId?: number;

  deviceId?: string;
}
```

Thông tin chính có thể lấy từ Android USB device.

---

# 12. Bluetooth Connection

```ts
interface BluetoothConnection {
  type: 'bluetooth';

  mode: 'classic' | 'ble';

  address: string;

  name?: string;
}
```

`address` được dùng để reconnect.

`mode` bắt buộc, không suy đoán được từ `address`. Classic (RFCOMM/SPP) và BLE (GATT) là hai stack hoàn toàn khác nhau ở tầng OS lẫn thư viện — chọn nhầm mode nghĩa là dùng sai transport, không phải lỗi cấu hình. Phần lớn máy in ESC/POS giá rẻ dùng Bluetooth Classic (SPP).

---

# 13. LAN Connection

```ts
interface LanConnection {
  type: 'lan';

  host: string;

  port: number;

  timeoutMs?: number;
}
```

Ví dụ:

```text
192.168.1.100:9100
```

---

# 14. Driver

`IPrinterDriver` trả lời câu hỏi:

> Làm thế nào để giao tiếp với loại printer này?

```ts
interface IPrinterDriver {
  connect(printer: Printer): Promise<void>;

  print(
    printer: Printer,
    job: PrintJob
  ): Promise<PrintResult>;

  disconnect(
    printer: Printer
  ): Promise<void>;
}
```

---

# 15. Driver Implementation

Scope hiện tại chỉ có Generic Driver — printer giao tiếp bằng protocol tiêu chuẩn (ESC/POS, TSPL) qua USB/Bluetooth/LAN. Không handle Vendor SDK (built-in printer kiểu iMin/Sunmi) — ngoài phạm vi.

```text
GenericPrinterDriver
        │
        ├── Protocol
        │
        └── Transport
```

---

# 16. Generic Driver

Generic driver xử lý flow:

```text
PrintDocument
      ↓
Protocol
      ↓
bytes
      ↓
Transport
      ↓
Printer
```

Ví dụ:

```text
Xprinter
USB
ESC/POS
```

sẽ đi:

```text
GenericPrinterDriver
      ↓
EscPosProtocol
      ↓
UsbTransport
      ↓
Xprinter
```

---

# 17. Protocol

Protocol trả lời:

> Printer hiểu dữ liệu dưới format nào?

```ts
type PrinterProtocolKind =
  | 'escpos'
  | 'tspl'
  // Zebra-native — trên printer TSPL-native (Xprinter/TSC/Gprinter/HPRT) thường
  // chỉ khả dụng qua chế độ giả lập (emulation mode), không song song với TSPL.
  // Xem # 20. ZPL.
  | 'zpl';
```

---

# 18. ESC/POS

ESC/POS thường dùng cho receipt printer.

Ví dụ:

```text
Epson
Xprinter
Zjiang
```

Flow:

```text
Receipt
 ↓
ESC/POS Encoder
 ↓
ESC/POS Bytes
 ↓
Transport
 ↓
Printer
```

---

# 19. TSPL

TSPL thường dùng cho label printer.

Flow:

```text
Label
 ↓
TSPL Encoder
 ↓
TSPL Commands
 ↓
Transport
 ↓
Printer
```

---

# 20. ZPL

ZPL là ngôn ngữ độc quyền của Zebra — không phải một protocol trung lập ngang hàng TSPL.

Các label printer không phải Zebra (bao gồm cả những vendor phổ biến ở dự án này: Xprinter, TSC, Gprinter, HPRT) mặc định là TSPL-native. ZPL trên các máy đó — nếu có — chỉ khả dụng qua **chế độ giả lập**, thường phải bật bằng DIP switch hoặc lệnh cấu hình riêng, và không chắc chạy đồng thời với TSPL.

Flow:

```text
Label
 ↓
ZPL Encoder
 ↓
ZPL Commands
 ↓
Transport
 ↓
Printer
```

Chỉ thêm `ZplProtocol`/detection rule cho `zpl` khi có thiết bị thật cần dùng — không implement trước khi có nhu cầu.

---

# 21. Transport

Transport trả lời:

> Dữ liệu được gửi đến printer bằng đường nào?

```ts
interface PrinterTransport {
  connect(
    connection: PrinterConnection
  ): Promise<void>;

  write(
    data: Uint8Array
  ): Promise<void>;

  disconnect(): Promise<void>;
}
```

Các implementation:

```text
UsbTransport
BluetoothTransport
LanTransport
```

---

# 22. Không nên tạo Printer theo Connection

Không tạo:

```text
UsbPrinter
BluetoothPrinter
LanPrinter
```

vì:

```text
Connection
```

chỉ là phương thức kết nối.

Ví dụ cùng một Xprinter:

```text
Xprinter
 ├── USB
 ├── Bluetooth
 └── LAN
```

Printer identity vẫn là printer.

---

# 23. Printer Definition

`PrinterDefinition` là dữ liệu định nghĩa printer model.

```ts
interface PrinterDefinition {
  vendor: string;

  models: string[];

  driver: PrinterDriverKind;

  protocol?: PrinterProtocolKind;

  supportedConnections: PrinterConnectionType[];

  capabilities: PrinterCapabilities;
}
```

---

# 24. PrinterDefinition dùng để làm gì?

Chủ yếu dùng trong:

```text
Discovery
Detection
Validation
Configuration
```

Không cần dùng mỗi lần print.

Ví dụ:

```text
Detect:

Xprinter XP-80C
      ↓
PrinterDefinition
      ↓
driver = generic
protocol = escpos
connections = USB/LAN/Bluetooth
```

Sau đó lưu trực tiếp vào Printer:

```ts
{
  driver: 'generic',
  protocol: 'escpos'
}
```

---

# 25. Vì sao Printer cần lưu Driver/Protocol?

Đây là điểm quan trọng.

Nếu không lưu:

```text
Printer
```

sẽ phải runtime:

```text
Printer
 ↓
Vendor
 ↓
Model
 ↓
Definition Registry
 ↓
Driver
 ↓
Protocol
```

Không cần thiết.

Detection là configuration-time operation.

Sau khi Save:

```text
Printer
 ├── driver
 └── protocol
```

runtime sử dụng trực tiếp.

---

# 26. Unknown Printer Configuration

Nếu không detect được:

```text
Vendor = Unknown
Model = Unknown
```

user có thể chọn:

```text
Driver = Generic
Protocol = ESC/POS
```

hoặc:

```text
Driver = Generic
Protocol = TSPL
```

Sau khi Save:

```ts
{
  name: 'My Printer',

  driver: 'generic',

  protocol: 'tspl'
}
```

Không cần tạo `PrinterDefinition` giả.

---

# 27. Supported Connections

`PrinterDefinition` phải có:

```ts
supportedConnections
```

Ví dụ:

```ts
{
  vendor: 'Xprinter',

  models: ['XP-420B'],

  driver: 'generic',

  protocol: 'tspl',

  supportedConnections: [
    'usb',
    'lan'
  ]
}
```

Nếu user chọn Bluetooth:

```text
Invalid configuration
```

---

# 28. Printer Capabilities

Capabilities mô tả printer có khả năng gì.

```ts
interface PrinterCapabilities {
  text?: boolean;

  image?: boolean;

  barcode?: boolean;

  qrCode?: boolean;

  cut?: boolean;

  drawer?: boolean;

  label?: boolean;
}
```

Ví dụ:

```text
ESC/POS Receipt Printer

text: true
image: true
barcode: true
qrCode: true
cut: true
label: false
```

---

# 29. Capability không phải Routing

Không dùng:

```text
capabilities.label
```

để quyết định:

```text
Printer = Label Printer
```

Capability chỉ trả lời:

> Printer có khả năng này hay không?

Routing trả lời:

> Khi nào sử dụng printer này?

---

# 30. Printer Management

Printer Management chỉ quản lý hardware configuration.

Bao gồm:

```text
Add
Edit
Delete
Enable
Disable
Test Print
Reconnect
View status
```

Không chứa:

```text
Order routing
Kitchen rules
Bar rules
Item grouping
```

---

# 31. Add Printer Flow

```text
Add Printer
     ↓
Choose Connection
     ↓
Discover
     ↓
Select Device
     ↓
Detect Vendor/Model
     ↓
Resolve Definition
     ↓
Resolve Driver/Protocol
     ↓
Validate
     ↓
Test Print
     ↓
Save
```

---

# 32. Manual Configuration Flow

Nếu detection fail:

```text
Add Printer
     ↓
Choose Connection
     ↓
Discover
     ↓
Unknown Device
     ↓
Manual Configuration
     ↓
Choose Driver
     ↓
Choose Protocol
     ↓
Validate
     ↓
Test Print
     ↓
Save
```

---

# 33. Printer Test

Test Print phải đi qua production pipeline.

Không tạo:

```text
testPrinter()
```

một implementation hoàn toàn khác.

Phải:

```text
Test Print
   ↓
PrintDocument
   ↓
PrintJob
   ↓
Driver
   ↓
Protocol
   ↓
Transport
   ↓
Printer
```

Điều này giúp test print có giá trị thực tế.

---

# 34. PrintDestination

Đây là nơi cần tách khỏi Printer.

`PrintDestination` đại diện cho **logical destination**.

Ví dụ:

```text
Bar
Kitchen
Receipt
Label Station
```

Model:

```ts
interface PrintDestination {
  id: string;

  name: string;

  printerIds: string[];

  fanoutMode: 'failover' | 'broadcast';

  enabled: boolean;
}
```

---

# 35. Quan hệ Printer và Destination

Một printer có thể thuộc nhiều destination:

```text
Printer A
 ├── Receipt
 └── Bar
```

Một destination có thể có nhiều printer:

```text
Bar
 ├── Printer A
 └── Printer B
```

Do đó:

```text
Printer
   ↕
many-to-many
   ↕
PrintDestination
```

---

# 36. Vì sao không đặt Destination vào Printer?

Không nên:

```ts
interface Printer {
  type: 'bar';
}
```

vì:

```text
Printer A
```

có thể vừa in:

```text
Receipt
Bar
```

Destination phải là configuration độc lập.

---

# 37. Fanout Mode

Destination phải xác định cách sử dụng nhiều printer.

```ts
type PrintFanoutMode =
  | 'failover'
  | 'broadcast';
```

---

# 38. Failover

```text
Bar
 ├── Printer A
 └── Printer B
```

A là primary.

Nếu A fail:

```text
A → failed
B → print
```

Chỉ cần một printer thành công.

---

# 39. Broadcast

```text
Bar
 ├── Printer A
 └── Printer B
```

Cả hai phải nhận job:

```text
A → print
B → print
```

Dùng khi hai station vật lý đều cần bản in.

---

# 40. Destination Printer Priority

Đối với failover:

```ts
interface DestinationPrinter {
  printerId: string;

  priority: number;
}
```

Ví dụ:

```text
Bar

1. Printer A
2. Printer B
3. Printer C
```

---

# 41. Effective Printer

Một printer chỉ được sử dụng khi:

```text
Destination.enabled = true
AND
Printer.enabled = true
```

Nếu:

```text
Bar
 ├── A enabled
 ├── B disabled
 └── C enabled
```

effective printers:

```text
A
C
```

---

# 42. Không có Printer khả dụng

Nếu:

```text
Destination enabled
```

nhưng:

```text
all printers disabled/offline
```

phải trả:

```text
NO_AVAILABLE_PRINTER
```

Không được silently skip.

---

# 43. PrintRule

PrintRule quyết định:

> Nội dung nào đi đến destination nào?

```ts
interface PrintRule {
  id: string;

  conditions: PrintCondition[];

  destinationId: string;

  priority: number;

  enabled: boolean;
}
```

---

# 44. PrintRule không nằm trong Printer

Không:

```text
Printer
 └── rules
```

Mà:

```text
PrintRule
   ↓
Destination
   ↓
Printer[]
```

---

# 45. Condition

Ví dụ:

```text
Category = Beverage
```

hoặc:

```text
Category = Food
```

hoặc:

```text
OrderType = DineIn
```

---

# 46. Nhiều Conditions

Mặc định:

```text
AND
```

Ví dụ:

```text
Category = Beverage
AND
OrderType = DineIn
```

Chỉ match khi cả hai đúng.

---

# 47. Rule Priority

Rule có priority cao hơn được evaluate trước.

```text
100
50
10
```

Nếu hai rule cùng priority cùng match:

```text
Ambiguous routing
```

Configuration nên reject.

Không chọn random.

---

# 48. Default Destination

Có thể có default destination:

```ts
interface PrintRoutingConfiguration {
  rules: PrintRule[];

  defaultDestinationId?: string;
}
```

Flow:

```text
Rule match
   ↓
Destination
```

Nếu không:

```text
No rule
   ↓
Default Destination
```

Nếu vẫn không có:

```text
Routing Error
```

---

# 49. OrderPrintPlanner

Đây là component chịu trách nhiệm tạo kế hoạch in từ order.

```ts
interface OrderPrintPlanner {
  createPlans(
    order: Order
  ): Promise<PrintPlan[]>;
}
```

Nó xử lý:

```text
Order
 ↓
Items
 ↓
Evaluate Rules
 ↓
Group Items
 ↓
Create Documents
 ↓
Create PrintPlans
```

---

# 50. Vì sao cần Planner?

Ví dụ order:

```text
Milk Tea
Burger
Cake
```

Rules:

```text
Beverage → Bar
Food → Kitchen
Dessert → Kitchen
```

Không thể chỉ:

```text
Order
 ↓
PrintRouter
```

vì Router không nên tự biết cách split item.

Planner tạo:

```text
Plan 1
Bar
Milk Tea

Plan 2
Kitchen
Burger + Cake
```

---

# 51. PrintPlan

```ts
interface PrintPlan {
  id: string;

  destinationId: string;

  document: PrintDocument;

  copies: number;
}
```

PrintPlan chưa phải physical job.

---

# 52. PrintDocument

```ts
interface PrintDocument {
  template: string;

  width?: number;

  height?: number;

  elements: PrintElement[];
}
```

Ví dụ:

```text
Text
Image
Barcode
QRCode
Line
Table
```

---

# 53. PrintPlan → PrintJob

Ví dụ:

```text
PrintPlan
   │
   │ destination = Bar
   │ fanout = broadcast
   │
   ├─────────────┐
   ▼             ▼
Printer A     Printer B
   │             │
   ▼             ▼
PrintJob A    PrintJob B
```

Do đó:

> Một PrintPlan có thể tạo nhiều PrintJob.

---

# 54. PrintJob

```ts
interface PrintJob {
  id: string;

  planId: string;

  printerId: string;

  document: PrintDocument;

  status:
    | 'pending'
    | 'printing'
    | 'success'
    | 'failed'
    | 'cancelled';

  retryCount: number;

  error?: PrintError;

  createdAt: string;

  startedAt?: string;

  completedAt?: string;
}
```

---

# 55. PrintJob là physical execution

PrintPlan:

```text
"In Kitchen cần in ticket này"
```

PrintJob:

```text
"Đưa ticket này tới Printer A"
```

Đây là boundary rất quan trọng.

---

# 56. Print Service

PrintService xử lý execution.

```ts
interface PrintService {
  print(
    plan: PrintPlan
  ): Promise<PrintResult>;
}
```

Flow:

```text
PrintPlan
   ↓
Destination
   ↓
Fanout
   ↓
PrintJob
   ↓
Driver
   ↓
Printer
```

---

# 57. PrintJob Lifecycle

```text
pending
   ↓
printing
   ↓
success
```

Failure:

```text
pending
   ↓
printing
   ↓
failed
```

Retry:

```text
failed
   ↓
pending
   ↓
printing
```

---

# 58. Retry

Retry cùng printer:

```text
Job A
Printer A
failed
   ↓
retry
   ↓
Printer A
```

Không tạo routing plan mới.

---

# 59. Reprint

Reprint phải tạo PrintJob mới.

```text
Original Job
    ↓
Reprint
    ↓
New Job
```

Ví dụ:

```text
Job #100
success

Reprint

Job #101
pending
```

Không sửa Job #100.

---

# 60. Failover Execution

```text
Destination
   ↓
Printer A
   ↓
Failed?
 ┌─┴─┐
No  Yes
│    │
Done Printer B
       ↓
    Success?
```

Nếu tất cả fail:

```text
Destination Print Failed
```

---

# 61. Broadcast Execution

```text
Destination
   ↓
Printer A ──→ Job A
Printer B ──→ Job B
Printer C ──→ Job C
```

Kết quả:

```text
A success
B success
C failed
```

Destination:

```text
partial-failure
```

---

# 62. Queue

Không gửi đồng thời nhiều command vào cùng printer nếu underlying implementation không đảm bảo thread-safe/sequential write.

Ví dụ:

```text
Printer A Queue

Job 1
 ↓
Job 2
 ↓
Job 3
```

Mỗi job hoàn tất trước khi job tiếp theo được write.

---

# 63. Concurrency

Không nên quyết định ngay rằng:

```text
Bluetooth = global lock
```

hoặc:

```text
Printer = always isolated lock
```

Concurrency phải dựa trên behavior thực tế của library/native implementation.

Thiết kế scheduler nên cho phép scope:

```text
Printer
Transport
Global
```

nếu cần.

---

# 64. Printer Scheduler

```ts
interface PrintScheduler {
  enqueue(
    job: PrintJob
  ): Promise<void>;
}
```

Scheduler chịu trách nhiệm:

* queue
* serialization
* concurrency
* retry scheduling

---

# 65. Driver Resolution

Runtime:

```text
Printer
   ↓
driver
   ↓
DriverRegistry
```

Ví dụ:

```text
driver = generic
```

→

```text
GenericPrinterDriver
```

---

# 66. Generic Runtime

```text
Printer
 ↓
GenericPrinterDriver
 ↓
protocol
 ↓
EscPosProtocol / TsplProtocol / ZplProtocol
 ↓
transport
 ↓
Usb/Bluetooth/LAN
 ↓
Printer
```

---

# 67. Rendering Label

Receipt thường:

```text
Text
 ↓
ESC/POS
```

Label phức tạp hơn:

```text
Label Data
 ↓
Layout
 ↓
Render
 ↓
TSPL/ZPL
```

Interface có thể vẫn là:

```ts
encode(): Promise<Uint8Array>
```

nhưng implementation TSPL/ZPL có thể cần rendering host.

Điều này nên được coi là infrastructure concern.

---

# 68. Printer Status

Phân biệt:

```text
enabled
```

và:

```text
connected
```

`enabled`:

```text
User configuration
```

`connected`:

```text
Runtime state
```

Ví dụ:

```text
Printer:
enabled = true
connected = false
```

hoàn toàn hợp lệ.

---

# 69. Printer Error

Nên có error code rõ ràng:

```ts
type PrintErrorCode =
  | 'PRINTER_DISABLED'
  | 'NO_AVAILABLE_PRINTER'
  | 'DEVICE_NOT_FOUND'
  | 'CONNECTION_FAILED'
  | 'CONNECTION_TIMEOUT'
  | 'UNSUPPORTED_CONNECTION'
  | 'UNSUPPORTED_PROTOCOL'
  | 'INVALID_CONFIGURATION'
  | 'ENCODING_FAILED'
  | 'PRINT_FAILED';
```

---

# 70. Printer Settings UI

Màn hình:

```text
Printer Management

Receipt Printer
Epson TM-T82
LAN
Connected
Enabled

Bar Printer
Xprinter XP-80
USB
Connected
Enabled

Label Printer
Unknown
USB
Disconnected
Enabled
```

Actions:

```text
Add
Edit
Test Print
Enable / Disable
Delete
```

---

# 71. Add Printer UI

### Connection

```text
USB
Bluetooth
LAN
```

### Device

```text
Scan
```

### Configuration

```text
Vendor
Model
Driver
Protocol
```

### Validation

```text
Test Print
```

### Save

```text
Save Printer
```

---

# 72. Destination UI

Màn hình riêng:

```text
Print Destinations

Receipt
  Epson TM-T82

Bar
  Xprinter A
  Xprinter B

Kitchen
  Xprinter C
```

---

# 73. Destination Detail

```text
Destination: Bar

Printers:

☑ Xprinter A
☑ Xprinter B

Mode:

○ Failover
● Broadcast
```

Nếu failover:

```text
Priority

1. Xprinter A
2. Xprinter B
```

---

# 74. Routing UI

```text
Print Rules

Category = Beverage
        ↓
Bar

Category = Food
        ↓
Kitchen

Category = Dessert
        ↓
Kitchen
```

---

# 75. Complete User Configuration

User sẽ cấu hình theo 3 bước khác nhau:

### 1. Printer Management

```text
Printer
```

Trả lời:

> Có những máy in nào?

### 2. Destination Management

```text
Destination
```

Trả lời:

> Những điểm in nào đang tồn tại và printer nào phục vụ chúng?

### 3. Print Routing

```text
Rules
```

Trả lời:

> Order/item nào phải đi tới destination nào?

Ba khái niệm này không nên gộp thành một màn hình/entity.

---

# 76. Ví dụ hoàn chỉnh

Có:

```text
Printer A
Epson TM-T82
LAN
ESC/POS

Printer B
Xprinter XP-80
USB
ESC/POS

Printer C
Xprinter XP-420B
USB
TSPL
```

Destination:

```text
Receipt
 └── Printer A

Bar
 ├── Printer B
 └── Printer A

Label
 └── Printer C
```

Rules:

```text
Beverage → Bar
Food → Kitchen
Label-required → Label
```

Order:

```text
Milk Tea
Burger
```

Planner:

```text
Bar Plan
 └── Milk Tea

Kitchen Plan
 └── Burger
```

Runtime:

```text
Bar Plan
 ↓
Bar
 ↓
Printer B + Printer A
```

nếu Broadcast:

```text
Printer B → Job
Printer A → Job
```

---

# 77. Final Runtime Flow

```text
ORDER
  │
  ▼
OrderPrintPlanner
  │
  │ split/group items
  ▼
PrintPlan[]
  │
  ▼
PrintDestination
  │
  │ failover / broadcast
  ▼
Printer[]
  │
  ▼
PrintJob[]
  │
  ▼
PrintScheduler
  │
  ▼
IPrinterDriver
  │
  ▼
Protocol
  │
  ▼
Transport
  │
  ├── USB
  ├── Bluetooth
  └── LAN
  │
  ▼
PHYSICAL PRINTER
```

---

# 78. Cấu trúc code thực tế

Không tổ chức thành:

```text
domain/
application/
infrastructure/
```

Không cần Clean Architecture folder.

Có thể tổ chức trực tiếp theo **printer system responsibility**:

```text
src/
└── printer/
    ├── Printer.ts
    ├── PrinterManager.ts
    ├── PrinterRepository.ts
    │
    ├── connection/
    │   ├── PrinterConnection.ts
    │   ├── UsbConnection.ts
    │   ├── BluetoothConnection.ts
    │   └── LanConnection.ts
    │
    ├── discovery/
    │   ├── PrinterDiscovery.ts
    │   ├── PrinterDetector.ts
    │   └── PrinterDefinitionRegistry.ts
    │
    ├── driver/
    │   ├── IPrinterDriver.ts
    │   └── GenericPrinterDriver.ts
    │
    ├── protocol/
    │   ├── PrinterProtocol.ts
    │   ├── EscPosProtocol.ts
    │   ├── TsplProtocol.ts
    │   └── ZplProtocol.ts
    │
    ├── transport/
    │   ├── PrinterTransport.ts
    │   ├── UsbTransport.ts
    │   ├── BluetoothTransport.ts
    │   └── LanTransport.ts
    │
    ├── destination/
    │   ├── PrintDestination.ts
    │   ├── DestinationManager.ts
    │   └── FanoutStrategy.ts
    │
    ├── routing/
    │   ├── PrintRule.ts
    │   ├── PrintRouter.ts
    │   └── OrderPrintPlanner.ts
    │
    ├── job/
    │   ├── PrintPlan.ts
    │   ├── PrintJob.ts
    │   ├── PrintJobManager.ts
    │   └── PrintScheduler.ts
    │
    ├── document/
    │   ├── PrintDocument.ts
    │   ├── PrintElement.ts
    │   └── PrintRenderer.ts
    │
    └── ui/
        ├── PrinterManagementScreen.tsx
        ├── AddPrinterModal.tsx
        ├── PrinterDetailScreen.tsx
        ├── DestinationScreen.tsx
        └── RoutingScreen.tsx
```

Cách này **không phải Clean Architecture**. Nó chỉ chia code theo **responsibility của Printer System**, dễ tìm và phù hợp hơn với một module thực tế trong POS.

---

# 79. Boundary cuối cùng

Điểm quan trọng nhất của thiết kế này là giữ đúng 6 boundary:

```text
Printer
    = Physical printer configuration

Destination
    = Logical place that needs printing

Rule
    = Determines where content should go

PrintPlan
    = Determines what needs to be printed

PrintJob
    = One physical print execution

Driver / Protocol / Transport
    = Determines how data reaches hardware
```

Vì vậy không cần thêm các abstraction như:

```text
PrinterType
PrinterFamily
PrintContentType
KitchenPrinter
ReceiptPrinter
LabelPrinter
```

vào core model.

**Đây là design tôi khuyến nghị dùng làm baseline để bắt đầu implement**, đặc biệt với requirement hiện tại là Android POS + nhiều loại printer + USB/Bluetooth/LAN + ESC/POS/TSPL. Vendor SDK (built-in printer) ngoài phạm vi hiện tại.
