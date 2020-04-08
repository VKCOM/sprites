const SVGSpriter = require("@vkontakte/svg-sprite");
const fs = require("fs");
const { extname, join, relative, basename } = require("path");
const { promisify } = require("util");

const GarbageCollector = require('./GarbageCollector');
const BaseConverter = require("./convert/BaseConverter");
const { CustomPropertiesRenderer } = require('./CustomPropertiesRenderer');
const { mergeDeep, checkDir } = require("./utils");

const readdir = promisify(fs.readdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const lstat = promisify(fs.lstat);
const { parse: parseSVG } = require('postsvg');

/**
 * @typedef Theme
 * @type {Object}
 * @property {boolean} [isDefault] This theme will be saved without theme's name prefix. There must be only one `isDefault: true`
 * @property {Object} [variables] Passed Custom Properties that will be replaced in SVGs with fixed colors. E.g. `{ '--one': '#fff' }`
 * @property {string[]} [importFrom] Paths to the CSS files with Custom Properties placed in :root block. These Custom Properties will be replaced in SVGs with fixed colors.
 */

/**
 *
 * @param {string} path Path to SVG icons entrypoint
 * @param {Object} output
 * @param {string} output.pngPath Path to folder where PNG sprites will be saved
 * @param {string} output.svgPath Path to folder where SVG sprites will be saved
 * @param {string} output.cssPath Path to folder where stylesheets will be saved
 * @param {string} output.examplePath Path to folder where stylesheets will be saved
 * @param {BaseConverter} converter SVG to PNG converter
 * @param {Object} options
 * @param {Object} options.css
 * @param {string} options.css.stylesheetPrefix Prefix in stylesheet name
 * @param {string} options.css.class Base class for icons
 * @param {Object} options.svg
 * @param {Object} options.svg.margin Gap between icons
 * @param {string} options.svg.dest Path to SVG where it should be placed on website
 * @param {Object} options.png
 * @param {string} options.png.dest Path to SVG where it should be placed on website
 * @param {string} options.png.class PNG class in top of DOM (e.g in the `<head>` or `<body>`) to detect fallback need
 * @param {string} options.png.scalePrefix Prefix for class with needed scale. E.g `png_2x` or `fallback_1x`
 * @param {Object} options.example
 * @param {Object.<string, Theme>} [options.themes] Themes
 */
async function generate(path, output = {}, converter, options) {
  const { pngPath, svgPath, cssPath, examplePath } = output;

  const defaultOptions = {
    css: {
      stylesheetPrefix: "icons-",
      class: "Icon"
    },
    svg: {
      dest: "/"
    },
    png: {
      dest: "/",
      class: "png",
      scalePrefix: "scale"
    },
    themes: {}
  };

  options = mergeDeep(defaultOptions, options);

  if (Object.keys(options.themes).length < 1) {
    options.themes = {
      'default': {
        isDefault: true,
      }
    };
  }

  await checkDir(path);
  await checkDir(svgPath);
  await checkDir(cssPath);

  if (pngPath) {
    await checkDir(pngPath);
  }
  if (examplePath) {
    await checkDir(examplePath);
  }

  const gc = new GarbageCollector();

  gc.addPath(pngPath);
  gc.addPath(svgPath);

  if (examplePath) {
    gc.addPath(examplePath);
  }

  const baseConfigGenerator = () => ({
    shape: {
      dimension: {
        attributes: true
      },
      spacing: {
        padding: options.svg.margin || 0,
        box: options.svg.margin ? "padding" : null
      },
      id: {
        generator: function (name, file) {
          return file.stem;
        }
      },
      transform: [
        {
          svgo: {
            plugins: [
              {
                prefixIds: {
                  prefix: function (node) {
                    return "___CHANGEME___";
                  }
                }
              },
              { cleanupIDs: false },
              { removeTitle: false },
              { removeDesc: false },
              { convertPathData: false },
              { removeComments: true },
              { removeMetadata: true },
              { cleanupAttrs: true },
            ]
          }
        }
      ]
    },
    svg: {
      xmlDeclaration: false,
      doctypeDeclaration: false,
      namespaceIDs: true,
      dimensionAttributes: false
    },
    variables: {
      now: +new Date(),
      png: function () {
        return function (sprite, render) {
          return render(sprite)
            .split(".svg")
            .join(".png");
        };
      }
    },
    mode: {
      css: {
        dest: cssPath,
        common: options.css.class,
        dimensions: true,
        bust: true,
        example: examplePath ? {
          example: {
            dest: examplePath
          }
        } : false,
        render: {
          css: true
        }
      }
    },
    dest: cssPath
  });

  const sprites = await findSprites(path, path);

  await Promise.all(
    Object.keys(sprites).map(async sprite => {
      const baseConfig = baseConfigGenerator();
      const config = {
        ...baseConfig,
        mode: {
          css: {
            ...baseConfig.mode.css,
            sprite: `${sprite}.svg`,
            prefix: `.${options.css.class}-${sprite}__%s`,
            common: `${options.css.class}-${sprite}`,
            render: {
              css: {
                dest:
                  join(`${options.css.stylesheetPrefix}${sprite}`) +
                  ".css",
                template: join(__dirname, "TEMPLATE.mustache")
              }
            }
          }
        },
        variables: {
          options,
          scales: converter ? converter.scales : [],
          themes: Object.keys(options.themes).filter(key => !options.themes[key].isDefault).map(key => ({ name: key }))
        }
      };

      const spriter = new SVGSpriter(config);

      await Promise.all(
        sprites[sprite].map(async image => {
          const file = await readFile(image);
          spriter.add(image, null, file);
        })
      );

      await new Promise((resolve, reject) => {
        spriter.compile(async (err, res) => {
          try {
            const css = join(cssPath, res.css.css.basename);
            const svg = join(svgPath, res.css.sprite.basename);
            let example = examplePath && join(examplePath, res.css.example.basename);

            const hash = gc.extractHash(svg);
            gc.addHash(hash);

            await writeFile(css, res.css.css.contents.toString());

            await Promise.all(Object.keys(options.themes).map(async (key) => {
              const theme = options.themes[key];

              const cpRenderer = new CustomPropertiesRenderer({
                variables: theme.variables,
                importFrom: theme.importFrom || [],
              });

              const svgContentString = await cpRenderer.process(res.css.sprite.contents.toString());
              let svgThemePath = svg;

              if (!theme.isDefault) {
                svgThemePath = join(svgPath, `${key}_${res.css.sprite.basename}`);
              }

              const tree = parseSVG(svgContentString);

              const replacementMap = {};
              const existIds = new Set();

              const idPrefix = `${key}_${res.css.sprite.basename}`.replace('.svg', '').split('-').slice(0, -1);

              tree.each('svg[id]', node => {
                function walkContent(content) {
                  return content.map(child => {
                    if (child.attrs && typeof child.attrs.id === 'string' && child.attrs.id.includes('___CHANGEME___')) {
                      let oldId = child.attrs.id;

                      function generateId(string, i = 0) {
                        if (existIds.has(string)) {
                          const newString = string + '_' + i;

                          if (existIds.has(newString)) {
                            return generateId(string, i + 1);
                          }

                          return newString;
                        } else {
                          return string;
                        }
                      }

                      child.attrs.id = generateId(`${idPrefix}_${node.attrs.id}___${child.tag}`);
                      existIds.add(child.attrs.id);

                      replacementMap[oldId] = child.attrs.id;
                    }


                    if (child.content) {
                      child.content = walkContent(child.content);
                    }

                    return child;
                  });
                }

                node.content = walkContent(node.content);

                return node;
              });

              tree.each('svg[id]', node => {
                function walkContent(content) {
                  return content.map(child => {
                    child.attrs && Object.keys(child.attrs).forEach(key => {
                      if (typeof child.attrs[key] === 'string') {
                        if (child.attrs[key].includes('___CHANGEME___')) {
                          let variableName;
                          if (child.attrs[key].startsWith('url')) {
                            variableName = /(?:#(.*)(?=\)))/.exec(child.attrs[key])[1];
                          } else if (child.attrs[key].startsWith('#')) {
                            variableName = child.attrs[key].replace('#', '');
                          }

                          if (variableName && replacementMap[variableName]) {
                            child.attrs[key] = child.attrs[key].replace(variableName, replacementMap[variableName]);
                          }
                        }
                      }
                    });


                    if (child.content) {
                      child.content = walkContent(child.content);
                    }

                    return child;
                  });
                }

                node.content = walkContent(node.content);

                return node;
              });

              await writeFile(svgThemePath, tree.toString());
            }));

            if (example) {
              example = example
                .replace('sprite.css.html', basename(svg, '.svg') + '.html');

              const defaultSVG = await readFile(svg);
              await writeFile(example, defaultSVG.toString());
            }

            if (converter) {
              await convert(
                converter,
                gc,
                {
                  css,
                  svg,
                  name: sprite
                },
                options
              );
            }
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });
    })
  );

  await gc.clear();
}

async function convert(converter, gc, sprite, options) {
  const png = await converter.process(sprite.svg);

  let css = await readFile(sprite.css);

  for (let scale of Object.keys(png)) {
    const absolutePNGPath = join(options.png.dest, basename(png[scale]));

    const hash = gc.extractHash(absolutePNGPath);
    gc.addHash(hash);

    css = css.toString().replace(`%png-path-${scale}%`, absolutePNGPath);
  }

  await writeFile(sprite.css, css.toString());
}

/**
 * Recursively find SVG and sprite that him belong
 *
 * @param {string} path Entrypoint with SVG icons
 */
function findSprites(path) {
  const found = [];

  async function find(findPath, basePath) {
    const files = await readdir(findPath);

    await Promise.all(
      files.map(async file => {
        const sprite = relative(basePath, findPath)
          .split("/")
          .join("-");

        join(findPath, file);
        const fileStat = await lstat(join(findPath, file));

        if (fileStat.isDirectory()) {
          await find(join(findPath, file), basePath);
        } else {
          if (extname(file) === ".svg") {
            if (!found[sprite]) {
              found[sprite] = [];
            }

            found[sprite].push(join(findPath, file));
          }
        }
      })
    );

    return found;
  }

  return find(path, path);
}

module.exports = generate;
