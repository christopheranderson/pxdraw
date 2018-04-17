const path = require('path');

module.exports = {
  entry: './built/main.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  }
};