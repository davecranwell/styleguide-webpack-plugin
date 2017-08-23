import path from 'path';
import {forEach, merge, extend} from 'lodash';
import fs from 'fs';

import utils from 'livingcss/lib/utils';
import parseComments from 'livingcss/lib/parseComments';
import tags from 'livingcss/lib/tags';

import Handlebars from 'handlebars';

const defaults = {
    template: path.join(path.dirname(require.resolve('livingcss')), 'template/template.hbs'),
    partials: path.join(path.dirname(require.resolve('livingcss')), 'template/partials/*.hbs'),
    dest: 'styleguide',
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
}

function StyleGuidePlugin(options) {
    this.options = extend(defaults, options);
    this.options.source = (typeof this.options.source === 'string' ? [this.options.source] : this.options.source);
}

StyleGuidePlugin.prototype.apply = function (compiler) {
    compiler.plugin('emit', (compilation, callback) => {
        this.build(compilation).then(pages => {
            callback()
        })
    });
};

StyleGuidePlugin.prototype.build = function (compilation) {
    const context = merge({}, this.options.context);

    return Promise.all(
        [
            this.readTemplate(),
            this.readPartials(),
            this.parseComments(context)
        ]
    ).then(values => {
        return this.buildPages(context, values[0]);
    }).then(pages => {
        return this.registerPages(compilation, pages);
    });
}

StyleGuidePlugin.prototype.readTemplate = function () {
    return new Promise((resolve, reject) => {
        fs.readFile(this.options.template, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            }

            resolve(data);
        });
    });
};

StyleGuidePlugin.prototype.readPartials = function () {
    return utils.readFileGlobs(this.options.partials, (data, file) => {
        Handlebars.registerPartial(path.basename(file, path.extname(file)), data)
    });
};

StyleGuidePlugin.prototype.parseComments = function (context) {
    return utils.readFileGlobs(this.options.source, (data, file) => {
        parseComments(data, file, tags, context);
    });
};

StyleGuidePlugin.prototype.buildPages = function (context, template) {
    // throw error if an @sectionof referenced a section that was never defined
    forEach(tags.forwardReferenceSections, (section) => {
        if (!tags.forwardReferenceSections.hasOwnProperty(section)) {
            return;
        }

        throw tags.forwardReferenceSections[section][0].error;
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

StyleGuidePlugin.prototype.getAssets = function (compilation) {
    const assets = {
        styles: [],
        scripts: []
    };

    forEach(this.options.chunks, (key) => {
        forEach(compilation.getStats().toJson().assetsByChunkName[key], (file) => {
            const ext = path.extname(file);

            if(ext === '.css'){
                assets.styles.push(compilation.assets[file].source())
            } else if (ext === '.js') {
                assets.scripts.push(path.join('/', file));
            }
        })
    });

    return assets;
};

StyleGuidePlugin.prototype.registerPages = function (compilation, pages) {
    const promises = [];
    const assets = this.getAssets(compilation);

    forEach(pages, (page, index) => {
        promises.push(this.registerPage(compilation, page, assets))
    });

    return Promise.all(promises);
};

StyleGuidePlugin.prototype.registerPage = function (compilation, page, assets) {
    return new Promise((resolve, reject) => {
        // find all root sections (sections with no parent) by removing all number
        // indices but keeping the named indices
        for (let i = 0; i < page.context.sections.length; ) {
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

        const html = Handlebars.compile(page.template)(page.context);

        if(this.options.preprocess){
            this.options.preprocess(page.context, page.template, Handlebars)
        }

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
