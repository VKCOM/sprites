const { exec } = require("child_process");

class BaseConverter {
  /**
   *
   * @param {Number[]} scales Array of scales need to return
   */
  constructor(scales = [1]) {
    this.scales = scales;
  }

  /**
   * Process SVG file and get PNG in several scales
   *
   * @param {string} svg Path to SVG file will be converted
   */
  process(svg) {}
}

module.exports = BaseConverter;
