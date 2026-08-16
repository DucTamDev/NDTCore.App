type Listener = () => void;

let listeners: Listener[] = [];

export const onSessionExpired = (listener: Listener): (() => void) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
};

export const emitSessionExpired = (): void => {
  // Cách ly từng listener — 1 listener throw không được chặn các listener
  // đăng ký sau đó nhận sự kiện logout.
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Không có gì để làm với lỗi của listener ở đây — bản thân listener
      // chịu trách nhiệm log lỗi của chính nó nếu cần.
    }
  });
};
