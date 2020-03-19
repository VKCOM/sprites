const { readFileSync } = require('fs');
const posthtml = require('posthtml');
const postcss = require('postcss');

class CustomPropertiesRenderer {
  /**
   * @param {Object} [options.variables] Custom Properties in format `{ '--one': '#fff' }`
   * @param {string[]} [options.importFrom] Paths to import Custom Properties from CSS files. Must be in :root block.
   */
  constructor (options = {}) {
    this._options = {
      importFrom: [],
      variables: {},
      ...options,
    };

    this._notResolvedColors = [];

    this._customProperties = {};

    // Import Custom Properties from paths
    this._options.importFrom.map(importPath => {
      const css = readFileSync(importPath);
      const root = postcss.parse(css);

      root.walkDecls((decl) => {
        this._customProperties[decl.prop] = decl.value;
      });
    });

    // `variables` from `options` must override variables from imports
    this._customProperties = {
      ...this._customProperties,
      ...this._options.variables,
    };
  }

  /**
   * @private
   * @param {string} value
   * @returns {string}
   */
  _resolveColor (value) {
    const match = value.match(/^var\((--[^\s(),]+)(?:,\s?(.*?))?\)$/);
    if (match && match[1]) {
      const color = this._customProperties[match[1]];

      if (!color) {
        if (match[2]) {
          console.warn(`There is no value for '${match[1]}', using fallback '${match[2]}'`);
          return this._resolveColor(match[2]);
        } else {
          // Collect all issues to display it at once
          this._notResolvedColors.push(match[1]);
          return value;
        }
      }

      return color;
    }

    return value;
  }

  /**
   * @param {string} svg SVG content
   * @returns {Promise<string>}
   */
  async process (svg) {
    return posthtml()
      .use((tree) => {
        tree.walk((node) => {
          if (node.attrs && node.attrs.fill) {
            node.attrs.fill = this._resolveColor(node.attrs.fill);
          }
          if (node.attrs && node.attrs.stroke) {
            node.attrs.stroke = this._resolveColor(node.attrs.stroke);
          }
          return node;
        });
      })
      .process(svg)
      .then(({ html }) => {
        if (this._notResolvedColors.length) {
          throw new Error(`Can not resolve colors: ${this._notResolvedColors.join(', ')}`);
        }
        return html;
      });
  }
}

module.exports = {
  CustomPropertiesRenderer,
};
