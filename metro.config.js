const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/** Repo package máy in, App phụ thuộc bằng file: nên Metro phải theo dõi cả thư mục này. */
const packageRoot = path.resolve(__dirname, '../NDTCore.Package');

/** Module chỉ được có một bản trong bundle; package có node_modules riêng nên phải ép lấy từ App. */
const SINGLETONS = ['react', 'react-native', 'react-native-mmkv', 'react-native-view-shot', '@ndtcore/printer-native'];

/** true khi moduleName là singleton hoặc file con của singleton (vd react-native/Libraries/...). */
const isSingleton = (moduleName) =>
  SINGLETONS.some((name) => moduleName === name || moduleName.startsWith(`${name}/`));

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [packageRoot],
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      if (isSingleton(moduleName) && context.originModulePath.startsWith(packageRoot)) {
        // Resolve như thể import từ App để lấy bản trong node_modules của App.
        const appContext = { ...context, originModulePath: path.join(__dirname, 'index.js') };
        return context.resolveRequest(appContext, moduleName, platform);
      }

      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
