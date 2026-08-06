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
        exclude: /node_modules\/(?!(react-native|@react-native|@react-navigation)[\w-]*\/)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['module:@react-native/babel-preset'],
          },
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
    port: 8081,
  },
};
