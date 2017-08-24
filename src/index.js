import path from 'path';
import {forEach, merge, concat} from 'lodash';
import _ from 'lodash';
import fs from 'fs';

import utils from 'livingcss/lib/utils';
import parseComments from 'livingcss/lib/parseComments';
import tags from 'livingcss/lib/tags';

import Handlebars from 'handlebars';

const defaults = {
    template: path.join(path.dirname(require.resolve('livingcss')), 'template/template.hbs'),
    partials: path.join(path.dirname(require.resolve('livingcss')), 'template/partials/*.hbs'),
    dest: 'styleguide',
    tags: tags,
    sortOrder: [],
    context: {
        footerHTML: '',
        globalStylesheets: [],
        menuButtonHTML: 'Menu',
        pageOrder: [],
        pages: [],
        scripts: [],
        sections: [],
        stylesheets: [],
        title: ''
    },
    source: []
};

const context = {
    footerHTML: '',
    globalStylesheets: [],
    menuButtonHTML: 'Menu',
    pageOrder: [],
    pages: [],
    scripts: [],
    sections: [],
    stylesheets: [],
    title: ''
};

function StyleGuidePlugin(options) {
    options.source = concat([], options.source);
    options.sortOrder = concat([], options.sortOrder);

    this.options = merge(defaults, options);
    this.context = merge({}, context);
}

StyleGuidePlugin.prototype.apply = function (compiler) {
    let compilationPromise;

    compiler.plugin('before-compile', (compilation, callback) => {
        compilationPromise = this.build(compilation).then(pages => {
            callback();
            return pages
        })
    });

    compiler.plugin('emit', (compilation, callback) => {
        compilationPromise.then(pages => {
            return this.registerPages(compilation, pages);
        }).then(() => {
                callback();
            }
        )
    });
};

StyleGuidePlugin.prototype.build = function (compilation) {
    const context = merge({}, this.context);

    return Promise.all(
        [
            this.loadTemplate(),
            this.loadPartials(),
            this.parseComments(context)
        ]
    ).then(values => {
        return this.buildPages(context, values[0]);
    });
}

StyleGuidePlugin.prototype.loadTemplate = function () {
    return new Promise((resolve, reject) => {
        fs.readFile(this.options.template, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            }

            resolve(data);
        });
    });
};

StyleGuidePlugin.prototype.loadPartials = function () {
    return utils.readFileGlobs(this.options.partials, (data, file) => {
        Handlebars.registerPartial(path.basename(file, path.extname(file)), data)
    });
};

StyleGuidePlugin.prototype.parseComments = function (context) {
    return utils.readFileGlobs(this.options.source, (data, file) => {
        parseComments(data, file, this.options.tags, context);
    });
};

StyleGuidePlugin.prototype.buildPages = function (context, template) {
    // throw error if an @sectionof referenced a section that was never defined
    forEach(this.options.tags.forwardReferenceSections, (section) => {
        if (!this.options.tags.forwardReferenceSections.hasOwnProperty(section)) {
            return;
        }

        throw this.options.tags.forwardReferenceSections[section][0].error;
    })

    utils.generateSortOrder(context, this.options.sortOrder);
    utils.sortCategoryBy(context.pages, context.pageOrder);

    if (context.pages.length === 0) {
        console.warn('Warning: no pages generated from source files.');
    } else if (context.pages.length > 1) {
        context.navbar = context.pages.map((page) => {
            return {
                name: page.name,
                url: `${page.id}.html`
            };
        });
    }

    const pages = [];

    forEach(context.pages, (page, index) => {
        const pageContext = JSON.parse(JSON.stringify(context));

        pageContext.sections = page.sections;
        pageContext.sectionOrder = page.sectionOrder;
        pageContext.id = page.id;

        // set current page selected
        if (context.navbar) {
            pageContext.navbar[index].selected = true;
        }

        // values[0] = handlebars template
        pages.push(
            {
                url: path.join(this.options.dest, `${page.id}.html`),
                template: template,
                context: pageContext
            }
        );
    });

    return pages;
};

StyleGuidePlugin.prototype.loadAssets = function (compilation) {
    const assets = {
        styles: [],
        scripts: []
    };

    return new Promise((resolve, reject) => {
        forEach(this.options.chunks, (key) => {
            forEach(compilation.getStats().toJson().assetsByChunkName[key], (file) => {
                const ext = path.extname(file);

                if (ext === '.css') {
                    assets.styles.push(compilation.assets[file].source())
                } else if (ext === '.js') {
                    assets.scripts.push(path.join('/', file));
                }
            })
        });

        resolve(assets);
    }).then(() => {
        return utils.readFiles(this.context.stylesheets, function (data) {
            assets.styles.push(data);
        });
    }).then(() => {
        return assets;
    });
};

StyleGuidePlugin.prototype.registerPages = function (compilation, pages) {
    const promises = [];

    return this.loadAssets(compilation).then(assets => {
        forEach(pages, (page, index) => {
            promises.push(this.registerPage(compilation, page, assets))
        });
    }).then(() => {
        return Promise.all(promises);
    });
};

StyleGuidePlugin.prototype.registerPage = function (compilation, page, assets) {
    return new Promise((resolve, reject) => {
        // find all root sections (sections with no parent) by removing all number
        // indices but keeping the named indices
        for (let i = 0; i < page.context.sections.length;) {
            if (page.context.sections[i].parent) {
                page.context.sections.splice(i, 1);
            }
            else {
                i++;
            }
        }

        // sort root sections by section order
        if (page.context.sectionOrder) {
            utils.sortCategoryBy(page.context.sections, page.context.sectionOrder);
        }

        if (typeof this.options.preprocess !== 'undefined' &&
            typeof this.options.preprocess !== 'function') {
            throw new SyntaxError('options.preprocess must be a function');
        }

        page.context.parsedStylesheets = merge(page.context.parsedStylesheets, assets.styles);
        page.context.scripts = merge(page.context.scripts, assets.scripts);

        if (this.options.preprocess) {
            this.options.preprocess(page.context, page.template, Handlebars)
        }

        const html = Handlebars.compile(page.template)(page.context);

        compilation.assets[page.url] = {
            source: function () {
                return html;
            },
            size: function () {
                return html.length;
            }
        };

        resolve();
    });
};

module.exports = StyleGuidePlugin;
