// webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

// npm run build:web emits 4 benign "Module not found" warnings for
// 'expo-font' and '@react-native-vector-icons/get-image' — both are
// wrapped in try/catch in their source packages as optional Expo-only
// fallback paths this project doesn't use. Safe to ignore.

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
      'react-native-esc-pos-printer': false,
      'react-native-tcp-socket': false,
      'react-native-nitro-modules': false,
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
            presets: [
              ['module:@react-native/babel-preset', { disableImportExportTransform: true }],
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
  },
};
