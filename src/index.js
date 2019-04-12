const SVGSpriter = require("svg-sprite");
const fs = require("fs");
const fsExtra = require("fs-extra");
const { extname, join, relative, basename } = require("path");
const { promisify } = require("util");
const postcss = require("postcss");
const imageSize = require("image-size");
const svgson = require("svgson-next");
const { parse, stringify } = require("svg-path-tools");

const BaseConverter = require("./convert/BaseConverter");

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const flushDir = promisify(fsExtra.emptyDir);
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
 * @param {string} options.cssPrefix Prefix in stylesheet name
 * @param {string} options.svgDest Path to SVG where it should be placed in site
 * @param {string} options.pngDest Path to SVG where it should be placed in site
 * @param {string} options.pngClass PNG class in top of page to detect fallback need
 * @param {string} options.pngClassPrefix
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
      },
      spacing: {
        padding: 2
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
  await Promise.all(
    Object.keys(sprites).map(async sprite => {
      const config = {
        ...baseConfig,
        mode: {
          css: {
            ...baseConfig.mode.css,
            sprite: `${sprite || "sprite"}.svg`,
            prefix: `.svgIcon-${sprite}__%s`,
            common: `svgIcon .svgIcon-${sprite}`,
            render: {
              less: {
                dest: join(cssPath, `${options.cssPrefix}${sprite}`) + ".less"
              }
            }
          }
        }
      };

      const spriter = new SVGSpriter(config);

      await Promise.all(
        sprites[sprite].map(async image => {
          const file = await readFile(image);
          spriter.add(image, null, file);
        })
      );

      const compile = promisify(spriter.compile).bind(spriter);
      const res = await compile();

      const css = join(cssPath, res.css.less.basename);
      const svg = join(svgPath, res.css.sprite.basename);

      const svgAST = await svgson.parse(res.css.sprite.contents.toString());
      const svgContents = svgson.stringify(fixSVG(svgAST));

      await writeFile(css, res.css.less.contents.toString());
      await writeFile(svg, svgContents);

      svgSprites.push({ css, svg, name: sprite });

      if (converter) {
        await convert(converter, svgSprites, options);
      }
    })
  );
}

async function convert(converter, svgSprites, options) {
  await Promise.all(
    svgSprites.map(async sprite => {
      const css = await readFile(sprite.css);
      const root = postcss.parse(css.toString());

      const png = await converter.process(sprite.svg);
      const svgFile = await readFile(sprite.svg);
      const width = imageSize(svgFile).width;

      const absoluteSVGPath = join(options.svgDest, basename(sprite.svg));

      // Change SVG path to destination and add fallback
      root.walkDecls("background", async rule => {
        // console.log(rule.parent.parent === root);
        if (rule.parent.parent !== root) {
          return;
        }

        rule.value = `url(${absoluteSVGPath}) 0 0 / ~"${width}px"`;

        for (let scale of Object.keys(png)) {
          const absolutePNGPath = join(options.pngDest, basename(png[scale]));

          let scaleClass = `,.${options.pngClassPrefix}${scale}x`;
          if (scale === "1") {
            scaleClass = "";
          }

          rule.after(
            `\n\t.${
              options.pngClass
            }${scaleClass} & { background: url(${absolutePNGPath}) 0 0 / ~"${width}px" no-repeat; }\n
          `
          );
        }

        return rule;
      });

      await writeFile(sprite.css, root.toString());
    })
  );
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

/**
 * Fix SVG for old versions of Inkscape
 */
function fixSVG(obj) {
  obj.children = obj.children.map(value => {
    if (value.name === "path") {
      const d = value.attributes.d;

      value.attributes.d = stringify(parse(d));
    }

    if (value.children) {
      return fixSVG(value);
    }

    return value;
  });

  return obj;
}

module.exports = generate;
