const path = require('path');
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require('webpack');

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
                appInsightsKey: process.env.PXDRAW_APPINSIGHTS_KEY || "",
                REGION: process.env.PXDRAW_REGION_LABEL || ""
            }
        }),
        new webpack.DefinePlugin({
            METADATA_ENDPOINT: JSON.stringify(process.env.PXDRAW_METADATA_ENDPOINT || "http://localhost:7071/api/metadata"),
            ENABLE_TOP_TEAMS: !!process.env.PXDRAW_ENABLE_TOP_TEAMS
        })
    ]
};