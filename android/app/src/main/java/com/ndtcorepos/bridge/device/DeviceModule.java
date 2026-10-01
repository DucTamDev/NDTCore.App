package com.ndtcorepos.bridge.device;

import android.util.Log;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.ndtcorepos.common.CodedException;
import com.ndtcorepos.device.DeviceFactory;
import com.ndtcorepos.device.DeviceService;
import com.ndtcorepos.device.connection.IDisconnectListener;
import com.ndtcorepos.device.enums.DisconnectReason;
import com.ndtcorepos.device.error.DeviceException;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.function.Function;

/** Các hàm JS gọi tới tầng thiết bị: đổi tham số, gọi `DeviceService`, trả Promise; phát sự kiện mất kết nối. */
public final class DeviceModule extends ReactContextBaseJavaModule implements IDisconnectListener {

    private static final String LOG_SOURCE = "DeviceModule";

    private static final String MODULE_NAME = "DeviceModule";

    private static final String DISCONNECTED_EVENT = "DeviceDisconnected";

    /** Mã riêng của bridge cho lỗi lập trình (exception không mang mã); không thuộc `DeviceErrorCode`. */
    private static final String INTERNAL_ERROR_CODE = "INTERNAL_ERROR";

    private final DeviceService deviceService;

    public DeviceModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.deviceService = DeviceFactory.create(reactContext, this);
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void discover(String type, Promise promise) {
        try {
            settle(deviceService.discover(DeviceMapper.toTransportType(type)), promise, DeviceMapper::toWritableArray);
        } catch (DeviceException | RuntimeException exception) {
            reject(promise, exception);
        }
    }

    @ReactMethod
    public void connect(ReadableMap address, Promise promise) {
        try {
            settle(deviceService.connect(DeviceMapper.toAddress(address)), promise, DeviceMapper::toWritableMap);
        } catch (DeviceException | RuntimeException exception) {
            reject(promise, exception);
        }
    }

    @ReactMethod
    public void write(
            String connectionId,
            String base64Data,
            double timeoutMs,
            Promise promise) {
        try {
            byte[] data = DeviceMapper.toBytes(base64Data);
            long timeoutMillis = DeviceMapper.toTimeoutMillis(timeoutMs);
            settle(deviceService.write(connectionId, data, timeoutMillis), promise, ignored -> null);
        } catch (DeviceException | RuntimeException exception) {
            reject(promise, exception);
        }
    }

    @ReactMethod
    public void read(
            String connectionId,
            double maxBytes,
            double timeoutMs,
            Promise promise) {
        try {
            int maxByteCount = DeviceMapper.toMaxBytes(maxBytes);
            long timeoutMillis = DeviceMapper.toTimeoutMillis(timeoutMs);
            CompletableFuture<byte[]> response = deviceService.read(connectionId, maxByteCount, timeoutMillis);
            settle(response, promise, DeviceMapper::toBase64OrNull);
        } catch (DeviceException | RuntimeException exception) {
            reject(promise, exception);
        }
    }

    @ReactMethod
    public void disconnect(String connectionId, Promise promise) {
        try {
            settle(deviceService.disconnect(connectionId), promise, ignored -> null);
        } catch (RuntimeException exception) {
            reject(promise, exception);
        }
    }

    /** React Native gọi khi reload hoặc huỷ module: đóng mọi kết nối, receiver và luồng. */
    @Override
    public void invalidate() {
        deviceService.close();
        super.invalidate();
    }

    /**
     * Phát sự kiện lên JS; bỏ qua khi React không còn chạy. React có thể dừng ngay sau lần kiểm tra, nên lỗi khi
     * phát chỉ ghi log để không lan về luồng kết nối.
     */
    @Override
    public void onDisconnected(String connectionId, DisconnectReason reason) {
        ReactApplicationContext context = getReactApplicationContext();

        if (!context.hasActiveReactInstance()) {
            return;
        }

        try {
            context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit(DISCONNECTED_EVENT, DeviceMapper.toDisconnectedEvent(connectionId, reason));
        } catch (RuntimeException exception) {
            Log.w(LOG_SOURCE, "Không phát được sự kiện mất kết nối", exception);
        }
    }

    /** Không bao giờ chờ kết quả: callback chạy trên luồng hoàn tất future, React Native tự chuyển về JS. */
    private static <T> void settle(
            CompletableFuture<T> future,
            Promise promise,
            Function<T, Object> toJs) {
        future.whenComplete((value, error) -> complete(promise, value, error, toJs));
    }

    private static <T> void complete(
            Promise promise,
            T value,
            Throwable error,
            Function<T, Object> toJs) {
        if (error != null) {
            reject(promise, unwrap(error));
            return;
        }

        try {
            promise.resolve(toJs.apply(value));
        } catch (RuntimeException exception) {
            reject(promise, exception);
        }
    }

    private static void reject(Promise promise, Throwable error) {
        if (!(error instanceof CodedException)) {
            Log.e(LOG_SOURCE, "Lỗi không mong đợi ở tầng thiết bị", error);
            promise.reject(INTERNAL_ERROR_CODE, error.getMessage(), error);
            return;
        }

        CodedException codedException = (CodedException) error;
        WritableMap userInfo = codedException instanceof DeviceException
                ? DeviceMapper.toUserInfo((DeviceException) codedException)
                : null;
        promise.reject(codedException.code(), codedException.getMessage(), codedException, userInfo);
    }

    private static Throwable unwrap(Throwable error) {
        if (error instanceof CompletionException && error.getCause() != null) {
            return error.getCause();
        }

        return error;
    }
}
