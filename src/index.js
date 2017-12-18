const _ = require('lodash');
const path = require('path');
const generators = require('./lib/generators');

function StyleGuidePlugin(options) {
    const source = options.source;
    const dest = options.dest || "";

    let generator = options.generator;
    let err = false;

    if (typeof generator !== 'function' && typeof generator === 'string' && generators[generator]) {
        generator = generators[generator];
    }

    _.unset(options, 'source');
    _.unset(options, 'dest');
    _.unset(options, 'generator');

    if (typeof generator !== 'function') {
        console.warn(`${generator} generator not found`);
        err = true;
    }

    if (!source) {
        console.warn(`no source set for ${generator} generator`);
        err = true;
    }

    if (err) {
        this.apply = function (compiler) {}
        return
    }

    this.options = options;
    this.generator = new generator(source, dest, this.options.options);
}

StyleGuidePlugin.prototype.apply = function (compiler) {
    let compilationPromise;

    compiler.plugin('before-compile', (compilation, callback) => {
        compilationPromise = this.build(callback);
    });

    compiler.plugin('emit', (compilation, callback) => {
        compilationPromise.then(pages => {
            this.render(compilation, callback, pages);
        })
    });
};

StyleGuidePlugin.prototype.build = function (callback) {
    return this.generator.build().then(pages => {
        callback();
        return pages
    });
};

StyleGuidePlugin.prototype.render = function (compilation, callback, pages) {
    new Promise((resolve, reject) => {
        const assets = this._buildAssets(compilation);
        const generatedPages = this.generator.render(pages, assets);

        resolve(generatedPages);
    }).then((pages) => {
            _.forEach(pages, page => {
                this._registerPage(compilation, page);
            });

            callback();
        }
    )
};

/*******************************************************************/
/*private*/
/*******************************************************************/

StyleGuidePlugin.prototype._buildAssets = function (compilation) {
    const assets = {
        styles: [],
        scripts: []
    };

    _.forEach(this.options.chunks, (key) => {
        const pushAsset = function(file) {
            const ext = path.extname(file);

            if (ext === '.css') {
                assets.styles.push(compilation.assets[file].source())
            } else if (ext === '.js') {
                assets.scripts.push(path.join('/', file));
            }
        }   

        _.forEach(this.options.chunks, (key) => {
            const asset = compilation.getStats().toJson().assetsByChunkName[key];

            if(typeof asset === 'string') {
                pushAsset(asset)
            } else {
                _.forEach(asset, (file) => {
                    pushAsset(file)
                })
            }
        });
    });

    return assets;
};

StyleGuidePlugin.prototype._registerPage = function (compilation, page) {
    compilation.assets[page.url] = {
        source: function () {
            return page.html;
        },
        size: function () {
            return page.html.length;
        }
    };
};

module.exports = StyleGuidePlugin;
