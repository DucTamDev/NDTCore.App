package com.ndtcorepos.bridge;

import androidx.annotation.NonNull;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import com.ndtcorepos.bridge.device.DeviceModule;

import java.util.Collections;
import java.util.List;

/** Đăng ký mọi native module của app với React Native. */
public final class NdtCorePosPackage implements ReactPackage {

    @NonNull
    @Override
    public List<NativeModule> createNativeModules(@NonNull ReactApplicationContext reactContext) {
        return Collections.singletonList(new DeviceModule(reactContext));
    }

    @NonNull
    @Override
    public List<ViewManager> createViewManagers(@NonNull ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
