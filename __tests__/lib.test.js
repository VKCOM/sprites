const tmp = require('tmp');
const fs = require('fs-extra');
const puppeteer = require('puppeteer');
const { promisify } = require('util');
const path = require('path');
const async = require("async");

const generate = require('../src/index');
const InkscapeConverter = require("../src/convert/InkscapeConverter");

const { toMatchImageSnapshot } = require('jest-image-snapshot');
expect.extend({ toMatchImageSnapshot });

const createTempDir = promisify(tmp.dir);
tmp.setGracefulCleanup();

const baseSpriteOptions = {
  css: {
    stylesheetPrefix: "sprite-"
  },
  svg: {
    dest: "/images/mobile/icons/svg/"
  },
  png: {
    scalePrefix: "vk_",
    class: "png",
    dest: "/images/mobile/icons/svg"
  }
};

async function getTempOutputPaths() {
  const tempDir = await createTempDir();

  const pngPath = path.resolve(tempDir, "png");
  const svgPath = path.resolve(tempDir, "svg");
  const cssPath = path.resolve(tempDir, "css");
  const examplePath = path.resolve(tempDir, "example");

  return {
    pngPath,
    svgPath,
    cssPath,
    examplePath
  };
}

async function verifyExamples(examplePath) {
  const browser = await puppeteer.launch();
  const exampleFiles = await fs.readdir(examplePath);

  const examplesNameMap = exampleFiles
    .map(name => name.split('-'))
    .reduce((acc, splittedName) => {
      acc[splittedName.join('-')] = splittedName.slice(0, -1).join('-')

      return acc;
    }, {});


  await async.forEachOf(exampleFiles, async file => {
    {
      const page = await browser.newPage();

      await page.goto('file://' + path.resolve(examplePath, file));
      const image = await page.screenshot();

      expect(image).toMatchImageSnapshot({
        customSnapshotIdentifier: examplesNameMap[file],
      });
    }
  });

  await browser.close();
}

it('works without example', async () => {
  const input = path.resolve(__dirname, "./fixtures/render");

  const { pngPath, svgPath, cssPath } = await getTempOutputPaths();

  await generate(
    input,
    {
      pngPath,
      svgPath,
      cssPath,
    },
    null,
    baseSpriteOptions
  );
});

describe('renders correctly', () => {
  it('without PNG converter', (async () => {
    const input = path.resolve(__dirname, "./fixtures/render");

    const { pngPath, svgPath, cssPath, examplePath } = await getTempOutputPaths();

    await generate(
      input,
      {
        pngPath,
        svgPath,
        cssPath,
        examplePath
      },
      null,
      baseSpriteOptions
    );

    await verifyExamples(examplePath);
  }));

  it('with defined theme', (async () => {
    const input = path.resolve(__dirname, "./fixtures/render-with-vars");

    const { pngPath, svgPath, cssPath, examplePath } = await getTempOutputPaths();

    await generate(
      input,
      {
        pngPath,
        svgPath,
        cssPath,
        examplePath
      },
      null,
      {
        ...baseSpriteOptions,
        themes: {
          'light': {
            isDefault: true,
            variables: {
              '--red': '#f00',
              '--green': '#0f0',
            },
          },
        },
      }
    );

    await verifyExamples(examplePath);
  }));
});

describe('fails', () => {
  it('without colors in theme', (async () => {
    const input = path.resolve(__dirname, "./fixtures/render-no-theme");

    const { pngPath, svgPath, cssPath, examplePath } = await getTempOutputPaths();
    expect.assertions(1);

    try {
      await generate(
        input,
        {
          pngPath,
          svgPath,
          cssPath,
          examplePath
        },
        null,
        baseSpriteOptions
      );
    } catch(error) {
      expect(error).toBeInstanceOf(Error);
    }
  }));
});