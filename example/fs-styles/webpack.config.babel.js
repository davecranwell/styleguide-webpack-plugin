import path from 'path';
import LivingCSSWebpackPlugin from '../../src';
import ExtractTextWebpackPlugin from 'extract-text-webpack-plugin';
import CleanWebpackPlugin from 'clean-webpack-plugin';

const extractCss = new ExtractTextWebpackPlugin({
    filename: "template/css/[name].css",
    disable: process.env.NODE_ENV === "development"
});

const output_path = path.join(__dirname, 'dist');

export default {
    context: __dirname,
    entry: {
        frontend: [
            'fs-styles/dist/familysearch-styles.min.css'
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
                test: /\.css/,
                use: extractCss.extract(
                    {
                        use: [
                            {
                                loader: "css-loader"
                            }
                        ],
                        fallback: "style-loader"
                    }
                )
            },
        ]
    },
    plugins: [
        extractCss,

        new CleanWebpackPlugin(['dist'], {
            root: __dirname
        }),

        new LivingCSSWebpackPlugin(
            {
                source: [path.join(process.cwd(), 'node_modules', 'fs-styles', 'assets', 'css', '**', '*.styl')],
                dest: 'styleguide', // destination of styleguide
                chunks: ['frontend'], // what chunks should be included (js and css files)
                tags: {},
                preprocess: function (context, template, handlebars) {
                    context.title = "LivingCSS Style Guide";
                    context.footerHTML = "Style Guide generated with <a href=\"https://github.com/straker/livingcss\">LivingCSS</a>.";
                    context.globalStylesheets = []; // stylesheets for page
                    context.stylesheets = []; // stylesheets for polymer previews
                }
            }
        )
    ]
};
