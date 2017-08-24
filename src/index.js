import _ from 'lodash';
import generator from './lib/generator';

function StyleGuidePlugin(options) {
    this.options = options;
}

StyleGuidePlugin.prototype.apply = function (compiler) {
    _.forEach(this.options, (options, name) => {
        new generator(name, options).generate(compiler);
    })
};

module.exports = StyleGuidePlugin;
