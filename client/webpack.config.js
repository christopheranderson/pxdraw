const path = require('path');
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
    entry: './built/main.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist')
    },
    mode: 'production',
    devtool: 'eval-source-map',
    plugins: [
        new HtmlWebpackPlugin({
            template: "./src/index.html",
            inject: false,
            filename: "../index.html",
            templateParameters:{
                appInsightsKey: process.env.PXDRAW_APPINSIGHTS_KEY || "<instrumentation key here>",
            }
        })
    ]
};