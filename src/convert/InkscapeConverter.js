const cp = require("child_process");
const { promisify } = require("util");
const { resolve, basename, join } = require("path");
const semver = require('semver');

const exec = promisify(cp.exec);
const BaseConverter = require("./BaseConverter");

class InkscapeConverter extends BaseConverter {
  constructor(scales, output, binary) {
    super(scales, output);
    this.binary = binary;
  }

  async loadVersion() {
    if (this.version) {
      return Promise.resolve();
    }

    const script = `${this.binary} -V`;

    const versionRaw = (await exec(script)).stdout;

    const version = /^(?:Inkscape )([^\s]*)/.exec(versionRaw)[1];

    const validatedVersion = semver.coerce(version);

    if (validatedVersion.major === 0 && validatedVersion.minor < 91) {
      throw new Error('Unsupported Inkscape version'); 
    }

    this.version = validatedVersion;
  }

  async process(svg) {
    await this.loadVersion();

    const svgPath = resolve(svg);

    const result = {};

    await Promise.all(
      this.scales.map(async scale => {
        const svgName = basename(svgPath);

        const pngPath = join(
          this.output,
          svgName.substr(0, svgName.lastIndexOf(".")) + `_${scale}x.png`
        );

        let script = `${this.binary} ${svgPath} --export-dpi=${scale *
          92} --without-gui`;

        if (this.version.major === 1) {
          script += ` --export-file=${pngPath}`;
        } else if (this.version.major === 0 && this.version.minor >= 90) {
          script += ` --export-png=${pngPath}`
        } else {
          throw new Error('Unsupported Inkscape version');
        }

        await exec(
          script
        );

        result[scale] = pngPath;
      })
    );

    return result;
  }
}

module.exports = InkscapeConverter;
