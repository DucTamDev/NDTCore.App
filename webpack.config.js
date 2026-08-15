// webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: path.resolve(__dirname, 'index.web.tsx'),
  output: {
    path: path.resolve(__dirname, 'dist-web'),
    filename: 'bundle.js',
  },
  resolve: {
    alias: {
      'react-native$': 'react-native-web',
      // Các module native-thuần cho máy in — DriverRegistry.web.ts (Task 2)
      // không import chúng, nhưng alias sang `false` để Webpack không bao giờ
      // cố resolve chúng nếu có đường import gián tiếp nào khác chạm tới.
      'react-native-bluetooth-classic': false,
      '@poriyaalar/react-native-thermal-receipt-printer': false,
      'react-native-tcp-socket': false,
      'react-native-nitro-modules': false,
      // react-native-paper và @react-native-vector-icons/common thử require()
      // các thư viện icon thay thế (Expo/react-native-vector-icons) bên trong
      // try/catch — chỉ để tự phát hiện thư viện nào có sẵn lúc runtime, không
      // bao giờ thực sự cần trên web vì @react-native-vector-icons/material-design-icons
      // (thư viện app đang dùng) luôn resolve thành công trước các nhánh catch
      // này. Alias sang `false` để Webpack không emit "Module not found" cho
      // các require() không bao giờ được thực thi.
      'expo-font': false,
      '@react-native-vector-icons/get-image': false,
      '@expo/vector-icons/MaterialCommunityIcons': false,
      'react-native-vector-icons/MaterialCommunityIcons': false,
    },
    extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules[\\/](?!(react-native|@react-native|@react-navigation)[\w-]*[\\/])/,
        use: {
          loader: 'babel-loader',
          options: {
            // disableImportExportTransform: @react-native/babel-preset chạy
            // @babel/plugin-transform-modules-commonjs mặc định (dành cho Metro,
            // không cần CJS thật vì Metro tự có module system riêng). Với Webpack,
            // các gói @react-navigation/* build ESM (`lib/module/`) sau khi bị babel
            // chuyển sang CommonJS vẫn giữ nguyên identifier "exports"/"require" —
            // nhưng Webpack nhận diện marker `__esModule` do babel sinh ra và coi
            // module là Harmony-compatible, đổi tên tham số exports/module của
            // wrapper sang __webpack_exports__/__webpack_module__ nội bộ mà KHÔNG
            // viết lại các dòng "exports"/"require" cứng trong thân module babel đã
            // sinh ra từ trước → "ReferenceError: exports is not defined" khi chạy
            // trong browser thật (không có global exports như Node).
            // Tắt transform import/export của preset, để Webpack tự parse cú pháp
            // ESM gốc (native harmony parsing) — toàn bộ code interop khi đó do
            // chính Webpack sinh ra, nhất quán, không còn xung đột định danh.
            //
            // enableBabelRuntime: false — cùng một class bug với
            // disableImportExportTransform ở trên, nhưng phát sinh từ hướng khác.
            // Mặc định preset còn nạp @babel/plugin-transform-runtime để thay các
            // cú pháp destructuring mảng/async bằng helper `@babel/runtime`. Từ
            // Babel 7.13, plugin này tự phát hiện `caller.supportsStaticESM` —
            // mà babel-loader LUÔN set `true` (node_modules/babel-loader/lib/
            // injectCaller.js) — nên nó chèn `import ... from
            // '@babel/runtime/helpers/esm/...'` (cú pháp ESM thật) vào ĐẦU các
            // file, kể cả file vốn là CommonJS thuần (vd:
            // @react-native-vector-icons/common/lib/commonjs/create-icon-set.js —
            // không có import/export gốc, chỉ có require()/exports). File từ CJS
            // thuần bỗng lẫn cú pháp ESM thật → Webpack coi cả file là Harmony
            // module, đổi tên tham số exports/module của wrapper — nhưng phần
            // thân CommonJS gốc (require/`Object.defineProperty(exports,
            // "__esModule",...)`) không được viết lại vì disableImportExportTransform
            // chặn @babel/plugin-transform-modules-commonjs xử lý file này (không
            // có gì để nó "chuyển đổi" cả, vì phần thân vốn đã là CJS) → cùng lỗi
            // "ReferenceError: exports is not defined" khi chạy trong browser thật.
            // Phát hiện bằng cách log lỗi thật bị try/catch nuốt trong
            // react-native-paper's loadIconModule() (MaterialCommunityIcon.js) —
            // đây là nguyên nhân icon 'cog'/'point-of-sale' render ra ô vuông rỗng
            // (FallbackIcon) thay vì icon thật.
            // Tắt hẳn @babel/plugin-transform-runtime (không cần cho build web —
            // trình duyệt hiện đại hỗ trợ sẵn destructuring/async/await, không cần
            // regenerator/helper runtime như Hermes) để loại bỏ hoàn toàn nguồn
            // chèn import ESM giả này.
            presets: [
              [
                'module:@react-native/babel-preset',
                { disableImportExportTransform: true, enableBabelRuntime: false },
              ],
            ],
          },
        },
        // Với import/export không bị babel chuyển sang CommonJS nữa, Webpack coi
        // các file này là "strict ESM" và mặc định đòi hỏi extension đầy đủ trên
        // mọi relative import (theo đúng spec ESM). Nhưng @react-navigation/*
        // build ra các import kiểu `./useLinking` (thiếu ".js") — hợp lệ với
        // Node/Metro resolver nhưng bị Webpack coi là lỗi ("fully specified").
        // fullySpecified: false tắt yêu cầu đó, quay lại dùng resolve.extensions
        // như các module khác.
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.ttf$/,
        type: 'asset/resource',
      },
      {
        // react-native-paper import các asset .png (vd: back-chevron.png,
        // avatar.png) trực tiếp trong source — cần rule asset/resource
        // giống .ttf, nếu không Webpack sẽ cố parse binary PNG như JS module.
        test: /\.(png|jpe?g|gif)$/,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'web/index.html'),
    }),
  ],
  devServer: {
    historyApiFallback: true,
    port: 8082,
    // 4 warnings are permanently benign (see comment above) — don't let them
    // cover the whole page with a full-screen overlay on every reload.
    client: {
      overlay: {
        errors: true,
        warnings: false,
      },
    },
  },
};
