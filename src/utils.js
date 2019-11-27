const { promisify } = require("util");
const fs = require("fs");
const fsExtra = require("fs-extra");
const { parse, stringify } = require("svg-path-tools");

const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);
const flushDir = promisify(fsExtra.emptyDir);

function isObject(item) {
  return item && typeof item === "object" && !Array.isArray(item);
}

function mergeDeep(target, ...sources) {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
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

module.exports = {
  isObject,
  mergeDeep,
  checkDir
};
