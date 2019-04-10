const SVGSpriter = require("svg-sprite");
const fs = require("fs");
const fsExtra = require("fs-extra");
const { extname, join, relative } = require("path");
const { promisify } = require("util");

const BaseConverter = require("./convert/BaseConverter");

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const flushDir = promisify(fsExtra.emptyDir);

/**
 *
 * @param {string} path Path to SVG icons entrypoint
 * @param {Object} output
 * @param {string} output.pngPath Path to folder where PNG sprites will be saved
 * @param {string} output.svgPath Path to folder where SVG sprites will be saved
 * @param {string} output.cssPath Path to folder where stylesheets will be saved
 * @param {BaseConverter} converter SVG to PNG converter
 * @param {Object} options
 * @param {string} options.cssPrefix Prefix in stylesheet name
 */
async function generate(path, output = {}, converter, options) {
  const { pngPath, svgPath, cssPath } = output;

  await checkDir(path);
  await checkDir(pngPath, true);
  await checkDir(svgPath, true);
  await checkDir(cssPath, true);

  const baseConfig = {
    shape: {
      dimension: {
        maxHeight: 50,
        attributes: true
      }
    },
    mode: {
      css: {
        dest: cssPath,
        common: "svgIcon",
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
  const svgSprites = [];
  for await (sprite of Object.keys(sprites)) {
    const config = {
      ...baseConfig,
      mode: {
        css: {
          ...baseConfig.mode.css,
          sprite: `${sprite || "sprite"}.svg`,
          prefix: `.svgSprite-${sprite}__%s`,
          render: {
            less: {
              dest: join(cssPath, `${options.cssPrefix}${sprite}`) + ".less"
            }
          }
        }
      }
    };

    const spriter = new SVGSpriter(config);
    for await (image of sprites[sprite]) {
      const file = await readFile(image);
      spriter.add(image, null, file);
    }

    const compile = promisify(spriter.compile).bind(spriter);
    const res = await compile();

    const css = join(cssPath, res.css.less.basename);
    const svg = join(svgPath, res.css.sprite.basename);

    await writeFile(css, res.css.less.contents.toString());
    await writeFile(svg, res.css.sprite.contents.toString());

    svgSprites.push({ css, svg });
  }

  if (converter) {
    for await (sprite of svgSprites) {
      const png = await converter.process(sprite.svg);
    }
  }
}

/**
 * Recursively find SVG and sprite that him belong
 *
 * @param {string} path Entrypoint with SVG icons
 */
function findSprites(path) {
  const found = [];

  async function find(findPath, basePath) {
    const files = await readdir(findPath, { withFileTypes: true });

    for await (file of files) {
      const sprite = relative(basePath, findPath)
        .split("/")
        .join("-");

      if (file.isDirectory()) {
        await find(join(findPath, file.name), basePath);
      } else {
        if (extname(file.name) === ".svg") {
          if (!found[sprite]) {
            found[sprite] = [];
          }

          found[sprite].push(join(findPath, file.name));
        }
      }
    }

    return found;
  }

  return find(path, path);
}

async function checkDir(path, flush) {
  if (!path) {
    return;
  }

  try {
    await stat(path);

    if (flush) {
      await flushDir(path);
    }
  } catch (err) {
    await mkdir(path);
  }
}

module.exports = generate;
