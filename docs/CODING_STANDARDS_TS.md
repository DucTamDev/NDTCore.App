# NDTCore TypeScript Coding Rules (App)

Áp dụng cho code TypeScript/TSX trong `src/`.
Mục tiêu: **readability, single responsibility, comment đúng chỗ (WHY, không phải WHAT)**.

> Code dễ đọc trước, code ngắn sau. Tên rõ ràng trước, comment sau.

---

# 1. Ưu tiên khả năng đọc

Code phải có thể đọc và hiểu ngay mà không cần đọc comment hoặc mở quá nhiều file khác.

- Ưu tiên code rõ ràng hơn code ngắn.
- Ưu tiên code dễ hiểu hơn code "thông minh".
- Không tối ưu số dòng code nếu làm giảm readability.
- Luồng chính phải dễ nhìn thấy.

> Code phải tự giải thích được ý định của nó.

---

## 2. Không nesting sâu

Ưu tiên **guard clause / early return** thay vì `if` lồng nhau.

### Không nên

```ts
if (user) {
  if (user.isActive) {
    if (user.hasPermission) {
      execute();
    }
  }
}
```

### Nên

```ts
if (!user) {
  return;
}

if (!user.isActive) {
  return;
}

if (!user.hasPermission) {
  return;
}

execute();
```

**Rule:** Hạn chế nesting tối đa 2 levels. Nếu vượt quá, xem xét refactor.

---

## 3. Main flow phải rõ ràng

Khi đọc function từ trên xuống dưới, phải hiểu được flow chính ngay lập tức.

```ts
const user = getUser(userId);

if (!user) {
  return;
}

const order = createOrder(user);

await saveOrder(order);

return order;
```

Không nên che giấu flow bằng quá nhiều abstraction hoặc function trung gian không có ý nghĩa.

---

## 4. Một function — một mục đích

Một function nên có một responsibility rõ ràng. Không nên để một function đồng thời: validate → transform → call API → save database → update UI → send notification. Nếu có nhiều responsibility, tách thành các function có ý nghĩa.

---

## 5. Một class/module — một responsibility chính

Class không nên trở thành nơi chứa tất cả logic liên quan đến một feature (vd `UserManager` chứa cả `createUser`/`sendEmail`/`uploadAvatar`/`generateReport`). Nếu các behavior thuộc các responsibility khác nhau, nên tách chúng.

---

## 6. Đặt tên theo ý nghĩa

Tên phải thể hiện **ý định**, không chỉ thể hiện kiểu dữ liệu.

**Không nên:** `data`, `result`, `item`, `value`, `obj`.
**Nên:** `customer`, `orderTotal`, `availableProducts`, `requestPayload`.

Không dùng comment để giải thích cho một tên biến khó hiểu nếu có thể đổi tên biến.

---

# Field / Property Rules

## 7. Field phải có mục đích rõ ràng

Mỗi field phải trả lời được: **field này dùng để làm gì?** Không tạo field chỉ vì "có thể sẽ cần". Nếu ý nghĩa của field không rõ ràng, cần đặt tên cụ thể hơn hoặc thêm comment.

---

## 8. Comment mục đích của field khi cần thiết

Comment field khi **ý nghĩa hoặc constraint không thể hiểu rõ chỉ từ tên và type**.

```ts
interface Printer {
  /** Khóa logic dùng để xác định printer vật lý và ngăn lưu trùng. */
  identityKey: string;

  /**
   * Khóa xác định phạm vi tài nguyên được phép sử dụng đồng thời.
   * Các operation dùng chung resourceKey phải được serialize.
   */
  resourceKey: string;
}
```

---

## 9. Không comment field nếu tên và type đã đủ rõ

```ts
interface User {
  id: string;
  name: string;
  email: string;
}
```

---

## 10. Comment field phải mô tả mục đích, không mô tả kiểu dữ liệu

**Không nên:** `/** String chứa printer ID */`
**Nên:** `/** ID ổn định dùng để tham chiếu printer trong storage và routing. */`

Comment phải trả lời "tại sao field tồn tại / được dùng vào đâu", không phải "field này là string".

---

## 11. Comment các constraint quan trọng của field

```ts
interface PrintMedia {
  /** Số cột của media die-cut. Bắt buộc khi type = "die_cut". */
  columns?: number;

  /** Khoảng cách ngang giữa các item trong cùng một row, tính bằng mm. */
  horizontalGapMm?: number;
}
```

---

## 12. Comment lifecycle của field khi không hiển nhiên

```ts
interface PrinterDriver {
  /**
   * Cho biết font đã được cài trên printer hay chưa.
   * Chỉ có ý nghĩa khi renderMode = "truetype".
   */
  fontInstalled: boolean;
}
```

---

## 13. Comment relationship/invariant giữa các field

```ts
interface PrintMedia {
  type: PrintMediaType;

  /** Bắt buộc khi type = "die_cut". Không sử dụng cho media continuous. */
  columns?: number;

  /** Chỉ áp dụng cho type = "die_cut". */
  horizontalGapMm?: number;
}
```

Nếu rule phức tạp, không nên nhét tất cả vào comment field. Hãy đưa business rule vào validation/domain logic.

---

# Comment Rules

## 14. Comment WHY, không comment WHAT

**Không nên:**

```ts
// Get user
const user = getUser(id);

// Check user
if (!user) {
  return;
}
```

**Nên:**

```ts
// Legacy accounts may not have a profile record.
if (!user) {
  return;
}
```

---

## 15. Comment business rule

```ts
// Orders cannot be cancelled after payment has been completed.
if (order.status === OrderStatus.Paid) {
  return;
}
```

---

## 16. Comment constraint hoặc limitation

```ts
// The SDK does not support concurrent writes.
// Calls must be serialized by the connection resource.
await lock.runExclusive(() => transport.write(data));
```

---

## 17. Comment workaround

Khi code có vẻ bất thường, comment phải giải thích tại sao.

```ts
// The printer firmware expects inverted bitmap bits.
// Do not remove unless firmware behavior is verified.
invertBitmap(bitmap);
```

---

## 18. Không dùng comment để che giấu code khó đọc

**Không nên:**

```ts
// Check whether the user can perform this operation
if (user && user.active && !user.deleted && permissions.includes('write')) {
  ...
}
```

**Nên:**

```ts
if (!canWrite(user, permissions)) {
  return;
}
```

Tên function đã thể hiện intent.

---

## 19. Không comment những thứ hiển nhiên

Không nên: `// Increment count` trước `count++;`, `// Return user` trước `return user;`, `// Call API` trước `await api.getUsers();`.

---

## 20. Comment phải được cập nhật cùng code

Comment sai còn nguy hiểm hơn không có comment. Khi behavior thay đổi: sửa code → review comment liên quan → update hoặc xoá comment đã lỗi thời.

---

# Condition Rules

## 21. Condition phải dễ đọc

**Không nên:**

```ts
if (user && user.active && user.role === 'admin' && !user.deleted) {
  ...
}
```

**Nên:**

```ts
if (!isActiveAdmin(user)) {
  return;
}

execute();
```

---

## 22. Đặt tên cho business condition

```ts
const canCheckout = order.isPaid && !order.isCancelled;

if (!canCheckout) {
  return;
}
```

Tên `canCheckout` giúp người đọc hiểu ngay mục đích.

---

# Abstraction Rules

## 23. Không abstraction quá sớm

Không tạo `BaseManager`/`AbstractService`/`GenericHandler`/`CommonHelper`/`UniversalProcessor` chỉ vì chúng "có vẻ clean". Abstraction phải giải quyết một responsibility hoặc behavior thực sự dùng chung.

---

## 24. Không tạo function trung gian vô nghĩa

**Không nên:**

```ts
function execute() {
  return process();
}

function process() {
  return handle();
}

function handle() {
  return save();
}
```

Nếu các function không tạo ra boundary hoặc responsibility rõ ràng, abstraction này chỉ làm code khó đọc hơn.

---

# Data & Side Effect Rules

## 25. Side effect phải dễ nhận biết

Các operation như API call, database write, file write, storage update, state mutation, logging, notification nên được thể hiện rõ trong flow. Không nên giấu side effect bên trong function có tên chỉ thể hiện calculation.

---

## 26. Function có tên "calculate/get/parse" không nên có side effect bất ngờ

`calculateTotal()` không nên đồng thời save database / update state / send notification. Tên function phải phản ánh đúng behavior.

---

# Final Review

Trước khi tạo PR, code nên pass các câu hỏi sau:

**Readability**
- Đọc code có hiểu ngay không? Main flow có rõ không? Có nesting sâu không? Có code clever không cần thiết không?

**Responsibility**
- Function này có một mục đích rõ ràng không? Class này có một responsibility chính không? Có abstraction nào không cần thiết không?

**Naming**
- Tên field/function/class có thể hiện đúng intent không? Có biến kiểu `data`, `result`, `value`, `temp` không cần thiết không?

**Fields**
- Mỗi field có mục đích rõ ràng không? Field nào có business meaning nhưng tên chưa đủ rõ không? Field nào có constraint/lifecycle/invariant đặc biệt cần comment không?

**Comments**
- Comment có giải thích WHY không? Có comment nào chỉ mô tả WHAT không? Có comment nào đã outdated không? Code có thể refactor để không cần comment không?

---

# Nguyên tắc cốt lõi

> Code dễ đọc trước, code ngắn sau.
> Tên rõ ràng trước, comment sau.
> Comment để giải thích mục đích, rule và WHY.
> Nesting càng ít càng tốt.
> Mỗi function/class chỉ nên có một trách nhiệm rõ ràng.
> Abstraction phải làm code dễ hiểu hơn, không phải khó hiểu hơn.
