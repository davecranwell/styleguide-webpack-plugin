import _ from 'lodash';
import path from 'path';
import * as generators from './generators';

function Generator(generatorName, generatorOptions) {
    const generator = generatorOptions.generator || generators[`_${generatorName}Generator`];
    const source = generatorOptions.source;
    const dest = generatorOptions.dest || "";

    let err = false;

    if(!generator){
        console.warn(`${generatorName} generator not found`);
        err = true;
    }

    if(!source){
        console.warn(`no source set for ${generatorName} generator`);
        err = true;
    }

    if(err) {
        this.generate = function (compiler) {}
        return
    }

    _.unset(generatorOptions, 'source')
    _.unset(generatorOptions, 'dest')


    this.options = generatorOptions;
    this.generator = new generator(source, dest, this.options.options);
}

Generator.prototype.generate = function (compiler) {
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

Generator.prototype.build = function (callback) {
    return this.generator.build().then(pages => {
        callback();
        return pages
    });
};

Generator.prototype.render = function (compilation, callback, pages) {
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

Generator.prototype._buildAssets = function (compilation) {
    const assets = {
        styles: [],
        scripts: []
    };

    _.forEach(this.options.chunks, (key) => {
        _.forEach(compilation.getStats().toJson().assetsByChunkName[key], (file) => {
            const ext = path.extname(file);

            if (ext === '.css') {
                assets.styles.push(compilation.assets[file].source())
            } else if (ext === '.js') {
                assets.scripts.push(path.join('/', file));
            }
        })
    });

    return assets;
};

Generator.prototype._registerPage = function (compilation, page) {
    compilation.assets[page.url] = {
        source: function () {
            return page.html;
        },
        size: function () {
            return page.html.length;
        }
    };
};

module.exports = Generator;
