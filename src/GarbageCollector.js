const { join, parse } = require("path");
const { promisify } = require("util");
const fs = require('fs');

const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);


class GarbageCollector {
  constructor() {
    this.hashes = new Set();
    this.paths = new Set();
  }

  addPath(path) {
    this.paths.add(path);
  }

  addHash(hash) {
    this.hashes.add(hash);
  }

  extractHash(path) {
    const fileInfo = parse(path.split("-").pop());
    const fileHash = fileInfo.name.split("_").shift();

    return fileHash;
  }

  async clear() {
    for (const path of this.paths) {
      const files = await readdir(path);

      for (const file of files) {
        const hash = this.extractHash(file);

        if (!this.hashes.has(hash)) {
          await unlink(join(path, file));
        }
      }
    }
  }
}

module.exports = GarbageCollector;