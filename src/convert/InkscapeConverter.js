const cp = require("child_process");
const { promisify } = require("util");
const { resolve } = require("path");

const exec = promisify(cp.exec);
const BaseConverter = require("./BaseConverter");

class InkscapeConverter extends BaseConverter {
  constructor(scales, binary) {
    super(scales);
    this.binary = binary;
  }

  async process(svg) {
    const svgPath = resolve(svg);

    const result = {};

    for await (let scale of this.scales) {
      const pngPath =
        svgPath.substr(0, svgPath.lastIndexOf(".")) + `_${scale}x.png`;

      await exec(
        `${this.binary} ${svgPath} -e ${pngPath} -d=${scale * 92} --without-gui`
      );

      result[scale] = pngPath;
    }

    return result;
  }
}

module.exports = InkscapeConverter;
