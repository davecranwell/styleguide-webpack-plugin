import path from 'path';
import LivingCSSWebpackPlugin from '../../src';
import HTMLWebpackPlugin from 'html-webpack-plugin';
import ExtractTextWebpackPlugin from 'extract-text-webpack-plugin';
import CleanWebpackPlugin from 'clean-webpack-plugin';

const extractSass = new ExtractTextWebpackPlugin({
    filename: "template/css/[name].css",
    disable: process.env.NODE_ENV === "development"
});

const output_path = path.join(__dirname, 'dist');

export default {
    context: __dirname,
    entry: {
        frontend: [
            './app/asset/style/scope/frontend.scss'
        ]
    },
    output: {
        path: output_path,
        filename: 'template/js/[name].js'
    },
    devServer: {
        contentBase: output_path,
    },
    module: {
        loaders: [
            {
                test: /\.scss/,
                use: extractSass.extract(
                    {
                        use: [
                            {
                                loader: "css-loader"
                            }, {
                                loader: "sass-loader"
                            }
                        ],
                        fallback: "style-loader"
                    }
                )
            },
        ]
    },
    plugins: [
        extractSass,

        new CleanWebpackPlugin(['dist'], {
            root: __dirname
        }),

        new HTMLWebpackPlugin(
            {
                filename: "template/index.html",
                template: "app/view/index.html"
            }
        ),

        new LivingCSSWebpackPlugin(
            {
                source: [path.join(__dirname, 'app', '**', '*.scss')],
                dest: 'styleguide',
                chunks: ['frontend'],
                preprocess: function(context, template, handlebars){
                }
            }
        )
    ]
};
