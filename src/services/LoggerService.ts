type LogLevel = 'debug' | 'info' | 'warning' | 'error';

class LoggerServiceImpl {
  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    // debug/info chỉ có ý nghĩa khi đang xem console lúc dev — tắt ngoài
    // __DEV__ để đỡ nhiễu. warning/error là tín hiệu sự cố thật (in lỗi, mất
    // kết nối, refresh token thất bại...) — vẫn phải ghi ra console ngay cả ở
    // production; nếu không, app hiện chưa có sink từ xa nào khác nên sự cố
    // thực tế trên máy cashier sẽ hoàn toàn không để lại dấu vết ở đâu cả.
    if (!__DEV__ && level !== 'warning' && level !== 'error') return;
    const consoleMethod = level === 'warning' ? 'warn' : level;
    console[consoleMethod](`[${level.toUpperCase()}] ${message}`, meta ?? '');
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta);
  }

  warning(message: string, meta?: Record<string, unknown>): void {
    this.write('warning', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write('error', message, meta);
  }
}

export const LoggerService = new LoggerServiceImpl();
