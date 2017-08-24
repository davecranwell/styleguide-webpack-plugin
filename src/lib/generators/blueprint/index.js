import path from 'path';
import _ from 'lodash';
import fs from 'fs';

import utils from 'livingcss/lib/utils';
import parseComments from 'livingcss/lib/parseComments';
import tags from 'livingcss/lib/tags';

import Handlebars from 'handlebars';

const defaults = {};

function Blueprint(options) {
    this.options = _.merge(defaults, options);
}

Blueprint.prototype.build = function () {
    return Promise.resolve(/*values*/)
};

Blueprint.prototype.render = function (pages, givenAssets) {
    return Promise.resolve(/*pages*/)
};

module.exports = Blueprint;
