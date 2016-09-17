var webpack = require('webpack');
var path = require('path');

var BUILD_DIR = path.resolve(__dirname, 'padrino/static');
var APP_DIR = path.resolve(__dirname, 'padrino/app');

module.exports = {
  entry: APP_DIR + '/main.jsx',
  output: {
    path: BUILD_DIR,
    filename: 'bundle.js'
  },
  module: {
    preLoaders: [{
      test: /\.json$/,
      exclude: /node_modules/,
      loader: 'json'
    }],
    loaders: [{
      test: /\.jsx?$/,
      include: APP_DIR,
      loader: 'babel'
    }]
  },
  plugins: [new webpack.DefinePlugin({
    'process.env': {
      'NODE_ENV': JSON.stringify(process.env.NODE_ENV)
    }
  })]
};
