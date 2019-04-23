const { exec } = require("child_process");

class BaseConverter {
  /**
   *
   * @param {Number[]} scales Array of scales need to return
   * @param {string} output Folder where PNG will be saved
   */
  constructor(scales = [1], output) {
    this.scales = scales;
    this.output = output;
  }

  /**
   * Process SVG file and get PNG in several scales
   *
   * @param {string} svg Path to SVG file will be converted
   *
   * @returns {Object} File path for every scale
   */
  process(svg) {}
}

module.exports = BaseConverter;
