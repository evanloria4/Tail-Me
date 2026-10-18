require('dotenv').config();
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
// Own folder so the server only exposes the client build, not tsc's dist/server
const DIST_DIR = path.resolve(__dirname, 'dist', 'client');
const SRC_DIR = path.resolve(__dirname, 'src');
const CLIENT_DIR = path.resolve(__dirname, 'src', 'client');

module.exports = {
  entry: path.resolve(CLIENT_DIR, 'index.tsx'),
  output: {
    path: DIST_DIR,
    publicPath: '/',
    // Hashed so each deploy gets a new URL instead of a stale cached bundle
    filename: 'bundle.[contenthash].js',
  },
  devServer: {
    static: {
      directory: DIST_DIR, // Serve from dist
    },
    hot: true,
    open: true,
    historyApiFallback: true,
    port: 4000,
    proxy: [
      {
        context: ['/api'],
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    ],
  },
  module: {
    rules: [
      {
        test: /\.(m?js)$/,
        type: 'javascript/auto',
        resolve: {
          fullySpecified: false,
        }
      },
      {
        test: /\.(png|jpg|gif|mp3|aac|ogg|ico)$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name].[contenthash][ext]'
        }
      },
      {
        test: /\.(ts|tsx)$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: [
                '@babel/preset-env',
                '@babel/preset-typescript',
                '@babel/preset-react',
              ]
            }
          },
        ],
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
            }
          },
          'postcss-loader'
        ],
      },
    ]
  },
  plugins: [
    // Only these public values reach the browser; everything else in .env stays server-side
    new webpack.DefinePlugin({
      'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY),
    }),
    new BundleAnalyzerPlugin({
      analyzerMode: 'disabled',
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(CLIENT_DIR, 'index.html'),
      filename: 'index.html',
      inject: true
    }),
    // Cleans dist/client only; tsc's dist/server, dist/shared, dist/generated are untouched
    new CleanWebpackPlugin(),
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.css'],
    alias: {
      '@': SRC_DIR,
    },
    modules: [
      'node_modules',
      SRC_DIR,
    ],
    fallback: {
      "crypto": false
    }
  }
};
