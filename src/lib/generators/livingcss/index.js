import path from 'path';
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

function livingCSSGenerator(options) {
    options.source = _.concat([], options.source);
    options.sortOrder = _.concat([], options.sortOrder);

    this.options = _.merge(defaults, options);
    this.context = _.merge({}, context);
}

livingCSSGenerator.prototype.build = function () {
    const context = _.merge({}, this.context);

    return Promise.all(
        [
            this._loadTemplate(),
            this._loadPartials(),
            this._parseComments(context)
        ]
    ).then(values => {
        return this._buildPages(context, values[0]);
    });
};

livingCSSGenerator.prototype.render = function (pages, givenAssets) {
    return this._buildAssets(givenAssets).then(assets => {
        return Promise.all(
            _.map(
                pages,
                page => {
                    return this._renderPage(page, assets)
                }
            )
        ).then((pages) => {
            return pages;
        });
    })
};

/*******************************************************************/
/*private*/
/*******************************************************************/

livingCSSGenerator.prototype._buildPages = function (context, template) {
    // throw error if an @sectionof referenced a section that was never defined
    _.forEach(this.options.tags.forwardReferenceSections, (section) => {
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

    _.forEach(context.pages, (page, index) => {
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

livingCSSGenerator.prototype._renderPage = function (page, assets) {
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

        page.context.parsedStylesheets = _.merge(page.context.parsedStylesheets, assets.styles);
        page.context.scripts = _.merge(page.context.scripts, assets.scripts);

        if (this.options.preprocess) {
            this.options.preprocess(page.context, page.template, Handlebars)
        }

        const html = Handlebars.compile(page.template)(page.context);

        resolve({
            url: page.url,
            html: html
        });
    });
};

livingCSSGenerator.prototype._buildAssets = function (givenAssets) {
    const assets = _.merge({
        styles: [],
        scripts: []
    }, givenAssets);

    return utils.readFiles(this.context.stylesheets, function (data) {
        assets.styles.push(data);
    }).then(() => {
        return assets;
    });
};

livingCSSGenerator.prototype._loadTemplate = function () {
    return new Promise((resolve, reject) => {
        fs.readFile(this.options.template, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            }

            resolve(data);
        });
    });
};

livingCSSGenerator.prototype._loadPartials = function () {
    return utils.readFileGlobs(this.options.partials, (data, file) => {
        Handlebars.registerPartial(path.basename(file, path.extname(file)), data)
    });
};

livingCSSGenerator.prototype._parseComments = function (context) {
    return utils.readFileGlobs(this.options.source, (data, file) => {
        parseComments(data, file, this.options.tags, context);
    });
};

module.exports = livingCSSGenerator;
