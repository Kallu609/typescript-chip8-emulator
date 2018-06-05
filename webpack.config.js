const path = require('path');
const webpack = require('webpack');

// process.noDeprecation = true;

module.exports = {
  mode: 'development',
  entry: {
    'js/bundle': './src/client/app.ts',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'src/client/public')
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ]
  }
};