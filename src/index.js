const SVGSpriter = require("svg-sprite");
const fs = require("fs");
const { extname, join, relative, basename } = require("path");
const { promisify } = require("util");
const svgson = require("svgson-next");

const BaseConverter = require("./convert/BaseConverter");
const { fixSVG, mergeDeep, checkDir } = require("./utils");

const readdir = promisify(fs.readdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const lstat = promisify(fs.lstat);

/**
 *
 * @param {string} path Path to SVG icons entrypoint
 * @param {Object} output
 * @param {string} output.pngPath Path to folder where PNG sprites will be saved
 * @param {string} output.svgPath Path to folder where SVG sprites will be saved
 * @param {string} output.cssPath Path to folder where stylesheets will be saved
 * @param {BaseConverter} converter SVG to PNG converter
 * @param {Object} options
 * @param {Object} options.css
 * @param {string} options.css.stylesheetPrefix Prefix in stylesheet name
 * @param {string} options.css.class Base class for icons
 * @param {Object} options.svg
 * @param {string} options.svg.dest Path to SVG where it should be placed on website
 * @param {Object} options.png
 * @param {string} options.png.dest Path to SVG where it should be placed on website
 * @param {string} options.png.class PNG class in top of DOM (e.g in the `<head>` or `<body>`) to detect fallback need
 * @param {string} options.png.scalePrefix Prefix for class with needed scale. E.g `png_2x` or `fallback_1x`
 */
async function generate(path, output = {}, converter, options) {
  const { pngPath, svgPath, cssPath } = output;

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
    }
  };

  options = mergeDeep(defaultOptions, options);

  await checkDir(path);
  await checkDir(pngPath, true);
  await checkDir(svgPath, true);
  await checkDir(cssPath, true);

  const baseConfig = {
    shape: {
      dimension: {
        maxHeight: 50,
        attributes: true
      },
      id: {
        generator: function(name, file) {
          return file.stem;
        }
      }
    },
    svg: {
      xmlDeclaration: false,
      doctypeDeclaration: false,
      namespaceIDs: true,
      dimensionAttributes: false
    },
    variables: {
      now: +new Date(),
      png: function() {
        return function(sprite, render) {
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
        render: {
          css: true
        }
      }
    },
    dest: cssPath
  };

  const sprites = await findSprites(path, path);

  await Promise.all(
    await Object.keys(sprites).map(async sprite => {
      const config = {
        ...baseConfig,
        mode: {
          css: {
            ...baseConfig.mode.css,
            sprite: `${sprite}.svg`,
            prefix: `.${options.css.class}-${sprite}__%s`,
            common: `${options.css.class}-${sprite}`,
            render: {
              less: {
                dest:
                  join(cssPath, `${options.css.stylesheetPrefix}${sprite}`) +
                  ".less",
                template: join(__dirname, "TEMPLATE.mustache")
              }
            }
          }
        },
        variables: {
          options,
          scales: converter.scales
        }
      };

      const spriter = new SVGSpriter(config);

      await Promise.all(
        sprites[sprite].map(async image => {
          const file = await readFile(image);
          spriter.add(image, null, file);
        })
      );

      await new Promise((resolve) => {
        spriter.compile(async (err, res) => {
          const css = join(cssPath, res.css.less.basename);
          const svg = join(svgPath, res.css.sprite.basename);

          const svgAST = await svgson.parse(res.css.sprite.contents.toString());
          const svgContents = svgson.stringify(fixSVG(svgAST));

          await writeFile(css, res.css.less.contents.toString());
          await writeFile(svg, svgContents);

          if (converter) {
            await convert(converter, {
              css,
              svg,
              name: sprite
            }, options);
          }

          resolve();
        })
      })
    })
  );
}

async function convert(converter, sprite, options) {
  const png = await converter.process(sprite.svg);

  let css = await readFile(sprite.css);

  for (let scale of Object.keys(png)) {
    const absolutePNGPath = join(options.png.dest, basename(png[scale]));

    css = css.toString().replace(`%png-path-${scale}%`, absolutePNGPath);
  }

  await writeFile(sprite.css, css.toString())
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
